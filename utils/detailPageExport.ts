import { DetailPageModule, DetailPageReferenceStyle, FontStyle } from '../types';
import { FONT_REGISTRY, loadImage, preloadFont } from './imageComposite';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 1600;

function pickFontStyle(hint: string | undefined, fallback: FontStyle): FontStyle {
  const value = String(hint || '').toLowerCase();
  if (value.includes('serif') || value.includes('song')) return 'elegant_serif';
  if (value.includes('mono') || value.includes('tech')) return 'tech_mono';
  if (value.includes('display') || value.includes('accent')) return 'bold_display';
  return fallback;
}

function colorFromToken(token: string, fallback: string): string {
  const value = token.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;

  const maps: Array<[RegExp, string]> = [
    [/(金|gold|amber|beige|米|沙)/i, '#D9B779'],
    [/(黑|charcoal|graphite|stone|炭)/i, '#1F2937'],
    [/(白|cream|ivory|雪)/i, '#F8F5EF'],
    [/(灰|gray|grey|银)/i, '#CBD5E1'],
    [/(蓝|blue|ocean|navy)/i, '#6E8FCF'],
    [/(绿|green|olive|sage)/i, '#87A889'],
    [/(粉|pink|rose|blush)/i, '#E8B9B9'],
    [/(红|red|wine|burgundy)/i, '#A65A5A'],
    [/(紫|violet|lavender)/i, '#A690D4'],
  ];

  const matched = maps.find(([pattern]) => pattern.test(value));
  return matched?.[1] || fallback;
}

