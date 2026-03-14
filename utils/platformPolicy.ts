import { DetailPageModuleType, ScenarioType, TargetPlatform } from '../types';

export type PlatformImageRole =
  | 'shelf_main'
  | 'shelf_detail'
  | 'amazon_main'
  | 'amazon_secondary'
  | 'xhs_cover'
  | 'xhs_feed'
  | 'tiktok_cover'
  | 'tiktok_feed';

interface PlatformPolicyContext {
  scenario?: ScenarioType;
  moduleType?: DetailPageModuleType;
  isDetailPage?: boolean;
}

interface PlatformPolicyDefinition {
  label: string;
  summary: string;
  hardRules: string[];
  styleBias: string[];
  bannedElements: string[];
}

const PLATFORM_POLICIES: Record<PlatformImageRole, PlatformPolicyDefinition> = {
  shelf_main: {
    label: '国内电商主图',
    summary: '货架点击率优先，商品主体清晰、信息真实、背景干净，默认按主流电商首图保守基线执行。',
    hardRules: [
      '商品主体必须清晰完整，颜色、规格、包装与真实 SKU 保持一致。',
      '首图优先使用纯净背景或极简台面，不要塞入无关主体、复杂拼贴和喧宾夺主的道具。',
      '禁止二维码、联系方式、站外引流信息、伪官方徽章、夸张促销贴片和大面积水印。',
      '禁止虚假宣传、绝对化承诺、医疗化暗示、伪造认证、伪造排名和误导性功效表达。',
    ],
    styleBias: [
      '手机端一眼看清商品轮廓和材质',
      '构图稳定，主体占比高，转化导向明确',
      '光线真实，边缘干净，允许轻微自然投影',
    ],
    bannedElements: ['二维码', '电话号码', '夸张大促字', '伪官方奖章', '与商品无关的人物或其他商品'],
  },
  shelf_detail: {
    label: '国内电商详情图',
    summary: '允许场景化和信息递进，但仍以真实商品、真实卖点和平台安全表达为底线。',
    hardRules: [
      '商品身份必须稳定，不得换包装、改品牌、改规格或虚构不存在的配件。',
      '可以用场景、材质和道具强化卖点，但道具只能服务商品，不能制造误导。',
      '禁止二维码、联系方式、站外引流、假资质、假销量、绝对化宣传和违规医疗功效。',
      '如果需要留文案空间，只能留空位，不要把文字直接烙进图片主体里。',
    ],
    styleBias: [
      '允许更强的场景代入和版式节奏',
      '画面要利于后续叠加标题、卖点和参数信息',
      '商品始终是焦点，不要被环境抢走注意力',
    ],
    bannedElements: ['站外引流元素', '伪证书', '伪检测章', '低质拼贴', '假前后对比'],
  },
  amazon_main: {
    label: '亚马逊主图',
    summary: '严格按 Amazon 主图思路执行：白底、真实商品、无字无装饰、主体占比高。',
    hardRules: [
      '背景必须是纯白或近纯白无缝背景，主视觉干净到近似主图标准。',
      '商品必须是实际售卖商品本体，保持真实外观，不得变成插画、概念图或虚构包装。',
      '主体占画面绝大部分，边缘完整清晰，不出现未包含的配件、支架、场景道具和人物。',
      '绝对禁止文字、图标、水印、徽章、边框、拼接图、价格贴和营销贴片。',
    ],
    styleBias: [
      '高锐度、高材质还原、影棚级白底商业拍摄感',
      '构图极简，焦点只给商品',
      '允许非常克制的自然阴影，但不能破坏白底主图感',
    ],
    bannedElements: ['文字', '水印', '拼贴', '生活方式背景', '未售卖配件', '拟人化摆拍'],
  },
  amazon_secondary: {
    label: '亚马逊辅图',
    summary: '仍然保持真实商品与功能表达，但可以加入场景、细节和使用语境。',
    hardRules: [
      '商品必须与实际 SKU 一致，不得改包装、改结构或加入不存在的功能部件。',
      '允许适度生活方式场景、尺度对比和细节特写，但不能让无关元素喧宾夺主。',
      '禁止伪官方背书、虚假功效、误导性 Before/After、违规医疗暗示和站外引流。',
      '默认仍不把大段文字直接烙进图里，优先输出可后期叠加信息的干净画面。',
    ],
    styleBias: [
      '理性、清楚、信息型画面',
      '细节特写、使用场景、尺度感都可以，但要克制',
      '更像高质量电商辅图，不像杂志硬广',
    ],
    bannedElements: ['伪证书', '夸张功效', '无关模特抢镜', '过度艺术化背景', '站外联系方式'],
  },
  xhs_cover: {
    label: '小红书封面图',
    summary: '真实分享感优先，不能像硬广海报，不能出现引流与误导表达。',
    hardRules: [
      '画面必须像真实种草内容，不要做成传统电商促销海报或强售卖广告板。',
      '禁止官网、官方、邀请码、二维码、电话、网址、地址、社交账号等引流信息。',
      '禁止夸张诱导、违背客观事实的视觉表达、伪官方背书、低俗擦边和误导式封面。',
      '商品仍需真实可辨识，但整体观感要像真实分享而非店铺主图。',
    ],
    styleBias: [
      '自然光、生活化、留白呼吸感、镜头更像真实用户拍摄',
      '允许轻微手持感和生活痕迹，但仍要保持高级审美',
      '强调情绪价值、可分享感、封面抓眼但不廉价',
    ],
    bannedElements: ['价格贴片', '二维码', '联系方式', '伪官方文案', '过度夸张前后对比'],
  },
  xhs_feed: {
    label: '小红书正文配图',
    summary: '偏真实记录和轻编辑感，强调可信生活场景与体验表达。',
    hardRules: [
      '内容必须真实可信，不能制造过度功效、虚假体验和违背客观事实的画面。',
      '禁止站外引流、联系方式、二维码、邀请码和伪官方身份暗示。',
      '禁止低俗擦边、过强营销话术图形化、伪科普和伪实验室背书。',
      '商品可以融入生活场景，但必须保持真实品类和真实包装。',
    ],
    styleBias: [
      '更像真实种草笔记的配图',
      '环境自然、镜头亲近、不过分商业化',
      '给文案留空间，但图片本身不焊死广告语',
    ],
    bannedElements: ['站外引流元素', '假测评对比', '夸张功效示意', '劣质大字报'],
  },
  tiktok_cover: {
    label: '抖音/TikTok 封面',
    summary: '停留率和首屏抓眼优先，但仍要避开虚假宣传与低质贴片。',
    hardRules: [
      '商品主体必须明确，封面应在小屏上瞬间识别出卖点方向。',
      '禁止站外引流、联系方式、伪官方背书、虚假功效和误导性夸张结果。',
      '画面可以更强冲击，但不能失真到认不出真实商品。',
      '默认不生成大段贴片文案，优先保留后期叠字空间。',
    ],
    styleBias: [
      '高对比、强节奏、首屏抓眼',
      '适合竖屏传播和快速停留',
      '允许更动态的构图和更明确的情绪色彩',
    ],
    bannedElements: ['低质贴图', '夸张神效', '伪官方标签', '站外二维码'],
  },
  tiktok_feed: {
    label: '抖音/TikTok 内容图',
    summary: '更强调场景和动态感，但仍需保持商品真实与审核安全。',
    hardRules: [
      '商品必须真实稳定，不得擅自换品、换包装或虚构功能。',
      '允许生活化场景和更强镜头动势，但不能误导商品效果。',
      '禁止站外引流、联系方式、伪官方背书和夸张疗效式表达。',
      '输出要利于短视频封面或内容图复用，不要做成平面硬广板。',
    ],
    styleBias: [
      '更动态、更有情绪，但依然要商业清晰',
      '适合竖屏节奏和内容传播',
      '环境可以热闹，但商品识别必须稳',
    ],
    bannedElements: ['站外联系方式', '过度夸张结果', '无关人物抢镜', '过度复杂拼贴'],
  },
};

