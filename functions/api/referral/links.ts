import {
  createInviteLink,
  createUniqueInviteCode,
  ensureDefaultInviteLink,
  ensureInviteLinksTable,
  getUsersColumns,
  tableExists,
} from './_shared';

interface Env {
  DB: any;
}

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

async function ensureUserInviteCode(env: Env, userId: string): Promise<string | null> {
  const userColumns = await getUsersColumns(env);
  if (!userColumns.has('invite_code')) return null;

  const currentUser = (await env.DB
    .prepare('SELECT invite_code FROM Users WHERE user_id = ?1')
    .bind(userId)
    .first()) as { invite_code?: string | null } | null;

  if (!currentUser) {
    return null;
  }

  const currentCode = String(currentUser.invite_code || '').trim();
  if (currentCode) return currentCode;

  const nextCode = await createUniqueInviteCode(env, 6);
  await env.DB
    .prepare('UPDATE Users SET invite_code = ?1 WHERE user_id = ?2')
    .bind(nextCode, userId)
    .run();
  return nextCode;
}

async function buildInviteLinksPayload(env: Env, userId: string) {
  const inviteCode = await ensureUserInviteCode(env, userId);
  if (!inviteCode) {
    return {
      invite_code: null,
      links: [],
      legacy_sources: [],
    };
  }

  await ensureInviteLinksTable(env);
  await ensureDefaultInviteLink(env, { ownerUserId: userId, inviteCode });
  const hasBindingsTable = await tableExists(env, 'ReferralBindings');
  const hasGrantsTable = await tableExists(env, 'ReferralRewardGrants');

  const linksResp = hasBindingsTable
    ? hasGrantsTable
      ? await env.DB
          .prepare(
            `SELECT
               il.id,
               il.owner_user_id,
               il.invite_code,
               il.label,
               il.channel,
               il.is_default,
               il.status,
               il.created_at,
               il.updated_at,
               COUNT(rb.id) AS registered_count,
               SUM(CASE WHEN grants.referred_user_id IS NOT NULL THEN 1 ELSE 0 END) AS first_paid_count,
               COALESCE(SUM(COALESCE(grants.referrer_bonus_tokens, 0)), 0) AS total_referrer_tokens
             FROM InviteLinks il
             LEFT JOIN ReferralBindings rb
               ON rb.referrer_user_id = il.owner_user_id
              AND rb.bind_source = il.id
             LEFT JOIN (
               SELECT referred_user_id, referrer_user_id, SUM(referrer_bonus_tokens) AS referrer_bonus_tokens
               FROM ReferralRewardGrants
               WHERE status = 'RELEASED'
               GROUP BY referred_user_id, referrer_user_id
             ) grants
               ON grants.referred_user_id = rb.referred_user_id
              AND grants.referrer_user_id = rb.referrer_user_id
             WHERE il.owner_user_id = ?1
             GROUP BY il.id, il.owner_user_id, il.invite_code, il.label, il.channel, il.is_default, il.status, il.created_at, il.updated_at
             ORDER BY il.is_default DESC, il.created_at DESC`
          )
          .bind(userId)
          .all()
      : await env.DB
          .prepare(
            `SELECT
               il.id,
               il.owner_user_id,
               il.invite_code,
               il.label,
               il.channel,
               il.is_default,
               il.status,
               il.created_at,
               il.updated_at,
               COUNT(rb.id) AS registered_count,
               0 AS first_paid_count,
               0 AS total_referrer_tokens
             FROM InviteLinks il
             LEFT JOIN ReferralBindings rb
               ON rb.referrer_user_id = il.owner_user_id
              AND rb.bind_source = il.id
             WHERE il.owner_user_id = ?1
             GROUP BY il.id, il.owner_user_id, il.invite_code, il.label, il.channel, il.is_default, il.status, il.created_at, il.updated_at
             ORDER BY il.is_default DESC, il.created_at DESC`
          )
          .bind(userId)
          .all()
    : await env.DB
        .prepare(
          `SELECT
             id, owner_user_id, invite_code, label, channel, is_default, status, created_at, updated_at,
             0 AS registered_count, 0 AS first_paid_count, 0 AS total_referrer_tokens
           FROM InviteLinks
           WHERE owner_user_id = ?1
           ORDER BY is_default DESC, created_at DESC`
        )
        .bind(userId)
        .all();

  const links = (Array.isArray(linksResp?.results) ? linksResp.results : []).map((row: any) => ({
    id: String(row.id || ''),
    invite_code: String(row.invite_code || inviteCode),
    label: String(row.label || '未命名链接'),
    channel: String(row.channel || 'landing'),
    is_default: Number(row.is_default || 0) > 0,
    status: String(row.status || 'ACTIVE'),
    created_at: row.created_at ? String(row.created_at) : null,
    registered_count: Number(row.registered_count || 0),
    first_paid_count: Number(row.first_paid_count || 0),
    total_referrer_tokens: Number(row.total_referrer_tokens || 0),
  }));

  const legacyResp = hasBindingsTable
    ? hasGrantsTable
      ? await env.DB
          .prepare(
            `SELECT
               rb.bind_source,
               COUNT(1) AS registered_count,
               SUM(CASE WHEN grants.referred_user_id IS NOT NULL THEN 1 ELSE 0 END) AS first_paid_count,
               COALESCE(SUM(COALESCE(grants.referrer_bonus_tokens, 0)), 0) AS total_referrer_tokens
             FROM ReferralBindings rb
             LEFT JOIN InviteLinks il
               ON il.id = rb.bind_source
             LEFT JOIN (
               SELECT referred_user_id, referrer_user_id, SUM(referrer_bonus_tokens) AS referrer_bonus_tokens
               FROM ReferralRewardGrants
               WHERE status = 'RELEASED'
               GROUP BY referred_user_id, referrer_user_id
             ) grants
               ON grants.referred_user_id = rb.referred_user_id
              AND grants.referrer_user_id = rb.referrer_user_id
             WHERE rb.referrer_user_id = ?1
               AND COALESCE(rb.bind_source, '') != ''
               AND il.id IS NULL
             GROUP BY rb.bind_source
             ORDER BY registered_count DESC, rb.bind_source ASC`
          )
          .bind(userId)
          .all()
      : await env.DB
          .prepare(
            `SELECT
               rb.bind_source,
               COUNT(1) AS registered_count,
               0 AS first_paid_count,
               0 AS total_referrer_tokens
             FROM ReferralBindings rb
             LEFT JOIN InviteLinks il
               ON il.id = rb.bind_source
             WHERE rb.referrer_user_id = ?1
               AND COALESCE(rb.bind_source, '') != ''
               AND il.id IS NULL
             GROUP BY rb.bind_source
             ORDER BY registered_count DESC, rb.bind_source ASC`
          )
          .bind(userId)
          .all()
    : { results: [] };

  const legacySources = (Array.isArray(legacyResp?.results) ? legacyResp.results : []).map((row: any) => ({
    bind_source: String(row.bind_source || 'legacy'),
    registered_count: Number(row.registered_count || 0),
    first_paid_count: Number(row.first_paid_count || 0),
    total_referrer_tokens: Number(row.total_referrer_tokens || 0),
  }));

  return {
    invite_code: inviteCode,
    links,
    legacy_sources: legacySources,
  };
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId')?.trim();
    if (!userId) {
      return json({ success: false, error: 'MISSING_USER_ID', message: '缺少 userId 参数' }, 400);
    }

    const payload = await buildInviteLinksPayload(env, userId);
    return json({ success: true, ...payload });
  } catch (error: any) {
    console.error('[/api/referral/links][GET] unexpected error:', error);
    return json({ success: false, error: 'SERVER_ERROR', message: error?.message || '服务端异常' }, 500);
  }
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const userId = String(body?.userId || '').trim();
    const label = String(body?.label || '').trim();
    const channel = String(body?.channel || '').trim();

    if (!userId) {
      return json({ success: false, error: 'MISSING_USER_ID', message: '缺少 userId 参数' }, 400);
    }

    if (!label) {
      return json({ success: false, error: 'MISSING_LABEL', message: '请先填写链接名称' }, 400);
    }

    const user = await env.DB
      .prepare('SELECT user_id FROM Users WHERE user_id = ?1')
      .bind(userId)
      .first();
    if (!user) {
      return json({ success: false, error: 'USER_NOT_FOUND', message: '用户不存在' }, 404);
    }

    const inviteCode = await ensureUserInviteCode(env, userId);
    if (!inviteCode) {
      return json({ success: false, error: 'INVITE_CODE_UNAVAILABLE', message: '当前账号暂未开通邀请码' }, 400);
    }

    await ensureInviteLinksTable(env);
    await ensureDefaultInviteLink(env, { ownerUserId: userId, inviteCode });

    const linkCountRow = (await env.DB
      .prepare('SELECT COUNT(1) AS total FROM InviteLinks WHERE owner_user_id = ?1')
      .bind(userId)
      .first()) as { total?: number | null } | null;
    if (Number(linkCountRow?.total || 0) >= 40) {
      return json({ success: false, error: 'INVITE_LINK_LIMIT', message: '单个账号最多创建 40 条邀请链接' }, 400);
    }

    const createdLink = await createInviteLink(env, {
      ownerUserId: userId,
      inviteCode,
      label,
      channel,
    });

    const payload = await buildInviteLinksPayload(env, userId);
    return json({
      success: true,
      created_link: {
        id: createdLink.id,
        invite_code: createdLink.invite_code,
        label: createdLink.label,
        channel: createdLink.channel,
        is_default: Number(createdLink.is_default || 0) > 0,
        status: createdLink.status,
      },
      ...payload,
    });
  } catch (error: any) {
    console.error('[/api/referral/links][POST] unexpected error:', error);
    return json({ success: false, error: 'SERVER_ERROR', message: error?.message || '服务端异常' }, 500);
  }
}
