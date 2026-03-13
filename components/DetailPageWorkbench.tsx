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
  const completedCount = modules.filter((module) => module.status === 'success').length;
  const generatedCount = modules.filter((module) => Boolean(module.assets.imageUrl)).length;
  const activeReferenceId = activeModule?.assets.referenceImageId || referenceImages[0]?.id || null;

  return (
    <div className="fixed inset-0 z-[270] flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[1440px] bg-white rounded-[2rem] border border-stone-200 shadow-[0_24px_80px_rgba(15,23,42,0.14)] overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 z-20 h-10 w-10 rounded-full border border-stone-200 bg-white/95 text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-center"
        >
          <X size={16} />
        </button>

        <div className="px-6 md:px-8 py-6 border-b border-stone-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pr-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold tracking-[0.18em] uppercase text-stone-500">
                <LayoutTemplate size={12} />
                Detail Page Engine
              </div>
              <h2 className="mt-4 text-2xl md:text-3xl font-black text-[#1d1d1f] tracking-tight">参考图复刻详情页工作台</h2>
              <p className="mt-2 text-[14px] md:text-[15px] text-stone-500 font-medium max-w-3xl">
                先把参考详情图解析成结构与风格 token，再映射到固定 8 屏模板，并顺序生成 8 屏真实图文资产。
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3 md:min-w-[420px]">
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

        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_380px] min-h-[780px]">
          <aside className="border-r border-stone-100 bg-stone-50/70 px-5 py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-400">页面结构</p>
                <p className="mt-1 text-[13px] text-stone-500">固定 8 屏，当前 8 屏都支持真实图文</p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-700">
                <FileStack size={18} />
              </div>
            </div>
            <div className="space-y-2">
              {modules.map((module) => {
                const statusMeta = STATUS_META[module.status];
                const isActive = module.id === activeModuleId;
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => onSelectModule(module.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${isActive ? 'border-stone-900 bg-white shadow-sm' : 'border-stone-200 bg-white/80 hover:bg-white'}`}
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
                    <div className="mt-3 inline-flex rounded-full bg-[#eef2ff] px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase text-[#4f46e5]">
                      真实生成
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="px-6 md:px-8 py-6 bg-white">
            {activeModule ? (
              <div className="h-full flex flex-col">
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
                          <button
                            type="button"
                            onClick={() => onRegenerateModule(activeModule.id)}
                            disabled={isPlanning || isGeneratingAssets}
                            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-[12px] font-bold text-stone-600 hover:text-stone-900 hover:border-stone-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <RefreshCw size={14} />
                            重生成当前屏
                          </button>
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
                                先点击右侧“生成整套 8 屏图文”，或者直接重生成当前屏。
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
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

          <aside className="border-l border-stone-100 bg-stone-50/60 px-5 py-6 overflow-y-auto max-h-[780px]">
            {activeModule ? (
              <>
                <div className="rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
                  <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-400">参考风格解析</p>
                  <h4 className="mt-3 text-[18px] font-black tracking-tight text-stone-900">
                    {referenceStyle?.pageStyle || '等待解析参考详情图'}
                  </h4>
                  <p className="mt-3 text-[13px] leading-6 text-stone-500">
                    {referenceStyle
                      ? `${referenceStyle.atmosphere} · ${referenceStyle.layoutRhythm}`
                      : '当前会先使用通用混合版策略。上传参考详情图并规划后，这里会展示结构化 token。'}
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
                      <p className="mt-1 text-[13px] leading-6 text-stone-500">上传多张参考详情图，并为当前屏指定更像哪一张。</p>
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
                  <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-400">真实编辑面板</p>
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
                        className="mt-2 min-h-[92px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-[14px] leading-6 text-stone-900 outline-none focus:border-stone-400 resize-y"
                        placeholder="这里承接这一屏的主要文案"
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

                    <div className="grid grid-cols-2 gap-3">
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
                          placeholder="例如：暖米色+柔光"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">视觉提示词</span>
                      <textarea
                        value={activeModule.assets.generatedPrompt}
                        onChange={(event) => onUpdateModuleAssets(activeModule.id, { generatedPrompt: event.target.value })}
                        className="mt-2 min-h-[120px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-[13px] leading-6 text-stone-900 outline-none focus:border-stone-400 resize-y"
                        placeholder="这里会自动生成当前屏的视觉 prompt，也可以手动微调后重生成"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={onPlanStructure}
                    disabled={isPlanning || isGeneratingAssets}
                    className="h-12 rounded-2xl bg-[#111827] text-white font-bold text-[15px] shadow-lg hover:bg-[#1a2333] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPlanning ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {isPlanning ? '正在解析并规划...' : '解析参考图并规划 8 屏'}
                  </button>

                  <button
                    type="button"
                    onClick={onGenerateAssets}
                    disabled={isPlanning || isGeneratingAssets}
                    className="h-12 rounded-2xl bg-white border border-stone-200 text-stone-700 font-bold text-[15px] hover:border-stone-300 hover:text-stone-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGeneratingAssets ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isGeneratingAssets ? '正在生成 8 屏...' : '生成整套 8 屏真实图文'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRegenerateModule(activeModule.id)}
                    disabled={isPlanning || isGeneratingAssets}
                    className="h-12 rounded-2xl border border-stone-200 bg-white text-stone-600 font-bold text-[15px] hover:border-stone-300 hover:text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} />
                    重生成当前屏
                  </button>

                  <button
                    type="button"
                    onClick={() => onExportModule(activeModule.id)}
                    disabled={isPlanning || isGeneratingAssets}
                    className="h-12 rounded-2xl border border-stone-200 bg-white text-stone-600 font-bold text-[15px] hover:border-stone-300 hover:text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    导出当前屏
                  </button>

                  <button
                    type="button"
                    onClick={onExportSuite}
                    disabled={isPlanning || isGeneratingAssets}
                    className="h-12 rounded-2xl border border-stone-200 bg-white text-stone-600 font-bold text-[15px] hover:border-stone-300 hover:text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Images size={16} />
                    导出整套长图
                  </button>

                  <button
                    type="button"
                    onClick={onResetPlan}
                    className="h-12 rounded-2xl border border-stone-200 bg-white text-stone-600 font-bold text-[15px] hover:border-stone-300 hover:text-stone-900 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    重置为初始模板
                  </button>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DetailPageWorkbench;
