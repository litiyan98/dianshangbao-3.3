import { MarketAnalysis, ScenarioType, TextConfig, GenerationMode, CompositionLayout, AspectRatio, VisualDNA, FontStyle } from "../types";

let latestAssetSnapshot: { image_quota?: number | null; vip_expire_date?: string | null } | null = null;

function emitAuthExpired(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('auth-expired', { detail: { message } }));
}

function captureLatestAssetSnapshot(data: any) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const hasQuota = Object.prototype.hasOwnProperty.call(data, "image_quota");
  const hasVip = Object.prototype.hasOwnProperty.call(data, "vip_expire_date");
  if (!hasQuota && !hasVip) return;
  latestAssetSnapshot = {
    image_quota: hasQuota ? Number(data.image_quota ?? 0) : undefined,
    vip_expire_date: hasVip ? (data.vip_expire_date ? String(data.vip_expire_date) : null) : undefined,
  };
}

export function consumeLatestAssetSnapshot() {
  const snapshot = latestAssetSnapshot;
  latestAssetSnapshot = null;
  return snapshot;
}

// ==========================================
// 🛡️ 核心基建：带 Authing 鉴权与防断连的原生 Fetch
// ==========================================
function getAutoRetryDelayMs(statusCode: number, attempt: number, url: string) {
  const isImageRequest = url.includes('flash-image');
  const jitter = Math.floor(Math.random() * 600);

  if (statusCode === 429) {
    const base = isImageRequest ? 2600 : 1600;
    return base * Math.pow(2, attempt) + jitter;
  }

  if (statusCode === 503) {
    const base = isImageRequest ? 1800 : 1200;
    return base * Math.pow(2, attempt) + jitter;
  }

  return 1500 + jitter;
}

