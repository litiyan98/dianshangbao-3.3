import { createRemoteJWKSet, jwtVerify } from 'jose';
import { extractPhoneFromClaims, resolveAdminAccess } from '../_adminQuota';

interface Env {
  DB: any;
  AUTHING_DOMAIN?: string;
}

type ReviewActionType =
  | 'REFUND_TOKEN'
  | 'COMPENSATE_TOKEN'
  | 'MARK_MODEL_ISSUE'
  | 'MARK_REFERENCE_DRIFT'
  | 'MARK_USER_INPUT_ISSUE'
  | 'RESOLVE_NO_ACTION';

type IssueTag =
  | 'MODEL_DRIFT'
  | 'REFERENCE_DRIFT'
  | 'USER_INPUT_ISSUE'
  | 'POST_PROCESS_ISSUE'
  | 'MISCHARGE'
  | 'OTHER';

type JobSummaryRow = {
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
  completed_outputs?: number | null;
  failed_outputs?: number | null;
  charged_tokens?: number | null;
  refunded_tokens?: number | null;
  latest_action_type?: string | null;
  latest_issue_tag?: string | null;
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

type ReviewActionRow = {
  id: string;
  job_id: string;
  output_id?: string | null;
  target_user_id: string;
  admin_user_id: string;
  action_type: string;
  issue_tag?: string | null;
  token_delta?: number | null;
  note?: string | null;
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

function createReviewActionId() {
  return `grev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getTableExists(env: Env, tableName: string): Promise<boolean> {
  const row = (await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
    .bind(tableName)
    .first()) as { name?: string | null } | null;
  return row?.name === tableName;
}

async function verifyAdminRequest(request: Request, env: Env): Promise<{ adminUserId: string; phone: string | null }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

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

  if (!adminUserId) {
    throw new Error('UNAUTHORIZED');
  }
  const access = await resolveAdminAccess(env, { userId: adminUserId, phone });
  if (!access.isAdmin) {
    throw new Error('FORBIDDEN');
  }

  return { adminUserId, phone: access.phone };
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

async function insertChargeLedgerRefund(
  env: Env,
  input: { jobId: string; userId: string; outputId?: string | null; traceId?: string | null; slotIndex?: number | null; tokenDelta: number; reason: string },
) {
  if (!(await getTableExists(env, 'GenerationChargeLedger'))) return;

  await env.DB
    .prepare(`
      INSERT INTO GenerationChargeLedger (
        id, job_id, user_id, output_id, trace_id, slot_index, action_type, token_delta, reason
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'REFUND', ?7, ?8)
    `)
    .bind(
      `gchg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      input.jobId,
      input.userId,
      input.outputId || null,
      input.traceId || null,
      typeof input.slotIndex === 'number' ? input.slotIndex : 0,
      input.tokenDelta,
      input.reason,
    )
    .run();
}

async function insertReviewAction(
  env: Env,
  input: {
    jobId: string;
    outputId?: string | null;
    targetUserId: string;
    adminUserId: string;
    actionType: ReviewActionType;
    issueTag?: IssueTag | null;
    tokenDelta?: number;
    note?: string | null;
  },
) {
  if (!(await getTableExists(env, 'GenerationReviewActions'))) return;

  await env.DB
    .prepare(`
      INSERT INTO GenerationReviewActions (
        id, job_id, output_id, target_user_id, admin_user_id, action_type, issue_tag, token_delta, note
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `)
    .bind(
      createReviewActionId(),
      input.jobId,
      input.outputId || null,
      input.targetUserId,
      input.adminUserId,
      input.actionType,
      input.issueTag || null,
      Number.isFinite(Number(input.tokenDelta)) ? Number(input.tokenDelta) : 0,
      input.note || null,
    )
    .run();
}

async function listJobs(env: Env, searchParams: URLSearchParams) {
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || 20)));
  const status = searchParams.get('status')?.trim() || '';
  const userId = searchParams.get('userId')?.trim() || '';

  const where: string[] = [];
  const values: Array<string | number> = [];

  if (status) {
    where.push(`j.status = ?${values.length + 1}`);
    values.push(status);
  }

  if (userId) {
    where.push(`j.user_id = ?${values.length + 1}`);
    values.push(userId);
  }

  values.push(limit);

  const rows = (await env.DB
    .prepare(`
      SELECT
        j.id,
        j.user_id,
        j.trace_id,
        j.mode,
        j.status,
        j.stage,
        j.progress,
        j.message,
        j.error_message,
        j.created_at,
        j.updated_at,
        COALESCE((SELECT COUNT(1) FROM GenerationOutputs o WHERE o.job_id = j.id AND o.status = 'COMPLETED'), 0) AS completed_outputs,
        COALESCE((SELECT COUNT(1) FROM GenerationOutputs o WHERE o.job_id = j.id AND o.status = 'FAILED'), 0) AS failed_outputs,
        COALESCE((SELECT SUM(o.charged_tokens) FROM GenerationOutputs o WHERE o.job_id = j.id), 0) AS charged_tokens,
        COALESCE((SELECT SUM(c.token_delta) FROM GenerationChargeLedger c WHERE c.job_id = j.id AND c.action_type = 'REFUND'), 0) AS refunded_tokens,
        (SELECT action_type FROM GenerationReviewActions ra WHERE ra.job_id = j.id ORDER BY ra.created_at DESC LIMIT 1) AS latest_action_type,
        (SELECT issue_tag FROM GenerationReviewActions ra WHERE ra.job_id = j.id ORDER BY ra.created_at DESC LIMIT 1) AS latest_issue_tag
      FROM GenerationJobs j
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY j.created_at DESC
      LIMIT ?${values.length}
    `)
    .bind(...values)
    .all()).results as JobSummaryRow[];

  return rows.map((row) => ({
    ...row,
    progress: Number(row.progress ?? 0),
    completed_outputs: Number(row.completed_outputs ?? 0),
    failed_outputs: Number(row.failed_outputs ?? 0),
    charged_tokens: Number(row.charged_tokens ?? 0),
    refunded_tokens: Number(row.refunded_tokens ?? 0),
    risk_level:
      Number(row.failed_outputs ?? 0) > 0 || row.latest_issue_tag
        ? 'review'
        : Number(row.completed_outputs ?? 0) === 0
          ? 'high'
          : 'normal',
  }));
}

