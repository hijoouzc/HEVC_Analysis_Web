/**
 * colorUtils.js
 * Unified colorimetry & palette utilities for HEVC Video Compression Analyzer:
 * - High-contrast Luma (Y) grayscale with dynamic text shadow
 * - ITU-R BT.601 / BT.709 physically accurate Chroma (Cb / Cr) colorimetry
 * - Synchronized signed residual error heatmap (Org - Pred = Resi)
 * - Standardized HEVC Intra Prediction Mode descriptions (0-34)
 */

/**
 * Clamps a numerical value within [min, max].
 */
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * Universal highlight color for selected pixels and active references across all channels (Y, U, V).
 * Electric Amber (#F59E0B) provides peak optical complementary contrast against Blue (U / Cb),
 * strong warm-cold contrast against Red (V / Cr), and high chromatic pop against Grayscale (Y / Luma).
 */
export const SELECTION_HIGHLIGHT_COLOR = '#F59E0B';

/**
 * Standardized HEVC QuadTree CU Depth Color Palette (Apple HIG Pro Spectrum).
 * Cold -> Hot Spectrum (Official Measured Tokens):
 * - Depth 0 (64×64 CTU): System Cyan (#00C0E8)
 * - Depth 1 (32×32 CU): System Green (#34C759)
 * - Depth 2 (16×16 CU): System Orange (#FF8D28)
 * - Depth 3 (8×8 CU): System Red (#FF383C)
 */
export const HEVC_DEPTH_COLORS = {
  0: {
    depth: 0,
    size: 64,
    label: 'Depth 0 (64×64)',
    hex: '#00C0E8',
    border: '#00C0E8',
    text: '#008FA8',
    bg: 'rgba(0, 192, 232, 0.18)',
    bgSolid: '#E0F8FF',
    bgAlpha: (alpha = 0.18) => `rgba(0, 192, 232, ${alpha})`
  },
  1: {
    depth: 1,
    size: 32,
    label: 'Depth 1 (32×32)',
    hex: '#34C759',
    border: '#34C759',
    text: '#248A3D',
    bg: 'rgba(52, 199, 89, 0.18)',
    bgSolid: '#E8F8EE',
    bgAlpha: (alpha = 0.18) => `rgba(52, 199, 89, ${alpha})`
  },
  2: {
    depth: 2,
    size: 16,
    label: 'Depth 2 (16×16)',
    hex: '#FF8D28',
    border: '#FF8D28',
    text: '#C96700',
    bg: 'rgba(255, 141, 40, 0.18)',
    bgSolid: '#FFF3E8',
    bgAlpha: (alpha = 0.18) => `rgba(255, 141, 40, ${alpha})`
  },
  3: {
    depth: 3,
    size: 8,
    label: 'Depth 3 (8×8)',
    hex: '#FF383C',
    border: '#FF383C',
    text: '#D72318',
    bg: 'rgba(255, 56, 60, 0.18)',
    bgSolid: '#FEECEB',
    bgAlpha: (alpha = 0.18) => `rgba(255, 56, 60, ${alpha})`
  }
};

export const HEVC_DEPTH_COLORS_LIGHT = {
  0: { depth: 0, size: 64, hex: '#00C0E8', text: '#008FA8', bgSolid: '#E0F8FF', border: '#00C0E8' },
  1: { depth: 1, size: 32, hex: '#34C759', text: '#248A3D', bgSolid: '#E8F8EE', border: '#34C759' },
  2: { depth: 2, size: 16, hex: '#FF8D28', text: '#C96700', bgSolid: '#FFF3E8', border: '#FF8D28' },
  3: { depth: 3, size: 8,  hex: '#FF383C', text: '#D72318', bgSolid: '#FEECEB', border: '#FF383C' }
};

/**
 * Standardized HEVC Prediction Mode Color Palette (Official Measured Tokens).
 * - INTRA: System Purple (#CB30E0)
 * - INTER Uni-Pred: System Blue (#007AFF)
 * - INTER Bi-Pred: System Mint (#00C8B3)
 * - SKIP / Merge: System Gray (#8E8E93)
 */
export const HEVC_MODE_COLORS = {
  INTRA: {
    mode: 'INTRA',
    label: 'Intra (#CB30E0)',
    hex: '#CB30E0',
    border: '#CB30E0',
    text: '#9F1CB5',
    bg: 'rgba(203, 48, 224, 0.18)',
    bgSolid: '#F9EAFB',
    bgAlpha: (alpha = 0.18) => `rgba(203, 48, 224, ${alpha})`
  },
  INTER: {
    mode: 'INTER',
    label: 'Inter (#007AFF)',
    hex: '#007AFF',
    border: '#007AFF',
    text: '#0062CC',
    bg: 'rgba(0, 122, 255, 0.18)',
    bgSolid: '#E5F2FF',
    bgAlpha: (alpha = 0.18) => `rgba(0, 122, 255, ${alpha})`
  },
  INTER_BIPRED: {
    mode: 'INTER_BIPRED',
    label: 'Bi-Pred (#00C8B3)',
    hex: '#00C8B3',
    border: '#00C8B3',
    text: '#008A7C',
    bg: 'rgba(0, 200, 179, 0.18)',
    bgSolid: '#E6F9F7',
    bgAlpha: (alpha = 0.18) => `rgba(0, 200, 179, ${alpha})`
  },
  SKIP: {
    mode: 'SKIP',
    label: 'Skip (#8E8E93)',
    hex: '#8E8E93',
    border: '#8E8E93',
    text: '#636366',
    bg: 'rgba(142, 142, 147, 0.18)',
    bgSolid: '#F2F2F7',
    bgAlpha: (alpha = 0.18) => `rgba(142, 142, 147, ${alpha})`
  }
};

/**
 * Returns accurate CSS background color, text color, and border for a Luma (Y) sample (0-255).
 * 
 * @param {number} val - 8-bit luma sample value (0-255)
 * @returns {{ bg: string, color: string, border: string, textShadow: string, val: number }}
 */
export const getLumaColorAndTextColor = (val) => {
  const v = clamp(Math.round(val ?? 128), 0, 255);
  const isDark = v < 128;
  return {
    bg: `rgb(${v}, ${v}, ${v})`,
    color: isDark ? '#FFFFFF' : '#000000',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.18)',
    textShadow: 'none',
    val: v
  };
};

