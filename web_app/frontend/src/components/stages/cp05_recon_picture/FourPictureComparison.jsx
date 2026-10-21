import React, { useState, useEffect, useMemo } from 'react';
import { getIntraModeInfo, getResidualColorAndTextColor, getSampleColorAndTextColor, bt709RgbToYuv } from '../../../utils/colorUtils';
import { calculatePsnr } from '../../../utils/metricsUtils';
import { generateIntraPredictionBlock } from '../../../utils/intraTraceUtils';
import { resolveCuCoordinates } from '../../../utils/cuCoordinates.js';
import PixelMatrixCanvas from './components/PixelMatrixCanvas';
import CuCellInspector from './components/CuCellInspector';
import InteractiveSplitSlider from './components/InteractiveSplitSlider';
import ComparisonToolbar from './components/ComparisonToolbar';

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
  showValues: propsShowValues = undefined,
  onToggleValues = null,
  channel = 'Y',
  resiGain: propsResiGain = undefined,
  onSelectResiGain = null,
}) => {
  const [scope, setScope] = useState('frame'); // 'frame' (Default: Full Frame) | 'cu'
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' (Default: Interactive Slider) | 'grid' | 'single'
  const [singleFocus, setSingleFocus] = useState('orig');
  const [splitLeft, setSplitLeft] = useState('orig');
  const [splitRight, setSplitRight] = useState('recon');
  const [internalResiGain, setInternalResiGain] = useState(4);
  const resiGain = propsResiGain !== undefined ? propsResiGain : internalResiGain;
  const setResiGain = onSelectResiGain || setInternalResiGain;
  const [internalShowValues, setInternalShowValues] = useState(true);
  const showValues = propsShowValues !== undefined ? propsShowValues : internalShowValues;
  const setShowValues = onToggleValues || setInternalShowValues;
  const [selectedCell, setSelectedCell] = useState(null);

  const isU = channel === 'Cb' || channel === 'U';
  const isV = channel === 'Cr' || channel === 'V';
  const isChroma = isU || isV;

  const imgWidth = imageDims?.width || 640;
  const imgHeight = imageDims?.height || 360;

  const activeOrigUrl = useMemo(() => {
    if (jobId && isChroma) {
      const plane = isU ? 'u' : 'v';
      return `${API_BASE_URL}/api/v1/jobs/${jobId}/images/${plane}`;
    }
    return imageSrc;
  }, [jobId, imageSrc, isChroma, isU, API_BASE_URL]);

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

  // Maintain offscreen canvas for source frame (for extracting orig samples and perimeter)
  const [origFrameCanvas, setOrigFrameCanvas] = useState(null);
  useEffect(() => {
    if (!activeOrigUrl) return;
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
    img.src = activeOrigUrl;
    return () => {
      isCurrent = false;
    };
  }, [activeOrigUrl, imageDims?.width, imageDims?.height]);

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
    const baseCuSize = selectedCu?.width || selectedCu?.w || currentMode?.cu_size || 8;
    const cuSize = isChroma ? Math.max(4, Math.floor(baseCuSize / 2)) : baseCuSize;
    const numPixels = cuSize * cuSize;
    const refSpan = 2 * cuSize + 1;

    const { relX, relY, absX, absY } = resolveCuCoordinates(selectedCu, ctuX, ctuY, cuSize);

    // Check if CP_05 RECON_PICTURE telemetry has matching reconstructed block
    let recoFromTelemetry = null;
    if (Array.isArray(reconPictureData) && reconPictureData.length > 0) {
      const match = reconPictureData.find(e =>
        (e.cu_x === absX || e.cu_x === relX) &&
        (e.cu_y === absY || e.cu_y === relY) &&
        (e.cu_w === cuSize || e.cu_size === cuSize || e.cu_w === baseCuSize)
      );
      const teleReco = isU ? match?.reco_u : isV ? match?.reco_v : match?.reco_y;
      if (teleReco && teleReco.length >= numPixels) {
        recoFromTelemetry = teleReco.slice(0, numPixels);
      }
    }

    // 1. Extract or derive Original Source Samples (S)
    let orig = null;
    const isModeMatched = currentMode && (
      (currentMode.pu_x === absX || currentMode.pu_x === relX || currentMode.cu_x === absX || currentMode.cu_x === relX) &&
      (currentMode.pu_y === absY || currentMode.pu_y === relY || currentMode.cu_y === absY || currentMode.cu_y === relY)
    );
    const modeOrg = isModeMatched ? (isU ? currentMode?.org_u : isV ? currentMode?.org_v : currentMode?.orig_data) : null;
    if (Array.isArray(modeOrg) && modeOrg.length >= numPixels) {
      orig = modeOrg.slice(0, numPixels);
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
              const { y: ySample, cb: cbSample, cr: crSample } = bt709RgbToYuv(r, g, b);
              orig[y * cuSize + x] = isU ? cbSample : isV ? crSample : ySample;
            }
          }
        }
      } catch (err) {
        console.warn('Could not extract orig from origFrameCanvas in FourPictureComparison:', err);
      }
    } else if (Array.isArray(modeOrg) && modeOrg.length > 0) {
      const srcDim = Math.round(Math.sqrt(modeOrg.length)) || 8;
      orig = new Array(numPixels);
      for (let y = 0; y < cuSize; y++) {
        for (let x = 0; x < cuSize; x++) {
          const sx = Math.min(srcDim - 1, Math.floor((x / cuSize) * srcDim));
          const sy = Math.min(srcDim - 1, Math.floor((y / cuSize) * srcDim));
          orig[y * cuSize + x] = modeOrg[sy * srcDim + sx] ?? 128;
        }
      }
    }

    // 2. Extract or synthesize Perimeter Reference Samples (refTop, refLeft)
    let refTop = isU ? (currentMode?.ref_top_u || currentMode?.ref_top) : isV ? (currentMode?.ref_top_v || currentMode?.ref_top) : currentMode?.ref_top;
    let refLeft = isU ? (currentMode?.ref_left_u || currentMode?.ref_left) : isV ? (currentMode?.ref_left_v || currentMode?.ref_left) : currentMode?.ref_left;
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

          const getSampleAt = (px, py) => {
            const clampedX = Math.max(0, Math.min(reqW - 1, px - startX));
            const clampedY = Math.max(0, Math.min(reqH - 1, py - startY));
            const offset = (clampedY * reqW + clampedX) * 4;
            const r = patch.data[offset] ?? 128;
            const g = patch.data[offset + 1] ?? 128;
            const b = patch.data[offset + 2] ?? 128;
            const { y: ySample, cb: cbSample, cr: crSample } = bt709RgbToYuv(r, g, b);
            return isU ? cbSample : isV ? crSample : ySample;
          };

          const corner = getSampleAt(absX - 1, absY - 1);
          const topSamples = new Array(refSpan);
          const leftSamples = new Array(refSpan);
          topSamples[0] = corner;
          leftSamples[0] = corner;

          for (let i = 0; i < 2 * cuSize; i++) {
            topSamples[i + 1] = getSampleAt(absX + i, absY - 1);
            leftSamples[i + 1] = getSampleAt(absX - 1, absY + i);
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
    const modePred = isU ? currentMode?.pred_u : isV ? currentMode?.pred_v : currentMode?.pred_data;
    if (Array.isArray(modePred) && modePred.length >= numPixels) {
      pred = modePred.slice(0, numPixels);
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
    const modeResi = isU ? currentMode?.resi_u : isV ? currentMode?.resi_v : currentMode?.resi_data;
    if (Array.isArray(modeResi) && modeResi.length >= numPixels) {
      resi = modeResi.slice(0, numPixels);
    } else {
      resi = orig.map((s, idx) => s - (pred[idx] ?? 128));
    }

    // 5. Extract or derive Reconstructed Sample Matrix (S')
    const modeRecon = isU ? (currentMode?.reco_u || currentMode?.recon_u) : isV ? (currentMode?.reco_v || currentMode?.recon_v) : (currentMode?.recon_data || currentMode?.reco_y);
    let recon = recoFromTelemetry || modeRecon;
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
              const { y: ySample, cb: cbSample, cr: crSample } = bt709RgbToYuv(r, g, b);
              recon[y * cuSize + x] = isU ? cbSample : isV ? crSample : ySample;
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
  }, [currentMode, selectedCu, ctuX, ctuY, reconPictureData, origFrameCanvas, reconFrameCanvas, isChroma, isU, isV]);

  const modeInfo = useMemo(() => {
    return currentMode ? getIntraModeInfo(currentMode.mode) : null;
  }, [currentMode]);

  const getFrameSrc = (type) => {
    if (type === 'orig') return activeOrigUrl;
    if (type === 'recon') return reconImgUrl;
    if (type === 'resi') return residualImgUrl || activeOrigUrl;
    if (type === 'pred') return null;
    return activeOrigUrl;
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
          channel={channel}
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
            const sampleStyle = getSampleColorAndTextColor(val, channel);
            bg = sampleStyle.bg;
            textCol = sampleStyle.color;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {isChroma && (
              <span
                style={{
                  padding: '0.1rem 0.45rem',
                  fontSize: '0.66rem',
                  background: 'var(--fill-3)',
                  color: isU ? '#007AFF' : '#FF3B30',
                  border: '1px solid var(--apple-hairline)',
                  borderRadius: '4px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {isU ? 'Cb' : 'Cr'}
              </span>
            )}
            <span
              style={{
                padding: '0.1rem 0.45rem',
                fontSize: '0.66rem',
                background: 'var(--fill-3)',
                color: 'var(--apple-label)',
                border: '1px solid var(--apple-hairline)',
                borderRadius: '4px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {badge}
            </span>
          </div>
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
    let imgSrc = activeOrigUrl;
    if (type === 'recon') {
      imgSrc = reconImgUrl;
    } else if (type === 'resi') {
      imgSrc = residualImgUrl || activeOrigUrl;
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
      <InteractiveSplitSlider
        isFrame={isFrame}
        imgWidth={imgWidth}
        imgHeight={imgHeight}
        leftSrc={leftSrc}
        rightSrc={rightSrc}
        imageSrc={imageSrc}
        initialPos={50}
        splitLeft={splitLeft}
        splitRight={splitRight}
        renderPixelMatrix={renderPixelMatrix}
      />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Clean Apple-style Toolbar */}
      <ComparisonToolbar
        ctuX={ctuX}
        ctuY={ctuY}
        onSelectCTU={onSelectCTU}
        onNavigateToIntra={onNavigateToIntra}
        modeInfo={modeInfo}
        currentMode={currentMode}
        scope={scope}
        setScope={setScope}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        resiGain={resiGain}
        setResiGain={setResiGain}
        propsShowValues={propsShowValues}
        showValues={showValues}
        setShowValues={setShowValues}
      />

      {/* Selected Cell Inspector (Deliberate click inspection) */}
      <CuCellInspector
        selectedCell={selectedCell}
        setSelectedCell={setSelectedCell}
        cuData={cuData}
      />

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
