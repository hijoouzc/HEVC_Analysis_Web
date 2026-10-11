import React, { useState, useMemo, useCallback } from 'react';
import { getIntraModeInfo, getSampleColorAndTextColor, getResidualColorAndTextColor, SELECTION_HIGHLIGHT_COLOR } from '../utils/colorUtils';
import { calculatePsnr } from '../utils/metricsUtils';
import { Button, SegmentedControl } from './apple';

/**
 * Synchronized4WayViewport
 * Synchronized 4-Way Crosshair Viewport across:
 * [1] Original: Reference block texture (Y / Cb / Cr)
 * [2] Prediction: Model prediction from intra mode
 * [3] Residual Heatmap: Signed error matrix (0 = Neutral, + = Red/Warm, - = Blue/Cool)
 * [4] Reconstruction: Restored block (Clip3[0, 255, Pred + Resi])
 *
 * Fully dynamic block sizing (8×8, 16×16, 32×32) and channel selection (Y, Cb, Cr).
 */
export default function Synchronized4WayViewport({
  modeData = null,
  currentMode = 0,
  _blockSize = 8,
  ctuX = 0,
  ctuY = 0,
  onBackToIntra = null
}) {
  const [channel, setChannel] = useState('Y'); // 'Y', 'U', 'V'
  const [selectedPixel, setSelectedPixel] = useState({ r: 0, c: 0 }); // click-only inspection
  const [layoutMode, setLayoutMode] = useState('2x2'); // '2x2' or 'side-by-side'
  const [showValues, setShowValues] = useState(true);
  const [zoomPreset, setZoomPreset] = useState('fit'); // 'fit', '1.5x', '2x'

  const handleChannelChange = useCallback((newCh) => {
    setChannel(newCh);
    setSelectedPixel(null);
  }, []);

  // Target block size based on selected channel (ITU-T H.265 4:2:0 subsampling)
  // Strictly enforce 8x8 for Luma and 4x4 for Chroma
  const targetN = (channel === 'Y') ? 8 : 4;
  const N = targetN;
  const totalPixels = N * N;

  // Extract memoized raw arrays based on selected channel
  const orgData = useMemo(() => {
    const raw = channel === 'U' ? modeData?.org_u : channel === 'V' ? modeData?.org_v : modeData?.org_data;
    return (raw && raw.length >= totalPixels) ? raw.slice(0, totalPixels) : Array(totalPixels).fill(128);
  }, [channel, modeData, totalPixels]);

  const predData = useMemo(() => {
    const raw = channel === 'U' ? modeData?.pred_u : channel === 'V' ? modeData?.pred_v : modeData?.pred_data;
    return (raw && raw.length >= totalPixels) ? raw.slice(0, totalPixels) : Array(totalPixels).fill(128);
  }, [channel, modeData, totalPixels]);

  const resiData = useMemo(() => {
    const raw = channel === 'U' ? modeData?.resi_u : channel === 'V' ? modeData?.resi_v : modeData?.resi_data;
    return (raw && raw.length >= totalPixels) ? raw.slice(0, totalPixels) : Array(totalPixels).fill(0);
  }, [channel, modeData, totalPixels]);

  const activeMode = modeData?.mode ?? currentMode ?? 0;
  const modeInfo = getIntraModeInfo(activeMode);

  // Compute Reconstruction: Pred + Resi clipped to [0, 255]
  const reconData = useMemo(() => {
    return predData.map((pred, i) => {
      const resi = resiData[i] ?? 0;
      return Math.max(0, Math.min(255, Math.round(pred + resi)));
    });
  }, [predData, resiData]);

  // Compute block-level statistics
  const stats = useMemo(() => {
    let sad = 0;
    let sse = 0;
    let maxAbsResi = 0;
    let zeroCount = 0;

    for (let i = 0; i < totalPixels; i++) {
      const resi = resiData[i] ?? 0;
      const absR = Math.abs(resi);
      sad += absR;
      sse += resi * resi;
      if (absR > maxAbsResi) maxAbsResi = absR;
      if (resi === 0) zeroCount++;
    }

    const meanOrg = Math.round(orgData.reduce((a, b) => a + b, 0) / totalPixels);
    const meanPred = Math.round(predData.reduce((a, b) => a + b, 0) / totalPixels);
    const psnr = calculatePsnr(sse / totalPixels);

    return { sad, sse, maxAbsResi, zeroCount, meanOrg, meanPred, psnr };
  }, [orgData, predData, resiData, totalPixels]);

  // Dynamic cell sizing based on N to prevent viewport overflow
  const cellSize = useMemo(() => {
    let base = Math.max(9, Math.floor(320 / N));
    if (zoomPreset === '1.5x') base = Math.round(base * 1.4);
    if (zoomPreset === '2x') base = Math.round(base * 1.8);
    return Math.max(8, base);
  }, [N, zoomPreset]);

  const showCellText = showValues && cellSize >= 15;

  // Dynamic max scale for residual heatmap
  const heatmapScale = Math.max(16, stats.maxAbsResi);

  // Residual Heatmap color generator
  const getResidualStyle = (val) => {
    return getResidualColorAndTextColor(val, heatmapScale);
  };

  const getSampleStyle = (val) => {
    return getSampleColorAndTextColor(val, channel);
  };

  // Helper to render an individual matrix grid
  const renderMatrix = (type, dataArray, title, subtitle, badgeColor) => {
    return (
      <div className="apple-card" style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: `${N * cellSize + 32}px`,
        overflow: 'hidden'
      }}>
        {/* Sub-card Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.45rem 0.75rem',
          borderBottom: '1px solid var(--apple-hairline)',
          background: 'var(--apple-canvas)'
        }}>
          <div>
            <span style={{
              background: badgeColor,
              color: '#FFFFFF',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              fontFamily: 'JetBrains Mono'
            }}>
              {title}
            </span>
          </div>
          {subtitle && (
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--apple-label-secondary)',
              fontFamily: 'JetBrains Mono',
              fontWeight: 600
            }}>
              {subtitle}
            </span>
          )}
        </div>

        {/* Matrix Grid Container */}
        <div style={{
          padding: '0.85rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'var(--apple-canvas)',
          overflow: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${N}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${N}, ${cellSize}px)`,
            gap: '1px',
            background: 'var(--apple-hairline)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: 0,
            overflow: 'hidden',
            position: 'relative'
          }}>
            {dataArray.map((val, idx) => {
              const c = idx % N;
              const r = Math.floor(idx / N);
              const validR = selectedPixel ? Math.min(Math.max(0, selectedPixel.r), N - 1) : null;
              const validC = selectedPixel ? Math.min(Math.max(0, selectedPixel.c), N - 1) : null;
              const isSelected = selectedPixel !== null && validR === r && validC === c;

              let cellBg = '';
              let cellColor = '';
              let cellBorder = 'none';
              let cellShadow = 'none';

              if (type === 'resi') {
                const resiStyle = getResidualStyle(val);
                cellBg = resiStyle.bg;
                cellColor = resiStyle.color;
                cellBorder = resiStyle.border;
                cellShadow = resiStyle.textShadow;
              } else {
                const sStyle = getSampleStyle(val);
                cellBg = sStyle.bg;
                cellColor = sStyle.color;
                cellBorder = sStyle.border;
                cellShadow = sStyle.textShadow;
              }

              return (
                <div
                  key={`cell-${type}-${r}-${c}`}
                  onClick={() => {
                    setSelectedPixel(prev => {
                      if (prev && prev.r === r && prev.c === c) {
                        return null;
                      }
                      return { r, c };
                    });
                  }}
                  style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    backgroundColor: cellBg,
                    color: cellColor,
                    textShadow: cellShadow,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: cellSize >= 36 ? '0.74rem' : cellSize >= 22 ? '0.60rem' : '0.45rem',
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    cursor: 'pointer',
                    userSelect: 'none',
                    border: isSelected ? `2px solid ${SELECTION_HIGHLIGHT_COLOR}` : cellBorder,
                    boxShadow: 'none',
                    transform: 'none',
                    zIndex: isSelected ? 20 : 1,
                    transition: 'none',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box'
                  }}
                  title={`[${type.toUpperCase()}] Row ${r}, Col ${c} = ${val}`}
                >
                  {(showCellText || (isSelected && cellSize >= 12)) && (
                    <span>
                      {type === 'resi' && val > 0 ? `+${val}` : val}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const activeR = selectedPixel ? Math.min(Math.max(0, selectedPixel.r), N - 1) : null;
  const activeC = selectedPixel ? Math.min(Math.max(0, selectedPixel.c), N - 1) : null;
  const activeOrg = selectedPixel ? orgData[activeR * N + activeC] : null;
  const activePred = selectedPixel ? predData[activeR * N + activeC] : null;
  const activeResi = selectedPixel ? resiData[activeR * N + activeC] : null;
  const activeRecon = selectedPixel ? reconData[activeR * N + activeC] : null;

  return (
    <div className="apple-card" style={{
      padding: '1.25rem',
      marginBottom: '1.5rem'
    }}>
      {/* Top Banner & Control Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--apple-hairline)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--apple-label)' }}>
            Synchronized 4-Way Viewport
          </span>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--apple-label-secondary)',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600
          }}>
            CTU ({ctuX}, {ctuY}) • Mode {activeMode} • {channel} {N}×{N}
          </span>
        </div>

        {/* Viewport Control Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onBackToIntra && (
            <Button
              variant="gray"
              size="small"
              onClick={onBackToIntra}
              title="Return to Intra Prediction Pipeline"
            >
              ← INTRA PIPELINE
            </Button>
          )}

          {/* Channel Selector Toggle */}
          <SegmentedControl
            value={channel}
            onChange={handleChannelChange}
            size="small"
            items={[
              { id: 'Y', label: 'Y' },
              { id: 'U', label: 'Cb' },
              { id: 'V', label: 'Cr' },
            ]}
          />

          {/* Layout Toggle */}
          <Button
            variant="gray"
            size="small"
            onClick={() => setLayoutMode(prev => prev === '2x2' ? 'side-by-side' : '2x2')}
            title="Toggle between 2×2 Grid and 4-Column Side-by-Side layout"
          >
            {layoutMode === '2x2' ? '2×2 Grid' : '4-Column'}
          </Button>

          {/* Show Numbers Toggle */}
          <Button
            variant={showValues ? 'tinted' : 'gray'}
            size="small"
            onClick={() => setShowValues(prev => !prev)}
            title="Toggle pixel numerical text overlay"
          >
            Values: {showValues ? 'On' : 'Off'}
          </Button>

          {/* Zoom Buttons */}
          <SegmentedControl
            value={zoomPreset}
            onChange={setZoomPreset}
            size="small"
            items={[
              { id: 'fit', label: 'FIT' },
              { id: '1.5x', label: '1.5×' },
              { id: '2x', label: '2×' },
            ]}
          />
        </div>
      </div>

      {/* Selected Pixel Synchronized Readout Banner */}
      <div style={{
        background: selectedPixel ? 'var(--apple-orange-subtle)' : 'var(--apple-canvas)',
        border: selectedPixel ? '1px solid var(--system-orange)' : '1px solid var(--apple-hairline)',
        padding: '0.65rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.82rem',
        color: 'var(--apple-label)',
        transition: 'none'
      }}>
        {selectedPixel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: 'var(--system-orange)' }}>
              Pixel ({activeR}, {activeC}):
            </span>
            <span>Original: <strong>{activeOrg}</strong></span>
            <span>Prediction: <strong style={{ color: 'var(--apple-blue)' }}>{activePred}</strong></span>
            <span>Residual: <strong style={{ color: activeResi > 0 ? '#E11D48' : activeResi < 0 ? '#0284C7' : 'var(--apple-label-secondary)' }}>
              {activeResi > 0 ? `+${activeResi}` : activeResi}
            </strong></span>
            <span>Reconstructed: <strong style={{ color: 'var(--system-green)' }}>{activeRecon}</strong></span>
          </div>
        ) : (
          <div style={{ color: 'var(--apple-label-secondary)', fontSize: '0.78rem' }}>
            Click any pixel to inspect synchronized values across all 4 views
          </div>
        )}
      </div>

      {/* Viewport Matrices Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: layoutMode === '2x2' ? 'repeat(auto-fit, minmax(320px, 1fr))' : `repeat(4, minmax(${N * cellSize + 40}px, 1fr))`,
        gap: '1.25rem',
        marginBottom: '1.25rem',
        overflowX: 'auto'
      }}>
        {/* Viewport 1: Original */}
        {renderMatrix(
          'org',
          orgData,
          `Original (${channel})`,
          '',
          '#10B981'
        )}

        {/* Viewport 2: Prediction */}
        {renderMatrix(
          'pred',
          predData,
          `Prediction (${channel})`,
          `Mode ${activeMode}: ${modeInfo.name}`,
          '#0284C7'
        )}

        {/* Viewport 3: Residual Heatmap */}
        {renderMatrix(
          'resi',
          resiData,
          `Residual (${channel})`,
          `±${heatmapScale}`,
          '#E11D48'
        )}

        {/* Viewport 4: Reconstruction */}
        {renderMatrix(
          'recon',
          reconData,
          `Reconstructed (${channel})`,
          '',
          '#8B5CF6'
        )}
      </div>

      {/* Block Statistics & Metric Summary Footer */}
      <div className="apple-card" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        background: 'var(--fill-4)',
        border: '0.5px solid var(--separator)',
        borderRadius: '8px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.78rem'
      }}>
        <div>
          <span style={{ color: 'var(--apple-label-secondary)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dimension</span>
          <strong style={{ color: 'var(--apple-label)' }}>{channel} {N}×{N}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--apple-label-secondary)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SAD</span>
          <strong style={{ color: 'var(--system-purple)' }}>{stats.sad}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--apple-label-secondary)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SSE</span>
          <strong style={{ color: 'var(--system-orange)' }}>{stats.sse}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--apple-label-secondary)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PSNR</span>
          <strong style={{ color: 'var(--system-green)' }}>{stats.psnr} dB</strong>
        </div>
        <div>
          <span style={{ color: 'var(--apple-label-secondary)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max Residual</span>
          <strong style={{ color: 'var(--system-red)' }}>±{stats.maxAbsResi}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--apple-label-secondary)', display: 'block', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Zero Residuals</span>
          <strong style={{ color: 'var(--apple-label)' }}>{stats.zeroCount} / {totalPixels}</strong>
        </div>
      </div>
    </div>
  );
}
