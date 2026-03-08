import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Plus, Download, Sparkles, Wand2, Palette, Zap, Loader2, Lightbulb, ZoomIn, Trash2
} from 'lucide-react';
import { ScenarioType, MarketAnalysis, TextConfig, GenerationMode, FontStyle, CompositionLayout, AspectRatio, StickerConfig, VisualDNA, LogoConfig } from './types';
import { SCENARIO_CONFIGS, DEFAULT_STICKERS } from './constants';
import { analyzeProduct, generateScenarioImage, extractVisualDNA, generateMasterImagePrompt, generateMasterMarketingCopy, consumeLatestAssetSnapshot } from './utils/geminiService';
import { processFinalImage, FONT_REGISTRY, exportImageWithText, preloadFont, compressImage, generateMask, loadImage } from './utils/imageComposite';
import html2canvas from 'html2canvas';
import { Authing } from '@authing/browser';
import { motion } from 'framer-motion';
import { Rnd } from 'react-rnd';
import CreditModal, { RECHARGE_PACKAGES, type CreditTab, type RechargePackage } from './components/CreditModal';
import PaymentModal from './components/PaymentModal';
import MorphingAiButton, { NebulaDiamondIcon } from './components/MorphingAiButton';
import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';
import { useAppleReveal } from './hooks/useAppleReveal';
import LiquidMetalBackground from './components/LiquidMetalBackground';

const BARRAGE_TEXTS = [
  '影棚级光影 ✦',
  '极简操作 ✦',
  '商用级高画质 ✦',
];

const HERO_GALLERY_IMAGES = [
  '/images/IMG_8577.jpg',
  '/images/IMG_8575.jpg',
  '/images/6fe4c0ac8427443ff7ab87be873bd26f.JPG',
  '/images/IMG_8578.jpg',
  '/images/IMG_8574.jpg',
  '/images/IMG_8576.jpg',
  '/images/IMG_8579.jpg',
];

const ECOMMERCE_TIPS = [
  "【主图法则】前 3 秒决定去留，第一张主图必须直击用户核心痛点，背景切忌杂乱。", "【差异化竞争】标品拼视觉，非标品拼调性。用场景图替代纯白底图可提升约 30% 转化率。",
  "【移动端优化】90% 流量来自手机，详情页核心卖点文字建议放大至不小于 24px。", "【买家秀营销】高质量的买家秀比详情页更具说服力，尝试将 AI 生成的场景图作素材。",
  "【点击率玄学】高饱和度或具有强烈明暗对比的主图，在瀑布流中更容易抓住眼球。", "【视觉一致性】全店统一的视觉色调和排版风格，能有效提升品牌记忆点和复购率。",
  "【场景化带货】不要只卖产品，要卖生活方式。让产品出现在目标用户向往的高级使用场景中。", "【测图技巧】直通车测图时，保持标题和定向人群不变，仅更换主图，3-5天看数据。",
  "【光影保真】真实感是转化的基石，AI 合成必须注重商品本身环境光与背景透视的绝对统一。", "【平台差异】淘系偏好热闹，京东偏好品质，亚马逊必须严格遵循本土化审美。"
];



// 锁定回调凭证：强制写死为官方主域名，严禁使用 window.location.origin 等动态逻辑，防止触发 redirect_uri_mismatch
const safeRedirectUri = 'https://dianshangbaoai.com';

const authing = new Authing({
  domain: import.meta.env.VITE_AUTHING_DOMAIN || 'khvmvxfsxamp-demo.authing.cn',
  appId: import.meta.env.VITE_AUTHING_APP_ID || '699acd76b6ff0bc881598524',
  redirectUri: safeRedirectUri,
});

const BRIEF_STEPS = [
  "🔍 正在启动视觉大模型，扫描商品三维轮廓与材质属性...",
  "🧬 正在深度测序视觉基因，解析像素级光影与色调参数...",
  "📐 正在注入电商平台转化率算法，构建完美的呼吸感构图...",
  "🎨 正在使用虚幻引擎 5 (UE5) 级画质进行最终相片级渲染..."
];

const logMessages = [
  "正在初始化视觉神经元提取...",
  "分析全局光影与环境遮蔽...",
  "生成多尺度潜在空间细节...",
  "深度融合风格特征与物理材质...",
  "正在进行视网膜级色彩与高光校准..."
];

const FONT_STYLE_OPTIONS: Array<{ id: FontStyle; label: string }> = [
  { id: 'modern_sans', label: '现代无衬线 (通用电商)' },
  { id: 'elegant_serif', label: '优雅衬线 (高端审美)' },
  { id: 'bold_display', label: '高冲击标题 (大促爆款)' },
  { id: 'handwritten_script', label: '手写氛围 (生活感)' },
  { id: 'tech_mono', label: '科技等宽 (数码机能)' },
  { id: 'playful_marker', label: '趣味海报 (年轻化)' },
  { id: 'classic_song', label: '经典宋韵 (东方气质)' },
  { id: 'artistic_brush', label: '艺术笔触 (品牌感)' },
];

// 临时开发开关：允许算力透支，不拦截单图/套图生成
const ENABLE_CREDITS_OVERDRAFT = true;

type TextPresetId = 'magazine' | 'poster' | 'minimalist';

type EditorEffect = 'minimal' | 'variety' | 'shadow';

interface LightboxTarget {
  url: string;
  index: number;
  label: string;
}

interface EditorBoxState {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  detail: string;
  fontStyle: FontStyle;
  mainColor: string;
  subColor: string;
  textAlign: 'left' | 'center' | 'right';
  fontSize: number;
  shadowIntensity: number;
  effect: EditorEffect;
  writingMode: 'horizontal' | 'vertical';
  gradientEnabled: boolean;
  gradientStart: string;
  gradientEnd: string;
}

