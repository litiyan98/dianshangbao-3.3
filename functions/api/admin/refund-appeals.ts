import { createRemoteJWKSet, jwtVerify } from 'jose';
import { extractPhoneFromClaims, resolveAdminAccess } from '../_adminQuota';

interface Env {
  DB: any;
  AUTHING_DOMAIN?: string;
}

type RefundAppealStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
type RefundAppealActionType =
  | 'MARK_UNDER_REVIEW'
  | 'APPROVE_TOKEN_REFUND'
  | 'RESOLVE_NO_REFUND'
  | 'REJECT_APPEAL';

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
  status: RefundAppealStatus;
  auto_check_result?: string | null;
  resolution_summary?: string | null;
  admin_note?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type GenerationJobRow = {
  id: string;
  user_id: string;
  trace_id?: string | null;
  mode: string;
  status: string;
  stage: string;
  progress?: number | null;
  message?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type OutputRow = {
  id: string;
  job_id: string;
  user_id: string;
  trace_id?: string | null;
  slot_index?: number | null;
  mode: string;
  model_name?: string | null;
  status: string;
  image_url?: string | null;
  prompt_snapshot?: string | null;
  error_message?: string | null;
  charged_tokens?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type LedgerRow = {
  id: string;
  job_id: string;
  user_id: string;
  output_id?: string | null;
  trace_id?: string | null;
  slot_index?: number | null;
  action_type: string;
  token_delta?: number | null;
  reason?: string | null;
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

function createChargeLedgerId() {
  return `gchg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getTableExists(env: Env, tableName: string): Promise<boolean> {
  const row = (await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
    .bind(tableName)
    .first()) as { name?: string | null } | null;
  return row?.name === tableName;
}

function serializeAppeal(row: RefundAppealRow) {
  return {
    ...row,
    requested_refund_tokens: Number(row.requested_refund_tokens ?? 0),
    requested_refund_amount: Number(row.requested_refund_amount ?? 0),
    evidence_json: row.evidence_json
      ? (() => {
          try {
            return JSON.parse(row.evidence_json);
          } catch {
            return row.evidence_json;
          }
        })()
      : null,
  };
}

async function verifyAdminRequest(request: Request, env: Env): Promise<{ adminUserId: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');

  const authingDomain = env.AUTHING_DOMAIN || 'YOUR_AUTHING_DOMAIN';
  if (!authingDomain || authingDomain.includes('YOUR_AUTHING_DOMAIN')) {
    throw new Error('AUTHING_DOMAIN_NOT_CONFIGURED');
  }

  const token = authHeader.split(' ')[1];
  const cleanDomain = authingDomain.replace(/^https?:\/\//, '');
  const jwks = createRemoteJWKSet(new URL(`https://${cleanDomain}/oidc/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks);
  const adminUserId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const phone = extractPhoneFromClaims(payload as Record<string, unknown>);

  if (!adminUserId) throw new Error('UNAUTHORIZED');

  const access = await resolveAdminAccess(env, { userId: adminUserId, phone });
  if (!access.isAdmin) throw new Error('FORBIDDEN');

  return { adminUserId };
}

async function getUsersColumns(env: Env): Promise<Set<string>> {
  const result = await env.DB.prepare('PRAGMA table_info(Users)').all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  return new Set(rows.map((row: any) => String(row?.name || '')).filter(Boolean));
}

async function creditUserImageTokens(env: Env, userId: string, tokenAmount: number): Promise<void> {
  if (!tokenAmount || tokenAmount <= 0) return;

  const userColumns = await getUsersColumns(env);
  const hasCredits = userColumns.has('credits');
  const hasImageQuota = userColumns.has('image_quota');

  const insertColumns = ['user_id'];
  const insertValues: Array<string | number> = [userId];
  const updateFragments: string[] = [];

  if (hasCredits) {
    insertColumns.push('credits');
    insertValues.push(tokenAmount);
    updateFragments.push(`credits = COALESCE(Users.credits, 0) + ${tokenAmount}`);
  }

  if (hasImageQuota) {
    insertColumns.push('image_quota');
    insertValues.push(tokenAmount);
    updateFragments.push(`image_quota = COALESCE(Users.image_quota, 0) + ${tokenAmount}`);
  }

  if (!updateFragments.length) {
    await env.DB.prepare('INSERT OR IGNORE INTO Users (user_id) VALUES (?1)').bind(userId).run();
    return;
  }

  await env.DB
    .prepare(`
      INSERT INTO Users (${insertColumns.join(', ')})
      VALUES (${insertColumns.map((_, index) => `?${index + 1}`).join(', ')})
      ON CONFLICT(user_id) DO UPDATE SET
        ${updateFragments.join(', ')}
    `)
    .bind(...insertValues)
    .run();
}

async function insertGenerationRefundLedger(
  env: Env,
  input: { appealId: string; jobId: string; userId: string; tokenDelta: number },
) {
  if (!(await getTableExists(env, 'GenerationChargeLedger'))) return;

  await env.DB
    .prepare(`
      INSERT INTO GenerationChargeLedger (
        id, job_id, user_id, output_id, trace_id, slot_index, action_type, token_delta, reason
      )
      VALUES (?1, ?2, ?3, NULL, NULL, 0, 'REFUND', ?4, ?5)
    `)
    .bind(
      createChargeLedgerId(),
      input.jobId,
      input.userId,
      input.tokenDelta,
      `退款申诉通过：${input.appealId}`,
    )
    .run();
}

async function listAppeals(env: Env, searchParams: URLSearchParams) {
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || 20)));
  const status = searchParams.get('status')?.trim() || '';
  const userId = searchParams.get('userId')?.trim() || '';
  const appealType = searchParams.get('appealType')?.trim() || '';

  const where: string[] = [];
  const values: Array<string | number> = [];

  if (status) {
    where.push(`status = ?${values.length + 1}`);
    values.push(status);
  }
  if (userId) {
    where.push(`user_id = ?${values.length + 1}`);
    values.push(userId);
  }
  if (appealType) {
    where.push(`appeal_type = ?${values.length + 1}`);
    values.push(appealType);
  }

  values.push(limit);

  const rows = (await env.DB
    .prepare(`
      SELECT
        id, user_id, appeal_type, source_type, source_id, title, description,
        requested_refund_tokens, requested_refund_amount, evidence_json, status,
        auto_check_result, resolution_summary, admin_note, resolved_by, resolved_at,
        created_at, updated_at
      FROM RefundAppeals
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC
      LIMIT ?${values.length}
    `)
    .bind(...values)
    .all()).results as RefundAppealRow[];

  return rows.map((row) => {
    const serialized = serializeAppeal(row);
    const reviewPriority =
      serialized.status === 'SUBMITTED'
        ? serialized.source_type === 'generation_job'
          ? 'high'
          : 'review'
        : serialized.status === 'UNDER_REVIEW'
          ? 'review'
          : 'normal';
    return {
      ...serialized,
      review_priority: reviewPriority,
    };
  });
}

