import {
  CompositionLayout,
  DetailPageModule,
  DetailPageModuleAssets,
  DetailPageReferenceAnalysis,
  DetailPageReferenceFrameAnalysis,
  DetailPageModulePlan,
  DetailPageModuleType,
  DetailPageReferenceStyle,
  ScenarioType,
  VisualDNA,
} from '../types';

const DETAIL_PAGE_BLUEPRINTS: Array<
  Omit<DetailPageModule, 'status' | 'plan' | 'assets'>
> = [
  {
    id: 'detail-hero',
    order: 1,
    type: 'hero',
    name: '封面屏',
    title: '建立商品第一印象',
    copyGoal: '突出商品名称、核心 slogan 与首屏购买兴趣，适合详情页封面首屏。',
    imageGoal: '生成一张以商品为主体的强冲击封面视觉，背景干净但具有场景氛围。',
    layoutPreset: '大标题 + 主视觉 + 一句短利益点，适配货架电商首屏。',
    isGeneratable: true,
  },
  {
    id: 'detail-selling-points',
    order: 2,
    type: 'selling_points',
    name: '核心卖点屏',
    title: '快速拆解高频卖点',
    copyGoal: '把商品的 3 到 4 个关键卖点拆成短句，支撑用户继续下滑阅读。',
    imageGoal: '输出适合图标式或模块式编排的卖点信息画面。',
    layoutPreset: '四宫格或三段式图文结构，强调清晰与可读性。',
    isGeneratable: true,
  },
  {
    id: 'detail-scene',
    order: 3,
    type: 'scene',
    name: '场景价值屏',
    title: '建立真实使用场景',
    copyGoal: '说明商品出现在哪种场景、解决什么问题、适合什么人群。',
    imageGoal: '生成更强生活方式代入感的场景画面，强调商品与环境关系。',
    layoutPreset: '大图 + 场景短文案，偏内容种草节奏。',
    isGeneratable: true,
  },
  {
    id: 'detail-detail',
    order: 4,
    type: 'detail',
    name: '质感细节屏',
    title: '放大材质与工艺细节',
    copyGoal: '解释材质、工艺、纹理、成分或结构细节，承接用户的品质判断。',
    imageGoal: '生成特写型画面，突出商品微观质感和做工细节。',
    layoutPreset: '细节特写 + 说明文案，适合中段强化品质感。',
    isGeneratable: true,
  },
  {
    id: 'detail-benefit',
    order: 5,
    type: 'benefit',
    name: '功能效果屏',
    title: '补足功能与效果说明',
    copyGoal: '解释核心功能、体验差异、使用方式或前后对比信息。',
    imageGoal: '生成功能表达型画面，支持效果对比或功能拆解说明。',
    layoutPreset: '左右对比或条列式说明，强调结果与收益。',
    isGeneratable: true,
  },
  {
    id: 'detail-spec',
    order: 6,
    type: 'spec',
    name: '规格参数屏',
    title: '补足参数与购买决策信息',
    copyGoal: '输出尺寸、容量、成分、规格、型号等理性决策信息。',
    imageGoal: '生成适合承载参数排版的理性信息画面。',
    layoutPreset: '参数表 + 辅助小图，偏平台标准详情页风格。',
    isGeneratable: true,
  },
  {
    id: 'detail-trust',
    order: 7,
    type: 'trust',
    name: '信任服务屏',
    title: '承接质检、售后与服务说明',
    copyGoal: '表达发货、售后、保障、授权、质检等信任信息。',
    imageGoal: '生成偏服务承诺和品牌可信度表达的辅助画面。',
    layoutPreset: '保障条 + 信任文案模块，节奏克制、信息明确。',
    isGeneratable: true,
  },
  {
    id: 'detail-cta',
    order: 8,
    type: 'cta',
    name: '转化收口屏',
    title: '形成最终转化收口',
    copyGoal: '总结购买理由，形成最后的 CTA 与记忆点。',
    imageGoal: '生成总结型画面，收束整套详情页氛围并强化购买欲。',
    layoutPreset: '总结标题 + 商品回归主体，适合作为尾屏收口。',
    isGeneratable: true,
  },
];

export function createEmptyDetailPageAssets(): DetailPageModuleAssets {
  return {
    headline: '',
    subheadline: '',
    body: '',
    sellingPoints: [],
    generatedPrompt: '',
    imageUrl: null,
    errorMessage: null,
    styleNotes: '',
    toneNotes: '',
    referenceImageId: null,
  };
}

export function createDetailPageSeedModules(): DetailPageModule[] {
  return DETAIL_PAGE_BLUEPRINTS.map((module) => ({
    ...module,
    status: 'idle',
    plan: null,
    assets: createEmptyDetailPageAssets(),
  }));
}

