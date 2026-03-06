interface Env {
  DB: any;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function normalizeOrderStatus(rawStatus: string): 'PENDING' | 'PAID' | 'COMPLETED' {
  const normalized = String(rawStatus || '').toUpperCase();
  if (normalized === 'PAID') return 'PAID';
  if (normalized === 'COMPLETED' || normalized === 'SUCCESS' || normalized === 'TRADE_SUCCESS') return 'COMPLETED';
  return 'PENDING';
}

export async function onRequestGet(context: { env: Env; request: Request }): Promise<Response> {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const outTradeNo =
      url.searchParams.get('out_trade_no')?.trim() ||
      url.searchParams.get('outTradeNo')?.trim() ||
      '';

    if (!outTradeNo) {
      return json({ success: false, error: 'MISSING_OUT_TRADE_NO', message: '缺少 out_trade_no' }, 400);
    }

    const order = (await env.DB
      .prepare('SELECT out_trade_no, user_id, amount, package_type, status, created_at FROM Orders WHERE out_trade_no = ?1')
      .bind(outTradeNo)
      .first()) as
      | {
          out_trade_no: string;
          user_id: string;
          amount: number;
          package_type?: string | null;
          status: 'PENDING' | 'SUCCESS' | 'PAID' | 'COMPLETED' | 'CLOSED';
          created_at?: string;
        }
      | null;

    if (!order) {
      return json({ success: false, error: 'ORDER_NOT_FOUND', message: '订单不存在' }, 404);
    }

    const normalizedStatus = normalizeOrderStatus(order.status);
    return json({
      success: true,
      out_trade_no: order.out_trade_no,
      user_id: order.user_id,
      amount: Number(order.amount || 0),
      package_type: order.package_type || null,
      status: normalizedStatus,
      raw_status: order.status,
      created_at: order.created_at || null,
      trade_status: normalizedStatus,
    });
  } catch (error: any) {
    console.error('[/api/pay/status] error:', error);
    return json({ success: false, error: 'SERVER_ERROR', message: error?.message || '服务器异常' }, 500);
  }
}
