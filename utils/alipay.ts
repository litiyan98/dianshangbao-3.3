import { createSign, createVerify } from 'node:crypto';

function normalizePem(pem: string): string {
  return (pem || '').replace(/\\n/g, '\n').trim();
}

function formatPublicKey(key: string): string {
  if (!key || typeof key !== 'string') {
    throw new Error('环境变量 ALIPAY_PUBLIC_KEY 未读取到或不是字符串');
  }

  const withRealNewline = normalizePem(key);
  let formattedKey = withRealNewline
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/[\r\n\s]/g, '');

  if (!formattedKey) {
    throw new Error('环境变量 ALIPAY_PUBLIC_KEY 为空字符串');
  }

  let result = '-----BEGIN PUBLIC KEY-----\n';
  while (formattedKey.length > 0) {
    result += `${formattedKey.substring(0, 64)}\n`;
    formattedKey = formattedKey.substring(64);
  }
  result += '-----END PUBLIC KEY-----';
  return result;
}

function formatPrivateKey(key: string): string {
  if (!key || typeof key !== 'string') {
    throw new Error('环境变量 ALIPAY_PRIVATE_KEY 未读取到或不是字符串');
  }

  // 1) 兼容环境变量中的字面量换行
  let formatted = key.replace(/\\n/g, '\n').trim();
  if (!formatted) {
    throw new Error('环境变量 ALIPAY_PRIVATE_KEY 为空字符串');
  }

  // 2) 缺少 PEM 头尾时自动补齐，并按 64 字符换行
  // 优先补齐为 PKCS#1 (RSA PRIVATE KEY)，兼容支付宝常见导出格式
  if (!formatted.includes('BEGIN PRIVATE KEY') && !formatted.includes('BEGIN RSA PRIVATE KEY')) {
    const cleanKey = formatted.replace(/\s+/g, '');
    const matchResult = cleanKey.match(/.{1,64}/g);
    if (!matchResult || matchResult.length === 0) {
      throw new Error('私钥内容提取失败，可能为空');
    }
    const chunkedKey = matchResult.join('\n');
    formatted = `-----BEGIN RSA PRIVATE KEY-----\n${chunkedKey}\n-----END RSA PRIVATE KEY-----`;
  }

  return formatted;
}

// 下单签名：仅剔除 sign，本环节必须保留 sign_type
function buildSignContentForCreate(params: Record<string, string | number | undefined | null>): string {
  return Object.keys(params)
    .filter((key) => key !== 'sign')
    .filter((key) => params[key] !== undefined && params[key] !== null && String(params[key]) !== '')
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&');
}

// 回调验签：剔除 sign 与 sign_type
function buildSignContentForNotify(params: Record<string, string | number | undefined | null>): string {
  return Object.keys(params)
    .filter((key) => key !== 'sign' && key !== 'sign_type')
    .filter((key) => params[key] !== undefined && params[key] !== null && String(params[key]) !== '')
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&');
}

export function buildAlipaySignContent(params: Record<string, string | number | undefined | null>): string {
  return buildSignContentForCreate(params);
}

export async function signAlipayRequest(paramsStr: string, privateKeyPem: string): Promise<string> {
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(paramsStr, 'utf8');
    signer.end();
    const safeKey = formatPrivateKey(privateKeyPem);
    return signer.sign(safeKey, 'base64');
  } catch (error: any) {
    throw new Error(`支付宝签名失败: ${error?.message || String(error)}`);
  }
}

export async function verifyAlipayNotify(params: Record<string, string>, publicKeyPem: string): Promise<boolean> {
  const signatureBase64 = params.sign;
  if (!signatureBase64) return false;

  const content = buildSignContentForNotify(params);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(content, 'utf8');
  verifier.end();
  return verifier.verify(formatPublicKey(publicKeyPem), signatureBase64, 'base64');
}