/**
 * Exact ITU-R BT.709 Full-Range YCbCr (YUV) to sRGB conversion.
 * Primary standard for HD / Full HD HEVC content.
 * 
 * @param {number} y  - 8-bit Luma sample [0, 255]
 * @param {number} cb - 8-bit Chroma Blue sample [0, 255]
 * @param {number} cr - 8-bit Chroma Red sample [0, 255]
 * @returns {{ r: number, g: number, b: number, hex: string }}
 */
export const bt709YuvToRgb = (y, cb, cr) => {
  const dCb = (cb ?? 128) - 128;
  const dCr = (cr ?? 128) - 128;
  const luma = y ?? 128;
  const r = clamp(Math.round(luma + 1.57480 * dCr), 0, 255);
  const g = clamp(Math.round(luma - 0.18732 * dCb - 0.46812 * dCr), 0, 255);
  const b = clamp(Math.round(luma + 1.85560 * dCb), 0, 255);
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  return { r, g, b, hex };
};

/**
 * Exact ITU-R BT.709 sRGB to YCbCr conversion.
 * 
 * @param {number} r - 8-bit Red [0, 255]
 * @param {number} g - 8-bit Green [0, 255]
 * @param {number} b - 8-bit Blue [0, 255]
 * @returns {{ y: number, cb: number, cr: number }}
 */
export const bt709RgbToYuv = (r, g, b) => {
  const y = clamp(Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b), 0, 255);
  const cb = clamp(Math.round(-0.11457 * r - 0.38543 * g + 0.5 * b + 128), 0, 255);
  const cr = clamp(Math.round(0.5 * r - 0.45415 * g - 0.04585 * b + 128), 0, 255);
  return { y, cb, cr };
};

/**
 * Exact ITU-R BT.601 Full-Range YCbCr (YUV) to sRGB conversion.
 * 
 * @param {number} y  - 8-bit Luma sample [0, 255]
 * @param {number} cb - 8-bit Chroma Blue sample [0, 255]
 * @param {number} cr - 8-bit Chroma Red sample [0, 255]
 * @returns {{ r: number, g: number, b: number, hex: string }}
 */
