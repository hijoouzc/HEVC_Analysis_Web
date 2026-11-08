import React, { useState, useMemo } from 'react';
import { Card } from '../../../apple';
import {
  morton2D_16x16,
  inverseMorton2D_16x16,
} from '../../../../utils/tcomDataCUEngine.js';

const DEPTH_PALETTE = {
  0: { bg: 'rgba(245, 158, 11, 0.22)', border: '#f59e0b', text: '#d97706', label: 'D0 (64×64)' },
  1: { bg: 'rgba(16, 185, 129, 0.22)', border: '#10b981', text: '#059669', label: 'D1 (32×32)' },
  2: { bg: 'rgba(59, 130, 246, 0.22)', border: '#3b82f6', text: '#2563eb', label: 'D2 (16×16)' },
  3: { bg: 'rgba(139, 92, 246, 0.22)', border: '#8b5cf6', text: '#7c3aed', label: 'D3 (8×8)' },
  uninit: { bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.25)', text: '#94a3b8', label: 'Init' },
  outOfBounds: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', label: 'Padded' },
};

/**
 * TComDataCUMemoryPanel
 * Dedicated C++ In-Memory Inspector for HM-18.0 TComDataCU.
 * Displays:
 * 1. 256-partition 16x16 Morton Z-Scan Matrix (absZIdxInCtu 0..255).
 * 2. Real-time C++ 1D linear array inspection (m_puhDepth, m_pePartSize, m_pePredMode, m_puhCbf, m_phQP).
 * 3. Spatial Neighbor Pointers (m_pCtuAbove, m_pCtuLeft).
 * 4. HM C++ Lifecycle function call banner.
 */