export function createFallbackDetailReferenceStyle(
  visualDNA: VisualDNA | null | undefined,
  sceneSetting: string,
  toneSetting: string
): DetailPageReferenceStyle {
  const palette =
    visualDNA?.color_palette
      ?.split(/[,+/]/)
      .map((token) => token.trim())
      .filter(Boolean)
      .slice(0, 4) || [];

  return {
    pageStyle: 'premium_shelf',
    palette: palette.length > 0 ? palette : ['暖白', '炭黑', '柔金'],
    typography: {
      headline: 'sans-bold',
      body: 'sans-medium',
      accent: 'narrow-condensed',
    },
    lightingStyle: visualDNA?.lighting_style || `${toneSetting} 下的商业产品光影`,
    atmosphere: visualDNA?.atmosphere || `${sceneSetting} 的电商转化氛围`,
    layoutRhythm: '首屏强视觉，中段递进解释，尾屏收束转化',
    decorLanguage: '干净背景、材质衬底、节制装饰',
    moduleSamples: [
      { type: 'hero', layout: 'top-title-bottom-product', emphasis: '商品主体', density: 'low' },
      { type: 'selling_points', layout: 'three-card-grid', emphasis: '利益点', density: 'medium' },
      { type: 'scene', layout: 'immersive-lifestyle', emphasis: '场景代入', density: 'low' },
    ],
  };
}

function buildFallbackFrameAnalysis(
  referenceIndex: number,
  suggestedModules: DetailPageModuleType[],
  layoutSignature: string,
  visualFocus: string,
  copyDensity: string,
  mappingReason: string
): DetailPageReferenceFrameAnalysis {
  return {
    referenceIndex,
    suggestedModules,
    layoutSignature,
    headlineStyle: '标题与主体分层明确',
    copyDensity,
    visualFocus,
    mappingReason,
  };
}

export function createFallbackDetailReferenceAnalysis(
  referenceCount: number,
  visualDNA: VisualDNA | null | undefined,
  sceneSetting: string,
  toneSetting: string
): DetailPageReferenceAnalysis {
  const normalizedCount = Math.max(1, referenceCount || 0);
  const frameFallbacks: DetailPageReferenceFrameAnalysis[] = [];

  for (let index = 0; index < normalizedCount; index += 1) {
    if (index === 0) {
      frameFallbacks.push(
        buildFallbackFrameAnalysis(
          index,
          ['hero', 'scene'],
          '大图强视觉 + 上下标题区',
          '商品主体与氛围底图',
          'low',
          '首张参考优先承担封面和场景氛围，负责定义整套详情页的气质。'
        )
      );
      continue;
    }

    if (index === 1) {
      frameFallbacks.push(
        buildFallbackFrameAnalysis(
          index,
          ['selling_points', 'detail'],
          '模块分栏 + 细节拆解',
          '卖点条列与局部细节',
          'medium',
          '第二张参考优先承担卖点解释和材质细节，适合中段拆解。'
        )
      );
      continue;
    }

    frameFallbacks.push(
      buildFallbackFrameAnalysis(
        index,
        ['benefit', 'spec', 'trust', 'cta'],
        '信息条列 + 理性说明',
        '参数、服务与收口信息',
        'medium',
        '后续参考图主要用来补足参数说明、信任建立和尾屏收口。'
      )
    );
  }

  return {
    workflowSummary:
      normalizedCount > 1
        ? '已先整组理解参考详情图，再映射到固定 8 屏模板。后续每一屏都会优先参考最匹配的样本。'
        : '已先解析参考图的结构与风格，再映射到固定 8 屏模板。',
    adaptationStrategy: '整组参考先统一气质，再逐屏选择更匹配的参考样本，避免每屏风格漂移。',
    referenceStyle: createFallbackDetailReferenceStyle(visualDNA, sceneSetting, toneSetting),
    frames: frameFallbacks,
  };
}

export function mergeDetailPagePlan(
  seedModules: DetailPageModule[],
  plannedModules: DetailPageModulePlan[]
): DetailPageModule[] {
  const planMap = new Map(plannedModules.map((module) => [module.type, module]));
  return seedModules.map((module) => {
    const plan = planMap.get(module.type) || null;
    if (!plan) return module;

    return {
      ...module,
        title: plan.objective || module.title,
        copyGoal: plan.copyTask || module.copyGoal,
        imageGoal: plan.visualTask || module.imageGoal,
        layoutPreset: plan.layoutPreset || module.layoutPreset,
        plan,
        status: 'success',
        assets: {
          ...module.assets,
        },
      };
  });
}