export function resolvePlatformImageRole(
  targetPlatform: TargetPlatform,
  context: PlatformPolicyContext = {}
): PlatformImageRole {
  const { scenario, moduleType, isDetailPage } = context;

  switch (targetPlatform) {
    case '亚马逊爆款':
      if (moduleType) {
        return moduleType === 'hero' && scenario === ScenarioType.STUDIO_WHITE ? 'amazon_main' : 'amazon_secondary';
      }
      return !isDetailPage && scenario === ScenarioType.STUDIO_WHITE ? 'amazon_main' : 'amazon_secondary';
    case '小红书种草':
      if (moduleType) {
        return moduleType === 'hero' ? 'xhs_cover' : 'xhs_feed';
      }
      return scenario === ScenarioType.SOCIAL_MEDIA_STORY ? 'xhs_cover' : 'xhs_feed';
    case '抖音/TikTok':
      return scenario === ScenarioType.SOCIAL_MEDIA_STORY ? 'tiktok_cover' : 'tiktok_feed';
    case '通用电商':
    default:
      if (moduleType || isDetailPage) {
        return 'shelf_detail';
      }
      return scenario === ScenarioType.STUDIO_WHITE ? 'shelf_main' : 'shelf_detail';
  }
}

export function getPlatformPolicy(
  targetPlatform: TargetPlatform,
  context: PlatformPolicyContext = {}
): PlatformPolicyDefinition & { role: PlatformImageRole; targetPlatform: TargetPlatform } {
  const role = resolvePlatformImageRole(targetPlatform, context);
  return {
    targetPlatform,
    role,
    ...PLATFORM_POLICIES[role],
  };
}

export function buildPlatformPolicyPrompt(
  targetPlatform: TargetPlatform,
  context: PlatformPolicyContext = {}
): string {
  const policy = getPlatformPolicy(targetPlatform, context);
  return [
    `[PLATFORM POLICY] Target platform: ${policy.targetPlatform}. Image role: ${policy.label}.`,
    `[PLATFORM SUMMARY] ${policy.summary}`,
    `[HARD RULES] ${policy.hardRules.join(' ')}`,
    `[STYLE BIAS] ${policy.styleBias.join('；')}。`,
    `[NEGATIVE RULES] Strictly forbid: ${policy.bannedElements.join(', ')}.`,
  ].join('\n');
}

export function buildPlatformPolicySummary(
  targetPlatform: TargetPlatform,
  context: PlatformPolicyContext = {}
): string {
  const policy = getPlatformPolicy(targetPlatform, context);
  return `${policy.label}：${policy.summary} 硬限制包括：${policy.hardRules.join('；')} 禁止：${policy.bannedElements.join('、')}。`;
}