interface OverlayBoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageLayer {
  id: string;
  url: string; // 本地 Blob URL
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextLayer {
  id: string;
  text: string;
  fontFamily: string;
  subFontFamily?: string;
  color: string;
  fontSize: number;
  subFontSize?: number;
  x: number;
  y: number;
  positionUnit?: 'px' | 'percent';
  width: number;
  height: number;
  textShadow?: string;
  subText?: string;
  subColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  shadowIntensity?: number;
  fontStyle?: FontStyle;
  subFontStyle?: FontStyle;
  writingMode?: 'horizontal' | 'vertical';
  gradientEnabled?: boolean;
  gradientStart?: string;
  gradientEnd?: string;
}

interface LayerState {
  texts: TextLayer[];
  images: ImageLayer[];
  stageWidth?: number;
  stageHeight?: number;
}

const MODEL_HINT_IMAGE = 'Nano Banana Pro · Gemini 2.5 Flash Image';
const MODEL_HINT_COPY = 'Nano Banana Pro · Gemini Flash 文案引擎';
const TEXT_GEN_COUNT_KEY = 'visionEngine_textCount';
const TEXT_GEN_LOCK_KEY = 'visionEngine_textLock';
const UNSUPPORTED_COLOR_FN_RE = /\b(oklch|oklab)\(/i;
type TextGlowState = 'idle' | 'generating' | 'success';
type SuiteSlotState = 'idle' | 'loading' | 'success' | 'error';
type MatrixLockLevel = 'strict' | 'balanced' | 'editorial';

const MATRIX_PROFILES: Array<{
  variationPrompt: string;
  lockLevel: MatrixLockLevel;
}> = [
  {
    lockLevel: 'strict',
    variationPrompt: 'Commercial product photography, studio lighting, high contrast, clean background, highly detailed, eye-catching. Keep the exact uploaded product identity, bottle shape, label layout, and packaging artwork unchanged. No camera angle change. Only optimize lighting, reflections, and peripheral splash details around the same product.',
  },
  {
    lockLevel: 'balanced',
    variationPrompt: 'Lifestyle photography in a warm real-world environment, natural sunlight, cinematic lighting, depth of field, cozy atmosphere. Keep the exact uploaded product identity, bottle shape, label layout, and packaging artwork unchanged. Allow only a subtle perspective change of the same bottle and premium material polish such as clearer liquid, improved condensation, and refined highlights.',
  },
  {
    lockLevel: 'editorial',
    variationPrompt: 'Minimalist high-end aesthetic, geometric background, soft diffuse reflection, close-up material details, Apple product photography style. Keep the exact uploaded product identity and packaging design recognizable. Allow a moderate camera angle shift, bolder scene design, and editorial props, but do not change the bottle into a different product.',
  },
];

type StepHaloTitleProps = {
  step: string;
  title: string;
};

const StepHaloTitle: React.FC<StepHaloTitleProps> = ({ step, title }) => (
  <h2 className="flex items-center gap-2.5 mb-8 select-none text-xl md:text-2xl">
    <span className="font-medium text-gray-300 tracking-wide">
      {step}
    </span>
    <span
      className="font-light text-violet-400 animate-pulse"
      style={{ animationDuration: '3s' }}
    >
      /
    </span>
    <span className="font-bold text-[#1d1d1f] tracking-tight">
      {title}
    </span>
  </h2>
);

const TEXT_PRESETS: Array<{
  id: TextPresetId;
  name: string;
  icon: string;
  positionX: number;
  positionY: number;
  align: 'left' | 'center' | 'right';
  fontSize: number;
  shadowIntensity: number;
}> = [
  { id: 'magazine', name: '杂志风', icon: '📰', positionX: 12, positionY: 18, align: 'left', fontSize: 9, shadowIntensity: 16 },
  { id: 'poster', name: '海报风', icon: '📣', positionX: 50, positionY: 82, align: 'center', fontSize: 13, shadowIntensity: 24 },
  { id: 'minimalist', name: '极简风', icon: '◻️', positionX: 90, positionY: 88, align: 'right', fontSize: 7, shadowIntensity: 12 },
];

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [localUserId, setLocalUserId] = useState('');
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [userInviteCode, setUserInviteCode] = useState('');
  const [userVipExpireDate, setUserVipExpireDate] = useState<string | null>(null);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditModalTab, setCreditModalTab] = useState<CreditTab>('invite');
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isCreditsLoading, setIsCreditsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authTokenReady, setAuthTokenReady] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>("");
  const [loadingBrief, setLoadingBrief] = useState('');

  const [step, setStep] = useState<'upload' | 'result'>('upload');
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [userPrompt, setUserPrompt] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % HERO_GALLERY_IMAGES.length);
  };
  
  // 支付相关状态
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedRechargePackage, setSelectedRechargePackage] = useState<RechargePackage | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const suiteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { ref: sceneRef, isVisible: isSceneVisible } = useAppleReveal<HTMLElement>(0.15);
  const { ref: outputRef, isVisible: isOutputVisible } = useAppleReveal<HTMLElement>(0.15);
  const { ref: posterRef, isVisible: isPosterVisible } = useAppleReveal<HTMLElement>(0.15);
  const { ref: refStyleRef, isVisible: isRefStyleVisible } = useAppleReveal<HTMLDivElement>(0.15);
  const { ref: generateRef, isVisible: isGenerateVisible } = useAppleReveal<HTMLDivElement>(0.15);

  const [lightboxTarget, setLightboxTarget] = useState<LightboxTarget | null>(null);
  const [editorPalette, setEditorPalette] = useState<string[]>([]);
  const [editorBox, setEditorBox] = useState<EditorBoxState | null>(null);
  const [editorGuides, setEditorGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const [editorStageSize, setEditorStageSize] = useState({ width: 0, height: 0 });
  const [editorInitialized, setEditorInitialized] = useState(false);
  const [editorLogoBox, setEditorLogoBox] = useState<OverlayBoxState | null>(null);
  const [editorStickerBox, setEditorStickerBox] = useState<OverlayBoxState | null>(null);
  const [overlayAutoPlaced, setOverlayAutoPlaced] = useState(false);
  const [isLightboxDownloading, setIsLightboxDownloading] = useState(false);
  const [isLightboxExporting, setIsLightboxExporting] = useState(false);
  const [imageLayers, setImageLayers] = useState<ImageLayer[]>([]);
  const [activeImageLayerId, setActiveImageLayerId] = useState<string | null>(null);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTextTarget, setActiveTextTarget] = useState<'primary' | 'secondary'>('primary');
  const [activeTextTransformId, setActiveTextTransformId] = useState<string | null>(null);
  const [globalLayerConfig, setGlobalLayerConfig] = useState<Record<string, LayerState>>({});
  const [draftConfig, setDraftConfig] = useState<LayerState | null>(null);
  const [textLayerDraftMap, setTextLayerDraftMap] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const [currentImageId, setCurrentImageId] = useState<string>('');
  const [showAdvancedColor, setShowAdvancedColor] = useState(false);
  const PRESET_COLORS = ['#FF0036', '#FF5000', '#D4AF37', '#002FA7', '#1C1C1C', '#FFFFFF'];

  // 专属锦囊对话框状态
  const [tipIndex, setTipIndex] = useState(0);
  const [showTip, setShowTip] = useState(true);

  const [textConfig, setTextConfig] = useState<TextConfig>({ 
    title: "", detail: "", isEnabled: true, fontStyle: 'modern_sans',
    mainColor: '#FFFFFF', subColor: 'rgba(255,255,255,0.7)',
    fontSize: 8, shadowIntensity: 20, positionX: 50, positionY: 15,
    textAlign: 'center' 
  });
  const [stickerConfig, setStickerConfig] = useState<StickerConfig>({
    url: null, positionX: 85, positionY: 15, scale: 20
  });
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoOriginalImage, setLogoOriginalImage] = useState<string | null>(null);
  const [isLogoAiBgEnabled, setIsLogoAiBgEnabled] = useState(false);
  const [logoConfig, setLogoConfig] = useState<LogoConfig>({ positionX: 12, positionY: 12, scale: 15 });
  const [isRemovingLogoBg, setIsRemovingLogoBg] = useState(false);
  const [copywritingCountdown, setCopywritingCountdown] = useState<number | null>(null);
  const [promptCountdown, setPromptCountdown] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const selectedScenario: ScenarioType = ScenarioType.STUDIO_WHITE;
  const [layout, setLayout] = useState<CompositionLayout>('center');
  const mode: GenerationMode = 'creative';
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [logIndex, setLogIndex] = useState(0);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [suiteSlotStates, setSuiteSlotStates] = useState<SuiteSlotState[]>([]);
  const [styleReferenceImage, setStyleReferenceImage] = useState<string | null>(null);
  const [visualDNA, setVisualDNA] = useState<VisualDNA | null>(null);
  const [isExtractingDNA, setIsExtractingDNA] = useState(false);

  const [promptTone, setPromptTone] = useState('🌤️ 治愈系自然光 (Golden Hour & Dappled)');
  const [promptScene, setPromptScene] = useState('真实生活代入');
  const [redesignPrompt, setRedesignPrompt] = useState('');
  const [textLayout, setTextLayout] = useState<TextPresetId>('magazine');
  const [targetPlatform, setTargetPlatform] = useState('通用电商');
  const [highlightCopy, setHighlightCopy] = useState(false);
  const [isAutoTextContrast, setIsAutoTextContrast] = useState(true);
  const [isRedesignEnabled, setIsRedesignEnabled] = useState(false);
  const [isSuiteMode, setIsSuiteMode] = useState(false);
  const [activeGenerateCount, setActiveGenerateCount] = useState<1 | 3>(1);
  const [maskImageBase64, setMaskImageBase64] = useState<string | null>(null);
  const [isGeneratingMask, setIsGeneratingMask] = useState(false);
  const [panelSliderDraft, setPanelSliderDraft] = useState<{
    width: number;
    height: number;
    fontSize: number;
    shadowIntensity: number;
  } | null>(null);
  const editorCaptureRef = useRef<HTMLDivElement>(null);
  const editorStageRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const logoDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const stickerDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const imageLayerInputRef = useRef<HTMLInputElement>(null);
  const imageLayersRef = useRef<ImageLayer[]>([]);
  const globalLayerConfigRef = useRef<Record<string, LayerState>>({});
  const base64CacheRef = useRef<Map<string, string>>(new Map());

  const getLightboxImageId = (index: number) => `lightbox_${index}`;

  const getAllLightboxImageIds = () =>
    resultImages
      .map((url, index) => ({ url, id: getLightboxImageId(index) }))
      .filter(item => Boolean(item.url))
      .map(item => item.id);

  const handleSmartLayoutChange = (newLayout: CompositionLayout) => {
    setLayout(newLayout);
    // 智能联动：根据构图自动避让文字位置与对齐方式
    let smartX = 50, smartY = 15, smartAlign: 'left' | 'center' | 'right' = 'center';
    
    if (newLayout === 'center') { smartX = 50; smartY = 15; smartAlign = 'center'; }
    else if (newLayout === 'left_space') { smartX = 12; smartY = 50; smartAlign = 'left'; }
    else if (newLayout === 'right_space') { smartX = 88; smartY = 50; smartAlign = 'right'; }
    else if (newLayout === 'top_space') { smartX = 50; smartY = 20; smartAlign = 'center'; }

    setTextConfig(prev => ({ ...prev, positionX: smartX, positionY: smartY, textAlign: smartAlign }));
  };

  const applyTextPreset = (presetId: TextPresetId) => {
    const preset = TEXT_PRESETS.find(item => item.id === presetId);
    if (!preset) return;
    setTextLayout(presetId);
    setTextConfig(prev => ({
      ...prev,
      positionX: preset.positionX,
      positionY: preset.positionY,
      textAlign: preset.align,
      fontSize: preset.fontSize,
      shadowIntensity: preset.shadowIntensity,
    }));
  };

  const getTextAnalysisRegion = (imgW: number, imgH: number) => {
    if (layout === 'left_space') return { x: 0, y: 0.08 * imgH, w: 0.46 * imgW, h: 0.78 * imgH };
    if (layout === 'right_space') return { x: 0.54 * imgW, y: 0.08 * imgH, w: 0.46 * imgW, h: 0.78 * imgH };
    if (layout === 'top_space') return { x: 0.1 * imgW, y: 0, w: 0.8 * imgW, h: 0.45 * imgH };
    const x = Math.max(0, Math.min(imgW - 1, (textConfig.positionX / 100) * imgW - 0.18 * imgW));
    const y = Math.max(0, Math.min(imgH - 1, (textConfig.positionY / 100) * imgH - 0.14 * imgH));
    return { x, y, w: 0.36 * imgW, h: 0.28 * imgH };
  };

  const autoTuneTextContrast = async (imageUrl: string) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load failed'));
        img.src = imageUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const region = getTextAnalysisRegion(canvas.width, canvas.height);
      const sx = Math.max(0, Math.floor(region.x));
      const sy = Math.max(0, Math.floor(region.y));
      const sw = Math.max(1, Math.min(canvas.width - sx, Math.floor(region.w)));
      const sh = Math.max(1, Math.min(canvas.height - sy, Math.floor(region.h)));
      const data = ctx.getImageData(sx, sy, sw, sh).data;

      let luminanceSum = 0;
      let count = 0;
      const stride = 24;
      for (let i = 0; i < data.length; i += stride) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        luminanceSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        count++;
      }
      if (!count) return;
      const avgLum = luminanceSum / count;
      const darkBg = avgLum < 132;

      setTextConfig(prev => ({
        ...prev,
        mainColor: darkBg ? '#FFFFFF' : '#111827',
        subColor: darkBg ? 'rgba(255,255,255,0.86)' : '#374151',
        shadowIntensity: darkBg ? Math.max(prev.shadowIntensity, 18) : Math.min(prev.shadowIntensity, 10),
      }));
    } catch (error) {
      console.warn('auto text contrast failed:', error);
    }
  };

  const buildDownloadFileName = (suffix?: string) => {
    const scenarioName = SCENARIO_CONFIGS.find(s => s.id === selectedScenario)?.name || '场景图';
    const safeScenario = scenarioName.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '');
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `电商宝_${safeScenario}${suffix ? `_${suffix}` : ''}_${hh}${mm}.png`;
  };

  const triggerDownload = async (dataUrl: string, fileName: string) => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOSLike = /iPhone|iPad|iPod/i.test(ua);
    const isWeChat = /MicroMessenger/i.test(ua);
    const shouldOpenDirectly = isIOSLike || isWeChat;

    if (shouldOpenDirectly) {
      let previewUrl = dataUrl;
      try {
        const directResponse = await fetch(dataUrl);
        const directBlob = await directResponse.blob();
        previewUrl = URL.createObjectURL(directBlob);
      } catch {
        previewUrl = dataUrl;
      }
      const popup = window.open(previewUrl, '_blank');
      if (!popup) throw new Error('浏览器拦截了弹窗，请允许当前站点打开新窗口后重试');
      if (previewUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(previewUrl), 10000);
      }
      return;
    }

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
    } catch {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const safeColorFromComputed = (value: string, fallback: string): string => {
    const trimmed = value?.trim() || '';
    if (!trimmed) return fallback;
    return UNSUPPORTED_COLOR_FN_RE.test(trimmed) ? fallback : trimmed;
  };

  const sanitizeHtml2CanvasCloneColors = (originalRoot: HTMLElement, clonedRoot: HTMLElement) => {
    const originalNodes: HTMLElement[] = [originalRoot, ...Array.from(originalRoot.querySelectorAll<HTMLElement>('*'))];
    const clonedNodes: HTMLElement[] = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement>('*'))];
    const total = Math.min(originalNodes.length, clonedNodes.length);
    const colorProps = [
      'color',
      'accent-color',
      'background-color',
      'border-color',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
      'outline-color',
      'text-decoration-color',
      'column-rule-color',
      'caret-color',
      '-webkit-text-fill-color',
      'fill',
      'stroke',
      'stop-color',
      'flood-color',
      'lighting-color',
    ];
    const colorFallback: Record<string, string> = {
      'color': '#111827',
      'accent-color': '#2563EB',
      'background-color': 'transparent',
      'border-color': 'transparent',
      'border-top-color': 'rgba(255,255,255,0.65)',
      'border-right-color': 'rgba(255,255,255,0.65)',
      'border-bottom-color': 'rgba(255,255,255,0.65)',
      'border-left-color': 'rgba(255,255,255,0.65)',
      'outline-color': 'rgba(59,130,246,0.65)',
      'text-decoration-color': '#111827',
      'column-rule-color': 'transparent',
      'caret-color': '#111827',
      '-webkit-text-fill-color': '#111827',
      'fill': '#111827',
      'stroke': '#111827',
      'stop-color': 'transparent',
      'flood-color': 'transparent',
      'lighting-color': '#ffffff',
    };
    const safeTailwindVars: Record<string, string> = {
      '--tw-ring-color': 'rgba(59,130,246,0.45)',
      '--tw-ring-offset-color': 'transparent',
      '--tw-ring-shadow': '0 0 #0000',
      '--tw-ring-offset-shadow': '0 0 #0000',
      '--tw-shadow': '0 0 #0000',
      '--tw-shadow-colored': '0 0 #0000',
      '--tw-shadow-color': 'rgba(0,0,0,0)',
      '--tw-gradient-from': 'transparent',
      '--tw-gradient-via': 'transparent',
      '--tw-gradient-to': 'transparent',
      '--tw-gradient-stops': 'transparent',
    };

    for (let i = 0; i < total; i += 1) {
      const source = originalNodes[i];
      const target = clonedNodes[i];
      const sourceStyle = window.getComputedStyle(source);

      colorProps.forEach((prop) => {
        const sourceValue = sourceStyle.getPropertyValue(prop);
        const fallback = colorFallback[prop] || 'transparent';
        const safeValue = safeColorFromComputed(sourceValue, fallback);
        if (safeValue) {
          target.style.setProperty(prop, safeValue, 'important');
        }
      });

      Object.entries(safeTailwindVars).forEach(([prop, value]) => {
        target.style.setProperty(prop, value, 'important');
      });

      const background = sourceStyle.getPropertyValue('background');
      if (UNSUPPORTED_COLOR_FN_RE.test(background)) {
        target.style.setProperty('background', 'transparent', 'important');
      }

      const backgroundImage = sourceStyle.getPropertyValue('background-image');
      if (UNSUPPORTED_COLOR_FN_RE.test(backgroundImage)) {
        target.style.setProperty('background-image', 'none', 'important');
      }

      const boxShadow = sourceStyle.getPropertyValue('box-shadow');
      target.style.setProperty('box-shadow', UNSUPPORTED_COLOR_FN_RE.test(boxShadow) ? 'none' : boxShadow, 'important');

      const textShadow = sourceStyle.getPropertyValue('text-shadow');
      target.style.setProperty('text-shadow', UNSUPPORTED_COLOR_FN_RE.test(textShadow) ? 'none' : textShadow, 'important');

      const filter = sourceStyle.getPropertyValue('filter');
      if (UNSUPPORTED_COLOR_FN_RE.test(filter)) {
        target.style.setProperty('filter', 'none', 'important');
      }

      const backdropFilter = sourceStyle.getPropertyValue('backdrop-filter');
      if (UNSUPPORTED_COLOR_FN_RE.test(backdropFilter)) {
        target.style.setProperty('backdrop-filter', 'none', 'important');
      }
    }
  };

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const getAspectDimensions = (ratio: AspectRatio) => {
    if (ratio === '3:4') return { width: 1080, height: 1440 };
    if (ratio === '9:16') return { width: 1080, height: 1920 };
    if (ratio === '4:3') return { width: 1440, height: 1080 };
    if (ratio === '16:9') return { width: 1920, height: 1080 };
    return { width: 1080, height: 1080 };
  };

  const enforceAspectRatio = async (imageUrl: string, ratio: AspectRatio): Promise<string> => {
    try {
      const img = await loadImage(imageUrl);
      const { width: targetW, height: targetH } = getAspectDimensions(ratio);
      const sourceRatio = img.width / img.height;
      const targetRatio = targetW / targetH;
      if (Math.abs(sourceRatio - targetRatio) < 0.01) return imageUrl;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return imageUrl;

      let drawW = targetW;
      let drawH = targetH;
      let drawX = 0;
      let drawY = 0;
      if (sourceRatio > targetRatio) {
        drawW = targetH * sourceRatio;
        drawX = (targetW - drawW) / 2;
      } else {
        drawH = targetW / sourceRatio;
        drawY = (targetH - drawH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      return canvas.toDataURL('image/png', 0.95);
    } catch {
      return imageUrl;
    }
  };

  const buildEditorBoxForStage = (stageWidth: number, stageHeight: number): EditorBoxState => {
    const safeStageWidth = Math.max(220, stageWidth);
    const safeStageHeight = Math.max(160, stageHeight);
    const defaultWidth = clamp(safeStageWidth * 0.55, 160, safeStageWidth);
    const defaultHeight = clamp(safeStageHeight * 0.27, 90, safeStageHeight);
    const defaultX = clamp((textConfig.positionX / 100) * safeStageWidth - defaultWidth / 2, 0, Math.max(0, safeStageWidth - defaultWidth));
    const defaultY = clamp((textConfig.positionY / 100) * safeStageHeight - defaultHeight / 2, 0, Math.max(0, safeStageHeight - defaultHeight));

    return {
      x: defaultX,
      y: defaultY,
      width: defaultWidth,
      height: defaultHeight,
      title: textConfig.title,
      detail: textConfig.detail,
      fontStyle: textConfig.fontStyle,
      mainColor: textConfig.mainColor,
      subColor: textConfig.subColor,
      textAlign: textConfig.textAlign || 'center',
      fontSize: Math.max(20, safeStageWidth * (textConfig.fontSize / 100)),
      shadowIntensity: textConfig.shadowIntensity,
      effect: 'minimal',
      writingMode: 'horizontal',
      gradientEnabled: false,
      gradientStart: '#3B82F6',
      gradientEnd: '#A855F7',
    };
  };

  const buildOverlayBox = async (
    imageUrl: string,
    config: { positionX: number; positionY: number; scale: number },
    stageWidth: number,
    stageHeight: number,
    minScale: number,
    maxScale: number
  ): Promise<OverlayBoxState> => {
    let ratio = 1;
    try {
      const img = await loadImage(imageUrl);
      if (img.width > 0 && img.height > 0) ratio = img.height / img.width;
    } catch {
      ratio = 1;
    }
    const width = clamp(stageWidth * (config.scale / 100), stageWidth * minScale, stageWidth * maxScale);
    const height = clamp(width * ratio, stageHeight * 0.04, stageHeight * 0.45);
    const centerX = (stageWidth * config.positionX) / 100;
    const centerY = (stageHeight * config.positionY) / 100;
    return {
      x: clamp(centerX - width / 2, 0, Math.max(0, stageWidth - width)),
      y: clamp(centerY - height / 2, 0, Math.max(0, stageHeight - height)),
      width,
      height,
    };
  };

  const syncEditorOverlays = async (stageWidth: number, stageHeight: number) => {
    if (logoImage) {
      const logoBox = await buildOverlayBox(logoImage, logoConfig, stageWidth, stageHeight, 0.06, 0.34);
      setEditorLogoBox(logoBox);
    } else {
      setEditorLogoBox(null);
    }

    if (stickerConfig.url) {
      const stickerBox = await buildOverlayBox(stickerConfig.url, stickerConfig, stageWidth, stageHeight, 0.06, 0.42);
      setEditorStickerBox(stickerBox);
    } else {
      setEditorStickerBox(null);
    }
  };

  const getSmartCornerPlacement = (
    stageWidth: number,
    stageHeight: number,
    targetWidth: number,
    targetHeight: number,
    avoidRect?: { x: number; y: number; width: number; height: number },
    blockRect?: { x: number; y: number; width: number; height: number }
  ) => {
    const margin = Math.max(12, Math.min(stageWidth, stageHeight) * 0.04);
    const candidates = [
      { x: margin, y: margin },
      { x: stageWidth - targetWidth - margin, y: margin },
      { x: margin, y: stageHeight - targetHeight - margin },
      { x: stageWidth - targetWidth - margin, y: stageHeight - targetHeight - margin },
    ].map(item => ({
      x: clamp(item.x, 0, Math.max(0, stageWidth - targetWidth)),
      y: clamp(item.y, 0, Math.max(0, stageHeight - targetHeight)),
    }));

    const rectCenter = (rect: { x: number; y: number; width: number; height: number }) => ({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    const overlapArea = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number }
    ) => {
      const overlapW = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const overlapH = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      return overlapW * overlapH;
    };

    let best = candidates[0];
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const candidateRect = { ...candidate, width: targetWidth, height: targetHeight };
      let score = 0;
      if (avoidRect) {
        const c1 = rectCenter(candidateRect);
        const c2 = rectCenter(avoidRect);
        score += Math.hypot(c1.x - c2.x, c1.y - c2.y);
        score -= overlapArea(candidateRect, avoidRect) * 4;
      } else {
        score += 30;
      }
      if (blockRect) {
        score -= overlapArea(candidateRect, blockRect) * 5;
      }
      if (candidate.y < stageHeight * 0.4) score += 18;
      if (candidate.x > stageWidth * 0.5) score += 6;

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  };

  const extractRecommendedPalette = async (imageUrl: string): Promise<string[]> => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('load image failed'));
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return ['#FFFFFF', '#111827', '#002FA7', '#D4AF37'];
    const sampleW = 120;
    const sampleH = Math.max(80, Math.round((img.height / img.width) * 120));
    canvas.width = sampleW;
    canvas.height = sampleH;
    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    const imageData = ctx.getImageData(0, 0, sampleW, sampleH).data;

    const bucket = new Map<string, number>();
    for (let i = 0; i < imageData.length; i += 16) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;
      bucket.set(key, (bucket.get(key) || 0) + 1);
    }

    const sorted = Array.from(bucket.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number);
        return `#${[r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')}`;
      });

    const avgLum = sorted.length
      ? sorted.reduce((sum, hex) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return sum + (0.2126 * r + 0.7152 * g + 0.0722 * b);
        }, 0) / sorted.length
      : 128;

    const contrastA = avgLum < 135 ? '#FFFFFF' : '#111827';
    const contrastB = avgLum < 135 ? '#E5E7EB' : '#374151';
    return [contrastA, contrastB, ...sorted, '#002FA7', '#D4AF37'].slice(0, 8);
  };

  const revokeLayerUrl = (url: string) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const resolveEditorStageSize = (stageSize?: { width: number; height: number }) => ({
    width: Math.max(1, stageSize?.width || editorStageSize.width || 780),
    height: Math.max(1, stageSize?.height || editorStageSize.height || 520),
  });

  const resolveLayerPositionPercent = (
    layer: Pick<TextLayer, 'x' | 'y' | 'positionUnit'>,
    stageSize?: { width: number; height: number }
  ) => {
    const { width, height } = resolveEditorStageSize(stageSize);
    if (layer.positionUnit === 'percent') {
      return { x: clamp(layer.x, 0, 100), y: clamp(layer.y, 0, 100) };
    }
    return {
      x: clamp((layer.x / width) * 100, 0, 100),
      y: clamp((layer.y / height) * 100, 0, 100),
    };
  };

  const toTextLayerFromBox = (
    imageId: string,
    box: EditorBoxState,
    existingId?: string,
    stageSize?: { width: number; height: number }
  ): TextLayer => {
    const { width: stageWidth, height: stageHeight } = resolveEditorStageSize(stageSize);
    return {
      id: existingId || `txt_${imageId}_${Math.random().toString(36).slice(2, 8)}`,
      text: box.title,
      subText: box.detail,
      fontFamily: FONT_REGISTRY[box.fontStyle].family,
      color: box.mainColor,
      subColor: box.subColor,
      fontSize: Math.max(12, box.fontSize),
      subFontSize: Math.max(12, Math.round(box.fontSize * 0.45)),
      x: clamp((box.x / stageWidth) * 100, 0, 100),
      y: clamp((box.y / stageHeight) * 100, 0, 100),
      positionUnit: 'percent',
      width: box.width,
      height: box.height,
      textShadow: `0 0 ${Math.max(8, box.shadowIntensity)}px rgba(0,0,0,0.58)`,
      textAlign: box.textAlign,
      shadowIntensity: box.shadowIntensity,
      fontStyle: box.fontStyle,
      subFontStyle: box.fontStyle,
      subFontFamily: FONT_REGISTRY[box.fontStyle].family,
      writingMode: box.writingMode,
      gradientEnabled: box.gradientEnabled,
      gradientStart: box.gradientStart,
      gradientEnd: box.gradientEnd,
    };
  };

  const toEditorBoxFromTextLayer = (
    layer: TextLayer,
    stageSize?: { width: number; height: number }
  ): EditorBoxState => {
    const { width: stageWidth, height: stageHeight } = resolveEditorStageSize(stageSize);
    const normalizedPosition = resolveLayerPositionPercent(layer, { width: stageWidth, height: stageHeight });
    const pxX = clamp((normalizedPosition.x / 100) * stageWidth, 0, Math.max(0, stageWidth - layer.width));
    const pxY = clamp((normalizedPosition.y / 100) * stageHeight, 0, Math.max(0, stageHeight - layer.height));

    return {
      x: pxX,
      y: pxY,
      width: layer.width,
      height: layer.height,
      title: layer.text,
      detail: layer.subText || '',
      fontStyle: layer.fontStyle || 'modern_sans',
      mainColor: layer.color,
      subColor: layer.subColor || '#E5E7EB',
      textAlign: layer.textAlign || 'left',
      fontSize: Math.max(12, layer.fontSize),
      shadowIntensity: layer.shadowIntensity ?? 12,
      effect: 'minimal',
      writingMode: layer.writingMode || 'horizontal',
      gradientEnabled: layer.gradientEnabled || false,
      gradientStart: layer.gradientStart || '#3B82F6',
      gradientEnd: layer.gradientEnd || '#A855F7',
    };
  };

  const toLayerStateFromCurrent = (
    imageId: string,
    box: EditorBoxState | null,
    layers: ImageLayer[],
    stageSize: { width: number; height: number } = editorStageSize
  ): LayerState => ({
    texts: box ? [toTextLayerFromBox(imageId, box, undefined, stageSize)] : [],
    images: layers.map(layer => ({ ...layer })),
    stageWidth: stageSize.width || undefined,
    stageHeight: stageSize.height || undefined,
  });

  const cloneLayerState = (state: LayerState): LayerState => ({
    texts: state.texts.map(layer => ({ ...layer })),
    images: state.images.map(layer => ({ ...layer })),
    stageWidth: state.stageWidth,
    stageHeight: state.stageHeight,
  });

  const resolveImageIdByUrl = (imageUrl: string): string | null => {
    const index = resultImages.findIndex(item => item === imageUrl);
    if (index >= 0) return getLightboxImageId(index);
    return null;
  };

  const updateActiveText = (key: keyof TextLayer, value: any) => {
    if (!activeTextId) return;
    setDraftConfig(prev => {
      const baseConfig: LayerState = prev || {
        texts: [],
        images: imageLayers.map(layer => ({ ...layer })),
        stageWidth: editorStageSize.width || undefined,
        stageHeight: editorStageSize.height || undefined,
      };
      return {
        ...baseConfig,
        texts: baseConfig.texts.map(t => t.id === activeTextId ? { ...t, [key]: value } : t),
      };
    });
  };

  const mergePanelSliderDraft = (layer: TextLayer, patch: Partial<NonNullable<typeof panelSliderDraft>>) => {
    setPanelSliderDraft(prev => ({
      width: prev?.width ?? layer.width,
      height: prev?.height ?? layer.height,
      fontSize: prev?.fontSize ?? layer.fontSize,
      shadowIntensity: prev?.shadowIntensity ?? (layer.shadowIntensity || 12),
      ...patch
    }));
  };

  const commitPanelSlider = (key: 'width' | 'height' | 'fontSize' | 'shadowIntensity') => {
    if (!activeTextId || !panelSliderDraft) return;
    const currentConfig = draftConfig;
    const activeLayer = currentConfig?.texts?.find(layer => layer.id === activeTextId);
    if (!activeLayer) return;
    const stageW = Math.max(1, editorStageSize.width || currentConfig?.stageWidth || 780);
    const stageH = Math.max(1, editorStageSize.height || currentConfig?.stageHeight || 520);
    const activeLayerPercent = resolveLayerPositionPercent(activeLayer, { width: stageW, height: stageH });
    const activeLayerXInPx = (activeLayerPercent.x / 100) * stageW;
    const activeLayerYInPx = (activeLayerPercent.y / 100) * stageH;

    if (key === 'width') {
      const maxBoxWidth = Math.max(180, editorStageSize.width || 780);
      const nextW = clamp(panelSliderDraft.width, 140, maxBoxWidth);
      const nextXInPx = clamp(activeLayerXInPx, 0, Math.max(0, stageW - nextW));
      updateActiveText('width', nextW);
      updateActiveText('x', clamp((nextXInPx / stageW) * 100, 0, 100));
      updateActiveText('positionUnit', 'percent');
      setPanelSliderDraft(prev => prev ? { ...prev, width: nextW } : prev);
      return;
    }

    if (key === 'height') {
      const maxBoxHeight = Math.max(110, editorStageSize.height || 520);
      const nextH = clamp(panelSliderDraft.height, 60, maxBoxHeight);
      const nextYInPx = clamp(activeLayerYInPx, 0, Math.max(0, stageH - nextH));
      updateActiveText('height', nextH);
      updateActiveText('y', clamp((nextYInPx / stageH) * 100, 0, 100));
      updateActiveText('positionUnit', 'percent');
      setPanelSliderDraft(prev => prev ? { ...prev, height: nextH } : prev);
      return;
    }

    if (key === 'fontSize') {
      const nextSize = clamp(panelSliderDraft.fontSize, 12, 72);
      if (activeTextTarget === 'secondary') {
        updateActiveText('subFontSize', nextSize);
      } else {
        updateActiveText('fontSize', nextSize);
      }
      setPanelSliderDraft(prev => prev ? { ...prev, fontSize: nextSize } : prev);
      return;
    }

    const nextShadow = clamp(panelSliderDraft.shadowIntensity, 0, 40);
    updateActiveText('shadowIntensity', nextShadow);
    updateActiveText('textShadow', `0 0 ${Math.max(8, nextShadow)}px rgba(0,0,0,0.58)`);
    setPanelSliderDraft(prev => prev ? { ...prev, shadowIntensity: nextShadow } : prev);
  };
  const handleSliderCommitByKey = (
    key: 'width' | 'height' | 'fontSize' | 'shadowIntensity',
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Enter' || e.key.startsWith('Arrow')) {
      commitPanelSlider(key);
    }
  };

  const handleAddText = () => {
    if (!currentImageId || activeTextTransformId) return;
    const newTextId = `txt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const defaultLayer: TextLayer = {
      id: newTextId,
      text: '输入文字...',
      fontFamily: FONT_REGISTRY.modern_sans.family,
      color: '#ffffff',
      fontSize: 24,
      subFontSize: 16,
      x: 14,
      y: 20,
      positionUnit: 'percent',
      width: 220,
      height: 72,
      textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
      subText: '',
      subColor: '#E5E7EB',
      textAlign: 'left',
      shadowIntensity: 14,
      fontStyle: 'modern_sans',
      subFontStyle: 'modern_sans',
      subFontFamily: FONT_REGISTRY.modern_sans.family,
      writingMode: 'horizontal',
      gradientEnabled: false,
      gradientStart: '#3B82F6',
      gradientEnd: '#A855F7',
    };
    setDraftConfig(prev => {
      const currentConfig: LayerState = prev || {
        texts: [],
        images: imageLayers.map(layer => ({ ...layer })),
        stageWidth: editorStageSize.width || undefined,
        stageHeight: editorStageSize.height || undefined,
      };
      return {
        ...currentConfig,
        texts: [...currentConfig.texts, defaultLayer]
      };
    });
    setActiveTextId(newTextId);
    setSelectedId(`text:${newTextId}`);
    setEditorBox(toEditorBoxFromTextLayer(defaultLayer, editorStageSize));
  };

  const handleDeleteText = (idToDelete: string) => {
    if (!currentImageId || activeTextTransformId) return;
    let nextActiveId: string | null = null;
    setDraftConfig(prev => {
      const currentConfig: LayerState = prev || {
        texts: [],
        images: imageLayers.map(layer => ({ ...layer })),
        stageWidth: editorStageSize.width || undefined,
        stageHeight: editorStageSize.height || undefined,
      };
      const remaining = currentConfig.texts.filter(t => t.id !== idToDelete);
      nextActiveId = remaining[0]?.id || null;
      return {
        ...currentConfig,
        texts: remaining
      };
    });
    setTextLayerDraftMap(prev => {
      if (!prev[idToDelete]) return prev;
      const next = { ...prev };
      delete next[idToDelete];
      return next;
    });
    if (activeTextId === idToDelete) {
      setActiveTextId(nextActiveId);
    }
    if (selectedId === `text:${idToDelete}`) {
      setSelectedId(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const layerId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newLayer: ImageLayer = {
      id: layerId,
      url: objectUrl,
      x: 50,
      y: 50,
      width: 100,
      height: 100
    };
    setImageLayers(prev => [...prev, newLayer]);
    setDraftConfig(prev => {
      const currentConfig: LayerState = prev || {
        texts: [],
        images: [],
        stageWidth: editorStageSize.width || undefined,
        stageHeight: editorStageSize.height || undefined,
      };
      return {
        ...currentConfig,
        images: [...currentConfig.images, newLayer],
      };
    });
    setActiveImageLayerId(layerId);
    setSelectedId(`image:${layerId}`);
    e.target.value = '';
  };

  const removeImageLayer = (id: string) => {
    setImageLayers(prev => prev.filter(layer => layer.id !== id));
    setDraftConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        images: prev.images.filter(layer => layer.id !== id),
      };
    });
    setActiveImageLayerId(prev => (prev === id ? null : prev));
    if (selectedId === `image:${id}`) {
      setSelectedId(null);
    }
  };

  const openLightboxEditor = async (target: LightboxTarget) => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844;
    const fallbackStageWidth = clamp(viewportWidth - 120, 240, 560);
    const fallbackStageHeight = clamp(viewportHeight - 260, 180, 460);
    const imageId = getLightboxImageId(target.index);
    const cachedConfig = globalLayerConfig[imageId];
    const initialStageSize = {
      width: cachedConfig?.stageWidth || fallbackStageWidth,
      height: cachedConfig?.stageHeight || fallbackStageHeight,
    };
    const initialLayerState = cachedConfig
      ? cloneLayerState(cachedConfig)
      : toLayerStateFromCurrent(
          imageId,
          buildEditorBoxForStage(fallbackStageWidth, fallbackStageHeight),
          [],
          initialStageSize
        );
    const cachedTextLayer = initialLayerState.texts?.[0];
    const initialBox = cachedTextLayer
      ? toEditorBoxFromTextLayer(cachedTextLayer, initialStageSize)
      : buildEditorBoxForStage(fallbackStageWidth, fallbackStageHeight);
    const initialImages = initialLayerState.images.map(layer => ({ ...layer }));

    setCurrentImageId(imageId);
    setImageLayers(initialImages);
    setDraftConfig({
      ...initialLayerState,
      stageWidth: initialLayerState.stageWidth || initialStageSize.width,
      stageHeight: initialLayerState.stageHeight || initialStageSize.height,
    });
    setActiveImageLayerId(null);
    setActiveTextId(cachedTextLayer?.id || null);
    setSelectedId(null);
    setIsLightboxExporting(false);
    setLightboxTarget(target);
    setEditorInitialized(false);
    setOverlayAutoPlaced(false);
    setEditorGuides({ v: null, h: null });
    setEditorStageSize({ width: 0, height: 0 });
    setEditorBox(initialBox);
    await syncEditorOverlays(fallbackStageWidth, fallbackStageHeight);
    try {
      const palette = await extractRecommendedPalette(target.url);
      setEditorPalette(palette);
    } catch {
      setEditorPalette(['#FFFFFF', '#111827', '#002FA7', '#D4AF37']);
    }
  };

  const closeLightboxEditor = () => {
    if (currentImageId) {
      const activeConfig = draftConfig || globalLayerConfigRef.current[currentImageId] || globalLayerConfig[currentImageId];
      const fallbackLayer = activeConfig?.texts?.[0];
      const activeLayer = activeConfig?.texts?.find(layer => layer.id === activeTextId) || fallbackLayer;
      if (activeLayer) {
        const stageW = Math.max(1, editorStageSize.width || activeConfig?.stageWidth || 780);
        const stageH = Math.max(1, editorStageSize.height || activeConfig?.stageHeight || 520);
        const activeLayerPercent = resolveLayerPositionPercent(activeLayer, { width: stageW, height: stageH });
        const nextPositionX = clamp(activeLayerPercent.x + ((activeLayer.width / 2) / stageW) * 100, 0, 100);
        const nextPositionY = clamp(activeLayerPercent.y + ((activeLayer.height / 2) / stageH) * 100, 0, 100);
        setTextConfig(prev => ({
          ...prev,
          title: activeLayer.text?.trim() ? activeLayer.text : prev.title,
          detail: activeLayer.subText?.trim() ? activeLayer.subText : prev.detail,
          positionX: nextPositionX,
          positionY: nextPositionY,
          textAlign: activeLayer.textAlign || prev.textAlign,
          fontStyle: activeLayer.fontStyle || prev.fontStyle,
          fontSize: clamp(Math.round((activeLayer.fontSize / stageW) * 100), 4, 25),
          shadowIntensity: activeLayer.shadowIntensity ?? prev.shadowIntensity,
          mainColor: activeLayer.color || prev.mainColor,
          subColor: activeLayer.subColor || prev.subColor,
        }));
      }
    }

    setLightboxTarget(null);
    setActiveTextTransformId(null);
    setTextLayerDraftMap({});
    setDraftConfig(null);
    setSelectedId(null);
    setActiveImageLayerId(null);
    setActiveTextId(null);
    setPanelSliderDraft(null);
    setImageLayers([]);
    setCurrentImageId('');
  };

  const handleSaveCurrentDraft = () => {
    if (!currentImageId || !draftConfig) {
      closeLightboxEditor();
      return;
    }
    const currentConfig: LayerState = {
      ...cloneLayerState(draftConfig),
      stageWidth: draftConfig.stageWidth || editorStageSize.width || undefined,
      stageHeight: draftConfig.stageHeight || editorStageSize.height || undefined,
    };
    setGlobalLayerConfig(prev => ({
      ...prev,
      [currentImageId]: currentConfig,
    }));
    setToastMessage('✅ 本张排版已保存');
    closeLightboxEditor();
  };

  const handleApplyDraftToAll = () => {
    if (!currentImageId || !draftConfig) return;
    const currentConfig: LayerState = {
      ...cloneLayerState(draftConfig),
      stageWidth: draftConfig.stageWidth || editorStageSize.width || undefined,
      stageHeight: draftConfig.stageHeight || editorStageSize.height || undefined,
    };
    if (!currentConfig || (currentConfig.texts.length === 0 && currentConfig.images.length === 0)) return;

    const allImageIds = getAllLightboxImageIds();
    if (allImageIds.length <= 1) {
      setToastMessage('当前仅有 1 张图，无需克隆');
      return;
    }

    setGlobalLayerConfig(prev => {
      const newConfig: Record<string, LayerState> = { ...prev };
      allImageIds.forEach(id => {
        if (id === currentImageId) {
          newConfig[id] = {
            texts: currentConfig.texts.map(textLayer => ({ ...textLayer })),
            images: currentConfig.images.map(layer => ({ ...layer })),
            stageWidth: currentConfig.stageWidth,
            stageHeight: currentConfig.stageHeight,
          };
          return;
        }
        newConfig[id] = {
          texts: currentConfig.texts.map(textLayer => ({
            ...textLayer,
            id: `txt_${id}_${Math.random().toString(36).slice(2, 8)}`,
          })),
          images: currentConfig.images.map(layer => ({
            ...layer,
            id: `img_${id}_${Math.random().toString(36).slice(2, 8)}`
          })),
          stageWidth: currentConfig.stageWidth,
          stageHeight: currentConfig.stageHeight,
        };
      });
      return newConfig;
    });

    setToastMessage('✨ 当前排版已完美克隆至同组全部图片！');
    closeLightboxEditor();
  };

  const applySmartOverlayPlacement = () => {
    const stageWidth = editorStageSize.width || (editorStageRef.current?.clientWidth || 0);
    const stageHeight = editorStageSize.height || (editorStageRef.current?.clientHeight || 0);
    if (!stageWidth || !stageHeight) return;

    const textRect = editorBox
      ? { x: editorBox.x, y: editorBox.y, width: editorBox.width, height: editorBox.height }
      : undefined;

    let smartLogoRect: { x: number; y: number; width: number; height: number } | undefined;
    if (editorLogoBox) {
      const logoPos = getSmartCornerPlacement(stageWidth, stageHeight, editorLogoBox.width, editorLogoBox.height, textRect);
      smartLogoRect = { ...logoPos, width: editorLogoBox.width, height: editorLogoBox.height };
      setEditorLogoBox(prev => prev ? { ...prev, x: logoPos.x, y: logoPos.y } : prev);
      setLogoConfig(prev => ({
        ...prev,
        positionX: ((logoPos.x + editorLogoBox.width / 2) / stageWidth) * 100,
        positionY: ((logoPos.y + editorLogoBox.height / 2) / stageHeight) * 100,
      }));
    }

    if (editorStickerBox) {
      const stickerPos = getSmartCornerPlacement(
        stageWidth,
        stageHeight,
        editorStickerBox.width,
        editorStickerBox.height,
        textRect,
        smartLogoRect
      );
      setEditorStickerBox(prev => prev ? { ...prev, x: stickerPos.x, y: stickerPos.y } : prev);
      setStickerConfig(prev => ({
        ...prev,
        positionX: ((stickerPos.x + editorStickerBox.width / 2) / stageWidth) * 100,
        positionY: ((stickerPos.y + editorStickerBox.height / 2) / stageHeight) * 100,
      }));
    }
  };

  const wrapTextByWidth = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const lines: string[] = [];
    const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
    paragraphs.forEach((paragraph, index) => {
      const chars = Array.from(paragraph);
      let line = '';
      for (const ch of chars) {
        const testLine = `${line}${ch}`;
        if (line && ctx.measureText(testLine).width > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line = testLine;
        }
      }
      lines.push(line);
      if (index < paragraphs.length - 1) lines.push('');
    });
    return lines;
  };

  const drawHorizontalTextBlock = (
    ctx: CanvasRenderingContext2D,
    text: string,
    box: { x: number; y: number; width: number; height: number },
    fontSize: number,
    fontFamily: string,
    fontWeight: number,
    align: 'left' | 'center' | 'right',
    fillStyle: string | CanvasGradient,
    shadowBlur: number
  ): number => {
    if (!text.trim()) return box.y;
    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = fillStyle;
    if (shadowBlur > 0) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = Math.max(1, shadowBlur * 0.16);
      ctx.shadowOffsetY = Math.max(1, shadowBlur * 0.18);
    }

    const lines = wrapTextByWidth(ctx, text, box.width);
    const lineHeight = Math.max(fontSize * 1.18, fontSize + 4);
    let y = box.y;
    const x = align === 'left' ? box.x : align === 'right' ? box.x + box.width : box.x + box.width / 2;

    for (const line of lines) {
      if (y + lineHeight > box.y + box.height) break;
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    ctx.restore();
    return y;
  };

  const drawVerticalTextBlock = (
    ctx: CanvasRenderingContext2D,
    text: string,
    box: { x: number; y: number; width: number; height: number },
    fontSize: number,
    fontFamily: string,
    fontWeight: number,
    align: 'left' | 'center' | 'right',
    fillStyle: string | CanvasGradient,
    shadowBlur: number
  ): number => {
    const pureText = Array.from(text.replace(/\s+/g, ''));
    if (pureText.length === 0) return box.x;

    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fillStyle;
    if (shadowBlur > 0) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = Math.max(1, shadowBlur * 0.14);
      ctx.shadowOffsetY = Math.max(1, shadowBlur * 0.16);
    }

    const stepY = Math.max(fontSize * 1.15, fontSize + 2);
    const maxRows = Math.max(1, Math.floor(box.height / stepY));
    const colGap = Math.max(fontSize * 1.08, fontSize + 4);
    const totalCols = Math.ceil(pureText.length / maxRows);
    const totalWidth = totalCols * colGap;
    let startX = box.x;
    if (align === 'center') startX = box.x + (box.width - totalWidth) / 2;
    if (align === 'right') startX = box.x + box.width - totalWidth;

    for (let col = 0; col < totalCols; col++) {
      const x = startX + col * colGap + colGap / 2;
      for (let row = 0; row < maxRows; row++) {
        const index = col * maxRows + row;
        if (index >= pureText.length) break;
        const y = box.y + row * stepY + fontSize * 0.55;
        if (y > box.y + box.height) break;
        ctx.fillText(pureText[index], x, y);
      }
    }

    ctx.restore();
    return startX + totalWidth;
  };

  const drawImageContainToBox = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    const boxWidth = Math.max(0, box.width);
    const boxHeight = Math.max(0, box.height);
    if (!boxWidth || !boxHeight) return;

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return;

    const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = box.x + (boxWidth - drawWidth) / 2;
    const drawY = box.y + (boxHeight - drawHeight) / 2;

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  };

  const renderLayerStateToDataUrl = async (
    baseImageUrl: string,
    layerState: LayerState,
    overlay?: { logoBox?: OverlayBoxState | null; stickerBox?: OverlayBoxState | null }
  ): Promise<string> => {
    const baseImage = await loadImage(baseImageUrl);
    const canvas = document.createElement('canvas');
    canvas.width = baseImage.naturalWidth || baseImage.width;
    canvas.height = baseImage.naturalHeight || baseImage.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('导出画布初始化失败');

    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    const stageWidth = layerState.stageWidth || editorStageSize.width || canvas.width;
    const stageHeight = layerState.stageHeight || editorStageSize.height || canvas.height;
    const scaleX = canvas.width / Math.max(1, stageWidth);
    const scaleY = canvas.height / Math.max(1, stageHeight);

    for (const layer of layerState.texts || []) {
      const mappedX = layer.positionUnit === 'percent'
        ? (clamp(layer.x, 0, 100) / 100) * canvas.width
        : layer.x * scaleX;
      const mappedY = layer.positionUnit === 'percent'
        ? (clamp(layer.y, 0, 100) / 100) * canvas.height
        : layer.y * scaleY;
      const mappedBox = {
        x: mappedX,
        y: mappedY,
        width: layer.width * scaleX,
        height: layer.height * scaleY,
      };
      const safeMainSize = Math.max(16, layer.fontSize * scaleX);
      const safeSubSize = Math.max(12, (layer.subFontSize ?? Math.max(12, layer.fontSize * 0.45)) * scaleX);
      const shadowBlur = Math.max(0, (layer.shadowIntensity ?? 12) * 0.68);
      const fontFamily = layer.fontFamily || FONT_REGISTRY[layer.fontStyle || 'modern_sans'].family;
      const subFontFamily = layer.subFontFamily || FONT_REGISTRY[layer.subFontStyle || layer.fontStyle || 'modern_sans'].family;
      const textAlign = layer.textAlign || 'left';

      let titlePaint: string | CanvasGradient = layer.color;
      if (layer.gradientEnabled && layer.gradientStart && layer.gradientEnd) {
        const gradient = ctx.createLinearGradient(
          mappedBox.x,
          mappedBox.y,
          layer.writingMode === 'vertical' ? mappedBox.x : mappedBox.x + mappedBox.width,
          layer.writingMode === 'vertical' ? mappedBox.y + mappedBox.height : mappedBox.y
        );
        gradient.addColorStop(0, layer.gradientStart);
        gradient.addColorStop(1, layer.gradientEnd);
        titlePaint = gradient;
      }
      const subPaint: string | CanvasGradient = layer.subColor || '#E5E7EB';

      if ((layer.writingMode || 'horizontal') === 'vertical') {
        const titleRightEdge = drawVerticalTextBlock(
          ctx,
          layer.text,
          mappedBox,
          safeMainSize,
          fontFamily,
          900,
          textAlign,
          titlePaint,
          shadowBlur
        );
        if (layer.subText) {
          const detailGap = Math.max(12, safeMainSize * 0.32);
          const detailBox = {
            x: Math.min(mappedBox.x + mappedBox.width - Math.max(40, safeSubSize), titleRightEdge + detailGap),
            y: mappedBox.y,
            width: Math.max(40, mappedBox.x + mappedBox.width - (titleRightEdge + detailGap)),
            height: mappedBox.height,
          };
          drawVerticalTextBlock(
            ctx,
            layer.subText,
            detailBox,
            safeSubSize,
            subFontFamily,
            500,
            'left',
            subPaint,
            Math.max(0, shadowBlur * 0.7)
          );
        }
      } else {
        const nextY = drawHorizontalTextBlock(
          ctx,
          layer.text,
          mappedBox,
          safeMainSize,
          fontFamily,
          800,
          textAlign,
          titlePaint,
          shadowBlur
        );
        if (layer.subText) {
          drawHorizontalTextBlock(
            ctx,
            layer.subText,
            {
              ...mappedBox,
              y: Math.min(mappedBox.y + mappedBox.height - safeSubSize, nextY + Math.max(8, safeSubSize * 0.35)),
              height: Math.max(24, mappedBox.height - (nextY - mappedBox.y)),
            },
            safeSubSize,
            subFontFamily,
            500,
            textAlign,
            subPaint,
            Math.max(0, shadowBlur * 0.7)
          );
        }
      }
    }

    for (const layer of layerState.images || []) {
      try {
        const layerImage = await loadImage(layer.url);
        const mappedLayer = {
          x: layer.x * scaleX,
          y: layer.y * scaleY,
          width: layer.width * scaleX,
          height: layer.height * scaleY,
        };
        drawImageContainToBox(ctx, layerImage, mappedLayer);
      } catch (error) {
        console.warn('draw custom image layer failed:', error);
      }
    }

    const logoBox = overlay?.logoBox || null;
    if (logoImage && logoBox) {
      try {
        const logoImg = await loadImage(logoImage);
        const mappedLogo = {
          x: logoBox.x * scaleX,
          y: logoBox.y * scaleY,
          width: logoBox.width * scaleX,
          height: logoBox.height * scaleY,
        };
        drawImageContainToBox(ctx, logoImg, mappedLogo);
      } catch (error) {
        console.warn('draw logo overlay failed:', error);
      }
    }

    const stickerBox = overlay?.stickerBox || null;
    if (stickerConfig.url && stickerBox) {
      try {
        const stickerImg = await loadImage(stickerConfig.url);
        const mappedSticker = {
          x: stickerBox.x * scaleX,
          y: stickerBox.y * scaleY,
          width: stickerBox.width * scaleX,
          height: stickerBox.height * scaleY,
        };
        drawImageContainToBox(ctx, stickerImg, mappedSticker);
      } catch (error) {
        console.warn('draw sticker overlay failed:', error);
      }
    }

    return canvas.toDataURL('image/png', 0.95);
  };

  const composeLightboxDownloadDataUrl = async (): Promise<string> => {
    if (!lightboxTarget) throw new Error('编辑内容不存在');
    const currentLayerState = draftConfig || (currentImageId ? globalLayerConfig[currentImageId] : undefined);
    const layerState: LayerState = {
      texts: currentLayerState?.texts?.map(layer => ({ ...layer })) || [],
      images: (currentLayerState?.images?.length ? currentLayerState.images : imageLayers).map(layer => ({ ...layer })),
      stageWidth: currentLayerState?.stageWidth || editorStageSize.width || undefined,
      stageHeight: currentLayerState?.stageHeight || editorStageSize.height || undefined,
    };
    return renderLayerStateToDataUrl(lightboxTarget.url, layerState, {
      logoBox: editorLogoBox,
      stickerBox: editorStickerBox,
    });
  };

  const composeResultDownloadDataUrl = async (baseImageUrl: string): Promise<string> => {
    const imageId = resolveImageIdByUrl(baseImageUrl);
    if (imageId) {
      const layerState = globalLayerConfig[imageId];
      if (layerState && ((layerState.texts?.length || 0) > 0 || (layerState.images?.length || 0) > 0)) {
        return renderLayerStateToDataUrl(baseImageUrl, layerState);
      }
    }

    if (!textConfig.isEnabled || (!textConfig.title && !textConfig.detail)) return baseImageUrl;
    const fontFamily = await preloadFont(textConfig.fontStyle);
    return exportImageWithText(baseImageUrl, textConfig, fontFamily);
  };

  const captureLightboxStageDataUrl = async (): Promise<string> => {
    const captureNode = editorStageRef.current || editorCaptureRef.current;
    if (!captureNode) throw new Error('未找到可导出区域');
    const exportMarkerAttr = 'data-export-capture-node';
    captureNode.setAttribute(exportMarkerAttr, '1');

    setIsLightboxExporting(true);
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    try {
      const pixelScale = typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : 3;
      const canvas = await html2canvas(captureNode, {
        useCORS: true,
        scale: pixelScale,
        backgroundColor: null,
        onclone: (clonedDoc: Document) => {
          const selector = `[${exportMarkerAttr}="1"]`;
          const clonedTarget = clonedDoc.querySelector(selector) as HTMLElement | null;
          if (!clonedTarget) return;
          try {
            sanitizeHtml2CanvasCloneColors(captureNode, clonedTarget);
          } catch (sanitizeError) {
            console.warn('html2canvas clone color sanitize failed:', sanitizeError);
          }
        },
      });
      return canvas.toDataURL('image/png');
    } finally {
      captureNode.removeAttribute(exportMarkerAttr);
      setIsLightboxExporting(false);
    }
  };

  const handleLightboxDownload = async () => {
    if (!lightboxTarget || isLightboxDownloading) return;
    const activeLayers = draftConfig?.images || (currentImageId ? (globalLayerConfig[currentImageId]?.images || imageLayers) : imageLayers);
    setIsLightboxDownloading(true);
    try {
      if (activeLayers.length > 0) {
        const layeredDataUrl = await captureLightboxStageDataUrl();
        const fileName = buildDownloadFileName(`高清图${lightboxTarget.index + 1}`);
        await triggerDownload(layeredDataUrl, fileName);
        return;
      }

      const mergedDataUrl = await composeLightboxDownloadDataUrl();
      const fileName = buildDownloadFileName(`高清图${lightboxTarget.index + 1}`);
      await triggerDownload(mergedDataUrl, fileName);
    } catch (error) {
      console.error("Lightbox download failed:", error);
      try {
        // 首选纯画布合成兜底，彻底绕过 html2canvas 对 oklch 的解析限制。
        const composeFallbackDataUrl = await composeLightboxDownloadDataUrl();
        await triggerDownload(composeFallbackDataUrl, buildDownloadFileName(`高清图${lightboxTarget.index + 1}`));
      } catch (composeFallbackError) {
        console.error("Lightbox download compose fallback failed:", composeFallbackError);
        try {
          const captureFallbackDataUrl = await captureLightboxStageDataUrl();
          await triggerDownload(captureFallbackDataUrl, buildDownloadFileName(`高清图${lightboxTarget.index + 1}`));
        } catch (captureFallbackError) {
          console.error("Lightbox download capture fallback failed:", captureFallbackError);
          alert("下载失败：请长按图片保存，或稍后重试。");
        }
      }
    } finally {
      setIsLightboxDownloading(false);
    }
  };

  const [isAnalyzingPrompt, setIsAnalyzingPrompt] = useState(false);
  const [isExtractingCopy, setIsExtractingCopy] = useState(false);
  const [promptGlowState, setPromptGlowState] = useState<TextGlowState>('idle');
  const [copyGlowState, setCopyGlowState] = useState<TextGlowState>('idle');
  const [buttonDoneFlash, setButtonDoneFlash] = useState<{
    prompt: boolean;
    copy: boolean;
    genSingle: boolean;
    genMatrix: boolean;
  }>({
    prompt: false,
    copy: false,
    genSingle: false,
    genMatrix: false,
  });

  const authInitRef = useRef(false);
  const promptGlowTimeoutRef = useRef<number | null>(null);
  const copyGlowTimeoutRef = useRef<number | null>(null);

  const flashButtonDone = useCallback((target: 'prompt' | 'copy' | 'genSingle' | 'genMatrix') => {
    setButtonDoneFlash((prev) => ({ ...prev, [target]: true }));
    window.setTimeout(() => {
      setButtonDoneFlash((prev) => ({ ...prev, [target]: false }));
    }, 1200);
  }, []);

  const triggerTextGlowSuccess = useCallback((target: 'prompt' | 'copy') => {
    const timeoutRef = target === 'prompt' ? promptGlowTimeoutRef : copyGlowTimeoutRef;
    const setState = target === 'prompt' ? setPromptGlowState : setCopyGlowState;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    setState('success');
    timeoutRef.current = window.setTimeout(() => {
      setState('idle');
      timeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    if (!isExtractingCopy) {
      setCopywritingCountdown(null);
      return;
    }
    setCopywritingCountdown(60);
    const timer = window.setInterval(() => {
      setCopywritingCountdown(prev => {
        if (prev === null) return 60;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isExtractingCopy]);

  useEffect(() => {
    if (!isAnalyzingPrompt) {
      setPromptCountdown(null);
      return;
    }
    setPromptCountdown(60);
    const timer = window.setInterval(() => {
      setPromptCountdown(prev => {
        if (prev === null) return 60;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAnalyzingPrompt]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const handleClickOutsideMenu = (event: MouseEvent) => {
      if (!avatarMenuRef.current) return;
      if (!avatarMenuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu);
  }, []);

  useEffect(() => {
    return () => {
      if (promptGlowTimeoutRef.current !== null) {
        window.clearTimeout(promptGlowTimeoutRef.current);
      }
      if (copyGlowTimeoutRef.current !== null) {
        window.clearTimeout(copyGlowTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    imageLayersRef.current = imageLayers;
  }, [imageLayers]);

  useEffect(() => {
    globalLayerConfigRef.current = globalLayerConfig;
  }, [globalLayerConfig]);

  useEffect(() => {
    if (!lightboxTarget || activeTextTransformId) return;
    setDraftConfig(prev => {
      if (!prev) return prev;
      const nextImages = imageLayers.map(layer => ({ ...layer }));
      const imagesUnchanged =
        prev.images.length === nextImages.length &&
        prev.images.every((layer, index) => {
          const next = nextImages[index];
          return !!next &&
            layer.id === next.id &&
            layer.url === next.url &&
            layer.x === next.x &&
            layer.y === next.y &&
            layer.width === next.width &&
            layer.height === next.height;
        });
      const nextStageWidth = editorStageSize.width || prev.stageWidth;
      const nextStageHeight = editorStageSize.height || prev.stageHeight;
      if (imagesUnchanged && prev.stageWidth === nextStageWidth && prev.stageHeight === nextStageHeight) {
        return prev;
      }
      return {
        ...prev,
        images: nextImages,
        stageWidth: nextStageWidth,
        stageHeight: nextStageHeight,
      };
    });
  }, [lightboxTarget, imageLayers, editorStageSize.width, editorStageSize.height, activeTextTransformId]);

  useEffect(() => {
    setTextLayerDraftMap({});
    setActiveTextTransformId(null);
    setSelectedId(null);
  }, [currentImageId, lightboxTarget]);

  useEffect(() => {
    return () => {
      const allUrls = new Set<string>();
      imageLayersRef.current.forEach(layer => allUrls.add(layer.url));
      Object.values(globalLayerConfigRef.current).forEach(layerState => {
        layerState.images.forEach(layer => allUrls.add(layer.url));
      });
      allUrls.forEach(url => revokeLayerUrl(url));
    };
  }, []);

  // 初始化拦截：处理 Authing 登录后的回调重定向并拿取 Token 及全局状态
  useEffect(() => {
    const initAuth = async () => {
      if (!authing || authInitRef.current) return;
      authInitRef.current = true;
      
      try {
        const urlParams = window.location.search || window.location.hash;
        if (urlParams.includes('code=')) {
          try {
            await authing.handleRedirectCallback();
          } catch (cbErr) {
            console.warn("回调处理异常，可能是重复消费:", cbErr);
          } finally {
            // 强制清理网址上残留的 #code 或 ?code，保持地址栏干净
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
        const state = await authing.getLoginState();
        if (state) {
          try {
            // 核心修复：单独捕获 getUserInfo 的过期异常
            const info = await authing.getUserInfo();
            setIsLoggedIn(true);
            setUserInfo(info);
            // 核心修复：防止存入 "undefined" 字符串，优先使用 idToken，兜底使用 accessToken
            const validToken = state.idToken || state.accessToken || "";
            localStorage.setItem('authing_token', validToken);
            setAuthTokenReady(Boolean(validToken));
          } catch (userInfoErr: any) {
            console.warn("🚨 获取用户信息失败，Token 可能已过期，正在清理本地状态:", userInfoErr);
            // 遇到无效 Token，强制清空并恢复未登录状态，绝不阻断 UI
            setIsLoggedIn(false);
            setUserInfo(null);
            setAuthTokenReady(false);
            localStorage.removeItem('authing_token');
          }
        } else {
          setIsLoggedIn(false);
          setUserInfo(null);
          setAuthTokenReady(false);
          localStorage.removeItem('authing_token');
        }
      } catch (err) {
        console.error("Authing init error:", err);
        setIsLoggedIn(false);
        setUserInfo(null);
        setAuthTokenReady(false);
      } finally {
        setIsAuthLoading(false);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    const key = 'dsb_mock_user_id';
    const existing = localStorage.getItem(key)?.trim();
    if (existing) {
      setLocalUserId(existing);
      return;
    }
    const randomPart = Math.random().toString(36).slice(2, 10);
    const generated = `u_${Date.now().toString(36)}_${randomPart}`;
    localStorage.setItem(key, generated);
    setLocalUserId(generated);
  }, []);

  const refreshUserCredits = useCallback(async () => {
    if (!localUserId) return;
    setIsCreditsLoading(true);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const inviteCode = searchParams.get('invite')?.trim() || '';
      const query = new URLSearchParams({ userId: localUserId });
      if (inviteCode) query.set('inviteCode', inviteCode);

      const res = await fetch(`/api/user?${query.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || '资产查询失败');
      }
      if (!data?.success) {
        throw new Error('资产数据格式异常');
      }
      const quota = Number(data?.image_quota ?? data?.credits);
      if (!Number.isFinite(quota)) {
        throw new Error('资产数据格式异常');
      }
      setUserCredits(quota);
      setUserVipExpireDate(data?.vip_expire_date ? String(data.vip_expire_date) : null);
      setUserInviteCode(String(data?.invite_code || '').trim());
    } catch (error) {
      console.error('[credits] query failed:', error);
      setUserCredits(null);
      setUserVipExpireDate(null);
    } finally {
      setIsCreditsLoading(false);
    }
  }, [localUserId]);

  useEffect(() => {
    if (!localUserId) return;
    void refreshUserCredits();
  }, [localUserId, refreshUserCredits]);

  const syncAssetsFromGemini = useCallback(() => {
    const latestAssets = consumeLatestAssetSnapshot();
    if (!latestAssets) return false;

    if (typeof latestAssets.image_quota === 'number' && Number.isFinite(latestAssets.image_quota)) {
      setUserCredits(Math.max(0, latestAssets.image_quota));
    }

    if (Object.prototype.hasOwnProperty.call(latestAssets, 'vip_expire_date')) {
      setUserVipExpireDate(latestAssets.vip_expire_date ? String(latestAssets.vip_expire_date) : null);
    }

    return true;
  }, []);

  const getVipStatusText = useCallback(() => {
    if (!userVipExpireDate) return '免费试用中';
    const ts = Date.parse(userVipExpireDate);
    if (!Number.isFinite(ts) || ts <= Date.now()) return '免费试用中';
    return `${userVipExpireDate.slice(0, 10)} 到期`;
  }, [userVipExpireDate]);

  useEffect(() => {
    const handleAuthExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setIsLoggedIn(false);
      setUserInfo(null);
      setAuthTokenReady(false);
      localStorage.removeItem('authing_token');
      setToastMessage(detail?.message || '登录状态尚未就绪或已失效，请重新登录后再试。');
    };

    window.addEventListener('auth-expired', handleAuthExpired as EventListener);
    return () => window.removeEventListener('auth-expired', handleAuthExpired as EventListener);
  }, []);

  const authReady = !isAuthLoading && isLoggedIn && !!userInfo && authTokenReady;

  const isAuthErrorMessage = useCallback((message: string) => {
    return (
      message.includes('AUTH_REQUIRED') ||
      message.includes('登录状态尚未就绪') ||
      message.includes('登录身份已失效') ||
      message.includes('身份认证失败') ||
      message.includes('鉴权被拒')
    );
  }, []);

  const ensureAuthReady = useCallback((engineLabel: string) => {
    if (isAuthLoading) {
      setToastMessage('登录状态同步中，请稍后再试。');
      return false;
    }

    if (!authReady) {
      setToastMessage(`${engineLabel}暂不可用，请重新登录或等待登录状态同步完成。`);
      return false;
    }

    return true;
  }, [authReady, isAuthLoading]);

  const handleLogout = async () => {
    await authing.logoutWithRedirect({ redirectUri: window.location.origin });
  };

  const handleLogin = async () => {
    try {
      await authing.loginWithRedirect();
    } catch (err: any) {
      console.error("Login Error:", err);
      alert(err.message || "登录跳转失败，请检查网络或联系管理员");
    }
  };

  // 轮播电商锦囊逻辑 (每8秒切换一次)
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ECOMMERCE_TIPS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // 进度条模拟逻辑
  useEffect(() => {
    let interval: number;
    if (isProcessing) {
      setProgress(0);
      const phases = [
        "👀 正在仔细端详您的商品细节...", 
        "🛠️ 正在搭建百万级商业摄影棚...", 
        "💡 灯光师已就位，疯狂打光中...", 
        "👗 正在布置高级背景与氛围道具...",
        "✨ 正在注入灵魂，生成最终大片..."
      ];
      let step = 0;
      setProgressText(phases[0]);

      interval = window.setInterval(() => {
        setProgress(p => {
          if (p >= 99) return 99; // 强行锁死最高进度为 99%
          const nextP = p + (Math.random() * 5 + 1);
          if (nextP > 20 && step === 0) { step = 1; setProgressText(phases[1]); }
          if (nextP > 40 && step === 1) { step = 2; setProgressText(phases[2]); }
          if (nextP > 60 && step === 2) { step = 3; setProgressText(phases[3]); }
          if (nextP > 80 && step === 3) { step = 4; setProgressText(phases[4]); }
          return nextP > 99 ? 99 : nextP;
        });
      }, 600);
    } else {
      setProgress(100);
      setProgressText("渲染完成！");
      setTimeout(() => setProgress(0), 1000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    let intervalId: any;
    if (isProcessing) {
      setLoadingBrief(BRIEF_STEPS[0]);
      let stepIndex = 1;
      intervalId = setInterval(() => {
        setLoadingBrief(BRIEF_STEPS[stepIndex % BRIEF_STEPS.length]);
        stepIndex++;
      }, 3500);
    } else {
      setLoadingBrief('');
    }
    return () => clearInterval(intervalId);
  }, [isProcessing]);

  useEffect(() => {
    let interval: number | undefined;
    if (isProcessing) {
      setLogIndex(0);
      interval = window.setInterval(() => {
        setLogIndex((prev) => (prev + 1) % logMessages.length);
      }, 2500);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isProcessing]);

  // 全局禁用浏览器文件拖拽打开页面，防止误拖导致整页跳转丢失状态
  useEffect(() => {
    const preventFileDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('dragover', preventFileDrop);
    window.addEventListener('drop', preventFileDrop);
    return () => {
      window.removeEventListener('dragover', preventFileDrop);
      window.removeEventListener('drop', preventFileDrop);
    };
  }, []);

  // 结果图更新后，智能探测文案区域明暗并自动选择可读性色彩
  useEffect(() => {
    const firstAvailableResultImage = resultImages.find((imageUrl): imageUrl is string => Boolean(imageUrl));
    if (!isAutoTextContrast || !firstAvailableResultImage) return;
    autoTuneTextContrast(firstAvailableResultImage);
  }, [isAutoTextContrast, resultImages, layout, textConfig.positionX, textConfig.positionY, textConfig.textAlign]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lightboxTarget) return;
    const updateStageSize = () => {
      if (!editorStageRef.current) return;
      setEditorStageSize({
        width: editorStageRef.current.clientWidth,
        height: editorStageRef.current.clientHeight,
      });
    };
    updateStageSize();
    window.addEventListener('resize', updateStageSize);
    return () => window.removeEventListener('resize', updateStageSize);
  }, [lightboxTarget]);

  useEffect(() => {
    if (!lightboxTarget) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [lightboxTarget]);

  useEffect(() => {
    if (!lightboxTarget || !editorStageSize.width || !editorStageSize.height || editorInitialized) return;
    const cachedTextLayer = draftConfig?.texts?.[0];
    const nextEditorBox = cachedTextLayer
      ? toEditorBoxFromTextLayer(cachedTextLayer, editorStageSize)
      : buildEditorBoxForStage(editorStageSize.width, editorStageSize.height);
    setEditorBox(nextEditorBox);
    if (cachedTextLayer) {
      setActiveTextId(cachedTextLayer.id);
      setSelectedId(`text:${cachedTextLayer.id}`);
    }
    if (currentImageId && !cachedTextLayer) {
      const initialLayerState = toLayerStateFromCurrent(currentImageId, nextEditorBox, imageLayers, editorStageSize);
      setDraftConfig(initialLayerState);
      setActiveTextId(initialLayerState.texts[0]?.id || null);
    }
    void syncEditorOverlays(editorStageSize.width, editorStageSize.height);
    setEditorInitialized(true);
  }, [lightboxTarget, editorStageSize, editorInitialized, textConfig, currentImageId, draftConfig, imageLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTextId) return;
    const currentConfig = draftConfig;
    const activeLayer = currentConfig?.texts?.find(textLayer => textLayer.id === activeTextId);
    if (!activeLayer) return;
    setEditorBox(toEditorBoxFromTextLayer(activeLayer, editorStageSize));
  }, [activeTextId, draftConfig, editorStageSize.width, editorStageSize.height]);

  useEffect(() => {
    if (!activeTextId) {
      setActiveTextTarget('primary');
    }
  }, [activeTextId]);

  useEffect(() => {
    if (!activeTextId) {
      setPanelSliderDraft(null);
      return;
    }
    const activeLayer = draftConfig?.texts?.find(textLayer => textLayer.id === activeTextId);
    if (!activeLayer) {
      setPanelSliderDraft(null);
      return;
    }
    setPanelSliderDraft({
      width: activeLayer.width,
      height: activeLayer.height,
      fontSize: activeTextTarget === 'secondary'
        ? (activeLayer.subFontSize ?? Math.max(12, Math.round(activeLayer.fontSize * 0.45)))
        : activeLayer.fontSize,
      shadowIntensity: activeLayer.shadowIntensity || 12
    });
  }, [activeTextId, activeTextTarget, draftConfig]);

  useEffect(() => {
    if (!lightboxTarget || !editorStageSize.width || !editorStageSize.height) return;
    void syncEditorOverlays(editorStageSize.width, editorStageSize.height);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lightboxTarget,
    editorStageSize.width,
    editorStageSize.height,
    logoImage,
    logoConfig.positionX,
    logoConfig.positionY,
    logoConfig.scale,
    stickerConfig.url,
    stickerConfig.positionX,
    stickerConfig.positionY,
    stickerConfig.scale
  ]);

  useEffect(() => {
    if (!lightboxTarget || overlayAutoPlaced || !editorStageSize.width || !editorStageSize.height) return;
    if (!editorLogoBox && !editorStickerBox) return;
    applySmartOverlayPlacement();
    setOverlayAutoPlaced(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lightboxTarget,
    overlayAutoPlaced,
    editorStageSize.width,
    editorStageSize.height,
    editorLogoBox,
    editorStickerBox,
    editorBox
  ]);

  const setLogoImageWithCleanup = (nextUrl: string | null) => {
    setLogoImage(prev => {
      if (prev && prev !== nextUrl && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return nextUrl;
    });
  };

  const compressImageToPng = async (base64: string, maxWidth: number = 400): Promise<string> => {
    const img = await loadImage(base64);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Logo 画布初始化失败');

    let width = img.width;
    let height = img.height;
    if (width > height) {
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
    } else if (height > maxWidth) {
      width = Math.round(width * (maxWidth / height));
      height = maxWidth;
    }

    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Logo 通道强制 PNG，保留透明 Alpha，禁止 JPEG。
    return canvas.toDataURL('image/png');
  };

  const handleLogoUploadFile = async (file?: File) => {
    if (!file) return;
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          if (!result) {
            reject(new Error('Logo 读取失败'));
            return;
          }
          resolve(result);
        };
        reader.onerror = () => reject(new Error('Logo 读取失败'));
        reader.readAsDataURL(file);
      });
      const compressedPng = await compressImageToPng(base64, 400);
      setLogoOriginalImage(compressedPng);
      setIsLogoAiBgEnabled(false);
      setLogoImageWithCleanup(compressedPng);
      setToastMessage('✅ Logo 上传成功（已保留透明通道）');
    } catch (error) {
      console.error('Logo upload failed:', error);
      setToastMessage('Logo 上传失败，请重试');
    }
  };

  const handleRemoveLogoBackground = async (sourceImage?: string) => {
    const targetSource = sourceImage || logoImage;
    if (!targetSource || isRemovingLogoBg) return;
    setIsRemovingLogoBg(true);
    setToastMessage('AI 模型加载与运算中，请稍候...');
    try {
      const sourceBlob = await fetch(targetSource).then(async response => {
        if (!response.ok) throw new Error('Logo 读取失败');
        return response.blob();
      });
      const outputBlob = await imglyRemoveBackground(sourceBlob);
      const outputUrl = URL.createObjectURL(outputBlob);
      setLogoImageWithCleanup(outputUrl);
      setToastMessage('✨ Logo 智能去黑底完成！');
    } catch (error) {
      console.error('logo background removal failed:', error);
      setToastMessage('Logo 去背失败，请稍后重试');
    } finally {
      setIsRemovingLogoBg(false);
    }
  };

  const handleLogoBgSwitchChange = async (enabled: boolean) => {
    if (!logoImage || isRemovingLogoBg) return;
    setIsLogoAiBgEnabled(enabled);
    if (!enabled) {
      if (logoOriginalImage) {
        setLogoImageWithCleanup(logoOriginalImage);
      }
      return;
    }
    await handleRemoveLogoBackground(logoOriginalImage || logoImage);
  };

  const clearLogoImage = () => {
    setLogoOriginalImage(null);
    setIsLogoAiBgEnabled(false);
    setLogoImageWithCleanup(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const rawResults = await Promise.all(files.map(file => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    })));

    // 强制串行压缩，避免移动端 Promise.all 导致内存峰值过高（会被系统杀进程，看起来像“自动刷新”）
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const maxWidth = isMobile ? 768 : 1024;
    const compressedResults: string[] = [];
    for (const rawBase64 of rawResults) {
      const compressed = await compressImage(rawBase64, maxWidth);
      compressedResults.push(compressed);
    }
    
    setSourceImages(prev => [...prev, ...compressedResults].slice(0, 5));
    setMaskImageBase64(null); // 上传新图时清空旧遮罩
    setAnalysis(null); // 避免上传即触发鉴权请求，统一在点击“生成”时再分析
    e.target.value = ''; // 允许重复选择同一张图片
  };

  const splitMarketingCopy = (copy: string): { title: string; detail: string } => {
    const lines = copy
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return { title: '', detail: '' };
    if (lines.length === 1) return { title: lines[0], detail: '' };
    return { title: lines[0], detail: lines.slice(1).join('\n') };
  };

  const parseMarketingHeadlinePair = (raw: string): { mainTitle: string; subTitle: string } | null => {
    const normalized = raw.replace(/\r\n/g, '\n');
    const mainTitleMatch = normalized.match(/主标题\s*[：:]\s*(.+)/);
    const subTitleMatch = normalized.match(/副标题\s*[：:]\s*(.+)/);
    if (!mainTitleMatch || !subTitleMatch) return null;

    const cleanup = (input: string) => input
      .trim()
      .replace(/^["'`]/, '')
      .replace(/["'`]$/, '')
      .replace(/^(?:\[|【|\(|（|「|『)\s*/, '')
      .replace(/\s*(?:\]|】|\)|）|」|』)$/, '')
      .trim();

    const mainTitle = cleanup(mainTitleMatch[1] || '');
    const subTitle = cleanup(subTitleMatch[1] || '');
    if (!mainTitle || !subTitle) return null;
    return { mainTitle, subTitle };
  };

  const resolveCopyTargetImageUrl = (): string | null => {
    if (lightboxTarget?.url) return lightboxTarget.url;

    if (currentImageId?.startsWith('lightbox_')) {
      const index = Number(currentImageId.replace('lightbox_', ''));
      if (Number.isFinite(index) && resultImages[index]) return resultImages[index];
    }

    const firstAvailableResultImage = resultImages.find((imageUrl): imageUrl is string => Boolean(imageUrl));
    if (firstAvailableResultImage) return firstAvailableResultImage;
    if (sourceImages.length > 0) return sourceImages[0];
    return null;
  };

  const fetchImageAsBase64 = async (imageUrl: string): Promise<string> => {
    if (!imageUrl) throw new Error('未找到可用图片');

    if (imageUrl.startsWith('data:')) {
      const parts = imageUrl.split(',');
      if (parts.length >= 2 && parts[1]) return parts[1];
      throw new Error('图片数据格式异常，请重新上传后再试');
    }

    const cached = base64CacheRef.current.get(imageUrl);
    if (cached) return cached;

    const response = await fetch(imageUrl, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error('图片读取失败，请稍后重试');
    }
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64data = result.split(',')[1];
        if (!base64data) {
          reject(new Error('图片编码失败，请稍后重试'));
          return;
        }
        resolve(base64data);
      };
      reader.onerror = () => reject(new Error('图片编码失败，请稍后重试'));
      reader.readAsDataURL(blob);
    });

    base64CacheRef.current.set(imageUrl, base64);
    if (base64CacheRef.current.size > 24) {
      const oldestKey = base64CacheRef.current.keys().next().value;
      if (oldestKey) base64CacheRef.current.delete(oldestKey);
    }

    return base64;
  };

  const runWithRetryTimeout = async <T,>(
    taskFactory: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
    retries: number,
    retryNotice: string
  ): Promise<T> => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      let timeoutHandle: number | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        });
        const result = await Promise.race([taskFactory(), timeoutPromise]);
        if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
        return result;
      } catch (error: any) {
        if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
        lastError = error;
        const message = String(error?.message || '');
        const isRetryable =
          message.includes('超时') ||
          message.includes('timeout') ||
          message.includes('AbortError') ||
          message.includes('空') ||
          message.includes('稍后重试') ||
          message.includes('格式');

        if (!isRetryable || attempt >= retries) break;
        setToastMessage(retryNotice);
        await new Promise(resolve => window.setTimeout(resolve, 650));
      }
    }
    throw lastError || new Error(timeoutMessage);
  };

  const resolvePromptProductImageUrl = (): string | null => {
    if (sourceImages.length > 0 && sourceImages[0]) return sourceImages[0];
    return resolveCopyTargetImageUrl();
  };

  const checkTextGenCapability = useCallback(() => {
    if (typeof window === 'undefined') return true;

    const now = Date.now();
    const rawCount = Number(window.localStorage.getItem(TEXT_GEN_COUNT_KEY) || 0);
    const rawLock = Number(window.localStorage.getItem(TEXT_GEN_LOCK_KEY) || 0);
    let currentCount = Number.isFinite(rawCount) ? rawCount : 0;
    let lockEndTime = Number.isFinite(rawLock) ? rawLock : 0;

    if (lockEndTime && now >= lockEndTime) {
      window.localStorage.removeItem(TEXT_GEN_COUNT_KEY);
      window.localStorage.removeItem(TEXT_GEN_LOCK_KEY);
      currentCount = 0;
      lockEndTime = 0;
    }

    if (now < lockEndTime) {
      const remainMins = Math.ceil((lockEndTime - now) / 60000);
      setToastMessage(`⚡️ 文案神经元已达当前并发上限，系统将于 ${remainMins} 分钟后恢复。生成一张主图可立即释放算力锁。`);
      return false;
    }

    if (currentCount >= 50) {
      window.localStorage.setItem(TEXT_GEN_LOCK_KEY, String(now + 3600000));
      setToastMessage('🔒 文案算力调度达到阶段阈值。为保障渲染队列，文案模块暂入冷却。立即生成一张视觉大片即可重置额度。');
      return false;
    }

    window.localStorage.setItem(TEXT_GEN_COUNT_KEY, String(currentCount + 1));
    return true;
  }, []);

  const resetTextGenCapability = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TEXT_GEN_COUNT_KEY);
    window.localStorage.removeItem(TEXT_GEN_LOCK_KEY);
    console.log('[Vision Engine] 文案算力锁已释放');
  }, []);

  const handleSmartPrompt = async () => {
    if (isAnalyzingPrompt) return;
    if (!ensureAuthReady('灵感引擎')) return;
    if (!localUserId) {
      setToastMessage('用户身份初始化中，请稍后重试');
      return;
    }

    const productImageUrl = resolvePromptProductImageUrl();
    if (!productImageUrl) {
      setToastMessage('请先上传商品图，再执行 AI 提示词生成');
      return;
    }

    if (!checkTextGenCapability()) {
      return;
    }

    if (promptGlowTimeoutRef.current !== null) {
      window.clearTimeout(promptGlowTimeoutRef.current);
      promptGlowTimeoutRef.current = null;
    }
    setPromptGlowState('generating');
    setIsAnalyzingPrompt(true);
    setToastMessage('🧠 正在融合商品与背景灵感，期间无需重复点击...');
    let smartPromptSucceeded = false;
    try {
      const productBase64 = await fetchImageAsBase64(productImageUrl);
      const referenceBgBase64 = styleReferenceImage
        ? await fetchImageAsBase64(styleReferenceImage)
        : undefined;
      const bestPrompt = await runWithRetryTimeout(
        async () => {
          const raw = await generateMasterImagePrompt(
            productBase64,
            referenceBgBase64,
            userPrompt.trim(),
            localUserId,
            promptScene,
            promptTone
          );
          const normalized = raw.trim();
          if (!normalized) throw new Error('模型返回为空，请稍后重试。');
          return normalized;
        },
        60000,
        '灵感引擎繁忙，60 秒内未完成响应，请重试。',
        1,
        '⏳ 模型首次唤醒较慢，正在自动重试...'
      );
      setUserPrompt(bestPrompt);
      if (!syncAssetsFromGemini()) {
        void refreshUserCredits();
      }
      setToastMessage('✨ 融合提示词生成成功！');
      flashButtonDone('prompt');
      smartPromptSucceeded = true;
      triggerTextGlowSuccess('prompt');
    } catch (e: any) {
      const errMessage = String(e?.message || '');
      if (errMessage.includes('VIP_EXPIRED')) {
        openPaymentModalForAssetError('VIP_EXPIRED');
      } else if (errMessage.includes('INSUFFICIENT_QUOTA')) {
        openPaymentModalForAssetError('INSUFFICIENT_QUOTA');
      } else {
        setToastMessage(e?.message || '灵感生成失败，请重试');
      }
      setPromptGlowState('idle');
    } finally {
      if (!smartPromptSucceeded) {
        setPromptGlowState('idle');
      }
      setIsAnalyzingPrompt(false);
    }
  };

  const handleExtractCopy = async () => {
    if (isExtractingCopy) return;
    if (!ensureAuthReady('文案引擎')) return;
    if (!localUserId) {
      setToastMessage('用户身份初始化中，请稍后重试');
      return;
    }
    if (copyGlowTimeoutRef.current !== null) {
      window.clearTimeout(copyGlowTimeoutRef.current);
      copyGlowTimeoutRef.current = null;
    }
    setCopyGlowState('generating');
    setIsExtractingCopy(true);
    setToastMessage('📝 正在看图生成文案，期间无需重复点击...');
    let extractCopySucceeded = false;
    try {
      const timeoutMessage = "文案引擎繁忙，60 秒内未完成响应，请重试。";
      const currentImageUrl = resolveCopyTargetImageUrl();
      if (!currentImageUrl) {
        throw new Error('请先上传或生成图片，再执行 AI 生成文案');
      }
      const imageBase64 = await fetchImageAsBase64(currentImageUrl);
      const currentDraft = [textConfig.title, textConfig.detail].filter(Boolean).join('\n').trim();
      const generatedCopy = await runWithRetryTimeout(
        async () => {
          const raw = await generateMasterMarketingCopy(imageBase64, currentDraft, localUserId);
          const normalized = raw.trim();
          if (!normalized) throw new Error('模型返回为空，请稍后重试。');
          return normalized;
        },
        60000,
        timeoutMessage,
        1,
        '⏳ 文案引擎首次唤醒较慢，正在自动重试...'
      );
      const parsedHeadlines = parseMarketingHeadlinePair(generatedCopy);
      if (parsedHeadlines) {
        const { mainTitle, subTitle } = parsedHeadlines;
        setTextConfig(prev => ({
          ...prev,
          title: mainTitle,
          detail: subTitle
        }));

          if (currentImageId) {
            const stageW = editorStageSize.width || 780;
            const stageH = editorStageSize.height || 520;
            const mainFontSize = clamp(Math.round(stageW * 0.058), 34, 58);
            const subFontSize = clamp(Math.round(mainFontSize * 0.52), 20, 32);
            const boxMaxWidth = Math.max(260, stageW - 24);
            const mainXInPx = clamp(Math.round(stageW * 0.08), 16, Math.max(16, stageW - 340));
            const mainYInPx = clamp(Math.round(stageH * 0.18), 16, Math.max(16, stageH - 240));
            const mainLayer: TextLayer = {
              id: `txt_main_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              text: mainTitle,
              subText: '',
              fontStyle: 'bold_display',
              fontFamily: FONT_REGISTRY.bold_display.family,
              color: '#FFFFFF',
              subColor: '#E5E7EB',
              fontSize: mainFontSize,
              x: clamp((mainXInPx / stageW) * 100, 0, 100),
              y: clamp((mainYInPx / stageH) * 100, 0, 100),
              positionUnit: 'percent',
              width: clamp(Math.round(stageW * 0.68), 260, boxMaxWidth),
              height: clamp(Math.round(stageH * 0.22), 86, Math.max(86, stageH - 40)),
              textAlign: 'left',
              shadowIntensity: 18,
            textShadow: '0 0 18px rgba(0,0,0,0.62)',
            writingMode: 'horizontal',
            gradientEnabled: false,
            gradientStart: '#3B82F6',
            gradientEnd: '#A855F7',
          };

          const subLayer: TextLayer = {
            id: `txt_sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            text: subTitle,
            subText: '',
            fontStyle: 'elegant_serif',
              fontFamily: FONT_REGISTRY.elegant_serif.family,
              color: '#DDDDDD',
              subColor: '#DDDDDD',
              fontSize: subFontSize,
              x: mainLayer.x,
              y: clamp(((mainYInPx + mainLayer.height + 10) / stageH) * 100, 0, 100),
              positionUnit: 'percent',
              width: clamp(Math.round(stageW * 0.62), 220, boxMaxWidth),
              height: clamp(Math.round(stageH * 0.14), 64, Math.max(64, stageH - 24)),
              textAlign: 'left',
              shadowIntensity: 12,
            textShadow: '0 0 12px rgba(0,0,0,0.5)',
            writingMode: 'horizontal',
            gradientEnabled: false,
            gradientStart: '#3B82F6',
            gradientEnd: '#A855F7',
          };

          setGlobalLayerConfig(prev => {
            const currentConfig = prev[currentImageId] || { texts: [], images: [] };
            return {
              ...prev,
              [currentImageId]: {
                ...currentConfig,
                texts: [...currentConfig.texts.map(layer => ({ ...layer })), mainLayer, subLayer]
              }
            };
          });
          setActiveTextId(mainLayer.id);
          setEditorBox(toEditorBoxFromTextLayer(mainLayer, { width: stageW, height: stageH }));
          setToastMessage('✨ 绝美海报排版文案已生成并分离图层！');
        }
      } else {
        // AI 输出未按“主标题/副标题”格式时，回退到原有单图层逻辑
        const { title, detail } = splitMarketingCopy(generatedCopy);
        setTextConfig(prev => ({
          ...prev,
          title: title || generatedCopy.trim(),
          detail
        }));
      }
      if (!syncAssetsFromGemini()) {
        void refreshUserCredits();
      }
      setHighlightCopy(true);
      window.setTimeout(() => setHighlightCopy(false), 1600);
      flashButtonDone('copy');
      extractCopySucceeded = true;
      triggerTextGlowSuccess('copy');
    } catch (e: any) {
      const errMessage = String(e?.message || '');
      if (errMessage.includes('VIP_EXPIRED')) {
        openPaymentModalForAssetError('VIP_EXPIRED');
      } else if (errMessage.includes('INSUFFICIENT_QUOTA')) {
        openPaymentModalForAssetError('INSUFFICIENT_QUOTA');
      } else {
        setToastMessage(e?.message || "文案提取失败，请重试");
      }
      setCopyGlowState('idle');
    } finally {
      if (!extractCopySucceeded) {
        setCopyGlowState('idle');
      }
      setIsExtractingCopy(false);
    }
  };

  const hasCreditsValue = typeof userCredits === 'number';
  const isSingleCreditsInsufficient = !ENABLE_CREDITS_OVERDRAFT && hasCreditsValue && userCredits < 1;
  const isMatrixCreditsInsufficient = !ENABLE_CREDITS_OVERDRAFT && hasCreditsValue && userCredits < 3;
  const loadingHeadline = activeGenerateCount === 3
    ? '🚀 正在并发渲染：高转化主图 / 沉浸场景 / 极简海报...'
    : '✨ AI 视觉神经元正在为您注入顶级商业摄影参数...';

  const openPaymentModalForAssetError = (errorCode: 'VIP_EXPIRED' | 'INSUFFICIENT_QUOTA') => {
    const tip = errorCode === 'VIP_EXPIRED'
      ? '您的文案VIP已过期，请充值后继续使用'
      : '您的生图额度已用完，请购买流量包';
    setToastMessage(tip);

    const recommended = RECHARGE_PACKAGES.find(pkg => pkg.recommended) || RECHARGE_PACKAGES[0];
    if (recommended) {
      setSelectedRechargePackage(recommended);
      setIsPaymentModalOpen(true);
      setIsCreditModalOpen(false);
      return;
    }

    setCreditModalTab('recharge');
    setIsCreditModalOpen(true);
  };

  const handleGenerate = async () => {
    if (!ensureAuthReady('单张生图引擎')) return;
    if (isSingleCreditsInsufficient) {
      setToastMessage('生图算力不足，请先补充额度');
      openPaymentModalForAssetError('INSUFFICIENT_QUOTA');
      return;
    }
    if (sourceImages.length === 0) return;
    if (!localUserId) {
      setToastMessage('用户身份初始化中，请稍后重试');
      return;
    }
    setActiveGenerateCount(1);
    setIsProcessing(true); setStep('result'); setResultImages([]); setSuiteSlotStates([]); setIsSuiteMode(false);
    setGenerationProgress('✨ AI 视觉神经元正在为您注入顶级商业摄影参数...');
    // 安全瘦身：保留后端契约字段，但固定为安全默认值，避免 UI 移除后触发 400/500
    const safeRedesignPrompt: string | undefined = undefined;
    const safeMaskImageBase64: string | null = null;
    const safeIsRedesignMode = false;
    const safeLogoImage: string | null = null;
    const safeStickerConfig: StickerConfig = { url: null, positionX: 85, positionY: 15, scale: 20 };
    const safeLogoConfig: LogoConfig = { positionX: 12, positionY: 12, scale: 15 };
    
    try {
      const currentAnalysis = analysis || await analyzeProduct([sourceImages[0].split(',')[1]], localUserId);
      
      // 【核心修复：严格对齐 15 个参数，确保 VisualDNA 注入与参数顺序正确】
      const aiResultRaw = await generateScenarioImage(
        [sourceImages[0].split(',')[1]], // 1. base64Images
        selectedScenario,                // 2. scenario
        currentAnalysis,                 // 3. analysis
        userPrompt,                      // 4. userIntent
        textConfig,                      // 5. textConfig
        mode,                            // 6. mode
        styleReferenceImage ? styleReferenceImage.split(',')[1] : undefined, // 7. styleImageBase64
        visualDNA,                       // 8. visualDNA
        undefined,                       // 9. variationPrompt
        aspectRatio,                     // 10. aspectRatio
        layout,                          // 11. layout
        safeRedesignPrompt,             // 12. redesignPrompt (安全默认值)
        targetPlatform,                  // 13. targetPlatform
        safeMaskImageBase64,             // 14. maskImageBase64 (安全默认值)
        safeIsRedesignMode,              // 15. isRedesignMode (固定 false)
        localUserId,                     // 16. userId (计费)
        1                                // 17. count (单图扣 1 点)
      );
      const aiResultUrl = Array.isArray(aiResultRaw) ? aiResultRaw[0] : aiResultRaw;
      if (!aiResultUrl) {
        throw new Error('精修单图生成失败，请稍后重试');
      }

      // 【核心修复：严格对齐 8 个参数】
      const textFreeConfig = { ...textConfig, title: '', detail: '' };
      const finalUrl = await processFinalImage(
        aiResultUrl,                     // 1. aiResultUrl
        sourceImages[0],                 // 2. originalImageBase64
        currentAnalysis,                 // 3. analysis
        mode,                            // 4. mode
        textFreeConfig,                  // 5. textConfig (底图阶段不固化文字，保留生成后可调)
        safeLogoImage,                   // 6. logoImageBase64 (安全默认值)
        aspectRatio,                     // 7. aspectRatio
        safeStickerConfig,               // 8. stickerConfig (安全默认值)
        safeLogoConfig                   // 9. logoConfig (安全默认值)
      );

      const normalizedFinalUrl = await enforceAspectRatio(finalUrl, aspectRatio);
      setResultImages([normalizedFinalUrl]);
      resetTextGenCapability();
      if (!syncAssetsFromGemini()) {
        void refreshUserCredits();
      }
      flashButtonDone('genSingle');
    } catch (err: any) {
      const errMessage = String(err?.message || '');
      if (errMessage.includes('INSUFFICIENT_QUOTA')) {
        openPaymentModalForAssetError('INSUFFICIENT_QUOTA');
        setStep('upload');
      } else if (errMessage.includes('VIP_EXPIRED')) {
        openPaymentModalForAssetError('VIP_EXPIRED');
        setStep('upload');
      } else if (isAuthErrorMessage(errMessage)) {
        setToastMessage('登录状态尚未就绪或已失效，请重新登录后再试。');
        setStep('upload');
      } else {
        alert(err.message);
        setStep('upload');
      }
    } finally {
      setIsProcessing(false);
      setLoadingBrief('');
      setGenerationProgress('');
    }
  };

  const handleGenerateSuite = async () => {
    if (!ensureAuthReady('营销矩阵引擎')) return;
    if (isMatrixCreditsInsufficient) {
      setToastMessage('生图算力不足，生成 3 张至少需要 3 点额度');
      openPaymentModalForAssetError('INSUFFICIENT_QUOTA');
      return;
    }
    if (sourceImages.length === 0) return;
    if (!localUserId) {
      setToastMessage('用户身份初始化中，请稍后重试');
      return;
    }
    setActiveGenerateCount(3);
    setIsProcessing(true); setStep('result'); setResultImages(['', '', '']); setSuiteSlotStates(['loading', 'loading', 'loading']); setIsSuiteMode(true);
    setGenerationProgress('🚀 正在并发渲染：高转化主图 / 沉浸场景 / 极简海报...');
    // 安全瘦身：保留后端契约字段，但固定为安全默认值，避免 UI 移除后触发 400/500
    const safeRedesignPrompt: string | undefined = undefined;
    const safeMaskImageBase64: string | null = null;
    const safeIsRedesignMode = false;
    const safeLogoImage: string | null = null;
    const safeStickerConfig: StickerConfig = { url: null, positionX: 85, positionY: 15, scale: 20 };
    const safeLogoConfig: LogoConfig = { positionX: 12, positionY: 12, scale: 15 };

    try {
      const currentAnalysis = analysis || await analyzeProduct([sourceImages[0].split(',')[1]], localUserId);
      if (!analysis) setAnalysis(currentAnalysis);

      const currentRenderConfig = { ...textConfig, title: '', detail: '' };
      let successCount = 0;

      const matrixTasks = MATRIX_PROFILES.map(({ variationPrompt, lockLevel }, index) => (async () => {
        try {
          const aiResult = await generateScenarioImage(
            [sourceImages[0].split(',')[1]],
            selectedScenario,
            currentAnalysis,
            userPrompt,
            textConfig,
            mode,
            styleReferenceImage ? styleReferenceImage.split(',')[1] : undefined,
            visualDNA,
            variationPrompt,
            aspectRatio,
            layout,
            safeRedesignPrompt,
            targetPlatform,
            safeMaskImageBase64,
            safeIsRedesignMode,
            localUserId,
            1,
            true,
            lockLevel
          );

          if (typeof aiResult !== 'string' || !aiResult) {
            throw new Error(`营销矩阵第 ${index + 1} 张未返回有效图片`);
          }

          const finalResult = await processFinalImage(
            aiResult,
            sourceImages[0],
            currentAnalysis,
            mode,
            currentRenderConfig,
            safeLogoImage,
            aspectRatio,
            safeStickerConfig,
            safeLogoConfig
          );
          const normalizedResult = await enforceAspectRatio(finalResult, aspectRatio);

          successCount += 1;
          setResultImages((prev) => {
            const next = prev.length === 3 ? [...prev] : ['', '', ''];
            next[index] = normalizedResult;
            return next;
          });
          setSuiteSlotStates((prev) => {
            const next: SuiteSlotState[] = prev.length === 3 ? [...prev] : ['loading', 'loading', 'loading'];
            next[index] = 'success';
            return next;
          });
          setGenerationProgress(`营销矩阵渲染中：已完成 ${successCount}/3`);

          return normalizedResult;
        } catch (error) {
          setSuiteSlotStates((prev) => {
            const next: SuiteSlotState[] = prev.length === 3 ? [...prev] : ['loading', 'loading', 'loading'];
            next[index] = 'error';
            return next;
          });
          throw error;
        }
      })());

      const settledResults = await Promise.allSettled(matrixTasks);
      const fulfilledCount = settledResults.filter((item): item is PromiseFulfilledResult<string> => item.status === 'fulfilled').length;
      const failedCount = settledResults.length - fulfilledCount;

      if (fulfilledCount === 0) {
        const firstRejected = settledResults.find((item): item is PromiseRejectedResult => item.status === 'rejected');
        throw firstRejected?.reason || new Error('营销矩阵生图失败：3 张图片均未成功返回');
      }

      resetTextGenCapability();
      if (!syncAssetsFromGemini()) {
        void refreshUserCredits();
      }

      flashButtonDone('genMatrix');
      if (failedCount > 0) {
        setToastMessage(`营销矩阵已完成 ${fulfilledCount}/3 张，${failedCount} 张因超时或模型波动未成功返回。`);
        setGenerationProgress(`营销矩阵部分完成：${fulfilledCount}/3`);
      } else {
        setGenerationProgress('营销矩阵渲染完成！');
      }
    } catch (err: any) { 
      const errMessage = String(err?.message || '');
      if (errMessage.includes('INSUFFICIENT_QUOTA')) {
        openPaymentModalForAssetError('INSUFFICIENT_QUOTA');
        setStep('upload');
      } else if (errMessage.includes('VIP_EXPIRED')) {
        openPaymentModalForAssetError('VIP_EXPIRED');
        setStep('upload');
      } else {
        alert(err.message);
        setStep('upload');
      }
    } finally { 
      setIsProcessing(false); 
      setLoadingBrief('');
      setTimeout(() => setGenerationProgress(''), 1800);
    }
  };

  const openPaymentCheckout = (pkg: RechargePackage) => {
    if (!localUserId) {
      setToastMessage('用户身份初始化中，请稍后重试');
      return;
    }
    setSelectedRechargePackage(pkg);
    setIsPaymentModalOpen(true);
    setIsCreditModalOpen(false);
  };

  const closePaymentCheckout = () => {
    setIsPaymentModalOpen(false);
    setSelectedRechargePackage(null);
  };

  const handleQuickPay = () => {
    const recommended = RECHARGE_PACKAGES.find(pkg => pkg.recommended) || RECHARGE_PACKAGES[0];
    if (recommended) openPaymentCheckout(recommended);
  };

  const renderLiveTextOverlay = (compact: boolean = false) => {
    if (!textConfig.isEnabled || (!textConfig.title && !textConfig.detail)) return null;

    const align = textConfig.textAlign || 'center';
    const translateX = align === 'left' ? '0' : align === 'right' ? '-100%' : '-50%';
    const mainSize = compact ? Math.max(14, textConfig.fontSize * 2.4) : Math.max(20, textConfig.fontSize * 4.2);
    const subSize = Math.max(10, Math.round(mainSize * 0.45));
    const commonTextShadow = textConfig.shadowIntensity > 0
      ? `0 0 ${Math.round(textConfig.shadowIntensity * (compact ? 0.6 : 0.9))}px rgba(0, 0, 0, 0.55)`
      : 'none';

    const titleStyle: React.CSSProperties = {
      fontFamily: FONT_REGISTRY[textConfig.fontStyle].family,
      fontSize: `${mainSize}px`,
      color: textConfig.mainColor,
      textShadow: commonTextShadow,
      lineHeight: 1.2,
      letterSpacing: textLayout === 'poster' ? '0.12em' : textLayout === 'minimalist' ? '0.04em' : '0.06em',
      fontWeight: 800,
      margin: 0,
      whiteSpace: 'pre-wrap',
    };

    if (textLayout === 'poster') {
      titleStyle.fontWeight = 900;
      titleStyle.textTransform = 'none';
    }

    if (textLayout === 'minimalist') {
      titleStyle.fontWeight = 700;
    }

    const subStyle: React.CSSProperties = {
      fontFamily: FONT_REGISTRY[textConfig.fontStyle].family,
      fontSize: `${subSize}px`,
      color: textConfig.subColor || textConfig.mainColor,
      textShadow: commonTextShadow,
      marginTop: compact ? 4 : 8,
      lineHeight: 1.35,
      fontWeight: textLayout === 'poster' ? 300 : 500,
      letterSpacing: textLayout === 'poster' ? '0.16em' : textLayout === 'minimalist' ? '0.08em' : '0.06em',
      whiteSpace: 'pre-wrap',
    };
    return (
      <div className="absolute inset-0 pointer-events-none z-50">
        {textLayout === 'poster' && (
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        )}
        <div
          style={{
            position: 'absolute',
            left: `${textConfig.positionX}%`,
            top: `${textConfig.positionY}%`,
            transform: `translate(${translateX}, -50%)`,
            textAlign: align,
            maxWidth: compact ? '92%' : '82%',
          }}
        >
          {textConfig.title ? <h2 style={titleStyle}>{textConfig.title}</h2> : null}
          {textConfig.detail ? <p style={subStyle}>{textConfig.detail}</p> : null}
        </div>
      </div>
    );
  };

  const renderLiveLogoOverlay = () => {
    if (!logoImage) return null;
    const logoScale = clamp(logoConfig.scale, 5, 40);
    return (
      <div className="absolute inset-0 pointer-events-none z-40">
        <img
          src={logoImage}
          alt="logo overlay preview"
          className="absolute select-none"
          style={{
            left: `${logoConfig.positionX}%`,
            top: `${logoConfig.positionY}%`,
            width: `${logoScale}%`,
            transform: 'translate(-50%, -50%)',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.24))',
          }}
          draggable={false}
        />
      </div>
    );
  };

  const renderLiveImageLayerOverlay = (imageIndex: number) => {
    const imageId = getLightboxImageId(imageIndex);
    const layerState = globalLayerConfig[imageId];
    const layers = layerState?.images || [];
    if (!layers.length) return null;

    const stageW = Math.max(1, layerState?.stageWidth || editorStageSize.width || 780);
    const stageH = Math.max(1, layerState?.stageHeight || editorStageSize.height || 520);

    return (
      <div className="absolute inset-0 pointer-events-none z-45">
        {layers.map(layer => {
          const left = clamp((layer.x / stageW) * 100, 0, 100);
          const top = clamp((layer.y / stageH) * 100, 0, 100);
          const width = clamp((layer.width / stageW) * 100, 0, 100);
          const height = clamp((layer.height / stageH) * 100, 0, 100);
          return (
            <img
              key={layer.id}
              src={layer.url}
              alt="layer preview"
              className="absolute select-none"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                objectFit: 'contain',
              }}
              draggable={false}
            />
          );
        })}
      </div>
    );
  };

  const renderResultTextEditor = () => (
    <div className="glass-panel p-6 rounded-[28px] space-y-5 border border-stone-100">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-black text-stone-800 tracking-wide">生成后文字微调</h3>
        <span className="text-[10px] text-stone-400 font-bold">实时预览 · 直接导出</span>
      </div>

      <div className="space-y-3">
        <textarea
          value={textConfig.title}
          onChange={(e) => setTextConfig({ ...textConfig, title: e.target.value })}
          placeholder="主标题"
          rows={2}
          className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-sm text-gray-700 leading-relaxed placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300 resize-y min-h-[72px]"
        />
        <textarea
          value={textConfig.detail}
          onChange={(e) => setTextConfig({ ...textConfig, detail: e.target.value })}
          placeholder="副标题"
          rows={2}
          className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-sm text-gray-700 leading-relaxed placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300 resize-y min-h-[72px]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] text-stone-500 font-bold mb-2 block">字体风格</label>
          <select
            value={textConfig.fontStyle}
            onChange={e => setTextConfig({ ...textConfig, fontStyle: e.target.value as FontStyle })}
            className="w-full bg-[#f5f5f7] rounded-xl px-4 py-2.5 text-sm font-medium text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300"
          >
            {FONT_STYLE_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-stone-500 font-bold col-span-2">文字颜色</label>
          <input type="color" value={textConfig.mainColor} onChange={e => setTextConfig({ ...textConfig, mainColor: e.target.value })} className="w-full h-10 rounded-xl cursor-pointer bg-[#f5f5f7] focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300" />
          <input type="color" value={textConfig.subColor || '#ffffff'} onChange={e => setTextConfig({ ...textConfig, subColor: e.target.value })} className="w-full h-10 rounded-xl cursor-pointer bg-[#f5f5f7] focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] text-stone-500 font-bold mb-2 block">文字大小 {textConfig.fontSize}</label>
          <input type="range" min="4" max="25" value={textConfig.fontSize} onChange={e => setTextConfig({ ...textConfig, fontSize: Number(e.target.value) })} className="w-full accent-[#002FA7]" />
        </div>
        <div>
          <label className="text-[10px] text-stone-500 font-bold mb-2 block">文字阴影 {textConfig.shadowIntensity}</label>
          <input type="range" min="0" max="30" value={textConfig.shadowIntensity} onChange={e => setTextConfig({ ...textConfig, shadowIntensity: Number(e.target.value) })} className="w-full accent-[#002FA7]" />
        </div>
      </div>

      <details className="bg-stone-50 border border-stone-100 rounded-xl p-3">
        <summary className="text-[11px] font-bold text-stone-500 cursor-pointer select-none">高级定位微调（可选）</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
          <div>
            <label className="text-[10px] text-stone-500 font-bold mb-2 block">水平位置 {textConfig.positionX}%</label>
            <input type="range" min="5" max="95" value={textConfig.positionX} onChange={e => setTextConfig({ ...textConfig, positionX: Number(e.target.value) })} className="w-full accent-[#002FA7]" />
          </div>
          <div>
            <label className="text-[10px] text-stone-500 font-bold mb-2 block">垂直位置 {textConfig.positionY}%</label>
            <input type="range" min="5" max="95" value={textConfig.positionY} onChange={e => setTextConfig({ ...textConfig, positionY: Number(e.target.value) })} className="w-full accent-[#002FA7]" />
          </div>
        </div>
      </details>

      <div>
        <label className="text-[10px] text-stone-500 font-bold mb-2 block">文字对齐</label>
        <div className="p-1.5 bg-[#f5f5f7] rounded-xl inline-flex gap-1 w-full">
          {(['left', 'center', 'right'] as const).map(align => (
            <button
              key={align}
              onClick={() => setTextConfig({ ...textConfig, textAlign: align })}
              className={`flex-1 py-2 rounded-lg transition-all ${textConfig.textAlign === align ? 'bg-white text-sm font-semibold text-gray-900 shadow-sm' : 'text-sm font-medium text-gray-500 hover:text-gray-700'}`}
            >
              {align === 'left' ? '左对齐' : align === 'center' ? '居中对齐' : '右对齐'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderLightboxEditor = () => {
    if (!lightboxTarget) return null;
    const currentLayerState = draftConfig || (currentImageId ? globalLayerConfig[currentImageId] : undefined);
    const currentImageLayers = currentLayerState?.images || imageLayers;
    const currentTextLayers = currentLayerState?.texts || [];
    const activeTextLayer = currentTextLayers.find(layer => layer.id === activeTextId) || null;
    const maxBoxWidth = Math.max(180, editorStageSize.width || 780);
    const maxBoxHeight = Math.max(110, editorStageSize.height || 520);
    const widthSliderValue = activeTextLayer ? (panelSliderDraft?.width ?? activeTextLayer.width) : 220;
    const heightSliderValue = activeTextLayer ? (panelSliderDraft?.height ?? activeTextLayer.height) : 72;
    const secondaryFontSize = activeTextLayer
      ? Math.max(12, activeTextLayer.subFontSize ?? Math.round(activeTextLayer.fontSize * 0.45))
      : 16;
    const fontSizeSliderValue = activeTextLayer
      ? (panelSliderDraft?.fontSize ?? (activeTextTarget === 'secondary' ? secondaryFontSize : activeTextLayer.fontSize))
      : 24;
    const activeFontStyleValue = activeTextLayer
      ? (activeTextTarget === 'secondary'
          ? (activeTextLayer.subFontStyle || activeTextLayer.fontStyle || 'modern_sans')
          : (activeTextLayer.fontStyle || 'modern_sans'))
      : 'modern_sans';
    const activeColorValue = activeTextLayer
      ? (activeTextTarget === 'secondary' ? (activeTextLayer.subColor || '#E5E7EB') : activeTextLayer.color)
      : '#FFFFFF';
    const shadowSliderValue = activeTextLayer ? (panelSliderDraft?.shadowIntensity ?? (activeTextLayer.shadowIntensity || 12)) : 12;
    return (
      <div className="fixed inset-0 z-[320] bg-black/82 backdrop-blur-xl p-3 md:p-6" onClick={closeLightboxEditor}>
        <div className="w-full h-full max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-4 md:gap-6" onClick={e => e.stopPropagation()}>
          <section className="flex-1 min-h-0 flex items-center justify-center rounded-[24px] border border-white/15 bg-black/35 p-3 md:p-5">
            <div ref={editorCaptureRef} className="relative w-full h-full flex items-center justify-center">
              <div
                ref={editorStageRef}
                className={`relative max-w-full max-h-[74vh] ${isLightboxExporting ? 'lightbox-exporting' : ''}`}
                onMouseDown={() => {
                  setSelectedId(null);
                  setActiveImageLayerId(null);
                  setActiveTextId(null);
                }}
              >
                <img
                  src={lightboxTarget.url}
                  className="max-w-[calc(100vw-2.5rem)] lg:max-w-[calc(100vw-26rem)] max-h-[74vh] object-contain rounded-[18px] shadow-2xl"
                  onLoad={() => {
                    if (editorStageRef.current) {
                      setEditorStageSize({
                        width: editorStageRef.current.clientWidth,
                        height: editorStageRef.current.clientHeight,
                      });
                    }
                  }}
                />

                {!isLightboxExporting && editorGuides.v !== null && (
                  <div className="absolute top-0 bottom-0 w-px bg-[#3B82F6]/75 pointer-events-none" style={{ left: editorGuides.v }} />
                )}
                {!isLightboxExporting && editorGuides.h !== null && (
                  <div className="absolute left-0 right-0 h-px bg-[#3B82F6]/75 pointer-events-none" style={{ top: editorGuides.h }} />
                )}

                {currentImageLayers.map(layer => {
                  const isSelected = selectedId === `image:${layer.id}`;
                  return (
                    <Rnd
                      key={layer.id}
                      size={{ width: layer.width, height: layer.height }}
                      position={{ x: layer.x, y: layer.y }}
                      lockAspectRatio={true}
                      bounds="parent"
                      disableDragging={isLightboxExporting}
                      enableResizing={!isLightboxExporting}
                      className={`group image-layer-rnd ${isSelected ? 'z-[30]' : 'z-[22]'}`}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setActiveImageLayerId(layer.id);
                        setSelectedId(`image:${layer.id}`);
                      }}
                      onDragStop={(_, d) => {
                        setImageLayers(prev => prev.map(item => (
                          item.id === layer.id ? { ...item, x: d.x, y: d.y } : item
                        )));
                        setDraftConfig(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            images: prev.images.map(item => (
                              item.id === layer.id ? { ...item, x: d.x, y: d.y } : item
                            )),
                          };
                        });
                      }}
                      onResizeStart={(e) => {
                        e.stopPropagation();
                        setActiveImageLayerId(layer.id);
                        setSelectedId(`image:${layer.id}`);
                      }}
                      onResizeStop={(_, __, ref, ___, position) => {
                        const nextW = ref.offsetWidth;
                        const nextH = ref.offsetHeight;
                        setImageLayers(prev => prev.map(item => (
                          item.id === layer.id
                            ? {
                                ...item,
                                width: nextW,
                                height: nextH,
                                x: position.x,
                                y: position.y,
                              }
                            : item
                        )));
                        setDraftConfig(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            images: prev.images.map(item => (
                              item.id === layer.id
                                ? {
                                    ...item,
                                    width: nextW,
                                    height: nextH,
                                    x: position.x,
                                    y: position.y,
                                  }
                                : item
                            )),
                          };
                        });
                      }}
                    >
                      <div className={`w-full h-full relative rounded-md overflow-hidden flex items-center justify-center ${isLightboxExporting ? '' : (isSelected ? 'ring-2 ring-blue-500 border border-blue-300 bg-white/15' : 'border border-white/65 bg-white/10')}`}>
                        <img
                          src={layer.url}
                          alt="logo layer"
                          className="pointer-events-none select-none"
                          style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                          draggable={false}
                        />
                        {!isLightboxExporting && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImageLayer(layer.id);
                            }}
                            className={`image-layer-delete absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 items-center justify-center text-xs ${isSelected ? 'flex' : 'hidden'}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </Rnd>
                  );
                })}

                {logoImage && editorLogoBox && (
                  <motion.div
                    drag
                    dragMomentum={false}
                    dragElastic={0}
                    dragConstraints={{
                      left: 0,
                      top: 0,
                      right: Math.max(0, editorStageSize.width - editorLogoBox.width),
                      bottom: Math.max(0, editorStageSize.height - editorLogoBox.height),
                    }}
                    onDragStart={() => {
                      logoDragOriginRef.current = { x: editorLogoBox.x, y: editorLogoBox.y };
                      setSelectedId('logo:main');
                    }}
                    onDrag={(_, info) => {
                      if (!editorStageSize.width || !editorStageSize.height) return;
                      const origin = logoDragOriginRef.current || { x: editorLogoBox.x, y: editorLogoBox.y };
                      const nextX = clamp(origin.x + info.offset.x, 0, Math.max(0, editorStageSize.width - editorLogoBox.width));
                      const nextY = clamp(origin.y + info.offset.y, 0, Math.max(0, editorStageSize.height - editorLogoBox.height));
                      setEditorLogoBox(prev => prev ? { ...prev, x: nextX, y: nextY } : prev);
                    }}
                    onDragEnd={() => {
                      logoDragOriginRef.current = null;
                      setEditorLogoBox(prev => {
                        if (!prev || !editorStageSize.width || !editorStageSize.height) return prev;
                        setLogoConfig(cfg => ({
                          ...cfg,
                          positionX: ((prev.x + prev.width / 2) / editorStageSize.width) * 100,
                          positionY: ((prev.y + prev.height / 2) / editorStageSize.height) * 100,
                          scale: (prev.width / editorStageSize.width) * 100,
                        }));
                        return prev;
                      });
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedId('logo:main');
                    }}
                    className={`group absolute top-0 left-0 z-[16] cursor-move touch-none rounded-md backdrop-blur-[1px] overflow-hidden flex items-center justify-center ${isLightboxExporting ? 'border border-transparent bg-transparent p-0' : (selectedId === 'logo:main' ? 'ring-2 ring-blue-500 border border-blue-300 bg-white/15 p-1' : 'border border-white/55 bg-white/10 p-1')}`}
                    style={{ x: editorLogoBox.x, y: editorLogoBox.y, width: editorLogoBox.width, height: editorLogoBox.height }}
                  >
                    <img
                      src={logoImage}
                      alt="logo overlay"
                      className="pointer-events-none select-none"
                      style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                    />
                    {!isLightboxExporting && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearLogoImage();
                          setSelectedId(null);
                        }}
                        className={`absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 items-center justify-center ${selectedId === 'logo:main' ? 'flex' : 'hidden'}`}
                        title="删除 Logo"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </motion.div>
                )}

                {stickerConfig.url && editorStickerBox && (
                  <motion.div
                    drag
                    dragMomentum={false}
                    dragElastic={0}
                    dragConstraints={{
                      left: 0,
                      top: 0,
                      right: Math.max(0, editorStageSize.width - editorStickerBox.width),
                      bottom: Math.max(0, editorStageSize.height - editorStickerBox.height),
                    }}
                    onDragStart={() => {
                      stickerDragOriginRef.current = { x: editorStickerBox.x, y: editorStickerBox.y };
                    }}
                    onDrag={(_, info) => {
                      if (!editorStageSize.width || !editorStageSize.height) return;
                      const origin = stickerDragOriginRef.current || { x: editorStickerBox.x, y: editorStickerBox.y };
                      const nextX = clamp(origin.x + info.offset.x, 0, Math.max(0, editorStageSize.width - editorStickerBox.width));
                      const nextY = clamp(origin.y + info.offset.y, 0, Math.max(0, editorStageSize.height - editorStickerBox.height));
                      setEditorStickerBox(prev => prev ? { ...prev, x: nextX, y: nextY } : prev);
                    }}
                    onDragEnd={() => {
                      stickerDragOriginRef.current = null;
                      setEditorStickerBox(prev => {
                        if (!prev || !editorStageSize.width || !editorStageSize.height) return prev;
                        setStickerConfig(cfg => ({
                          ...cfg,
                          positionX: ((prev.x + prev.width / 2) / editorStageSize.width) * 100,
                          positionY: ((prev.y + prev.height / 2) / editorStageSize.height) * 100,
                          scale: (prev.width / editorStageSize.width) * 100,
                        }));
                        return prev;
                      });
                    }}
                    className={`absolute top-0 left-0 z-[17] cursor-move touch-none rounded-md backdrop-blur-[1px] overflow-hidden flex items-center justify-center ${isLightboxExporting ? 'border border-transparent bg-transparent p-0' : 'border border-white/50 bg-white/10 p-1'}`}
                    style={{ x: editorStickerBox.x, y: editorStickerBox.y, width: editorStickerBox.width, height: editorStickerBox.height }}
                  >
                    <img
                      src={stickerConfig.url}
                      alt="sticker overlay"
                      className="pointer-events-none select-none"
                      style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                    />
                  </motion.div>
                )}

                {currentTextLayers.map(layer => {
                  const isSelectedText = selectedId === `text:${layer.id}`;
                  const layerIsVertical = layer.writingMode === 'vertical';
                  const layerFontFamily = layer.fontFamily || FONT_REGISTRY[layer.fontStyle || 'modern_sans'].family;
                  const layerSubFontFamily = layer.subFontFamily || FONT_REGISTRY[layer.subFontStyle || layer.fontStyle || 'modern_sans'].family;
                  const layerSubFontSize = Math.max(12, layer.subFontSize ?? (layer.fontSize * 0.45));
                  const draft = textLayerDraftMap[layer.id];
                  const hasActiveDraft = activeTextTransformId === layer.id && Boolean(draft);
                  const layerEditorBox = toEditorBoxFromTextLayer(layer, {
                    width: editorStageSize.width || currentLayerState?.stageWidth || 780,
                    height: editorStageSize.height || currentLayerState?.stageHeight || 520,
                  });
                  const renderX = hasActiveDraft ? (draft?.x ?? layerEditorBox.x) : layerEditorBox.x;
                  const renderY = hasActiveDraft ? (draft?.y ?? layerEditorBox.y) : layerEditorBox.y;
                  const renderWidth = hasActiveDraft ? (draft?.width ?? layerEditorBox.width) : layerEditorBox.width;
                  const renderHeight = hasActiveDraft ? (draft?.height ?? layerEditorBox.height) : layerEditorBox.height;
                  return (
                    <Rnd
                      key={layer.id}
                      size={{ width: renderWidth, height: renderHeight }}
                      position={{ x: renderX, y: renderY }}
                      bounds="parent"
                      disableDragging={isLightboxExporting}
                      enableResizing={!isLightboxExporting}
                      className={`group ${isSelectedText ? 'z-[40]' : 'z-[24]'}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveTextId(layer.id);
                        setSelectedId(`text:${layer.id}`);
                        setEditorBox(toEditorBoxFromTextLayer({
                          ...layer,
                          x: renderX,
                          y: renderY,
                          width: renderWidth,
                          height: renderHeight,
                          positionUnit: 'px',
                        }, editorStageSize));
                      }}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setActiveTextId(layer.id);
                        setSelectedId(`text:${layer.id}`);
                        setActiveTextTransformId(layer.id);
                      }}
                      onDrag={(e, d) => {
                        e.stopPropagation();
                        setTextLayerDraftMap(prev => ({
                          ...prev,
                          [layer.id]: {
                            x: d.x,
                            y: d.y,
                            width: prev[layer.id]?.width ?? layer.width,
                            height: prev[layer.id]?.height ?? layer.height,
                          }
                        }));
                      }}
                      onDragStop={(_, d) => {
                        const currentConfig = draftConfig;
                        const stageW = Math.max(1, editorStageSize.width || currentConfig?.stageWidth || 780);
                        const stageH = Math.max(1, editorStageSize.height || currentConfig?.stageHeight || 520);
                        const nextXPercent = clamp((d.x / stageW) * 100, 0, 100);
                        const nextYPercent = clamp((d.y / stageH) * 100, 0, 100);
                        setDraftConfig(prev => {
                          if (!prev) return prev;
                          const config = prev;
                          return {
                            ...config,
                            texts: config.texts.map(t => (
                              t.id === layer.id
                                ? { ...t, x: nextXPercent, y: nextYPercent, positionUnit: 'percent' }
                                : t
                            ))
                          };
                        });
                        setEditorBox(prev => prev ? { ...prev, x: d.x, y: d.y } : prev);
                        window.requestAnimationFrame(() => {
                          setTextLayerDraftMap(prev => {
                            if (!prev[layer.id]) return prev;
                            const next = { ...prev };
                            delete next[layer.id];
                            return next;
                          });
                          setActiveTextTransformId(null);
                        });
                      }}
                      onResizeStart={(e) => {
                        e.stopPropagation();
                        setActiveTextId(layer.id);
                        setSelectedId(`text:${layer.id}`);
                        setActiveTextTransformId(layer.id);
                      }}
                      onResize={(e, __, ref, ___, position) => {
                        e.stopPropagation();
                        setTextLayerDraftMap(prev => ({
                          ...prev,
                          [layer.id]: {
                            x: position.x,
                            y: position.y,
                            width: ref.offsetWidth,
                            height: ref.offsetHeight,
                          }
                        }));
                      }}
                      onResizeStop={(_, __, ref, ___, position) => {
                        const currentConfig = draftConfig;
                        const stageW = Math.max(1, editorStageSize.width || currentConfig?.stageWidth || 780);
                        const stageH = Math.max(1, editorStageSize.height || currentConfig?.stageHeight || 520);
                        const nextXPercent = clamp((position.x / stageW) * 100, 0, 100);
                        const nextYPercent = clamp((position.y / stageH) * 100, 0, 100);
                        setDraftConfig(prev => {
                          if (!prev) return prev;
                          const config = prev;
                          return {
                            ...config,
                            texts: config.texts.map(t => (
                              t.id === layer.id
                                ? {
                                    ...t,
                                    width: ref.offsetWidth,
                                    height: ref.offsetHeight,
                                    x: nextXPercent,
                                    y: nextYPercent,
                                    positionUnit: 'percent',
                                  }
                                : t
                            ))
                          };
                        });
                        setEditorBox(prev => prev ? { ...prev, x: position.x, y: position.y, width: ref.offsetWidth, height: ref.offsetHeight } : prev);
                        window.requestAnimationFrame(() => {
                          setTextLayerDraftMap(prev => {
                            if (!prev[layer.id]) return prev;
                            const next = { ...prev };
                            delete next[layer.id];
                            return next;
                          });
                          setActiveTextTransformId(null);
                        });
                      }}
                    >
                      <div
                        className={`w-full h-full relative rounded-md px-2.5 py-2 overflow-hidden ${isLightboxExporting ? 'border border-transparent' : (isSelectedText ? 'ring-2 ring-blue-500 border border-blue-300 bg-white/10' : 'border border-dashed border-white/60 bg-white/5')}`}
                        style={{
                          display: 'flex',
                          flexDirection: layerIsVertical ? 'row-reverse' : 'column',
                          alignItems: layerIsVertical ? 'stretch' : 'flex-start',
                          justifyContent: 'flex-start',
                          gap: layerIsVertical ? Math.max(6, layer.fontSize * 0.16) : 0,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: layerFontFamily,
                            fontSize: `${layer.fontSize}px`,
                            color: layer.color,
                            textAlign: layer.textAlign || 'left',
                            lineHeight: 1.15,
                            fontWeight: 800,
                            margin: 0,
                            writingMode: layerIsVertical ? 'vertical-rl' : 'horizontal-tb',
                            textOrientation: layerIsVertical ? 'upright' : 'mixed',
                            whiteSpace: 'pre-wrap',
                            textShadow: layer.textShadow || `0 0 ${Math.max(8, (layer.shadowIntensity || 12))}px rgba(0,0,0,0.58)`,
                            width: '100%',
                          }}
                        >
                          {layer.text}
                        </div>
                        {layer.subText ? (
                          <div
                            style={{
                              fontFamily: layerSubFontFamily,
                              fontSize: `${layerSubFontSize}px`,
                              color: layer.subColor || '#E5E7EB',
                              textAlign: layer.textAlign || 'left',
                              lineHeight: 1.35,
                              marginTop: layerIsVertical ? 0 : 8,
                              marginRight: layerIsVertical ? 8 : 0,
                              writingMode: layerIsVertical ? 'vertical-rl' : 'horizontal-tb',
                              textOrientation: layerIsVertical ? 'upright' : 'mixed',
                              whiteSpace: 'pre-wrap',
                              textShadow: layer.textShadow || `0 0 ${Math.max(8, (layer.shadowIntensity || 12) * 0.7)}px rgba(0,0,0,0.45)`,
                              width: '100%',
                            }}
                          >
                            {layer.subText}
                          </div>
                        ) : null}
                        {!isLightboxExporting && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteText(layer.id);
                            }}
                            className={`absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 items-center justify-center text-xs ${isSelectedText ? 'flex' : 'hidden'}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </Rnd>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="w-full lg:w-[360px] rounded-[24px] bg-white/92 border border-white/40 backdrop-blur-xl p-4 md:p-5 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-black text-stone-900">排版引擎</h3>
              <button className="p-2 rounded-full hover:bg-stone-100 text-stone-500" onClick={closeLightboxEditor}>
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 pb-4 border-b border-stone-200">
              <input
                ref={imageLayerInputRef}
                type="file"
                accept="image/png, image/jpeg"
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                type="button"
                onClick={() => imageLayerInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl border border-[#002FA7] text-[#002FA7] font-black text-[12px] hover:bg-[#002FA7] hover:text-white transition-all"
              >
                + 添加图片图层 (Logo/贴纸)
              </button>
              <p className="mt-2 text-[10px] text-stone-400">
                已添加 {currentImageLayers.length} 个图片图层，可在画布中拖拽与等比缩放
              </p>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleAddText}
                className="w-full py-2.5 rounded-xl border border-blue-600 text-blue-600 font-black text-[12px] hover:bg-blue-600 hover:text-white transition-all"
              >
                + 添加文字标签
              </button>
              {activeTextLayer && (
                <button
                  type="button"
                  onClick={() => handleDeleteText(activeTextLayer.id)}
                  className="w-full mt-2 py-2 rounded-xl border border-red-500 text-red-500 font-black text-[11px] hover:bg-red-500 hover:text-white transition-all"
                >
                  删除当前文字块
                </button>
              )}
            </div>

            {!activeTextLayer ? (
              <div className="mt-4 p-3 rounded-xl bg-stone-50 border border-stone-200 text-[12px] text-stone-500">
                请在左侧点击选中要编辑的文字，或先添加文字标签
              </div>
            ) : (
              <>
                <div className="space-y-3 mt-4">
                  <textarea
                    value={activeTextLayer.text}
                    onChange={(e) => updateActiveText('text', e.target.value)}
                    placeholder="文字内容"
                    rows={2}
                    className="w-full bg-[#f5f5f7] rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300 resize-y min-h-[70px]"
                  />
                  <textarea
                    value={activeTextLayer.subText || ''}
                    onChange={(e) => updateActiveText('subText', e.target.value)}
                    placeholder="副文字（可选）"
                    rows={2}
                    className="w-full bg-[#f5f5f7] rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300 resize-y min-h-[70px]"
                  />
                </div>

                <div className="mt-4">
                  <div className="inline-flex rounded-full bg-stone-100/80 p-1 border border-stone-200 gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveTextTarget('primary')}
                      className={`px-4 py-1.5 text-[12px] font-black rounded-full transition-all ${activeTextTarget === 'primary' ? 'bg-gradient-to-r from-[#4F8AFA] to-[#A87FFB] text-white shadow-sm' : 'text-stone-600 hover:bg-white/70'}`}
                    >
                      一级标题
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTextTarget('secondary')}
                      className={`px-4 py-1.5 text-[12px] font-black rounded-full transition-all ${activeTextTarget === 'secondary' ? 'bg-gradient-to-r from-[#4F8AFA] to-[#A87FFB] text-white shadow-sm' : 'text-stone-600 hover:bg-white/70'}`}
                    >
                      二级标题
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 mt-4">
                  <label className="text-[12px] font-bold text-stone-500">字体</label>
                  <select
                    value={activeFontStyleValue}
                    onChange={(e) => {
                      const fontStyle = e.target.value as FontStyle;
                      if (activeTextTarget === 'secondary') {
                        updateActiveText('subFontStyle', fontStyle);
                        updateActiveText('subFontFamily', FONT_REGISTRY[fontStyle].family);
                      } else {
                        updateActiveText('fontStyle', fontStyle);
                        updateActiveText('fontFamily', FONT_REGISTRY[fontStyle].family);
                      }
                    }}
                    className="w-full bg-[#f5f5f7] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300"
                  >
                    {FONT_STYLE_OPTIONS.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-4">
                  <div className="text-[12px] font-bold text-stone-500 mb-2">推荐配色</div>
                  <div className="flex flex-wrap gap-2">
                    {editorPalette.map(color => (
                      <button
                        key={color}
                        onClick={() => {
                          if (activeTextTarget === 'secondary') {
                            updateActiveText('subColor', color);
                          } else {
                            updateActiveText('color', color);
                          }
                        }}
                        className="w-8 h-8 rounded-full border border-stone-200"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div>
                    <label className="text-[12px] font-bold text-stone-500 mb-2 block">当前目标颜色</label>
                    <input
                      type="color"
                      value={activeColorValue}
                      onChange={(e) => {
                        if (activeTextTarget === 'secondary') {
                          updateActiveText('subColor', e.target.value);
                        } else {
                          updateActiveText('color', e.target.value);
                        }
                      }}
                      className="w-full h-10 rounded-xl bg-[#f5f5f7] focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300"
                    />
                  </div>
                </div>

	                <div className="mt-4 space-y-3">
	                  <div>
	                    <label className="text-[12px] font-bold text-stone-500 mb-2 block">文本框宽度 {Math.round(widthSliderValue)}px</label>
	                    <input
	                      type="range"
	                      min="140"
	                      max={Math.round(maxBoxWidth)}
	                      value={widthSliderValue}
	                      onChange={(e) => {
	                        mergePanelSliderDraft(activeTextLayer, { width: Number(e.target.value) });
	                      }}
	                      onMouseUp={() => commitPanelSlider('width')}
	                      onTouchEnd={() => commitPanelSlider('width')}
	                      onBlur={() => commitPanelSlider('width')}
	                      onKeyUp={(e) => handleSliderCommitByKey('width', e)}
	                      className="w-full accent-[#002FA7]"
	                    />
	                  </div>
	                  <div>
	                    <label className="text-[12px] font-bold text-stone-500 mb-2 block">文本框高度 {Math.round(heightSliderValue)}px</label>
	                    <input
	                      type="range"
	                      min="60"
	                      max={Math.round(maxBoxHeight)}
	                      value={heightSliderValue}
	                      onChange={(e) => {
	                        mergePanelSliderDraft(activeTextLayer, { height: Number(e.target.value) });
	                      }}
	                      onMouseUp={() => commitPanelSlider('height')}
	                      onTouchEnd={() => commitPanelSlider('height')}
	                      onBlur={() => commitPanelSlider('height')}
	                      onKeyUp={(e) => handleSliderCommitByKey('height', e)}
	                      className="w-full accent-[#002FA7]"
	                    />
	                  </div>
                  <div>
                    <label className="text-[12px] font-bold text-stone-500 mb-2 block">字号 {Math.round(fontSizeSliderValue)}</label>
                    <input
                      type="range"
                      min="12"
                      max="72"
                      value={fontSizeSliderValue}
                      onChange={(e) => mergePanelSliderDraft(activeTextLayer, { fontSize: Number(e.target.value) })}
                      onMouseUp={() => commitPanelSlider('fontSize')}
                      onTouchEnd={() => commitPanelSlider('fontSize')}
                      onBlur={() => commitPanelSlider('fontSize')}
	                      onKeyUp={(e) => handleSliderCommitByKey('fontSize', e)}
	                      className="w-full accent-[#002FA7]"
	                    />
	                  </div>
	                  <div>
	                    <label className="text-[12px] font-bold text-stone-500 mb-2 block">阴影 {shadowSliderValue}</label>
	                    <input
	                      type="range"
	                      min="0"
	                      max="40"
	                      value={shadowSliderValue}
	                      onChange={(e) => mergePanelSliderDraft(activeTextLayer, { shadowIntensity: Number(e.target.value) })}
	                      onMouseUp={() => commitPanelSlider('shadowIntensity')}
	                      onTouchEnd={() => commitPanelSlider('shadowIntensity')}
	                      onBlur={() => commitPanelSlider('shadowIntensity')}
	                      onKeyUp={(e) => handleSliderCommitByKey('shadowIntensity', e)}
	                      className="w-full accent-[#002FA7]"
	                    />
	                  </div>
	                </div>
              </>
            )}

            {(logoImage || stickerConfig.url) && (
              <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold text-stone-500">品牌元素定位</div>
                  <button
                    onClick={applySmartOverlayPlacement}
                    className="px-3 py-1 rounded-full text-[11px] font-black border border-[#002FA7] text-[#002FA7] hover:bg-[#002FA7] hover:text-white transition-all"
                  >
                    AI 智能摆位
                  </button>
                </div>
                {logoImage && editorLogoBox && (
                  <div>
                    <label className="text-[12px] font-bold text-stone-500 mb-2 block">Logo 大小 {Math.round(editorLogoBox.width)}px</label>
                    <input
                      type="range"
                      min="36"
                      max={Math.round(Math.max(90, (editorStageSize.width || 720) * 0.4))}
                      value={editorLogoBox.width}
                      onChange={(e) => {
                        const nextW = Number(e.target.value);
                        setEditorLogoBox(prev => prev ? {
                          ...prev,
                          width: nextW,
                          height: (prev.height / Math.max(1, prev.width)) * nextW,
                          x: clamp(prev.x, 0, Math.max(0, (editorStageSize.width || 720) - nextW)),
                          y: clamp(prev.y, 0, Math.max(0, (editorStageSize.height || 420) - (prev.height / Math.max(1, prev.width)) * nextW)),
                        } : prev);
                        if (editorStageSize.width) {
                          setLogoConfig(cfg => ({ ...cfg, scale: (nextW / editorStageSize.width) * 100 }));
                        }
                      }}
                      className="w-full accent-[#002FA7]"
                    />
                  </div>
                )}
                {stickerConfig.url && editorStickerBox && (
                  <div>
                    <label className="text-[12px] font-bold text-stone-500 mb-2 block">贴纸大小 {Math.round(editorStickerBox.width)}px</label>
                    <input
                      type="range"
                      min="36"
                      max={Math.round(Math.max(100, (editorStageSize.width || 720) * 0.46))}
                      value={editorStickerBox.width}
                      onChange={(e) => {
                        const nextW = Number(e.target.value);
                        setEditorStickerBox(prev => prev ? {
                          ...prev,
                          width: nextW,
                          height: (prev.height / Math.max(1, prev.width)) * nextW,
                          x: clamp(prev.x, 0, Math.max(0, (editorStageSize.width || 720) - nextW)),
                          y: clamp(prev.y, 0, Math.max(0, (editorStageSize.height || 420) - (prev.height / Math.max(1, prev.width)) * nextW)),
                        } : prev);
                        if (editorStageSize.width) {
                          setStickerConfig(cfg => ({ ...cfg, scale: (nextW / editorStageSize.width) * 100 }));
                        }
                      }}
                      className="w-full accent-[#002FA7]"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={handleSaveCurrentDraft}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#002FA7] to-[#3B4DDB] text-white font-black text-[14px] tracking-wide shadow-lg shadow-[#002FA7]/20 hover:opacity-95 transition-all"
              >
                保存本张
              </button>
              <button
                type="button"
                onClick={handleApplyDraftToAll}
                className="w-full py-3 rounded-xl border border-[#4F46E5] text-[#4338CA] bg-indigo-50 hover:bg-indigo-100 font-black text-[14px] transition-all"
              >
                应用到所有图片
              </button>
            </div>

            <button
              type="button"
              onClick={handleLightboxDownload}
              disabled={isLightboxDownloading}
              className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-[#002FA7] to-[#3B4DDB] text-white font-black text-[14px] tracking-wide shadow-lg shadow-[#002FA7]/20 hover:opacity-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLightboxDownloading ? '正在导出高清图...' : '✅ 确认并下载'}
            </button>
          </aside>
        </div>
      </div>
    );
  };

  const currentAspectRatio = aspectRatio.replace(':', ' / ');
  const availableResultEntries = resultImages.reduce<Array<{ url: string; index: number }>>((acc, url, index) => {
    if (url) acc.push({ url, index });
    return acc;
  }, []);
  const isGeneratingPrompt = isAnalyzingPrompt;
  const isMatrixGenerating = isProcessing && activeGenerateCount === 3;
  const isMatrixRainbow = isMatrixGenerating || buttonDoneFlash.genMatrix;
  const matrixButtonText = isMatrixGenerating ? '正在渲染神级大片...' : (buttonDoneFlash.genMatrix ? '神级大片已完成' : '生成大师级主图');

  const renderLoadingMonitor = () => (
    <div className="flex flex-col items-center justify-center mb-12 mt-8 w-full max-w-3xl mx-auto min-h-[100px]">
      <div className="flex items-center justify-center gap-4 mb-6 w-full select-none">
        <span className="nebula-diamond-shell">
          <NebulaDiamondIcon />
        </span>
        <span className="text-[14px] md:text-[15px] font-bold text-[#1d1d1f] tracking-[0.2em] uppercase font-mono flex items-center mt-[2px]">
          NANO BANANA PRO
          <span className="text-gray-300 font-light mx-3">/</span>
          <span className="text-gray-400 font-medium tracking-widest">VISION ENGINE</span>
        </span>
      </div>
      <div className="relative h-6 w-full flex justify-center items-center overflow-hidden">
        <p key={logIndex} className="absolute text-[14px] md:text-[15px] text-gray-500 font-medium tracking-wide animate-[fadeInUp_0.5s_ease-out_forwards]">
          {logMessages[logIndex]}
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden">
      <div
        className="fixed inset-0 -z-10 w-full h-screen pointer-events-none select-none bg-transparent"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, transparent 20vh, black 50vh)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, transparent 20vh, black 50vh)',
        }}
      >
        <LiquidMetalBackground />
      </div>
      {/* 组件内联注入 CSS，100% 保证动效渲染 */}
      <style>{`
        @keyframes slide-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .inline-marquee {
          display: inline-flex;
          white-space: nowrap;
          animation: slide-left 40s linear infinite;
        }
        .fade-edges {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          pointer-events: none;
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
        .image-layer-rnd .react-resizable-handle {
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(0, 47, 167, 0.55);
        }
        .lightbox-exporting .image-layer-rnd .react-resizable-handle {
          display: none !important;
        }
        .lightbox-exporting .image-layer-delete {
          display: none !important;
        }
      `}</style>

      <header className="fixed top-0 inset-x-0 z-50 h-16 bg-white/70 backdrop-blur-xl transition-all duration-300 ease-out flex items-center justify-between px-6 border-b border-white/20">
        <div className="flex items-center gap-2.5 cursor-pointer group">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:scale-105 transition-transform duration-300">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span className="text-xl font-bold tracking-tight text-[#1d1d1f]">
            电商宝 <span className="text-sm font-semibold text-gray-400 tracking-wider ml-0.5">PRO</span>
          </span>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 relative z-[110]">
          {isAuthLoading ? (
            <>
              <div className="w-20 h-9 bg-stone-100 animate-pulse rounded-full" />
              <div className="w-9 h-9 bg-stone-100 animate-pulse rounded-full" />
            </>
          ) : isLoggedIn && userInfo ? (
            <>
              <button
                type="button"
                title="剩余算力点，点击补充"
                onClick={handleQuickPay}
                className="group relative flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm cursor-pointer overflow-hidden transition-all duration-300 hover:border-gray-300 hover:shadow-[0_0_20px_rgba(200,200,200,0.5)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 relative z-10 transition-colors duration-300 group-hover:text-gray-700">
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"></path>
                </svg>
                <span className="relative z-10 text-sm font-semibold text-[#1d1d1f]">
                  {isCreditsLoading ? '--' : (userCredits ?? 0)} <span className="font-normal text-gray-500 transition-colors duration-300 group-hover:text-gray-800">Tokens</span>
                </span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gray-100/80 to-transparent group-hover:translate-x-full transition-transform duration-[1000ms] ease-in-out z-0 pointer-events-none"></div>
              </button>

              <div ref={avatarMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsAvatarMenuOpen(prev => !prev)}
                  className="flex items-center gap-3 ml-2 cursor-pointer group"
                >
                  <span className="hidden md:block text-sm font-medium text-gray-500 group-hover:text-gray-800 transition-colors">
                    Hi, {userInfo.nickname || '体验官'}
                  </span>
                  <img
                    src={userInfo.photo || 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix'}
                    alt="User Avatar"
                    className="w-8 h-8 rounded-full object-cover bg-gray-100 ring-1 ring-gray-200/50"
                  />
                </button>

                {isAvatarMenuOpen && (
                  <div className="absolute right-0 mt-2 w-[260px] rounded-xl border border-stone-200/80 bg-white shadow-xl p-1">
                    <div className="px-3.5 pt-3 pb-2">
                      <p className="text-[13px] font-black text-stone-800">{userInfo.nickname || '电商极客'}</p>
                      <p className="text-[11px] text-stone-500 mt-1">👑 VIP: {getVipStatusText()}</p>
                    </div>
                    <div className="h-px bg-stone-100 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        handleQuickPay();
                      }}
                      className="w-full text-left px-3.5 py-2 text-[12px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      充值 / 升级 PRO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        setToastMessage('历史记录 / 账号设置 即将上线');
                      }}
                      className="w-full text-left px-3.5 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50 rounded-lg transition-colors"
                    >
                      历史记录 / 账号设置
                    </button>
                    <div className="h-px bg-stone-100 my-1" />
                    <button
                      type="button"
                      onClick={async () => {
                        setIsAvatarMenuOpen(false);
                        await handleLogout();
                      }}
                      className="w-full text-left px-3.5 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button onClick={handleLogin} className="whitespace-nowrap px-4 py-2 md:px-6 md:py-2.5 bg-stone-900 text-white rounded-full font-black text-[10px] md:text-[12px] tracking-widest hover:bg-[#002FA7] transition-all shadow-md active:scale-95">
              登录/注册
            </button>
          )}
        </div>
      </header>

      {/* AI 引擎状态监视器（极简悬浮状态标） */}
      <div className="fixed right-3 md:right-6 bottom-[calc(env(safe-area-inset-bottom)+14px)] md:bottom-6 z-[110] group">
        <div className="ai-engine-pill">
          <span className="engine-dot" />
          <span className="engine-text">Powered by 电商宝 AI</span>
        </div>
      </div>

      <main className="relative z-30 w-full max-w-6xl px-4 md:px-6 pt-24 pb-12 md:py-32 flex flex-col items-center overflow-x-hidden font-sans antialiased text-gray-900">
        {step === 'upload' ? (
          <div className="w-full space-y-12 reveal-up">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12 max-w-7xl mx-auto px-6 py-16">
              <div className="w-full lg:w-[40%] flex flex-col items-start text-left">
                <h3 className="text-4xl md:text-5xl font-bold text-[#1d1d1f] tracking-tight leading-tight">
                  好主图，<br className="hidden md:block" />
                  天生能卖货。
                </h3>
                <p className="text-base md:text-lg text-gray-500 leading-relaxed mt-4">
                  只需上传原图，AI 自动为你渲染影棚级大片。准备好迎接下一次爆款。
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  {BARRAGE_TEXTS.map((text, i) => (
                    <span key={i} className="text-xs font-medium text-gray-600 tracking-wide bg-[#f5f5f7] px-5 py-2 rounded-full border border-gray-200/70 shadow-sm">
                      {text}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative w-full lg:w-[50%] h-[400px] lg:h-[550px] flex items-center justify-center group [perspective:1000px]">
                <div className="pointer-events-none absolute inset-0 -z-10">
                  <div className="absolute left-10 top-14 h-40 w-40 rounded-full bg-sky-200/50 blur-3xl" />
                  <div className="absolute right-8 bottom-16 h-44 w-44 rounded-full bg-fuchsia-200/50 blur-3xl" />
                </div>

                {HERO_GALLERY_IMAGES.map((src, index) => {
                  const relIndex = (index - currentIndex + HERO_GALLERY_IMAGES.length) % HERO_GALLERY_IMAGES.length;
                  const baseClasses = 'absolute h-auto object-cover rounded-2xl shadow-xl transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer transform-gpu';
                  let stateClasses = '';

                  if (relIndex === 0) {
                    stateClasses = 'z-30 w-[60%] lg:w-[70%] scale-100 opacity-100 blur-0 translate-x-0 translate-y-0 shadow-[0_30px_60px_rgba(0,0,0,0.15)] group-hover:scale-105 group-hover:-translate-y-4 group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.2)]';
                  } else if (relIndex === 1) {
                    stateClasses = 'z-20 w-[50%] lg:w-[60%] scale-95 opacity-80 blur-[3px] -translate-x-12 -translate-y-8 -rotate-6 group-hover:-translate-x-28 group-hover:-translate-y-12 group-hover:-rotate-12 group-hover:blur-0 group-hover:opacity-100';
                  } else if (relIndex === 2) {
                    stateClasses = 'z-10 w-[45%] lg:w-[55%] scale-90 opacity-70 blur-[4px] translate-x-16 translate-y-12 rotate-3 group-hover:translate-x-32 group-hover:translate-y-16 group-hover:rotate-6 group-hover:blur-0 group-hover:opacity-100';
                  } else if (relIndex === HERO_GALLERY_IMAGES.length - 1) {
                    stateClasses = 'z-40 w-[60%] lg:w-[70%] scale-110 opacity-0 blur-xl -translate-x-48 rotate-12 pointer-events-none';
                  } else {
                    stateClasses = 'z-0 w-[45%] lg:w-[55%] scale-75 opacity-0 blur-sm translate-x-0 translate-y-0 pointer-events-none';
                  }

                  return (
                    <img
                      key={src}
                      src={src}
                      alt={'Gallery Image ' + (index + 1)}
                      className={baseClasses + ' ' + stateClasses}
                      onClick={handleNextImage}
                    />
                  );
                })}
              </div>
            </div>

            <div className="relative w-full pb-24 mt-8 bg-transparent">
               <div className="relative z-10 max-w-4xl mx-auto">
                <section className="bg-white rounded-[2rem] p-8 md:p-10 mb-8 mx-auto max-w-4xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.03)] transition-shadow duration-500 hover:shadow-[0_30px_80px_rgba(0,0,0,0.06)]">
                  <StepHaloTitle step="01" title="商品原图" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {sourceImages.map((img, i) => (
                      <div key={i} className="aspect-square relative group bg-white rounded-[24px] overflow-hidden border border-stone-50 shadow-sm transition-all duration-500 ease-out hover:scale-[1.01] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)]">
                        <img src={img} className="w-full h-full object-cover" alt="" />
                        {/* 新增：悬浮删除按钮 */}
                        <button 
                          onClick={() => setSourceImages(prev => prev.filter((_, index) => index !== i))} 
                          className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-red-600 backdrop-blur-sm"
                        >
                          <X size={14}/>
                        </button>
                      </div>
                    ))}
                    {sourceImages.length < 5 && (
                      <label className="aspect-square border-2 border-dashed border-stone-200 rounded-[24px] flex flex-col items-center justify-center cursor-pointer hover:border-[#002FA7] hover:bg-stone-50/90 transition-all duration-500 ease-out hover:scale-[1.01] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] group">
                        <input type="file" multiple className="hidden" onChange={handleUpload} />
                        <Plus className="text-stone-300 group-hover:text-[#002FA7] transition-colors" size={28} />
                        <span className="mt-3 text-[13px] text-stone-500 font-bold tracking-wide group-hover:text-[#002FA7]">
                          点击或拖拽上传原图
                        </span>
                      </label>
                    )}
                  </div>
                </section>
                <div
                  ref={refStyleRef}
                  className={`bg-white rounded-[2rem] p-8 md:p-10 mb-8 mx-auto max-w-4xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.03)] transition-shadow duration-500 hover:shadow-[0_30px_80px_rgba(0,0,0,0.06)] apple-reveal-base ${isRefStyleVisible ? 'apple-reveal-visible' : 'apple-reveal-hidden'}`}
                >
                   <section>
                    <StepHaloTitle step="02" title="风格参考" />

                    <section className="mb-8 border-b border-stone-100 pb-8">
                      <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex-1">
                          <p className="text-[12px] text-gray-500 leading-relaxed">上传心仪的参考图，AI 将自动学习并重塑其光影与质感。</p>
                        </div>
                        {styleReferenceImage ? (
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#002FA7] group">
                            <img src={styleReferenceImage} className="w-full h-full object-cover" />
                            {/* 新增：风格图删除按钮 */}
                            <button 
                              onClick={() => {
                                setStyleReferenceImage(null);
                                setVisualDNA(null);
                              }} 
                              className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 backdrop-blur-sm"
                            >
                              <X size={10}/>
                            </button>
                          </div>
                        ) : (
                          <label className="w-20 h-20 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#002FA7] transition-all relative">
                            <input type="file" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  const rawBase64 = reader.result as string;
                                  const compressedBase64 = await compressImage(rawBase64, 800);
                                  setStyleReferenceImage(compressedBase64);
                                  
                                  // 自动提取视觉基因
                                  setIsExtractingDNA(true);
                                  try {
                                    const dna = await extractVisualDNA(compressedBase64.split(',')[1], localUserId);
                                    setVisualDNA(dna);
                                  } catch (err) {
                                    console.error("DNA Extraction failed", err);
                                  } finally {
                                    setIsExtractingDNA(false);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }} />
                            {isExtractingDNA ? (
                              <Loader2 className="animate-spin text-[#002FA7]" size={20} />
                            ) : (
                              <Plus className="text-stone-300" size={20} />
                            )}
                          </label>
                        )}
                      </div>
                    </section>
                  </section>
                </div>

                <section ref={sceneRef} className={`bg-white rounded-[2rem] p-8 md:p-10 mb-8 mx-auto max-w-4xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.03)] transition-shadow duration-500 hover:shadow-[0_30px_80px_rgba(0,0,0,0.06)] apple-reveal-base ${isSceneVisible ? 'apple-reveal-visible' : 'apple-reveal-hidden'}`}>
                  <StepHaloTitle step="03" title="场景与光影" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">场景设定</label>
                      <select 
                        value={promptScene} 
                        onChange={(e) => setPromptScene(e.target.value)}
                        className="w-full h-12 bg-[#f5f5f7] rounded-xl px-4 text-sm font-medium text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300 appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                      >
                        {[
                          "真实生活代入",
                          "极简几何展台",
                          "自然绿植环绕",
                          "高级木质桌面",
                          "奢华影棚布景"
                        ].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">画面色调</label>
                      <select 
                        value={promptTone} 
                        onChange={(e) => setPromptTone(e.target.value)}
                        className="w-full h-12 bg-[#f5f5f7] rounded-xl px-4 text-sm font-medium text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 transition-colors duration-300 appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                      >
                        {[
                          "🌤️ 治愈系自然光 (Golden Hour & Dappled)",
                          "🎬 电影感高反差 (Cinematic Chiaroscuro)",
                          "🧊 冷峻高级灰 (Cool Industrial)"
                        ].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="w-full flex flex-col gap-4">
                    <div className="relative w-full mt-6 group">
                      <div className={`relative z-10 w-full flex flex-col overflow-hidden backdrop-blur-md transition-all duration-500 ease-out rounded-2xl ${
                        isGeneratingPrompt
                          ? 'bg-white/95 shadow-[0_12px_40px_rgba(139,92,246,0.25)] -translate-y-1 ring-1 ring-violet-400/50 border-transparent'
                          : 'bg-white/80 shadow-sm translate-y-0 border border-violet-100 focus-within:ring-1 focus-within:ring-violet-300'
                      }`}>
                        <div className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-violet-200/40 to-transparent pointer-events-none z-10 transition-opacity duration-500 ${isGeneratingPrompt ? 'opacity-100 animate-[shimmer_1.5s_infinite]' : 'opacity-0'}`}></div>
                        <textarea
                          value={userPrompt}
                          onChange={(e) => setUserPrompt(e.target.value)}
                          className={`w-full h-32 resize-none bg-transparent pt-6 px-6 pb-6 text-[15px] text-[#1d1d1f] focus:outline-none placeholder-gray-400 relative z-20 transition-opacity duration-500 ${isGeneratingPrompt ? 'opacity-60' : 'opacity-100'}`}
                          placeholder={"// 导演指令：请描述您期望的画面细节与氛围...\n例如：清晨柔和的阳光透过百叶窗，商品放置在带有水滴的黑大理石台面上。"}
                          disabled={isGeneratingPrompt}
                        ></textarea>
                      </div>
                    </div>

                    <div className={`prompt-status-widget ${isAnalyzingPrompt || promptGlowState === 'success' ? 'is-generating' : ''}`}>
                      <div className={`holo-ticker max-w-[320px] ml-auto ${isAnalyzingPrompt || promptGlowState === 'success' ? 'is-visible' : ''}`}>
                        <div className="holo-ticker-track">
                          <span className="holo-ticker-line">{MODEL_HINT_IMAGE}</span>
                          <span className="holo-ticker-line">最长 60 秒，首次慢响应自动重试 1 次</span>
                          <span className="holo-ticker-line">{MODEL_HINT_IMAGE}</span>
                        </div>
                      </div>
                      <MorphingAiButton
                        onClick={handleSmartPrompt}
                        loading={isAnalyzingPrompt}
                        disabled={isAnalyzingPrompt || !authReady}
                        icon={<Wand2 size={16} />}
                        idleText={userPrompt ? '重新生成灵感' : 'AI 帮我写神级提示词'}
                        loadingText={`✨ 灵感引擎思考中 ${promptCountdown ?? 60}s`}
                        doneText="✨ 灵感已注入"
                        showDone={buttonDoneFlash.prompt}
                        size="sm"
                        variant="secondary"
                        className="btn-secondary-purple"
                      />
                    </div>
                  </div>
                </section>

                {/* [ 03.5 ] 构图控制中心 (尺寸与排版整合版) */}
                <section ref={outputRef} className={`bg-white rounded-[2rem] p-8 md:p-10 mb-8 mx-auto max-w-4xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.03)] transition-shadow duration-500 hover:shadow-[0_30px_80px_rgba(0,0,0,0.06)] apple-reveal-base ${isOutputVisible ? 'apple-reveal-visible' : 'apple-reveal-hidden'}`}>
                  <StepHaloTitle step="04" title="尺寸与构图" />
                  <div className="bg-white/40 p-6 rounded-[24px] border border-stone-100 space-y-6">
                    
                    {/* 1. 画布比例选择 */}
                    <div>
                      <label className="text-[11px] font-bold text-stone-500 mb-3 block">选择输出尺寸</label>
                      <div className="p-1.5 bg-[#f5f5f7] rounded-xl inline-flex gap-1 w-full">
                        {[
                          { id: '1:1', label: '方形' },
                          { id: '3:4', label: '竖版' },
                          { id: '9:16', label: '长图' }
                        ].map(ratio => (
                          <button 
                            key={ratio.id} 
                            onClick={() => setAspectRatio(ratio.id as AspectRatio)}
                            className={`flex-1 py-2.5 rounded-lg transition-all ${
                              aspectRatio === ratio.id 
                                ? 'bg-white text-sm font-semibold text-gray-900 shadow-sm' 
                                : 'text-sm font-medium text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {ratio.id} {ratio.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-stone-100/50 pt-6"></div>

                    {/* 2. 留白与位置选择 */}
                    <div>
                      <label className="text-[11px] font-bold text-stone-500 mb-3 block">选择商品位置</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1.5 bg-[#f5f5f7] rounded-xl">
                        {[
                          { id: 'center', label: '居中聚焦' },
                          { id: 'left_space', label: '右置留左' },
                          { id: 'right_space', label: '左置留右' },
                          { id: 'top_space', label: '沉底留空' }
                        ].map(lyt => (
                          <button
                            key={lyt.id}
                            onClick={() => handleSmartLayoutChange(lyt.id as CompositionLayout)}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all ${
                              layout === lyt.id 
                                ? 'bg-white text-sm font-semibold text-gray-900 shadow-sm' 
                                : 'text-sm font-medium text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {/* 简单的几何示意图 */}
                            <div className="w-8 h-8 flex border border-stone-300 rounded mb-2 overflow-hidden bg-stone-50 relative">
                              {lyt.id === 'center' && <div className="absolute inset-0 m-auto w-4 h-4 bg-stone-400 rounded-full" />}
                              {lyt.id === 'left_space' && <div className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-stone-400 rounded-full" />}
                              {lyt.id === 'right_space' && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-stone-400 rounded-full" />}
                              {lyt.id === 'top_space' && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-stone-400 rounded-full" />}
                            </div>
                            <div className="text-sm font-medium text-inherit">{lyt.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. 🎯 目标投放平台选择器 */}
                    <div className="border-t border-stone-100/50 pt-6">
                      <label className="text-[14px] font-black text-stone-800 mb-3 flex items-center gap-2">
                        目标投放平台
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1.5 bg-[#f5f5f7] rounded-xl">
                        {[
                          { id: '通用电商', label: '🛒 通用电商', sub: 'General' },
                          { id: '亚马逊爆款', label: '📦 亚马逊', sub: 'Amazon' },
                          { id: '小红书种草', label: '📕 小红书', sub: 'XHS' },
                          { id: '抖音/TikTok', label: '🎵 抖音/TK', sub: 'TikTok' }
                        ].map(platform => (
                          <button 
                            key={platform.id} 
                            onClick={() => setTargetPlatform(platform.id)}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all ${
                              targetPlatform === platform.id 
                                ? 'bg-white text-sm font-semibold text-gray-900 shadow-sm' 
                                : 'text-sm font-medium text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <span className="text-sm font-medium text-inherit">{platform.label}</span>
                            <span className={`text-[8px] font-bold uppercase tracking-tighter ${targetPlatform === platform.id ? 'text-stone-500' : 'text-stone-400'}`}>{platform.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section ref={posterRef} className={`bg-white rounded-[2rem] p-8 md:p-10 mb-8 mx-auto max-w-4xl border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.03)] transition-shadow duration-500 hover:shadow-[0_30px_80px_rgba(0,0,0,0.06)] apple-reveal-base ${isPosterVisible ? 'apple-reveal-visible' : 'apple-reveal-hidden'}`}>
                  <StepHaloTitle step="05" title="海报文字设计" />
                  <div className={`poster-copy-shell w-full mt-8 flex flex-col gap-4 ${
                    isExtractingCopy ? 'is-generating' : copyGlowState === 'success' ? 'is-success' : ''
                  }`}>
                    <div className="poster-copy-ambient poster-copy-ambient--left" />
                    <div className="poster-copy-ambient poster-copy-ambient--right" />
                    <div className="relative w-full">
                      <div className="absolute -inset-2 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-blue-500/15 blur-3xl rounded-[3rem] animate-pulse pointer-events-none z-0" style={{ animationDuration: '4s' }}></div>
                      <div className="relative z-10 w-full bg-white/70 backdrop-blur-xl border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm flex flex-col transition-all duration-300 focus-within:ring-1 focus-within:ring-violet-200 focus-within:bg-white/90">
                        <input
                          type="text"
                          placeholder="输入主标题..."
                          value={textConfig.title}
                          onChange={e => setTextConfig({ ...textConfig, title: e.target.value })}
                          className="w-full bg-transparent px-8 pt-8 pb-4 text-lg font-medium text-[#1d1d1f] focus:outline-none placeholder-gray-400"
                        />
                        <div className="h-[1px] w-[calc(100%-4rem)] mx-auto bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
                        <textarea
                          placeholder="输入副标题或正文描述..."
                          value={textConfig.detail}
                          onChange={e => setTextConfig({ ...textConfig, detail: e.target.value })}
                          className="w-full h-36 resize-none bg-transparent px-8 pt-4 pb-14 text-lg text-[#1d1d1f] focus:outline-none placeholder-gray-400"
                        ></textarea>
                      </div>
                    </div>
                    <div className={`prompt-status-widget ${isExtractingCopy ? 'is-generating' : ''}`}>
                      <div className={`holo-ticker max-w-[320px] ml-auto ${isExtractingCopy ? 'is-visible' : ''}`}>
                        <div className="holo-ticker-track">
                          <span className="holo-ticker-line">{MODEL_HINT_COPY}</span>
                          <span className="holo-ticker-line">最长 60 秒，首次慢响应自动重试 1 次</span>
                          <span className="holo-ticker-line">{MODEL_HINT_COPY}</span>
                        </div>
                      </div>
                      <MorphingAiButton
                        onClick={handleExtractCopy}
                        loading={isExtractingCopy}
                        disabled={isExtractingCopy || !authReady}
                        icon={<Sparkles size={12} />}
                        idleText="爆款文案制作"
                        loadingText={`爆款文案制作中 ${copywritingCountdown ?? 60}s`}
                        doneText="✨ 文案已完成"
                        showDone={buttonDoneFlash.copy}
                        size="sm"
                        variant="primary"
                      />
                    </div>
                  </div>
                </section>


                <div
                  ref={generateRef}
                  className={`apple-reveal-base flex flex-col sm:flex-row items-center justify-center gap-8 mt-16 mb-12 w-full ${isGenerateVisible ? 'apple-reveal-visible' : 'apple-reveal-hidden'}`}
                >
                  <div className="relative flex flex-col items-center">
                    <button
                      type="button"
                      onClick={handleGenerateSuite}
                      disabled={isProcessing || sourceImages.length === 0 || !authReady}
                      className={`flex items-center justify-center gap-3 w-[300px] py-4 rounded-2xl font-medium text-lg transition-all duration-300 border-none ${isMatrixRainbow ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-blue-600 bg-[length:200%_auto] animate-rainbow text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-[#111827] hover:bg-[#1a2333] text-white shadow-xl hover:shadow-2xl'} disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <span className="flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-violet-400">
                           <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor"/>
                        </svg>
                        {matrixButtonText}
                      </span>
                    </button>
                    <span className="mt-4 text-[13px] text-gray-400 font-mono tracking-widest">
                      ⚡️ - 3 TOKENS
                    </span>
                  </div>

                  <div className="relative group cursor-pointer flex flex-col items-center">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isProcessing || sourceImages.length === 0 || !authReady}
                      className="relative z-10 flex items-center justify-center gap-2 w-[300px] py-4 bg-transparent border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 rounded-2xl font-medium text-lg transition-all duration-300 hover:bg-gray-50/50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      生成单张精修
                    </button>
                    <span className="mt-4 text-[13px] text-gray-400 font-mono tracking-widest">
                      ⚡️ - 1 TOKEN
                    </span>
                  </div>
                </div>              </div>
            </div>

          </div>
        ) : (
          <div className="w-full max-w-5xl reveal-up">
            {!isSuiteMode && isProcessing && resultImages.length === 0 ? (
              <div className="w-full space-y-12">
                {renderLoadingMonitor()}

                <div className="w-full max-w-3xl mx-auto">
                  <div className="relative w-full rounded-[2rem] overflow-hidden bg-[#fafafa] shadow-sm flex flex-col items-center justify-center group" style={{ aspectRatio: currentAspectRatio, minHeight: 320 }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent animate-pulse" style={{ animationDuration: '3s' }}></div>
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-[shimmer_1.5s_infinite] z-10"></div>
                    <span className="relative z-20 text-[12px] font-mono text-gray-400 tracking-[0.2em] uppercase">
                      Rendering...
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                {isProcessing ? (
                  <div className="w-full">
                    {renderLoadingMonitor()}
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 w-full gap-4">
                    <h2 className="flex items-center gap-2.5 select-none text-xl md:text-2xl">
                      <span className="font-medium text-gray-300 tracking-wide">06</span>
                      <span className="font-light text-violet-400">/</span>
                      <span className="font-bold text-[#1d1d1f] tracking-tight">视觉资产已就绪</span>
                    </h2>
                    <div className="flex items-center gap-4 mt-4 md:mt-0">
                      <button
                        onClick={() => { setStep('upload'); setResultImages([]); setSuiteSlotStates([]); }}
                        className="px-6 py-2.5 bg-transparent border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] rounded-xl font-medium text-[14px] transition-all"
                      >
                        返回重构
                      </button>
                      <button
                        onClick={async () => {
                          if (availableResultEntries.length === 1) {
                            const packed = await composeResultDownloadDataUrl(availableResultEntries[0]?.url || '');
                            if (!packed) return;
                            await triggerDownload(packed, buildDownloadFileName('单图'));
                            return;
                          }
                          for (const entry of availableResultEntries) {
                            const packed = await composeResultDownloadDataUrl(entry.url);
                            await triggerDownload(packed, buildDownloadFileName(`套图${entry.index + 1}`));
                            await new Promise(r => setTimeout(r, 320));
                          }
                        }}
                        className="px-6 py-2.5 bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white rounded-xl font-medium text-[14px] shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-violet-400">
                          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {availableResultEntries.length > 1 ? '一键打包全套' : '下载单张大图'}
                      </button>
                    </div>
                  </div>
                )}


                {isSuiteMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, index) => {
                      const img = resultImages[index];
                      const slotState = suiteSlotStates[index] || (img ? 'success' : 'loading');
                      const labels = ['🔥 高转化主图', '🛋️ 沉浸生活感', '✨ 极简高级感'];
                      
                      return (
                        <div
                          key={index}
                          ref={el => suiteRefs.current[index] = el}
                          className={`glass-panel p-4 rounded-[32px] space-y-4 relative group bg-white/60 border border-stone-100 shadow-sm overflow-hidden ${img ? 'animate-fade-in-up' : ''}`}
                          style={img ? { animationDelay: `${index * 0.3 + 0.1}s` } : undefined}
                        >
                          <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
                            <div className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-3 py-1 rounded-full border border-white/10">
                              {labels[index]}
                            </div>
                          </div>
                          
                          <div
                            className="relative rounded-[24px] overflow-hidden bg-stone-50 flex items-center justify-center"
                            style={{ aspectRatio: currentAspectRatio, minHeight: 200 }}
                          >
                            {img ? (
                              <>
                                <img
                                  src={img}
                                  className="w-full h-full object-contain transition-opacity duration-700 cursor-zoom-in"
                                  alt={`Generated Result ${index + 1}`}
                                  onClick={() => openLightboxEditor({ url: img, index, label: labels[index] || `套图${index + 1}` })}
                                />
                                <button
                                  onClick={() => openLightboxEditor({ url: img, index, label: labels[index] || `套图${index + 1}` })}
                                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all"
                                >
                                  <ZoomIn size={14} />
                                </button>
                                {renderLiveLogoOverlay()}
                                {renderLiveImageLayerOverlay(index)}
                                {renderLiveTextOverlay(true)}
                              </>
                            ) : slotState === 'error' ? (
                              <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden bg-[#fafafa] shadow-sm flex flex-col items-center justify-center">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent"></div>
                                <span className="relative z-20 text-[12px] font-mono text-gray-400 tracking-[0.2em] uppercase">
                                  Retry Needed
                                </span>
                                <span className="relative z-20 mt-3 text-[12px] text-gray-500">
                                  该张因模型波动未完成
                                </span>
                              </div>
                            ) : (
                              <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden bg-[#fafafa] shadow-sm flex flex-col items-center justify-center group">
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent animate-pulse" style={{ animationDuration: '3s' }}></div>
                                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/80 to-transparent animate-[shimmer_1.5s_infinite] z-10"></div>
                                <span className="relative z-20 text-[12px] font-mono text-gray-400 tracking-[0.2em] uppercase">
                                  Rendering...
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {img && (
                            <button 
                              onClick={async () => {
                                const packed = await composeResultDownloadDataUrl(img);
                                await triggerDownload(packed, buildDownloadFileName(`套图${index + 1}`));
                              }}
                              className="w-full py-2.5 bg-stone-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#002FA7] transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              <Download size={12} /> 下载此张
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="glass-panel p-8 rounded-[40px] space-y-6 reveal-up relative group max-w-3xl w-full">
                      <div className="absolute top-10 left-10 z-10 flex flex-col gap-2">
                        <div className="bg-black/60 backdrop-blur-md text-white text-[12px] font-black px-4 py-1.5 rounded-full border border-white/20">
                          单图高清预览
                        </div>
                        <div className="bg-white/80 backdrop-blur-md text-stone-800 text-[10px] font-bold px-3 py-1 rounded-md border border-stone-200 w-fit">
                          {aspectRatio}
                        </div>
                      </div>
                      <div ref={resultRef} className="relative overflow-hidden rounded-[32px] shadow-2xl border-4 border-white" style={{ aspectRatio: currentAspectRatio }}>
                        <img
                          src={resultImages[0]}
                          className="w-full h-full object-contain cursor-zoom-in"
                          alt="Generated Result"
                          onClick={() => openLightboxEditor({ url: resultImages[0], index: 0, label: '单图预览' })}
                        />
                        <button
                          onClick={() => openLightboxEditor({ url: resultImages[0], index: 0, label: '单图预览' })}
                          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all"
                        >
                          <ZoomIn size={16} />
                        </button>
                        {renderLiveLogoOverlay()}
                        {renderLiveImageLayerOverlay(0)}
                        
                        {renderLiveTextOverlay(false)}
                      </div>
                      <button 
                        onClick={async () => {
                          if (!resultImages[0]) return;
                          const packed = await composeResultDownloadDataUrl(resultImages[0]);
                          await triggerDownload(packed, buildDownloadFileName('单图高清'));
                        }}
                        className="w-full py-4 bg-[#002FA7] text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-[#002FA7]/90 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-[#002FA7]/20">
                        <Download size={18} /> 导出高清商业资产
                      </button>
                      {renderResultTextEditor()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {renderLightboxEditor()}

      <CreditModal
        open={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        credits={userCredits}
        vipExpireDate={userVipExpireDate}
        inviteCode={userInviteCode}
        activeTab={creditModalTab}
        onTabChange={setCreditModalTab}
        onToast={(message) => setToastMessage(message)}
        onPurchase={openPaymentCheckout}
      />

      <PaymentModal
        open={isPaymentModalOpen}
        userId={localUserId}
        selectedPackage={selectedRechargePackage}
        onClose={closePaymentCheckout}
        onPaid={refreshUserCredits}
        onToast={(message) => setToastMessage(message)}
      />

      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[380] px-4 py-2 rounded-full bg-stone-900/92 text-white text-[12px] font-bold shadow-xl backdrop-blur-sm">
          {toastMessage}
        </div>
      )}

      {/* 悬浮电商锦囊对话框 */}
      {showTip && (
        <div className="fixed bottom-8 right-8 z-[80] w-80 animate-bounce-subtle">
          <div className="glass-panel p-6 rounded-[32px] border-[#002FA7]/10 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#002FA7]" />
            <button 
              onClick={() => setShowTip(false)}
              className="absolute top-4 right-4 text-stone-300 hover:text-stone-600 transition-colors"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-orange-50 rounded-xl">
                <Lightbulb size={18} className="text-orange-500" />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black text-[#002FA7] tracking-widest uppercase opacity-60">运营锦囊 No.{tipIndex + 1}</div>
                <p className="text-[12px] text-stone-600 font-medium leading-relaxed">
                  {ECOMMERCE_TIPS[tipIndex]}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