export const bt601YuvToRgb = (y, cb, cr) => {
  const dCb = (cb ?? 128) - 128;
  const dCr = (cr ?? 128) - 128;
  const luma = y ?? 128;
  const r = clamp(Math.round(luma + 1.40200 * dCr), 0, 255);
  const g = clamp(Math.round(luma - 0.34414 * dCb - 0.71414 * dCr), 0, 255);
  const b = clamp(Math.round(luma + 1.77200 * dCb), 0, 255);
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  return { r, g, b, hex };
};

/**
 * Returns mathematically exact ITU-R BT.709 Chroma (Cb/Cr) color and legible text color:
 * - Cb (U): Blue (high Cb > 128) <-> Neutral Gray (Cb = 128) <-> Warm Yellow (low Cb < 128)
 * - Cr (V): Crimson Red (high Cr > 128) <-> Neutral Gray (Cr = 128) <-> Vibrant Green (low Cr < 128)
 * Fixed neutral Luma Y = 128 ensures zero luminance distortion.
 * 
 * @param {number} val - 8-bit chroma sample value (0-255)
 * @param {boolean} isU - true for Cb (U), false for Cr (V)
 * @returns {{ bg: string, color: string, border: string, textShadow: string, val: number }}
 */
export const getChromaColorAndTextColor = (val, isU) => {
  const v = clamp(Math.round(val ?? 128), 0, 255);
  const { r, g, b, hex } = isU
    ? bt709YuvToRgb(128, v, 128)  // U (Cb): Blue <-> Yellow
    : bt709YuvToRgb(128, 128, v); // V (Cr): Red <-> Green

  // Calculate perceived relative luminance for optimal text readability
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const color = lum < 135 ? '#FFFFFF' : '#000000';
  const isDark = lum < 128;

  return {
    bg: hex,
    color,
    border: isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.18)',
    textShadow: 'none',
    val: v
  };
};

/**
 * Universal dispatcher for pixel sample styling across any channel (Y, U/Cb, V/Cr).
 * 
 * @param {number} val - 8-bit sample value (0-255)
 * @param {'Y'|'U'|'V'|'Cb'|'Cr'} [channel='Y'] - Channel identifier
 * @returns {{ bg: string, color: string, border: string, textShadow: string, val: number }}
 */
export const getSampleColorAndTextColor = (val, channel = 'Y') => {
  if (channel === 'U' || channel === 'Cb') {
    return getChromaColorAndTextColor(val, true);
  }
  if (channel === 'V' || channel === 'Cr') {
    return getChromaColorAndTextColor(val, false);
  }
  return getLumaColorAndTextColor(val);
};

/**
 * Returns synchronized, consistent color and style for signed residual values (Org - Pred = Resi).
 * - val === 0: Exact match -> neutral slate (#F1F5F9)
 * - val > 0: Org > Pred (Under-prediction) -> Swiss Crimson (#E11D48) scaling with magnitude
 * - val < 0: Org < Pred (Over-prediction) -> Swiss Blue (#0284C7) scaling with magnitude
 * 
 * @param {number} val - Signed residual difference
 * @param {number} [maxScale=64] - Normalization denominator for color intensity
 * @returns {{ bg: string, color: string, textShadow: string, border: string, val: number }}
 */
export const getResidualColorAndTextColor = (val, maxScale = 64) => {
  const v = Math.round(val ?? 0);

  if (v === 0) {
    return {
      bg: '#F1F5F9',
      color: '#475569',
      textShadow: 'none',
      border: '1px solid #CBD5E1',
      val: 0
    };
  }

  const norm = clamp(Math.abs(v) / Math.max(1, maxScale), 0, 1);
  const alpha = 0.20 + 0.80 * norm;

  if (v > 0) {
    // Org > Pred (Under-predicted): Crimson palette
    return {
      bg: `rgba(225, 29, 72, ${alpha.toFixed(2)})`,
      color: norm > 0.42 ? '#FFFFFF' : '#881337',
      textShadow: 'none',
      border: `1px solid rgba(225, 29, 72, ${Math.min(1, alpha + 0.25).toFixed(2)})`,
      val: v
    };
  } else {
    // Org < Pred (Over-predicted): Blue palette
    return {
      bg: `rgba(2, 132, 199, ${alpha.toFixed(2)})`,
      color: norm > 0.42 ? '#FFFFFF' : '#0C4A6E',
      textShadow: 'none',
      border: `1px solid rgba(2, 132, 199, ${Math.min(1, alpha + 0.25).toFixed(2)})`,
      val: v
    };
  }
};

