import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  DB: any;
  AUTHING_DOMAIN?: string;
}

type AppealStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REFUNDED';

type RefundAppealRow = {
  id: string;
  user_id: string;
  appeal_type: string;
  source_type: string;
  source_id?: string | null;
  title: string;
  description?: string | null;
  requested_refund_tokens?: number | null;
  requested_refund_amount?: number | null;
  evidence_json?: string | null;
  status: AppealStatus;
  auto_check_result?: string | null;
  resolution_summary?: string | null;
  admin_note?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RecentGenerationJobRow = {
  id: string;
  mode: string;
  status: string;
  stage: string;
  progress?: number | null;
  charged_tokens?: number | null;
  created_at?: string | null;
};

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function createAppealId() {
  return `appeal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function assertRefundAppealsTable(env: Env) {
  const row = (await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'RefundAppeals'")
    .first()) as { name?: string | null } | null;

  if (row?.name === 'RefundAppeals') return;
  throw new Error('D1_SCHEMA_MISSING:RefundAppeals');
}

async function verifyUserIdFromAuth(request: Request, env: Env, expectedUserId: string): Promise<void> {
  const authingDomain = env.AUTHING_DOMAIN || 'YOUR_AUTHING_DOMAIN';
  if (!authingDomain || authingDomain.includes('YOUR_AUTHING_DOMAIN')) return;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  const cleanDomain = authingDomain.replace(/^https?:\/\//, '');
  const jwks = createRemoteJWKSet(new URL(`https://${cleanDomain}/oidc/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks);
  const claimedUserId = typeof payload.sub === 'string' ? payload.sub.trim() : '';

  if (claimedUserId && claimedUserId !== expectedUserId) {
    throw new Error('FORBIDDEN');
  }
}

function serializeAppeal(row: RefundAppealRow) {
  return {
    ...row,
    requested_refund_tokens: Number(row.requested_refund_tokens ?? 0),
    requested_refund_amount: Number(row.requested_refund_amount ?? 0),
    evidence_json: row.evidence_json ? (() => {
      try {
        return JSON.parse(row.evidence_json);
      } catch {
        return row.evidence_json;
      }
    })() : null,
  };
}

async function runLightAutoCheck(env: Env, input: {
  sourceType: string;
  sourceId?: string | null;
  requestedRefundTokens: number;
}) {
  if (input.sourceType !== 'generation_job' || !input.sourceId) {
    return null;
  }

  const hasLedger = (await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'GenerationChargeLedger'")
    .first()) as { name?: string | null } | null;

  if (hasLedger?.name !== 'GenerationChargeLedger') {
    return 'GENERATION_LEDGER_UNAVAILABLE';
  }

  const row = (await env.DB
    .prepare(`
      SELECT COALESCE(SUM(token_delta), 0) AS charged_tokens
      FROM GenerationChargeLedger
      WHERE job_id = ?1 AND action_type = 'CHARGE'
    `)
    .bind(input.sourceId)
    .first()) as { charged_tokens?: number | null } | null;

  const chargedTokens = Number(row?.charged_tokens ?? 0);
  if (chargedTokens <= 0) {
    return 'NO_CHARGE_FOUND_FOR_JOB';
  }
  if (input.requestedRefundTokens > 0 && input.requestedRefundTokens > chargedTokens) {
    return `REQUEST_EXCEEDS_CHARGED:${chargedTokens}`;
  }
  return `CHARGED_TOKENS:${chargedTokens}`;
}

async function getRecentGenerationJobs(env: Env, userId: string) {
  const hasJobs = (await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'GenerationJobs'")
    .first()) as { name?: string | null } | null;

  if (hasJobs?.name !== 'GenerationJobs') return [];

  const hasOutputs = (await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'GenerationOutputs'")
    .first()) as { name?: string | null } | null;

  const chargedTokenQuery = hasOutputs?.name === 'GenerationOutputs'
    ? `COALESCE((SELECT SUM(o.charged_tokens) FROM GenerationOutputs o WHERE o.job_id = j.id), 0)`
    : '0';

  const rows = (await env.DB
    .prepare(`
      SELECT
        j.id,
        j.mode,
        j.status,
        j.stage,
        j.progress,
        ${chargedTokenQuery} AS charged_tokens,
        j.created_at
      FROM GenerationJobs j
      WHERE j.user_id = ?1
      ORDER BY j.created_at DESC
      LIMIT 12
    `)
    .bind(userId)
    .all()).results as RecentGenerationJobRow[];

  return rows.map((row) => ({
    ...row,
    progress: Number(row.progress ?? 0),
    charged_tokens: Number(row.charged_tokens ?? 0),
  }));
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context: { env: Env; request: Request }) {
  const { env, request } = context;

  try {
    await assertRefundAppealsTable(env);
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId')?.trim() || '';

    if (!userId) {
      return json({ success: false, error: 'INVALID_REQUEST', message: '缺少 userId' }, 400);
    }

    await verifyUserIdFromAuth(request, env, userId);

    const rows = (await env.DB
      .prepare(`
        SELECT id, user_id, appeal_type, source_type, source_id, title, description, requested_refund_tokens,
               requested_refund_amount, evidence_json, status, auto_check_result, resolution_summary,
               admin_note, resolved_by, resolved_at, created_at, updated_at
        FROM RefundAppeals
        WHERE user_id = ?1
        ORDER BY created_at DESC
      `)
      .bind(userId)
      .all()).results as RefundAppealRow[];

    const recentGenerationJobs = await getRecentGenerationJobs(env, userId);

    return json({
      success: true,
      items: rows.map(serializeAppeal),
      recent_generation_jobs: recentGenerationJobs,
    });
  } catch (error: any) {
    const message = String(error?.message || '申诉记录加载失败');
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return json({ success: false, error: message, message }, status);
  }
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  const { env, request } = context;

  try {
    await assertRefundAppealsTable(env);
    const body = (await request.json()) as {
      userId?: string;
      appealType?: string;
      sourceType?: string;
      sourceId?: string | null;
      title?: string;
      description?: string;
      requestedRefundTokens?: number;
      requestedRefundAmount?: number;
      evidence?: unknown;
    };

    const userId = String(body.userId || '').trim();
    const appealType = String(body.appealType || '').trim();
    const sourceType = String(body.sourceType || '').trim();
    const sourceId = body.sourceId ? String(body.sourceId).trim() : null;
    const title = String(body.title || '').trim();
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const requestedRefundTokens = Math.max(0, Math.round(Number(body.requestedRefundTokens || 0)));
    const requestedRefundAmount = Math.max(0, Number(body.requestedRefundAmount || 0));

    if (!userId || !appealType || !sourceType || !title) {
      return json({ success: false, error: 'INVALID_REQUEST', message: '缺少必填字段' }, 400);
    }

    await verifyUserIdFromAuth(request, env, userId);

    const appealId = createAppealId();
    const autoCheckResult = await runLightAutoCheck(env, {
      sourceType,
      sourceId,
      requestedRefundTokens,
    });

    await env.DB
      .prepare(`
        INSERT INTO RefundAppeals (
          id, user_id, appeal_type, source_type, source_id, title, description,
          requested_refund_tokens, requested_refund_amount, evidence_json, status, auto_check_result
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'SUBMITTED', ?11)
      `)
      .bind(
        appealId,
        userId,
        appealType,
        sourceType,
        sourceId,
        title,
        description || null,
        requestedRefundTokens,
        requestedRefundAmount,
        body.evidence ? JSON.stringify(body.evidence) : null,
        autoCheckResult,
      )
      .run();

    return json({
      success: true,
      appealId,
      message: '申诉已提交，我们会尽快核查',
      auto_check_result: autoCheckResult,
    });
  } catch (error: any) {
    const message = String(error?.message || '申诉提交失败');
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return json({ success: false, error: message, message }, status);
  }
}
