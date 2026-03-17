import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Download,
  FileStack,
  ImagePlus,
  Images,
  LayoutTemplate,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  DetailPageBatchProgress,
  DetailPageModule,
  DetailPageModuleAssets,
  DetailPageModuleStatus,
  DetailPagePlatform,
  DetailPageReferenceImage,
  DetailPageReferenceStyle,
  DetailPageStyle,
} from '../types';

interface DetailPageWorkbenchProps {
  open: boolean;
  platform: DetailPagePlatform;
  style: DetailPageStyle;
  pageCount: number;
  modules: DetailPageModule[];
  batchProgress: DetailPageBatchProgress;
  activeModuleId: string | null;
  isPlanning: boolean;
  isGeneratingAssets: boolean;
  isUploadingReferences: boolean;
  referenceStyle: DetailPageReferenceStyle | null;
  referenceImages: DetailPageReferenceImage[];
  onClose: () => void;
  onSelectModule: (moduleId: string) => void;
  onPlanStructure: () => void;
  onGenerateAssets: () => void;
  onRegenerateModule: (moduleId: string) => void;
  onExportModule: (moduleId: string) => void;
  onExportSuite: () => void;
  onResetPlan: () => void;
  onUpdateModuleAssets: (moduleId: string, patch: Partial<DetailPageModuleAssets>) => void;
  onAddReferenceImages: (files: File[]) => void;
  onRemoveReferenceImage: (referenceId: string) => void;
  onAssignReferenceToModule: (moduleId: string, referenceId: string | null) => void;
}

const STATUS_META: Record<DetailPageModuleStatus, { label: string; className: string }> = {
  idle: {
    label: '待处理',
    className: 'bg-stone-100 text-stone-500',
  },
  loading: {
    label: '执行中',
    className: 'bg-violet-50 text-violet-600',
  },
  success: {
    label: '已完成',
    className: 'bg-emerald-50 text-emerald-600',
  },
  error: {
    label: '需重试',
    className: 'bg-rose-50 text-rose-600',
  },
};

const MODULE_TYPE_COPY: Record<DetailPageModule['type'], string> = {
  hero: '首屏吸引点击与建立商品印象',
  selling_points: '快速拆解高频卖点与购买理由',
  scene: '建立使用场景与生活方式联想',
  detail: '放大材质、工艺、成分或结构细节',
  benefit: '补足功能价值、体验感或对比信息',
  spec: '输出规格、容量、尺寸与参数信息',
  trust: '承接质检、售后、发货与服务承诺',
  cta: '总结购买理由并形成最终转化收口',
};