async function getAppealDetail(env: Env, appealId: string) {
  const appealRow = (await env.DB
    .prepare(`
      SELECT
        id, user_id, appeal_type, source_type, source_id, title, description,
        requested_refund_tokens, requested_refund_amount, evidence_json, status,
        auto_check_result, resolution_summary, admin_note, resolved_by, resolved_at,
        created_at, updated_at
      FROM RefundAppeals
      WHERE id = ?1
      LIMIT 1
    `)
    .bind(appealId)
    .first()) as RefundAppealRow | null;

  if (!appealRow) return null;

  const appeal = serializeAppeal(appealRow);
  let relatedJob: GenerationJobRow | null = null;
  let outputs: OutputRow[] = [];
  let ledger: LedgerRow[] = [];

  if (appeal.source_type === 'generation_job' && appeal.source_id && await getTableExists(env, 'GenerationJobs')) {
    relatedJob = (await env.DB
      .prepare(`
        SELECT id, user_id, trace_id, mode, status, stage, progress, message, error_message, created_at, updated_at
        FROM GenerationJobs
        WHERE id = ?1
        LIMIT 1
      `)
      .bind(appeal.source_id)
      .first()) as GenerationJobRow | null;

    if (relatedJob && await getTableExists(env, 'GenerationOutputs')) {
      outputs = (await env.DB
        .prepare(`
          SELECT id, job_id, user_id, trace_id, slot_index, mode, model_name, status, image_url, prompt_snapshot,
                 error_message, charged_tokens, created_at, updated_at
          FROM GenerationOutputs
          WHERE job_id = ?1
          ORDER BY slot_index ASC, created_at ASC
        `)
        .bind(appeal.source_id)
        .all()).results as OutputRow[];
    }

    if (relatedJob && await getTableExists(env, 'GenerationChargeLedger')) {
      ledger = (await env.DB
        .prepare(`
          SELECT id, job_id, user_id, output_id, trace_id, slot_index, action_type, token_delta, reason, created_at
          FROM GenerationChargeLedger
          WHERE job_id = ?1
          ORDER BY created_at DESC
        `)
        .bind(appeal.source_id)
        .all()).results as LedgerRow[];
    }
  }

  return {
    appeal,
    related_job: relatedJob ? { ...relatedJob, progress: Number(relatedJob.progress ?? 0) } : null,
    outputs: outputs.map((item) => ({
      ...item,
      slot_index: Number(item.slot_index ?? 0),
      charged_tokens: Number(item.charged_tokens ?? 0),
    })),
    ledger: ledger.map((item) => ({
      ...item,
      slot_index: Number(item.slot_index ?? 0),
      token_delta: Number(item.token_delta ?? 0),
    })),
  };
}

