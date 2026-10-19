import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import GopReferenceVisualizer from '../GopReferenceVisualizer';
import QuadTreeVisualizer from '../QuadTreeVisualizer';
import { CompactStepRibbon } from './CompactStepRibbon';
import { Badge, SegmentedControl, Button } from '../apple';
import { useHmTracePlayback } from '../../hooks/useHmTracePlayback';

/**
 * Pixelated HTML5 Canvas preview for large CU blocks (> 8x8) to eliminate DOM overhead.
 */
function CuSampleCanvas({ samples, width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    const total = width * height;
    const hasSamples = samples && samples.length > 0;
    const srcLen = hasSamples ? samples.length : 0;

    for (let i = 0; i < total; i++) {
      let rawVal = 128;
      if (hasSamples) {
        if (i < srcLen) {
          rawVal = samples[i];
        } else {
          rawVal = samples[i % srcLen];
        }
      }
      const v = Math.max(0, Math.min(255, Math.round(rawVal ?? 128)));
      const offset = i * 4;
      data[offset] = v;
      data[offset + 1] = v;
      data[offset + 2] = v;
      data[offset + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }, [samples, width, height]);

  const displaySize = Math.min(180, Math.max(100, Math.round(width * 2.5)));

  return (
    <div
      style={{
        width: `${displaySize}px`,
        height: `${displaySize}px`,
        border: '1px solid var(--apple-hairline)',
        borderRadius: '4px',
        overflow: 'hidden',
        background: 'var(--apple-surface, #2C2C2E)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
    </div>
  );
}

/**
 * Step1FrameTree (Guided Flow Step 1)
 * Frame & CTU Selection + CU QuadTree Partitioning Hierarchy (HM TEncCu::xCompressCU)
 * Features Apple Pro Transport Bar for HM Trace Playback and sub-CU inspection.
 */
export function Step1FrameTree({
  imageSrc,
  imageDims,
  ctuX = 0,
  ctuY = 0,
  partitionData,
  ctuPartitionsMap,
  selectedCu: propsSelectedCu = null,
  onSelectCU,
  onSelectCTU,
  onReAnalyze,
  loading,
  frameGopData,
  handleSelectSize,
  setCuSize,
  setCurrentModeIdx,
  data,
  onProceedToPrediction,
}) {
  // Start initially on 'frame' view with unencoded grid and Start Encode button
  const [subView, setSubView] = useState('frame'); // 'frame' | 'quadtree'

  const handleCuNavigation = useCallback((node) => {
    if (!node) return;
    if (onSelectCU) onSelectCU(node);
    const targetSize = node.width || 8;
    if (setCuSize) setCuSize(targetSize);
    if (handleSelectSize) handleSelectSize(targetSize);
    const targetMode = node.intra_dir !== null && node.intra_dir !== undefined ? node.intra_dir : null;
    if (targetMode !== null && data) {
      const targetIdx = data.findIndex((d) => d.mode === targetMode);
      if (targetIdx !== -1 && setCurrentModeIdx) setCurrentModeIdx(targetIdx);
    }
  }, [onSelectCU, setCuSize, handleSelectSize, data, setCurrentModeIdx]);

  // HM Trace Playback State Machine
  const playback = useHmTracePlayback({
    imageDims,
    ctuSize: 64,
    ctuPartitionsMap,
    partitionData,
    targetCtuX: ctuX,
    targetCtuY: ctuY,
    initialSelectedCu: propsSelectedCu,
    onSelectCTU,
    onSelectCU: handleCuNavigation,
  });

  // Synchronously focus CU and smoothly advance to Step 2: Intra Prediction
  const handleNavigateToPrediction = useCallback((node) => {
    if (!node) return;
    playback.setInspectedCu(node);
    handleCuNavigation(node);
    if (onProceedToPrediction) {
      onProceedToPrediction();
    }
  }, [playback, handleCuNavigation, onProceedToPrediction]);

  const currentPart = ctuPartitionsMap?.[`${playback.currentCtu?.ctuX ?? ctuX}_${playback.currentCtu?.ctuY ?? ctuY}`] || partitionData;

  const selectedCu = playback.inspectedCu || propsSelectedCu;
  const isSplitCu = Boolean(selectedCu?.split);
  const _cuTypeBadge = isSplitCu ? 'Split CU' : 'Leaf CU';
  const cuSizeStr = selectedCu ? `${selectedCu.width || 8}×${selectedCu.height || 8}` : '64×64 (CTU)';
  const _cuPosStr = selectedCu ? `(${selectedCu.x ?? selectedCu.abs_x ?? 0}, ${selectedCu.y ?? selectedCu.abs_y ?? 0})` : `CTU (${ctuX}, ${ctuY})`;

  // Maintain an offscreen canvas for source image Luma extraction
  const [frameCanvas, setFrameCanvas] = useState(null);

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
        setFrameCanvas(cvs);
      }
    };
    img.src = imageSrc;
    return () => {
      isCurrent = false;
    };
  }, [imageSrc, imageDims?.width, imageDims?.height]);

  const activeFrameCanvas = imageSrc ? frameCanvas : null;

  // Extract raw samples from trace or source frame with mathematical BT.709 Luma
  const { samples: rawOrgSamples, sourceProvenance } = useMemo(() => {
    if (!selectedCu) return { samples: null, sourceProvenance: 'none' };
    const w = selectedCu.width || 8;
    const h = selectedCu.height || 8;
    const targetCount = w * h;

    // 1. If HM trace candidate has org_data matching the EXACT block dimensions, prefer trace
    if (data && data.length > 0) {
      const modeObj = data.find((m) => m.mode === (selectedCu?.intra_dir ?? 0)) || data[0];
      if (modeObj?.org_data && modeObj.org_data.length === targetCount) {
        return { samples: modeObj.org_data, sourceProvenance: 'trace' };
      }
    }

    // 2. Extract exact ITU-R BT.709 Luma samples from the source frame image at CU coordinates
    if (activeFrameCanvas) {
      try {
        const ctx = activeFrameCanvas.getContext('2d');
        if (ctx && activeFrameCanvas.width > 0 && activeFrameCanvas.height > 0) {
          const ctuOriginX = (ctuX ?? 0) * 64;
          const ctuOriginY = (ctuY ?? 0) * 64;
          const rawX = Number(selectedCu.abs_x ?? selectedCu.x ?? 0);
          const rawY = Number(selectedCu.abs_y ?? selectedCu.y ?? 0);
          const absX = Number.isFinite(rawX) ? (rawX >= ctuOriginX ? rawX : ctuOriginX + rawX) : ctuOriginX;
          const absY = Number.isFinite(rawY) ? (rawY >= ctuOriginY ? rawY : ctuOriginY + rawY) : ctuOriginY;
          const safeX = Math.max(0, Math.min(Math.max(0, activeFrameCanvas.width - w), absX));
          const safeY = Math.max(0, Math.min(Math.max(0, activeFrameCanvas.height - h), absY));
          const safeW = Math.max(1, Math.min(w, activeFrameCanvas.width - safeX));
          const safeH = Math.max(1, Math.min(h, activeFrameCanvas.height - safeY));

          const imgData = ctx.getImageData(safeX, safeY, safeW, safeH);
          const luma = new Array(targetCount);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const srcX = Math.min(safeW - 1, x);
              const srcY = Math.min(safeH - 1, y);
              const offset = (srcY * safeW + srcX) * 4;
              const r = imgData.data[offset] ?? 128;
              const g = imgData.data[offset + 1] ?? 128;
              const b = imgData.data[offset + 2] ?? 128;
              // ITU-R BT.709 Full-Range Luma Y = 0.2126*R + 0.7152*G + 0.0722*B
              luma[y * w + x] = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
            }
          }
          return { samples: luma, sourceProvenance: 'frame' };
        }
      } catch (err) {
        console.warn('Could not extract CU samples from frame canvas:', err);
      }
    }

    // 3. Fallback: if data[0].org_data exists, resample or tile it
    if (data && data[0]?.org_data && data[0].org_data.length > 0) {
      const src = data[0].org_data;
      const srcDim = Math.round(Math.sqrt(src.length)) || 8;
      const resampled = new Array(targetCount);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sx = Math.min(srcDim - 1, Math.floor((x / w) * srcDim));
          const sy = Math.min(srcDim - 1, Math.floor((y / h) * srcDim));
          resampled[y * w + x] = src[sy * srcDim + sx] ?? 128;
        }
      }
      return { samples: resampled, sourceProvenance: 'resampled' };
    }

    // 4. Default neutral gray pattern
    const neutral = new Array(targetCount);
    for (let i = 0; i < targetCount; i++) {
      neutral[i] = 128;
    }
    return { samples: neutral, sourceProvenance: 'fallback' };
  }, [selectedCu, data, activeFrameCanvas, ctuX, ctuY]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Compact I/O Strip */}
      <CompactStepRibbon
        stepNumber={1}
        inputItems={['CTU 64×64']}
        processTitle="QuadTree Split"
        processDesc=""
        outputItems={[`CU ${cuSizeStr}`]}
        hmFunction="TEncCu::xCompressCU"
        specReference="CTU Division into Coding Units"
        formula="CU_size = MaxCUSize >> depth (depth in [0..3], sizes 64, 32, 16, 8)"
      />

      {/* Apple Pro HM Trace Transport Bar */}
      <div
        className="stage-section-card"
        style={{
          padding: '4px 12px',
          height: '42px',
          minHeight: '42px',
          maxHeight: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          overflowY: 'hidden',
          background: 'var(--fill-1)',
          border: '0.5px solid var(--separator)',
          borderRadius: '8px',
          boxSizing: 'border-box'
        }}
      >
        {/* Left: Telemetry & State Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {playback.isInitial ? (
            <Badge variant="gray" style={{ fontWeight: 700, fontSize: '10px' }}>
              UNENCODED (64×64 Grid)
            </Badge>
          ) : playback.isPlaying ? (
            <Badge variant="blue" style={{ fontWeight: 700, fontSize: '10px' }}>
              ENCODING CTU {playback.currentCtu?.seqIdx !== undefined ? playback.currentCtu.seqIdx + 1 : 1}/{playback.totalCtus}
            </Badge>
          ) : playback.isCompleted ? (
            <Badge variant="green" style={{ fontWeight: 700, fontSize: '10px' }}>
              FRAME ENCODED (100%)
            </Badge>
          ) : (
            <Badge variant="yellow" style={{ fontWeight: 700, fontSize: '10px' }}>
              PAUSED
            </Badge>
          )}

          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--apple-label)', whiteSpace: 'nowrap' }}>
            CTU: <strong>({playback.currentCtu?.ctuX ?? ctuX}, {playback.currentCtu?.ctuY ?? ctuY})</strong>
            <span style={{ color: 'var(--apple-label-tertiary)', marginLeft: '4px' }}>
              [{playback.playheadCtuIdx > 0 ? playback.playheadCtuIdx : 0}/{playback.totalCtus}]
            </span>
          </span>

          {currentPart?.ctu_actual_bits != null && (
            <Badge variant="green" style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', padding: '1px 6px', whiteSpace: 'nowrap' }} title="TEncSlice::encodeCtu bitstream output">
              Actual bits — CTU: {currentPart.ctu_actual_bits.toLocaleString()} b
            </Badge>
          )}

          {selectedCu?.split ? (
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--apple-purple, #AF52DE)', whiteSpace: 'nowrap' }}>
              &bull; Inspected: <strong>SPLIT CU ({selectedCu.width}&times;{selectedCu.height}, D{selectedCu.depth ?? 0})</strong>
            </span>
          ) : playback.activeLeafNodes.length > 0 ? (
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--apple-label-secondary)', whiteSpace: 'nowrap' }}>
              &bull; Leaf CU: <strong>{playback.activeCuIdx + 1}/{playback.activeLeafNodes.length}</strong> ({selectedCu?.width || 64}&times;{selectedCu?.height || 64}, D{selectedCu?.depth ?? 0})
            </span>
          ) : null}

          <div style={{ width: '95px', minWidth: '95px', height: '24px', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
            {!playback.isTargetCtuActive && !playback.isInitial && onReAnalyze ? (
              <Button
                variant="tinted"
                size="mini"
                onClick={() => onReAnalyze(playback.currentCtu?.ctuX ?? 0, playback.currentCtu?.ctuY ?? 0)}
                style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', padding: '2px 6px', width: '100%', height: '24px', justifyContent: 'center' }}
                title="Run full telemetry pipeline on this CTU"
              >
                Analyze CTU &rarr;
              </Button>
            ) : null}
          </div>
        </div>

        {/* Right: Transport Stepper Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', flexShrink: 0 }}>
          {/* Reset */}
          <Button
            variant="plain"
            size="mini"
            onClick={playback.resetPlayback}
            title="Reset to unencoded initial frame (clean 64x64 CTU grid)"
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
          >
            ↺ Reset
          </Button>

          {/* Macro: Prev CTU */}
          <Button
            variant="tinted"
            size="mini"
            disabled={playback.isInitial || playback.playheadCtuIdx <= 0}
            onClick={playback.stepPrevCtu}
            title="Step to previous CTU"
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
          >
            ⏮ Prev CTU
          </Button>

          {/* Primary Action Button */}
          {playback.isPlaying ? (
            <Button
              variant="primary"
              size="mini"
              onClick={playback.pausePlayback}
              title="Pause encoding playback"
              style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
            >
              ⏸ Pause
            </Button>
          ) : (
            <Button
              variant="primary"
              size="mini"
              onClick={playback.startPlayback}
              title={playback.isInitial ? "Start xCompressCU encode playback across frame CTUs" : "Resume playback"}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: playback.isInitial ? 'var(--system-green)' : 'var(--system-blue)',
              }}
            >
              {playback.isInitial ? '▶ Start Encode' : '▶ Play'}
            </Button>
          )}

          {/* Macro: Next CTU */}
          <Button
            variant="tinted"
            size="mini"
            disabled={playback.isCompleted}
            onClick={playback.stepNextCtu}
            title="Step to next CTU in scan order"
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
          >
            Next CTU ⏭
          </Button>

          <div style={{ width: '1px', height: '14px', background: 'var(--separator)', margin: '0 2px' }} />

          {/* Micro: Prev CU (within active CTU D0..D3) */}
          <Button
            variant="tinted"
            size="mini"
            disabled={playback.activeLeafNodes.length <= 1}
            onClick={playback.stepPrevCu}
            title="Step to previous leaf CU in active CTU (Z-scan order D0..D3)"
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
          >
            ◀ CU
          </Button>

          {/* Micro: Next CU (within active CTU D0..D3) */}
          <Button
            variant="tinted"
            size="mini"
            disabled={playback.activeLeafNodes.length <= 1}
            onClick={playback.stepNextCu}
            title="Step to next leaf CU in active CTU (Z-scan order D0..D3)"
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
          >
            CU ▶
          </Button>

          <div style={{ width: '1px', height: '14px', background: 'var(--separator)', margin: '0 2px' }} />

          {/* Playback Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {[
              { label: '0.5s', val: 500 },
              { label: '1.0s', val: 1000 },
              { label: '2.0s', val: 2000 },
            ].map((sp) => (
              <button
                key={sp.val}
                type="button"
                onClick={() => playback.setSpeedMs(sp.val)}
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  background: playback.speedMs === sp.val ? 'var(--fill-3)' : 'transparent',
                  border: playback.speedMs === sp.val ? '0.5px solid var(--separator)' : 'none',
                  color: playback.speedMs === sp.val ? 'var(--apple-label)' : 'var(--apple-label-tertiary)',
                  cursor: 'pointer',
                }}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-view Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--apple-label-secondary)' }}>
          {subView === 'frame'
            ? 'Full Frame CTU Processing Grid'
            : `CTU (${playback.currentCtu?.ctuX ?? ctuX}, ${playback.currentCtu?.ctuY ?? ctuY}) QuadTree Decomposition`}
        </span>
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          size="small"
          items={[
            { id: 'frame', label: 'Frame & GOP Sequence' },
            { id: 'quadtree', label: 'CU QuadTree Hierarchy' },
          ]}
        />
      </div>

      {/* Interactive Main Workspace */}
      {subView === 'quadtree' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="stage-section-card">
            <QuadTreeVisualizer
              partitionData={playback.activeCtuPartitions || partitionData}
              ctuX={playback.currentCtu?.ctuX ?? ctuX}
              ctuY={playback.currentCtu?.ctuY ?? ctuY}
              imageSrc={imageSrc}
              imageDims={imageDims}
              selectedCU={selectedCu}
              onSelectCU={playback.setInspectedCu}
              onNavigateToIntra={handleNavigateToPrediction}
              onBackToFrame={() => setSubView('frame')}
            />
          </div>

          {/* S_orig Raw Block Telemetry Preview */}
          {selectedCu && (
            <div
              className="stage-section-card"
              style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'var(--fill-1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--apple-label)' }}>
                    Output S_orig Sample Matrix &bull; Coding Unit ({selectedCu.x ?? selectedCu.abs_x ?? 0}, {selectedCu.y ?? selectedCu.abs_y ?? 0})
                  </span>
                  <Badge variant={sourceProvenance === 'trace' ? 'green' : 'blue'} style={{ fontSize: '9px' }}>
                    {sourceProvenance === 'trace' ? 'HM TRACE: S_orig' : 'FRAME BT.709: S_orig'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {onProceedToPrediction && (
                    <Button
                      variant="filled"
                      size="mini"
                      onClick={() => handleNavigateToPrediction(selectedCu)}
                      title="Trace This CU in Flow: Proceed to Step 2 Intra Prediction"
                      style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', background: 'var(--system-blue)', color: '#FFFFFF' }}
                    >
                      Next: Intra Prediction ({selectedCu.width || 8}&times;{selectedCu.height || 8}) &rarr;
                    </Button>
                  )}
                </div>
              </div>

              {rawOrgSamples && rawOrgSamples.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {(selectedCu.width || 8) <= 8 ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${selectedCu.width || 8}, minmax(18px, 24px))`,
                        gap: '1px',
                        background: 'var(--separator)',
                        padding: '1px',
                        borderRadius: '4px',
                      }}
                    >
                      {rawOrgSamples.slice(0, (selectedCu.width || 8) * (selectedCu.height || 8)).map((val, idx) => (
                        <div
                          key={idx}
                          style={{
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8.5px',
                            fontFamily: 'var(--font-mono)',
                            background: `rgb(${val}, ${val}, ${val})`,
                            color: val > 128 ? '#000000' : '#FFFFFF',
                          }}
                          title={`Sample (${idx % (selectedCu.width || 8)}, ${Math.floor(idx / (selectedCu.width || 8))}): Y=${val}`}
                        >
                          {val}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <CuSampleCanvas
                      samples={rawOrgSamples}
                      width={selectedCu.width || 8}
                      height={selectedCu.height || 8}
                    />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--apple-label-secondary)' }}>
                      Block Dimensions: <strong>{selectedCu.width || 8}&times;{selectedCu.height || 8}</strong>
                    </span>
                    <span style={{ color: 'var(--apple-label-secondary)' }}>
                      Total Luma Samples: <strong>{(selectedCu.width || 8) * (selectedCu.height || 8)}</strong>
                    </span>
                    <span style={{ color: 'var(--apple-label-secondary)' }}>
                      Depth in CTU: <strong>{selectedCu.depth ?? 0}</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontStyle: 'italic' }}>
                  Select a CU node in the QuadTree to inspect its raw luminance samples.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <GopReferenceVisualizer
          imageSrc={imageSrc}
          imageDims={imageDims}
          ctuX={playback.currentCtu?.ctuX ?? ctuX}
          ctuY={playback.currentCtu?.ctuY ?? ctuY}
          onSelectCTU={(x, y) => {
            if (onSelectCTU) onSelectCTU(x, y);
            const idx = playback.ctuSequence.findIndex((c) => c.ctuX === x && c.ctuY === y);
            if (idx !== -1) {
              playback.jumpToCtu(idx);
            }
          }}
          onNavigateToQuadTree={(x, y) => {
            if (onSelectCTU) onSelectCTU(x, y);
            const idx = playback.ctuSequence.findIndex((c) => c.ctuX === x && c.ctuY === y);
            if (idx !== -1) {
              playback.jumpToCtu(idx);
            }
            setSubView('quadtree');
          }}
          partitionData={playback.activeCtuPartitions || partitionData}
          ctuPartitionsMap={ctuPartitionsMap}
          isAnalyzed={true}
          onReAnalyze={onReAnalyze}
          loading={loading}
          selectedCu={selectedCu}
          onSelectCU={playback.setInspectedCu}
          frameGopData={frameGopData}
          committedCtuKeys={playback.committedCtuKeys}
        />
      )}
    </div>
  );
}

export default React.memo(Step1FrameTree);
