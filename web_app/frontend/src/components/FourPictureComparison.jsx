import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getIntraModeInfo, getResidualColorAndTextColor } from '../utils/colorUtils';
import { calculatePsnr } from '../utils/metricsUtils';
import { generateIntraPredictionBlock } from '../utils/intraTraceUtils';
import { Button, SegmentedControl, Badge } from './apple';

/**
 * PixelMatrixCanvas
 * Fast, GPU-accelerated HTML5 canvas for large HEVC matrices (N >= 32, e.g. 32x32 & 64x64).
 * Replaces up to 4,096 DOM nodes per matrix with 1 canvas (100% discrete pixels, zero browser blur).
 */
const PixelMatrixCanvas = ({
  dataArray = [],
  size = 64,
  type = 'orig',
  resiGain = 4,
  selectedCell = null,
  onSelectCell,
  cuData,
}) => {
  const canvasRef = useRef(null);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark') ||
           document.documentElement.getAttribute('data-theme') === 'dark';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark') ||
                   document.documentElement.getAttribute('data-theme') === 'dark';
      setIsDarkTheme(dark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataArray || dataArray.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const totalPixels = size * size;
    const dataLen = dataArray.length;

    // Theme-aware base slate: #2C2C2E (44, 44, 46) for dark, #F1F5F9 (241, 245, 249) for light
    const baseR = isDarkTheme ? 44 : 241;
    const baseG = isDarkTheme ? 44 : 245;
    const baseB = isDarkTheme ? 46 : 249;

    for (let i = 0; i < totalPixels; i++) {
      const val = i < dataLen ? (dataArray[i] ?? 0) : 0;
      const off = i * 4;

      if (type === 'resi') {
        const v = Math.round(val) * resiGain;
        if (v === 0) {
          data[off] = baseR;
          data[off + 1] = baseG;
          data[off + 2] = baseB;
          data[off + 3] = 255;
        } else {
          const norm = Math.min(1, Math.max(0, Math.abs(v) / 128));
          const alpha = 0.20 + 0.80 * norm;
          if (v > 0) {
            // Under-predicted: Crimson (225, 29, 72) over theme neutral
            data[off] = Math.round(225 * alpha + baseR * (1 - alpha));
            data[off + 1] = Math.round(29 * alpha + baseG * (1 - alpha));
            data[off + 2] = Math.round(72 * alpha + baseB * (1 - alpha));
            data[off + 3] = 255;
          } else {
            // Over-predicted: Blue (2, 132, 199) over theme neutral
            data[off] = Math.round(2 * alpha + baseR * (1 - alpha));
            data[off + 1] = Math.round(132 * alpha + baseG * (1 - alpha));
            data[off + 2] = Math.round(199 * alpha + baseB * (1 - alpha));
            data[off + 3] = 255;
          }
        }
      } else {
        const clamped = Math.max(0, Math.min(255, Math.round(val)));
        data[off] = clamped;
        data[off + 1] = clamped;
        data[off + 2] = clamped;
        data[off + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [dataArray, size, type, resiGain, isDarkTheme]);

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !onSelectCell || !cuData) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.min(size - 1, Math.max(0, Math.floor((clickX / rect.width) * size)));
    const y = Math.min(size - 1, Math.max(0, Math.floor((clickY / rect.height) * size)));
    const idx = y * size + x;
    onSelectCell({
      x,
      y,
      orig: cuData.orig[idx] ?? 0,
      pred: cuData.pred[idx] ?? 0,
      resi: cuData.resi[idx] ?? 0,
      recon: cuData.recon[idx] ?? 0,
    });
  };

  const isSelected =
    selectedCell &&
    selectedCell.x >= 0 &&
    selectedCell.x < size &&
    selectedCell.y >= 0 &&
    selectedCell.y < size;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          cursor: 'crosshair',
          display: 'block',
        }}
      />
      {/* 8x8 Sub-Block Boundary Grid Overlay for 32x32 & 64x64 */}
      {size >= 32 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 4,
          }}
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio="none"
        >
          {Array.from({ length: size / 8 - 1 }).map((_, i) => (
            <React.Fragment key={i}>
              <line
                x1={(i + 1) * 8}
                y1={0}
                x2={(i + 1) * 8}
                y2={size}
                stroke="rgba(128, 128, 128, 0.35)"
                strokeWidth={size >= 64 ? 0.35 : 0.45}
                strokeDasharray="1,1"
              />
              <line
                x1={0}
                y1={(i + 1) * 8}
                x2={size}
                y2={(i + 1) * 8}
                stroke="rgba(128, 128, 128, 0.35)"
                strokeWidth={size >= 64 ? 0.35 : 0.45}
                strokeDasharray="1,1"
              />
            </React.Fragment>
          ))}
        </svg>
      )}
      {/* Active Sample Selection Reticle */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            left: `${(selectedCell.x / size) * 100}%`,
            top: `${(selectedCell.y / size) * 100}%`,
            width: `${(1 / size) * 100}%`,
            height: `${(1 / size) * 100}%`,
            minWidth: '4px',
            minHeight: '4px',
            outline: '2px solid #007AFF',
            boxShadow: '0 0 4px rgba(0, 122, 255, 0.9)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};

/**
 * FourPictureComparison Component
 * Clean, Apple-inspired comparison of the 4 fundamental HEVC images:
 *  1. Original Picture (S)
 *  2. Prediction Picture (P)
 *  3. Residual Picture (R = S - P)
 *  4. Reconstructed Picture (S' = P + R')
 */
const FourPictureComparison = ({
  imageSrc,
  imageDims,
  ctuX,
  ctuY,
  currentMode,
  selectedCu,
  reconPictureData = [],
  jobId,
  API_BASE_URL = '',
  onSelectCTU,
  onNavigateToIntra,
}) => {
  const [scope, setScope] = useState('frame'); // 'frame' (Default: Full Frame) | 'cu'
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' (Default: Interactive Slider) | 'grid' | 'single'
  const [singleFocus, setSingleFocus] = useState('orig');
  const [splitLeft, setSplitLeft] = useState('orig');
  const [splitRight, setSplitRight] = useState('recon');
  const [splitPos, setSplitPos] = useState(50);
  const [resiGain, setResiGain] = useState(4);
  const [showValues, setShowValues] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);

  const imgWidth = imageDims?.width || 640;
  const imgHeight = imageDims?.height || 360;

  const splitContainerRef = useRef(null);
  const isDraggingSplit = useRef(false);

  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    isDraggingSplit.current = true;
  };

  const handleSplitTouchStart = () => {
    isDraggingSplit.current = true;
  };

  useEffect(() => {
    const handleMove = (clientX) => {
      if (!isDraggingSplit.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setSplitPos(pos);
    };

    const handleMouseMove = (e) => handleMove(e.clientX);
    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX);
    };

    const handleEnd = () => {
      isDraggingSplit.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const reconImgUrl = useMemo(() => {
    if (jobId) {
      return `${API_BASE_URL}/api/v1/jobs/${jobId}/images/reconstructed`;
    }
    return imageSrc;
  }, [jobId, imageSrc, API_BASE_URL]);

  const residualImgUrl = useMemo(() => {
    if (jobId) {
      return `${API_BASE_URL}/api/v1/jobs/${jobId}/images/residual?gain=${resiGain}`;
    }
    return null;
  }, [jobId, resiGain, API_BASE_URL]);

  // Maintain offscreen canvas for source frame (for extracting orig luma and perimeter)
  const [origFrameCanvas, setOrigFrameCanvas] = useState(null);
  useEffect(() => {
    if (!imageSrc) return;
    let isCurrent = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!isCurrent) return;
      const cvs = document.createElement('canvas');
      const w = imageDims?.width || img.naturalWidth || 640;
      const h = imageDims?.height || img.naturalHeight || 360;
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, w, h);
        setOrigFrameCanvas(cvs);
      }
    };
    img.src = imageSrc;
    return () => {
      isCurrent = false;
    };
  }, [imageSrc, imageDims?.width, imageDims?.height]);

  // Maintain offscreen canvas for reconstructed frame (for extracting recon luma and reconstructed perimeter)
  const [reconFrameCanvas, setReconFrameCanvas] = useState(null);
  useEffect(() => {
    if (!reconImgUrl) return;
    let isCurrent = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!isCurrent) return;
      const cvs = document.createElement('canvas');
      const w = imageDims?.width || img.naturalWidth || 640;
      const h = imageDims?.height || img.naturalHeight || 360;
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, w, h);
        setReconFrameCanvas(cvs);
      }
    };
    img.src = reconImgUrl;
    return () => {
      isCurrent = false;
    };
  }, [reconImgUrl, imageDims?.width, imageDims?.height]);

  // Extract CU Data Matrices
  const cuData = useMemo(() => {
    const cuSize = selectedCu?.width || selectedCu?.w || currentMode?.cu_size || 8;
    const numPixels = cuSize * cuSize;
    const refSpan = 2 * cuSize + 1;

    const ctuOriginX = (ctuX ?? 0) * 64;
    const ctuOriginY = (ctuY ?? 0) * 64;
    const rawX = Number(selectedCu?.abs_x ?? selectedCu?.x ?? ctuOriginX);
    const rawY = Number(selectedCu?.abs_y ?? selectedCu?.y ?? ctuOriginY);
    const absX = Number.isFinite(rawX) ? (rawX >= ctuOriginX ? rawX : ctuOriginX + rawX) : ctuOriginX;
    const absY = Number.isFinite(rawY) ? (rawY >= ctuOriginY ? rawY : ctuOriginY + rawY) : ctuOriginY;

    // Check if CP_05 RECON_PICTURE telemetry has matching reconstructed block
    let recoFromTelemetry = null;
    if (Array.isArray(reconPictureData) && reconPictureData.length > 0) {
      const cuX = selectedCu?.x ?? 0;
      const cuY = selectedCu?.y ?? 0;
      const match = reconPictureData.find(e =>
        (e.cu_x === cuX || e.cu_x === (ctuOriginX + cuX)) &&
        (e.cu_y === cuY || e.cu_y === (ctuOriginY + cuY)) &&
        (e.cu_w === cuSize || e.cu_size === cuSize)
      ) || reconPictureData.find(e => e.cu_w === cuSize || e.cu_size === cuSize);
      if (match?.reco_y && match.reco_y.length >= numPixels) {
        recoFromTelemetry = match.reco_y.slice(0, numPixels);
      }
    }

    // 1. Extract or derive Original Source Samples (S)
    let orig = null;
    if (Array.isArray(currentMode?.orig_data) && currentMode.orig_data.length >= numPixels) {
      orig = currentMode.orig_data.slice(0, numPixels);
    } else if (origFrameCanvas) {
      try {
        const ctx = origFrameCanvas.getContext('2d');
        if (ctx && origFrameCanvas.width > 0 && origFrameCanvas.height > 0) {
          const frameW = origFrameCanvas.width;
          const frameH = origFrameCanvas.height;
          const safeX = Math.max(0, Math.min(Math.max(0, frameW - cuSize), absX));
          const safeY = Math.max(0, Math.min(Math.max(0, frameH - cuSize), absY));
          const safeW = Math.max(1, Math.min(cuSize, frameW - safeX));
          const safeH = Math.max(1, Math.min(cuSize, frameH - safeY));

          const imgData = ctx.getImageData(safeX, safeY, safeW, safeH);
          orig = new Array(numPixels);
          for (let y = 0; y < cuSize; y++) {
            for (let x = 0; x < cuSize; x++) {
              const srcX = Math.min(safeW - 1, x);
              const srcY = Math.min(safeH - 1, y);
              const offset = (srcY * safeW + srcX) * 4;
              const r = imgData.data[offset] ?? 128;
              const g = imgData.data[offset + 1] ?? 128;
              const b = imgData.data[offset + 2] ?? 128;
              orig[y * cuSize + x] = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
            }
          }
        }
      } catch (err) {
        console.warn('Could not extract orig from origFrameCanvas in FourPictureComparison:', err);
      }
    } else if (Array.isArray(currentMode?.orig_data) && currentMode.orig_data.length > 0) {
      const srcDim = Math.round(Math.sqrt(currentMode.orig_data.length)) || 8;
      orig = new Array(numPixels);
      for (let y = 0; y < cuSize; y++) {
        for (let x = 0; x < cuSize; x++) {
          const sx = Math.min(srcDim - 1, Math.floor((x / cuSize) * srcDim));
          const sy = Math.min(srcDim - 1, Math.floor((y / cuSize) * srcDim));
          orig[y * cuSize + x] = currentMode.orig_data[sy * srcDim + sx] ?? 128;
        }
      }
    }

    // 2. Extract or synthesize Perimeter Reference Samples (refTop, refLeft)
    let refTop = currentMode?.ref_top;
    let refLeft = currentMode?.ref_left;
    if ((!Array.isArray(refTop) || refTop.length < refSpan || !Array.isArray(refLeft) || refLeft.length < refSpan) && (reconFrameCanvas || origFrameCanvas)) {
      const refCanvas = reconFrameCanvas || origFrameCanvas;
      try {
        const ctx = refCanvas.getContext('2d');
        if (ctx && refCanvas.width > 0 && refCanvas.height > 0) {
          const frameW = refCanvas.width;
          const frameH = refCanvas.height;
          const startX = Math.max(0, Math.min(frameW - 1, absX - 1));
          const startY = Math.max(0, Math.min(frameH - 1, absY - 1));
          const reqW = Math.max(1, Math.min(frameW - startX, 2 * cuSize + 2));
          const reqH = Math.max(1, Math.min(frameH - startY, 2 * cuSize + 2));
          const patch = ctx.getImageData(startX, startY, reqW, reqH);

          const getLumaAt = (px, py) => {
            const clampedX = Math.max(0, Math.min(reqW - 1, px - startX));
            const clampedY = Math.max(0, Math.min(reqH - 1, py - startY));
            const offset = (clampedY * reqW + clampedX) * 4;
            const r = patch.data[offset] ?? 128;
            const g = patch.data[offset + 1] ?? 128;
            const b = patch.data[offset + 2] ?? 128;
            return Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
          };

          const corner = getLumaAt(absX - 1, absY - 1);
          const topSamples = new Array(refSpan);
          const leftSamples = new Array(refSpan);
          topSamples[0] = corner;
          leftSamples[0] = corner;

          for (let i = 0; i < 2 * cuSize; i++) {
            topSamples[i + 1] = getLumaAt(absX + i, absY - 1);
            leftSamples[i + 1] = getLumaAt(absX - 1, absY + i);
          }
          refTop = topSamples;
          refLeft = leftSamples;
        }
      } catch (err) {
        console.warn('Could not extract perimeter from canvas in FourPictureComparison:', err);
      }
    }

    if (!Array.isArray(refTop) || refTop.length < refSpan) {
      const srcTop = Array.isArray(refTop) && refTop.length > 0 ? refTop : [128];
      const fallbackTop = new Array(refSpan);
      for (let i = 0; i < refSpan; i++) {
        const idx = Math.min(srcTop.length - 1, Math.floor((i / refSpan) * srcTop.length));
        fallbackTop[i] = srcTop[idx] ?? 128;
      }
      refTop = fallbackTop;
    }
    if (!Array.isArray(refLeft) || refLeft.length < refSpan) {
      const srcLeft = Array.isArray(refLeft) && refLeft.length > 0 ? refLeft : [128];
      const fallbackLeft = new Array(refSpan);
      for (let i = 0; i < refSpan; i++) {
        const idx = Math.min(srcLeft.length - 1, Math.floor((i / refSpan) * srcLeft.length));
        fallbackLeft[i] = srcLeft[idx] ?? 128;
      }
      refLeft = fallbackLeft;
    }

    // 3. Extract or synthesize Spatial Predictor Matrix (P)
    let pred = null;
    if (Array.isArray(currentMode?.pred_data) && currentMode.pred_data.length >= numPixels) {
      pred = currentMode.pred_data.slice(0, numPixels);
    } else {
      const mode = currentMode?.mode ?? 0;
      const predBlock = generateIntraPredictionBlock(mode, cuSize, refTop, refLeft);
      if (Array.isArray(predBlock) && predBlock.length >= numPixels) {
        pred = predBlock.slice(0, numPixels);
      } else {
        pred = new Array(numPixels).fill(128);
      }
    }

    // If orig was not available yet, fallback to pred
    if (!Array.isArray(orig) || orig.length < numPixels) {
      orig = pred.map(p => p);
    }

    // 4. Extract or derive Residual Sample Matrix (R = S - P)
    let resi = null;
    if (Array.isArray(currentMode?.resi_data) && currentMode.resi_data.length >= numPixels) {
      resi = currentMode.resi_data.slice(0, numPixels);
    } else {
      resi = orig.map((s, idx) => s - (pred[idx] ?? 128));
    }

    // 5. Extract or derive Reconstructed Sample Matrix (S')
    let recon = recoFromTelemetry || currentMode?.recon_data || currentMode?.reco_y;
    if (Array.isArray(recon) && recon.length >= numPixels) {
      recon = recon.slice(0, numPixels);
    } else if (reconFrameCanvas) {
      try {
        const ctx = reconFrameCanvas.getContext('2d');
        if (ctx && reconFrameCanvas.width > 0 && reconFrameCanvas.height > 0) {
          const frameW = reconFrameCanvas.width;
          const frameH = reconFrameCanvas.height;
          const safeX = Math.max(0, Math.min(Math.max(0, frameW - cuSize), absX));
          const safeY = Math.max(0, Math.min(Math.max(0, frameH - cuSize), absY));
          const safeW = Math.max(1, Math.min(cuSize, frameW - safeX));
          const safeH = Math.max(1, Math.min(cuSize, frameH - safeY));

          const imgData = ctx.getImageData(safeX, safeY, safeW, safeH);
          recon = new Array(numPixels);
          for (let y = 0; y < cuSize; y++) {
            for (let x = 0; x < cuSize; x++) {
              const srcX = Math.min(safeW - 1, x);
              const srcY = Math.min(safeH - 1, y);
              const offset = (srcY * safeW + srcX) * 4;
              const r = imgData.data[offset] ?? 128;
              const g = imgData.data[offset + 1] ?? 128;
              const b = imgData.data[offset + 2] ?? 128;
              recon[y * cuSize + x] = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
            }
          }
        }
      } catch (err) {
        console.warn('Could not extract recon from reconFrameCanvas in FourPictureComparison:', err);
      }
    }

    if (!Array.isArray(recon) || recon.length < numPixels) {
      // True HEVC mathematical reconstruction fallback: S' = Clip3(0, 255, P + R')
      recon = orig.map((o, idx) => {
        const r = resi[idx] ?? 0;
        const quantR = Math.round(r / 4) * 4;
        return Math.max(0, Math.min(255, (pred[idx] ?? 128) + quantR));
      });
    } else if (recon.length > numPixels) {
      recon = recon.slice(0, numPixels);
    }

    let sse = 0;
    let maxAbsErr = 0;
    let sumOrig = 0;
    let sumResi = 0;

    for (let i = 0; i < numPixels; i++) {
      const err = orig[i] - recon[i];
      sse += err * err;
      const absErr = Math.abs(err);
      if (absErr > maxAbsErr) maxAbsErr = absErr;

      sumOrig += orig[i];
      sumResi += Math.abs(resi[i]);
    }

    const mse = sse / numPixels;
    const psnr = calculatePsnr(mse);

    const meanOrig = sumOrig / numPixels;
    let varOrig = 0;
    let varResi = 0;
    for (let i = 0; i < numPixels; i++) {
      varOrig += Math.pow(orig[i] - meanOrig, 2);
      varResi += Math.pow(resi[i], 2);
    }
    varOrig /= numPixels;
    varResi /= numPixels;
    const varReduction = varOrig > 0 
      ? Math.max(0, ((1 - varResi / varOrig) * 100)).toFixed(1) 
      : (varResi === 0 ? '100.0' : '0.0');

    return {
      cuSize,
      orig,
      pred,
      resi,
      recon,
      mse: mse.toFixed(2),
      psnr,
      maxAbsErr,
      varReduction,
    };
  }, [currentMode, selectedCu, ctuX, ctuY, reconPictureData, origFrameCanvas, reconFrameCanvas]);

  const modeInfo = useMemo(() => {
    return currentMode ? getIntraModeInfo(currentMode.mode) : null;
  }, [currentMode]);

  const getFrameSrc = (type) => {
    if (type === 'orig') return imageSrc;
    if (type === 'recon') return reconImgUrl;
    if (type === 'resi') return residualImgUrl || imageSrc;
    if (type === 'pred') return null;
    return imageSrc;
  };

  // Clean pixel matrix rendering with fixed-dimension viewport & discrete canvas for 32x32 / 64x64
  const renderPixelMatrix = (type, title, badge, isBare = false) => {
    const size = cuData.cuSize;
    let dataArray;
    if (type === 'orig') dataArray = cuData.orig;
    else if (type === 'pred') dataArray = cuData.pred;
    else if (type === 'resi') dataArray = cuData.resi;
    else dataArray = cuData.recon;

    const targetDim = isBare
      ? '100%'
      : (layoutMode === 'single' ? 'min(100%, 310px)' : 'min(100%, 300px)');
    const maxDim = isBare
      ? '560px'
      : (layoutMode === 'single' ? '310px' : '300px');
    const cellFontSize = size <= 4 ? '1.05rem' : size <= 8 ? '0.78rem' : '0.56rem';

    const matrixGrid = size >= 32 ? (
      <div
        style={{
          width: targetDim,
          height: targetDim,
          maxWidth: maxDim,
          maxHeight: maxDim,
          aspectRatio: '1 / 1',
          margin: '0 auto',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--apple-canvas)',
          border: '1px solid var(--apple-hairline)',
        }}
      >
        <PixelMatrixCanvas
          dataArray={dataArray}
          size={size}
          type={type}
          resiGain={resiGain}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
          cuData={cuData}
        />
      </div>
    ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gap: '1px',
          background: 'var(--apple-border)',
          padding: '1px',
          maxWidth: maxDim,
          maxHeight: maxDim,
          width: targetDim,
          height: targetDim,
          aspectRatio: '1 / 1',
          margin: '0 auto',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {dataArray.map((val, idx) => {
          const x = idx % size;
          const y = Math.floor(idx / size);
          const isSelected = selectedCell && selectedCell.x === x && selectedCell.y === y;

          let bg = '#FFFFFF';
          let textCol = '#000000';

          if (type === 'resi') {
            const boosted = val * resiGain;
            const resiStyle = getResidualColorAndTextColor(boosted, 128);
            bg = resiStyle.bg;
            textCol = resiStyle.color;
          } else {
            const clamped = Math.max(0, Math.min(255, val));
            bg = `rgb(${clamped}, ${clamped}, ${clamped})`;
            textCol = clamped > 128 ? '#000000' : '#FFFFFF';
          }

          return (
            <div
              key={`cell-${idx}`}
              onClick={() =>
                setSelectedCell({
                  x,
                  y,
                  orig: cuData.orig[idx] ?? 0,
                  pred: cuData.pred[idx] ?? 0,
                  resi: cuData.resi[idx] ?? 0,
                  recon: cuData.recon[idx] ?? 0,
                })
              }
              style={{
                background: bg,
                color: textCol,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: cellFontSize,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600,
                letterSpacing: '-0.35px',
                cursor: 'pointer',
                outline: isSelected ? '2px solid #007AFF' : 'none',
                zIndex: isSelected ? 5 : 1,
                userSelect: 'none',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'clip',
                boxSizing: 'border-box',
                lineHeight: 1,
                padding: '0 1px',
              }}
            >
              {showValues && size <= 16 && (type === 'resi' && val > 0 ? `+${val}` : val)}
            </div>
          );
        })}
      </div>
    );

    if (isBare) {
      return matrixGrid;
    }

    return (
      <div
        className="apple-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          width: '100%',
          height: '380px',
          minHeight: '380px',
          maxHeight: '380px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.45rem 0.65rem',
            background: 'var(--apple-canvas)',
            borderBottom: '1px solid var(--apple-hairline)',
            fontSize: '0.78rem',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600,
            color: 'var(--apple-label)',
            height: '24px',
            flexShrink: 0,
            gap: '0.5rem',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <span
            style={{
              padding: '0.1rem 0.45rem',
              fontSize: '0.66rem',
              background: 'var(--fill-3)',
              color: 'var(--apple-label)',
              border: '1px solid var(--apple-hairline)',
              borderRadius: '4px',
              fontWeight: 700,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {badge}
          </span>
        </div>

        <div
          style={{
            padding: '0.5rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'var(--apple-canvas)',
            width: '100%',
            height: '340px',
            maxHeight: '340px',
            boxSizing: 'border-box',
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          {matrixGrid}
        </div>
      </div>
    );
  };

  // Full frame picture panel with image error fallback
  const renderFramePicture = (type, title, badge) => {
    let imgSrc = imageSrc;
    if (type === 'recon') {
      imgSrc = reconImgUrl;
    } else if (type === 'resi') {
      imgSrc = residualImgUrl || imageSrc;
    }

    return (
      <div
        className="apple-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.4rem 0.65rem',
            background: 'var(--apple-subtle)',
            borderBottom: '1px solid var(--apple-hairline)',
            fontSize: '11.5px',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600,
          }}
        >
          <span>{title}</span>
          <span
            style={{
              padding: '1px 6px',
              fontSize: '10px',
              background: 'var(--apple-surface)',
              border: '1px solid var(--apple-border)',
              color: 'var(--apple-label-primary)',
              borderRadius: '4px',
              fontWeight: 700,
            }}
          >
            {badge}
          </span>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${imgWidth} / ${imgHeight}`,
            background: 'var(--apple-canvas)',
            cursor: onSelectCTU ? 'pointer' : 'default',
          }}
          onClick={(e) => {
            if (!onSelectCTU) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const scaleX = imgWidth / rect.width;
            const scaleY = imgHeight / rect.height;
            const x = Math.min(imgWidth - 1, Math.max(0, Math.floor((e.clientX - rect.left) * scaleX)));
            const y = Math.min(imgHeight - 1, Math.max(0, Math.floor((e.clientY - rect.top) * scaleY)));
            const targetX = Math.floor(x / 64);
            const targetY = Math.floor(y / 64);
            if (ctuX === targetX && ctuY === targetY) {
              onSelectCTU(null, null);
            } else {
              onSelectCTU(targetX, targetY);
            }
          }}
        >
          {type === 'pred' ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '24px',
                textAlign: 'center',
                background: 'var(--apple-subtle)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--apple-blue)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'var(--apple-blue-subtle)',
                }}
              >
                [Scope: CU-Level Only]
              </span>
              <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', maxWidth: '260px' }}>
                Select a CU to inspect discrete spatial prediction.
              </span>
            </div>
          ) : (
            <img
              src={imgSrc}
              alt={title}
              onError={(e) => {
                if (e.currentTarget.src !== imageSrc && imageSrc) {
                  e.currentTarget.src = imageSrc;
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                imageRendering: 'pixelated',
                filter: type === 'resi' && !residualImgUrl ? 'contrast(300%) invert(20%)' : 'none',
              }}
            />
          )}

          {ctuX !== null && ctuY !== null && (
            <div
              style={{
                position: 'absolute',
                top: `${(ctuY * 64 / imgHeight) * 100}%`,
                left: `${(ctuX * 64 / imgWidth) * 100}%`,
                width: `${(64 / imgWidth) * 100}%`,
                height: `${(64 / imgHeight) * 100}%`,
                border: '1.5px solid #0284C7',
                background: 'rgba(2, 132, 199, 0.2)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>
    );
  };

  const renderSplitSlider = () => {
    const isFrame = scope === 'frame';
    const leftSrc = getFrameSrc(splitLeft);
    const rightSrc = getFrameSrc(splitRight);

    return (
      <div
        ref={splitContainerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: isFrame ? '860px' : '560px',
          margin: '0 auto',
          aspectRatio: isFrame ? `${imgWidth} / ${imgHeight}` : '1 / 1',
          border: '1px solid var(--apple-hairline)',
          borderRadius: 0,
          boxShadow: 'none',
          overflow: 'hidden',
          userSelect: 'none',
          background: 'var(--apple-canvas)',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          {isFrame ? (
            <img
              src={rightSrc}
              alt="Right"
              onError={(e) => {
                if (e.currentTarget.src !== imageSrc && imageSrc) {
                  e.currentTarget.src = imageSrc;
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderPixelMatrix(splitRight, `${splitRight.toUpperCase()}`, 'Right', true)}
            </div>
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)`,
          }}
        >
          {isFrame ? (
            <img
              src={leftSrc}
              alt="Left"
              onError={(e) => {
                if (e.currentTarget.src !== imageSrc && imageSrc) {
                  e.currentTarget.src = imageSrc;
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderPixelMatrix(splitLeft, `${splitLeft.toUpperCase()}`, 'Left', true)}
            </div>
          )}
        </div>

        <div
          onMouseDown={handleSplitMouseDown}
          onTouchStart={handleSplitTouchStart}
          tabIndex={0}
          role="slider"
          aria-valuenow={Math.round(splitPos)}
          aria-valuemin={0}
          aria-valuemax={100}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setSplitPos(p => Math.max(0, p - 2));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setSplitPos(p => Math.min(100, p + 2));
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${splitPos}%`,
            width: '1.5px',
            background: '#FFFFFF',
            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.4))',
            cursor: 'ew-resize',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            outline: 'none',
          }}
        >
          {/* Frosted Glass Handle Knob (Apple Pro / Squoosh / applecn glass) */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--apple-surface)',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              border: '0.5px solid var(--separator)',
              boxShadow: 'var(--shadow-thumb)',
              color: 'var(--label)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 600,
              userSelect: 'none',
              transition: 'transform 0.1s ease',
            }}
          >
            ↔
          </div>

          {/* Floating Percent Badge */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              background: 'var(--apple-surface)',
              color: 'var(--label)',
              border: '0.5px solid var(--separator)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: 'var(--shadow-card-small)'
            }}
          >
            {Math.round(splitPos)}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Clean Apple-style Toolbar */}
      <div className="stage-section-card" style={{ padding: '0.75rem 1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Picture Buffer Comparison
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {ctuX !== null && ctuY !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Badge variant="tag" color="gray">
                  CTU ({ctuX}, {ctuY})
                </Badge>
                {onSelectCTU && (
                  <Button
                    variant="gray"
                    size="mini"
                    onClick={() => onSelectCTU(null, null)}
                    title="Deselect CTU"
                  >
                    ✕
                  </Button>
                )}
              </div>
            )}
            {onNavigateToIntra && (
              <Button
                variant="gray"
                size="small"
                onClick={onNavigateToIntra}
              >
                Intra →
              </Button>
            )}
            {modeInfo && (
              <>
                <Badge variant="filled" color="blue">
                  Mode {currentMode.mode}: {modeInfo.name}
                </Badge>
                <Badge variant="tag" color="orange">
                  Cost: {currentMode.cost?.toFixed(1) || '0.0'}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.6rem',
            marginTop: '0.65rem',
            paddingTop: '0.65rem',
            borderTop: '1px solid var(--apple-border)',
          }}
        >
          {/* Scope SegmentedControl */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
              Scope:
            </span>
            <SegmentedControl
              value={scope}
              onChange={setScope}
              size="small"
              items={[
                { id: 'cu', label: 'Coding Unit (CU)' },
                { id: 'frame', label: 'Full Frame' },
              ]}
            />
          </div>

          {/* Layout SegmentedControl */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
              Layout:
            </span>
            <SegmentedControl
              value={layoutMode}
              onChange={setLayoutMode}
              size="small"
              items={[
                { id: 'grid', label: 'Grid' },
                { id: 'split', label: 'Split Slider' },
                { id: 'single', label: 'Single' },
              ]}
            />
          </div>

          {/* Gain and Values */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)', fontWeight: 600 }}>
                Gain:
              </span>
              <SegmentedControl
                value={resiGain}
                onChange={setResiGain}
                size="small"
                items={[
                  { id: 1, label: '1×' },
                  { id: 2, label: '2×' },
                  { id: 4, label: '4×' },
                  { id: 8, label: '8×' },
                ]}
              />
            </div>

            {scope === 'cu' && (
              <Button
                variant="gray"
                size="small"
                onClick={() => setShowValues(prev => !prev)}
              >
                Values: {showValues ? 'On' : 'Off'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Selected Cell Inspector (Deliberate click inspection) */}
      {selectedCell && (() => {
        const idx = selectedCell.y * cuData.cuSize + selectedCell.x;
        const curOrig = (cuData.orig && cuData.orig[idx] !== undefined) ? cuData.orig[idx] : selectedCell.orig;
        const curPred = (cuData.pred && cuData.pred[idx] !== undefined) ? cuData.pred[idx] : selectedCell.pred;
        const curResi = (cuData.resi && cuData.resi[idx] !== undefined) ? cuData.resi[idx] : selectedCell.resi;
        const curRecon = (cuData.recon && cuData.recon[idx] !== undefined) ? cuData.recon[idx] : selectedCell.recon;
        return (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.45rem 0.85rem',
              background: 'var(--apple-canvas)',
              border: '1px solid var(--apple-hairline)',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700 }}>
                Sample ({selectedCell.x}, {selectedCell.y})
              </span>
              <span>Original: <strong>{curOrig}</strong></span>
              <span>Prediction: <strong>{curPred}</strong></span>
              <span>Residual: <strong>{curResi > 0 ? `+${curResi}` : curResi}</strong></span>
              <span>Reconstructed: <strong>{curRecon}</strong></span>
              <span>Error: <strong>{Math.abs(curOrig - curRecon)}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCell(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--apple-label-secondary)', fontSize: '0.7rem' }}
            >
              ✕
            </button>
          </div>
        );
      })()}

      {/* Main Viewport Content */}
      {layoutMode === 'split' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <span>Left:</span>
              <select
                value={splitLeft}
                onChange={e => setSplitLeft(e.target.value)}
                className="apple-select-control"
                style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
              >
                <option value="orig">Original (S)</option>
                <option value="pred">Prediction (P)</option>
                <option value="resi">Residual (R)</option>
                <option value="recon">Reconstructed (S')</option>
              </select>
            </div>
            <span style={{ color: 'var(--apple-label-secondary)', fontSize: '0.8rem' }}>vs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <span>Right:</span>
              <select
                value={splitRight}
                onChange={e => setSplitRight(e.target.value)}
                className="apple-select-control"
                style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
              >
                <option value="recon">Reconstructed (S')</option>
                <option value="pred">Prediction (P)</option>
                <option value="resi">Residual (R)</option>
                <option value="orig">Original (S)</option>
              </select>
            </div>
          </div>
          {renderSplitSlider()}
        </div>
      ) : layoutMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
          {scope === 'cu' ? (
            <>
              {renderPixelMatrix('orig', 'Original Sample Matrix (S)', 'Pristine')}
              {renderPixelMatrix('pred', 'Spatial Predictor Matrix (P)', `Mode ${currentMode?.mode}`)}
              {renderPixelMatrix('resi', `Residual Sample Matrix (R) [${resiGain}×]`, 'S - P')}
              {renderPixelMatrix('recon', "Reconstructed Sample Matrix (S')", 'Clip(P + R\')')}
            </>
          ) : (
            <>
              {renderFramePicture('orig', 'Original Frame Buffer (S)', 'Pristine')}
              {renderFramePicture('pred', 'Prediction Frame Buffer (P)', 'Spatial')}
              {renderFramePicture('resi', `Residual Frame Buffer (R) [${resiGain}×]`, 'S - P')}
              {renderFramePicture('recon', "Reconstructed Frame Buffer (S')", 'm_cPicYuvRec')}
            </>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: scope === 'cu' ? '640px' : '540px', margin: '0 auto', width: '100%' }}>
          <div className="apple-segmented" style={{ marginBottom: '0.65rem', justifyContent: 'center' }}>
            {[
              { id: 'orig', label: 'Original' },
              { id: 'pred', label: 'Prediction' },
              { id: 'resi', label: 'Residual' },
              { id: 'recon', label: 'Reconstructed' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                className={`apple-segmented-item ${singleFocus === f.id ? 'active' : ''}`}
                onClick={() => setSingleFocus(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {scope === 'cu'
            ? renderPixelMatrix(singleFocus, singleFocus.toUpperCase(), 'Focus')
            : renderFramePicture(singleFocus, singleFocus.toUpperCase(), 'Focus')}
        </div>
      )}

      {/* Metrics Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.85rem',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--fill-4)',
            border: '0.5px solid var(--separator)',
            borderRadius: '8px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            PSNR
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--apple-label)', marginTop: '2px' }}>
            {cuData.psnr} <span style={{ fontSize: '0.75rem', color: 'var(--apple-label-secondary)' }}>dB</span>
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: 'var(--fill-4)',
            border: '0.5px solid var(--separator)',
            borderRadius: '8px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Energy Reduction
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--system-green)', marginTop: '2px' }}>
            {cuData.varReduction}%
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: 'var(--fill-4)',
            border: '0.5px solid var(--separator)',
            borderRadius: '8px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Max Error
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--system-blue)', marginTop: '2px' }}>
            ±{cuData.maxAbsErr}
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: 'var(--fill-4)',
            border: '0.5px solid var(--separator)',
            borderRadius: '8px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Identity
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--system-purple)', marginTop: '4px' }}>
            S' = P + R'
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(FourPictureComparison);
