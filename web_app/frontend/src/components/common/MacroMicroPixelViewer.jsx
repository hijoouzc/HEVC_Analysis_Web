import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  getSampleColorAndTextColor,
  getResidualColorAndTextColor,
  SELECTION_HIGHLIGHT_COLOR,
} from '../../utils/colorUtils';

/**
 * MacroMicroPixelViewer
 *
 * Professional-grade dual-stage pixel inspector adhering strictly to:
 * - Elecard StreamEye & Apple macOS Tahoe HIG standards
 * - hevc-pixel-accurate-design (BT.709 colorimetry, imageSmoothingEnabled = false)
 * - 100% Click-Only interaction (zero hover flutter, zero hover listeners)
 * - Large, comfortable 36px cells with zero text clipping for any block size (4 to 64)
 */
export default function MacroMicroPixelViewer({
  data = [],
  N = 8,
  channel = 'Y',
  type = 'sample', // 'sample' (Org, Pred, Reco) | 'residual' (Resi) | 'frequency' (DCT/Quant)
  maxResidualScale = 64,
  selectedPixel = null, // { x, y }
  onSelectPixel = null,
  activeWindow = { wx: 0, wy: 0 }, // 8x8 sub-block window index (0, 1, ...)
  onSelectWindow = null,
  showMacro = true,
  macroCanvasSize = 160, // px
  microCellSize = 36, // px - large and comfortable for tabular digits
  showValues = true, // boolean toggle for pixel value text overlay
}) {
  const canvasRef = useRef(null);

  // Clamped sub-block coordinates
  const maxWindows = Math.max(1, Math.floor(N / 8));
  const wx = Math.min(Math.max(0, activeWindow?.wx ?? 0), maxWindows - 1);
  const wy = Math.min(Math.max(0, activeWindow?.wy ?? 0), maxWindows - 1);
  const winX0 = wx * 8;
  const winY0 = wy * 8;

  // Window dimension (min of 8 and N)
  const winW = Math.min(8, N);
  const winH = Math.min(8, N);

  // Helper color styling function
  const getCellStyle = useCallback(
    (val) => {
      if (type === 'residual') {
        return getResidualColorAndTextColor(val, maxResidualScale);
      }
      return getSampleColorAndTextColor(val, channel);
    },
    [type, maxResidualScale, channel]
  );

  // Draw discrete 1-sample-to-1-pixel Bitmap onto Macro Canvas (for N >= 16)
  useEffect(() => {
    if (N < 16 || !canvasRef.current || !data || data.length < N * N) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = N;
    canvas.height = N;
    ctx.imageSmoothingEnabled = false;

    const imgData = ctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const val = data[i] ?? 0;
      let r = 128;
      let g = 128;
      let b = 128;

      if (type === 'residual') {
        // Exact 8-bit offset display R' = clamp(R + 128, 0, 255)
        const offsetVal = Math.max(0, Math.min(255, Math.round(val + 128)));
        r = offsetVal;
        g = offsetVal;
        b = offsetVal;
      } else if (channel === 'U') {
        // Chroma Cb: blue tint
        const offsetVal = Math.max(0, Math.min(255, Math.round(val)));
        r = Math.round(offsetVal * 0.4);
        g = Math.round(offsetVal * 0.7);
        b = offsetVal;
      } else if (channel === 'V') {
        // Chroma Cr: red tint
        const offsetVal = Math.max(0, Math.min(255, Math.round(val)));
        r = offsetVal;
        g = Math.round(offsetVal * 0.4);
        b = Math.round(offsetVal * 0.5);
      } else {
        // Luma Y: Monochromatic grayscale R=Y, G=Y, B=Y
        const yVal = Math.max(0, Math.min(255, Math.round(val)));
        r = yVal;
        g = yVal;
        b = yVal;
      }

      const idx = i * 4;
      imgData.data[idx] = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [data, N, type, channel]);

  // Click on Macro Canvas: selects 8x8 sub-window and selects clicked pixel
  const handleMacroCanvasClick = useCallback(
    (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const px = Math.min(N - 1, Math.max(0, Math.floor((clickX / rect.width) * N)));
      const py = Math.min(N - 1, Math.max(0, Math.floor((clickY / rect.height) * N)));

      const newWx = Math.floor(px / 8);
      const newWy = Math.floor(py / 8);

      if (onSelectWindow) {
        onSelectWindow({ wx: newWx, wy: newWy });
      }

      if (onSelectPixel) {
        const val = data[py * N + px];
        onSelectPixel({ x: px, y: py, val });
      }
    },
    [N, data, onSelectWindow, onSelectPixel]
  );

  // Extract samples for the active Micro numeric window
  const microSamples = useMemo(() => {
    const samples = [];
    for (let ly = 0; ly < winH; ly++) {
      for (let lx = 0; lx < winW; lx++) {
        const gx = winX0 + lx;
        const gy = winY0 + ly;
        const val = data[gy * N + gx] ?? 0;
        samples.push({ lx, ly, gx, gy, val });
      }
    }
    return samples;
  }, [data, N, winX0, winY0, winW, winH]);

  // -------------------------------------------------------------------------
  // Render Mode A: Blocks <= 8x8 (Direct Micro Numeric Grid)
  // -------------------------------------------------------------------------
  if (N <= 8) {
    const cellSize = N === 4 ? 48 : microCellSize;
    return (
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          padding: '2px 0'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${N}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${N}, ${cellSize}px)`,
            gap: '1px',
            background: 'var(--apple-hairline, rgba(0, 0, 0, 0.15))',
            border: '1px solid var(--apple-hairline, rgba(0, 0, 0, 0.15))',
            borderRadius: '4px',
            overflow: 'hidden',
            width: 'fit-content',
            margin: '0 auto',
            flexShrink: 0
          }}
        >
          {microSamples.map(({ gx, gy, val }) => {
            const isSelected = selectedPixel && selectedPixel.x === gx && selectedPixel.y === gy;
            const { bg, color } = getCellStyle(val);
            const text = showValues ? (type === 'residual' ? (val > 0 ? `+${val}` : `${val}`) : `${val}`) : '';

            return (
              <div
                key={`cell-${gx}-${gy}`}
                onClick={() => onSelectPixel && onSelectPixel({ x: gx, y: gy, val })}
                style={{
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  backgroundColor: bg,
                  color: color,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: cellSize >= 40 ? '0.78rem' : '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '-0.4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  boxSizing: 'border-box',
                  border: isSelected ? `2.5px solid ${SELECTION_HIGHLIGHT_COLOR}` : 'none',
                  zIndex: isSelected ? 10 : 1,
                }}
              >
                {text}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render Mode B: Blocks >= 16x16 (Macro-Micro Dual Stage View)
  // -------------------------------------------------------------------------
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.85rem',
        alignItems: 'flex-start',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto',
        boxSizing: 'border-box',
        padding: '2px 0'
      }}
    >
      {/* Pane 1: Macro Texture Canvas (Full N x N block) */}
      {showMacro && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'var(--apple-canvas)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: '6px',
            padding: '0.6rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              color: 'var(--apple-label-secondary)',
            }}
          >
            <span>MACRO ({N}×{N})</span>
            <span style={{ color: 'var(--apple-blue)' }}>
              Sub-block ({wx}, {wy})
            </span>
          </div>

          <div
            onClick={handleMacroCanvasClick}
            style={{
              position: 'relative',
              width: `${macroCanvasSize}px`,
              height: `${macroCanvasSize}px`,
              border: '1px solid var(--apple-hairline)',
              borderRadius: '2px',
              overflow: 'hidden',
              cursor: 'crosshair',
              background: '#000000',
            }}
          >
            {/* Discrete 1:1 Pixel Canvas scaled up with pixelated rendering */}
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                imageRendering: 'pixelated',
              }}
            />

            {/* SVG Sub-block Grid & Reticle Overlay */}
            <svg
              viewBox={`0 0 ${N} ${N}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {/* 8x8 sub-block grid lines */}
              {Array.from({ length: maxWindows }).map((_, i) => (
                <React.Fragment key={`grid-${i}`}>
                  <line
                    x1={i * 8}
                    y1={0}
                    x2={i * 8}
                    y2={N}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth={0.3}
                    strokeDasharray="1 1"
                  />
                  <line
                    x1={0}
                    y1={i * 8}
                    x2={N}
                    y2={i * 8}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth={0.3}
                    strokeDasharray="1 1"
                  />
                </React.Fragment>
              ))}

              {/* Active 8x8 Window Highlight Reticle */}
              <rect
                x={winX0}
                y={winY0}
                width={winW}
                height={winH}
                fill="rgba(0, 122, 255, 0.18)"
                stroke="#007AFF"
                strokeWidth={0.6}
              />

              {/* Selected Pixel Reticle */}
              {selectedPixel &&
                selectedPixel.x >= 0 &&
                selectedPixel.x < N &&
                selectedPixel.y >= 0 &&
                selectedPixel.y < N && (
                  <rect
                    x={selectedPixel.x}
                    y={selectedPixel.y}
                    width={1}
                    height={1}
                    fill="none"
                    stroke={SELECTION_HIGHLIGHT_COLOR}
                    strokeWidth={0.6}
                  />
                )}
            </svg>
          </div>

          <span
            style={{
              fontSize: '10px',
              color: 'var(--apple-label-tertiary)',
              fontFamily: 'JetBrains Mono',
            }}
          >
            [Click to jump to 8×8 region]
          </span>
        </div>
      )}

      {/* Pane 2: Micro High-Def Numeric Matrix (Always 36px per cell, large and legible) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'var(--apple-canvas)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: '6px',
          padding: '0.6rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              color: 'var(--apple-label)',
            }}
          >
            MICRO MATRIX [X: {winX0}..{winX0 + winW - 1}, Y: {winY0}..{winY0 + winH - 1}]
          </span>

          {/* Sub-block Stepper Controls */}
          {maxWindows > 1 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                className="apple-btn-secondary"
                disabled={wx === 0}
                onClick={() => onSelectWindow && onSelectWindow({ wx: Math.max(0, wx - 1), wy })}
                style={{ padding: '0 6px', height: '22px', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                title="Shift Micro Window Left"
              >
                ←
              </button>
              <button
                type="button"
                className="apple-btn-secondary"
                disabled={wx >= maxWindows - 1}
                onClick={() => onSelectWindow && onSelectWindow({ wx: Math.min(maxWindows - 1, wx + 1), wy })}
                style={{ padding: '0 6px', height: '22px', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                title="Shift Micro Window Right"
              >
                →
              </button>
              <button
                type="button"
                className="apple-btn-secondary"
                disabled={wy === 0}
                onClick={() => onSelectWindow && onSelectWindow({ wx, wy: Math.max(0, wy - 1) })}
                style={{ padding: '0 6px', height: '22px', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                title="Shift Micro Window Up"
              >
                ↑
              </button>
              <button
                type="button"
                className="apple-btn-secondary"
                disabled={wy >= maxWindows - 1}
                onClick={() => onSelectWindow && onSelectWindow({ wx, wy: Math.min(maxWindows - 1, wy + 1) })}
                style={{ padding: '0 6px', height: '22px', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                title="Shift Micro Window Down"
              >
                ↓
              </button>
            </div>
          )}
        </div>

        {/* 8x8 Grid of Large 36px Cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${winW}, ${microCellSize}px)`,
            gridTemplateRows: `repeat(${winH}, ${microCellSize}px)`,
            gap: '1px',
            background: 'var(--apple-hairline, rgba(0, 0, 0, 0.15))',
            border: '1px solid var(--apple-hairline, rgba(0, 0, 0, 0.15))',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {microSamples.map(({ gx, gy, val }) => {
            const isSelected = selectedPixel && selectedPixel.x === gx && selectedPixel.y === gy;
            const { bg, color } = getCellStyle(val);
            const text = showValues ? (type === 'residual' ? (val > 0 ? `+${val}` : `${val}`) : `${val}`) : '';

            return (
              <div
                key={`micro-${gx}-${gy}`}
                onClick={() => onSelectPixel && onSelectPixel({ x: gx, y: gy, val })}
                style={{
                  width: `${microCellSize}px`,
                  height: `${microCellSize}px`,
                  backgroundColor: bg,
                  color: color,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  letterSpacing: '-0.4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  boxSizing: 'border-box',
                  border: isSelected ? `2.5px solid ${SELECTION_HIGHLIGHT_COLOR}` : 'none',
                  zIndex: isSelected ? 10 : 1,
                }}
              >
                {text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