async function safeFetchJson(url: string, payload: any, timeoutMs: number = 30000) {
  const maxAutoRetries = 2;

  for (let attempt = 0; attempt <= maxAutoRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[safeFetchJson] Request timeout for ${url} after ${timeoutMs}ms`);
      controller.abort();
    }, timeoutMs);

    try {
      console.log(`[safeFetchJson] Fetching ${url}...`);
      const token = localStorage.getItem('authing_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && token !== "undefined" && token !== "null") headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errorDetail = await response.text();
        console.error("🚨 拦截到后端或大模型真实报错:", response.status, errorDetail);

        if (response.status === 401) {
          localStorage.removeItem('authing_token');
          emitAuthExpired('登录状态尚未就绪或已失效，请重新登录后再试。');
          throw new Error('AUTH_REQUIRED: 登录状态尚未就绪或已失效，请重新登录后再试。');
        }

        if (response.status === 403) {
          let parsedDetail: any = null;
          try {
            parsedDetail = JSON.parse(errorDetail);
          } catch {
            parsedDetail = null;
          }
          const backendError = parsedDetail?.error;
          const backendMessage = parsedDetail?.message || '';
          const isAuth403 = backendError === 'FORBIDDEN' || String(backendMessage).includes('鉴权');
          if (isAuth403) {
            localStorage.removeItem('authing_token');
            emitAuthExpired('登录状态尚未就绪或已失效，请重新登录后再试。');
            throw new Error('AUTH_REQUIRED: 登录状态尚未就绪或已失效，请重新登录后再试。');
          }
          // 业务型 403（如算力不足）直接透传给前端业务层处理
          throw new Error(parsedDetail?.error || backendMessage || "请求被拒绝(403)");
        }

        // 网络拥挤：按状态码做指数退避，避免三图同时重试形成雪崩
        if ((response.status === 429 || response.status === 503) && attempt < maxAutoRetries) {
          const retryDelayMs = getAutoRetryDelayMs(response.status, attempt, url);
          console.warn(`[safeFetchJson] ${response.status} detected, auto retry ${attempt + 1}/${maxAutoRetries} after ${retryDelayMs}ms`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        }

        if (response.status === 429 || response.status === 503) {
          throw new Error(`API 拒绝(${response.status}) 当前 AI 算力拥挤，请稍后再试`);
        }

        throw new Error(`API 拒绝(${response.status}) 详情: ${errorDetail.substring(0, 150)}...`);
      }

      const text = await response.text();
      clearTimeout(timeoutId);

      if (!text) {
        throw new Error("接收到空响应体");
      }

      try {
        const parsed = JSON.parse(text);
        captureLatestAssetSnapshot(parsed);
        return parsed;
      } catch (e) {
        console.error("[safeFetchJson] JSON Parse Error:", e, "Text:", text);
        throw new Error("云端算力节点波动，数据流传输中断，请点击重试。");
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error("[safeFetchJson] AbortError caught");
        throw new Error("请求超时，云端算力响应过慢，请稍后重试。");
      }
      console.error("[safeFetchJson] Catch block error:", error);
      throw new Error(error.message || "请求发送失败，请检查网络");
    }
  }
  throw new Error("当前 AI 算力拥挤，请稍后再试");
}

const TEXT_MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite"
];

const ANALYZE_MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-flash-latest"
];

const IMAGE_MODEL_CHAIN_ARTISTIC = [
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image"
];

const IMAGE_MODEL_CHAIN_PRECISION = [
  "gemini-2.5-flash-image"
];

const TEMP_MODEL_SKIP_MS = 30 * 60 * 1000;
const TEMP_MODEL_SKIP_MS_UNSTABLE_IMAGE = 10 * 60 * 1000;
const TEMP_MODEL_SKIP_MS_RATE_LIMIT_IMAGE = 90 * 1000;
const temporaryUnavailableModels = new Map<string, number>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function parseStatusCodeFromError(message: string): number | null {
  const match = message.match(/API 拒绝\((\d+)\)/);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isFinite(code) ? code : null;
}

function isAuthErrorMessage(message: string): boolean {
  return (
    message.includes("登录身份已失效") ||
    message.includes("身份认证失败") ||
    message.includes("鉴权被拒")
  );
}

function isModelNotFoundError(message: string, statusCode: number | null): boolean {
  if (statusCode === 404) return true;
  return /NOT_FOUND|is not found for API version|not supported for generateContent/i.test(message);
}

function isRetryableModelError(message: string, statusCode: number | null): boolean {
  if (statusCode && [429, 500, 502, 503, 504].includes(statusCode)) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("aborterror") ||
    lower.includes("unavailable") ||
    lower.includes("connection reset") ||
    lower.includes("failed to fetch") ||
    message.includes("超时") ||
    message.includes("稍后重试")
  );
}

function collectGeminiText(data: any): string {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

async function fetchGeminiWithFallback(
  payload: any,
  models: string[],
  timeoutMs: number,
  retriesPerModel: number,
  purpose: string,
  modelTimeoutOverrides?: Record<string, number>
): Promise<any> {
  const now = Date.now();
  const errors: string[] = [];

  for (const model of models) {
    const skipUntil = temporaryUnavailableModels.get(model) || 0;
    if (skipUntil > now) continue;

    for (let attempt = 0; attempt <= retriesPerModel; attempt++) {
      try {
        const currentTimeout = modelTimeoutOverrides?.[model] ?? timeoutMs;
        return await safeFetchJson(`/api/gemini?model=${model}&t=${Date.now()}`, payload, currentTimeout);
      } catch (error: any) {
        const message = String(error?.message || "");
        const statusCode = parseStatusCodeFromError(message);
        const retryable = isRetryableModelError(message, statusCode);
        const modelNotFound = isModelNotFoundError(message, statusCode);
        const authError = isAuthErrorMessage(message);

        if (authError) throw error;

        errors.push(`${model}#${attempt + 1}: ${message}`);

        if (modelNotFound) {
          temporaryUnavailableModels.set(model, Date.now() + TEMP_MODEL_SKIP_MS);
          break;
        }

        const isImageFlow = purpose.includes("生图");
        const isRateLimitedImageModel =
          isImageFlow &&
          model.includes("flash-image") &&
          statusCode === 429;
        const isUnstableImageModel =
          isImageFlow &&
          model.includes("flash-image") &&
          retryable &&
          (
            statusCode === 500 ||
            statusCode === 502 ||
            statusCode === 503 ||
            statusCode === 504 ||
            message.toLowerCase().includes("failed to fetch") ||
            message.includes("超时")
          );

        // 图像模型限流：短时间跳过被打爆的模型，避免三图同一时刻继续撞 429
        if (isRateLimitedImageModel) {
          temporaryUnavailableModels.set(model, Date.now() + TEMP_MODEL_SKIP_MS_RATE_LIMIT_IMAGE);
        }

        // 图像模型熔断：短时间内跳过异常模型，避免套图流程反复卡在同一故障模型
        if (isUnstableImageModel) {
          temporaryUnavailableModels.set(model, Date.now() + TEMP_MODEL_SKIP_MS_UNSTABLE_IMAGE);
        }

        if (retryable && attempt < retriesPerModel) {
          const backoffMs = 700 + attempt * 900 + Math.floor(Math.random() * 300);
          await sleep(backoffMs);
          continue;
        }

        break;
      }
    }
  }

  const detail = errors.slice(0, 3).join(" | ");
  throw new Error(`${purpose}暂时不可用，请稍后重试。${detail ? `（${detail}）` : ""}`);
}

async function callGeminiMultimodal(payload: any, timeoutMs: number = 30000): Promise<string> {
  const data = await fetchGeminiWithFallback(
    payload,
    TEXT_MODEL_FALLBACK_CHAIN,
    timeoutMs,
    1,
    "文案/提示词引擎"
  );
  const text = collectGeminiText(data);

  if (!text) {
    throw new Error("模型返回为空，请稍后重试。");
  }

  return text;
}

/**
 * 双图多模态逆向：根据商品图 + 风格图 + 文字，融合出神级提示词
 * @param productBase64 用户原有的商品主体图 (Base64)
 * @param referenceBgBase64 用户上传的参考背景风格图 (Base64，可选)
 * @param currentText 用户的文字修改指令 (可选)
 */
