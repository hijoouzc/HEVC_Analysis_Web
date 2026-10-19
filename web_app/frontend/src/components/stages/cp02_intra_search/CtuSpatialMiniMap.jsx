import React, { useMemo, useCallback } from 'react';
import {
  getRelativeCuCoords,
  getZIndexForBlock,
  getBlockCoordsForZIndex,
  getTotalBlocksForSize,
  getQuadrantLabel,
} from '../../../utils/zScanUtils';
import { SELECTION_HIGHLIGHT_COLOR } from '../../../utils/colorUtils';
import { Button, Badge } from '../../apple';

/**
 * CtuSpatialMiniMap
 *
 * Professional-grade interactive CTU Spatial Reticle & Mini-Map for HEVC Intra Prediction.
 * Solves the "blind CU selection" problem by providing 100% spatial transparency:
 * - 64×64: 1x1 whole CTU
 * - 32×32: 2x2 grid (4 quadrants: TL 0, TR 1, BL 2, BR 3)
 * - 16×16: 4x4 grid (16 sub-blocks in Z-scan order)
 * - 8×8:   8x8 grid (64 sub-blocks)
 * - 4×4:   4 sub-PUs inside active 8×8 block
 *
 * Adheres strictly to:
 * - ITU-T H.265 Section 6.4.1 (Morton Z-Scan order)
 * - Apple macOS Tahoe Pro-Grade Minimalism (solid borders, click-only, zero emoji icons)
 */