const DetailPageWorkbench: React.FC<DetailPageWorkbenchProps> = ({
  open,
  platform,
  style,
  pageCount,
  modules,
  batchProgress,
  activeModuleId,
  isPlanning,
  isGeneratingAssets,
  isUploadingReferences,
  referenceStyle,
  referenceImages,
  onClose,
  onSelectModule,
  onPlanStructure,
  onGenerateAssets,
  onRegenerateModule,
  onExportModule,
  onExportSuite,
  onResetPlan,
  onUpdateModuleAssets,
  onAddReferenceImages,
  onRemoveReferenceImage,
  onAssignReferenceToModule,
}) => {
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);

  useEffect(() => {
    setShowAdvancedEditor(false);
  }, [activeModuleId, open]);

  if (!open) return null;

  const activeModule = modules.find((module) => module.id === activeModuleId) || modules[0] || null;
  const completedCount = modules.filter((module) => module.status === 'success').length;
  const generatedCount = modules.filter((module) => Boolean(module.assets.imageUrl)).length;
  const activeReferenceId = activeModule?.assets.referenceImageId || referenceImages[0]?.id || null;
  const activeReference = referenceImages.find((item) => item.id === activeReferenceId) || referenceImages[0] || null;
  const hasActivePlan = Boolean(activeModule?.plan);
  const hasActiveImage = Boolean(activeModule?.assets.imageUrl);
  const activeModuleNeedsRetry = activeModule?.status === 'error';
  const currentGeneratingModule = modules.find((module) => module.id === batchProgress.currentModuleId) || null;
  const lastCompletedModule = modules.find((module) => module.id === batchProgress.lastCompletedModuleId) || null;
  const lastFailedModule = modules.find((module) => module.id === batchProgress.lastFailedModuleId) || null;

  return (
    <div className="fixed inset-0 z-[270] overflow-y-auto p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex min-h-full items-start justify-center md:items-center">
      <div className="relative my-4 flex w-full max-w-[1320px] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] md:my-0 md:max-h-[calc(100dvh-3rem)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 z-20 h-10 w-10 rounded-full border border-stone-200 bg-white/95 text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-center"
        >
          <X size={16} />
        </button>

        <div className="shrink-0 px-5 md:px-7 py-5 border-b border-stone-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pr-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold tracking-[0.18em] uppercase text-stone-500">
                <LayoutTemplate size={12} />
                Detail Page Engine
              </div>
              <h2 className="mt-4 text-[24px] md:text-[28px] font-black text-[#1d1d1f] tracking-tight">8 屏详情页编辑台</h2>
              <p className="mt-2 text-[14px] md:text-[15px] text-stone-500 font-medium max-w-3xl">
                这里会先展示 8 屏结构，再逐屏出图。你可以边看边改，不需要一次理解所有配置。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:min-w-[340px] lg:grid-cols-4">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-stone-400">平台</p>
                <p className="mt-2 text-[15px] font-black text-stone-900">{platform === 'universal' ? '通用混合版' : platform}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-stone-400">风格</p>
                <p className="mt-2 text-[15px] font-black text-stone-900">{style === 'hybrid' ? '混合转化' : style}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-stone-400">已规划</p>
                <p className="mt-2 text-[15px] font-black text-stone-900">{completedCount} / {pageCount}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-stone-400">已出图</p>
                <p className="mt-2 text-[15px] font-black text-stone-900">{generatedCount} / {pageCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[228px_minmax(0,1fr)_320px] overflow-hidden">
          <aside className="border-r border-stone-100 bg-stone-50/70 px-5 py-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-400">页面结构</p>
                <p className="mt-1 text-[13px] text-stone-500">先看结构，再逐屏生成与编辑</p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-700">
                <FileStack size={18} />
              </div>
            </div>
            <div className="space-y-2">
              {modules.map((module) => {
                const statusMeta = STATUS_META[module.status];
                const isActive = module.id === activeModuleId;
                const isCurrentGenerating = module.id === batchProgress.currentModuleId;
                const isLastCompleted = module.id === batchProgress.lastCompletedModuleId;
                const isLastFailed = module.id === batchProgress.lastFailedModuleId;
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => onSelectModule(module.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                      isActive
                        ? 'border-stone-900 bg-white shadow-sm'
                        : isCurrentGenerating
                          ? 'border-violet-300 bg-white shadow-sm'
                          : isLastCompleted
                            ? 'border-emerald-300 bg-white shadow-sm'
                            : isLastFailed
                              ? 'border-rose-300 bg-white shadow-sm'
                              : 'border-stone-200 bg-white/80 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-stone-400">0{module.order}</p>
                        <p className="mt-2 text-[15px] font-black text-stone-900">{module.name}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="mt-3 text-[12px] leading-5 text-stone-500">{MODULE_TYPE_COPY[module.type]}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <div className="inline-flex rounded-full bg-[#eef2ff] px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase text-[#4f46e5]">
                        真实生成
                      </div>
                      {module.order <= 3 ? (
                        <div className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase text-stone-700">
                          前三屏优先
                        </div>
                      ) : null}
                      {isCurrentGenerating ? (
                        <div className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase text-violet-700">
                          当前生成
                        </div>
                      ) : null}
                      {isLastCompleted ? (
                        <div className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase text-emerald-700">
                          刚完成
                        </div>
                      ) : null}
                      {isLastFailed ? (
                        <div className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase text-rose-700">
                          最近失败
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto px-6 md:px-8 py-6 bg-white">
            {activeModule ? (
              <div className="h-full flex flex-col">
                {(currentGeneratingModule || lastCompletedModule || lastFailedModule) ? (
                  <div className="mb-5 rounded-[1.75rem] border border-stone-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">逐屏进度</p>
                        <p className="mt-2 text-[18px] font-black tracking-tight text-stone-900">
                          {batchProgress.isRunning
                            ? `已完成 ${batchProgress.successCount}/${Math.max(batchProgress.totalCount, modules.length)} 屏`
                            : `本轮完成 ${batchProgress.successCount}/${Math.max(batchProgress.totalCount, modules.length)} 屏`}
                        </p>
                        <p className="mt-2 text-[13px] leading-6 text-stone-500">
                          {currentGeneratingModule
                            ? `当前正在第 ${currentGeneratingModule.order} 屏 · ${currentGeneratingModule.name}`
                            : lastFailedModule
                              ? `最近失败的是第 ${lastFailedModule.order} 屏 · ${lastFailedModule.name}`
                              : lastCompletedModule
                                ? `刚完成的是第 ${lastCompletedModule.order} 屏 · ${lastCompletedModule.name}`
                                : '可以继续查看当前屏，或切到其他刚完成的屏。'}
                        </p>
                        <p className="mt-2 text-[12px] leading-5 text-stone-500">
                          前三屏优先已就绪 {batchProgress.priorityReadyCount}/{Math.max(batchProgress.priorityTotalCount, 3)} 屏
                          {batchProgress.isPriorityPhaseComplete ? '，后 5 屏正在后台续跑。' : '，系统会先把封面、卖点、场景先做出来。'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lastCompletedModule ? (
                          <button
                            type="button"
                            onClick={() => onSelectModule(lastCompletedModule.id)}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700 transition hover:text-emerald-900"
                          >
                            去看刚完成
                          </button>
                        ) : null}
                        {lastFailedModule ? (
                          <button
                            type="button"
                            onClick={() => onSelectModule(lastFailedModule.id)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700 transition hover:text-rose-900"
                          >
                            去看失败屏
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-stone-400">0{activeModule.order} / {activeModule.type}</p>
                    <h3 className="mt-2 text-[28px] font-black tracking-tight text-[#1d1d1f]">{activeModule.assets.headline || activeModule.title}</h3>
                    <p className="mt-2 text-[14px] text-stone-500 max-w-2xl">
                      {activeModule.assets.subheadline || activeModule.plan?.headlineDirection || activeModule.copyGoal}
                    </p>
                  </div>
                  <div className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${STATUS_META[activeModule.status].className}`}>
                    {STATUS_META[activeModule.status].label}
                  </div>
                </div>

                <div className="flex-1 rounded-[2rem] border border-stone-200 bg-[linear-gradient(180deg,#fcfcfd_0%,#f6f7fb_100%)] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="h-full p-8 flex flex-col gap-6">
                    <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-stone-400">
                      <Sparkles size={14} />
                      Screen Preview
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 flex-1 min-h-0">
                      <div className="rounded-[1.75rem] border border-stone-200 bg-white/90 p-5 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">视觉结果</p>
                            <p className="mt-1 text-[13px] text-stone-500">可在这里预览当前屏的真实生成结果，并导出成品图。</p>
                          </div>
                          <div className="rounded-full bg-stone-100 px-3 py-2 text-[12px] font-bold text-stone-600">
                            {hasActiveImage
                              ? '满意就导出，不满意再补跑'
                              : activeModuleNeedsRetry
                                ? '这一屏本轮失败，可立即补跑'
                                : hasActivePlan
                                  ? '规划已就绪，等待出图'
                                  : '先生成 8 屏结构'}
                          </div>
                        </div>

                        <div className="mt-5 flex-1 rounded-[1.5rem] border border-stone-200 bg-stone-50/80 overflow-hidden flex items-center justify-center min-h-[420px]">
                          {activeModule.assets.imageUrl ? (
                            <img
                              src={activeModule.assets.imageUrl}
                              alt={activeModule.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="px-8 text-center">
                              <div className="mx-auto h-14 w-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-stone-400">
                                <ImagePlus size={22} />
                              </div>
                              <p className="mt-4 text-[16px] font-black text-stone-900">当前屏还没有生成视觉图</p>
                              <p className="mt-2 text-[13px] leading-6 text-stone-500 max-w-md">
                                先点击右侧“开始逐屏出图”，或者直接重生成当前屏。
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[1.5rem] border border-stone-200 bg-white/85 px-5 py-5 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">当前屏动作</p>
                              <p className="mt-2 text-[18px] font-black tracking-tight text-stone-900">
                                {hasActiveImage
                                  ? '当前屏结果已就绪'
                                  : activeModuleNeedsRetry
                                    ? '当前屏需要补跑'
                                    : hasActivePlan
                                      ? '当前屏等待出图'
                                      : '当前屏还未规划'}
                              </p>
                              <p className="mt-2 text-[13px] leading-6 text-stone-500">
                                {hasActiveImage
                                  ? '先看这张结果，满意就直接导出；如果风格还不够像参考，再补跑这一屏。'
                                  : activeModuleNeedsRetry
                                    ? '这次失败不会影响其他屏。你可以先补跑当前屏，再继续看整套。'
                                    : hasActivePlan
                                      ? '当前屏的规划已经完成。可以先生成这一屏，也可以开始整套逐屏出图。'
                                      : '这一屏还没有结构规划，先生成 8 屏结构后再继续。'}
                              </p>
                            </div>
                            <div className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${STATUS_META[activeModule.status].className}`}>
                              {STATUS_META[activeModule.status].label}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {hasActiveImage ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onExportModule(activeModule.id)}
                                  disabled={isPlanning || !hasActiveImage}
                                  className="h-11 rounded-2xl bg-stone-900 text-white font-bold text-[14px] shadow-sm hover:bg-stone-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  <Download size={15} />
                                  导出当前屏
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRegenerateModule(activeModule.id)}
                                  disabled={isPlanning || isGeneratingAssets}
                                  className="h-11 rounded-2xl border border-stone-200 bg-white text-stone-700 font-bold text-[14px] hover:border-stone-300 hover:text-stone-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  <RefreshCw size={15} />
                                  重生成当前屏
                                </button>
                              </>
                            ) : hasActivePlan ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onRegenerateModule(activeModule.id)}
                                  disabled={isPlanning || isGeneratingAssets}
                                  className="h-11 rounded-2xl bg-stone-900 text-white font-bold text-[14px] shadow-sm hover:bg-stone-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  <RefreshCw size={15} />
                                  先生成这一屏
                                </button>
                                <button
                                  type="button"
                                  onClick={onGenerateAssets}
                                  disabled={isPlanning || isGeneratingAssets}
                                  className="h-11 rounded-2xl border border-stone-200 bg-white text-stone-700 font-bold text-[14px] hover:border-stone-300 hover:text-stone-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  <Sparkles size={15} />
                                  开始逐屏出图
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={onPlanStructure}
                                disabled={isPlanning || isGeneratingAssets}
                                className="sm:col-span-2 h-11 rounded-2xl bg-stone-900 text-white font-bold text-[14px] shadow-sm hover:bg-stone-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                <Wand2 size={15} />
                                先生成 8 屏结构
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 px-5 py-5 shadow-sm">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">文案资产</p>
                          <p className="mt-3 text-[24px] font-black tracking-tight text-stone-900">
                            {activeModule.assets.headline || activeModule.plan?.objective || activeModule.title}
                          </p>
                          <p className="mt-3 text-[14px] leading-7 text-stone-500">
                            {activeModule.assets.subheadline || activeModule.assets.body || activeModule.plan?.copyTask || activeModule.copyGoal}
                          </p>
                          {activeModule.assets.sellingPoints.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {activeModule.assets.sellingPoints.map((item, index) => (
                                <span
                                  key={`${activeModule.id}-point-${index}`}
                                  className="rounded-full bg-stone-100 px-3 py-1.5 text-[12px] font-bold text-stone-600"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-white/60 px-5 py-5">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">规划说明</p>
                          <div className="mt-3 space-y-3 text-[13px] leading-6 text-stone-500">
                            <p><span className="font-bold text-stone-700">版式：</span>{activeModule.plan?.layoutPreset || activeModule.layoutPreset}</p>
                            <p><span className="font-bold text-stone-700">参考：</span>{activeModule.plan?.referenceHint || '暂无参考拆解结果，使用通用详情页策略。'}</p>
                            <p><span className="font-bold text-stone-700">当前参考屏：</span>{referenceImages.find((item) => item.id === activeReferenceId)?.label || '默认参考样本'}</p>
                            <p><span className="font-bold text-stone-700">色调：</span>{activeModule.plan?.toneHint || activeModule.assets.toneNotes || '沿用全局输入'}</p>
                          </div>
                        </div>

                        {activeModule.assets.errorMessage ? (
                          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-[13px] leading-6 text-rose-600">
                            {activeModule.assets.errorMessage}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </main>

          <aside className="min-h-0 overflow-y-auto border-l border-stone-100 bg-stone-50/60 px-5 py-6">
            {activeModule ? (
              <>
                <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
                  <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-400">参考风格摘要</p>
                  <h4 className="mt-3 text-[18px] font-black tracking-tight text-stone-900">
                    {referenceStyle?.pageStyle || '等待解析参考详情图'}
                  </h4>
                  <p className="mt-3 text-[13px] leading-6 text-stone-500">
                    {referenceStyle
                      ? `${referenceStyle.atmosphere} · ${referenceStyle.layoutRhythm}`
                      : '当前会先使用通用混合版策略。规划完成后，这里会展示整体风格摘要。'}
                  </p>
                  {referenceStyle?.palette?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {referenceStyle.palette.slice(0, 4).map((token, index) => (
                        <span key={`palette-${index}`} className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">
                          {token}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-400">参考样本库</p>
                      <p className="mt-1 text-[13px] leading-6 text-stone-500">先选“当前更像哪张”，再考虑更细的文案和风格微调。</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center text-stone-500">
                      <Images size={18} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {referenceImages.map((reference) => {
                      const isSelected = reference.id === activeReferenceId;
                      return (
                        <button
                          key={reference.id}
                          type="button"
                          onClick={() => onAssignReferenceToModule(activeModule.id, reference.id)}
                          className={`group relative overflow-hidden rounded-2xl border text-left transition-all ${isSelected ? 'border-stone-900 shadow-sm ring-1 ring-stone-300' : 'border-stone-200 hover:border-stone-300'}`}
                        >
                          <div className="aspect-[3/4] bg-stone-100">
                            <img src={reference.url} alt={reference.label} className="w-full h-full object-cover" />
                          </div>
                          <div className="px-3 py-2 bg-white">
                            <p className="text-[11px] font-black text-stone-900">{reference.label}</p>
                            <p className="mt-1 text-[10px] text-stone-500 line-clamp-2">{reference.visualDNA?.atmosphere || '待提取风格 DNA'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveReferenceImage(reference.id);
                            }}
                            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </button>
                      );
                    })}

                    <label className="aspect-[3/4] rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 hover:bg-stone-50 flex flex-col items-center justify-center gap-2 cursor-pointer text-stone-500 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          if (files.length > 0) onAddReferenceImages(files);
                          event.currentTarget.value = '';
                        }}
                      />
                      {isUploadingReferences ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                      <span className="text-[11px] font-bold">添加参考</span>
                    </label>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
                  <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-400">当前屏编辑</p>
                  <p className="mt-2 text-[13px] leading-6 text-stone-500">
                    默认先改这几项就够了：当前参考、标题、副标题、卖点。高级参数折叠在下面。
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">当前参考</p>
                          <p className="mt-1 text-[14px] font-black text-stone-900">{activeReference?.label || '默认参考样本'}</p>
                          <p className="mt-1 text-[12px] leading-5 text-stone-500">
                            {activeReference?.visualDNA?.atmosphere || '可以在上方样本库切换，让这一屏更像某一张参考图。'}
                          </p>
                        </div>
                        {activeReference ? (
                          <div className="h-14 w-12 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
                            <img src={activeReference.url} alt={activeReference.label} className="h-full w-full object-cover" />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">标题</span>
                      <input
                        value={activeModule.assets.headline}
                        onChange={(event) => onUpdateModuleAssets(activeModule.id, { headline: event.target.value })}
                        className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                        placeholder="生成后可手动改标题"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">副标题</span>
                      <input
                        value={activeModule.assets.subheadline}
                        onChange={(event) => onUpdateModuleAssets(activeModule.id, { subheadline: event.target.value })}
                        className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                        placeholder="生成后可手动改副标题"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">卖点</span>
                      <textarea
                        value={activeModule.assets.sellingPoints.join('\n')}
                        onChange={(event) =>
                          onUpdateModuleAssets(activeModule.id, {
                            sellingPoints: event.target.value
                              .split('\n')
                              .map((item) => item.trim())
                              .filter(Boolean)
                              .slice(0, 6),
                          })
                        }
                        className="mt-2 min-h-[84px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-[14px] leading-6 text-stone-900 outline-none focus:border-stone-400 resize-y"
                        placeholder="一行一个卖点"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowAdvancedEditor((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-left transition hover:border-stone-300"
                    >
                      <div>
                        <p className="text-[12px] font-black text-stone-900">高级微调</p>
                        <p className="mt-1 text-[12px] leading-5 text-stone-500">
                          需要更细控制时，再展开说明文案、风格备注、色调备注和视觉提示词。
                        </p>
                      </div>
                      <div className="shrink-0 text-stone-500">
                        {showAdvancedEditor ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {showAdvancedEditor ? (
                      <div className="space-y-4 rounded-[1.5rem] border border-stone-200 bg-stone-50/70 px-4 py-4">
                        <label className="block">
                          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">说明文案</span>
                          <textarea
                            value={activeModule.assets.body}
                            onChange={(event) => onUpdateModuleAssets(activeModule.id, { body: event.target.value })}
                            className="mt-2 min-h-[92px] w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-[14px] leading-6 text-stone-900 outline-none focus:border-stone-400 resize-y"
                            placeholder="这里承接这一屏的主要文案"
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">风格备注</span>
                            <input
                              value={activeModule.assets.styleNotes}
                              onChange={(event) => onUpdateModuleAssets(activeModule.id, { styleNotes: event.target.value })}
                              className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                              placeholder="例如：留白更克制"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">色调备注</span>
                            <input
                              value={activeModule.assets.toneNotes}
                              onChange={(event) => onUpdateModuleAssets(activeModule.id, { toneNotes: event.target.value })}
                              className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                              placeholder="例如：暖米色+柔光"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">视觉提示词</span>
                          <textarea
                            value={activeModule.assets.generatedPrompt}
                            onChange={(event) => onUpdateModuleAssets(activeModule.id, { generatedPrompt: event.target.value })}
                            className="mt-2 min-h-[120px] w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-[13px] leading-6 text-stone-900 outline-none focus:border-stone-400 resize-y"
                            placeholder="这里会自动生成当前屏的视觉 prompt，也可以手动微调后重生成"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
                  <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-400">整套操作</p>
                  <p className="mt-2 text-[13px] leading-6 text-stone-500">
                    当前屏的补跑和导出已经放到中间结果区。这里保留整套级动作，避免操作顺序混乱。
                  </p>

                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={onPlanStructure}
                      disabled={isPlanning || isGeneratingAssets}
                      className="h-12 w-full rounded-2xl bg-[#111827] text-white font-bold text-[15px] shadow-lg hover:bg-[#1a2333] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isPlanning ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      {isPlanning ? '正在生成 8 屏结构...' : '重新规划 8 屏结构'}
                    </button>

                    <button
                      type="button"
                      onClick={onGenerateAssets}
                      disabled={isPlanning || isGeneratingAssets}
                      className="h-12 w-full rounded-2xl border border-stone-200 bg-white text-stone-700 font-bold text-[15px] hover:border-stone-300 hover:text-stone-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isGeneratingAssets ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {isGeneratingAssets ? '正在逐屏出图...' : '开始逐屏出图'}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={onExportSuite}
                        disabled={isPlanning || isGeneratingAssets || generatedCount === 0}
                        className="h-11 rounded-2xl border border-stone-200 bg-white text-stone-600 font-bold text-[14px] hover:border-stone-300 hover:text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Images size={15} />
                        导出整套
                      </button>

                      <button
                        type="button"
                        onClick={onResetPlan}
                        className="h-11 rounded-2xl border border-stone-200 bg-white text-stone-600 font-bold text-[14px] hover:border-stone-300 hover:text-stone-900 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={15} />
                        重置模板
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </div>
      </div>
    </div>
  );
};

export default DetailPageWorkbench;
