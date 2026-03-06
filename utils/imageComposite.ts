import { removeBackground } from "@imgly/background-removal";
import { TextConfig, MarketAnalysis, GenerationMode, FontStyle, AspectRatio, StickerConfig, LogoConfig } from "../types";

// --- 纯净系统高级字体栈 (解决加载慢的问题) ---
export const FONT_REGISTRY: Record<FontStyle, { family: string; weight: string }> = {
  modern_sans: { family: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', weight: '900' },
  elegant_serif: { family: '"Noto Serif SC", "Songti SC", "STSong", serif', weight: '700' },
  bold_display: { family: '"ZCOOL QingKe HuangYou", "Noto Sans SC", "Microsoft YaHei", sans-serif', weight: '900' },
  handwritten_script: { family: '"Ma Shan Zheng", "Kaiti SC", "KaiTi", cursive', weight: '700' },
  tech_mono: { family: '"JetBrains Mono", "Noto Sans SC", "Courier New", monospace', weight: '800' },
  playful_marker: { family: '"ZCOOL QingKe HuangYou", "Noto Sans SC", "Microsoft YaHei", sans-serif', weight: '600' },
  classic_song: { family: '"Noto Serif SC", "STZhongsong", "SimSun", serif', weight: '700' },
  artistic_brush: { family: '"Ma Shan Zheng", "Kaiti SC", "STKaiti", serif', weight: '700' }
};

export async function preloadFont(style: FontStyle): Promise<string> {
  const family = FONT_REGISTRY[style]?.family || FONT_REGISTRY.modern_sans.family;
  const firstFamily = family.split(',')[0]?.trim().replace(/^["']|["']$/g, '') || 'Noto Sans SC';

  if (typeof document !== 'undefined' && document.fonts?.load) {
    try {
      await Promise.all([
        document.fonts.load(`700 28px "${firstFamily}"`),
        document.fonts.ready
      ]);
    } catch (error) {
      console.warn("[preloadFont] font preload failed:", error);
    }
  }

  return family;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => resolve(img); img.onerror = () => reject(new Error("Image Load Error")); img.src = src;
  });
}

/**
 * 移动端 WASM 内存降级策略：强制图片压缩
 * 将图片缩放至最大宽度/高度不超过 maxWidth，降低内存占用
 */
export async function compressImage(base64: string, maxWidth: number = 800): Promise<string> {
  const img = await loadImage(base64);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let width = img.width;
  let height = img.height;

  if (width > height) {
    if (width > maxWidth) {
      height *= maxWidth / width;
      width = maxWidth;
    }
  } else {
    if (height > maxWidth) {
      width *= maxWidth / height;
      height = maxWidth;
    }
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // 导出为较低质量的 JPEG 以节省内存
  return canvas.toDataURL('image/jpeg', 0.8);
}

// 辅助函数：计算阴影参数
function calculateShadowParams(lightingDirection: string) {
  const dir = (lightingDirection || '').toLowerCase();
  let skewX = 0.5; let offsetX = 10;
  const scaleY = 0.25; const offsetY = 0;
  if (dir.includes('left')) { skewX = 0.8; offsetX = 25; }
  if (dir.includes('right')) { skewX = -0.8; offsetX = -25; }
  return { skewX, scaleY, offsetX, offsetY };
}

// === 核心引擎：生成底图 + Logo + 智能融合物理保真 ===
export async function processFinalImage(
  aiResultUrl: string, originalImageBase64: string, analysis: MarketAnalysis, mode: GenerationMode, textConfig: TextConfig, logoImageBase64?: string | null, aspectRatio: AspectRatio = '1:1', stickerConfig?: StickerConfig, logoConfig?: LogoConfig
): Promise<string> {
  const [bgImg, fontFamily] = await Promise.all([loadImage(aiResultUrl), preloadFont(textConfig.fontStyle)]);
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!;

  // 1. 物理级定死电商标准像素尺寸 (绝对不随原图走！)
  let targetW = 1080; let targetH = 1080;
  if (aspectRatio === '3:4') { targetW = 1080; targetH = 1440; }
  else if (aspectRatio === '4:3') { targetW = 1440; targetH = 1080; }
  else if (aspectRatio === '16:9') { targetW = 1920; targetH = 1080; }
  else if (aspectRatio === '9:16') { targetW = 1080; targetH = 1920; }
  canvas.width = targetW; canvas.height = targetH;

  // 2. 背景图智能 Cover 裁剪铺满算法
  const bgRatio = bgImg.width / bgImg.height;
  const targetRatio = targetW / targetH;
  let drawW = targetW, drawH = targetH, drawX = 0, drawY = 0;
  
  if (bgRatio > targetRatio) {
    drawW = targetH * bgRatio; drawX = (targetW - drawW) / 2;
  } else {
    drawH = targetW / bgRatio; drawY = (targetH - drawH) / 2;
  }
  ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);

  // 3. 物理保真模式：渲染前景商品与阴影
  if (mode === 'precision') {
    // 强制压缩原图，防止 WASM 抠图 OOM
    const compressedBase64 = await compressImage(originalImageBase64, 800);
    const blob = await fetch(compressedBase64).then(res => res.blob());
    const mattedBlob = await removeBackground(blob);
    const mattedUrl = URL.createObjectURL(mattedBlob);
    const fgImg = await loadImage(mattedUrl);
    
    const paddingScale = 0.65; const fgRatio = fgImg.width / fgImg.height;
    let fw, fh;
    if (fgRatio > targetRatio) { fw = targetW * paddingScale; fh = fw / fgRatio; } 
    else { fh = targetH * paddingScale; fw = fh * fgRatio; }
    
    const fx = (targetW - fw) / 2; const fy = (targetH - fh) * 0.65;
    const { skewX, scaleY, offsetX, offsetY } = calculateShadowParams(analysis.physicalSpecs.lightingDirection);
    
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = fw; shadowCanvas.height = fh;
    const sctx = shadowCanvas.getContext('2d')!; sctx.drawImage(fgImg, 0, 0, fw, fh);
    sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = 'black'; sctx.fillRect(0, 0, fw, fh);
    ctx.save(); ctx.globalAlpha = 0.2; ctx.filter = 'blur(35px)'; ctx.setTransform(1, 0, skewX, scaleY, fx + offsetX, fy + fh + offsetY);
    ctx.drawImage(shadowCanvas, 0, -fh, fw, fh); ctx.restore();
    
    ctx.save(); ctx.drawImage(fgImg, fx, fy, fw, fh); ctx.restore();
    URL.revokeObjectURL(mattedUrl);
  }

  // 4. 品牌 Logo 渲染 (左上角)
  if (logoImageBase64) {
    try {
      const logoImg = await loadImage(logoImageBase64);
      const logoScale = Math.max(5, Math.min(40, logoConfig?.scale ?? 15));
      const logoWidth = targetW * (logoScale / 100);
      const logoHeight = logoWidth * (logoImg.height / logoImg.width);
      const centerX = logoConfig ? (targetW * logoConfig.positionX) / 100 : targetW * 0.12;
      const centerY = logoConfig ? (targetH * logoConfig.positionY) / 100 : targetH * 0.12;
      const logoX = Math.max(0, Math.min(targetW - logoWidth, centerX - logoWidth / 2));
      const logoY = Math.max(0, Math.min(targetH - logoHeight, centerY - logoHeight / 2));
      ctx.save(); ctx.globalAlpha = 0.9; ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight); ctx.restore();
    } catch (e) { console.error("Logo Error", e); }
  }

  // 5. 动态对齐排版引擎
  if (textConfig.title || textConfig.detail) {
    const weight = FONT_REGISTRY[textConfig.fontStyle]?.weight || '700';
    ctx.save(); ctx.textAlign = textConfig.textAlign || 'center'; ctx.textBaseline = 'middle';
    const posX = (targetW * textConfig.positionX) / 100; const posY = (targetH * textConfig.positionY) / 100;

    if (textConfig.title) {
      const fs = Math.floor(targetW * (textConfig.fontSize / 100));
      ctx.font = `${weight} ${fs}px ${fontFamily}`; ctx.fillStyle = textConfig.mainColor;
      if (textConfig.shadowIntensity > 0) {
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = textConfig.shadowIntensity * 1.5; ctx.shadowOffsetX = textConfig.shadowIntensity / 3; ctx.shadowOffsetY = textConfig.shadowIntensity / 3;
      }
      ctx.fillText(textConfig.title, posX, posY);
    }
    if (textConfig.detail) {
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      const fsDetail = Math.floor(targetW * (textConfig.fontSize / 100) * 0.45);
      ctx.font = `400 ${fsDetail}px ${fontFamily}`; ctx.fillStyle = textConfig.subColor || textConfig.mainColor;
      ctx.fillText(textConfig.detail, posX, posY + (targetW * (textConfig.fontSize / 100)) * 0.8);
    }
    ctx.restore();
  }

  // 6. 营销贴纸系统
  if (stickerConfig && stickerConfig.url) {
    try {
      const stickerImg = await loadImage(stickerConfig.url);
      const stickerWidth = targetW * (stickerConfig.scale / 100); const stickerHeight = stickerWidth * (stickerImg.height / stickerImg.width);
      const stickerX = (targetW * stickerConfig.positionX) / 100 - (stickerWidth / 2); const stickerY = (targetH * stickerConfig.positionY) / 100 - (stickerHeight / 2);
      ctx.save(); ctx.drawImage(stickerImg, stickerX, stickerY, stickerWidth, stickerHeight); ctx.restore();
    } catch (e) { console.error("Sticker Error", e); }
  }

  return canvas.toDataURL('image/png', 0.95);
}