function resolvePalette(referenceStyle: DetailPageReferenceStyle | null) {
  const palette = referenceStyle?.palette || [];
  return {
    bgStart: colorFromToken(palette[0] || '', '#F4F1EA'),
    bgEnd: colorFromToken(palette[1] || '', '#E8E1D4'),
    accent: colorFromToken(palette[2] || '', '#1F2937'),
    soft: colorFromToken(palette[3] || '', '#FFFFFF'),
  };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function clipRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.clip();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const sourceRatio = img.width / img.height;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (sourceRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: string,
  color: string,
  lineHeight: number,
  maxLines?: number
) {
  if (!text.trim()) return y;

  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const chars = Array.from(text.replace(/\r\n/g, '\n'));
  let line = '';
  let currentY = y;
  let lineCount = 0;

  for (const char of chars) {
    if (char === '\n') {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
      line = '';
      lineCount += 1;
      if (maxLines && lineCount >= maxLines) return currentY;
      continue;
    }
    const next = `${line}${char}`;
    if (line && ctx.measureText(next).width > maxWidth) {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
      line = char;
      lineCount += 1;
      if (maxLines && lineCount >= maxLines) return currentY;
    } else {
      line = next;
    }
  }

  if (line && (!maxLines || lineCount < maxLines)) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

function drawChips(
  ctx: CanvasRenderingContext2D,
  items: string[],
  x: number,
  y: number,
  maxWidth: number,
  accentColor: string
) {
  let currentX = x;
  let currentY = y;
  const chipHeight = 46;
  const gap = 12;

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '700 22px "Noto Sans SC", "PingFang SC", sans-serif';

  for (const item of items) {
    const label = item.trim();
    if (!label) continue;
    const width = Math.min(maxWidth, ctx.measureText(label).width + 40);
    if (currentX + width > x + maxWidth) {
      currentX = x;
      currentY += chipHeight + gap;
    }
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.strokeStyle = `${accentColor}33`;
    ctx.lineWidth = 2;
    roundedRect(ctx, currentX, currentY, width, chipHeight, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accentColor;
    ctx.fillText(label, currentX + 20, currentY + chipHeight / 2);
    ctx.restore();
    currentX += width + gap;
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  module: DetailPageModule,
  referenceStyle: DetailPageReferenceStyle | null,
  accent: string
) {
  ctx.save();
  ctx.fillStyle = `${accent}B0`;
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`0${module.order} / ${module.type}`, 92, CANVAS_HEIGHT - 72);
  ctx.textAlign = 'right';
  ctx.fillText(referenceStyle?.pageStyle || 'universal-detail-engine', CANVAS_WIDTH - 92, CANVAS_HEIGHT - 72);
  ctx.restore();
}

export async function exportDetailPageModuleImage(
  module: DetailPageModule,
  referenceStyle: DetailPageReferenceStyle | null
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持画布导出');
  }

  const palette = resolvePalette(referenceStyle);
  const headlineStyle = pickFontStyle(referenceStyle?.typography?.headline, module.type === 'hero' || module.type === 'cta' ? 'bold_display' : 'modern_sans');
  const bodyStyle = pickFontStyle(referenceStyle?.typography?.body, 'modern_sans');
  const headlineFamily = await preloadFont(headlineStyle);
  const bodyFamily = await preloadFont(bodyStyle);
  const headlineWeight = FONT_REGISTRY[headlineStyle]?.weight || '800';
  const bodyWeight = FONT_REGISTRY[bodyStyle]?.weight || '500';

  const bgGradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  bgGradient.addColorStop(0, palette.bgStart);
  bgGradient.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = palette.soft;
  ctx.beginPath();
  ctx.arc(CANVAS_WIDTH - 140, 180, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(170, CANVAS_HEIGHT - 180, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.12)';
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  roundedRect(ctx, 58, 58, CANVAS_WIDTH - 116, CANVAS_HEIGHT - 116, 44);
  ctx.fill();
  ctx.restore();

  const safeHeadline = module.assets.headline || module.plan?.objective || module.title;
  const safeSubheadline = module.assets.subheadline || module.plan?.headlineDirection || module.copyGoal;
  const safeBody = module.assets.body || module.plan?.copyTask || module.copyGoal;
  const sellingPoints = module.assets.sellingPoints.length > 0 ? module.assets.sellingPoints : [];

  let image: HTMLImageElement | null = null;
  if (module.assets.imageUrl) {
    try {
      image = await loadImage(module.assets.imageUrl);
    } catch (error) {
      console.warn('[exportDetailPageModuleImage] image load failed:', error);
      image = null;
    }
  }

  const drawImagePanel = (x: number, y: number, width: number, height: number, radius: number, gradientFrom: string, gradientTo: string) => {
    ctx.save();
    roundedRect(ctx, x, y, width, height, radius);
    const panelGradient = ctx.createLinearGradient(x, y, x + width, y + height);
    panelGradient.addColorStop(0, gradientFrom);
    panelGradient.addColorStop(1, gradientTo);
    ctx.fillStyle = panelGradient;
    ctx.fill();
    if (image) {
      clipRoundedRect(ctx, x, y, width, height, radius);
      drawImageCover(ctx, image, x, y, width, height);
    }
    ctx.restore();
  };

  switch (module.type) {
    case 'hero': {
      drawImagePanel(92, 92, 1016, 928, 38, '#FFFFFF', `${palette.accent}22`);
      const overlay = ctx.createLinearGradient(92, 680, 92, 1020);
      overlay.addColorStop(0, 'rgba(15,23,42,0)');
      overlay.addColorStop(1, 'rgba(15,23,42,0.62)');
      ctx.save();
      roundedRect(ctx, 92, 92, 1016, 928, 38);
      ctx.clip();
      ctx.fillStyle = overlay;
      ctx.fillRect(92, 92, 1016, 928);
      ctx.restore();

      drawTextBlock(ctx, safeHeadline, 140, 760, 720, `${headlineWeight} 78px ${headlineFamily}`, '#FFFFFF', 92, 2);
      drawTextBlock(ctx, safeSubheadline, 140, 930, 700, `600 30px ${bodyFamily}`, 'rgba(255,255,255,0.92)', 42, 2);
      drawTextBlock(ctx, safeBody, 94, 1090, 1012, `${bodyWeight} 30px ${bodyFamily}`, '#334155', 44, 3);
      drawChips(ctx, sellingPoints.slice(0, 3), 94, 1290, 1012, palette.accent);
      break;
    }
    case 'selling_points': {
      drawTextBlock(ctx, safeHeadline, 94, 112, 470, `${headlineWeight} 66px ${headlineFamily}`, palette.accent, 84, 2);
      drawTextBlock(ctx, safeSubheadline, 94, 270, 470, `600 28px ${bodyFamily}`, '#475569', 40, 3);
      drawImagePanel(604, 104, 504, 602, 36, '#FFFFFF', `${palette.accent}20`);
      drawTextBlock(ctx, safeBody, 94, 392, 470, `${bodyWeight} 26px ${bodyFamily}`, '#475569', 40, 5);

      const cards = sellingPoints.length > 0 ? sellingPoints : ['卖点一', '卖点二', '卖点三', '卖点四'];
      cards.slice(0, 4).forEach((point, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const cardX = 94 + col * 246;
        const cardY = 860 + row * 188;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = `${palette.accent}22`;
        ctx.lineWidth = 2;
        roundedRect(ctx, cardX, cardY, 224, 156, 28);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = palette.accent;
        ctx.font = '700 18px "JetBrains Mono", monospace';
        ctx.fillText(`0${index + 1}`, cardX + 24, cardY + 34);
        drawTextBlock(ctx, point, cardX + 24, cardY + 58, 176, `700 28px ${headlineFamily}`, '#1F2937', 38, 3);
        ctx.restore();
      });
      break;
    }
    case 'scene': {
      drawImagePanel(92, 92, 1016, 1040, 40, '#FFFFFF', `${palette.accent}20`);
      ctx.save();
      roundedRect(ctx, 120, 920, 960, 280, 32);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fill();
      ctx.restore();
      drawTextBlock(ctx, safeHeadline, 154, 960, 620, `${headlineWeight} 68px ${headlineFamily}`, palette.accent, 84, 2);
      drawTextBlock(ctx, safeSubheadline, 154, 1126, 560, `600 28px ${bodyFamily}`, '#475569', 40, 2);
      drawTextBlock(ctx, safeBody, 94, 1272, 1012, `${bodyWeight} 28px ${bodyFamily}`, '#334155', 40, 4);
      drawChips(ctx, sellingPoints.slice(0, 3), 94, 1430, 1012, palette.accent);
      break;
    }
    case 'detail': {
      drawTextBlock(ctx, safeHeadline, 94, 112, 440, `${headlineWeight} 64px ${headlineFamily}`, palette.accent, 80, 2);
      drawTextBlock(ctx, safeSubheadline, 94, 250, 440, `600 28px ${bodyFamily}`, '#475569', 40, 3);
      drawTextBlock(ctx, safeBody, 94, 420, 440, `${bodyWeight} 26px ${bodyFamily}`, '#334155', 38, 5);
      drawImagePanel(592, 110, 516, 940, 36, '#FFFFFF', `${palette.accent}18`);
      drawChips(ctx, sellingPoints.slice(0, 4), 94, 1220, 1012, palette.accent);
      break;
    }
    case 'benefit': {
      drawImagePanel(92, 110, 450, 760, 36, '#FFFFFF', `${palette.accent}18`);
      drawTextBlock(ctx, safeHeadline, 590, 128, 470, `${headlineWeight} 60px ${headlineFamily}`, palette.accent, 78, 2);
      drawTextBlock(ctx, safeSubheadline, 590, 270, 470, `600 28px ${bodyFamily}`, '#475569', 40, 3);
      drawTextBlock(ctx, safeBody, 590, 430, 470, `${bodyWeight} 26px ${bodyFamily}`, '#334155', 38, 5);
      drawChips(ctx, sellingPoints.slice(0, 4), 92, 1020, 1012, palette.accent);
      break;
    }
    case 'spec': {
      drawTextBlock(ctx, safeHeadline, 94, 112, 640, `${headlineWeight} 62px ${headlineFamily}`, palette.accent, 80, 2);
      drawTextBlock(ctx, safeSubheadline, 94, 252, 620, `600 28px ${bodyFamily}`, '#475569', 40, 2);
      drawImagePanel(808, 110, 300, 300, 30, '#FFFFFF', `${palette.accent}15`);
      const rows = (sellingPoints.length > 0 ? sellingPoints : safeBody.split(/[，。,；;]+/))
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6);
      rows.forEach((row, index) => {
        const y = 480 + index * 120;
        ctx.save();
        ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.58)';
        roundedRect(ctx, 94, y, 1012, 92, 24);
        ctx.fill();
        ctx.fillStyle = palette.accent;
        ctx.font = '700 22px "JetBrains Mono", monospace';
        ctx.fillText(`SPEC ${String(index + 1).padStart(2, '0')}`, 122, y + 56);
        drawTextBlock(ctx, row, 340, y + 22, 720, `700 30px ${headlineFamily}`, '#1F2937', 38, 2);
        ctx.restore();
      });
      break;
    }
    case 'trust': {
      drawTextBlock(ctx, safeHeadline, 94, 120, 720, `${headlineWeight} 64px ${headlineFamily}`, palette.accent, 80, 2);
      drawTextBlock(ctx, safeSubheadline, 94, 260, 720, `600 28px ${bodyFamily}`, '#475569', 40, 2);
      drawImagePanel(92, 408, 1016, 540, 36, '#FFFFFF', `${palette.accent}16`);
      drawChips(ctx, sellingPoints.slice(0, 4), 94, 1030, 1012, palette.accent);
      drawTextBlock(ctx, safeBody, 94, 1248, 1012, `${bodyWeight} 28px ${bodyFamily}`, '#334155', 40, 4);
      break;
    }
    case 'cta':
    default: {
      drawTextBlock(ctx, safeHeadline, 94, 120, 1012, `${headlineWeight} 72px ${headlineFamily}`, palette.accent, 88, 2);
      drawTextBlock(ctx, safeSubheadline, 94, 282, 1012, `600 30px ${bodyFamily}`, '#475569', 42, 2);
      drawImagePanel(218, 470, 764, 760, 40, '#FFFFFF', `${palette.accent}18`);
      drawTextBlock(ctx, safeBody, 94, 1290, 1012, `${bodyWeight} 30px ${bodyFamily}`, '#334155', 42, 3);
      drawChips(ctx, sellingPoints.slice(0, 3), 94, 1450, 1012, palette.accent);
      break;
    }
  }

  drawFooter(ctx, module, referenceStyle, palette.accent);
  return canvas.toDataURL('image/png', 0.96);
}

export async function exportDetailPageSuiteImage(
  modules: DetailPageModule[],
  referenceStyle: DetailPageReferenceStyle | null
): Promise<string> {
  const orderedModules = [...modules].sort((left, right) => left.order - right.order);
  if (orderedModules.length === 0) {
    throw new Error('当前没有可导出的详情页模块');
  }

  const dataUrls: string[] = [];
  for (const module of orderedModules) {
    dataUrls.push(await exportDetailPageModuleImage(module, referenceStyle));
  }

  const images = await Promise.all(dataUrls.map((url) => loadImage(url)));
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT * images.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持长图导出');
  }

  ctx.fillStyle = '#F5F5F4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  images.forEach((image, index) => {
    ctx.drawImage(image, 0, index * CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
  });

  return canvas.toDataURL('image/png', 0.96);
}
