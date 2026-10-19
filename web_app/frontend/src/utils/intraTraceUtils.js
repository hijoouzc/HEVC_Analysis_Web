// Mathematical tracing of HEVC Intra Prediction reference samples
// Based on ITU-T H.265 / ISO/IEC 23008-2 specification
// Modularized and re-exported from pure HEVC algorithm module `intraPredictionMath.js`

export {
  INTRA_PRED_ANGLES,
  INV_ANGLES,
  getPixelTrace,
  generateIntraPredictionBlock,
  getWavefrontDelay
} from './intraPredictionMath.js';