/**
 * 自动化生成二值化遮罩图 (Mask Image)
 * 商品主体为纯白 (#FFFFFF)，背景为纯黑 (#000000)
 */
export async function generateMask(base64: string): Promise<string> {
  const compressedBase64 = await compressImage(base64, 800);
  const blob = await fetch(compressedBase64).then(res => res.blob());
  const mattedBlob = await removeBackground(blob);
  const mattedUrl = URL.createObjectURL(mattedBlob);
  const fgImg = await loadImage(mattedUrl);
  
  const canvas = document.createElement('canvas');
  canvas.width = fgImg.width;
  canvas.height = fgImg.height;
  const ctx = canvas.getContext('2d')!;
  
  // 1. 背景填黑
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 2. 商品主体填白
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = fgImg.width;
  tempCanvas.height = fgImg.height;
  const tctx = tempCanvas.getContext('2d')!;
  tctx.drawImage(fgImg, 0, 0);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = '#FFFFFF';
  tctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  
  // 3. 合并
  ctx.drawImage(tempCanvas, 0, 0);
  
  URL.revokeObjectURL(mattedUrl);
  return canvas.toDataURL('image/png');
}

// === 最终导出引擎：合成文字图层 ===
export async function exportImageWithText(base64Image: string, textConfig: TextConfig, fontFamily: string): Promise<string> {
  const bgImg = await loadImage(base64Image);
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!;
  canvas.width = bgImg.width; canvas.height = bgImg.height;
  ctx.drawImage(bgImg, 0, 0);

  if (textConfig.title || textConfig.detail) {
    const weight = FONT_REGISTRY[textConfig.fontStyle]?.weight || '700';
    ctx.save(); 
    ctx.textAlign = textConfig.textAlign || 'center'; 
    ctx.textBaseline = 'middle';
    const posX = (canvas.width * textConfig.positionX) / 100;
    const posY = (canvas.height * textConfig.positionY) / 100;
    const maxWidth = canvas.width * 0.82;

    const drawWrappedText = (
      text: string,
      startY: number,
      fontSize: number,
      fontWeight: string,
      color: string
    ) => {
      if (!text.trim()) return startY;
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = color;
      const lineHeight = Math.max(fontSize * 1.18, fontSize + 4);
      const x = posX;
      const rawParagraphs = text.replace(/\r\n/g, '\n').split('\n');
      let y = startY;

      for (const paragraph of rawParagraphs) {
        const chars = Array.from(paragraph);
        let line = '';
        if (chars.length === 0) {
          y += lineHeight;
          continue;
        }
        for (const ch of chars) {
          const testLine = `${line}${ch}`;
          if (line && ctx.measureText(testLine).width > maxWidth) {
            ctx.fillText(line, x, y);
            y += lineHeight;
            line = ch;
          } else {
            line = testLine;
          }
        }
        if (line) {
          ctx.fillText(line, x, y);
          y += lineHeight;
        }
      }
      return y;
    };

    if (textConfig.title) {
      const fs = Math.floor(canvas.width * (textConfig.fontSize / 100));
      if (textConfig.shadowIntensity > 0) {
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = textConfig.shadowIntensity * 1.5; ctx.shadowOffsetX = textConfig.shadowIntensity / 3; ctx.shadowOffsetY = textConfig.shadowIntensity / 3;
      }
      const nextY = drawWrappedText(textConfig.title, posY, fs, weight, textConfig.mainColor);
      if (textConfig.detail) {
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        const fsDetail = Math.floor(canvas.width * (textConfig.fontSize / 100) * 0.45);
        drawWrappedText(textConfig.detail, nextY + fs * 0.15, fsDetail, '400', textConfig.subColor || textConfig.mainColor);
      }
    } else if (textConfig.detail) {
      const fsDetail = Math.floor(canvas.width * (textConfig.fontSize / 100) * 0.45);
      drawWrappedText(textConfig.detail, posY, fsDetail, '400', textConfig.subColor || textConfig.mainColor);
    }
    ctx.restore();
  }
  return canvas.toDataURL('image/png', 0.95);
}
