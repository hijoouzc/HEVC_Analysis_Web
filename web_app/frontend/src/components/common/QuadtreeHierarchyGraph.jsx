import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { buildQuadtreeTree, computeTreeLayout, getNodeColorTheme } from '../../utils/quadtreeTreeLayout.js';

/**
 * Recursive renderer for internal partition grid inside a split square block.
 * Matches cell O4tKNGW_s31XB_glbO1v-5 & O4tKNGW_s31XB_glbO1v-46 in reference Draw.io SVG.
 */
function InternalPartitionGrid({ node, x, y, size, showLeafNumbers = false }) {
  if (!node.children || node.children.length === 0) {
    if (showLeafNumbers && node.zScanIndex !== null) {
      const fontSize = Math.max(9, Math.round(size * 0.38));
      return (
        <text
          x={x + size / 2}
          y={y + size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="700"
          fill="var(--apple-label, #000000)"
          pointerEvents="none"
        >
          {node.zScanIndex}
        </text>
      );
    }
    return null;
  }

  const half = size / 2;
  const strokeColor = 'var(--apple-label, #000000)';
  const strokeWidth = Math.max(1.2, size * 0.015);

  return (
    <g className="internal-splits">
      {/* Horizontal divider */}
      <line
        x1={x}
        y1={y + half}
        x2={x + size}
        y2={y + half}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        pointerEvents="none"
      />
      {/* Vertical divider */}
      <line
        x1={x + half}
        y1={y}
        x2={x + half}
        y2={y + size}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        pointerEvents="none"
      />

      {/* Recursively render child quadrant splits */}
      {node.children.map((child, idx) => {
        const cx = x + (idx % 2 === 1 ? half : 0);
        const cy = y + (idx >= 2 ? half : 0);

        if (child.isSplit) {
          return (
            <InternalPartitionGrid
              key={child.id}
              node={child}
              x={cx}
              y={cy}
              size={half}
              showLeafNumbers={showLeafNumbers}
            />
          );
        } else if (showLeafNumbers && child.zScanIndex !== null) {
          const fontSize = Math.max(8, Math.round(half * 0.38));
          return (
            <text
              key={child.id}
              x={cx + half / 2}
              y={cy + half / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontFamily="Helvetica, Arial, sans-serif"
              fontWeight="700"
              fill="var(--apple-label, #000000)"
              pointerEvents="none"
            >
              {child.zScanIndex}
            </text>
          );
        }
        return null;
      })}
    </g>
  );
}

/**
 * QuadtreeHierarchyGraph
 * Interactive Vector Visualizer rendering HEVC QuadTree as proportional Geometric Square CU Blocks,
 * perfectly faithful to Draw.io reference SVG (Video_Compression-Trang-8.drawio.svg).
 *
 * Key Architecture:
 * - Geometric Square Blocks: D0 (64x64), D1 (32x32), D2 (16x16), D3 (8x8)
 * - Internal split lines (+) for split nodes; bold Z-scan index numbers (0..N-1) for leaf blocks
 * - Orthogonal edge connectors (orthogonalEdgeStyle)
 * - Pan & Zoom Viewport with Auto-Fit (eliminates any cramping / "bó cứng")
 * - Seamless 2-way selection sync with 2D CTU grid & Inspector
 */
export default function QuadtreeHierarchyGraph({
  partitionNodes = [],
  treeRoot = null,
  ctuPixelX = 0,
  ctuPixelY = 0,
  selectedCU = null,
  activeNodeId = null,
  onSelectNode = null
}) {
  const containerRef = useRef(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Build recursive 4-ary tree and layout
  const tree = useMemo(() => {
    return treeRoot || buildQuadtreeTree(partitionNodes, ctuPixelX, ctuPixelY);
  }, [treeRoot, partitionNodes, ctuPixelX, ctuPixelY]);

  const layout = useMemo(() => {
    return computeTreeLayout(tree);
  }, [tree]);

  // Active path highlight from root down to selected node
  const activePathIds = useMemo(() => {
    const activeId = activeNodeId || (selectedCU ? `node_d${selectedCU.depth}_x${selectedCU.rel_x ?? selectedCU.relX ?? (selectedCU.x % 64)}_y${selectedCU.rel_y ?? selectedCU.relY ?? (selectedCU.y % 64)}` : null);
    if (!activeId) return new Set();

    const targetNode = layout.nodes.find(n => n.id === activeId || n.altId === activeId);
    if (!targetNode) return new Set();

    const path = new Set([targetNode.id]);
    if (targetNode.altId) path.add(targetNode.altId);
    let curr = targetNode;
    while (curr && curr.parentId) {
      path.add(curr.parentId);
      curr = layout.nodes.find(n => n.id === curr.parentId || n.altId === curr.parentId);
    }
    return path;
  }, [activeNodeId, selectedCU, layout]);

  // Fit View handler: scales and centers the diagram to fill available viewport comfortably
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    const scaleX = (clientWidth - 48) / layout.totalWidth;
    const scaleY = (clientHeight - 48) / layout.totalHeight;
    const initialFit = Math.min(Math.min(scaleX, scaleY), 1.05);
    const safeFit = Math.max(initialFit, 0.15);

    setZoom(safeFit);
    const offsetX = (clientWidth - layout.totalWidth * safeFit) / 2;
    const offsetY = (clientHeight - layout.totalHeight * safeFit) / 2;
    setPan({ x: Math.round(offsetX), y: Math.max(12, Math.round(offsetY)) });
  }, [layout.totalWidth, layout.totalHeight]);

  // ResizeObserver for reliable auto-fit whenever container dimensions change or tab switches
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 20 && entry.contentRect.height > 20) {
          handleFitView();
        }
      }
    });
    observer.observe(containerRef.current);
    handleFitView();
    return () => observer.disconnect();
  }, [handleFitView]);

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Native non-passive wheel zoom listener to prevent page scrolling while zooming
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom(prevZoom => Math.max(0.15, Math.min(3.0, Number((prevZoom * zoomFactor).toFixed(3)))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleNodeClick = (node, e) => {
    e.stopPropagation();
    if (!onSelectNode) return;
    if (node.rawNode) {
      onSelectNode(node.rawNode);
    } else {
      onSelectNode({
        x: node.absX,
        y: node.absY,
        width: node.size,
        height: node.size,
        depth: node.depth,
        split: node.isSplit,
        mode: node.mode,
        cost: node.cost,
        intra_dir: node.intraDir
      });
    }
  };

  return (
    <div
      className="apple-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: 'var(--apple-surface)',
        border: '1px solid var(--apple-hairline)',
        borderRadius: 0,
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Top Header & Viewport Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.65rem',
          padding: '0.65rem 1rem',
          background: 'var(--apple-canvas)',
          borderBottom: '1px solid var(--apple-hairline)',
          fontSize: '0.74rem',
          fontFamily: 'JetBrains Mono'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontWeight: 800, color: 'var(--apple-label)' }}>
            CTU QuadTree Geometric Square Blocks
          </span>
          <span style={{ color: 'var(--apple-label-secondary)' }}>
            {tree.totalLeaves || 0} Leaf CUs • Depth {Math.max(...layout.nodes.map(n => n.depth))}
          </span>
        </div>

        {/* Pan/Zoom Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => setZoom(z => Math.min(3.0, Number((z * 1.2).toFixed(2))))}
            title="Zoom In (+)"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
          >
            +
          </button>
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => setZoom(z => Math.max(0.15, Number((z / 1.2).toFixed(2))))}
            title="Zoom Out (-)"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
          >
            −
          </button>
          <button
            type="button"
            className="apple-btn-tool"
            onClick={handleFitView}
            title="Fit Entire Tree to Viewport"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
          >
            ⤢ Fit View
          </button>
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => { setZoom(1); setPan({ x: 20, y: 20 }); }}
            title="Reset Zoom to 100%"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
          >
            100% ({Math.round(zoom * 100)}%)
          </button>
        </div>
      </div>

      {/* Main Interactive Pan & Zoom SVG Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: 'relative',
          width: '100%',
          height: 'min(68vh, 720px)',
          minHeight: '520px',
          background: 'var(--apple-canvas)',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <svg
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        >
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{
              transition: isDragging ? 'none' : 'transform 75ms ease-out'
            }}
          >
          {/* LAYER 1: Orthogonal Connector Branches (Matching Draw.io reference SVG) */}
          <g className="tree-connectors">
            {layout.edges.map(edge => {
              const isActive = activePathIds.has(edge.sourceId) && activePathIds.has(edge.targetId);
              const midY = (edge.startY + edge.endY) / 2;
              const pathD = `M ${edge.startX} ${edge.startY} V ${midY} H ${edge.endX} V ${edge.endY}`;

              return (
                <path
                  key={edge.id}
                  d={pathD}
                  fill="none"
                  stroke={isActive ? 'var(--apple-blue, #007AFF)' : 'var(--apple-label, #000000)'}
                  strokeWidth={isActive ? 3.5 : 2.5}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  style={{
                    transition: 'stroke 150ms ease, stroke-width 150ms ease'
                  }}
                />
              );
            })}
          </g>

          {/* LAYER 2: Geometric Square CU Blocks */}
          <g className="tree-cu-blocks">
            {layout.nodes.map(node => {
              const { x, y, size, fontSize } = node.layout;
              const isSelected = selectedCU && (
                (selectedCU.x === node.absX && selectedCU.y === node.absY && (selectedCU.width === node.size || selectedCU.size === node.size)) ||
                (selectedCU.relX === node.relX && selectedCU.relY === node.relY && selectedCU.size === node.size)
              );
              const isSimulatorActive = activeNodeId && (activeNodeId === node.id || activeNodeId === node.altId);
              const theme = getNodeColorTheme(node.depth, node.isSplit);

              const strokeColor = isSelected
                ? '#FF2D55'
                : isSimulatorActive
                  ? '#FF9500'
                  : 'var(--apple-label, #000000)';

              const strokeWidth = isSelected || isSimulatorActive ? 4 : 2.5;

              return (
                <g
                  key={node.id}
                  onClick={(e) => handleNodeClick(node, e)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Dimension Markers for Root CTU 64x64 */}
                  {node.depth === 0 && (
                    <g className="ctu-dimension-markers" pointerEvents="none">
                      {/* Left Height Arrow */}
                      <line
                        x1={x - 12}
                        y1={y}
                        x2={x - 12}
                        y2={y + size}
                        stroke="var(--apple-label, #000000)"
                        strokeWidth="2"
                      />
                      <polygon points={`${x - 16},${y + 8} ${x - 8},${y + 8} ${x - 12},${y}`} fill="var(--apple-label, #000000)" />
                      <polygon points={`${x - 16},${y + size - 8} ${x - 8},${y + size - 8} ${x - 12},${y + size}`} fill="var(--apple-label, #000000)" />
                      <text
                        x={x - 24}
                        y={y + size / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="13"
                        fontFamily="Helvetica, Arial, sans-serif"
                        fontWeight="700"
                        fill="var(--apple-label, #000000)"
                      >
                        64
                      </text>

                      {/* Top Width Arrow */}
                      <line
                        x1={x}
                        y1={y - 12}
                        x2={x + size}
                        y2={y - 12}
                        stroke="var(--apple-label, #000000)"
                        strokeWidth="2"
                      />
                      <polygon points={`${x + 8},${y - 16} ${x + 8},${y - 8} ${x},${y - 12}`} fill="var(--apple-label, #000000)" />
                      <polygon points={`${x + size - 8},${y - 16} ${x + size - 8},${y - 8} ${x + size},${y - 12}`} fill="var(--apple-label, #000000)" />
                      <text
                        x={x + size / 2}
                        y={y - 24}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="13"
                        fontFamily="Helvetica, Arial, sans-serif"
                        fontWeight="700"
                        fill="var(--apple-label, #000000)"
                      >
                        64
                      </text>
                    </g>
                  )}

                  {/* Outer Square Block */}
                  <rect
                    x={x}
                    y={y}
                    width={size}
                    height={size}
                    fill={node.isSplit ? 'var(--apple-canvas, #ffffff)' : theme.fill}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    shapeRendering="crispEdges"
                  />

                  {/* Split Node: Draw internal cross divisions (matching reference Draw.io diagram) */}
                  {node.isSplit ? (
                    <InternalPartitionGrid
                      node={node}
                      x={x}
                      y={y}
                      size={size}
                      showLeafNumbers={node.depth === 0}
                    />
                  ) : (
                    /* Leaf Block: Big Bold Z-Scan Index Number */
                    <text
                      x={x + size / 2}
                      y={y + size / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      fontFamily="Helvetica, Arial, sans-serif"
                      fontWeight="800"
                      fill={theme.text}
                      pointerEvents="none"
                    >
                      {node.zScanIndex}
                    </text>
                  )}

                  {/* Subtle Selection Halo */}
                  {isSelected && (
                    <rect
                      x={x - 4}
                      y={y - 4}
                      width={size + 8}
                      height={size + 8}
                      fill="none"
                      stroke="#FF2D55"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

        {/* Floating Controls Overlay: Legend & Hover Details HUD */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            right: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.65rem',
            padding: '0.5rem 0.85rem',
            background: 'var(--apple-surface)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            pointerEvents: 'none',
            fontSize: '0.74rem',
            fontFamily: 'JetBrains Mono'
          }}
        >
          {/* Depth Colors Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', pointerEvents: 'auto' }}>
            <span style={{ fontWeight: 800, color: 'var(--apple-label-secondary)' }}>CU DEPTH:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '12px', height: '12px', background: '#CCE5FF', border: '1.5px solid #000', display: 'inline-block' }} />
              <span style={{ color: 'var(--apple-label)' }}>32×32 (D1)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '12px', height: '12px', background: '#66B2FF', border: '1.5px solid #000', display: 'inline-block' }} />
              <span style={{ color: 'var(--apple-label)' }}>16×16 (D2)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '12px', height: '12px', background: '#9999FF', border: '1.5px solid #000', display: 'inline-block' }} />
              <span style={{ color: 'var(--apple-label)' }}>8×8 (D3)</span>
            </div>
          </div>

          {/* Node Context Details */}
          <div style={{ color: 'var(--apple-label)', fontWeight: 600 }}>
            {selectedCU ? (
              <span style={{ color: 'var(--apple-blue)' }}>
                Active: CU {selectedCU.width || selectedCU.size}×{selectedCU.height || selectedCU.size} @ ({selectedCU.relX ?? (selectedCU.x % 64)}, {selectedCU.relY ?? (selectedCU.y % 64)})
              </span>
            ) : (
              <span style={{ color: 'var(--apple-label-secondary)' }}>
                Drag mouse to pan • Scroll to zoom • Click square to select CU
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
