import { buildAlipaySignContent, signAlipayRequest } from '../../../utils/alipay';

interface Env {
  DB: any;
  ALIPAY_APP_ID: string;
  ALIPAY_PRIVATE_KEY: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function beijingTimestamp(): string {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function makeOutTradeNo(): string {
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `DSB_${Date.now()}_${rand}`;
}

function normalizeAmount(input: unknown): number | null {
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  const { env, request } = context;

  try {
    const body = await request.json().catch(() => null);
    const userId = String(body?.userId || '').trim();
    const packageType = String(body?.packageType || body?.package_type || 'default');
    const subject = String(body?.subject || '电商宝 Pro 算力充值');
    const amount = normalizeAmount(body?.amount);

    if (!userId) {
      return json({ success: false, error: 'MISSING_USER_ID', message: '缺少 userId' }, 401);
    }
    if (amount === null) {
      return json({ success: false, error: 'INVALID_AMOUNT', message: '金额非法' }, 400);
    }
    if (!env.ALIPAY_APP_ID || !env.ALIPAY_PRIVATE_KEY) {
      return json({ success: false, error: 'ALIPAY_ENV_MISSING', message: '支付宝密钥未配置' }, 500);
    }

    const outTradeNo = makeOutTradeNo();
    const id = crypto.randomUUID();
    await env.DB
      .prepare(
        "INSERT INTO Orders (id, user_id, out_trade_no, amount, package_type, status) VALUES (?1, ?2, ?3, ?4, ?5, 'PENDING')"
      )
      .bind(id, userId, outTradeNo, amount, packageType)
      .run();

    const notifyUrl = `${new URL(request.url).origin}/api/pay/notify`;
    const params: Record<string, string> = {
      app_id: env.ALIPAY_APP_ID,
      method: 'alipay.trade.precreate',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: beijingTimestamp(),
      version: '1.0',
      notify_url: notifyUrl,
      biz_content: JSON.stringify({
        out_trade_no: outTradeNo,
        total_amount: amount.toFixed(2),
        subject,
      }),
    };

    const signContent = buildAlipaySignContent(params);
    console.log('=== 本地待签名原串 ===', signContent);
    params.sign = await signAlipayRequest(signContent, env.ALIPAY_PRIVATE_KEY);

    const payload = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => payload.append(key, value));

    const alipayResp = await fetch(ALIPAY_GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: payload.toString(),
    });

    const rawText = await alipayResp.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error('Alipay returned non-JSON:', rawText);
      await env.DB
        .prepare("UPDATE Orders SET status = 'CLOSED' WHERE out_trade_no = ?1")
        .bind(outTradeNo)
        .run();
      return json(
        {
          success: false,
          error: 'ALIPAY_HTML_ERROR',
          message: '支付宝返回了非JSON格式错误',
          local_sign_content: signContent,
        },
        500
      );
    }

    const result = data?.alipay_trade_precreate_response;
    if (!result) {
      await env.DB
        .prepare("UPDATE Orders SET status = 'CLOSED' WHERE out_trade_no = ?1")
        .bind(outTradeNo)
        .run();
      return json(
        {
          success: false,
          error: 'ALIPAY_GATEWAY_INVALID_RESPONSE',
          message: '支付宝响应结构异常',
          alipay_raw: data,
          local_sign_content: signContent,
        },
        500
      );
    }

    if (result.code !== '10000') {
      console.error('Alipay Business Error:', result);
      await env.DB
        .prepare("UPDATE Orders SET status = 'CLOSED' WHERE out_trade_no = ?1")
        .bind(outTradeNo)
        .run();
      return json(
        {
          success: false,
          error: 'ALIPAY_GATEWAY_REJECTED',
          message: result.sub_msg || result.msg || '支付宝网关拒绝了请求',
          alipay_raw: result,
          local_sign_content: signContent,
        },
        400
      );
    }

    if (!result.qr_code) {
      await env.DB
        .prepare("UPDATE Orders SET status = 'CLOSED' WHERE out_trade_no = ?1")
        .bind(outTradeNo)
        .run();
      return json(
        {
          success: false,
          error: 'ALIPAY_QRCODE_MISSING',
          message: '支付宝未返回二维码链接',
          alipay_raw: result,
          local_sign_content: signContent,
        },
        500
      );
    }

    return json({
      success: true,
      qr_code: result.qr_code,
      out_trade_no: outTradeNo,
      amount: amount.toFixed(2),
    });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    const message = err?.message || '服务器异常';
    const stack = err?.stack || String(error);
    console.error('Pay Create Error:', error);
    return json(
      {
        success: false,
        error: 'CREATE_PAY_FAILED',
        message,
        stack, // 仅测试阶段暴露，便于快速排查
      },
      500
    );
  }
}
