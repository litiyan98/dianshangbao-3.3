import {
  AspectRatio,
  CompositionLayout,
  GenerationMode,
  MarketAnalysis,
  ScenarioType,
  TextConfig,
  VisualDNA,
} from "../types";

export function buildEnhancedPrompt(
  scenario: ScenarioType,
  analysis: MarketAnalysis,
  userIntent: string,
  textConfig: TextConfig,
  mode: GenerationMode,
  styleImageBase64?: string,
  visualDNA?: VisualDNA | null,
  variationPrompt?: string,
  aspectRatio: AspectRatio = '1:1',
  layout: CompositionLayout = 'center',
  redesignPrompt?: string,
  targetPlatform: string = '通用电商',
  productLockLevel: 'strict' | 'balanced' | 'editorial' = 'strict'
): string {
  let ratioDirective = "";
  if (aspectRatio === '3:4' || aspectRatio === '9:16') {
    ratioDirective = `[COMPOSITION: Vertical/Portrait orientation (${aspectRatio}). Frame the subject tall and elegant.]`;
  } else if (aspectRatio === '16:9' || aspectRatio === '4:3') {
    ratioDirective = `[COMPOSITION: Horizontal/Landscape orientation (${aspectRatio}). Wide cinematic framing.]`;
  } else {
    ratioDirective = `[COMPOSITION: Perfect square 1:1 framing. Center the subject.]`;
  }

  const aestheticBase = `${ratioDirective}\n[GLOBAL AESTHETIC MASTER-CLASS] Award-winning commercial product photography, shot on Hasselblad H6D-100c or Sony A7R IV, 85mm f/1.8 lens. Raw unedited aesthetic, extreme macro texture detail, authentic physical lighting. No digitized CGI look, absolutely no text, no watermarks, flawless commercial packshot.`;

  let platformDirective = "";
  switch (targetPlatform) {
    case '亚马逊爆款':
      platformDirective = `\n[PLATFORM OPTIMIZATION: AMAZON A9 ALGORITHM] Strictly adhere to Amazon main image standards. Extreme product clarity, hyper-realistic macro details, neutral or pure white premium background. Focus 100% on product material and functional detail. Zero distracting lifestyle elements. High CTR optimized.`;
      break;
    case '小红书种草':
      platformDirective = `\n[PLATFORM OPTIMIZATION: XIAOHONGSHU VIRAL AESTHETIC] Follow Xiaohongshu (Little Red Book) viral UGC aesthetic. Strong emotional value, authentic lifestyle context, highly aesthetic and breathable composition, dappled light, cozy and premium vibe. Make it highly shareable and trendy.`;
      break;
    case '抖音/TikTok':
      platformDirective = `\n[PLATFORM OPTIMIZATION: TIKTOK THUMBNAIL] High visual impact, extremely vibrant colors, dynamic composition, stop-scrolling thumbnail style, high contrast, energetic atmosphere. Optimized for mobile vertical viewing hook.`;
      break;
    default:
      platformDirective = `\n[PLATFORM OPTIMIZATION: GENERAL E-COMMERCE] High commercial viability, clear product display, visually appealing and balanced composition.`;
  }

  const cameraSpecs = "[CAMERA & RENDER] Hasselblad H6D-100c, 100mm Macro lens, f/8. 8k resolution, Octane Render, global illumination, Ray Tracing, ultra-detailed textures.";

  let vibe = "";
  switch (scenario) {
    case ScenarioType.STUDIO_WHITE:
      vibe = "[AMAZON/TMALL STANDARD] Pure white #FFFFFF seamless background. Studio softbox lighting. Extreme sharpness. High commercial viability, zero distracting elements.";
      break;
    case ScenarioType.MINIMALIST_PREMIUM:
      vibe = "[JD LUXURY STYLE] Minimalist premium setting. Matte acrylic or textured plaster geometric pedestals. Low saturation neutral tones. Chiaroscuro lighting with elegant soft cast shadows.";
      break;
    case ScenarioType.NATURAL_LIFESTYLE:
      vibe = "[XIAOHONGSHU/INS LIFESTYLE] Cozy highly realistic natural setting. Dappled morning sunlight (gobo lighting) filtering through window. Organic textures (linen, wood, stone). Warm, inviting, breathable.";
      break;
    case ScenarioType.OUTDOOR_STREET:
      vibe = "[TAOBAO FASHION/OUTDOOR] Dynamic outdoor environment. Shallow depth of field with beautiful bokeh. Golden hour natural sunlight. Vibrant, energetic, high contrast.";
      break;
    case ScenarioType.FESTIVAL_PROMO:
      vibe = "[TAOBAO DOUBLE 11 MEGA SALE] Festive promotional commercial vibe. Warm spotlighting, subtle celebratory out-of-focus background elements. High saturation, eye-catching, high click-through-rate style.";
      break;
    case ScenarioType.SOCIAL_MEDIA_STORY:
      vibe = "[TIKTOK/XIAOHONGSHU VIRAL] Trendy, visually striking modern lifestyle context. Dynamic angles, pop of complementary colors. Highly shareable aesthetic.";
      break;
  }

  let compositionRules = "";
  switch (aspectRatio) {
    case '1:1':
      compositionRules = "\n[COMPOSITION - SQUARE] Balanced, symmetrical composition. The environment should feel contained and focused around the center.";
      break;
    case '3:4':
    case '9:16':
      compositionRules = "\n[COMPOSITION - VERTICAL/PORTRAIT] Emphasize verticality and height. Use leading lines that draw the eye upwards. The background should feel tall and spacious, allowing for breathing room above or below the subject.";
      break;
    case '16:9':
    case '4:3':
      compositionRules = "\n[COMPOSITION - HORIZONTAL/CINEMATIC] Expansive, wide-angle composition. Emphasize the breadth of the environment. Use horizontal leading lines. The background should feel panoramic and epic, providing context and scale.";
      break;
  }

  let layoutDirective = "";
  switch (layout) {
    case 'center':
      layoutDirective = "\n[LAYOUT PLACEMENT] Subject placed perfectly in the center. Symmetrical balance.";
      break;
    case 'left_space':
      layoutDirective = "\n[LAYOUT PLACEMENT - CRITICAL] Place the main subject clearly on the RIGHT side. The entire LEFT half MUST be clean negative space for copy.";
      break;
    case 'right_space':
      layoutDirective = "\n[LAYOUT PLACEMENT - CRITICAL] Place the main subject clearly on the LEFT side. The entire RIGHT half MUST be clean negative space for copy.";
      break;
    case 'top_space':
      layoutDirective = "\n[LAYOUT PLACEMENT - CRITICAL] Place the main subject at the BOTTOM. The entire TOP half MUST be clean negative space expanding upwards.";
      break;
  }

  const guardrails = mode === 'precision'
    ? `[PHYSICAL CONSTRAINTS - STRICT] Build an EMPTY background ready for a product.\n- Angle: ${analysis.physicalSpecs.cameraPerspective}\n- Light: ${analysis.physicalSpecs.lightingDirection}\n- Temp: ${analysis.physicalSpecs.colorTemperature}\nDO NOT RENDER THE MAIN PRODUCT.`
    : `[INTEGRATION] Integrate the product perfectly.`;

  let dnaDirective = "";
  if (visualDNA) {
    dnaDirective = `
\n[STYLE TRANSFER OVERRIDE - CRITICAL]
Apply the following visual style completely to the entire image:
- Lighting & Shadows: ${visualDNA.lighting_style}
- Color Grading: ${visualDNA.color_palette}
- Overall Vibe: ${visualDNA.atmosphere}
WARNING: Apply ONLY the lighting, color, and vibe. Do NOT introduce any new objects or props based on this style reference.
`;
  }

  let redesignDirective = "";
  if (redesignPrompt) {
    redesignDirective = `\n[VIRTUAL REDESIGN]: Change the material and surface texture of the masked object to strictly be: "${redesignPrompt}".`;
  }

  const styleDirective = (styleImageBase64 && !visualDNA) ? `[STYLE TRANSFER] Extract and replicate the exact color grading, lighting, and aesthetic DNA of the SECOND image.\n` : "";
  const variationDirective = variationPrompt ? `\n[MANDATORY COMMERCIAL VARIATION] ${variationPrompt}\n` : "";
  const productIdentityLock = (() => {
    if (redesignPrompt) return "";

    switch (productLockLevel) {
      case 'balanced':
        return `\n[ABSOLUTE PRODUCT ID LOCK - BALANCED] The uploaded product image remains the only canonical SKU reference. Preserve the exact same product identity, bottle silhouette, cap shape, overall proportions, label layout, branding placement, and packaging artwork. A subtle perspective shift of the SAME bottle is allowed, but do NOT redesign, relabel, simplify, or replace it with a similar beverage. You may only enhance material realism, condensation, reflections, refraction, and premium lighting around the same package.\n`;
      case 'editorial':
        return `\n[ABSOLUTE PRODUCT ID LOCK - EDITORIAL] The uploaded product image is still the canonical SKU. Keep the product immediately recognizable as the same bottle and the same packaging design, including cap form, bottle structure, label system, branding position, color blocking, and fruit/package artwork. A moderate camera angle shift and stronger art direction are allowed, but the product itself must remain the same SKU. Never substitute it with a different beverage, generic bottle, or redesigned package.\n`;
      case 'strict':
      default:
        return `\n[ABSOLUTE PRODUCT ID LOCK - STRICT] Treat the uploaded product image as the only canonical SKU reference. You MUST keep the exact same product identity in the final image. Preserve the exact bottle silhouette, cap shape, neck and base proportions, label layout, branding position, packaging color blocking, and printed fruit/package artwork from the uploaded product. Do NOT redesign, substitute, simplify, or replace it with a similar beverage or a generic bottle. No camera angle change is allowed. Only change scene, lighting, reflections, and peripheral environment around the SAME product. Product label graphics that already exist on the uploaded package must remain consistent; the NO TEXT rule only forbids adding new scene text or watermarks.\n`;
    }
  })();

  let finalRedesignOverride = "";
  if (redesignPrompt) {
    finalRedesignOverride = `\n[ABSOLUTE PRIORITY OVERRIDE]: The user has commanded a VIRTUAL REDESIGN. You MUST preserve the exact original shape of the uploaded product but completely transform its surface material/color to: "${redesignPrompt}". This overrides any conflicting lighting or platform rules. Do NOT distort the product's physical structure.`;
  }

  return `${aestheticBase}${platformDirective}\nYou are a Top-tier Commercial E-commerce Photographer.\n${cameraSpecs}\n[SCENE VIBE] ${vibe}\n${compositionRules}${layoutDirective}\n${guardrails}${productIdentityLock}\n${dnaDirective}${redesignDirective}${finalRedesignOverride}${styleDirective}${variationDirective}[USER DIRECTIVE] ${userIntent}\n[SAFETY] NO TEXT. NO WATERMARKS. NO FLOATING OBJECTS.`.trim();
}