async function handleAppealAction(env: Env, request: Request, adminUserId: string) {
  const body = (await request.json()) as {
    appealId?: string;
    actionType?: RefundAppealActionType;
    refundTokens?: number;
    note?: string | null;
  };

  const appealId = String(body.appealId || '').trim();
  const actionType = body.actionType;
  const refundTokens = Math.max(0, Math.round(Number(body.refundTokens || 0)));
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!appealId || !actionType) {
    return json({ success: false, error: 'INVALID_REQUEST', message: '缺少 appealId 或 actionType' }, 400);
  }

  const appealRow = (await env.DB
    .prepare(`
      SELECT
        id, user_id, appeal_type, source_type, source_id, title, description,
        requested_refund_tokens, requested_refund_amount, evidence_json, status,
        auto_check_result, resolution_summary, admin_note, resolved_by, resolved_at,
        created_at, updated_at
      FROM RefundAppeals
      WHERE id = ?1
      LIMIT 1
    `)
    .bind(appealId)
    .first()) as RefundAppealRow | null;

  if (!appealRow) {
    return json({ success: false, error: 'NOT_FOUND', message: '申诉单不存在' }, 404);
  }

  const appeal = serializeAppeal(appealRow);
  const tokenDelta = actionType === 'APPROVE_TOKEN_REFUND'
    ? Math.max(1, refundTokens || Number(appeal.requested_refund_tokens ?? 0) || 1)
    : 0;

  let nextStatus: RefundAppealStatus = 'UNDER_REVIEW';
  let resolutionSummary = note || appeal.resolution_summary || null;

  if (actionType === 'APPROVE_TOKEN_REFUND') {
    await creditUserImageTokens(env, appeal.user_id, tokenDelta);
    if (appeal.source_type === 'generation_job' && appeal.source_id) {
      await insertGenerationRefundLedger(env, {
        appealId,
        jobId: appeal.source_id,
        userId: appeal.user_id,
        tokenDelta,
      });
    }
    nextStatus = 'REFUNDED';
    resolutionSummary = note || `管理员已退回 ${tokenDelta} Token`;
  } else if (actionType === 'REJECT_APPEAL') {
    nextStatus = 'REJECTED';
    resolutionSummary = note || '申诉未通过，请查看管理员备注';
  } else if (actionType === 'RESOLVE_NO_REFUND') {
    nextStatus = 'APPROVED';
    resolutionSummary = note || '已核查，本次不做 Token 退回';
  }

  await env.DB
    .prepare(`
      UPDATE RefundAppeals
      SET
        status = ?2,
        resolution_summary = ?3,
        admin_note = ?4,
        resolved_by = ?5,
        resolved_at = CASE WHEN ?6 = 1 THEN datetime('now') ELSE resolved_at END,
        updated_at = datetime('now')
      WHERE id = ?1
    `)
    .bind(
      appealId,
      nextStatus,
      resolutionSummary,
      note || null,
      adminUserId,
      actionType === 'MARK_UNDER_REVIEW' ? 0 : 1,
    )
    .run();

  return json({
    success: true,
    appealId,
    actionType,
    tokenAmount: tokenDelta,
    message:
      actionType === 'APPROVE_TOKEN_REFUND'
        ? `申诉已通过，退回 ${tokenDelta} Token`
        : actionType === 'REJECT_APPEAL'
          ? '申诉已驳回'
          : actionType === 'RESOLVE_NO_REFUND'
            ? '已记录为核查完成'
            : '申诉单已转入审核中',
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context: { env: Env; request: Request }) {
  const { env, request } = context;

  try {
    await verifyAdminRequest(request, env);

    if (!(await getTableExists(env, 'RefundAppeals'))) {
      return json({ success: false, error: 'D1_SCHEMA_MISSING:RefundAppeals', message: '数据库缺少 RefundAppeals 表' }, 500);
    }

    const url = new URL(request.url);
    const appealId = url.searchParams.get('appealId')?.trim() || '';

    if (appealId) {
      const detail = await getAppealDetail(env, appealId);
      if (!detail) {
        return json({ success: false, error: 'NOT_FOUND', message: '申诉单不存在' }, 404);
      }
      return json({ success: true, ...detail });
    }

    const items = await listAppeals(env, url.searchParams);
    return json({ success: true, items });
  } catch (error: any) {
    const message = String(error?.message || '退款申诉审核台加载失败');
    const status =
      message === 'UNAUTHORIZED'
        ? 401
        : message === 'FORBIDDEN'
          ? 403
          : 500;
    return json({ success: false, error: message, message }, status);
  }
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  const { env, request } = context;

  try {
    const { adminUserId } = await verifyAdminRequest(request, env);

    if (!(await getTableExists(env, 'RefundAppeals'))) {
      return json({ success: false, error: 'D1_SCHEMA_MISSING:RefundAppeals', message: '数据库缺少 RefundAppeals 表' }, 500);
    }

    return await handleAppealAction(env, request, adminUserId);
  } catch (error: any) {
    const message = String(error?.message || '退款申诉处理失败');
    const status =
      message === 'UNAUTHORIZED'
        ? 401
        : message === 'FORBIDDEN'
          ? 403
          : 500;
    return json({ success: false, error: message, message }, status);
  }
}
