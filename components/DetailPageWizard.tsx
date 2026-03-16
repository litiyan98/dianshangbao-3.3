import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  LayoutTemplate,
  Loader2,
  Package2,
  Palette,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { DetailPageReferenceImage } from '../types';

interface DetailPageWizardProps {
  open: boolean;
  sourceImageUrl: string | null;
  referenceImages: DetailPageReferenceImage[];
  isUploadingReferences: boolean;
  isPlanning: boolean;
  targetPlatform: string;
  sceneValue: string;
  toneValue: string;
  instructionValue: string;
  onClose: () => void;
  onAddReferenceImages: (files: File[]) => void;
  onRemoveReferenceImage: (referenceId: string) => void;
  onTargetPlatformChange: (value: string) => void;
  onSceneChange: (value: string) => void;
  onToneChange: (value: string) => void;
  onInstructionChange: (value: string) => void;
  onStart: () => void;
}

const STEP_ITEMS = [
  { id: 'product', icon: Package2, label: '商品' },
  { id: 'reference', icon: Images, label: '参考' },
  { id: 'style', icon: Palette, label: '风格' },
  { id: 'generate', icon: Sparkles, label: '生成' },
] as const;

const PLATFORM_ITEMS = [
  { id: '通用电商', label: '🛒 通用电商', hint: '先跑通通用货架版' },
  { id: '亚马逊爆款', label: '📦 亚马逊', hint: '更偏硬规则与白底主图' },
  { id: '小红书种草', label: '📕 小红书', hint: '更偏真实分享与种草感' },
  { id: '抖音/TikTok', label: '🎵 抖音/TK', hint: '更偏移动端抓眼和节奏感' },
];

const DETAIL_PAGE_USE_CASES = [
  { id: 'hero', icon: '🌟', label: '封面图', desc: '先把商品印象立住' },
  { id: 'selling_points', icon: '✅', label: '核心卖点', desc: '把购买理由讲清楚' },
  { id: 'scene', icon: '🛋', label: '使用场景', desc: '让用户代入生活方式' },
  { id: 'detail', icon: '🔍', label: '细节展示', desc: '把材质和结构放大' },
  { id: 'benefit', icon: '✨', label: '价值说明', desc: '从功能走向体验感' },
  { id: 'spec', icon: '📏', label: '参数信息', desc: '把理性信息一次说透' },
  { id: 'trust', icon: '🛡', label: '信任背书', desc: '减少顾虑，补足安全感' },
  { id: 'cta', icon: '👉', label: '购买收口', desc: '最后一屏做转化收束' },
];

