import React, { useRef, useEffect } from 'react';

/**
 * Clamps value to 8-bit unsigned integer range [0, 255].
 * Standard ITU-R BT.709 discrete integer clamp.
 */
const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * MatrixCanvas
 * Renders an N×N matrix on an HTML5 canvas scaled to 192×192px.
 * When showText is enabled (sizes <= 16), renders mathematical values directly onto the canvas,
 * completely eliminating thousands of DOM <div> nodes and preventing reflow stutters.
 */
const MatrixCanvas = React.memo(function MatrixCanvas({ data, size, isResidual, showText }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < size * size) return;
    const ctx = canvas.getContext('2d');
    const widthPx = 192;
    const heightPx = 192;
    canvas.width = widthPx;
    canvas.height = heightPx;
    ctx.imageSmoothingEnabled = false;

    const cellSize = widthPx / size;

    if (showText && size <= 16) {
      // High-performance canvas text rendering (eliminates up to 4,096 DOM divs)
      const fontSize = size <= 8 ? 8 : 6;
      ctx.font = `700 ${fontSize}px "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const val = data[y * size + x];
          const pixelVal = isResidual ? clamp8(val + 128) : clamp8(val);
          
          // Cell background
          ctx.fillStyle = `rgb(${pixelVal}, ${pixelVal}, ${pixelVal})`;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

          // Grid hairline border
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);

          // Value text with automatic contrast & zero suppression for residuals
          const isZero = isResidual && val === 0;
          const text = isResidual ? (val > 0 ? `+${val}` : `${val}`) : `${val}`;
          ctx.fillStyle = isZero ? 'rgba(128, 128, 128, 0.45)' : (pixelVal < 128 ? '#FFFFFF' : '#000000');
          ctx.fillText(text, (x + 0.5) * cellSize, (y + 0.5) * cellSize);
        }
      }
    } else {
      // Pure discrete pixel rendering for larger sizes (32, 64) or when numbers are toggled off
      // Direct fillRect rendering eliminates temporary DOM canvas allocations
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const val = data[y * size + x];
          const pixelVal = isResidual ? clamp8(val + 128) : clamp8(val);
          ctx.fillStyle = `rgb(${pixelVal}, ${pixelVal}, ${pixelVal})`;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [data, size, isResidual, showText]);

  return (
    <canvas
      ref={canvasRef}
      className="pixelated"
      style={{
        width: '192px',
        height: '192px',
        display: 'block',
        border: '0.5px solid var(--separator)',
        background: 'var(--apple-canvas)',
        imageRendering: 'pixelated'
      }}
    />
  );
});

/**
 * PixelMicroscope
 * 4-Matrix synchronous microscope (Orig, Pred, Resi, Reco).
 * Adheres strictly to hevc-pixel-accurate-design skill:
 * - Pure monochromatic grayscale for Luma (Y) samples.
 * - Exact 8-bit offset residual display (R' = clamp(R + 128, 0, 255)).
 * - Exact mathematical sample values (zero false color tinting).
 * - Fixed 192×192px viewport across all block sizes (64, 32, 16, 8, 4).
 * - Clean Apple Pro-grade minimalism: zero hover tracking, zero hover clutter.
 */
function PixelMicroscope({
  size,
  origBlock,
  activeEval,
  showValues
}) {
  const currentSize = size || 8;
  const canShowNumbers = showValues && currentSize <= 16;

  const renderMatrix = (data, label, isResidual = false) => {
    const hasData = Boolean(data && data.length >= currentSize * currentSize);

    return (
      <div className="apple-card" style={{
        padding: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
        width: '100%',
        maxWidth: '216px',
        boxSizing: 'border-box'
      }}>
        {/* Header: Label + Static Size Badge */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          alignItems: 'center',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: 'var(--label)'
        }}>
          <span>{label}</span>
          <span style={{
            background: hasData ? 'var(--fill-4)' : 'transparent',
            color: hasData ? 'var(--label-2)' : 'var(--label-3)',
            border: '0.5px solid var(--separator)',
            borderRadius: '3px',
            padding: '1px 5px',
            fontSize: '10px',
            fontWeight: 700
          }}>
            {hasData ? `${currentSize}×${currentSize}` : 'Standby'}
          </span>
        </div>

        {/* 192×192 Matrix Viewport */}
        {hasData ? (
          <MatrixCanvas
            data={data}
            size={currentSize}
            isResidual={isResidual}
            showText={canShowNumbers}
          />
        ) : (
          <div
            style={{
              width: '192px',
              height: '192px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '0.5px solid var(--separator)',
              background: 'var(--fill-4)',
              color: 'var(--apple-label-tertiary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              gap: '4px',
              userSelect: 'none',
              boxSizing: 'border-box'
            }}
          >
            <span>{activeEval?.isTraceRecord ? 'Not recorded in trace' : 'Split CU'}</span>
            <span style={{ fontSize: '9.5px', opacity: 0.7 }}>
              {activeEval?.isTraceRecord ? '[Not evaluated in HM]' : '[Split into 4 Sub-CUs]'}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="apple-card" style={{
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.55rem',
      minWidth: 0
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--label)' }}>
          Pixel Microscope ({currentSize}×{currentSize})
        </span>
        <span style={{
          fontSize: '11px',
          color: 'var(--system-blue)',
          backgroundColor: 'rgba(0, 122, 255, 0.12)',
          padding: '1px 6px',
          borderRadius: '4px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          border: '0.5px solid rgba(0, 122, 255, 0.25)'
        }}>
          {activeEval?.modeName || 'Testing'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.5rem',
        justifyItems: 'center',
        width: '100%'
      }}>
        {renderMatrix(origBlock, 'Original (S)')}
        {renderMatrix(activeEval?.pred, 'Prediction (P)')}
        {renderMatrix(activeEval?.resi, 'Residual (R)', true)}
        {renderMatrix(activeEval?.reco, 'Reconstruction (S\')')}
      </div>
    </div>
  );
}

export default React.memo(PixelMicroscope);