export async function generateMasterImagePrompt(
  productBase64: string,
  referenceBgBase64?: string,
  currentText?: string,
  userId?: string,
  sceneSetting?: string,
  toneSetting?: string
): Promise<string> {
  if (!productBase64) {
    throw new Error("未获取到商品主体图，请先上传商品图。");
  }

  const userInput = currentText?.trim();
  const safeInput = userInput?.replace(/`/g, "'") || "";
  const safeScene = sceneSetting?.trim() || '未指定';
  const safeTone = toneSetting?.trim() || '未指定';

  const systemInstruction = `你是一个精通商业产品摄影、广告美术指导与电商场景设计的顶级 AI 提示词专家。
【任务】：我会提供商品图、可选的风格参考图、用户已写好的导演指令、预选的场景设定与画面色调。请你融合这些信息，输出一段极致专业、纯中文、适合直接生图的提示词。

【优先级规则（按维度执行，不允许混淆）】：
1. 商品图优先级最高，但只负责锁定商品身份：必须识别并保持商品的真实品类、主体形态、包装识别点与核心材质，不要长篇复述商品细节。
2. 风格参考图优先级最高，但只允许参考风格：只能学习其中的光影氛围、色彩倾向、构图节奏、空间气质、背景材质与道具语言。绝对禁止参考参考图里的任何商品、品牌、包装、标签、文案或主体类别。
3. 用户导演指令优先级高：如果用户已经写了具体环境、氛围、材质、镜头或光线要求，优先满足，并用其修正场景表现。
4. 场景设定与画面色调是稳定约束：它们负责限定环境类型与整体色温倾向，除非与商品识别或用户明确指令冲突，否则必须体现在结果里。

【当前控制条件】：
- 场景设定：${safeScene}
- 画面色调：${safeTone}
- 用户导演指令：${safeInput ? `【${safeInput}】` : '未填写'}

【生成目标】：
1. 最终提示词必须少写商品、多写环境。商品描述只保留必要锚点，用一句话锁定主体即可。
2. 重点展开背景环境、空间关系、台面/墙面材质、景深层次、冷暖空气感、反射/折射、水珠/雾气、光线方向、高光与阴影质地。
3. 必须根据商品品类自动选择更适合该商品的背景环境与光影，而不是偷懒使用统一白底。除非用户明确要求极简纯白棚拍，否则禁止输出默认白底、空白背景、无影棚白底。
4. 如果存在风格参考图，最终画面的美术语言应向参考图靠拢，但商品必须仍然来自商品图，而不是参考图。
5. 如果不存在风格参考图，也必须基于商品品类、场景设定、画面色调和用户导演指令，主动构建合理的商业摄影环境。

【输出格式】：
1. 只能输出一段纯中文提示词文本。
2. 不要输出分析、解释、前缀、标题、编号或客套话。
3. 不要输出英文，不要输出 JSON，不要输出分点。`;

  const parseBase64Image = (value: string) => {
    const trimmed = value.trim();
    const matched = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (matched) {
      return {
        mimeType: matched[1] || 'image/jpeg',
        data: matched[2] || ''
      };
    }
    return {
      mimeType: detectMimeType(trimmed),
      data: trimmed
    };
  };

  const productImage = parseBase64Image(productBase64);
  const bgImage = referenceBgBase64 ? parseBase64Image(referenceBgBase64) : null;

  const parts: any[] = [
    { text: systemInstruction },
    { text: "\n--- 图像 1：商品主体（唯一商品锚点）---" },
    { inlineData: { mimeType: productImage.mimeType, data: productImage.data } }
  ];

  if (bgImage?.data) {
    parts.push({ text: "\n--- 图像 2：风格参考（只允许提取风格，不允许借用其中的商品主体）---" });
    parts.push({ inlineData: { mimeType: bgImage.mimeType, data: bgImage.data } });
  }

  const requestBody = {
    userId,
    contents: [{ role: "user", parts }]
  };

  return await callGeminiMultimodal(requestBody, 30000);
}

/**
 * 优化 2：AI 生成神级文案 (营销模块)
 * @param base64Image 当前海报底图（base64，支持 dataURL 或纯 base64）
 * @param currentText 用户当前输入框的文字
 */
export async function generateMasterMarketingCopy(base64Image: string, currentText?: string, userId?: string): Promise<string> {
  if (!base64Image) {
    throw new Error("未获取到可用图片，请先上传或生成底图。");
  }
  const userInput = currentText?.trim();
  const safeInput = userInput?.replace(/`/g, "'") || "";
  const systemInstruction = `你是一个顶尖的电商奥美级广告大师和视觉分析专家。
【任务】：我会给你一张真实的商品海报底图${safeInput ? `，以及用户的核心诉求：【${safeInput}】` : '。用户没有提供文字诉求，请完全根据图片自由发挥'}。
请仔细观察图片中的商品主体、环境光影、材质和整体调性。
如果是高级、极简、暗调的图片，请匹配“充满诗意、高奢、克制”的文案。
如果是色彩鲜艳、生活化、快消品的图片，请匹配“抓人眼球、极具网感、爆款带货”的文案。

【严格排版要求】：
1. 必须精准契合图片中商品的真实品类。
2. 只需要两句话：一句极简有力的主标题（4-8字）；一句补充说明的副标题（8-15字）。
3. 绝对不要加任何 Emoji，绝对不要其他废话。
4. 严格按照以下格式输出：
主标题：[你的主标题]
副标题：[你的副标题]`;

  let mimeType = 'image/jpeg';
  let imageData = base64Image.trim();
  const dataUrlMatch = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1] || 'image/jpeg';
    imageData = dataUrlMatch[2] || '';
  } else {
    mimeType = detectMimeType(imageData);
  }

  const requestBody = {
    userId,
    contents: [
      {
        role: "user",
        parts: [
          { text: systemInstruction },
          {
            inlineData: {
              mimeType,
              data: imageData
            }
          }
        ]
      }
    ]
  };

  return await callGeminiMultimodal(requestBody, 30000);
}

