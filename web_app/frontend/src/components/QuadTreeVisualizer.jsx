import React, { useState } from 'react';
import { getIntraModeInfo, HEVC_DEPTH_COLORS, HEVC_MODE_COLORS } from '../utils/colorUtils';
import HmSourceCodeModal from './common/HmSourceCodeModal';
import DrawioExportModal from './common/DrawioExportModal';
import QuadtreeHierarchyGraph from './common/QuadtreeHierarchyGraph';
import { HM_QUADTREE_RDO_SNIPPET } from '../constants/hmSourceSnippets';

/**
 * QuadTreeVisualizer (CP_01_PARTITION)
 * Renders the recursive CTU Quadtree partitioning structure down to leaf CUs
 */
export default function QuadTreeVisualizer({
  partitionData = null,
  ctuX = 0,
  ctuY = 0,
  imageSrc = null,
  imageDims = { width: 640, height: 360 },
  selectedCU = null,
  onSelectCU = null,
  onNavigateToIntra = null,
  onBackToFrame = null,
  onNavigateToSim = null
}) {
  const [selectedNode, setSelectedNode] = useState(undefined); // undefined: initial load, null: explicitly deselected
  const [colorScheme, setColorScheme] = useState('outline'); // 'outline' (default: clean transparent, no mode overlay), 'mode', 'depth'
  const [textureMode, setTextureMode] = useState('color'); // 'color', 'grayscale', 'off'
  const [viewLayout, setViewLayout] = useState('dual'); // 'dual' (side-by-side), '2d' (spatial grid only), 'tree' (quadtree graph only)
  const [showHmModal, setShowHmModal] = useState(false);
  const [showDrawioModal, setShowDrawioModal] = useState(false);

  if (!partitionData || !partitionData.nodes || partitionData.nodes.length === 0) {
    return (
      <div className="apple-card" style={{ padding: '2rem', textAlign: 'center', background: 'var(--apple-canvas)' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--apple-label)' }}>CP_01: CTU QuadTree Partitioning</h3>
        <p style={{ color: 'var(--apple-label-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          No partition trace data available for CTU ({ctuX ?? 0}, {ctuY ?? 0}). Encode an image to view the quadtree hierarchy or explore via simulator.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {onBackToFrame && (
            <button
              type="button"
              className="apple-btn-secondary"
              onClick={onBackToFrame}
            >
              ← Return to CTU Grid
            </button>
          )}
          {onNavigateToSim && (
            <button
              type="button"
              className="apple-btn-primary"
              onClick={onNavigateToSim}
            >
              Launch RDO Simulator →
            </button>
          )}
        </div>
      </div>
    );
  }

  const { nodes, leaf_nodes, max_depth } = partitionData;

  // Base CTU offset in pixels safely determined from partitionData or props
  const targetCtuX = partitionData.ctu_x !== undefined ? partitionData.ctu_x : ctuX;
  const targetCtuY = partitionData.ctu_y !== undefined ? partitionData.ctu_y : ctuY;
  const ctuPixelX = targetCtuX * 64;
  const ctuPixelY = targetCtuY * 64;

  const leafNodes = nodes.filter(n => !n.split);
  const splitNodes = nodes.filter(n => n.split);

  // Depth color palettes matching H.265 quadtree hierarchy
  const depthColors = HEVC_DEPTH_COLORS;

  // Prediction Mode color palettes (H.265 standard)
  const modeColors = HEVC_MODE_COLORS;

  // Safe relative coordinate helper eliminating NaN and coordinate misalignment
  const getSafeRelCoord = (val, basePixel) => {
    if (typeof val !== 'number' || isNaN(val)) return 0;
    if (val >= basePixel && val < basePixel + 64) {
      return val - basePixel;
    }
    if (val < 64) {
      return val;
    }
    return val % 64;
  };

  const activeNode = (() => {
    if (selectedNode !== undefined) {
      if (selectedNode === null) return null; // Explicitly deselected
      const found = leafNodes.find(n => n.x === selectedNode.x && n.y === selectedNode.y && n.width === selectedNode.width);
      return found || null;
    }
    if (selectedCU) {
      const found = leafNodes.find(n => n.x === selectedCU.x && n.y === selectedCU.y && n.width === selectedCU.width);
      if (found) return found;
    }
    return leafNodes.find(n => n.width === 8) || leafNodes[0] || null;
  })();

  // Click handler: click once to select, click again to deselect
  const handleCuClick = (node) => {
    const isCurrentlyActive = activeNode && activeNode.x === node.x && activeNode.y === node.y && activeNode.width === node.width;
    if (isCurrentlyActive) {
      setSelectedNode(null);
      if (onSelectCU) onSelectCU(null);
    } else {
      setSelectedNode(node);
      if (onSelectCU) onSelectCU(node);
    }
  };

  const activeSafeRelX = activeNode ? getSafeRelCoord(activeNode.x, ctuPixelX) : 0;
  const activeSafeRelY = activeNode ? getSafeRelCoord(activeNode.y, ctuPixelY) : 0;
  const activeAbsX = ctuPixelX + activeSafeRelX;
  const activeAbsY = ctuPixelY + activeSafeRelY;
  const activeW = (activeNode && activeNode.width > 0) ? activeNode.width : 64;
  const activeH = (activeNode && activeNode.height > 0) ? activeNode.height : 64;

  const cropBoxSize = 240;

  return (
    <div className="quadtree-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Navigation & Level Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onBackToFrame && (
            <button
              type="button"
              className="apple-btn-secondary"
              onClick={onBackToFrame}
              title="Return to full frame view"
            >
              ← Frame View
            </button>
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'var(--apple-label)' }}>
            CTU ({targetCtuX}, {targetCtuY}) QuadTree
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Segmented: [ Dual View | 2D Grid | Tree Graph ] */}
          <div className="apple-segmented">
            <button
              type="button"
              className={`apple-segmented-item ${viewLayout === 'dual' ? 'active' : ''}`}
              onClick={() => setViewLayout('dual')}
              title="View 2D Grid and QuadTree Graph Side-by-Side"
            >
              Dual View
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${viewLayout === '2d' ? 'active' : ''}`}
              onClick={() => setViewLayout('2d')}
              title="View 2D Spatial Partition Grid Only"
            >
              2D Grid
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${viewLayout === 'tree' ? 'active' : ''}`}
              onClick={() => setViewLayout('tree')}
              title="View QuadTree Hierarchical Graph Only"
            >
              Tree Graph
            </button>
          </div>

          {/* Export Draw.io Button */}
          <button
            type="button"
            className="apple-btn-secondary"
            onClick={() => setShowDrawioModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="Export / Copy Draw.io XML for this CTU QuadTree"
          >
            <span>[+]</span>
            <span>Draw.io XML</span>
          </button>

          <button
            type="button"
            className="apple-btn-secondary"
            onClick={() => setShowHmModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="Inspect HM-16.0 C++ Source Code for xCompressCU QuadTree"
          >
            <span>&lt;&gt;</span>
            <span>Show HM Code</span>
          </button>

          {onNavigateToSim && (
            <button
              type="button"
              className="apple-btn-primary"
              onClick={onNavigateToSim}
              title="Open RDO Simulator"
            >
              RDO Simulator →
            </button>
          )}

          {onNavigateToIntra && (
            activeNode ? (
              <button
                type="button"
                className="apple-btn-primary"
                onClick={() => {
                  if (activeNode.width === 8) {
                    onNavigateToIntra(activeNode);
                  }
                }}
                disabled={activeNode.width !== 8}
                style={{
                  background: activeNode.width === 8 ? 'var(--apple-purple, #AF52DE)' : '#94A3B8',
                  cursor: activeNode.width === 8 ? 'pointer' : 'not-allowed',
                  opacity: activeNode.width === 8 ? 1 : 0.7
                }}
                title={activeNode.width === 8 ? "Inspect 8×8 Intra Prediction Flow" : "Intra prediction pipeline is strictly available for 8×8 block inspection"}
              >
                {activeNode.width === 8 ? 'Inspect Intra (8×8) →' : `8×8 Only (${activeW}×${activeH})`}
              </button>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                No CU selected
              </span>
            )
          )}
        </div>
      </div>

      {/* Top Stats Banner */}
      <div className="apple-card" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem',
        padding: '0.85rem 1.25rem'
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--apple-label-secondary)', fontWeight: 700 }}>CTU Target</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--apple-label)' }}>({targetCtuX}, {targetCtuY})</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--apple-label-secondary)', fontWeight: 700 }}>Leaf CUs</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--apple-blue)' }}>{leaf_nodes || leafNodes.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--apple-label-secondary)', fontWeight: 700 }}>Max Depth</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--apple-orange, #FF9500)' }}>{max_depth} / 3</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--apple-label-secondary)', fontWeight: 700 }}>CU Size Range</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--apple-label)' }}>64 → 8 px</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--apple-label-secondary)' }}>Color Overlay:</span>
          <div className="apple-segmented">
            <button
              type="button"
              className={`apple-segmented-item ${colorScheme === 'outline' ? 'active' : ''}`}
              onClick={() => setColorScheme('outline')}
              title="Clean transparent CU partition lines with NO mode color overlay"
            >
              None
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${colorScheme === 'mode' ? 'active' : ''}`}
              onClick={() => setColorScheme('mode')}
              title="Prediction Modes cell overlay: INTRA / INTER / SKIP"
            >
              Mode
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${colorScheme === 'depth' ? 'active' : ''}`}
              onClick={() => setColorScheme('depth')}
              title="Quadtree Depth levels overlay: D0..D3"
            >
              Depth
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--apple-label-secondary)' }}>Texture:</span>
          <button
            type="button"
            className="apple-btn-secondary"
            onClick={() => setTextureMode(m => m === 'color' ? 'grayscale' : m === 'grayscale' ? 'off' : 'color')}
            title="Toggle CTU block texture: COLOR / GRAYSCALE / OFF"
          >
            {textureMode === 'color' ? 'COLOR' : textureMode === 'grayscale' ? 'GRAY' : 'OFF'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--apple-label-secondary)' }}>Pred Modes:</span>
          <button
            type="button"
            className="apple-btn-secondary"
            onClick={() => setColorScheme(c => c === 'mode' ? 'outline' : 'mode')}
            title="Toggle PRED MODES cell overlay (INTRA, INTER, SKIP) ON / OFF"
          >
            {colorScheme === 'mode' ? 'OVERLAY: ON' : 'OVERLAY: OFF'}
          </button>
        </div>
      </div>

      {/* Top Section: 2D Spatial Partition & CU Inspector */}
      {(viewLayout === '2d' || viewLayout === 'dual') && (
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Interactive 64x64 Quadtree Canvas */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            width: '460px',
            maxWidth: '100%',
            flex: '0 0 auto'
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--apple-label)' }}>
              CTU (64×64) Coding Quadtree Partition
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '480px',
              aspectRatio: '1 / 1',
              background: '#0F172A',
              border: '1px solid var(--apple-hairline)',
              borderRadius: 0,
              boxShadow: 'none',
              userSelect: 'none',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            {/* Real CTU 64x64 Image Texture Layer */}
            {imageSrc && textureMode !== 'off' && (
              <svg
                viewBox="0 0 64 64"
                preserveAspectRatio="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 0
                }}
              >
                <image
                  href={imageSrc}
                  x={-ctuPixelX}
                  y={-ctuPixelY}
                  width={imageDims?.width || 640}
                  height={imageDims?.height || 360}
                  preserveAspectRatio="none"
                  style={{
                    imageRendering: 'pixelated',
                    filter: textureMode === 'grayscale' ? 'grayscale(100%)' : 'none'
                  }}
                />
              </svg>
            )}

            {/* Split boundary indicators (subtle guide lines) */}
            {splitNodes.map((s, idx) => {
              const safeRelX = getSafeRelCoord(s.x, ctuPixelX);
              const safeRelY = getSafeRelCoord(s.y, ctuPixelY);
              const relX = (safeRelX / 64) * 100;
              const relY = (safeRelY / 64) * 100;
              const w = ((s.width || 64) / 64) * 100;
              const h = ((s.height || 64) / 64) * 100;
              return (
                <div
                  key={`split-${idx}`}
                  style={{
                    position: 'absolute',
                    left: `${relX}%`,
                    top: `${relY}%`,
                    width: `${w}%`,
                    height: `${h}%`,
                    border: '1px dashed rgba(255, 255, 255, 0.45)',
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                    zIndex: 1
                  }}
                />
              );
            })}

            {/* Leaf CUs */}
            {leafNodes.map((node, idx) => {
              const safeRelX = getSafeRelCoord(node.x, ctuPixelX);
              const safeRelY = getSafeRelCoord(node.y, ctuPixelY);
              const relX = (safeRelX / 64) * 100;
              const relY = (safeRelY / 64) * 100;
              const w = ((node.width || 64) / 64) * 100;
              const h = ((node.height || 64) / 64) * 100;

              const isSelected = activeNode && activeNode.x === node.x && activeNode.y === node.y && activeNode.width === node.width;

              const depthStyle = depthColors[node.depth] || depthColors[3];
              const modeStyle = modeColors[(node.mode || 'INTRA').toUpperCase()] || modeColors.INTRA;
              const activeColor = colorScheme === 'depth' ? depthStyle : modeStyle;

              const showLabel = node.width >= 16;
              const isIntra = (node.mode || 'INTRA').toUpperCase() === 'INTRA';
              const intraLabel = isIntra && node.intra_dir !== null && node.intra_dir !== undefined ? `M${node.intra_dir}` : (node.mode || '');

              const hasImage = Boolean(imageSrc && textureMode !== 'off');

              // If colorScheme === 'outline', NO mode color overlay on the cells!
              const cellBg = isSelected
                ? 'rgba(222, 0, 106, 0.40)'
                : (colorScheme === 'outline'
                    ? 'transparent'
                    : (hasImage ? activeColor.bg : activeColor.bgSolid));

              const cellBorder = isSelected
                ? '3px solid var(--apple-purple)'
                : (colorScheme === 'outline'
                    ? (hasImage ? '1.5px solid rgba(255, 255, 255, 0.85)' : '1.5px solid rgba(148, 163, 184, 0.8)')
                    : `1.5px solid ${activeColor.border}`);

              return (
                <div
                  key={`leaf-${idx}`}
                  onClick={() => handleCuClick(node)}
                  style={{
                    position: 'absolute',
                    left: `${relX}%`,
                    top: `${relY}%`,
                    width: `${w}%`,
                    height: `${h}%`,
                    backgroundColor: cellBg,
                    border: cellBorder,
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    opacity: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '2px',
                    transition: 'none',
                    zIndex: isSelected ? 10 : 2,
                    boxShadow: 'none'
                  }}
                  title={`CU ${node.width}×${node.height} @ (${node.x}, ${node.y}), Mode: ${node.mode || 'INTRA'}${isIntra && node.intra_dir !== null ? ` (M${node.intra_dir})` : ''}, Depth: ${node.depth}`}
                >
                  {showLabel && (
                    <span style={{
                      fontSize: node.width >= 32 ? '0.85rem' : '0.68rem',
                      fontWeight: 800,
                      color: hasImage ? '#FFFFFF' : (colorScheme === 'outline' ? 'var(--apple-label)' : activeColor.text),
                      textShadow: hasImage ? '0 1px 2px #000, 0 0 4px #000' : 'none',
                      lineHeight: '1.1',
                      textAlign: 'center'
                    }}>
                      {node.width}×{node.height}
                    </span>
                  )}
                  {showLabel && intraLabel && colorScheme === 'mode' && (
                    <span style={{
                      fontSize: node.width >= 32 ? '0.75rem' : '0.62rem',
                      fontWeight: 800,
                      color: hasImage ? '#FFD200' : 'var(--apple-label)',
                      textShadow: hasImage ? '0 1px 2px #000, 0 0 4px #000' : 'none',
                      maxWidth: '95%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                      marginTop: '1px'
                    }}>
                      {intraLabel}
                    </span>
                  )}
                  {node.width === 64 && node.cost !== null && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: hasImage ? '#E2E8F0' : 'var(--apple-label-secondary)',
                      textShadow: hasImage ? '0 1px 2px #000' : 'none',
                      fontFamily: 'monospace',
                      marginTop: '2px'
                    }}>
                      Cost: {Math.round(node.cost)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dynamic Legend (Prediction Modes / Depths / Clean Outline) */}
          {colorScheme === 'outline' ? (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.72rem' }}>
                <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 800 }}>OVERLAY:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--apple-label)' }}>
                  <span style={{ width: '14px', height: '0px', borderTop: '2px solid rgba(71, 85, 105, 0.95)', display: 'inline-block' }} />
                  <span>CU BOUNDARIES (TRANSPARENT, MODE OVERLAY: OFF)</span>
                </span>
              </div>
              <button
                type="button"
                className="apple-btn-secondary"
                onClick={() => setColorScheme('mode')}
                style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}
                title="Turn on PRED MODES cell overlay (INTRA, INTER, SKIP)"
              >
                + Turn On Mode Overlay
              </button>
            </div>
          ) : colorScheme === 'mode' ? (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--apple-label-secondary)' }}>
                  PRED MODES:
                </span>
                {Object.entries(modeColors).map(([m, item]) => (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                    <span style={{ width: '12px', height: '12px', background: item.bg, border: `1.5px solid ${item.border}`, display: 'inline-block', borderRadius: '2px' }} />
                    <span style={{ fontWeight: 600, color: 'var(--apple-label)' }}>{m}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="apple-btn-secondary"
                onClick={() => setColorScheme('outline')}
                style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}
                title="Turn off PRED MODES cell overlay"
              >
                ✕ Turn Off Overlay
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--apple-label-secondary)' }}>
                  DEPTH LEVELS:
                </span>
                {Object.entries(depthColors).map(([d, item]) => (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                    <span style={{ width: '12px', height: '12px', background: item.bg, border: `1.5px solid ${item.border}`, display: 'inline-block' }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="apple-btn-secondary"
                onClick={() => setColorScheme('outline')}
                style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}
                title="Turn off depth overlay"
              >
                ✕ Turn Off Overlay
              </button>
            </div>
          )}
        </div>

        {/* Selected CU Details Inspector Panel */}
        <div style={{ flex: '1 1 320px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="apple-card" style={{
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--apple-hairline)', paddingBottom: '0.65rem', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', margin: 0, color: 'var(--apple-label)' }}>CU Inspector</h3>
                {activeNode && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--apple-label-secondary)', marginTop: '0.25rem', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                    {activeW}×{activeH} • Cost {activeNode.cost !== null ? Number(activeNode.cost).toFixed(1) : '—'}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                background: activeNode ? depthColors[activeNode.depth]?.bg : 'transparent',
                border: '1px solid var(--apple-hairline)'
              }}>
                Depth {activeNode?.depth}
              </span>
            </div>

            {activeNode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* CU Block Image Texture Crop */}
                <div className="apple-card" style={{
                  padding: '0.75rem',
                  background: 'var(--apple-canvas)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--apple-label-secondary)' }}>
                      Texture Crop
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--apple-canvas)',
                    border: '1px solid var(--apple-hairline)',
                    borderRadius: 0,
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '0.85rem',
                    boxSizing: 'border-box'
                  }}>
                    {imageSrc ? (
                      <div
                        style={{
                          width: `${cropBoxSize}px`,
                          height: `${cropBoxSize}px`,
                          border: '1.5px solid var(--apple-blue)',
                          borderRadius: 0,
                          position: 'relative',
                          overflow: 'hidden',
                          backgroundColor: '#000',
                          transition: 'none',
                          flexShrink: 0
                        }}
                      >
                        <svg
                          viewBox={`0 0 ${activeW} ${activeH}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'block'
                          }}
                        >
                          <image
                            href={imageSrc}
                            x={-activeAbsX}
                            y={-activeAbsY}
                            width={imageDims?.width || 640}
                            height={imageDims?.height || 360}
                            preserveAspectRatio="none"
                            style={{
                              imageRendering: 'pixelated',
                              filter: textureMode === 'grayscale' ? 'grayscale(100%)' : 'none'
                            }}
                          />
                        </svg>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--apple-label-tertiary)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono', padding: '1rem 0' }}>
                        No Image Available
                      </span>
                    )}
                  </div>
                </div>

                <div className="apple-card" style={{ padding: '0.65rem 0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--apple-label-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    Prediction Mode & Direction
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--apple-blue)' }}>
                    {activeNode.mode || 'INTRA'}
                    {activeNode.mode === 'INTRA' && activeNode.intra_dir !== null && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: 'var(--apple-label)', fontWeight: 600 }}>
                        Mode {activeNode.intra_dir}: {getIntraModeInfo(activeNode.intra_dir).name} ({getIntraModeInfo(activeNode.intra_dir).type})
                      </span>
                    )}
                  </div>
                </div>

                {onNavigateToIntra && (
                  <button
                    type="button"
                    className="apple-btn-primary"
                    onClick={() => {
                      if (activeNode.width === 8) {
                        onNavigateToIntra(activeNode);
                      }
                    }}
                    disabled={activeNode.width !== 8}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      background: activeNode.width === 8 ? 'var(--apple-purple, #AF52DE)' : '#94A3B8',
                      cursor: activeNode.width === 8 ? 'pointer' : 'not-allowed',
                      opacity: activeNode.width === 8 ? 1 : 0.7
                    }}
                    title={activeNode.width === 8 ? "Inspect 8×8 Intra Prediction Flow" : "Intra prediction pipeline only supports 8×8 block matrix inspection"}
                  >
                    {activeNode.width === 8 ? 'Inspect Intra (8×8) →' : `8×8 Only (${activeW}×${activeH})`}
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--apple-canvas)',
                border: '1.5px dashed var(--apple-hairline)',
                borderRadius: '6px',
                color: 'var(--apple-label-secondary)',
                fontFamily: 'JetBrains Mono',
                fontSize: '0.8rem'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--apple-label-tertiary)' }}>No CU selected</div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Bottom Section: Dedicated Full-Width CTU QuadTree Geometric Square Blocks */}
      {(viewLayout === 'tree' || viewLayout === 'dual') && (
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          marginTop: viewLayout === 'dual' ? '0.75rem' : '0'
        }}>
          <QuadtreeHierarchyGraph
            partitionNodes={partitionData.nodes}
            ctuPixelX={ctuPixelX}
            ctuPixelY={ctuPixelY}
            selectedCU={activeNode}
            onSelectNode={handleCuClick}
            showCost={true}
            showMode={true}
          />
        </div>
      )}

      {/* HM-16.0 Source Code Inspector Modal for xCompressCU */}
      <HmSourceCodeModal
        isOpen={showHmModal}
        onClose={() => setShowHmModal(false)}
        title={HM_QUADTREE_RDO_SNIPPET.title}
        sourceFile={HM_QUADTREE_RDO_SNIPPET.sourceFile}
        functionName={HM_QUADTREE_RDO_SNIPPET.functionName}
        standardRef={HM_QUADTREE_RDO_SNIPPET.standardRef}
        description={HM_QUADTREE_RDO_SNIPPET.description}
        variables={[
          { name: 'Target CTU', value: `(${targetCtuX}, ${targetCtuY})`, highlight: true },
          { name: 'Total Leaf CUs', value: leaf_nodes || leafNodes.length },
          { name: 'Max QuadTree Depth', value: `${max_depth} / 3` },
          { name: 'Selected CU', value: activeNode ? `${activeW}×${activeH} @ (${activeNode.x}, ${activeNode.y})` : 'None', highlight: true },
          { name: 'CU Depth', value: activeNode?.depth ?? 0 },
          { name: 'Best Mode', value: activeNode?.mode ?? 'INTRA' },
          { name: 'RDO Cost', value: activeNode?.cost !== null && activeNode?.cost !== undefined ? Number(activeNode.cost).toFixed(1) : 'N/A' },
        ]}
        codeSnippet={HM_QUADTREE_RDO_SNIPPET.codeSnippet}
      />

      {/* Draw.io / diagrams.net XML Export Modal */}
      <DrawioExportModal
        isOpen={showDrawioModal}
        onClose={() => setShowDrawioModal(false)}
        partitionNodes={partitionData.nodes}
        ctuX={targetCtuX}
        ctuY={targetCtuY}
        leafCount={leaf_nodes || leafNodes.length}
        maxDepth={max_depth}
      />
    </div>
  );
}
