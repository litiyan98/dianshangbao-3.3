import React, { useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileStack,
  Images,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import {
  DetailPageBatchProgress,
  DetailPageModule,
  DetailPageReferenceImage,
  DetailPageReferenceStyle,
} from '../types';

interface DetailPagePlanPreviewProps {
  open: boolean;
  modules: DetailPageModule[];
  batchProgress: DetailPageBatchProgress;
  isPlanning: boolean;
  isGeneratingAssets: boolean;
  referenceStyle: DetailPageReferenceStyle | null;
  referenceImages: DetailPageReferenceImage[];
  onClose: () => void;
  onBackToWizard: () => void;
  onGenerateAssets: () => void;
  onOpenWorkbench: (moduleId?: string) => void;
}

const MODULE_USE_CASES: Record<
  DetailPageModule['type'],
  {
    icon: string;
    label: string;
    desc: string;
  }
> = {
  hero: { icon: '🌟', label: '封面图', desc: '先把商品印象立住' },
  selling_points: { icon: '✅', label: '核心卖点', desc: '把购买理由讲清楚' },
  scene: { icon: '🛋', label: '使用场景', desc: '让用户代入生活方式' },
  detail: { icon: '🔍', label: '细节展示', desc: '把材质和结构放大' },
  benefit: { icon: '✨', label: '价值说明', desc: '从功能走向体验感' },
  spec: { icon: '📏', label: '参数信息', desc: '把理性信息一次说透' },
  trust: { icon: '🛡', label: '信任背书', desc: '减少顾虑，补足安全感' },
  cta: { icon: '👉', label: '购买收口', desc: '最后一屏做转化收束' },
};

const PREVIEW_STATUS_META = {
  pending: {
    label: '等待规划',
    className: 'bg-stone-100 text-stone-500',
  },
  planning: {
    label: '规划中',
    className: 'bg-amber-50 text-amber-700',
  },
  planned: {
    label: '已规划',
    className: 'bg-sky-50 text-sky-700',
  },
  generating: {
    label: '生成中',
    className: 'bg-violet-50 text-violet-700',
  },
  ready: {
    label: '已完成',
    className: 'bg-emerald-50 text-emerald-700',
  },
  retry: {
    label: '需重试',
    className: 'bg-rose-50 text-rose-700',
  },
} as const;

type PreviewStatusKey = keyof typeof PREVIEW_STATUS_META;

function resolveModulePreviewStatus(module: DetailPageModule, isPlanning: boolean): PreviewStatusKey {
  if (module.status === 'error') return 'retry';
  if (module.status === 'loading') return isPlanning ? 'planning' : 'generating';
  if (module.assets.imageUrl) return 'ready';
  if (module.plan) return 'planned';
  return 'pending';
}

const DetailPagePlanPreview: React.FC<DetailPagePlanPreviewProps> = ({
  open,
  modules,
  batchProgress,
  isPlanning,
  isGeneratingAssets,
  referenceStyle,
  referenceImages,
  onClose,
  onBackToWizard,
  onGenerateAssets,
  onOpenWorkbench,
}) => {
  const plannedCount = useMemo(() => modules.filter((module) => Boolean(module.plan)).length, [modules]);
  const generatedCount = useMemo(() => modules.filter((module) => Boolean(module.assets.imageUrl)).length, [modules]);
  const retryCount = useMemo(() => modules.filter((module) => module.status === 'error').length, [modules]);
  const currentGeneratingModule = useMemo(
    () => modules.find((module) => module.id === batchProgress.currentModuleId) || null,
    [batchProgress.currentModuleId, modules]
  );
  const lastCompletedModule = useMemo(
    () => modules.find((module) => module.id === batchProgress.lastCompletedModuleId) || null,
    [batchProgress.lastCompletedModuleId, modules]
  );
  const lastFailedModule = useMemo(
    () => modules.find((module) => module.id === batchProgress.lastFailedModuleId) || null,
    [batchProgress.lastFailedModuleId, modules]
  );
  const progressPercent = useMemo(() => {
    const base = Math.max(modules.length, 1);
    if (batchProgress.isRunning || batchProgress.attemptedCount > 0) {
      const completed = batchProgress.attemptedCount + (batchProgress.currentModuleId ? 0.35 : 0);
      return Math.round((completed / Math.max(batchProgress.totalCount || base, 1)) * 100);
    }
    const completed = isGeneratingAssets || generatedCount > 0 ? generatedCount : plannedCount;
    return Math.round((completed / base) * 100);
  }, [
    batchProgress.attemptedCount,
    batchProgress.currentModuleId,
    batchProgress.isRunning,
    batchProgress.totalCount,
    generatedCount,
    isGeneratingAssets,
    modules.length,
    plannedCount,
  ]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[268] overflow-y-auto p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex min-h-full items-start justify-center md:items-center">
      <div className="relative my-4 flex w-full max-w-[1200px] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-[radial-gradient(circle_at_top_left,rgba(240,249,255,0.94),rgba(255,255,255,0.98)_38%,rgba(248,250,252,0.98)_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.18)] md:my-0 md:max-h-[calc(100dvh-3rem)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/90 text-stone-500 transition-colors hover:text-stone-900"
        >
          <X size={16} />
        </button>

        <div className="shrink-0 border-b border-stone-100 px-5 py-5 md:px-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500 shadow-sm">
                <FileStack size={12} />
                Detail Page Blueprint
              </div>
              <h2 className="mt-4 text-[26px] md:text-[28px] font-black tracking-tight text-[#1d1d1f]">
                8 屏用途确认与生成进度
              </h2>
              <p className="mt-2 max-w-3xl text-[14px] font-medium leading-6 text-stone-500">
                先确认 AI 拆出的 8 张分别是干什么的，再决定是否开始逐屏出图。你不需要先理解所有参数。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">已规划</p>
                <p className="mt-1.5 text-[20px] font-black text-stone-900">{plannedCount} / {modules.length}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">已出图</p>
                <p className="mt-1.5 text-[20px] font-black text-stone-900">{generatedCount} / {modules.length}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">待重试</p>
                <p className="mt-1.5 text-[20px] font-black text-stone-900">{retryCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-0 xl:grid-cols-[264px_minmax(0,1fr)]">
          <aside className="border-r border-stone-100 bg-white/65 px-5 py-5 overflow-y-auto">
            <div className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">当前状态</p>
              <div className="mt-4 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
                  {isPlanning ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                </div>
                <div>
                  <p className="text-[18px] font-black tracking-tight text-stone-900">
                    {isPlanning ? '正在拆解参考结构' : isGeneratingAssets ? '正在逐屏出图' : '可以开始逐屏生成'}
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-stone-500">
                    {isPlanning
                      ? '系统会先理解参考图的节奏、标题层级、图文密度和留白关系。'
                      : isGeneratingAssets
                        ? '系统会先优先生成前三屏，让你先看到关键结果；后 5 屏会继续往下跑。'
                        : '你可以先看 8 张的用途，再决定是一键开始逐屏出图，还是先进入编辑台。'}
                  </p>
                </div>
              </div>

              <div className="mt-5 h-2 rounded-full bg-stone-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-stone-900 via-sky-500 to-emerald-500 transition-all"
                  style={{ width: `${Math.max(8, progressPercent)}%` }}
                />
              </div>

              <div className="mt-5 space-y-3 text-[13px] leading-6 text-stone-500">
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <p className="font-black text-stone-900">前三屏优先</p>
                  <p className="mt-1">
                    已就绪 {batchProgress.priorityReadyCount}/{Math.max(batchProgress.priorityTotalCount, 3)} 屏
                    {batchProgress.isPriorityPhaseComplete ? '，你可以先开始看关键屏。' : '，系统会优先把封面、卖点、场景先做出来。'}
                  </p>
                </div>
                {currentGeneratingModule ? (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="font-black text-violet-800">当前正在生成</p>
                    <p className="mt-1 text-violet-700">
                      第 {currentGeneratingModule.order} 屏 · {currentGeneratingModule.name}
                    </p>
                  </div>
                ) : null}
                {lastCompletedModule ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="font-black text-emerald-800">刚完成一屏</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-emerald-700">
                        第 {lastCompletedModule.order} 屏 · {lastCompletedModule.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenWorkbench(lastCompletedModule.id)}
                        className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-emerald-700 transition hover:text-emerald-900"
                      >
                        先看这屏
                      </button>
                    </div>
                  </div>
                ) : null}
                {lastFailedModule ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <p className="font-black text-rose-800">最近失败</p>
                    <p className="mt-1 text-rose-700">
                      第 {lastFailedModule.order} 屏 · {lastFailedModule.name}，稍后可单独补跑。
                    </p>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <p className="font-black text-stone-900">默认节奏</p>
                  <p className="mt-1">先规划 8 屏，再逐屏完成。即使某一屏失败，也不会打断整套编辑。</p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <p className="font-black text-stone-900">参考来源</p>
                  <p className="mt-1">
                    {referenceImages.length > 0
                      ? `当前已载入 ${referenceImages.length} 张参考图，系统会优先按最匹配的参考样本映射到每一屏。`
                      : '当前未上传参考图，将按通用详情页策略进行规划。'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-stone-300 bg-white/75 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
                <Images size={13} />
                风格摘要
              </div>
              <div className="mt-3 space-y-2.5">
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <p className="text-[12px] font-bold text-stone-500">版式节奏</p>
                  <p className="mt-1 text-[13px] font-black text-stone-900">
                    {referenceStyle?.layoutRhythm || '首屏吸引，中段解释，尾屏收束'}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <p className="text-[12px] font-bold text-stone-500">光影与氛围</p>
                  <p className="mt-1 text-[13px] font-black text-stone-900">
                    {referenceStyle?.lightingStyle || '干净商业光影'}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-stone-500">
                    {referenceStyle?.atmosphere || '默认采用克制、干净、适合转化的详情页气质'}
                  </p>
                </div>
                <div className="rounded-2xl bg-stone-50 px-4 py-3">
                  <p className="text-[12px] font-bold text-stone-500">配色提示</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(referenceStyle?.palette || ['暖白', '炭黑', '柔金']).slice(0, 5).map((color) => (
                      <span
                        key={color}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-bold text-stone-700"
                      >
                        {color}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onGenerateAssets}
                disabled={isPlanning || isGeneratingAssets || plannedCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-[14px] font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingAssets ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {isGeneratingAssets ? '正在逐屏出图' : '开始逐屏出图'}
              </button>
              <button
                type="button"
                onClick={() => onOpenWorkbench()}
                disabled={isPlanning || plannedCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-[14px] font-bold text-stone-700 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Eye size={15} />
                进入编辑台
              </button>
              <button
                type="button"
                onClick={onBackToWizard}
                disabled={isPlanning || isGeneratingAssets}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-white/80 px-5 py-3 text-[14px] font-bold text-stone-500 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowLeft size={15} />
                返回向导
              </button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-col px-6 py-6 md:px-8">
            <div className="mb-5 shrink-0 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">8 张用途卡</p>
                <p className="mt-1 text-[14px] font-medium text-stone-500">
                  用更直观的用途卡告诉用户每一屏要做什么，而不是先扔给他一堆内部术语。
                </p>
              </div>
              {!isPlanning && generatedCount > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-700">
                  <CheckCircle2 size={14} />
                  当前已生成 {generatedCount} 屏
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {modules.map((module) => {
                const meta = MODULE_USE_CASES[module.type];
                const previewStatus = resolveModulePreviewStatus(module, isPlanning);
                const statusMeta = PREVIEW_STATUS_META[previewStatus];
                const selectedReference =
                  referenceImages.find((item) => item.id === module.assets.referenceImageId) || referenceImages[0] || null;
                const isCurrentGenerating = module.id === batchProgress.currentModuleId;
                const isLastCompleted = module.id === batchProgress.lastCompletedModuleId;
                const isLastFailed = module.id === batchProgress.lastFailedModuleId;
                const isPriorityModule = module.order <= 3;

                return (
                  <div
                    key={module.id}
                    className={`rounded-[1.75rem] border bg-white p-5 shadow-sm transition hover:border-stone-300 ${
                      isCurrentGenerating
                        ? 'border-violet-300 ring-1 ring-violet-200'
                        : isLastCompleted
                          ? 'border-emerald-300 ring-1 ring-emerald-200'
                          : isLastFailed
                            ? 'border-rose-300 ring-1 ring-rose-200'
                            : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
                          0{module.order}
                        </p>
                        <h3 className="mt-2 text-[20px] font-black tracking-tight text-stone-900">
                          {meta.icon} {meta.label}
                        </h3>
                        <p className="mt-1 text-[13px] leading-6 text-stone-500">{meta.desc}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    {(isCurrentGenerating || isLastCompleted || isLastFailed) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isPriorityModule ? (
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-700">
                            前三屏优先
                          </span>
                        ) : null}
                        {isCurrentGenerating ? (
                          <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">
                            当前生成
                          </span>
                        ) : null}
                        {isLastCompleted ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                            刚完成
                          </span>
                        ) : null}
                        {isLastFailed ? (
                          <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700">
                            最近失败
                          </span>
                        ) : null}
                      </div>
                    ) : isPriorityModule ? (
                      <div className="mt-3">
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-700">
                          前三屏优先
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl bg-stone-50 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">这一屏要做什么</p>
                        <p className="mt-2 text-[14px] font-black text-stone-900">
                          {module.plan?.objective || module.title}
                        </p>
                        <p className="mt-1 text-[12px] leading-5 text-stone-500">
                          {module.plan?.copyTask || module.copyGoal}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">参考映射</p>
                          <p className="mt-2 text-[13px] font-black text-stone-900">
                            {selectedReference?.label || '自动映射'}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-stone-500">
                            {module.plan?.referenceHint || '默认参考整组节奏与样式'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">版式提示</p>
                          <p className="mt-2 text-[13px] font-black text-stone-900">
                            {module.plan?.layoutPreset || module.layoutPreset}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-stone-500">
                            {module.plan?.visualTask || module.imageGoal}
                          </p>
                        </div>
                      </div>

                      {module.assets.errorMessage ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] leading-5 text-rose-700">
                          {module.assets.errorMessage}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="text-[12px] text-stone-500">
                          {module.assets.imageUrl
                            ? '这一屏已经生成完成，可以直接去编辑台继续微调。'
                            : previewStatus === 'planned'
                              ? '规划已完成，准备进入逐屏生成。'
                              : previewStatus === 'generating'
                                ? '系统正在执行当前屏的文案和视觉生成。'
                                : previewStatus === 'retry'
                                  ? '这一屏本轮失败，稍后可单独补跑。'
                                  : '系统正在给这一屏分配位置和任务。'}
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenWorkbench(module.id)}
                          disabled={isPlanning}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-[12px] font-bold text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Eye size={14} />
                          查看此屏
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </main>
        </div>
      </div>
      </div>
    </div>
  );
};

export default DetailPagePlanPreview;
