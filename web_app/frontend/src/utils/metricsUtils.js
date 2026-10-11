/**
 * metricsUtils.js
 * Centralized mathematical metrics and filters for HEVC / H.265 analysis:
 * - Sum of Squared Errors (SSE)
 * - Mean Squared Error (MSE)
 * - Peak Signal-to-Noise Ratio (PSNR)
 * - Sum of Absolute Differences (SAD)
 * - Mode-Dependent Intra Smoothing (MDIS) 3-tap lowpass filter [1, 2, 1]/4
 * - Lagrangian Rate-Distortion lambda multiplier
 * - Quantization Step (Qstep)
 */

/**
 * Calculates Sum of Squared Errors (SSE) between original and reconstructed arrays.
 * @param {Array<number>} orig
 * @param {Array<number>} recon
 * @returns {number} SSE value
 */
export function calculateSse(orig = [], recon = []) {
  const len = Math.min(orig.length, recon.length);
  if (len === 0) return 0;
  let sse = 0;
  for (let i = 0; i < len; i++) {
    const diff = orig[i] - recon[i];
    sse += diff * diff;
  }
  return sse;
}

/**
 * Calculates Mean Squared Error (MSE).
 * @param {Array<number>} orig
 * @param {Array<number>} recon
 * @returns {number} MSE value
 */
export function calculateMse(orig = [], recon = []) {
  const len = Math.min(orig.length, recon.length);
  if (len === 0) return 0;
  return calculateSse(orig, recon) / len;
}

/**
 * Calculates Peak Signal-to-Noise Ratio (PSNR) in dB.
 * @param {number} mse
 * @param {number} maxVal - Default 255 for 8-bit video
 * @returns {string|number} PSNR in dB rounded to 2 decimal places, or '∞' if lossless
 */
export function calculatePsnr(mse, maxVal = 255) {
  if (mse <= 0 || !Number.isFinite(mse)) {
    return '∞';
  }
  const psnr = 10 * Math.log10((maxVal * maxVal) / mse);
  return Number.isFinite(psnr) ? psnr.toFixed(2) : '∞';
}

/**
 * Calculates Sum of Absolute Differences (SAD).
 * @param {Array<number>} orig
 * @param {Array<number>} pred
 * @returns {number} SAD value
 */
export function calculateSad(orig = [], pred = []) {
  const len = Math.min(orig.length, pred.length);
  if (len === 0) return 0;
  let sad = 0;
  for (let i = 0; i < len; i++) {
    sad += Math.abs(orig[i] - pred[i]);
  }
  return sad;
}

/**
 * Applies ITU-T H.265 Section 8.4.4.2.3 Mode-Dependent Intra Smoothing (MDIS).
 * 3-tap lowpass filter [1, 2, 1] / 4 on boundary reference samples (2N+1).
 *
 * @param {Array<number>} refTop - Top reference samples of length 2N+1
 * @param {Array<number>} refLeft - Left reference samples of length 2N+1
 * @param {number} N - Block dimension (4, 8, 16, 32)
 * @returns {{ top: Array<number>, left: Array<number> }} Smoothed reference arrays
 */
export function computeMdisSmoothedRef(refTop, refLeft, N = 8) {
  const reqLen = 2 * N + 1;
  if (!refTop || !refLeft || refTop.length < reqLen || refLeft.length < reqLen) {
    return { top: Array(reqLen).fill(128), left: Array(reqLen).fill(128) };
  }
  const smoothedTop = [...refTop];
  const smoothedLeft = [...refLeft];

  // Corner [-1, -1]
  const corner = (refLeft[1] + 2 * refTop[0] + refTop[1] + 2) >> 2;
  smoothedTop[0] = corner;
  smoothedLeft[0] = corner;

  // Top row smoothing: 1 to 2N-1
  for (let x = 1; x < 2 * N; x++) {
    const prev = refTop[x - 1];
    const curr = refTop[x];
    const next = x + 1 < refTop.length ? refTop[x + 1] : refTop[x];
    smoothedTop[x] = (prev + 2 * curr + next + 2) >> 2;
  }

  // Left column smoothing: 1 to 2N-1
  for (let y = 1; y < 2 * N; y++) {
    const prev = refLeft[y - 1];
    const curr = refLeft[y];
    const next = y + 1 < refLeft.length ? refLeft[y + 1] : refLeft[y];
    smoothedLeft[y] = (prev + 2 * curr + next + 2) >> 2;
  }

  return { top: smoothedTop, left: smoothedLeft };
}

/**
 * Calculates HM Lagrangian Rate-Distortion multiplier λ based on QP:
 * λ = 0.57 * 2^((QP - 12) / 3)
 * @param {number} qp
 * @returns {number} lambda
 */
export function calculateLagrangianLambda(qp = 32) {
  return 0.57 * Math.pow(2.0, (qp - 12.0) / 3.0);
}

/**
 * Calculates HEVC Quantization Step Size (Qstep) based on QP:
 * Qstep ≈ 0.625 * 2^(QP / 6)
 * @param {number} qp
 * @returns {number} qstep
 */
export function calculateQuantStep(qp = 32) {
  return 0.625 * Math.pow(2.0, qp / 6.0);
}