/**
 * Returns descriptive name, category, and explanation for an HEVC Intra Mode (0-34).
 * 
 * @param {number} mode - Intra prediction mode index (0-34)
 * @returns {{ name: string, type: string, desc: string }}
 */
export const getIntraModeInfo = (mode) => {
  if (mode === 0) return { name: 'Planar', type: 'Non-Angular (Planar)', desc: '4-corner bilinear planar interpolation' };
  if (mode === 1) return { name: 'DC', type: 'Non-Angular (DC)', desc: 'Mean average of boundary reference samples' };
  if (mode === 10) return { name: 'Horizontal', type: 'Angular (Horizontal)', desc: 'Pure horizontal directional prediction' };
  if (mode === 26) return { name: 'Vertical', type: 'Angular (Vertical)', desc: 'Pure vertical directional prediction' };
  if (mode === 2) return { name: 'Angular 2', type: 'Angular (Bottom-Left 45°)', desc: 'Diagonal prediction from bottom-left' };
  if (mode === 18) return { name: 'Angular 18', type: 'Angular (Diagonal 45°)', desc: 'Diagonal prediction from top-left' };
  if (mode === 34) return { name: 'Angular 34', type: 'Angular (Top-Right 45°)', desc: 'Diagonal prediction from top-right' };
  if (mode > 2 && mode < 10) return { name: `Angular ${mode}`, type: 'Angular (Bottom-Left → Hor)', desc: `Angular prediction (Mode ${mode})` };
  if (mode > 10 && mode < 18) return { name: `Angular ${mode}`, type: 'Angular (Hor → Diagonal)', desc: `Angular prediction (Mode ${mode})` };
  if (mode > 18 && mode < 26) return { name: `Angular ${mode}`, type: 'Angular (Diagonal → Ver)', desc: `Angular prediction (Mode ${mode})` };
  if (mode > 26 && mode < 34) return { name: `Angular ${mode}`, type: 'Angular (Ver → Top-Right)', desc: `Angular prediction (Mode ${mode})` };
  return { name: `Mode ${mode}`, type: 'Intra', desc: `Intra Mode ${mode}` };
};

/**
 * Computes source buffer origin and sampling stride for extracting an N×N channel block
 * given canonical luma picture coordinates `(absX, absY)`.
 */
function resolveChannelSamplingLayout({ absX = 0, absY = 0, channel = 'Y', bufW = 0, frameWidth = 0, isPlanarGray = false }) {
  const isU = channel === 'U' || channel === 'Cb';
  const isV = channel === 'V' || channel === 'Cr';
  const isChroma = isU || isV;
  const isHalfResPlane = Boolean(isChroma && isPlanarGray && frameWidth > 0 && bufW > 0 && bufW <= Math.ceil(frameWidth / 2));

  return {
    isU,
    isV,
    baseX: isHalfResPlane ? Math.floor(absX / 2) : absX,
    baseY: isHalfResPlane ? Math.floor(absY / 2) : absY,
    step: isChroma && !isHalfResPlane ? 2 : 1,
  };
}

function readChannelSampleFromRgba(rgba, byteOffset, { isU, isV, isPlanarGray }) {
  const r = rgba[byteOffset] ?? 128;
  if (isPlanarGray) {
    return clamp(Math.round(r), 0, 255);
  }
  const g = rgba[byteOffset + 1] ?? 128;
  const b = rgba[byteOffset + 2] ?? 128;
  const { y, cb, cr } = bt709RgbToYuv(r, g, b);
  return isU ? cb : isV ? cr : y;
}

/**
 * Extracts an `size × size` sample array for `'Y' | 'Cb' | 'Cr'` from an RGBA pixel buffer.
 * Handles both full-res BT.709 RGB buffers (4:2:0 2×2 co-sited chroma stride) and native
 * grayscale planar chroma buffers (`/images/u`, `/images/v`).
 */
