import { createRemoteJWKSet, jwtVerify } from 'jose';
import type {
  AspectRatio,
  CompositionLayout,
  GenerationMode,
  MarketAnalysis,
  ScenarioType,
  TextConfig,
  VisualDNA,
} from '../../types';
import { buildEnhancedPrompt } from '../../utils/generationPrompt';

interface Env {
  DB: any;
  AUTHING_DOMAIN?: string;
}

type JobMode = 'single' | 'matrix';
type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
type JobStage = 'queued' | 'analyze' | 'generate' | 'retry' | 'completed' | 'failed';
type JobMetricStatus = 'done' | 'fallback' | 'failed';

interface GenerationMetricEntry {
  label: string;
  durationMs: number;
  status: JobMetricStatus;
  detail?: string;
}

interface GenerationJobState {
  suiteSlotStates?: Array<'idle' | 'queued' | 'loading' | 'success' | 'error'>;
  suiteSlotMessages?: string[];
  generationBillingSummary?: string | null;
}

interface GenerationJobResult {
  analysis?: MarketAnalysis;
  images?: string[];
  image_quota?: number | null;
  vip_expire_date?: string | null;
  fulfilledCount?: number;
  failedCount?: number;
}

interface GenerationJobPayload {
  userId: string;
  traceId: string;
  mode: JobMode;
  sourceImageBase64: string;
  styleImageBase64?: string;
  userPrompt: string;
  textConfig: TextConfig;
  aspectRatio: AspectRatio;
  layout: CompositionLayout;
  generationMode: GenerationMode;
  targetPlatform: string;
  scenario: ScenarioType;
  visualDNA?: VisualDNA | null;
  analysis?: MarketAnalysis | null;
}

interface JobRow {
  id: string;
  user_id: string;
  trace_id?: string | null;
  mode: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  message?: string | null;
  metrics_json?: string | null;
  state_json?: string | null;
  result_json?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

type OptionalGenerationTable = 'GenerationOutputs' | 'GenerationChargeLedger';

interface GenerationOutputRecordInput {
  jobId: string;
  userId: string;
  traceId: string;
  slotIndex: number;
  mode: JobMode;
  status: 'COMPLETED' | 'FAILED';
  imageUrl?: string | null;
  promptSnapshot?: string | null;
  modelName?: string | null;
  errorMessage?: string | null;
  chargedTokens: number;
}

interface GenerationChargeLedgerRecordInput {
  jobId: string;
  userId: string;
  outputId?: string | null;
  traceId: string;
  slotIndex: number;
  actionType: 'CHARGE' | 'REFUND' | 'COMPENSATE';
  tokenDelta: number;
  reason: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ANALYZE_MODEL_CHAIN = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const IMAGE_MODEL_CHAIN_DEFAULT = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];
const IMAGE_MODEL_CHAIN_STABLE = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];

const MATRIX_PROFILES = [
  {
    label: '高转化主图',
    lockLevel: 'strict' as const,
    requestProfile: 'stable' as const,
    variationPrompt: 'Commercial product photography, studio lighting, high contrast, clean background, highly detailed, eye-catching. Keep the exact uploaded product identity, bottle shape, label layout, and packaging artwork unchanged. No camera angle change. Only optimize lighting, reflections, and peripheral splash details around the same product.',
  },
  {
    label: '沉浸生活感',
    lockLevel: 'balanced' as const,
    requestProfile: 'stable' as const,
    variationPrompt: 'Lifestyle photography in a warm real-world environment, natural sunlight, cinematic lighting, depth of field, cozy atmosphere. Keep the exact uploaded product identity, bottle shape, label layout, and packaging artwork unchanged. Allow only a subtle perspective change of the same bottle and premium material polish such as clearer liquid, improved condensation, and refined highlights.',
  },
  {
    label: '极简高级感',
    lockLevel: 'editorial' as const,
    requestProfile: 'stable' as const,
    variationPrompt: 'Minimalist high-end aesthetic, geometric background, premium art direction, controlled props, soft diffuse reflection, and refined material details. Keep the exact uploaded product identity and packaging design immediately recognizable. Allow a moderate camera angle shift and editorial scene design, but never replace or redesign the bottle, label system, or package artwork.',
  },
];

