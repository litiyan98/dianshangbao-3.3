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

export interface AdminGenerationReviewListItem {
  id: string;
  user_id: string;
  trace_id?: string | null;
  mode: string;
  status: string;
  stage: string;
  progress: number;
  message?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_outputs: number;
  failed_outputs: number;
  charged_tokens: number;
  refunded_tokens: number;
  latest_action_type?: string | null;
  latest_issue_tag?: string | null;
  risk_level: 'normal' | 'review' | 'high';
}

export interface AdminGenerationReviewOutput {
  id: string;
  job_id: string;
  user_id: string;
  trace_id?: string | null;
  slot_index: number;
  mode: string;
  model_name?: string | null;
  status: string;
  image_url?: string | null;
  prompt_snapshot?: string | null;
  error_message?: string | null;
  charged_tokens: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminGenerationReviewLedgerEntry {
  id: string;
  job_id: string;
  user_id: string;
  output_id?: string | null;
  trace_id?: string | null;
  slot_index: number;
  action_type: string;
  token_delta: number;
  reason?: string | null;
  created_at?: string | null;
}

export interface AdminGenerationReviewActionLog {
  id: string;
  job_id: string;
  output_id?: string | null;
  target_user_id: string;
  admin_user_id: string;
  action_type: string;
  issue_tag?: string | null;
  token_delta: number;
  note?: string | null;
  created_at?: string | null;
}

export interface AdminGenerationReviewDetail {
  job: {
    id: string;
    user_id: string;
    trace_id?: string | null;
    mode: string;
    status: string;
    stage: string;
    progress: number;
    message?: string | null;
    error_message?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  outputs: AdminGenerationReviewOutput[];
  ledger: AdminGenerationReviewLedgerEntry[];
  actions: AdminGenerationReviewActionLog[];
}

export type AdminGenerationReviewActionType =
  | 'REFUND_TOKEN'
  | 'COMPENSATE_TOKEN'
  | 'MARK_MODEL_ISSUE'
  | 'MARK_REFERENCE_DRIFT'
  | 'MARK_USER_INPUT_ISSUE'
  | 'RESOLVE_NO_ACTION';

export type AdminGenerationIssueTag =
  | 'MODEL_DRIFT'
  | 'REFERENCE_DRIFT'
  | 'USER_INPUT_ISSUE'
  | 'POST_PROCESS_ISSUE'
  | 'MISCHARGE'
  | 'OTHER';

export type RefundAppealType =
  | 'GENERATION_CHARGE'
  | 'PAYMENT_MISSING_TOKENS'
  | 'DUPLICATE_CHARGE'
  | 'PAYMENT_REFUND';

export type RefundAppealSourceType =
  | 'generation_job'
  | 'payment_order'
  | 'token_charge';

export type RefundAppealStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUNDED';

export interface RefundAppealRecentJob {
  id: string;
  mode: string;
  status: string;
  stage: string;
  progress: number;
  charged_tokens: number;
  created_at?: string | null;
}

export interface RefundAppealItem {
  id: string;
  user_id: string;
  appeal_type: RefundAppealType | string;
  source_type: RefundAppealSourceType | string;
  source_id?: string | null;
  title: string;
  description?: string | null;
  requested_refund_tokens: number;
  requested_refund_amount: number;
  evidence_json?: unknown;
  status: RefundAppealStatus | string;
  auto_check_result?: string | null;
  resolution_summary?: string | null;
  admin_note?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RefundAppealListResponse {
  success: boolean;
  items: RefundAppealItem[];
  recent_generation_jobs?: RefundAppealRecentJob[];
}

export interface AdminRefundAppealListItem extends RefundAppealItem {
  review_priority: 'normal' | 'review' | 'high';
}

export interface AdminRefundAppealDetail {
  appeal: RefundAppealItem;
  related_job?: {
    id: string;
    user_id: string;
    trace_id?: string | null;
    mode: string;
    status: string;
    stage: string;
    progress: number;
    message?: string | null;
    error_message?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
  outputs: AdminGenerationReviewOutput[];
  ledger: AdminGenerationReviewLedgerEntry[];
}

export type AdminRefundAppealActionType =
  | 'MARK_UNDER_REVIEW'
  | 'APPROVE_TOKEN_REFUND'
  | 'RESOLVE_NO_REFUND'
  | 'REJECT_APPEAL';