const DetailPageWizard: React.FC<DetailPageWizardProps> = ({
  open,
  sourceImageUrl,
  referenceImages,
  isUploadingReferences,
  isPlanning,
  targetPlatform,
  sceneValue,
  toneValue,
  instructionValue,
  onClose,
  onAddReferenceImages,
  onRemoveReferenceImage,
  onTargetPlatformChange,
  onSceneChange,
  onToneChange,
  onInstructionChange,
  onStart,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  const currentStep = STEP_ITEMS[stepIndex];
  const CurrentStepIcon = currentStep.icon;
  const canGoNext = useMemo(() => {
    if (stepIndex === 0) return Boolean(sourceImageUrl);
    return true;
  }, [stepIndex, sourceImageUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[265] flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-stone-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[1120px] overflow-hidden rounded-[2rem] border border-stone-200 bg-[radial-gradient(circle_at_top_left,rgba(239,246,255,0.95),rgba(255,255,255,0.97)_34%,rgba(248,250,252,0.96)_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/90 text-stone-500 transition-colors hover:text-stone-900"
        >
          <X size={16} />
        </button>

        <div className="border-b border-stone-100 px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500 shadow-sm">
                <LayoutTemplate size={12} />
                Detail Page Wizard
              </div>
              <h2 className="mt-4 text-[30px] font-black tracking-tight text-[#1d1d1f]">
                参考图复刻详情页
              </h2>
              <p className="mt-2 text-[14px] font-medium leading-6 text-stone-500">
                上传商品图和参考详情图，AI 会先理解结构，再帮你拆成 8 屏逐步生成。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {STEP_ITEMS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === stepIndex;
                const isDone = index < stepIndex;
                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border px-4 py-3 transition-all ${
                      isActive
                        ? 'border-stone-900 bg-white shadow-sm'
                        : isDone
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-stone-200 bg-white/65'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black ${
                          isActive
                            ? 'bg-stone-900 text-white'
                            : isDone
                              ? 'bg-emerald-500 text-white'
                              : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {isDone ? '✓' : index + 1}
                      </span>
                      <Icon size={14} className={isActive ? 'text-stone-900' : 'text-stone-400'} />
                    </div>
                    <p className="mt-3 text-[13px] font-black text-stone-900">{step.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-r border-stone-100 bg-white/60 px-6 py-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">当前步骤</p>
            <div className="mt-4 rounded-[1.75rem] border border-stone-200 bg-white px-5 py-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
                  <CurrentStepIcon size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
                    Step {stepIndex + 1}
                  </p>
                  <p className="mt-1 text-[20px] font-black tracking-tight text-stone-900">
                    {currentStep.label}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-[13px] leading-6 text-stone-500">
                {stepIndex === 0 ? (
                  <>
                    <p>先确认你的商品图已经就绪。</p>
                    <p>这一步不需要理解模块，只要锁住商品主体。</p>
                  </>
                ) : null}
                {stepIndex === 1 ? (
                  <>
                    <p>一次上传 1 到 8 张参考详情图。</p>
                    <p>系统会学习版式、色彩、留白和节奏，不学习参考图里的商品。</p>
                  </>
                ) : null}
                {stepIndex === 2 ? (
                  <>
                    <p>这里只做方向选择，不需要写很多字。</p>
                    <p>平台、场景和色调会影响后面的规划与生图规则。</p>
                  </>
                ) : null}
                {stepIndex === 3 ? (
                  <>
                    <p>点击开始后，系统会先规划 8 屏，再带你看一页更直观的用途确认。</p>
                    <p>确认后再逐屏出图，不会一上来把所有配置都压给你。</p>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-[1.75rem] border border-dashed border-stone-300 bg-white/65 px-5 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">你将得到</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {DETAIL_PAGE_USE_CASES.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-stone-50 px-3 py-3">
                    <p className="text-[15px] font-black text-stone-900">{item.icon} {item.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-stone-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="px-6 py-6 md:px-8">
            {stepIndex === 0 ? (
              <section className="space-y-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">① 商品</p>
                  <h3 className="mt-2 text-[28px] font-black tracking-tight text-stone-900">先锁定你的商品主体</h3>
                  <p className="mt-2 text-[14px] leading-6 text-stone-500">
                    详情页复刻的前提是商品不漂。我们会优先沿用你已经上传的主商品图。
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
                  {sourceImageUrl ? (
                    <div className="grid gap-5 md:grid-cols-[360px_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-stone-50">
                        <div className="aspect-[4/5]">
                          <img src={sourceImageUrl} alt="商品图" className="h-full w-full object-cover" />
                        </div>
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700">
                          <span>✓</span>
                          商品图已就绪
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">系统会锁定</p>
                            <p className="mt-2 text-[14px] font-bold text-stone-900">瓶型 / 包装 / 主视觉身份</p>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">不会乱改</p>
                            <p className="mt-2 text-[14px] font-bold text-stone-900">品牌 / 标签 / SKU 主体</p>
                          </div>
                        </div>
                        <p className="mt-4 text-[13px] leading-6 text-stone-500">
                          后面参考图只用来学习风格和结构，不会借用参考图里的商品。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 px-8 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-stone-400 shadow-sm">
                        <ImagePlus size={22} />
                      </div>
                      <p className="mt-4 text-[18px] font-black text-stone-900">还没有商品图</p>
                      <p className="mt-2 max-w-md text-[13px] leading-6 text-stone-500">
                        请先回到主页面上传商品图，再开始 8 屏详情页复刻。
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {stepIndex === 1 ? (
              <section className="space-y-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">② 参考</p>
                  <h3 className="mt-2 text-[28px] font-black tracking-tight text-stone-900">上传你想模仿的详情图</h3>
                  <p className="mt-2 text-[14px] leading-6 text-stone-500">
                    可以只传 1 张，也可以一次传多张。系统会自动理解哪一张更适合哪一屏。
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {referenceImages.map((reference) => (
                      <div key={reference.id} className="group overflow-hidden rounded-[1.4rem] border border-stone-200 bg-stone-50">
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <img src={reference.url} alt={reference.label} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => onRemoveReferenceImage(reference.id)}
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="px-3 py-3">
                          <p className="text-[12px] font-black text-stone-900">{reference.label}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-stone-500">
                            {reference.visualDNA?.atmosphere || '等待风格提取'}
                          </p>
                        </div>
                      </div>
                    ))}

                    <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-stone-300 bg-stone-50 text-stone-500 transition-colors hover:bg-stone-100">
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
                      {isUploadingReferences ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                      <span className="mt-2 text-[12px] font-black">添加参考</span>
                      <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-stone-400">1-8 张</span>
                    </label>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">会学习</p>
                      <p className="mt-2 text-[13px] font-bold text-stone-900">版式 / 色彩 / 留白 / 光影</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">不会学习</p>
                      <p className="mt-2 text-[13px] font-bold text-stone-900">参考图里的商品 / 品牌 / 文案</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">当前状态</p>
                      <p className="mt-2 text-[13px] font-bold text-stone-900">{referenceImages.length} 张参考已就绪</p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {stepIndex === 2 ? (
              <section className="space-y-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">③ 风格</p>
                  <h3 className="mt-2 text-[28px] font-black tracking-tight text-stone-900">给系统一个明确方向</h3>
                  <p className="mt-2 text-[14px] leading-6 text-stone-500">
                    这一步只要决定平台、场景和色调，不需要写一大段说明。
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">平台</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {PLATFORM_ITEMS.map((platform) => (
                        <button
                          key={platform.id}
                          type="button"
                          onClick={() => onTargetPlatformChange(platform.id)}
                          className={`rounded-[1.35rem] border px-4 py-4 text-left transition-all ${
                            targetPlatform === platform.id
                              ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                              : 'border-stone-200 bg-stone-50 hover:border-stone-300'
                          }`}
                        >
                          <p className="text-[15px] font-black">{platform.label}</p>
                          <p className={`mt-2 text-[12px] leading-5 ${targetPlatform === platform.id ? 'text-white/75' : 'text-stone-500'}`}>
                            {platform.hint}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">场景</span>
                      <input
                        value={sceneValue}
                        onChange={(event) => onSceneChange(event.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-[14px] font-medium text-stone-900 outline-none focus:border-stone-400"
                        placeholder="例如：真实生活代入"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">色调</span>
                      <input
                        value={toneValue}
                        onChange={(event) => onToneChange(event.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-[14px] font-medium text-stone-900 outline-none focus:border-stone-400"
                        placeholder="例如：暖米色柔光"
                      />
                    </label>
                  </div>

                  <label className="mt-5 block">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">一句导演指令</span>
                    <textarea
                      value={instructionValue}
                      onChange={(event) => onInstructionChange(event.target.value)}
                      className="mt-2 min-h-[120px] w-full rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 text-[14px] leading-7 text-stone-900 outline-none focus:border-stone-400 resize-y"
                      placeholder="例如：封面更克制，卖点屏更像参考第二张，整体偏母婴安心感。"
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {stepIndex === 3 ? (
              <section className="space-y-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">④ 生成</p>
                  <h3 className="mt-2 text-[28px] font-black tracking-tight text-stone-900">AI 会先规划，再逐屏出图</h3>
                  <p className="mt-2 text-[14px] leading-6 text-stone-500">
                    你不用先理解工作台。系统会先帮你拆好结构，接着再进入编辑界面。
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {DETAIL_PAGE_USE_CASES.map((item) => (
                      <div key={item.id} className="rounded-[1.35rem] border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-[16px] font-black text-stone-900">{item.icon} {item.label}</p>
                        <p className="mt-2 text-[12px] leading-5 text-stone-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-stone-200 bg-[#f6f8ff] px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">📦 商品</p>
                      <p className="mt-2 text-[13px] font-bold text-stone-900">{sourceImageUrl ? '已锁定商品主体' : '待上传商品图'}</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-[#f6f8ff] px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">🖼 参考</p>
                      <p className="mt-2 text-[13px] font-bold text-stone-900">{referenceImages.length} 张参考图</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-[#f6f8ff] px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">🎨 平台</p>
                      <p className="mt-2 text-[13px] font-bold text-stone-900">{targetPlatform}</p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 border-t border-stone-100 pt-6 md:flex-row md:items-center md:justify-between">
              <div className="text-[12px] font-medium text-stone-500">
                {stepIndex < 3 ? '继续下一步，让系统知道该怎么做。' : '点击开始后，将自动进入工作台并生成 8 屏规划。'}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                  disabled={stepIndex === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-[13px] font-bold text-stone-600 transition-all hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft size={16} />
                  上一步
                </button>

                {stepIndex < STEP_ITEMS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((prev) => Math.min(STEP_ITEMS.length - 1, prev + 1))}
                    disabled={!canGoNext}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 text-[13px] font-black tracking-[0.16em] text-white transition-all hover:bg-[#002FA7] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    下一步
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStart}
                    disabled={isPlanning || !sourceImageUrl}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 text-[13px] font-black tracking-[0.16em] text-white transition-all hover:bg-[#002FA7] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isPlanning ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    {isPlanning ? '正在规划 8 屏...' : '开始生成 8 屏规划'}
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DetailPageWizard;