export function createFallbackDetailPagePlans(
  seedModules: DetailPageModule[],
  sceneSetting: string,
  toneSetting: string,
  referenceAnalysis?: DetailPageReferenceAnalysis | null
): DetailPageModulePlan[] {
  const frameAssignments = new Map<DetailPageModuleType, number>();
  referenceAnalysis?.frames.forEach((frame) => {
    frame.suggestedModules.forEach((type) => {
      if (!frameAssignments.has(type)) {
        frameAssignments.set(type, frame.referenceIndex);
      }
    });
  });

  return seedModules.map((module) => ({
    type: module.type,
    objective: module.title,
    headlineDirection: module.copyGoal,
    copyTask: module.copyGoal,
    visualTask: module.imageGoal,
    layoutPreset: module.layoutPreset,
    referenceHint: '沿用参考详情图的整体留白、标题层级与版式节奏',
    sceneHint: sceneSetting,
    toneHint: toneSetting,
    referenceIndex: frameAssignments.get(module.type) ?? null,
  }));
}

export function assignDetailReferencesFromPlan(
  modules: DetailPageModule[],
  referenceImageIds: string[]
): DetailPageModule[] {
  return modules.map((module) => {
    const rawIndex = module.plan?.referenceIndex;
    const nextReferenceId =
      typeof rawIndex === 'number' && Number.isFinite(rawIndex)
        ? referenceImageIds[rawIndex] || module.assets.referenceImageId || null
        : module.assets.referenceImageId || null;

    return {
      ...module,
      assets: {
        ...module.assets,
        referenceImageId: nextReferenceId,
      },
    };
  });
}

export function isDetailModuleSupported(type: DetailPageModuleType): boolean {
  return (
    type === 'hero' ||
    type === 'selling_points' ||
    type === 'scene' ||
    type === 'detail' ||
    type === 'benefit' ||
    type === 'spec' ||
    type === 'trust' ||
    type === 'cta'
  );
}

export function getDetailModuleScenario(type: DetailPageModuleType): ScenarioType {
  switch (type) {
    case 'detail':
      return ScenarioType.MINIMALIST_PREMIUM;
    case 'benefit':
      return ScenarioType.SOCIAL_MEDIA_STORY;
    case 'spec':
      return ScenarioType.STUDIO_WHITE;
    case 'trust':
      return ScenarioType.STUDIO_WHITE;
    case 'cta':
      return ScenarioType.FESTIVAL_PROMO;
    case 'scene':
      return ScenarioType.NATURAL_LIFESTYLE;
    case 'selling_points':
      return ScenarioType.MINIMALIST_PREMIUM;
    case 'hero':
    default:
      return ScenarioType.MINIMALIST_PREMIUM;
  }
}

export function getDetailModuleLayout(type: DetailPageModuleType): CompositionLayout {
  switch (type) {
    case 'detail':
    case 'benefit':
      return 'left_space';
    case 'spec':
      return 'top_space';
    case 'trust':
    case 'cta':
      return 'center';
    case 'selling_points':
      return 'right_space';
    case 'scene':
      return 'center';
    case 'hero':
    default:
      return 'center';
  }
}

export function getDetailModuleLockLevel(type: DetailPageModuleType): 'strict' | 'balanced' | 'editorial' {
  switch (type) {
    case 'spec':
    case 'trust':
      return 'strict';
    case 'detail':
    case 'benefit':
    case 'selling_points':
      return 'balanced';
    case 'scene':
    case 'cta':
    case 'hero':
    default:
      return 'editorial';
  }
}

export function buildDetailModuleImageIntent(
  module: DetailPageModule,
  platform: string,
  sceneSetting: string,
  toneSetting: string,
  referenceStyle: DetailPageReferenceStyle | null
): string {
  const plan = module.plan;
  const palette = referenceStyle?.palette?.join(' / ') || '高级电商综合色板';
  const mood = referenceStyle?.atmosphere || `${sceneSetting} 的代入感`;
  const lighting = referenceStyle?.lightingStyle || toneSetting;

  return [
    `这是电商详情页的第 ${module.order} 屏，模块类型为 ${module.name}。`,
    `目标平台：${platform}。`,
    `核心目标：${plan?.objective || module.title}。`,
    `视觉任务：${plan?.visualTask || module.imageGoal}。`,
    `版式建议：${plan?.layoutPreset || module.layoutPreset}。`,
    `参考风格：${plan?.referenceHint || '沿用整体参考详情页的留白、色彩和版式节奏'}。`,
    `场景限制：${plan?.sceneHint || sceneSetting}。`,
    `色调限制：${plan?.toneHint || toneSetting}。`,
    `配色线索：${palette}。`,
    `氛围关键词：${mood}。`,
    `光影语言：${lighting}。`,
    '画面必须保留真实商品身份，不加任何文字、水印和虚假包装。',
  ]
    .filter(Boolean)
    .join(' ');
}