// ==========================================
// 🧬 极致 DPE 0：竞品“视觉基因”提取 (Visual DNA)
// ==========================================
export async function extractVisualDNA(base64Image: string, userId?: string): Promise<VisualDNA | null> {
  const systemPrompt = `CRITICAL INSTRUCTION: You are an expert Colorist and Lighting Director. 
TASK: Analyze this reference image and extract ONLY its abstract visual style. 
ABSOLUTE RULE: DO NOT extract or mention any physical objects, props, specific shapes, or background items (e.g., ignore tables, windows, hands, specific products). 
OUTPUT FORMAT: Strict JSON only.

[EXTRACTION DIMENSIONS]
1. "lighting_style": Exact lighting setup (e.g., "dappled sunlight, soft ambient, high contrast chiaroscuro, cinematic rim light").
2. "color_palette": The color grading and tone (e.g., "warm earthy tones, cold blue cinematic, pastel muted, vibrant high saturation").
3. "atmosphere": The abstract emotional vibe (e.g., "ethereal, moody, energetic, minimalist and sterile").

[EXAMPLE OUTPUT]
{
  "lighting_style": "soft directional sunlight with harsh shadows",
  "color_palette": "teal and orange cinematic grading",
  "atmosphere": "moody, premium, calm"
}`;

  const payload = {
    userId,
    contents: [{ parts: [{ inlineData: { data: base64Image, mimeType: 'image/png' } }, { text: systemPrompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    console.log("[extractVisualDNA] Sequencing DNA...");
    const data = await fetchGeminiWithFallback(
      payload,
      TEXT_MODEL_FALLBACK_CHAIN,
      30000,
      1,
      "视觉风格提取"
    );
    const textResp = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // 清洗 Markdown 代码块
    const cleanJson = textResp.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);
    
    console.log("[extractVisualDNA] DNA Sequenced Successfully");
    return parsedData as VisualDNA;
  } catch (error) {
    console.error("[extractVisualDNA] DNA Sequencing Failed:", error);
    return null;
  }
}

// ==========================================
// 🧠 极致 DPE 1：电商总监级智能灵感提取
// ==========================================
export async function generateSmartPrompt(base64Image: string, scene: string = "真实生活代入", tone: string = "治愈系自然光", userId?: string): Promise<string> {
  const fallbackPrompt = "亚马逊标准纯白无缝背景，商品绝对居中展示。采用顶级商业影棚柔光箱均匀打光，消除杂乱阴影，极致清晰展现商品全貌，8K分辨率，Octane超高精渲染。";
  
  const randomFactor = Math.random().toString(36).substring(7);
  const systemPrompt = `CRITICAL INSTRUCTION: You are an Elite E-commerce Visual Director. 
  TASK: Output ONE highly professional commercial photography prompt in Chinese. 
  USER REQUIREMENT: The user specifically wants a [${scene}] scene with a [${tone}] color tone. 
  RANDOM SEED: ${randomFactor} (Use this to brainstorm a unique camera angle and prop arrangement every time).
  RULE: Integrate the product perfectly into this exact scene and tone. Use highly descriptive, premium cinematic language.
  
  [PLATFORM AESTHETIC DIRECTIVES]
  Based on the product type, implicitly choose ONE of these platform styles:
  1. AMAZON STYLE (For everyday goods/tools): 纯白背景, 绝对清晰, 无多余道具, 影棚平光. (Pure white, extreme clarity, no props)
  2. JD STYLE (For Tech/Luxury/Appliances): 极简冷灰质感, 几何亚克力展台, 轮廓光, 高级工业感. (Minimalist cool gray, geometric pedestals, rim light)
  3. TAOBAO/XIAOHONGSHU STYLE (For Fashion/Beauty/Food): 真实高质感生活场景, 斑驳自然漏光(Gobo), 边缘关联道具衬托, 高饱和诱人色调. (Realistic lifestyle, dappled light, contextual props)
  
  [PROMPT FORMULA]
  [平台风格设定] + [具体展台/背景材质] + [光影布置] + [氛围描述] + [相机与渲染器参数]
  
  [OUTPUT RULES]
  - Output ONLY the final Chinese prompt (max 80 words). NO intro, NO markdown.
  - Make it directly usable as a structural prompt for image generation.`;

  const payload = {
    userId,
    contents: [{ parts: [{ inlineData: { data: base64Image, mimeType: 'image/png' } }, { text: systemPrompt }] }]
  };

  try {
    console.log("[generateSmartPrompt] Starting generation...");
    const data = await fetchGeminiWithFallback(
      payload,
      TEXT_MODEL_FALLBACK_CHAIN,
      30000,
      1,
      "神级提示词生成"
    );
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      console.warn("[generateSmartPrompt] AI 灵感提取为空，使用兜底提示词");
      return fallbackPrompt;
    }
    console.log("[generateSmartPrompt] Success:", text);
    return text;
  } catch (error) {
    console.error("[generateSmartPrompt] Error caught:", error);
    // 发生错误时静默降级到兜底提示词，不阻塞用户流程
    return fallbackPrompt;
  }
}

// ==========================================
// ✍️ 极致 DPE 2.5：AI 商品卖点自动提炼机 (绝对防崩版)
// ==========================================
function detectMimeType(imageData: string): string {
  if (imageData.startsWith('iVBOR')) return 'image/png';
  if (imageData.startsWith('/9j/')) return 'image/jpeg';
  if (imageData.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

function normalizeText(input: string, maxLen: number): string {
  const trimmed = input
    .replace(/["'`]/g, '')
    .replace(/[|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(trimmed).slice(0, maxLen).join('');
}

function pickFontStyleFromCopy(mainTitle: string, subTitle: string): FontStyle {
  const text = `${mainTitle} ${subTitle}`;
  if (/(赛博|未来|科技|芯片|智能|机能|极客|数码|潮玩)/.test(text)) return 'tech_mono';
  if (/(诗|雅|月|雾|风|光影|东方|古韵|留白)/.test(text)) return 'elegant_serif';
  if (/(爆款|热销|必买|限时|抢|秒杀|直降|冲)/.test(text)) return 'bold_display';
  if (/(手作|温柔|治愈|日常|生活方式)/.test(text)) return 'handwritten_script';
  return 'modern_sans';
}

export async function extractProductCopywriting(base64OrDataUrl: string, userId?: string): Promise<{ mainTitle: string; subTitle: string; fontStyle: FontStyle }> {
  const fallback = {
    mainTitle: "一眼心动",
    subTitle: "光影落在细节里，恰好照见你的品味",
    fontStyle: 'elegant_serif' as FontStyle
  };

  const systemPrompt = `你是顶级电商创意总监 + 品牌文案导演。请根据商品图，输出高转化且审美高级的文案。
【目标】
1) mainTitle：爆款主标题，抓眼球，突出利益点，6-12字。
2) subTitle：诗意副标题，克制高级，12-22字，可被反复品味。
3) fontStyle：从以下枚举中选择最适配文案气质的一个：
modern_sans, elegant_serif, bold_display, handwritten_script, tech_mono, playful_marker, classic_song, artistic_brush
【硬性要求】
- 只输出 JSON，不要任何解释、markdown、代码块。
- JSON 结构必须为：{"mainTitle":"...","subTitle":"...","fontStyle":"..."}
- 禁止 emoji、引号嵌套、口水词。`;

  let imageData = base64OrDataUrl;
  let mimeType = 'image/jpeg';
  const matched = base64OrDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (matched) {
    mimeType = matched[1] || 'image/jpeg';
    imageData = matched[2] || '';
  } else {
    mimeType = detectMimeType(base64OrDataUrl);
  }

  const payload = {
    userId,
    contents: [{ parts: [{ inlineData: { data: imageData, mimeType } }, { text: systemPrompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const data = await fetchGeminiWithFallback(
      payload,
      TEXT_MODEL_FALLBACK_CHAIN,
      30000,
      1,
      "视觉文案提炼"
    );
    const rawText = data.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("\n") || "";
    const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed: any = null;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      const mainMatch = cleanText.match(/MAIN[:：]\s*([^\n|]+)/i);
      const subMatch = cleanText.match(/SUB[:：]\s*([^\n|]+)/i);
      parsed = {
        mainTitle: mainMatch?.[1] || "",
        subTitle: subMatch?.[1] || "",
      };
    }

    const mainTitle = normalizeText(String(parsed?.mainTitle || parsed?.main || ""), 12) || fallback.mainTitle;
    const subTitle = normalizeText(String(parsed?.subTitle || parsed?.sub || ""), 22) || fallback.subTitle;
    const candidateFont = String(parsed?.fontStyle || "").trim() as FontStyle;
    const validFonts: FontStyle[] = ['modern_sans', 'elegant_serif', 'bold_display', 'handwritten_script', 'tech_mono', 'playful_marker', 'classic_song', 'artistic_brush'];
    const fontStyle = validFonts.includes(candidateFont) ? candidateFont : pickFontStyleFromCopy(mainTitle, subTitle);

    return { mainTitle, subTitle, fontStyle };
  } catch (error) {
    console.error("Copywriting error:", error);
    return fallback;
  }
}

// ==========================================
// 📐 极致 DPE 2：物理光影引擎解析
// ==========================================
export async function analyzeProduct(base64Images: string[], userId?: string): Promise<MarketAnalysis> {
  const fallbackAnalysis: MarketAnalysis = {
    perspective: "Eye-level",
    lightingDirection: "Top-Left",
    physicalSpecs: {
      cameraPerspective: "eye-level straight on",
      lightingDirection: "soft light from top-left",
      colorTemperature: "natural daylight"
    }
  };

  const payload = {
    userId,
    contents: [{
      parts: [
        ...base64Images.map(data => ({ inlineData: { data, mimeType: 'image/png' } })),
        { text: `You are a Photogrammetry Expert. Analyze the product. Output strict JSON with: perspective, lightingDirection, physicalSpecs(cameraPerspective, lightingDirection, colorTemperature). No other text.` }
      ]
    }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    // 物理参数解析用于辅助，不应长时间阻塞主流程：单模型 18s，失败即降级到兜底参数继续生图
    const data = await fetchGeminiWithFallback(
      payload,
      ANALYZE_MODEL_FALLBACK_CHAIN,
      18000,
      0,
      "物理参数解析"
    );
    const rawText = collectGeminiText(data) || "{}";
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return {
      ...fallbackAnalysis,
      ...parsedData,
      perspective: parsedData?.perspective || fallbackAnalysis.perspective,
      lightingDirection: parsedData?.lightingDirection || fallbackAnalysis.lightingDirection,
      physicalSpecs: {
        ...fallbackAnalysis.physicalSpecs,
        ...(parsedData?.physicalSpecs || {})
      }
    };
  } catch (e: any) {
    const message = String(e?.message || '');
    // 鉴权问题必须上抛，避免吞掉真实登录态异常
    if (message.includes('登录身份已失效') || message.includes('身份认证')) {
      throw e;
    }
    console.error("解析物理参数原始错误:", e);
    console.warn("[analyzeProduct] 使用兜底物理参数继续执行生图流程");
    return fallbackAnalysis;
  }
}

// ==========================================
// 📸 极致 DPE 3：好莱坞级出图引擎与风格垫图
// ==========================================
// 1. 组装终极提示词（包含高级构图与比例适配指令）
function buildEnhancedPrompt(
  scenario: ScenarioType, 
  analysis: MarketAnalysis, 
  userIntent: string, 
  textConfig: TextConfig, 
  mode: GenerationMode, 
  styleImageBase64?: string, 
  visualDNA?: VisualDNA | null,
  variationPrompt?: string, 
  aspectRatio: AspectRatio = '1:1', 
  layout: CompositionLayout = 'center',
  redesignPrompt?: string,
  targetPlatform: string = '通用电商',
  productLockLevel: 'strict' | 'balanced' | 'editorial' = 'strict'
): string {
  let ratioDirective = "";
  if (aspectRatio === '3:4' || aspectRatio === '9:16') {
    ratioDirective = `[COMPOSITION: Vertical/Portrait orientation (${aspectRatio}). Frame the subject tall and elegant.]`;
  } else if (aspectRatio === '16:9' || aspectRatio === '4:3') {
    ratioDirective = `[COMPOSITION: Horizontal/Landscape orientation (${aspectRatio}). Wide cinematic framing.]`;
  } else {
    ratioDirective = `[COMPOSITION: Perfect square 1:1 framing. Center the subject.]`;
  }

  const AESTHETIC_BASE = `${ratioDirective}\n[GLOBAL AESTHETIC MASTER-CLASS] Award-winning commercial product photography, shot on Hasselblad H6D-100c or Sony A7R IV, 85mm f/1.8 lens. Raw unedited aesthetic, extreme macro texture detail, authentic physical lighting. No digitized CGI look, absolutely no text, no watermarks, flawless commercial packshot.`;

  // [全新] 平台专属视觉转化率算法引擎
  let platformDirective = "";
  switch (targetPlatform) {
    case '亚马逊爆款':
      platformDirective = `\n[PLATFORM OPTIMIZATION: AMAZON A9 ALGORITHM] Strictly adhere to Amazon main image standards. Extreme product clarity, hyper-realistic macro details, neutral or pure white premium background. Focus 100% on product material and functional detail. Zero distracting lifestyle elements. High CTR optimized.`;
      break;
    case '小红书种草':
      platformDirective = `\n[PLATFORM OPTIMIZATION: XIAOHONGSHU VIRAL AESTHETIC] Follow Xiaohongshu (Little Red Book) viral UGC aesthetic. Strong emotional value, authentic lifestyle context, highly aesthetic and breathable composition, dappled light, cozy and premium vibe. Make it highly shareable and trendy.`;
      break;
    case '抖音/TikTok':
      platformDirective = `\n[PLATFORM OPTIMIZATION: TIKTOK THUMBNAIL] High visual impact, extremely vibrant colors, dynamic composition, stop-scrolling thumbnail style, high contrast, energetic atmosphere. Optimized for mobile vertical viewing hook.`;
      break;
    default:
      platformDirective = `\n[PLATFORM OPTIMIZATION: GENERAL E-COMMERCE] High commercial viability, clear product display, visually appealing and balanced composition.`;
  }

  const cameraSpecs = "[CAMERA & RENDER] Hasselblad H6D-100c, 100mm Macro lens, f/8. 8k resolution, Octane Render, global illumination, Ray Tracing, ultra-detailed textures.";
  
  let vibe = "";
  switch(scenario) {
    case ScenarioType.STUDIO_WHITE: vibe = "[AMAZON/TMALL STANDARD] Pure white #FFFFFF seamless background. Studio softbox lighting. Extreme sharpness. High commercial viability, zero distracting elements."; break;
    case ScenarioType.MINIMALIST_PREMIUM: vibe = "[JD LUXURY STYLE] Minimalist premium setting. Matte acrylic or textured plaster geometric pedestals. Low saturation neutral tones. Chiaroscuro lighting with elegant soft cast shadows."; break;
    case ScenarioType.NATURAL_LIFESTYLE: vibe = "[XIAOHONGSHU/INS LIFESTYLE] Cozy highly realistic natural setting. Dappled morning sunlight (gobo lighting) filtering through window. Organic textures (linen, wood, stone). Warm, inviting, breathable."; break;
    case ScenarioType.OUTDOOR_STREET: vibe = "[TAOBAO FASHION/OUTDOOR] Dynamic outdoor environment. Shallow depth of field with beautiful bokeh. Golden hour natural sunlight. Vibrant, energetic, high contrast."; break;
    case ScenarioType.FESTIVAL_PROMO: vibe = "[TAOBAO DOUBLE 11 MEGA SALE] Festive promotional commercial vibe. Warm spotlighting, subtle celebratory out-of-focus background elements. High saturation, eye-catching, high click-through-rate style."; break;
    case ScenarioType.SOCIAL_MEDIA_STORY: vibe = "[TIKTOK/XIAOHONGSHU VIRAL] Trendy, visually striking modern lifestyle context. Dynamic angles, pop of complementary colors. Highly shareable aesthetic."; break;
  }

  // 【核心升级：基于比例的专业构图法则】
  let compositionRules = "";
  switch(aspectRatio) {
    case '1:1':
      compositionRules = "\n[COMPOSITION - SQUARE] Balanced, symmetrical composition. The environment should feel contained and focused around the center.";
      break;
    case '3:4':
    case '9:16':
      compositionRules = "\n[COMPOSITION - VERTICAL/PORTRAIT] Emphasize verticality and height. Use leading lines that draw the eye upwards. The background should feel tall and spacious, allowing for breathing room above or below the subject.";
      break;
    case '16:9':
    case '4:3':
      compositionRules = "\n[COMPOSITION - HORIZONTAL/CINEMATIC] Expansive, wide-angle composition. Emphasize the breadth of the environment. Use horizontal leading lines. The background should feel panoramic and epic, providing context and scale.";
      break;
  }

  let layoutDirective = "";
  switch(layout) {
    case 'center': layoutDirective = "\n[LAYOUT PLACEMENT] Subject placed perfectly in the center. Symmetrical balance."; break;
    case 'left_space': layoutDirective = "\n[LAYOUT PLACEMENT - CRITICAL] Place the main subject clearly on the RIGHT side. The entire LEFT half MUST be clean negative space for copy."; break;
    case 'right_space': layoutDirective = "\n[LAYOUT PLACEMENT - CRITICAL] Place the main subject clearly on the LEFT side. The entire RIGHT half MUST be clean negative space for copy."; break;
    case 'top_space': layoutDirective = "\n[LAYOUT PLACEMENT - CRITICAL] Place the main subject at the BOTTOM. The entire TOP half MUST be clean negative space expanding upwards."; break;
  }

  const guardrails = mode === 'precision' 
    ? `[PHYSICAL CONSTRAINTS - STRICT] Build an EMPTY background ready for a product.\n- Angle: ${analysis.physicalSpecs.cameraPerspective}\n- Light: ${analysis.physicalSpecs.lightingDirection}\n- Temp: ${analysis.physicalSpecs.colorTemperature}\nDO NOT RENDER THE MAIN PRODUCT.` 
    : `[INTEGRATION] Integrate the product perfectly.`;

  // [全新] 好莱坞级物理融合指令构建
  let dnaDirective = "";
  if (visualDNA) {
    dnaDirective = `
\n[STYLE TRANSFER OVERRIDE - CRITICAL]
Apply the following visual style completely to the entire image:
- Lighting & Shadows: ${visualDNA.lighting_style}
- Color Grading: ${visualDNA.color_palette}
- Overall Vibe: ${visualDNA.atmosphere}
WARNING: Apply ONLY the lighting, color, and vibe. Do NOT introduce any new objects or props based on this style reference.
`;
  }

  // [全新] 虚拟改款实验室：轮廓锁死与材质替换覆盖指令
  let redesignDirective = "";
  if (redesignPrompt) {
    redesignDirective = `\n[VIRTUAL REDESIGN]: Change the material and surface texture of the masked object to strictly be: "${redesignPrompt}".`;
  }

  const styleDirective = (styleImageBase64 && !visualDNA) ? `[STYLE TRANSFER] Extract and replicate the exact color grading, lighting, and aesthetic DNA of the SECOND image.\n` : "";
  const variationDirective = variationPrompt ? `\n[MANDATORY COMMERCIAL VARIATION] ${variationPrompt}\n` : "";
  const productIdentityLock = (() => {
    if (redesignPrompt) return "";

    switch (productLockLevel) {
      case 'balanced':
        return `\n[ABSOLUTE PRODUCT ID LOCK - BALANCED] The uploaded product image remains the only canonical SKU reference. Preserve the exact same product identity, bottle silhouette, cap shape, overall proportions, label layout, branding placement, and packaging artwork. A subtle perspective shift of the SAME bottle is allowed, but do NOT redesign, relabel, simplify, or replace it with a similar beverage. You may only enhance material realism, condensation, reflections, refraction, and premium lighting around the same package.\n`;
      case 'editorial':
        return `\n[ABSOLUTE PRODUCT ID LOCK - EDITORIAL] The uploaded product image is still the canonical SKU. Keep the product immediately recognizable as the same bottle and the same packaging design, including cap form, bottle structure, label system, branding position, color blocking, and fruit/package artwork. A moderate camera angle shift and stronger art direction are allowed, but the product itself must remain the same SKU. Never substitute it with a different beverage, generic bottle, or redesigned package.\n`;
      case 'strict':
      default:
        return `\n[ABSOLUTE PRODUCT ID LOCK - STRICT] Treat the uploaded product image as the only canonical SKU reference. You MUST keep the exact same product identity in the final image. Preserve the exact bottle silhouette, cap shape, neck and base proportions, label layout, branding position, packaging color blocking, and printed fruit/package artwork from the uploaded product. Do NOT redesign, substitute, simplify, or replace it with a similar beverage or a generic bottle. No camera angle change is allowed. Only change scene, lighting, reflections, and peripheral environment around the SAME product. Product label graphics that already exist on the uploaded package must remain consistent; the NO TEXT rule only forbids adding new scene text or watermarks.\n`;
    }
  })();

  // 在最终拼接前，如果存在改款指令，将其提权到极高的优先级
  let finalRedesignOverride = "";
  if (redesignPrompt) {
    finalRedesignOverride = `\n[ABSOLUTE PRIORITY OVERRIDE]: The user has commanded a VIRTUAL REDESIGN. You MUST preserve the exact original shape of the uploaded product but completely transform its surface material/color to: "${redesignPrompt}". This overrides any conflicting lighting or platform rules. Do NOT distort the product's physical structure.`;
  }

  // 将新的 compositionRules 加入到最终 Prompt 中
  return `${AESTHETIC_BASE}${platformDirective}\nYou are a Top-tier Commercial E-commerce Photographer.\n${cameraSpecs}\n[SCENE VIBE] ${vibe}\n${compositionRules}${layoutDirective}\n${guardrails}${productIdentityLock}\n${dnaDirective}${redesignDirective}${finalRedesignOverride}${styleDirective}${variationDirective}[USER DIRECTIVE] ${userIntent}\n[SAFETY] NO TEXT. NO WATERMARKS. NO FLOATING OBJECTS.`.trim();
}

// 2. 底层生图引擎（绝对纯净的 Payload 构建）
export async function generateScenarioImage(
  base64Images: string[], 
  scenario: ScenarioType, 
  analysis: MarketAnalysis, 
  userIntent: string, 
  textConfig: TextConfig, 
  mode: GenerationMode, 
  styleImageBase64?: string, 
  visualDNA?: VisualDNA | null,
  variationPrompt?: string, 
  aspectRatio: any = '1:1', 
  layout: any = 'center',
  redesignPrompt?: string,
  targetPlatform: string = '通用电商',
  maskImageBase64?: string | null,
  isRedesignMode: boolean = false,
  userId?: string,
  count: 1 | 3 = 1,
  skipPromptExpansion: boolean = false,
  productLockLevel: 'strict' | 'balanced' | 'editorial' = 'strict',
  imageRequestProfile: 'default' | 'stable' = 'default'
): Promise<string | string[]> {
  
  const finalPrompt = buildEnhancedPrompt(scenario, analysis, userIntent, textConfig, mode, styleImageBase64, visualDNA, variationPrompt, aspectRatio, layout, redesignPrompt, targetPlatform, productLockLevel);

  let parts: any[] = [];
  
  if (isRedesignMode && maskImageBase64) {
    // 【局部重绘模式 Payload】
    parts = [
      { text: finalPrompt + "\n[SYSTEM INSTRUCTION]: You are performing an INPAINTING task. You MUST restrict all material and color changes STRICTLY to the white areas of the provided Mask Image. The black areas are the background and must interact physically with the new material." },
      { inlineData: { data: base64Images[0], mimeType: 'image/png' } }, // 原图
      { inlineData: { data: maskImageBase64.split(',')[1], mimeType: 'image/png' } }  // 遮罩图 (Mask)
    ];
  } else {
    // 【常规生图模式 Payload】
    parts = [
      { text: finalPrompt },
      { inlineData: { data: base64Images[0], mimeType: 'image/png' } }
    ];
  }

  if (styleImageBase64) {
    parts.push({ inlineData: { data: styleImageBase64, mimeType: 'image/png' } });
  }

  const fullPayload = {
    userId,
    count,
    skipPromptExpansion,
    imageRequestProfile,
    contents: [
      { parts: parts }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio
      }
    }
  };

  const imageModelChain = imageRequestProfile === 'stable'
    ? ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"]
    : IMAGE_MODEL_CHAIN_ARTISTIC;

  const timeoutByModel = imageRequestProfile === 'stable'
    ? {
        "gemini-2.5-flash-image": 70000,
        "gemini-3.1-flash-image-preview": 22000
      }
    : {
        "gemini-3.1-flash-image-preview": 22000,
        "gemini-2.5-flash-image": 60000
      };

  // 📸 生图请求给予 60s 宽容度，失败自动回落下一个模型
  const data = await fetchGeminiWithFallback(
    fullPayload,
    imageModelChain,
    60000,
    1,
    "生图引擎",
    timeoutByModel
  );

  const directImages = Array.isArray((data as any)?.images)
    ? (data as any).images.filter((item: any) => typeof item === 'string' && item.length > 0)
    : [];
  if (directImages.length > 0) {
    return count === 3 ? directImages.slice(0, 3) : directImages[0];
  }

  const extractedImages: string[] = [];
  for (const candidate of data.candidates || []) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        extractedImages.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }
  }

  if (extractedImages.length > 0) {
    return count === 3 ? extractedImages.slice(0, 3) : extractedImages[0];
  }

  throw new Error("生成引擎执行完毕，但未返回有效图像数据。");
}
