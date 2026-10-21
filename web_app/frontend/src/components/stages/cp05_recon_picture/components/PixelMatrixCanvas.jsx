import React, { useState, useEffect, useRef } from 'react';
import { bt709YuvToRgb } from '../../../../utils/colorUtils';

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
  channel = 'Y',
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
        if (channel === 'Cb' || channel === 'U') {
          const { r, g, b } = bt709YuvToRgb(128, clamped, 128);
          data[off] = r;
          data[off + 1] = g;
          data[off + 2] = b;
        } else if (channel === 'Cr' || channel === 'V') {
          const { r, g, b } = bt709YuvToRgb(128, 128, clamped);
          data[off] = r;
          data[off + 1] = g;
          data[off + 2] = b;
        } else {
          data[off] = clamped;
          data[off + 1] = clamped;
          data[off + 2] = clamped;
        }
        data[off + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [dataArray, size, type, resiGain, isDarkTheme, channel]);

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

export default React.memo(PixelMatrixCanvas);