async function getJobDetail(env: Env, jobId: string) {
  const job = (await env.DB
    .prepare(`
      SELECT id, user_id, trace_id, mode, status, stage, progress, message, error_message, created_at, updated_at
      FROM GenerationJobs
      WHERE id = ?1
      LIMIT 1
    `)
    .bind(jobId)
    .first()) as JobSummaryRow | null;

  if (!job) {
    return null;
  }

  const outputs = (await env.DB
    .prepare(`
      SELECT id, job_id, user_id, trace_id, slot_index, mode, model_name, status, image_url, prompt_snapshot,
             error_message, charged_tokens, created_at, updated_at
      FROM GenerationOutputs
      WHERE job_id = ?1
      ORDER BY slot_index ASC, created_at ASC
    `)
    .bind(jobId)
    .all()).results as OutputRow[];

  const ledger = (await env.DB
    .prepare(`
      SELECT id, job_id, user_id, output_id, trace_id, slot_index, action_type, token_delta, reason, created_at
      FROM GenerationChargeLedger
      WHERE job_id = ?1
      ORDER BY created_at DESC
    `)
    .bind(jobId)
    .all()).results as LedgerRow[];

  let actions: ReviewActionRow[] = [];
  if (await getTableExists(env, 'GenerationReviewActions')) {
    actions = (await env.DB
      .prepare(`
        SELECT id, job_id, output_id, target_user_id, admin_user_id, action_type, issue_tag, token_delta, note, created_at
        FROM GenerationReviewActions
        WHERE job_id = ?1
        ORDER BY created_at DESC
      `)
      .bind(jobId)
      .all()).results as ReviewActionRow[];
  }

  return {
    job: {
      ...job,
      progress: Number(job.progress ?? 0),
    },
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
    actions: actions.map((item) => ({
      ...item,
      token_delta: Number(item.token_delta ?? 0),
    })),
  };
}

