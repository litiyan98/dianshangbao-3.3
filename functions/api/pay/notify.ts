import { verifyAlipayNotify } from '../../../utils/alipay';

interface Env {
  DB: any;
  ALIPAY_PUBLIC_KEY: string;
}

interface FulfillmentGrant {
  imageQuota: number;
  vipDays: number;
  tier: 'tier_9_9' | 'tier_39_9' | 'tier_149';
}

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function normalizePackageType(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function almostEqualAmount(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance;
}

function resolveGrant(packageType: string, amount: number): FulfillmentGrant | null {
  const normalized = normalizePackageType(packageType);
  if (normalized.includes('9.9') || normalized.includes('15_quota') || normalized.includes('starter')) {
    return { imageQuota: 15, vipDays: 7, tier: 'tier_9_9' };
  }
  if (normalized.includes('39.9') || normalized.includes('80_quota') || normalized.includes('standard')) {
    return { imageQuota: 80, vipDays: 30, tier: 'tier_39_9' };
  }
  if (normalized.includes('149') || normalized.includes('400_quota') || normalized.includes('enterprise') || normalized.includes('annual')) {
    return { imageQuota: 400, vipDays: 90, tier: 'tier_149' };
  }

  if (almostEqualAmount(amount, 9.9) || (amount > 9.9 && amount < 39.9)) {
    return { imageQuota: 15, vipDays: 7, tier: 'tier_9_9' };
  }
  if (almostEqualAmount(amount, 39.9) || (amount >= 39.9 && amount < 149)) {
    return { imageQuota: 80, vipDays: 30, tier: 'tier_39_9' };
  }
  if (almostEqualAmount(amount, 149) || amount >= 149) {
    return { imageQuota: 400, vipDays: 90, tier: 'tier_149' };
  }
  return null;
}

function buildNotifySignContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== 'sign' && key !== 'sign_type')
    .filter((key) => params[key] !== undefined && params[key] !== null && String(params[key]) !== '')
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&');
}

async function deliverUserAssets(env: Env, userId: string, grant: FulfillmentGrant): Promise<void> {
  const vipDaysExpr = `+${grant.vipDays} days`;
  await env.DB
    .prepare(
      `INSERT INTO Users (user_id, credits, image_quota, vip_expire_date)
       VALUES (?1, 0, ?2, datetime('now', ?3))
       ON CONFLICT(user_id) DO UPDATE SET
         image_quota = COALESCE(Users.image_quota, 0) + ?2,
         vip_expire_date = CASE
           WHEN Users.vip_expire_date IS NULL OR Users.vip_expire_date = '' THEN datetime('now', ?3)
           WHEN datetime(Users.vip_expire_date) < datetime('now') THEN datetime('now', ?3)
           ELSE datetime(Users.vip_expire_date, ?3)
         END`
    )
    .bind(userId, grant.imageQuota, vipDaysExpr)
    .run();
}

async function markOrderAsCompleted(env: Env, outTradeNo: string): Promise<void> {
  try {
    await env.DB
      .prepare("UPDATE Orders SET status = 'COMPLETED' WHERE out_trade_no = ?1 AND status NOT IN ('SUCCESS', 'PAID', 'COMPLETED')")
      .bind(outTradeNo)
      .run();
    return;
  } catch (error) {
    console.warn('[/api/pay/notify] status COMPLETED not supported, fallback to SUCCESS', error);
  }

  await env.DB
    .prepare("UPDATE Orders SET status = 'SUCCESS' WHERE out_trade_no = ?1 AND status NOT IN ('SUCCESS', 'PAID', 'COMPLETED')")
    .bind(outTradeNo)
    .run();
}

async function parseNotifyParams(request: Request): Promise<Record<string, string>> {
  const formData = await request.formData();
  const body = Object.fromEntries(formData.entries());
  console.log('=== 1. Notify Payload ===', body);

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    params[key] = String(value ?? '');
  }
  return params;
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  const { env, request } = context;
  try {
    const params = await parseNotifyParams(request);

    const signContent = buildNotifySignContent(params);
    console.log('=== 2. Sign Content String ===', signContent);

    let isSignValid = false;
    try {
      isSignValid = await verifyAlipayNotify(params, env.ALIPAY_PUBLIC_KEY || '');
    } catch (verifyError) {
      console.error('回调验签异常', verifyError);
      isSignValid = false;
    }
    console.log('=== 3. Verify Result ===', isSignValid);

    if (!isSignValid) {
      console.error('回调验签失败', params);
      return text('fail');
    }

    const outTradeNo = String(params.out_trade_no || '').trim();
    const tradeStatus = String(params.trade_status || '').trim();
    console.log('=== 4. Trade Status ===', tradeStatus);

    if (!outTradeNo) {
      return text('fail');
    }

    if (tradeStatus !== 'TRADE_SUCCESS') {
      return text('success');
    }

    const order = (await env.DB
      .prepare('SELECT out_trade_no, user_id, amount, package_type, status FROM Orders WHERE out_trade_no = ?1')
      .bind(outTradeNo)
      .first()) as
      | {
          out_trade_no: string;
          user_id: string;
          amount: number;
          package_type?: string | null;
          status: 'PENDING' | 'SUCCESS' | 'PAID' | 'COMPLETED' | 'CLOSED';
        }
      | null;

    if (!order) {
      console.warn('[/api/pay/notify] order not found', outTradeNo);
      return text('success');
    }

    if (order.status === 'SUCCESS' || order.status === 'PAID' || order.status === 'COMPLETED') {
      return text('success');
    }

    const callbackAmount = Number(params.total_amount || NaN);
    const orderAmount = Number(order.amount || 0);
    if (Number.isFinite(callbackAmount) && Number.isFinite(orderAmount) && orderAmount > 0) {
      if (!almostEqualAmount(callbackAmount, orderAmount)) {
        console.warn('[/api/pay/notify] amount mismatch', { outTradeNo, callbackAmount, orderAmount });
        return text('fail');
      }
    }

    const amountForGrant = Number.isFinite(callbackAmount) ? callbackAmount : orderAmount;
    const grant = resolveGrant(order.package_type || '', amountForGrant);
    if (!grant) {
      console.warn('[/api/pay/notify] unsupported package for fulfillment', {
        outTradeNo,
        packageType: order.package_type || null,
        amountForGrant,
      });
      return text('fail');
    }

    await deliverUserAssets(env, order.user_id, grant);
    await markOrderAsCompleted(env, outTradeNo);

    return text('success');
  } catch (error) {
    console.error('[/api/pay/notify] error:', error);
    return text('fail');
  }
}