const FALLBACK_ANALYSIS: MarketAnalysis = {
  perspective: 'Eye-level',
  lightingDirection: 'Top-Left',
  physicalSpecs: {
    cameraPerspective: 'eye-level straight on',
    lightingDirection: 'soft light from top-left',
    colorTemperature: 'natural daylight',
  },
};

const ANALYSIS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function createJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createGenerationOutputId() {
  return `gout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createGenerationChargeLedgerId() {
  return `gchg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createStableHash(input: string): string {
  let hashA = 5381;
  let hashB = 52711;
  for (let index = 0; index < input.length; index++) {
    const code = input.charCodeAt(index);
    hashA = ((hashA << 5) + hashA) ^ code;
    hashB = ((hashB << 5) + hashB) ^ (code + index);
  }
  return `${(hashA >>> 0).toString(36)}${(hashB >>> 0).toString(36)}`;
}

function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function serializeJobRow(row: JobRow | null) {
  if (!row) return null;
  return {
    success: true,
    jobId: row.id,
    traceId: row.trace_id || null,
    mode: row.mode,
    status: row.status,
    stage: row.stage,
    progress: Number(row.progress ?? 0),
    message: row.message || '',
    metrics: parseJsonColumn<GenerationMetricEntry[]>(row.metrics_json, []),
    state: parseJsonColumn<GenerationJobState>(row.state_json, {}),
    result: parseJsonColumn<GenerationJobResult>(row.result_json, {}),
    errorMessage: row.error_message || null,
    createdAt: row.created_at || null,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function getD1TablePresence(env: Env, tableName: 'GenerationJobs' | 'GenerationCache' | OptionalGenerationTable) {
  const row = (await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
    .bind(tableName)
    .first()) as { name?: string | null } | null;

  return row?.name === tableName;
}

async function assertD1TableReady(env: Env, tableName: 'GenerationJobs' | 'GenerationCache') {
  try {
    if (await getD1TablePresence(env, tableName)) return;
    throw new Error(`D1_SCHEMA_MISSING:${tableName}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('D1_SCHEMA_MISSING:')) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`D1_SCHEMA_CHECK_FAILED:${tableName}:${detail}`);
  }
}

async function ensureGenerationJobsTable(env: Env) {
  await assertD1TableReady(env, 'GenerationJobs');
}

async function ensureGenerationCacheTable(env: Env) {
  await assertD1TableReady(env, 'GenerationCache');
}

async function insertGenerationOutput(env: Env, record: GenerationOutputRecordInput) {
  if (!(await getD1TablePresence(env, 'GenerationOutputs'))) return null;

  const outputId = createGenerationOutputId();
  await env.DB
    .prepare(`
      INSERT INTO GenerationOutputs (
        id, job_id, user_id, trace_id, slot_index, mode, model_name, status,
        image_url, prompt_snapshot, error_message, charged_tokens
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `)
    .bind(
      outputId,
      record.jobId,
      record.userId,
      record.traceId,
      record.slotIndex,
      record.mode,
      record.modelName || null,
      record.status,
      record.imageUrl || null,
      record.promptSnapshot || null,
      record.errorMessage || null,
      record.chargedTokens
    )
    .run();

  return outputId;
}

async function insertGenerationChargeLedger(env: Env, record: GenerationChargeLedgerRecordInput) {
  if (!(await getD1TablePresence(env, 'GenerationChargeLedger'))) return;

  await env.DB
    .prepare(`
      INSERT INTO GenerationChargeLedger (
        id, job_id, user_id, output_id, trace_id, slot_index, action_type, token_delta, reason
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `)
    .bind(
      createGenerationChargeLedgerId(),
      record.jobId,
      record.userId,
      record.outputId || null,
      record.traceId,
      record.slotIndex,
      record.actionType,
      record.tokenDelta,
      record.reason
    )
    .run();
}

function mapJobApiError(error: unknown, fallbackMessage: string) {
  const raw = String(error instanceof Error ? error.message : error || fallbackMessage);

  if (raw === 'UNAUTHORIZED') {
    return { status: 401, error: raw, message: raw };
  }

  if (raw === 'FORBIDDEN') {
    return { status: 403, error: raw, message: raw };
  }

  if (raw.startsWith('D1_SCHEMA_MISSING:')) {
    const tableName = raw.split(':')[1] || 'UNKNOWN_TABLE';
    return {
      status: 500,
      error: raw,
      message: `数据库缺少 ${tableName} 表，请先执行 D1 初始化 SQL。`,
    };
  }

  if (raw.startsWith('D1_SCHEMA_CHECK_FAILED:')) {
    const [, tableName = 'UNKNOWN_TABLE', detail = 'unknown'] = raw.split(':');
    return {
      status: 500,
      error: raw,
      message: `数据库表检查失败（${tableName}）：${detail}`,
    };
  }

  return { status: 500, error: raw, message: fallbackMessage };
}

async function fetchJob(env: Env, jobId: string, userId: string): Promise<JobRow | null> {
  return (await env.DB
    .prepare(`
      SELECT id, user_id, trace_id, mode, status, stage, progress, message, metrics_json, state_json, result_json,
             error_message, created_at, started_at, completed_at, updated_at
      FROM GenerationJobs
      WHERE id = ?1 AND user_id = ?2
    `)
    .bind(jobId, userId)
    .first()) as JobRow | null;
}

async function readCache<T>(env: Env, cacheKey: string): Promise<T | null> {
  const row = (await env.DB
    .prepare('SELECT value_json, expires_at FROM GenerationCache WHERE cache_key = ?1')
    .bind(cacheKey)
    .first()) as { value_json?: string | null; expires_at?: string | null } | null;

  if (!row?.value_json || !row?.expires_at) return null;
  const expiresAtMs = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await env.DB.prepare('DELETE FROM GenerationCache WHERE cache_key = ?1').bind(cacheKey).run();
    return null;
  }

  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return null;
  }
}

async function writeCache<T>(env: Env, cacheKey: string, kind: string, value: T, ttlMs: number) {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await env.DB
    .prepare(`
      INSERT INTO GenerationCache (cache_key, kind, value_json, expires_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
      ON CONFLICT(cache_key) DO UPDATE SET
        kind = excluded.kind,
        value_json = excluded.value_json,
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(cacheKey, kind, JSON.stringify(value), expiresAt)
    .run();
}

async function insertJob(env: Env, jobId: string, userId: string, traceId: string, mode: JobMode) {
  await env.DB
    .prepare(`
      INSERT INTO GenerationJobs (id, user_id, trace_id, mode, status, stage, progress, message, metrics_json, state_json, result_json)
      VALUES (?1, ?2, ?3, ?4, 'QUEUED', 'queued', 4, '任务已创建，正在排队...', ?5, ?6, ?7)
    `)
    .bind(jobId, userId, traceId, mode, JSON.stringify([]), JSON.stringify({}), JSON.stringify({}))
    .run();
}

async function updateJob(
  env: Env,
  jobId: string,
  patch: {
    status?: JobStatus;
    stage?: JobStage;
    progress?: number;
    message?: string;
    metrics?: GenerationMetricEntry[];
    state?: GenerationJobState;
    result?: GenerationJobResult;
    errorMessage?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  }
) {
  const sets: string[] = [];
  const values: Array<string | number | null> = [];

  if (patch.status !== undefined) {
    sets.push('status = ?');
    values.push(patch.status);
  }
  if (patch.stage !== undefined) {
    sets.push('stage = ?');
    values.push(patch.stage);
  }
  if (patch.progress !== undefined) {
    sets.push('progress = ?');
    values.push(Math.max(0, Math.min(100, Math.round(patch.progress))));
  }
  if (patch.message !== undefined) {
    sets.push('message = ?');
    values.push(patch.message);
  }
  if (patch.metrics !== undefined) {
    sets.push('metrics_json = ?');
    values.push(JSON.stringify(patch.metrics));
  }
  if (patch.state !== undefined) {
    sets.push('state_json = ?');
    values.push(JSON.stringify(patch.state));
  }
  if (patch.result !== undefined) {
    sets.push('result_json = ?');
    values.push(JSON.stringify(patch.result));
  }
  if (patch.errorMessage !== undefined) {
    sets.push('error_message = ?');
    values.push(patch.errorMessage);
  }
  if (patch.startedAt !== undefined) {
    sets.push('started_at = ?');
    values.push(patch.startedAt);
  }
  if (patch.completedAt !== undefined) {
    sets.push('completed_at = ?');
    values.push(patch.completedAt);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(jobId);

  await env.DB
    .prepare(`UPDATE GenerationJobs SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

async function verifyUserIdFromAuth(request: Request, env: Env, expectedUserId: string): Promise<void> {
  const authingDomain = env.AUTHING_DOMAIN || 'YOUR_AUTHING_DOMAIN';
  if (!authingDomain || authingDomain.includes('YOUR_AUTHING_DOMAIN')) return;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  const cleanDomain = authingDomain.replace(/^https?:\/\//, '');
  const jwks = createRemoteJWKSet(new URL(`https://${cleanDomain}/oidc/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks);
  const claimedUserId = typeof payload.sub === 'string' ? payload.sub.trim() : '';

  if (claimedUserId && claimedUserId !== expectedUserId) {
    throw new Error('FORBIDDEN');
  }
}

function nowIso() {
  return new Date().toISOString();
}

function buildAnalyzePayload(sourceImageBase64: string, userId: string, traceId: string) {
  return {
    userId,
    clientTraceId: traceId,
    contents: [{
      parts: [
        { inlineData: { data: sourceImageBase64, mimeType: 'image/png' } },
        {
          text: 'You are a Photogrammetry Expert. Analyze the product. Output strict JSON with: perspective, lightingDirection, physicalSpecs(cameraPerspective, lightingDirection, colorTemperature). No other text.',
        },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json' },
  };
}

function parseAnalyzeResponse(data: any): MarketAnalysis {
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n') || '{}';
  const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleanJson);
    return {
      ...FALLBACK_ANALYSIS,
      ...parsed,
      perspective: parsed?.perspective || FALLBACK_ANALYSIS.perspective,
      lightingDirection: parsed?.lightingDirection || FALLBACK_ANALYSIS.lightingDirection,
      physicalSpecs: {
        ...FALLBACK_ANALYSIS.physicalSpecs,
        ...(parsed?.physicalSpecs || {}),
      },
    };
  } catch {
    return FALLBACK_ANALYSIS;
  }
}

function parseInternalError(status: number, rawText: string, data: any) {
  const message = typeof data?.message === 'string'
    ? data.message
    : typeof data?.error === 'string'
      ? data.error
      : rawText || '请求失败';
  const error = new Error(message) as Error & { status?: number; rawText?: string };
  error.status = status;
  error.rawText = rawText;
  return error;
}

async function fetchInternalJson(
  request: Request,
  authHeader: string | null,
  path: string,
  payload: any,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL(path, request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      throw parseInternalError(response.status, rawText, data);
    }

    return data;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('请求超时') as Error & { status?: number };
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRetryableModelFailure(error: any) {
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || 0);
  return (
    [429, 500, 502, 503, 504].includes(status) ||
    message.includes('high demand') ||
    message.includes('unavailable') ||
    message.includes('timeout') ||
    message.includes('temporarily') ||
    message.includes('稍后重试') ||
    message.includes('请求超时')
  );
}

async function analyzeInJob(
  env: Env,
  request: Request,
  authHeader: string | null,
  payload: GenerationJobPayload,
) {
  if (payload.analysis) {
    return {
      analysis: payload.analysis,
      metric: { label: '商品解析', durationMs: 0, status: 'done' as const, detail: '命中前端缓存' },
    };
  }

  const cacheKey = `analysis:${createStableHash(payload.sourceImageBase64)}`;
  const cachedAnalysis = await readCache<MarketAnalysis>(env, cacheKey);
  if (cachedAnalysis) {
    return {
      analysis: cachedAnalysis,
      metric: { label: '商品解析', durationMs: 0, status: 'done' as const, detail: '命中云端缓存' },
    };
  }

  const startedAt = Date.now();
  for (const model of ANALYZE_MODEL_CHAIN) {
    try {
      const data = await fetchInternalJson(
        request,
        authHeader,
        `/api/gemini?model=${model}&t=${Date.now()}`,
        buildAnalyzePayload(payload.sourceImageBase64, payload.userId, payload.traceId),
        model === 'gemini-2.5-flash-lite' ? 10000 : 7000
      );
      const normalizedAnalysis = parseAnalyzeResponse(data);
      await writeCache(env, cacheKey, 'analysis', normalizedAnalysis, ANALYSIS_CACHE_TTL_MS);
      return {
        analysis: normalizedAnalysis,
        metric: { label: '商品解析', durationMs: Date.now() - startedAt, status: 'done' as const, detail: model },
      };
    } catch (error) {
      if (!isRetryableModelFailure(error)) throw error;
    }
  }

  return {
    analysis: FALLBACK_ANALYSIS,
    metric: { label: '商品解析', durationMs: Date.now() - startedAt, status: 'fallback' as const, detail: '使用兜底物理参数' },
  };
}

async function requestImageWithFallback(
  request: Request,
  authHeader: string | null,
  payload: {
    userId: string;
    traceId: string;
    sourceImageBase64: string;
    styleImageBase64?: string;
    prompt: string;
    aspectRatio: AspectRatio;
    requestProfile: 'default' | 'stable';
  }
) {
  const modelChain = payload.requestProfile === 'stable' ? IMAGE_MODEL_CHAIN_STABLE : IMAGE_MODEL_CHAIN_DEFAULT;
  const timeoutByModel = payload.requestProfile === 'stable'
    ? { 'gemini-2.5-flash-image': 70000, 'gemini-3.1-flash-image-preview': 30000 }
    : { 'gemini-2.5-flash-image': 65000, 'gemini-3.1-flash-image-preview': 28000 };

  const imagePayload = {
    userId: payload.userId,
    count: 1,
    clientTraceId: payload.traceId,
    skipPromptExpansion: true,
    contents: [{
      parts: [
        { text: payload.prompt },
        { inlineData: { data: payload.sourceImageBase64, mimeType: 'image/png' } },
        ...(payload.styleImageBase64 ? [{ inlineData: { data: payload.styleImageBase64, mimeType: 'image/png' } }] : []),
      ],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: payload.aspectRatio },
    },
  };

  let lastError: any = null;
  for (const model of modelChain) {
    try {
      const data = await fetchInternalJson(
        request,
        authHeader,
        `/api/gemini?model=${model}&t=${Date.now()}`,
        imagePayload,
        timeoutByModel[model as keyof typeof timeoutByModel] || 30000
      );
      const images = Array.isArray(data?.images) ? data.images : [];
      if (!images[0]) {
        throw new Error('生图返回空图');
      }
      return {
        image: images[0] as string,
        image_quota: typeof data?.image_quota === 'number' ? Number(data.image_quota) : null,
        vip_expire_date: typeof data?.vip_expire_date === 'string' ? data.vip_expire_date : null,
        model,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableModelFailure(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('生图引擎暂时不可用，请稍后重试');
}

async function processSingleJob(
  env: Env,
  request: Request,
  authHeader: string | null,
  jobId: string,
  payload: GenerationJobPayload
) {
  const metrics: GenerationMetricEntry[] = [];
  const startedAt = nowIso();
  await updateJob(env, jobId, {
    status: 'RUNNING',
    stage: 'analyze',
    progress: 10,
    message: '正在解析商品参数...',
    startedAt,
  });

  const { analysis, metric } = await analyzeInJob(env, request, authHeader, payload);
  metrics.push(metric);
  await updateJob(env, jobId, {
    stage: 'generate',
    progress: 40,
    message: '正在调用生图引擎...',
    metrics,
    result: { analysis },
  });

  const generateStartedAt = Date.now();
  const prompt = buildEnhancedPrompt(
    payload.scenario,
    analysis,
    payload.userPrompt,
    payload.textConfig,
    payload.generationMode,
    payload.styleImageBase64,
    payload.visualDNA,
    undefined,
    payload.aspectRatio,
    payload.layout,
    undefined,
    payload.targetPlatform,
    'strict'
  );

  const generated = await requestImageWithFallback(request, authHeader, {
    userId: payload.userId,
    traceId: payload.traceId,
    sourceImageBase64: payload.sourceImageBase64,
    styleImageBase64: payload.styleImageBase64,
    prompt,
    aspectRatio: payload.aspectRatio,
    requestProfile: 'stable',
  });

  metrics.push({
    label: '主模型生图',
    durationMs: Date.now() - generateStartedAt,
    status: generated.model === IMAGE_MODEL_CHAIN_DEFAULT[0] ? 'done' : 'fallback',
    detail: generated.model,
  });

  const outputId = await insertGenerationOutput(env, {
    jobId,
    userId: payload.userId,
    traceId: payload.traceId,
    slotIndex: 0,
    mode: payload.mode,
    status: 'COMPLETED',
    imageUrl: generated.image,
    promptSnapshot: prompt,
    modelName: generated.model,
    chargedTokens: 1,
  });

  await insertGenerationChargeLedger(env, {
    jobId,
    userId: payload.userId,
    outputId,
    traceId: payload.traceId,
    slotIndex: 0,
    actionType: 'CHARGE',
    tokenDelta: 1,
    reason: '单图生成成功，扣除 1 Token',
  });

  await updateJob(env, jobId, {
    status: 'COMPLETED',
    stage: 'completed',
    progress: 100,
    message: '云端生图已完成，正在等待前端精修输出...',
    metrics,
    state: {
      generationBillingSummary: '本次成功生成 1 张，已扣 1 Token。',
    },
    result: {
      analysis,
      images: [generated.image],
      image_quota: generated.image_quota,
      vip_expire_date: generated.vip_expire_date,
      fulfilledCount: 1,
      failedCount: 0,
    },
    completedAt: nowIso(),
  });
}

async function processMatrixJob(
  env: Env,
  request: Request,
  authHeader: string | null,
  jobId: string,
  payload: GenerationJobPayload
) {
  const metrics: GenerationMetricEntry[] = [];
  const state: GenerationJobState = {
    suiteSlotStates: ['loading', 'queued', 'queued'],
    suiteSlotMessages: ['正在解析商品参数...', '等待上一张完成', '等待上一张完成'],
    generationBillingSummary: null,
  };
  const result: GenerationJobResult = {
    images: ['', '', ''],
    fulfilledCount: 0,
    failedCount: 0,
  };

  await updateJob(env, jobId, {
    status: 'RUNNING',
    stage: 'analyze',
    progress: 8,
    message: '正在解析商品参数，第 1 张即将开始...',
    startedAt: nowIso(),
    state,
    result,
  });

  const { analysis, metric } = await analyzeInJob(env, request, authHeader, payload);
  metrics.push(metric);
  result.analysis = analysis;

  await updateJob(env, jobId, {
    stage: 'generate',
    progress: 18,
    message: '营销矩阵顺序渲染中：正在处理第 1/3 张...',
    metrics,
    state,
    result,
  });

  let latestQuota: number | null = null;
  let latestVipExpireDate: string | null = null;

  for (let index = 0; index < MATRIX_PROFILES.length; index++) {
    const profile = MATRIX_PROFILES[index];
    state.suiteSlotStates![index] = 'loading';
    state.suiteSlotMessages![index] = '正在调用生图引擎...';
    await updateJob(env, jobId, {
      stage: 'generate',
      progress: 22 + index * 20,
      message: `营销矩阵顺序渲染中：正在处理第 ${index + 1}/3 张...`,
      state,
      result,
    });

    const prompt = buildEnhancedPrompt(
      payload.scenario,
      analysis,
      payload.userPrompt,
      payload.textConfig,
      payload.generationMode,
      payload.styleImageBase64,
      payload.visualDNA,
      profile.variationPrompt,
      payload.aspectRatio,
      payload.layout,
      undefined,
      payload.targetPlatform,
      profile.lockLevel
    );

    const startedAt = Date.now();
    try {
      const slotTraceId = `${payload.traceId}_slot_${index + 1}`;
      const generated = await requestImageWithFallback(request, authHeader, {
        userId: payload.userId,
        traceId: slotTraceId,
        sourceImageBase64: payload.sourceImageBase64,
        styleImageBase64: payload.styleImageBase64,
        prompt,
        aspectRatio: payload.aspectRatio,
        requestProfile: profile.requestProfile,
      });

      latestQuota = generated.image_quota;
      latestVipExpireDate = generated.vip_expire_date;
      result.images![index] = generated.image;
      result.fulfilledCount = (result.fulfilledCount || 0) + 1;
      state.suiteSlotStates![index] = 'success';
      state.suiteSlotMessages![index] = '生成成功 · 已扣 1 Token';
      if (index + 1 < MATRIX_PROFILES.length) {
        state.suiteSlotStates![index + 1] = 'queued';
        state.suiteSlotMessages![index + 1] = '等待上一张完成';
      }
      metrics.push({
        label: `第 ${index + 1} 张生图`,
        durationMs: Date.now() - startedAt,
        status: generated.model === (profile.requestProfile === 'stable' ? IMAGE_MODEL_CHAIN_STABLE[0] : IMAGE_MODEL_CHAIN_DEFAULT[0]) ? 'done' : 'fallback',
        detail: generated.model,
      });

      const outputId = await insertGenerationOutput(env, {
        jobId,
        userId: payload.userId,
        traceId: slotTraceId,
        slotIndex: index,
        mode: payload.mode,
        status: 'COMPLETED',
        imageUrl: generated.image,
        promptSnapshot: prompt,
        modelName: generated.model,
        chargedTokens: 1,
      });

      await insertGenerationChargeLedger(env, {
        jobId,
        userId: payload.userId,
        outputId,
        traceId: slotTraceId,
        slotIndex: index,
        actionType: 'CHARGE',
        tokenDelta: 1,
        reason: `营销矩阵第 ${index + 1} 张生成成功，扣除 1 Token`,
      });

      await updateJob(env, jobId, {
        progress: 30 + (index + 1) * 20,
        message: `营销矩阵顺序渲染中：已完成 ${(result.fulfilledCount || 0)}/${MATRIX_PROFILES.length}`,
        metrics,
        state,
        result: {
          ...result,
          image_quota: latestQuota,
          vip_expire_date: latestVipExpireDate,
        },
      });
    } catch (error: any) {
      result.failedCount = (result.failedCount || 0) + 1;
      state.suiteSlotStates![index] = 'error';
      state.suiteSlotMessages![index] = typeof error?.message === 'string' ? error.message : '该张因模型波动未完成，本次未扣费';
      metrics.push({
        label: `第 ${index + 1} 张生图`,
        durationMs: Date.now() - startedAt,
        status: 'failed',
        detail: state.suiteSlotMessages![index],
      });

      await insertGenerationOutput(env, {
        jobId,
        userId: payload.userId,
        traceId: `${payload.traceId}_slot_${index + 1}`,
        slotIndex: index,
        mode: payload.mode,
        status: 'FAILED',
        promptSnapshot: prompt,
        errorMessage: state.suiteSlotMessages![index],
        chargedTokens: 0,
      });

      await updateJob(env, jobId, {
        stage: 'retry',
        progress: 30 + index * 20,
        message: `第 ${index + 1} 张暂未完成，系统继续处理剩余图片...`,
        metrics,
        state,
        result,
      });
    }
  }

  const fulfilledCount = result.fulfilledCount || 0;
  const failedCount = result.failedCount || 0;
  if (fulfilledCount === 0) {
    throw new Error('营销矩阵 0/3 成功，未扣费。');
  }

  state.generationBillingSummary = failedCount > 0
    ? `营销矩阵成功 ${fulfilledCount}/3 张，已扣 ${fulfilledCount} Token；失败 ${failedCount} 张未扣费。`
    : '营销矩阵 3 张全部成功，已扣 3 Token。';

  await updateJob(env, jobId, {
    status: 'COMPLETED',
    stage: 'completed',
    progress: 100,
    message: failedCount > 0 ? `营销矩阵部分完成：${fulfilledCount}/3` : '营销矩阵云端生图已完成，正在等待前端精修输出...',
    metrics,
    state,
    result: {
      ...result,
      image_quota: latestQuota,
      vip_expire_date: latestVipExpireDate,
    },
    completedAt: nowIso(),
  });
}

async function processGenerationJob(
  context: { env: Env; request: Request },
  jobId: string,
  payload: GenerationJobPayload,
  authHeader: string | null
) {
  try {
    if (payload.mode === 'single') {
      await processSingleJob(context.env, context.request, authHeader, jobId, payload);
    } else {
      await processMatrixJob(context.env, context.request, authHeader, jobId, payload);
    }
  } catch (error: any) {
    await updateJob(context.env, jobId, {
      status: 'FAILED',
      stage: 'failed',
      progress: 100,
      message: '任务执行失败，请稍后重试',
      errorMessage: typeof error?.message === 'string' ? error.message : '任务执行失败',
      completedAt: nowIso(),
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context: { env: Env; request: Request; waitUntil?: (promise: Promise<any>) => void }) {
  const { env, request, waitUntil } = context;

  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return json({ success: false, error: 'INVALID_REQUEST', message: '请求体必须为 JSON' }, 400);
    }

    const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
    if (!userId) {
      return json({ success: false, error: 'MISSING_USER_ID', message: '缺少 userId' }, 400);
    }

    await verifyUserIdFromAuth(request, env, userId);
    await ensureGenerationJobsTable(env);
    await ensureGenerationCacheTable(env);

    const jobPayload: GenerationJobPayload = {
      userId,
      traceId: typeof payload.traceId === 'string' ? payload.traceId.trim() : createJobId(),
      mode: payload.mode === 'matrix' ? 'matrix' : 'single',
      sourceImageBase64: typeof payload.sourceImageBase64 === 'string' ? payload.sourceImageBase64 : '',
      styleImageBase64: typeof payload.styleImageBase64 === 'string' ? payload.styleImageBase64 : undefined,
      userPrompt: typeof payload.userPrompt === 'string' ? payload.userPrompt : '',
      textConfig: (payload.textConfig || {}) as TextConfig,
      aspectRatio: (payload.aspectRatio || '1:1') as AspectRatio,
      layout: (payload.layout || 'center') as CompositionLayout,
      generationMode: (payload.generationMode || 'creative') as GenerationMode,
      targetPlatform: typeof payload.targetPlatform === 'string' ? payload.targetPlatform : '通用电商',
      scenario: (payload.scenario || 'studio_white') as ScenarioType,
      visualDNA: payload.visualDNA ?? null,
      analysis: payload.analysis ?? null,
    };

    if (!jobPayload.sourceImageBase64) {
      return json({ success: false, error: 'MISSING_SOURCE_IMAGE', message: '缺少商品图' }, 400);
    }

    const jobId = createJobId();
    await insertJob(env, jobId, userId, jobPayload.traceId, jobPayload.mode);

    const authHeader = request.headers.get('Authorization');
    const runner = processGenerationJob({ env, request }, jobId, jobPayload, authHeader);
    if (typeof waitUntil === 'function') {
      waitUntil(runner);
    } else {
      void runner;
    }

    return json({
      success: true,
      jobId,
      traceId: jobPayload.traceId,
      status: 'QUEUED',
      stage: 'queued',
      progress: 4,
      message: '任务已创建，正在排队...',
    });
  } catch (error: any) {
    const failure = mapJobApiError(error, '任务创建失败，请稍后重试');
    return json({ success: false, error: failure.error, message: failure.message }, failure.status);
  }
}

export async function onRequestGet(context: { env: Env; request: Request }) {
  const { env, request } = context;

  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId')?.trim() || '';
    const userId = url.searchParams.get('userId')?.trim() || '';

    if (!jobId || !userId) {
      return json({ success: false, error: 'INVALID_REQUEST', message: '缺少 jobId 或 userId' }, 400);
    }

    await verifyUserIdFromAuth(request, env, userId);
    await ensureGenerationJobsTable(env);
    await ensureGenerationCacheTable(env);
    const row = await fetchJob(env, jobId, userId);
    if (!row) {
      return json({ success: false, error: 'NOT_FOUND', message: '任务不存在或已过期' }, 404);
    }

    return json(serializeJobRow(row), 200);
  } catch (error: any) {
    const failure = mapJobApiError(error, '任务查询失败，请稍后重试');
    return json({ success: false, error: failure.error, message: failure.message }, failure.status);
  }
}
