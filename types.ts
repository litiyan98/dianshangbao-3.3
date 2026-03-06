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
