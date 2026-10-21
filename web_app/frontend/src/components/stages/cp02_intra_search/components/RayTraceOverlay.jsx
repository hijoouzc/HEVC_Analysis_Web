import React from 'react';
import { SELECTION_HIGHLIGHT_COLOR } from '../../../../utils/colorUtils';

/**
 * Computes ray start and end coordinates connected strictly to cell borders,
 * ensuring the ray line never crosses the center and never obscures cell numbers.
 */
const getRayBorderEndpoints = (ref, activeCoord, stageGridCellSize) => {
  if (!ref || !activeCoord || !stageGridCellSize || stageGridCellSize <= 0) {
    return { x1: 0, y1: 0, x2: 0, y2: 0 };
  }
  const refIndex = Number.isFinite(ref.index) ? ref.index : 0;
  const Xmin = stageGridCellSize * (activeCoord.x + 1);
  const Xmax = stageGridCellSize * (activeCoord.x + 2);
  const Ymin = stageGridCellSize * (activeCoord.y + 1);
  const Ymax = stageGridCellSize * (activeCoord.y + 2);
  const Xmid = (Xmin + Xmax) / 2;
  const Ymid = (Ymin + Ymax) / 2;

  let x1, y1;
  if (ref.type === 'top') {
    // Start at bottom border of top reference cell (row 0)
    x1 = stageGridCellSize * refIndex + stageGridCellSize / 2;
    y1 = stageGridCellSize;
  } else {
    // Start at right border of left reference cell (column 0)
    x1 = stageGridCellSize;
    y1 = stageGridCellSize * refIndex + stageGridCellSize / 2;
  }

  const dx = Xmid - x1;
  const dy = Ymid - y1;

  let x2 = Xmid;
  let y2 = Ymid;

  const candidates = [];

  if (Math.abs(dy) > 1e-4) {
    const tTop = (Ymin - y1) / dy;
    if (tTop >= -1e-4 && tTop <= 1.01) {
      const xAtTop = x1 + tTop * dx;
      if (xAtTop >= Xmin - 0.5 && xAtTop <= Xmax + 0.5) {
        candidates.push({ t: Math.max(0, tTop), x: Math.max(Xmin, Math.min(Xmax, xAtTop)), y: Ymin });
      }
    }
    const tBottom = (Ymax - y1) / dy;
    if (tBottom >= -1e-4 && tBottom <= 1.01) {
      const xAtBottom = x1 + tBottom * dx;
      if (xAtBottom >= Xmin - 0.5 && xAtBottom <= Xmax + 0.5) {
        candidates.push({ t: Math.max(0, tBottom), x: Math.max(Xmin, Math.min(Xmax, xAtBottom)), y: Ymax });
      }
    }
  }

  if (Math.abs(dx) > 1e-4) {
    const tLeft = (Xmin - x1) / dx;
    if (tLeft >= -1e-4 && tLeft <= 1.01) {
      const yAtLeft = y1 + tLeft * dy;
      if (yAtLeft >= Ymin - 0.5 && yAtLeft <= Ymax + 0.5) {
        candidates.push({ t: Math.max(0, tLeft), x: Xmin, y: Math.max(Ymin, Math.min(Ymax, yAtLeft)) });
      }
    }
    const tRight = (Xmax - x1) / dx;
    if (tRight >= -1e-4 && tRight <= 1.01) {
      const yAtRight = y1 + tRight * dy;
      if (yAtRight >= Ymin - 0.5 && yAtRight <= Ymax + 0.5) {
        candidates.push({ t: Math.max(0, tRight), x: Xmax, y: Math.max(Ymin, Math.min(Ymax, yAtRight)) });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.t - b.t);
    x2 = candidates[0].x;
    y2 = candidates[0].y;
  }

  return { x1, y1, x2, y2 };
};

/**
 * RayTraceOverlay: SVG layer rendering directional prediction rays
 * from reference samples to the selected pixel inside the PU.
 */
const RayTraceOverlay = ({
  selectedPixel,
  activeCoord,
  trace,
  stageGridSize,
  stageGridCellSize,
  highlightColor = SELECTION_HIGHLIGHT_COLOR,
}) => {
  if (!selectedPixel || !activeCoord || !trace) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: stageGridSize,
        height: stageGridSize,
        pointerEvents: 'none',
        zIndex: 14,
      }}
    >
      {trace.refs.map((ref, idx) => {
        const { x1, y1, x2, y2 } = getRayBorderEndpoints(ref, activeCoord, stageGridCellSize);
        if (Math.hypot(x2 - x1, y2 - y1) < 1.0) return null;
        return (
          <line
            key={idx}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={highlightColor}
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
};

export default React.memo(RayTraceOverlay);
