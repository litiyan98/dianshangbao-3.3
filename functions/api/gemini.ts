import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  API_KEY: string;
  AUTHING_DOMAIN: string;
  DB: any;
}

interface UserAssetRow {
  user_id: string;
  image_quota?: number | null;
  vip_expire_date?: string | null;
}

interface GeminiCallResult {
  ok: boolean;
  status: number;
  rawText: string;
  data: any;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isVipActive(vipExpireDate: string | null | undefined): boolean {
  const expireMs = parseDateMs(vipExpireDate);
  if (expireMs === null) return false;
  return expireMs > Date.now();
}

function normalizeImageCount(value: unknown): 1 | 3 {
  if (value === undefined || value === null || value === '') return 1;
  const numeric = Number(value);
  if (numeric === 1 || numeric === 3) return numeric as 1 | 3;
  throw new Error('INVALID_IMAGE_COUNT');
}

function extractFirstTextPart(payload: any): string {
  const parts = payload?.contents?.[0]?.parts;
  if (!Array.isArray(parts)) return '';
  const textPart = parts.find((part: any) => typeof part?.text === 'string');
  return typeof textPart?.text === 'string' ? textPart.text.trim() : '';
}

function replaceFirstTextPart(payload: any, newText: string): any {
  const cloned = JSON.parse(JSON.stringify(payload || {}));
  const parts = cloned?.contents?.[0]?.parts;
  if (!Array.isArray(parts)) {
    cloned.contents = [{ parts: [{ text: newText }] }];
    return cloned;
  }

  const textIndex = parts.findIndex((part: any) => typeof part?.text === 'string');
  if (textIndex >= 0) {
    parts[textIndex].text = newText;
  } else {
    parts.unshift({ text: newText });
  }
  return cloned;
}

function extractGeminiText(data: any): string {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text.trim();
      }
    }
  }
  return '';
}

function extractGeminiImages(data: any): string[] {
  const images: string[] = [];
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const b64 = part?.inlineData?.data;
      if (typeof b64 === 'string' && b64.length > 0) {
        images.push(`data:image/png;base64,${b64}`);
      }
    }
  }
  return images;
}

function toUpstreamError(result: GeminiCallResult): Response {
  if (result.data && typeof result.data === 'object') {
    return json(result.data, result.status);
  }
  return new Response(result.rawText || JSON.stringify({ error: 'UPSTREAM_ERROR' }), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function callGemini(env: Env, model: string, payload: any): Promise<GeminiCallResult> {
  const apiKey = env.API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // @ts-expect-error - duplex is not in standard RequestInit yet
    duplex: 'half',
  });

  const rawText = await response.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  return {
    ok: response.ok,
    status: response.status,
    rawText,
    data,
  };
}

async function expandPromptForSingleImage(env: Env, rawUserInput: string): Promise<string> {
  const expansionInstruction = [
    'You are a top-tier commercial photography director.',
    'Expand the following short user phrase into one highly professional English prompt for Midjourney/Stable Diffusion.',
    'Must include: subject details, 8k resolution, premium lighting (rim light, god rays), e-commerce-ready background, Unreal Engine rendering quality.',
    'Output only the final English prompt. No explanation.',
    `User input: ${rawUserInput}`,
  ].join('\n');

  const expansionPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: expansionInstruction }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 400,
    },
  };

  const modelChain = ['gemini-flash-latest', 'gemini-3-flash-preview'];
  let lastError = 'PROMPT_EXPANSION_FAILED';

  for (const model of modelChain) {
    const result = await callGemini(env, model, expansionPayload);
    if (!result.ok) {
      lastError = extractGeminiText(result.data) || result.rawText || `MODEL_${model}_FAILED`;
      continue;
    }

    const expanded = extractGeminiText(result.data);
    if (expanded) return expanded;
    lastError = `MODEL_${model}_EMPTY_RESPONSE`;
  }

  throw new Error(lastError || 'PROMPT_EXPANSION_FAILED');
}

