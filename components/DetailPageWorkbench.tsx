import React from 'react';
import {
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

const STEP_META = [
  {
    step: '01',
    title: '挑参考',
    description: '先上传参考详情图，告诉系统整体想复刻的版式和气质。',
  },
  {
    step: '02',
    title: '排结构',
    description: '先规划 8 屏职责，再把参考样式映射到可控模板。',
  },
  {
    step: '03',
    title: '逐屏出图',
    description: '当前屏优先，可单独生成、重试和导出，不必整套一起等。',
  },
] as const;

function formatPlatform(platform: DetailPagePlatform) {
  return platform === 'universal' ? '通用混合版' : platform;
}

function formatStyle(style: DetailPageStyle) {
  return style === 'hybrid' ? '混合转化' : style;
}

const DetailPageWorkbench: React.FC<DetailPageWorkbenchProps> = ({
  open,
  platform,
  style,
  pageCount,
  modules,
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
  if (!open) return null;

  const activeModule = modules.find((module) => module.id === activeModuleId) || modules[0] || null;
  const plannedCount = modules.filter((module) => Boolean(module.plan)).length;
  const generatedCount = modules.filter((module) => Boolean(module.assets.imageUrl)).length;
  const finishedCount = modules.filter((module) => module.status === 'success').length;
  const activeReferenceId = activeModule?.assets.referenceImageId || referenceImages[0]?.id || null;
  const activeReference = referenceImages.find((item) => item.id === activeReferenceId) || referenceImages[0] || null;

  if (!activeModule) return null;

  const activeStatus = STATUS_META[activeModule.status];
  const hasGeneratedImage = Boolean(activeModule.assets.imageUrl);
  const toneSummary = activeModule.plan?.toneHint || activeModule.assets.toneNotes || '沿用全局输入';
  const referenceSummary = activeModule.plan?.referenceHint || '当前会优先沿用通用 8 屏骨架，再吸收参考图的版式节奏。';

  return (
    <div className="fixed inset-0 z-[270] flex items-center justify-center p-3 md:p-6">
      <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[min(94vh,980px)] w-full max-w-[1520px] flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-500 transition-colors hover:text-stone-900"
        >
          <X size={16} />
        </button>

        <div className="border-b border-stone-100 px-5 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-5 pr-12 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                <LayoutTemplate size={12} />
                Detail Page Engine
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-[#1d1d1f] md:text-3xl">参考图复刻详情页工作台</h2>
              <p className="mt-2 text-[14px] font-medium leading-6 text-stone-500 md:text-[15px]">
                先学参考图的结构、色调和留白节奏，再把新商品映射到固定 8 屏模板里，当前屏可随时单独微调与重跑。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:min-w-[520px]">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">平台</p>
                <p className="mt-2 text-[15px] font-black text-stone-900">{formatPlatform(platform)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">风格</p>
                <p className="mt-2 text-[15px] font-black text-stone-900">{formatStyle(style)}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">已规划</p>
                <p className="mt-2 text-[15px] font-black text-stone-900">{plannedCount} / {pageCount}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">已出图</p>
                <p className="mt-2 text-[15px] font-black text-stone-900">{generatedCount} / {pageCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {STEP_META.map((item, index) => {
              const isDone = index === 0 ? referenceImages.length > 0 : index === 1 ? plannedCount > 0 : finishedCount > 0;
              return (
                <div key={item.step} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-2xl text-[12px] font-black ${isDone ? 'bg-[#111827] text-white' : 'bg-white text-stone-500 border border-stone-200'}`}>
                      {item.step}
                    </div>
                    <div>
                      <p className="text-[15px] font-black text-stone-900">{item.title}</p>
                      <p className="mt-1 text-[12px] leading-5 text-stone-500">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-r border-stone-100 bg-stone-50/75 px-4 py-5 md:px-5 xl:overflow-y-auto">
            <div className="rounded-[1.75rem] border border-stone-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">步骤 1 / 参考样本</p>
                  <p className="mt-2 text-[15px] font-black text-stone-900">上传参考详情图</p>
                  <p className="mt-2 text-[12px] leading-5 text-stone-500">
                    当前屏可指定更像哪一张参考图，系统只学版式和风格，不学对方商品。
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-500">
                  <Images size={18} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {referenceImages.map((reference) => {
                  const isSelected = reference.id === activeReferenceId;
                  return (
                    <div
                      key={reference.id}
                      className={`group relative overflow-hidden rounded-2xl border bg-white transition-all ${isSelected ? 'border-stone-900 ring-1 ring-stone-300 shadow-sm' : 'border-stone-200 hover:border-stone-300'}`}
                    >
                      <button
                        type="button"
                        onClick={() => onAssignReferenceToModule(activeModule.id, reference.id)}
                        className="block w-full text-left"
                      >
                      <div className="aspect-[3/4] bg-stone-100">
                        <img src={reference.url} alt={reference.label} className="h-full w-full object-cover" />
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-[11px] font-black text-stone-900">{reference.label}</p>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-stone-500">
                          {reference.visualDNA?.atmosphere || '待提取风格 DNA'}
                        </p>
                      </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveReferenceImage(reference.id)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}

                <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 text-stone-500 transition-colors hover:bg-stone-50">
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

            <div className="mt-4 rounded-[1.75rem] border border-stone-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">步骤 2 / 页面结构</p>
                  <p className="mt-2 text-[15px] font-black text-stone-900">固定 8 屏，可逐屏聚焦</p>
                  <p className="mt-2 text-[12px] leading-5 text-stone-500">
                    左侧只看屏序号、状态和目标，减少噪音。当前屏的所有编辑都放到右侧聚焦处理。
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-700">
                  <FileStack size={18} />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {modules.map((module) => {
                  const statusMeta = STATUS_META[module.status];
                  const isActive = module.id === activeModuleId;
                  const hasImage = Boolean(module.assets.imageUrl);
                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => onSelectModule(module.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${isActive ? 'border-stone-900 bg-stone-950 text-white shadow-sm' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isActive ? 'text-white/50' : 'text-stone-400'}`}>0{module.order}</p>
                          <p className={`mt-2 text-[15px] font-black ${isActive ? 'text-white' : 'text-stone-900'}`}>{module.name}</p>
                          <p className={`mt-2 text-[12px] leading-5 ${isActive ? 'text-white/70' : 'text-stone-500'}`}>{MODULE_TYPE_COPY[module.type]}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isActive ? 'bg-white/12 text-white' : statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${hasImage ? (isActive ? 'bg-white/12 text-white' : 'bg-emerald-50 text-emerald-600') : (isActive ? 'bg-white/12 text-white/80' : 'bg-stone-100 text-stone-500')}`}>
                            {hasImage ? '已出图' : '待出图'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-[12px] leading-6 text-emerald-700">
              <p className="font-black text-emerald-900">扣费规则</p>
              <p className="mt-2">单屏生成只需要 1 个 token，整套会按屏顺序执行；哪一屏失败，就不会把那一屏算进成功扣费里。</p>
            </div>
          </aside>

          <main className="min-h-0 bg-[linear-gradient(180deg,#fcfcfd_0%,#f6f7fb_100%)]">
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-stone-100 bg-white/85 px-5 py-4 backdrop-blur md:px-7">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">步骤 3 / 当前屏聚焦编辑</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h3 className="text-[28px] font-black tracking-tight text-[#1d1d1f]">
                        0{activeModule.order} {activeModule.name}
                      </h3>
                      <span className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${activeStatus.className}`}>
                        {activeStatus.label}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] leading-6 text-stone-500">
                      {activeModule.assets.subheadline || activeModule.plan?.headlineDirection || activeModule.copyGoal}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onPlanStructure}
                      disabled={isPlanning || isGeneratingAssets}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#111827] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1a2333] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPlanning ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                      {isPlanning ? '规划中...' : '解析参考并规划'}
                    </button>
                    <button
                      type="button"
                      onClick={onGenerateAssets}
                      disabled={isPlanning || isGeneratingAssets}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-[13px] font-bold text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingAssets ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      {isGeneratingAssets ? '整套生成中...' : '生成整套 8 屏'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRegenerateModule(activeModule.id)}
                      disabled={isPlanning || isGeneratingAssets}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-[13px] font-bold text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw size={15} />
                      {hasGeneratedImage ? '重生成当前屏' : '生成当前屏'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportModule(activeModule.id)}
                      disabled={isPlanning || isGeneratingAssets}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-[13px] font-bold text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download size={15} />
                      导出当前屏
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_380px]">
                  <div className="space-y-5">
                    <div className="rounded-[1.9rem] border border-stone-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">视觉结果</p>
                          <p className="mt-2 text-[13px] leading-6 text-stone-500">
                            当前屏的生成结果只在这里聚焦查看，失败也会明确提示，不会把整套流程搅乱。
                          </p>
                        </div>
                        <div className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
                          {hasGeneratedImage ? 'Ready' : 'Pending'}
                        </div>
                      </div>

                      <div className="mt-5 flex min-h-[520px] items-center justify-center overflow-hidden rounded-[1.6rem] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]">
                        {activeModule.assets.imageUrl ? (
                          <img src={activeModule.assets.imageUrl} alt={activeModule.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="px-8 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-stone-200 bg-white text-stone-400">
                              <ImagePlus size={24} />
                            </div>
                            <p className="mt-5 text-[18px] font-black text-stone-900">当前屏还没有生成视觉图</p>
                            <p className="mt-2 text-[13px] leading-6 text-stone-500">
                              可以直接点上方“生成当前屏”，只消耗 1 个 token；也可以一次顺序生成整套 8 屏。
                            </p>
                          </div>
                        )}
                      </div>

                      {activeModule.assets.errorMessage ? (
                        <div className="mt-4 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-4 text-[13px] leading-6 text-rose-600">
                          {activeModule.assets.errorMessage}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">文案资产</p>
                        <p className="mt-3 text-[26px] font-black tracking-tight text-stone-900">
                          {activeModule.assets.headline || activeModule.plan?.objective || activeModule.title}
                        </p>
                        <p className="mt-3 text-[14px] leading-7 text-stone-500">
                          {activeModule.assets.subheadline || activeModule.assets.body || activeModule.plan?.copyTask || activeModule.copyGoal}
                        </p>
                        {activeModule.assets.sellingPoints.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {activeModule.assets.sellingPoints.map((item, index) => (
                              <span
                                key={`${activeModule.id}-selling-point-${index}`}
                                className="rounded-full bg-stone-100 px-3 py-1.5 text-[12px] font-bold text-stone-600"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white/70 px-5 py-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">规划说明</p>
                        <div className="mt-4 space-y-3 text-[13px] leading-6 text-stone-500">
                          <p><span className="font-bold text-stone-700">版式：</span>{activeModule.plan?.layoutPreset || activeModule.layoutPreset}</p>
                          <p><span className="font-bold text-stone-700">参考策略：</span>{referenceSummary}</p>
                          <p><span className="font-bold text-stone-700">当前参考屏：</span>{activeReference?.label || '默认参考样本'}</p>
                          <p><span className="font-bold text-stone-700">色调：</span>{toneSummary}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">参考风格摘要</p>
                      <h4 className="mt-3 text-[19px] font-black tracking-tight text-stone-900">
                        {referenceStyle?.pageStyle || activeReference?.label || '等待解析参考详情图'}
                      </h4>
                      <p className="mt-3 text-[13px] leading-6 text-stone-500">
                        {referenceStyle
                          ? `${referenceStyle.atmosphere} · ${referenceStyle.layoutRhythm}`
                          : '暂无完整参考 token，当前会优先按商品信息与通用详情页结构生成。'}
                      </p>
                      {referenceStyle?.palette?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {referenceStyle.palette.slice(0, 5).map((token, index) => (
                            <span key={`palette-token-${index}`} className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">
                              {token}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">真实编辑面板</p>
                          <p className="mt-2 text-[13px] leading-6 text-stone-500">
                            默认只保留当前屏最关键的可控项，高级 prompt 也可以在最后再细修。
                          </p>
                        </div>
                        <div className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-500">
                          当前参考：{activeReference?.label || '默认'}
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
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
                          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">说明文案</span>
                          <textarea
                            value={activeModule.assets.body}
                            onChange={(event) => onUpdateModuleAssets(activeModule.id, { body: event.target.value })}
                            className="mt-2 min-h-[88px] w-full resize-y rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-[14px] leading-6 text-stone-900 outline-none focus:border-stone-400"
                            placeholder="这里承接这一屏的主要说明文案"
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
                            className="mt-2 min-h-[84px] w-full resize-y rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-[14px] leading-6 text-stone-900 outline-none focus:border-stone-400"
                            placeholder="一行一个卖点"
                          />
                        </label>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">风格备注</span>
                            <input
                              value={activeModule.assets.styleNotes}
                              onChange={(event) => onUpdateModuleAssets(activeModule.id, { styleNotes: event.target.value })}
                              className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                              placeholder="例如：留白更克制"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">色调备注</span>
                            <input
                              value={activeModule.assets.toneNotes}
                              onChange={(event) => onUpdateModuleAssets(activeModule.id, { toneNotes: event.target.value })}
                              className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-[14px] text-stone-900 outline-none focus:border-stone-400"
                              placeholder="例如：暖米色 + 柔光"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">高级视觉提示词</span>
                          <textarea
                            value={activeModule.assets.generatedPrompt}
                            onChange={(event) => onUpdateModuleAssets(activeModule.id, { generatedPrompt: event.target.value })}
                            className="mt-2 min-h-[120px] w-full resize-y rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-[13px] leading-6 text-stone-900 outline-none focus:border-stone-400"
                            placeholder="如果你要微调画面构图、光感和材质，可以在这里补充"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={onExportSuite}
                        disabled={isPlanning || isGeneratingAssets}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white text-[14px] font-bold text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Images size={16} />
                        导出整套长图
                      </button>
                      <button
                        type="button"
                        onClick={onResetPlan}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white text-[14px] font-bold text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900"
                      >
                        <CheckCircle2 size={16} />
                        重置模板
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DetailPageWorkbench;
