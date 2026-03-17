export enum ScenarioType {
  STUDIO_WHITE = 'studio_white',
  MINIMALIST_PREMIUM = 'minimalist_premium',
  NATURAL_LIFESTYLE = 'natural_lifestyle',
  OUTDOOR_STREET = 'outdoor_street',
  FESTIVAL_PROMO = 'festival_promo',
  SOCIAL_MEDIA_STORY = 'social_media_story',
}

export type GenerationMode = 'precision' | 'creative';

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export type CompositionLayout = 'center' | 'left_space' | 'right_space' | 'top_space';

export type FontStyle = 
  | 'modern_sans' | 'elegant_serif' | 'bold_display' | 'handwritten_script' 
  | 'tech_mono' | 'playful_marker' | 'classic_song' | 'artistic_brush';

export interface TextConfig {
  title: string;
  detail: string;
  isEnabled: boolean;
  fontStyle: FontStyle;
  mainColor: string;
  subColor: string;
  fontSize: number;
  shadowIntensity: number;
  positionX: number;
  positionY: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface StickerConfig {
  url: string | null;
  positionX: number;
  positionY: number;
  scale: number;
}

export interface LogoConfig {
  positionX: number;
  positionY: number;
  scale: number;
}

export interface MarketAnalysis {
  perspective: string;
  lightingDirection: string;
  physicalSpecs: {
    cameraPerspective: string;
    lightingDirection: string;
    colorTemperature: string;
  };
}

export interface VisualDNA {
  lighting_style: string;
  color_palette: string;
  atmosphere: string;
}

export type TargetPlatform =
  | '通用电商'
  | '亚马逊爆款'
  | '小红书种草'
  | '抖音/TikTok';

export type DetailPagePlatform = 'universal';

export type DetailPageStyle = 'hybrid';

export type DetailPageModuleType =
  | 'hero'
  | 'selling_points'
  | 'scene'
  | 'detail'
  | 'benefit'
  | 'spec'
  | 'trust'
  | 'cta';

export type DetailPageModuleStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DetailPageReferenceStyle {
  pageStyle: string;
  palette: string[];
  typography: {
    headline: string;
    body: string;
    accent?: string;
  };
  lightingStyle: string;
  atmosphere: string;
  layoutRhythm: string;
  decorLanguage: string;
  moduleSamples: Array<{
    type: DetailPageModuleType;
    layout: string;
    emphasis: string;
    density: string;
  }>;
}

export interface DetailPageReferenceImage {
  id: string;
  url: string;
  label: string;
  visualDNA: VisualDNA | null;
}

export interface DetailPageModulePlan {
  type: DetailPageModuleType;
  objective: string;
  headlineDirection: string;
  copyTask: string;
  visualTask: string;
  layoutPreset: string;
  referenceHint: string;
  sceneHint: string;
  toneHint: string;
}

export interface DetailPageModuleAssets {
  headline: string;
  subheadline: string;
  body: string;
  sellingPoints: string[];
  generatedPrompt: string;
  imageUrl: string | null;
  errorMessage: string | null;
  styleNotes: string;
  toneNotes: string;
  referenceImageId: string | null;
}

export interface DetailPageModule {
  id: string;
  order: number;
  type: DetailPageModuleType;
  name: string;
  title: string;
  copyGoal: string;
  imageGoal: string;
  layoutPreset: string;
  status: DetailPageModuleStatus;
  isGeneratable: boolean;
  plan: DetailPageModulePlan | null;
  assets: DetailPageModuleAssets;
}

export interface DetailPageBatchProgress {
  isRunning: boolean;
  currentModuleId: string | null;
  lastCompletedModuleId: string | null;
  lastFailedModuleId: string | null;
  priorityReadyCount: number;
  priorityTotalCount: number;
  isPriorityPhaseComplete: boolean;
  successCount: number;
  attemptedCount: number;
  totalCount: number;
}

export interface UserAssetProfile {
  user_id: string;
  credits: number;
  image_quota: number;
  vip_expire_date: string | null;
  invite_code: string | null;
  invited_by: string | null;
}

export interface UserBootstrapResponse {
  success: boolean;
  credits: number;
  invite_code: string | null;
  image_quota: number | null;
  vip_expire_date: string | null;
  isNewUser?: boolean;
}