async function handleReviewAction(env: Env, request: Request, adminUserId: string) {
  const body = (await request.json()) as {
    actionType?: ReviewActionType;
    issueTag?: IssueTag | null;
    jobId?: string;
    outputId?: string | null;
    userId?: string;
    tokenAmount?: number;
    note?: string | null;
  };

  const actionType = body.actionType;
  const jobId = String(body.jobId || '').trim();
  const targetUserId = String(body.userId || '').trim();
  const outputId = body.outputId ? String(body.outputId).trim() : null;
  const tokenAmount = Math.max(0, Math.round(Number(body.tokenAmount || 0)));
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!actionType || !jobId || !targetUserId) {
    return json({ success: false, error: 'INVALID_REQUEST', message: '缺少 actionType、jobId 或 userId' }, 400);
  }

  let outputRow: OutputRow | null = null;
  if (outputId) {
    outputRow = (await env.DB
      .prepare(`
        SELECT id, job_id, user_id, trace_id, slot_index, mode, model_name, status, image_url, prompt_snapshot,
               error_message, charged_tokens, created_at, updated_at
        FROM GenerationOutputs
        WHERE id = ?1 AND job_id = ?2
        LIMIT 1
      `)
      .bind(outputId, jobId)
      .first()) as OutputRow | null;
  }

  if ((actionType === 'REFUND_TOKEN' || actionType === 'COMPENSATE_TOKEN') && tokenAmount <= 0) {
    return json({ success: false, error: 'INVALID_TOKEN_AMOUNT', message: 'tokenAmount 必须大于 0' }, 400);
  }

  if (actionType === 'REFUND_TOKEN' || actionType === 'COMPENSATE_TOKEN') {
    await creditUserImageTokens(env, targetUserId, tokenAmount);
    await insertChargeLedgerRefund(env, {
      jobId,
      userId: targetUserId,
      outputId: outputRow?.id || outputId || null,
      traceId: outputRow?.trace_id || null,
      slotIndex: typeof outputRow?.slot_index === 'number' ? outputRow.slot_index : 0,
      tokenDelta: tokenAmount,
      reason: note || (actionType === 'REFUND_TOKEN' ? '管理员退回生成额度' : '管理员补偿生成额度'),
    });
  }

  await insertReviewAction(env, {
    jobId,
    outputId,
    targetUserId,
    adminUserId,
    actionType,
    issueTag: body.issueTag || null,
    tokenDelta: tokenAmount,
    note: note || null,
  });

  return json({
    success: true,
    actionType,
    jobId,
    outputId,
    tokenAmount,
    message:
      actionType === 'REFUND_TOKEN'
        ? `已退回 ${tokenAmount} Token`
        : actionType === 'COMPENSATE_TOKEN'
          ? `已补偿 ${tokenAmount} Token`
          : '审核动作已记录',
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context: { env: Env; request: Request }) {
  const { env, request } = context;

  try {
    await verifyAdminRequest(request, env);
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId')?.trim() || '';

    if (!(await getTableExists(env, 'GenerationJobs'))) {
      return json({ success: false, error: 'D1_SCHEMA_MISSING:GenerationJobs', message: '数据库缺少 GenerationJobs 表' }, 500);
    }
    if (!(await getTableExists(env, 'GenerationOutputs'))) {
      return json({ success: false, error: 'D1_SCHEMA_MISSING:GenerationOutputs', message: '数据库缺少 GenerationOutputs 表' }, 500);
    }
    if (!(await getTableExists(env, 'GenerationChargeLedger'))) {
      return json({ success: false, error: 'D1_SCHEMA_MISSING:GenerationChargeLedger', message: '数据库缺少 GenerationChargeLedger 表' }, 500);
    }

    if (jobId) {
      const detail = await getJobDetail(env, jobId);
      if (!detail) {
        return json({ success: false, error: 'NOT_FOUND', message: '任务不存在' }, 404);
      }
      return json({ success: true, ...detail });
    }

    const jobs = await listJobs(env, url.searchParams);
    return json({ success: true, items: jobs });
  } catch (error: any) {
    const message = String(error?.message || '管理审查查询失败');
    const status =
      message === 'UNAUTHORIZED'
        ? 401
        : message === 'FORBIDDEN'
          ? 403
          : message === 'AUTHING_DOMAIN_NOT_CONFIGURED'
            ? 500
            : 500;
    return json({ success: false, error: message, message }, status);
  }
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  const { env, request } = context;

  try {
    const { adminUserId } = await verifyAdminRequest(request, env);

    if (!(await getTableExists(env, 'GenerationJobs'))) {
      return json({ success: false, error: 'D1_SCHEMA_MISSING:GenerationJobs', message: '数据库缺少 GenerationJobs 表' }, 500);
    }

    const response = await handleReviewAction(env, request, adminUserId);
    return response;
  } catch (error: any) {
    const message = String(error?.message || '管理审核动作失败');
    const status =
      message === 'UNAUTHORIZED'
        ? 401
        : message === 'FORBIDDEN'
          ? 403
          : message === 'AUTHING_DOMAIN_NOT_CONFIGURED'
            ? 500
            : 500;
    return json({ success: false, error: message, message }, status);
  }
}
