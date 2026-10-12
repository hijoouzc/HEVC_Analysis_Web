import React, { memo, useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { SELECTION_HIGHLIGHT_COLOR } from '../../utils/colorUtils';

/**
 * Resolve canvas-compatible color strings (handling CSS variables fallbacks)
 */
function resolveCanvasColor(colorStr) {
  if (!colorStr) return '#2C2C2E';
  if (colorStr.includes('var(')) {
    const match = colorStr.match(/var\([^,]+,\s*([^)]+)\)/);
    if (match && match[1]) return match[1].trim();
    return '#2C2C2E';
  }
  return colorStr;
}

/**
 * Individual memoized cell in the block matrix.
 * 100% Click-Only: zero hover attributes, zero hover listeners.
 */
const MatrixCell = memo(function MatrixCell({
  x,
  y,
  isSelected,
  isDC,
  style,
  displayVal,
  cellSize = 36,
  onSelect
}) {
  return (
    <div
      onClick={() => onSelect({ x, y })}
      style={{
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        backgroundColor: style.bg,
        color: style.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: cellSize >= 40 ? '0.78rem' : '0.68rem',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: style.fontWeight || 700,
        letterSpacing: '-0.3px',
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'clip',
        padding: '1px',
        borderRadius: 0,
        boxSizing: 'border-box',
        outline: isSelected
          ? `2.5px solid ${SELECTION_HIGHLIGHT_COLOR}`
          : (isDC ? '1.5px solid var(--apple-blue)' : 'none'),
        zIndex: isSelected ? 10 : (isDC ? 2 : 1),
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      {displayVal}
    </div>
  );
});

/**
 * BlockMatrixGrid
 * High-performance, pixel-accurate 2D matrix renderer for Residual, DCT/DST,
 * and Quantized coefficient blocks.
 *
 * Adheres to:
 * - Macro-Micro Dual Stage View for blocks >= 16x16 (fixed 36px micro cells, zero text clipping)
 * - Direct large-cell grid for blocks <= 8x8 (36-48px cells)
 * - 100% Click-Only interaction: zero hover tooltips
 */
function BlockMatrixGrid({
  data = [],
  width = 8,
  selectedCell = null,
  onSelectCell,
  getColor,
  formatValue,
  activeWindow = null,
  onSelectWindow = null,
  macroCanvasSize = 160,
  microCellSize = 36
}) {
  const canvasRef = useRef(null);
  const [internalWindow, setInternalWindow] = useState({ wx: 0, wy: 0 });

  const currentWindow = activeWindow ?? internalWindow;
  const maxWindows = Math.max(1, Math.floor(width / 8));
  const wx = Math.min(Math.max(0, currentWindow?.wx ?? 0), maxWindows - 1);
  const wy = Math.min(Math.max(0, currentWindow?.wy ?? 0), maxWindows - 1);
  const winX0 = wx * 8;
  const winY0 = wy * 8;
  const winW = Math.min(8, width);
  const winH = Math.min(8, width);

  const handleSelectWindow = useCallback((w) => {
    if (onSelectWindow) {
      onSelectWindow(w);
    } else {
      setInternalWindow(w);
    }
  }, [onSelectWindow]);

  const handleCellClick = useCallback((coord) => {
    if (onSelectCell) {
      onSelectCell(coord);
    }
  }, [onSelectCell]);

  // Draw discrete Macro Canvas bitmap for width >= 16
  useEffect(() => {
    if (width < 16 || !canvasRef.current || !data || data.length < width * width) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = width;
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const val = data[idx] ?? 0;
        const isDC = (x === 0 && y === 0);
        const style = getColor ? getColor(val, isDC, x, y) : { bg: '#2C2C2E' };
        ctx.fillStyle = resolveCanvasColor(style.bg);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [data, width, getColor]);

  // Click on Macro Canvas: select 8x8 sub-window and click cell
  const handleMacroCanvasClick = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const px = Math.min(width - 1, Math.max(0, Math.floor((clickX / rect.width) * width)));
    const py = Math.min(width - 1, Math.max(0, Math.floor((clickY / rect.height) * width)));

    const newWx = Math.floor(px / 8);
    const newWy = Math.floor(py / 8);

    handleSelectWindow({ wx: newWx, wy: newWy });
    handleCellClick({ x: px, y: py });
  }, [width, handleSelectWindow, handleCellClick]);

  // Micro window samples
  const microSamples = useMemo(() => {
    const samples = [];
    for (let ly = 0; ly < winH; ly++) {
      for (let lx = 0; lx < winW; lx++) {
        const gx = winX0 + lx;
        const gy = winY0 + ly;
        const val = data[gy * width + gx] ?? 0;
        samples.push({ gx, gy, val });
      }
    }
    return samples;
  }, [data, width, winX0, winY0, winW, winH]);

  // ---------------------------------------------------------------------------
  // Small blocks (<= 8x8): direct grid with fixed, large, legible cells
  // ---------------------------------------------------------------------------
  if (width <= 8) {
    const cellSize = width === 4 ? 48 : microCellSize;
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${width}, ${cellSize}px)`,
          gap: '1px',
          background: 'var(--apple-hairline)',
          padding: '1px',
          border: '1px solid var(--apple-hairline)',
          borderRadius: 0,
          overflow: 'hidden',
          width: 'fit-content',
          margin: '0 auto'
        }}
      >
        {data.map((val, idx) => {
          const x = idx % width;
          const y = Math.floor(idx / width);
          const isSelected = selectedCell && selectedCell.x === x && selectedCell.y === y;
          const isDC = (x === 0 && y === 0);
          const style = getColor ? getColor(val, isDC, x, y) : { bg: 'var(--apple-surface)', color: 'var(--apple-label)' };
          const displayVal = formatValue ? formatValue(val, x, y, isDC) : val;

          return (
            <MatrixCell
              key={`${x}-${y}`}
              x={x}
              y={y}
              cellSize={cellSize}
              isSelected={isSelected}
              isDC={isDC}
              style={style}
              displayVal={displayVal}
              onSelect={handleCellClick}
            />
          );
        })}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Large blocks (>= 16x16): Macro-Micro Dual Stage View
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.85rem',
        alignItems: 'flex-start',
        justifyContent: 'center',
        width: '100%'
      }}
    >
      {/* Pane 1: Macro Energy Canvas */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          background: 'var(--apple-canvas)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: '4px',
          padding: '0.5rem',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: '10.5px',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono',
            color: 'var(--apple-label-secondary)'
          }}
        >
          <span>MACRO ({width}×{width})</span>
          <span style={{ color: 'var(--apple-blue)' }}>({wx}, {wy})</span>
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
            background: '#1C1C1E'
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              imageRendering: 'pixelated'
            }}
          />

          {/* SVG Sub-block Grid Overlay */}
          <svg
            viewBox={`0 0 ${width} ${width}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          >
            {Array.from({ length: maxWindows }).map((_, i) => (
              <React.Fragment key={`grid-${i}`}>
                <line
                  x1={i * 8}
                  y1={0}
                  x2={i * 8}
                  y2={width}
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth={0.3}
                  strokeDasharray="1 1"
                />
                <line
                  x1={0}
                  y1={i * 8}
                  x2={width}
                  y2={i * 8}
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth={0.3}
                  strokeDasharray="1 1"
                />
              </React.Fragment>
            ))}

            {/* Active 8x8 Window Highlight */}
            <rect
              x={winX0}
              y={winY0}
              width={winW}
              height={winH}
              fill="rgba(0, 122, 255, 0.2)"
              stroke="#007AFF"
              strokeWidth={0.6}
            />

            {/* Selected Cell Reticle */}
            {selectedCell &&
              selectedCell.x >= 0 &&
              selectedCell.x < width &&
              selectedCell.y >= 0 &&
              selectedCell.y < width && (
                <rect
                  x={selectedCell.x}
                  y={selectedCell.y}
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
            fontSize: '9.5px',
            color: 'var(--apple-label-tertiary)',
            fontFamily: 'JetBrains Mono'
          }}
        >
          [Click to jump region]
        </span>
      </div>

      {/* Pane 2: Micro High-Def Numeric Matrix */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          background: 'var(--apple-canvas)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: '4px',
          padding: '0.5rem',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '0.5rem'
          }}
        >
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono',
              color: 'var(--apple-label)'
            }}
          >
            MICRO [{winX0}..{winX0 + winW - 1}, {winY0}..{winY0 + winH - 1}]
          </span>

          {maxWindows > 1 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                className="apple-btn-secondary"
                disabled={wx === 0}
                onClick={() => handleSelectWindow({ wx: Math.max(0, wx - 1), wy })}
                style={{ padding: '0 5px', height: '20px', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
              >
                ←
              </button>
              <button
                type="button"
                className="apple-btn-secondary"
                disabled={wx >= maxWindows - 1}
                onClick={() => handleSelectWindow({ wx: Math.min(maxWindows - 1, wx + 1), wy })}
                style={{ padding: '0 5px', height: '20px', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
              >
                →
              </button>
              <button
                type="button"
                className="apple-btn-secondary"
                disabled={wy === 0}
                onClick={() => handleSelectWindow({ wx, wy: Math.max(0, wy - 1) })}
                style={{ padding: '0 5px', height: '20px', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
              >
                ↑
              </button>
              <button
                type="button"
                className="apple-btn-secondary"
                disabled={wy >= maxWindows - 1}
                onClick={() => handleSelectWindow({ wx, wy: Math.min(maxWindows - 1, wy + 1) })}
                style={{ padding: '0 5px', height: '20px', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
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
            background: 'var(--apple-hairline)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: 0,
            overflow: 'hidden'
          }}
        >
          {microSamples.map(({ gx, gy, val }) => {
            const isSelected = selectedCell && selectedCell.x === gx && selectedCell.y === gy;
            const isDC = (gx === 0 && gy === 0);
            const style = getColor ? getColor(val, isDC, gx, gy) : { bg: 'var(--apple-surface)', color: 'var(--apple-label)' };
            const displayVal = formatValue ? formatValue(val, gx, gy, isDC) : val;

            return (
              <MatrixCell
                key={`micro-${gx}-${gy}`}
                x={gx}
                y={gy}
                cellSize={microCellSize}
                isSelected={isSelected}
                isDC={isDC}
                style={style}
                displayVal={displayVal}
                onSelect={handleCellClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(BlockMatrixGrid);
