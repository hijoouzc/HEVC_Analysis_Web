import React, { useState, useMemo } from 'react';
import { HEVC_DEPTH_COLORS } from '../../../../utils/colorUtils';
import QuadtreeHierarchyGraph from '../../../common/QuadtreeHierarchyGraph';
import { buildSimulatorQuadtreeTree } from '../../../../utils/quadtreeTreeLayout';

const QUADRANT_NAMES = ['TL (0)', 'TR (1)', 'BL (2)', 'BR (3)'];

/**
 * TreeCallStack
 * Dual-view visualization of the recursive QuadTree call stack:
 * 1. Interactive QuadTree Hierarchy Graph (Vector SVG showing dynamic branches & RDO state)
 * 2. Compact Call Stack Badges (Z-scan order k=0..3)
 */
export default function TreeCallStack({
  treeSnapshot,
  activeNodeId,
  callStack = [],
  onExportDrawio = null
}) {
  const [viewMode, setViewMode] = useState('tree'); // 'tree' (Graph) or 'stack' (Badges)
  const rawNodes = Object.values(treeSnapshot || {});

  // Build clean progressive quadtree for the simulator
  const simTree = useMemo(() => {
    return buildSimulatorQuadtreeTree(treeSnapshot, activeNodeId, callStack);
  }, [treeSnapshot, activeNodeId, callStack]);

  return (
    <div className="apple-card" style={{
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--apple-label)' }}>
            QuadTree Call Stack
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
            D0 (64) → D3 (8)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* View Toggle */}
          <div className="apple-segmented">
            <button
              type="button"
              className={`apple-segmented-item ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
              title="Interactive Tree Graph"
            >
              Tree Graph
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${viewMode === 'stack' ? 'active' : ''}`}
              onClick={() => setViewMode('stack')}
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
              title="Compact Stack Badges"
            >
              Stack
            </button>
          </div>

          {onExportDrawio && (
            <button
              type="button"
              className="apple-btn-secondary"
              onClick={onExportDrawio}
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
              title="Export Current Simulation State to Draw.io XML"
            >
              [+] Draw.io
            </button>
          )}
        </div>
      </div>

      {/* View 1: Interactive QuadTree Hierarchy Graph */}
      {viewMode === 'tree' ? (
        <div style={{ width: '100%' }}>
          <QuadtreeHierarchyGraph
            treeRoot={simTree}
            activeNodeId={activeNodeId}
            showCost={true}
            showMode={true}
          />
        </div>
      ) : (
        /* View 2: Compact Stack Badges */
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.45rem',
          maxHeight: '220px',
          overflowY: 'auto',
          padding: '0.45rem',
          background: 'var(--apple-canvas)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: '6px'
        }}>
          {rawNodes.map((n) => {
            const isActive = n.id === activeNodeId;
            const dColor = HEVC_DEPTH_COLORS[n.depth] || HEVC_DEPTH_COLORS[0];

            let borderColor = dColor.border;
            let bgColor = dColor.bg;

            if (isActive) {
              borderColor = '#FF9500';
              bgColor = 'rgba(255, 149, 0, 0.12)';
            } else if (n.status === 'LEAF') {
              borderColor = '#34C759';
              bgColor = 'rgba(52, 199, 89, 0.1)';
            } else if (n.status === 'SPLIT') {
              borderColor = '#007AFF';
              bgColor = 'rgba(0, 122, 255, 0.1)';
            }

            return (
              <div
                key={n.id}
                style={{
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  borderRadius: '6px',
                  padding: '0.35rem 0.55rem',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.68rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem',
                  boxShadow: isActive ? '0 0 0 1.5px #FF9500' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 800, color: 'var(--apple-label)' }}>D{n.depth}: {n.size}×{n.size}</span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--apple-label-secondary)' }}>
                    {n.childIndex !== undefined ? QUADRANT_NAMES[n.childIndex] : `(${n.x},${n.y})`}
                  </span>
                </div>

                <div style={{ fontSize: '0.62rem', color: 'var(--apple-label)' }}>
                  {n.bestMode ? n.bestMode.modeName : 'Testing'}
                </div>

                <div style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: n.status === 'SPLIT' ? '#007AFF' : n.status === 'LEAF' ? '#34C759' : '#FF9500'
                }}>
                  {n.status}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