function buildMatrixPrompts(basePrompt: string): string[] {
  return [
    `${basePrompt}, commercial product photography, studio lighting, high contrast, clean background, 8k resolution, highly detailed, eye-catching, --ar 1:1`,
    `${basePrompt}, lifestyle photography, placed in a real warm real-world environment, natural sunlight, cinematic lighting, depth of field, cozy atmosphere, --ar 1:1`,
    `${basePrompt}, minimalist high-end aesthetic, solid color geometric background, soft diffuse reflection, close-up material details, Apple product photography style, sleek, --ar 1:1`,
  ];
}

async function getUserAssets(env: Env, userId: string): Promise<UserAssetRow | null> {
  return (await env.DB
    .prepare('SELECT user_id, image_quota, vip_expire_date FROM Users WHERE user_id = ?1')
    .bind(userId)
    .first()) as UserAssetRow | null;
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  const { request, env } = context;
  const apiKey = env.API_KEY;
  const authingDomain = env.AUTHING_DOMAIN || 'YOUR_AUTHING_DOMAIN';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AUTH_ERROR', message: '服务端 API_KEY 未配置' }), { status: 500 });
  }

  // 1. Edge 边缘 JWT 鉴权逻辑
  try {
    if (!authingDomain || authingDomain.includes('YOUR_AUTHING_DOMAIN')) {
      console.warn('Authing domain not configured, skipping JWT verification.');
    } else {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: '身份认证失败，请先登录系统' }), { status: 401 });
      }
      const token = authHeader.split(' ')[1];

      const cleanDomain = authingDomain.replace(/^https?:\/\//, '');
      const JWKS = createRemoteJWKSet(new URL(`https://${cleanDomain}/oidc/.well-known/jwks.json`));
      await jwtVerify(token, JWKS);
    }
  } catch (error: any) {
    console.error('JWT 验证失败:', error.message);
    return new Response(JSON.stringify({ error: 'FORBIDDEN', message: `鉴权被拒: ${error.message}` }), { status: 403 });
  }

  // 2. 资产检票 + 生成调用
  try {
    const url = new URL(request.url);
    const model = url.searchParams.get('model');
    if (!model) return json({ error: 'INVALID_REQUEST', message: '缺少 model 参数' }, 400);

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return json({ error: 'INVALID_REQUEST', message: '请求体必须为 JSON' }, 400);
    }

    const billingUserId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
    const skipPromptExpansion = payload.skipPromptExpansion === true;
    const isImageRequest = model.includes('flash-image');

    if (!billingUserId) {
      return json({ error: 'UNAUTHORIZED', code: 401, message: '缺少 userId' }, 401);
    }

    const userAssets = await getUserAssets(env, billingUserId);
    if (!userAssets) {
      return json({ error: 'USER_NOT_FOUND', code: 404, message: '用户资产不存在，请重新登录后重试' }, 404);
    }

    const currentImageQuota = Number(userAssets.image_quota ?? 0);
    const currentVipExpireDate = userAssets.vip_expire_date ? String(userAssets.vip_expire_date) : null;

    // 文本生成：VIP 检票
    if (!isImageRequest) {
      if (!isVipActive(currentVipExpireDate)) {
        return json(
          {
            error: 'VIP_EXPIRED',
            code: 403,
            message: '您的 VIP 已过期，请充值后继续使用',
          },
          403,
        );
      }
    }

    const requestedCount = isImageRequest ? normalizeImageCount((payload as Record<string, any>).count) : 0;

    // 生图生成：额度检票（按请求 count 检票）
    if (isImageRequest) {
      if (currentImageQuota < requestedCount) {
        return json(
          {
            error: 'INSUFFICIENT_QUOTA',
            code: 403,
            message: '您的生图额度不足，请购买流量包后重试',
          },
          403,
        );
      }
    }

    // userId / count 仅用于后端鉴权，不转发给 Gemini
    const { userId: _skipUserId, count: _skipCount, skipPromptExpansion: _skipPromptExpansion, ...googlePayload } = payload as Record<string, any>;

    let modelData: any;
    const generatedImages: string[] = [];

    if (isImageRequest && requestedCount === 1) {
      const userSeedPrompt = extractFirstTextPart(googlePayload);
      if (!userSeedPrompt) {
        return json({ error: 'INVALID_REQUEST', message: '缺少有效的生图提示词' }, 400);
      }

      const shouldExpandPrompt = !skipPromptExpansion;
      const effectivePrompt = shouldExpandPrompt
        ? await expandPromptForSingleImage(env, userSeedPrompt)
        : userSeedPrompt;
      const singlePayload = replaceFirstTextPart(googlePayload, effectivePrompt);
      const result = await callGemini(env, model, singlePayload);
      if (!result.ok) return toUpstreamError(result);

      modelData = result.data;
      generatedImages.push(...extractGeminiImages(result.data));

      if (modelData && typeof modelData === 'object' && !Array.isArray(modelData) && shouldExpandPrompt) {
        modelData.expanded_prompt = effectivePrompt;
      }
    } else if (isImageRequest && requestedCount === 3) {
      const basePrompt = extractFirstTextPart(googlePayload);
      if (!basePrompt) {
        return json({ error: 'INVALID_REQUEST', message: '缺少有效的生图提示词' }, 400);
      }

      const matrixPrompts = buildMatrixPrompts(basePrompt);
      const tasks = matrixPrompts.map((promptText) => {
        const perImagePayload = replaceFirstTextPart(googlePayload, promptText);
        return callGemini(env, model, perImagePayload);
      });
      const results = await Promise.all(tasks);

      const failed = results.find((item) => !item.ok);
      if (failed) return toUpstreamError(failed);

      for (const result of results) {
        const oneImage = extractGeminiImages(result.data)[0];
        if (!oneImage) {
          return json({ error: 'IMAGE_EMPTY', message: '矩阵生图返回空图，请重试' }, 502);
        }
        generatedImages.push(oneImage);
      }

      modelData = {
        success: true,
        mode: 'MATRIX_3',
        images: generatedImages,
      };
    } else {
      const result = await callGemini(env, model, googlePayload);
      if (!result.ok) return toUpstreamError(result);
      modelData = result.data;
      generatedImages.push(...extractGeminiImages(result.data));
    }

    // 生图成功后再扣费（防止上游失败导致白扣）
    let latestImageQuota = currentImageQuota;
    let latestVipExpireDate = currentVipExpireDate;

    if (isImageRequest) {
      const deductResult = (await env.DB
        .prepare(
          'UPDATE Users SET image_quota = COALESCE(image_quota, 0) - ?2 WHERE user_id = ?1 AND COALESCE(image_quota, 0) >= ?2 RETURNING image_quota, vip_expire_date',
        )
        .bind(billingUserId, requestedCount)
        .first()) as { image_quota?: number | null; vip_expire_date?: string | null } | null;

      if (!deductResult) {
        return json(
          {
            error: 'INSUFFICIENT_QUOTA',
            code: 403,
            message: '您的生图额度不足，请购买流量包后重试',
          },
          403,
        );
      }

      latestImageQuota = Number(deductResult.image_quota ?? 0);
      latestVipExpireDate = deductResult.vip_expire_date ? String(deductResult.vip_expire_date) : null;
    } else {
      const refreshedAssets = await getUserAssets(env, billingUserId);
      if (refreshedAssets) {
        latestImageQuota = Number(refreshedAssets.image_quota ?? latestImageQuota);
        latestVipExpireDate = refreshedAssets.vip_expire_date ? String(refreshedAssets.vip_expire_date) : latestVipExpireDate;
      }
    }

    if (modelData && typeof modelData === 'object' && !Array.isArray(modelData)) {
      return json({
        ...modelData,
        images: generatedImages.length ? generatedImages : modelData.images,
        image_quota: latestImageQuota,
        vip_expire_date: latestVipExpireDate,
      });
    }

    return json({
      data: modelData,
      images: generatedImages,
      image_quota: latestImageQuota,
      vip_expire_date: latestVipExpireDate,
    });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : String(error);
    if (message.includes('INVALID_IMAGE_COUNT')) {
      return json({ error: 'INVALID_IMAGE_COUNT', message: 'count 参数仅支持 1 或 3' }, 400);
    }
    return new Response(JSON.stringify({ error: 'SERVER_ERROR', message }), { status: 500 });
  }
}