export default function TComDataCUMemoryPanel({
  currentStep,
  tcomDataCU = null,
  _activeCu = null,
  imageDims = { width: 640, height: 360 },
  ctuX = 0,
  ctuY = 0,
}) {
  const [hoveredZ, setHoveredZ] = useState(null);
  const [viewMode, setViewMode] = useState('zIdx'); // 'zIdx' | 'depth'

  const mortonRange = currentStep?.mortonRange;
  const startZIdx = mortonRange?.startZIdx ?? 0;
  const endZIdx = mortonRange?.endZIdx ?? 255;
  const numParts = mortonRange?.numParts ?? 256;
  const hmLifecycle = currentStep?.hmLifecycle || 'xCompressCU()';
  const neighbors = currentStep?.neighbors || null;

  // Active snapshot: from currentStep or fallback to initial
  const snapshot = currentStep?.tcomDataCUSnapshot || tcomDataCU;

  // Selected cell index for properties inspection
  const inspectedZ = hoveredZ !== null ? hoveredZ : startZIdx;
  const inspectedCoords = useMemo(() => inverseMorton2D_16x16(inspectedZ), [inspectedZ]);
  const inspectedDepth = snapshot?.m_puhDepth ? snapshot.m_puhDepth[inspectedZ] : 0;
  const inspectedPartSize = snapshot?.m_pePartSize ? snapshot.m_pePartSize[inspectedZ] : 'SIZE_2Nx2N';
  const inspectedPredMode = snapshot?.m_pePredMode ? snapshot.m_pePredMode[inspectedZ] : 'MODE_INTRA';
  const inspectedCbf = snapshot?.m_puhCbf ? snapshot.m_puhCbf[inspectedZ] : 0;
  const inspectedQP = snapshot?.m_phQP ? snapshot.m_phQP[inspectedZ] : 32;
  const inspectedIntraDir = snapshot?.m_puhIntraDir ? snapshot.m_puhIntraDir[inspectedZ] : 0;

  // Build the 16x16 raster matrix mapped to Morton Z-indexes
  const matrixCells = useMemo(() => {
    const cells = [];
    for (let uy = 0; uy < 16; uy++) {
      for (let ux = 0; ux < 16; ux++) {
        const z = morton2D_16x16(ux, uy);
        const depth = snapshot?.m_puhDepth ? snapshot.m_puhDepth[z] : 0;
        const isActive = z >= startZIdx && z <= endZIdx;

        // Check if this unit is outside physical image boundary
        const pixelX = (ctuX * 64) + (ux * 4);
        const pixelY = (ctuY * 64) + (uy * 4);
        const isOutOfBounds = (pixelX >= imageDims.width) || (pixelY >= imageDims.height);

        cells.push({
          z,
          ux,
          uy,
          depth,
          isActive,
          isOutOfBounds,
        });
      }
    }
    return cells;
  }, [snapshot, startZIdx, endZIdx, ctuX, ctuY, imageDims]);

  return (
    <Card style={{
      padding: '0.85rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.65rem',
      minWidth: 0,
      boxSizing: 'border-box',
      backgroundColor: 'var(--window-background)',
    }}>
      {/* Header & Ownership Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label)' }}>
            TComDataCU Memory Map
          </span>
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '1px 6px',
            borderRadius: '4px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--system-blue)',
            border: '0.5px solid rgba(59, 130, 246, 0.25)',
          }}>
            m_pictureCtuArray[{snapshot?.m_ctuRsAddr ?? 0}]
          </span>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--control-background)', padding: '2px', borderRadius: '4px' }}>
          <button
            type="button"
            onClick={() => setViewMode('zIdx')}
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              backgroundColor: viewMode === 'zIdx' ? 'var(--system-blue)' : 'transparent',
              color: viewMode === 'zIdx' ? '#fff' : 'var(--secondary-label)',
              fontWeight: viewMode === 'zIdx' ? 700 : 500,
            }}
          >
            Z-Idx
          </button>
          <button
            type="button"
            onClick={() => setViewMode('depth')}
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              backgroundColor: viewMode === 'depth' ? 'var(--system-blue)' : 'transparent',
              color: viewMode === 'depth' ? '#fff' : 'var(--secondary-label)',
              fontWeight: viewMode === 'depth' ? 700 : 500,
            }}
          >
            Depth
          </button>
        </div>
      </div>

      {/* HM C++ Lifecycle execution call banner */}
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        border: '0.5px solid rgba(0, 0, 0, 0.08)',
        borderRadius: '5px',
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--tertiary-label)', textTransform: 'uppercase' }}>HM Call:</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--label)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {hmLifecycle}
        </span>
      </div>

      {/* 16x16 Morton Z-Order Grid (256 units of 4x4) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--secondary-label)' }}>
            256 Partitions (16×16 Grid of 4×4 units in Morton Scan)
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--tertiary-label)' }}>
            Active: [{startZIdx}..{endZIdx}] ({numParts} units)
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(16, 1fr)',
            gap: '1px',
            backgroundColor: 'rgba(0, 0, 0, 0.12)',
            padding: '2px',
            borderRadius: '4px',
            aspectRatio: '1 / 1',
            maxHeight: '230px',
            userSelect: 'none',
          }}
          onMouseLeave={() => setHoveredZ(null)}
        >
          {matrixCells.map(cell => {
            const conf = cell.isOutOfBounds
              ? DEPTH_PALETTE.outOfBounds
              : (DEPTH_PALETTE[cell.depth] || DEPTH_PALETTE.uninit);

            const isCurrentHover = hoveredZ === cell.z;

            return (
              <div
                key={cell.z}
                onMouseEnter={() => setHoveredZ(cell.z)}
                title={`absZIdx: ${cell.z} (ux:${cell.ux}, uy:${cell.uy}) | Depth: ${cell.depth}`}
                style={{
                  backgroundColor: cell.isActive
                    ? (isCurrentHover ? '#38bdf8' : conf.border)
                    : conf.bg,
                  color: cell.isActive ? '#ffffff' : conf.text,
                  border: isCurrentHover
                    ? '1px solid #ffffff'
                    : (cell.isActive ? '0.5px solid rgba(255,255,255,0.7)' : '0.5px solid transparent'),
                  boxShadow: cell.isActive ? '0 0 3px rgba(0, 122, 255, 0.5)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '7px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: cell.isActive ? 800 : 500,
                  cursor: 'pointer',
                  transition: 'background-color 80ms ease',
                }}
              >
                {viewMode === 'zIdx' ? cell.z : cell.depth}
              </div>
            );
          })}
        </div>
      </div>

      {/* C++ Member Variable Property Inspector */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        border: '0.5px solid rgba(0, 0, 0, 0.06)',
        borderRadius: '6px',
        padding: '6px 8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(0, 0, 0, 0.06)', paddingBottom: '3px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--label)' }}>
            Property Inspector for absZIdx = {inspectedZ}
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>
            Pos ({inspectedCoords.ux * 4}, {inspectedCoords.uy * 4})
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 10px', fontSize: '11px', marginTop: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>m_puhDepth:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: DEPTH_PALETTE[inspectedDepth]?.border }}>
              {inspectedDepth} ({64 >> inspectedDepth}×{64 >> inspectedDepth})
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>m_pePartSize:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--label)' }}>
              {inspectedPartSize}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>m_pePredMode:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--label)' }}>
              {inspectedPredMode}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>m_puhCbf:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: inspectedCbf > 0 ? '#10b981' : 'var(--tertiary-label)' }}>
              {inspectedCbf}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>m_phQP:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--label)' }}>
              {inspectedQP}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>m_puhIntraDir:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--system-blue)' }}>
              Mode {inspectedIntraDir}
            </span>
          </div>
        </div>

        {/* Spatial Neighbor Pointers (m_pCtuAbove, m_pCtuLeft) */}
        {neighbors && (
          <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '0.5px solid rgba(0, 0, 0, 0.06)', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>m_pCtuAbove:</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: neighbors.above.available ? '#10b981' : '#ef4444',
              }}>
                {neighbors.above.label} [{neighbors.above.available ? 'AVAILABLE' : 'UNAVAILABLE'}]
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary-label)' }}>m_pCtuLeft:</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: neighbors.left.available ? '#10b981' : '#ef4444',
              }}>
                {neighbors.left.label} [{neighbors.left.available ? 'AVAILABLE' : 'UNAVAILABLE'}]
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