export function extractChannelBlockFromRgba(
  rgba,
  bufW,
  bufH,
  { absX = 0, absY = 0, size = 8, channel = 'Y', frameWidth = 0, isPlanarGray = false, layoutOverride = null }
) {
  if (!rgba || bufW <= 0 || bufH <= 0 || size <= 0) return null;
  const layout = layoutOverride || resolveChannelSamplingLayout({ absX, absY, channel, bufW, frameWidth, isPlanarGray });
  const { baseX, baseY, step } = layout;
  const out = new Array(size * size);

  for (let y = 0; y < size; y++) {
    const py = clamp(baseY + y * step, 0, bufH - 1);
    for (let x = 0; x < size; x++) {
      const px = clamp(baseX + x * step, 0, bufW - 1);
      const offset = (py * bufW + px) * 4;
      out[y * size + x] = readChannelSampleFromRgba(rgba, offset, { ...layout, isPlanarGray });
    }
  }
  return out;
}

/**
 * Extracts `2*size + 1` top and left reference perimeter samples from an RGBA pixel buffer
 * using the exact coordinate layout and BT.709 channel conversion as block extraction.
 */
export function extractChannelPerimeterFromRgba(
  rgba,
  bufW,
  bufH,
  { absX = 0, absY = 0, size = 8, channel = 'Y', frameWidth = 0, isPlanarGray = false, layoutOverride = null }
) {
  if (!rgba || bufW <= 0 || bufH <= 0 || size <= 0) return null;
  const layout = layoutOverride || resolveChannelSamplingLayout({ absX, absY, channel, bufW, frameWidth, isPlanarGray });
  const { baseX, baseY, step } = layout;
  const refSpan = 2 * size + 1;

  const sampleAt = (px, py) => {
    const cx = clamp(px, 0, bufW - 1);
    const cy = clamp(py, 0, bufH - 1);
    return readChannelSampleFromRgba(rgba, (cy * bufW + cx) * 4, { ...layout, isPlanarGray });
  };

  const corner = sampleAt(baseX - step, baseY - step);
  const refTop = new Array(refSpan);
  const refLeft = new Array(refSpan);
  refTop[0] = corner;
  refLeft[0] = corner;

  for (let i = 0; i < 2 * size; i++) {
    refTop[i + 1] = sampleAt(baseX + i * step, baseY - step);
    refLeft[i + 1] = sampleAt(baseX - step, baseY + i * step);
  }
  return { refTop, refLeft };
}

/**
 * Canvas wrappers that read minimal bounding patches via `getImageData` for Y/Cb/Cr extraction.
 */
export function extractChannelBlockFromCanvas(canvas, opts) {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { absX = 0, absY = 0, size = 8, channel = 'Y', frameWidth = 0, isPlanarGray = false } = opts || {};
  const layout = resolveChannelSamplingLayout({ absX, absY, channel, bufW: canvas.width, frameWidth, isPlanarGray });
  const startX = clamp(layout.baseX, 0, canvas.width - 1);
  const startY = clamp(layout.baseY, 0, canvas.height - 1);
  const span = Math.max(1, size * layout.step);
  const reqW = clamp(span, 1, canvas.width - startX);
  const reqH = clamp(span, 1, canvas.height - startY);
  const patch = ctx.getImageData(startX, startY, reqW, reqH);
  return extractChannelBlockFromRgba(patch.data, reqW, reqH, {
    size,
    channel,
    isPlanarGray,
    layoutOverride: { ...layout, baseX: layout.baseX - startX, baseY: layout.baseY - startY },
  });
}

export function extractChannelPerimeterFromCanvas(canvas, opts) {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { absX = 0, absY = 0, size = 8, channel = 'Y', frameWidth = 0, isPlanarGray = false } = opts || {};
  const layout = resolveChannelSamplingLayout({ absX, absY, channel, bufW: canvas.width, frameWidth, isPlanarGray });
  const startX = clamp(layout.baseX - layout.step, 0, canvas.width - 1);
  const startY = clamp(layout.baseY - layout.step, 0, canvas.height - 1);
  const span = Math.max(1, (2 * size + 2) * layout.step);
  const reqW = clamp(span, 1, canvas.width - startX);
  const reqH = clamp(span, 1, canvas.height - startY);
  const patch = ctx.getImageData(startX, startY, reqW, reqH);
  return extractChannelPerimeterFromRgba(patch.data, reqW, reqH, {
    size,
    channel,
    isPlanarGray,
    layoutOverride: { ...layout, baseX: layout.baseX - startX, baseY: layout.baseY - startY },
  });
}

