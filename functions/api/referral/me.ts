import { countPaidOrders, getReferralRewardRules, getUsersColumns, tableExists } from './_shared';

interface Env {
  DB: any;
}

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
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

    const userColumns = await getUsersColumns(env);
    const selectColumns = ['user_id'];
    if (userColumns.has('invite_code')) selectColumns.push('invite_code');
    if (userColumns.has('invited_by')) selectColumns.push('invited_by');

    const user = await env.DB
      .prepare(`SELECT ${selectColumns.join(', ')} FROM Users WHERE user_id = ?1`)
      .bind(userId)
      .first();

    if (!user) {
      return json({ success: false, error: 'USER_NOT_FOUND', message: '用户不存在' }, 404);
    }

    const hasBindingsTable = await tableExists(env, 'ReferralBindings');
    const hasGrantsTable = await tableExists(env, 'ReferralRewardGrants');

    let registeredCount = 0;
    let firstPaidCount = 0;
    let totalReferrerTokens = 0;
    let totalBuyerTokens = 0;
    let recentRewards: Array<Record<string, unknown>> = [];

    if (hasBindingsTable) {
      const registeredRow = (await env.DB
        .prepare('SELECT COUNT(1) AS total FROM ReferralBindings WHERE referrer_user_id = ?1')
        .bind(userId)
        .first()) as { total?: number | null } | null;
      registeredCount = Number(registeredRow?.total || 0);
    }

    if (hasGrantsTable) {
      const referrerStats = (await env.DB
        .prepare(
          `SELECT COUNT(1) AS paid_count, COALESCE(SUM(referrer_bonus_tokens), 0) AS token_sum
           FROM ReferralRewardGrants
           WHERE referrer_user_id = ?1 AND status = 'RELEASED'`
        )
        .bind(userId)
        .first()) as { paid_count?: number | null; token_sum?: number | null } | null;
      firstPaidCount = Number(referrerStats?.paid_count || 0);
      totalReferrerTokens = Number(referrerStats?.token_sum || 0);

      const buyerStats = (await env.DB
        .prepare(
          `SELECT COALESCE(SUM(buyer_bonus_tokens), 0) AS token_sum
           FROM ReferralRewardGrants
           WHERE referred_user_id = ?1 AND status = 'RELEASED'`
        )
        .bind(userId)
        .first()) as { token_sum?: number | null } | null;
      totalBuyerTokens = Number(buyerStats?.token_sum || 0);

      const rewardsResp = await env.DB
        .prepare(
          `SELECT paid_order_id, package_type, buyer_bonus_tokens, referrer_bonus_tokens, status, granted_at,
                  CASE WHEN referrer_user_id = ?1 THEN 'referrer' ELSE 'buyer' END AS role
           FROM ReferralRewardGrants
           WHERE referrer_user_id = ?1 OR referred_user_id = ?1
           ORDER BY COALESCE(granted_at, created_at) DESC
           LIMIT 8`
        )
        .bind(userId)
        .all();
      recentRewards = Array.isArray(rewardsResp?.results) ? rewardsResp.results : [];
    }

    const invitedBy = userColumns.has('invited_by') ? String((user as any).invited_by || '').trim() || null : null;
    const paidOrders = await countPaidOrders(env, userId);
    const firstPayRewardClaimed = hasGrantsTable
      ? Boolean(
          await env.DB
            .prepare('SELECT id FROM ReferralRewardGrants WHERE referred_user_id = ?1 AND status = ?2 LIMIT 1')
            .bind(userId, 'RELEASED')
            .first(),
        )
      : false;

    return json({
      success: true,
      invite_code: userColumns.has('invite_code') ? String((user as any).invite_code || '').trim() || null : null,
      binding: {
        invited_by: invitedBy,
        first_pay_reward_eligible: Boolean(invitedBy) && paidOrders === 0 && !firstPayRewardClaimed,
        first_pay_reward_claimed: firstPayRewardClaimed,
      },
      stats: {
        registered_count: registeredCount,
        first_paid_count: firstPaidCount,
        total_referrer_tokens: totalReferrerTokens,
        total_buyer_tokens: totalBuyerTokens,
      },
      rules: await getReferralRewardRules(env),
      recent_rewards: recentRewards,
    });
  } catch (error: any) {
    console.error('[/api/referral/me] unexpected error:', error);
    return json({ success: false, error: 'SERVER_ERROR', message: error?.message || '服务端异常' }, 500);
  }
}
