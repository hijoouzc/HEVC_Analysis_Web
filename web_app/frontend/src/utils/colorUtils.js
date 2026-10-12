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
 * Returns distinct, intuitive CSS background color, text color, and border for Chroma (Cb/Cr) samples:
 * - Cb (U): Dedicated Blue/Cyan channel (lower = deep navy blue, 128 = mid ocean blue, higher = bright sky cyan).
 * - Cr (V): Dedicated Crimson/Rose channel (lower = soft pale rose, 128 = vibrant rose/crimson, higher = deep crimson red).
 * Ensures Chroma channels are clearly distinguishable and never collapse into flat gray.
 * 
 * @param {number} val - 8-bit chroma sample value (0-255)
 * @param {boolean} isU - true for Cb (U), false for Cr (V)
 * @returns {{ bg: string, color: string, border: string, textShadow: string, val: number }}
 */
export const getChromaColorAndTextColor = (val, isU) => {
  const v = clamp(Math.round(val ?? 128), 0, 255);
  const diff = v - 128;

  if (isU) {
    // U (Cb): Distinctive Blue / Cyan Palette
    const lightness = clamp(Math.round(54 + diff * 1.8), 22, 88);
    const hue = clamp(Math.round(212 - diff * 0.7), 195, 226);
    const saturation = clamp(Math.round(74 + Math.abs(diff) * 0.4), 55, 92);
    const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const color = lightness < 58 ? '#FFFFFF' : '#000000';
    return {
      bg,
      color,
      border: '1px solid rgba(0, 0, 0, 0.18)',
      textShadow: 'none',
      val: v
    };
  } else {
    // V (Cr): Distinctive Crimson / Rose / Red Palette
    const lightness = clamp(Math.round(64 - diff * 1.8), 24, 88);
    const hue = clamp(Math.round(350 - diff * 0.5), 342, 358);
    const saturation = clamp(Math.round(72 + Math.abs(diff) * 0.5), 55, 92);
    const bg = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const color = lightness < 58 ? '#FFFFFF' : '#000000';
    return {
      bg,
      color,
      border: '1px solid rgba(0, 0, 0, 0.18)',
      textShadow: 'none',
      val: v
    };
  }
};

/**
 * Universal dispatcher for pixel sample styling across any channel (Y, U, V).
 * 
 * @param {number} val - 8-bit sample value (0-255)
 * @param {'Y'|'U'|'V'} [channel='Y'] - Channel identifier
 * @returns {{ bg: string, color: string, border: string, textShadow: string, val: number }}
 */
export const getSampleColorAndTextColor = (val, channel = 'Y') => {
  if (channel === 'U') {
    return getChromaColorAndTextColor(val, true);
  }
  if (channel === 'V') {
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