export default function CtuSpatialMiniMap({
  ctuX = 0,
  ctuY = 0,
  blockSize = 8,
  selectedCu = null,
  partitionData = null,
  onSelectBlock = null,
  _onSelectSize = null,
}) {
  const currentSize = Math.max(4, Math.min(64, blockSize || 8));
  const { relX: currentRelX, relY: currentRelY, absX: currentAbsX, absY: currentAbsY } = useMemo(() => {
    return getRelativeCuCoords(selectedCu, ctuX, ctuY);
  }, [selectedCu, ctuX, ctuY]);

  const totalBlocks = useMemo(() => getTotalBlocksForSize(currentSize), [currentSize]);
  const currentZIndex = useMemo(() => {
    return getZIndexForBlock(currentRelX, currentRelY, currentSize);
  }, [currentRelX, currentRelY, currentSize]);

  // Extract real leaf CUs from partitionData if available
  const leafNodes = useMemo(() => {
    if (!partitionData || !Array.isArray(partitionData.nodes)) return [];
    const ctuOriginX = ctuX * 64;
    const ctuOriginY = ctuY * 64;

    return partitionData.nodes
      .filter((n) => !n.split)
      .map((n) => {
        const nx = typeof n.x === 'number' ? n.x : 0;
        const ny = typeof n.y === 'number' ? n.y : 0;
        let rx = nx >= ctuOriginX && nx < ctuOriginX + 64 ? nx - ctuOriginX : (nx < 64 ? nx : nx % 64);
        let ry = ny >= ctuOriginY && ny < ctuOriginY + 64 ? ny - ctuOriginY : (ny < 64 ? ny : ny % 64);
        return {
          ...n,
          relX: rx,
          relY: ry,
          width: n.width || 8,
          height: n.height || 8,
        };
      });
  }, [partitionData, ctuX, ctuY]);

  // Check if current selected block matches a real encoded Leaf CU
  const matchingLeaf = useMemo(() => {
    return leafNodes.find(
      (leaf) =>
        leaf.relX === currentRelX &&
        leaf.relY === currentRelY &&
        leaf.width === currentSize
    );
  }, [leafNodes, currentRelX, currentRelY, currentSize]);

  // Generate candidate blocks list for current size
  const candidateBlocks = useMemo(() => {
    const blocks = [];
    for (let z = 0; z < totalBlocks; z++) {
      const { relX, relY } = getBlockCoordsForZIndex(z, currentSize);
      const isSelected = (relX === currentRelX && relY === currentRelY);
      const isRealLeaf = leafNodes.some(
        (l) => l.relX === relX && l.relY === relY && l.width === currentSize
      );
      blocks.push({
        z,
        relX,
        relY,
        isSelected,
        isRealLeaf,
      });
    }
    return blocks;
  }, [totalBlocks, currentSize, currentRelX, currentRelY, leafNodes]);

  const handleCellClick = useCallback(
    (relX, relY) => {
      if (!onSelectBlock) return;
      const absX = ctuX * 64 + relX;
      const absY = ctuY * 64 + relY;
      onSelectBlock({
        size: currentSize,
        relX,
        relY,
        absX,
        absY,
        cu: {
          x: relX,
          y: relY,
          abs_x: absX,
          abs_y: absY,
          width: currentSize,
          height: currentSize,
          size: currentSize,
        },
      });
    },
    [ctuX, ctuY, currentSize, onSelectBlock]
  );

  const handleStepBlock = useCallback(
    (direction) => {
      const newZ = Math.max(0, Math.min(totalBlocks - 1, currentZIndex + direction));
      if (newZ === currentZIndex) return;
      const { relX, relY } = getBlockCoordsForZIndex(newZ, currentSize);
      handleCellClick(relX, relY);
    },
    [totalBlocks, currentZIndex, currentSize, handleCellClick]
  );

  const quadrantText = getQuadrantLabel(currentRelX, currentRelY, currentSize);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--apple-canvas, #1C1C1E)',
        border: '1px solid var(--apple-hairline, rgba(255, 255, 255, 0.15))',
        borderRadius: '6px',
        padding: '6px 10px',
        boxSizing: 'border-box',
        userSelect: 'none',
        flexWrap: 'nowrap',
        height: '84px',
        minHeight: '84px',
        maxHeight: '84px',
        flexShrink: 0
      }}
    >
      {/* 1. Interactive 64x64 SVG Canvas Reticle (72px) */}
      <div
        style={{
          position: 'relative',
          width: '72px',
          height: '72px',
          background: '#0F0F11',
          border: '1px solid var(--apple-hairline, rgba(255, 255, 255, 0.2))',
          borderRadius: '3px',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        title={`CTU (64×64) Spatial Map • Click any ${currentSize}×${currentSize} block to inspect`}
      >
        <svg
          viewBox="0 0 64 64"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        >
          {/* Layer 1: Real QuadTree Boundaries (subtle background guide) */}
          {leafNodes.map((leaf, idx) => (
            <rect
              key={`leaf-guide-${idx}`}
              x={leaf.relX}
              y={leaf.relY}
              width={leaf.width}
              height={leaf.height}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="0.5"
            />
          ))}

          {/* Layer 2: Interactive Candidate Blocks for current size */}
          {candidateBlocks.map(({ z, relX, relY, isSelected, isRealLeaf }) => {
            const fillColor = isSelected
              ? 'rgba(245, 158, 11, 0.38)'
              : isRealLeaf
              ? 'rgba(52, 199, 89, 0.12)'
              : 'rgba(255, 255, 255, 0.03)';
            const strokeColor = isSelected
              ? SELECTION_HIGHLIGHT_COLOR
              : isRealLeaf
              ? 'rgba(52, 199, 89, 0.45)'
              : 'rgba(255, 255, 255, 0.18)';
            const strokeWidth = isSelected ? 1.5 : 0.5;

            return (
              <g
                key={`block-${z}`}
                onClick={() => handleCellClick(relX, relY)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={relX}
                  y={relY}
                  width={currentSize}
                  height={currentSize}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />

                {/* Show Z-index number for 32x32 (large) and 16x16 (medium) */}
                {currentSize === 32 && (
                  <text
                    x={relX + 16}
                    y={relY + 20}
                    textAnchor="middle"
                    fill={isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'}
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    pointerEvents="none"
                  >
                    {z}
                  </text>
                )}

                {currentSize === 16 && (
                  <text
                    x={relX + 8}
                    y={relY + 11}
                    textAnchor="middle"
                    fill={isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)'}
                    fontSize="7"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    pointerEvents="none"
                  >
                    {z}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 2. Block Info & Spatial Breadcrumb */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '165px', maxWidth: '165px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--apple-label-secondary)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono' }}>
            Position
          </span>
          <Badge variant={matchingLeaf ? 'green' : 'blue'}>
            {matchingLeaf ? 'Leaf CU' : 'RDO Trial'}
          </Badge>
        </div>

        <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--apple-label)' }}>
          {currentSize}×{currentSize} &bull; {quadrantText}
        </div>

        <div style={{ fontSize: '10px', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
          Rel [{currentRelX}, {currentRelY}] &bull; Abs ({currentAbsX}, {currentAbsY})
        </div>
      </div>

      {/* 3. Sequential Stepper Buttons (Morton Z-Scan Order) */}
      {totalBlocks > 1 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <Button
            variant="gray"
            size="small"
            disabled={currentZIndex === 0}
            onClick={() => handleStepBlock(-1)}
            title="Previous Block in Z-Scan Order"
            style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', padding: '0 6px', height: '26px' }}
          >
            ◀ Prev
          </Button>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--apple-label-secondary)',
              padding: '0 4px',
              minWidth: '42px',
              textAlign: 'center',
              display: 'inline-block'
            }}
          >
            {currentZIndex + 1}/{totalBlocks}
          </span>
          <Button
            variant="gray"
            size="small"
            disabled={currentZIndex >= totalBlocks - 1}
            onClick={() => handleStepBlock(1)}
            title="Next Block in Z-Scan Order"
            style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', padding: '0 6px', height: '26px' }}
          >
            Next ▶
          </Button>
        </div>
      )}
    </div>
  );
}
