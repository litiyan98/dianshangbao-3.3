import { ScenarioType, AspectRatio, CompositionLayout, FontStyle } from './types';

export const DEFAULT_STICKERS = [
  { id: 'sf', name: '顺丰包邮', url: 'https://img.alicdn.com/imgextra/i4/O1CN01fX2X2X1X2X2X2X2X2_!!6000000001818-2-tps-200-200.png' },
  { id: 'hot', name: '爆款热卖', url: 'https://img.alicdn.com/imgextra/i4/O1CN01fX2X2X1X2X2X2X2X2_!!6000000001818-2-tps-200-200.png' }, // Placeholder URLs
  { id: 'new', name: '新品上市', url: 'https://img.alicdn.com/imgextra/i4/O1CN01fX2X2X1X2X2X2X2X2_!!6000000001818-2-tps-200-200.png' }
];

export const SUITE_MATRIX = [
  {
    name: "01_极简高光首图",
    variation: "Make it a Hero Shot. Center the product perfectly. Keep the background minimal and clean to make the product pop, but strictly use the extracted color grading and lighting DNA. High commercial clarity.",
    aspectRatio: '1:1' as AspectRatio, layout: 'center' as CompositionLayout,
    textOverride: { fontStyle: 'bold_display' as FontStyle, fontSize: 16, positionX: 50, positionY: 88, textAlign: 'center' as const },
    stickerOverride: { url: DEFAULT_STICKERS.find(s => s.id === 'sf')?.url || null, positionX: 85, positionY: 15, scale: 25 }
  },
  {
    name: "02_材质微距特写",
    variation: "Make it a Macro Detail Shot. Zoom in extremely close to the product to show material textures. Use shallow depth of field (beautiful bokeh). The lighting MUST follow the extracted lighting DNA.",
    aspectRatio: '1:1' as AspectRatio, layout: 'center' as CompositionLayout,
    textOverride: { fontStyle: 'handwritten_script' as FontStyle, fontSize: 12, positionX: 50, positionY: 18, textAlign: 'center' as const },
    stickerOverride: null
  },
  {
    name: "03_卖点留白海报",
    variation: "Make it a Copy-Space Layout. Place the product clearly on one side. The other half MUST be completely clean, uncluttered negative space (using the extracted color tones) for placing marketing text.",
    aspectRatio: '1:1' as AspectRatio, layout: 'right_space' as CompositionLayout,
    textOverride: { fontStyle: 'modern_sans' as FontStyle, fontSize: 10, positionX: 12, positionY: 50, textAlign: 'left' as const },
    stickerOverride: null
  },
  {
    name: "04_沉浸式场景图",
    variation: "Make it a Full Lifestyle Context Shot. Completely immerse the product into the extracted environment and props. 100% replicate the atmosphere.",
    aspectRatio: '1:1' as AspectRatio, layout: 'center' as CompositionLayout,
    textOverride: { fontStyle: 'elegant_serif' as FontStyle, fontSize: 6, positionX: 88, positionY: 50, textAlign: 'right' as const },
    stickerOverride: null
  },
  {
    name: "05_氛围情绪大片",
    variation: "Make it an Editorial Vibe Shot. Emphasize the emotional vibe from the extracted DNA. Use dramatic lighting, creative angles, or cinematic shadows to elevate brand premiumness.",
    aspectRatio: '1:1' as AspectRatio, layout: 'center' as CompositionLayout,
    textOverride: { fontStyle: 'tech_mono' as FontStyle, fontSize: 14, positionX: 50, positionY: 85, textAlign: 'center' as const },
    stickerOverride: null
  }
];

export const SCENARIO_CONFIGS = [
  { id: ScenarioType.STUDIO_WHITE, name: '影棚级纯白底', icon: '⚪', desc: '完美符合亚马逊/淘系白底图规范，保留真实物理阴影', ratio: '1:1' },
  { id: ScenarioType.MINIMALIST_PREMIUM, name: '极简高级感', icon: '✨', desc: 'Ins风纯色或几何台面，高级低饱和度，凸显商品质感', ratio: '1:1' },
  { id: ScenarioType.NATURAL_LIFESTYLE, name: '自然光生活感', icon: '🌿', desc: '模拟真实家居/生活场景，阳光透过窗户的自然光斑', ratio: '3:4' },
  { id: ScenarioType.OUTDOOR_STREET, name: '户外街景实拍', icon: '🏙️', desc: '都市街头、自然风景等外景融合，适合穿搭与户外用品', ratio: '3:4' },
  { id: ScenarioType.FESTIVAL_PROMO, name: '大促节日氛围', icon: '🎁', desc: '暖色调、节日装饰点缀，拉满双十一/黑五大促转化氛围', ratio: '1:1' },
  { id: ScenarioType.SOCIAL_MEDIA_STORY, name: '社媒种草海报', icon: '📱', desc: '9:16 竖屏，小红书/TikTok 爆款网感构图', ratio: '9:16' }
];

export const MODEL_NATIONALITY = [
  { id: 'asian', name: '亚洲', prompt: 'Asian model' }, { id: 'caucasian', name: '欧美', prompt: 'Caucasian Western model' },
  { id: 'latino', name: '拉丁', prompt: 'Latino model' }, { id: 'african', name: '非洲', prompt: 'African model' }
];
