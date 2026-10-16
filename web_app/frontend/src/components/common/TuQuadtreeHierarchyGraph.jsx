import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { buildRqtTree, computeTuTreeLayout, getTuNodeColorTheme } from '../../utils/rqtTreeLayout.js';

/**
 * Recursive renderer for internal partition grid inside a split TU square block.
 */
function InternalTuPartitionGrid({ node, x, y, size, showLeafNumbers = false }) {
  if (!node.children || node.children.length === 0) {
    if (showLeafNumbers && node.zScanIndex !== null) {
      const fontSize = Math.max(8, Math.round(size * 0.38));
      return (
        <text
          x={x + size / 2}
          y={y + size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontFamily="system-ui, -apple-system, sans-serif"
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
  const strokeWidth = Math.max(1.0, size * 0.02);

  return (
    <g className="internal-tu-splits">
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
            <InternalTuPartitionGrid
              key={child.id}
              node={child}
              x={cx}
              y={cy}
              size={half}
              showLeafNumbers={showLeafNumbers}
            />
          );
        } else if (showLeafNumbers && child.zScanIndex !== null) {
          const fontSize = Math.max(7, Math.round(half * 0.36));
          return (
            <text
              key={child.id}
              x={cx + half / 2}
              y={cy + half / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontFamily="system-ui, -apple-system, sans-serif"
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
 * TuQuadtreeHierarchyGraph
 * Interactive Vector Visualizer rendering HEVC Residual Quadtree (RQT)
 * as proportional Geometric Square TU Blocks.
 */
export default function TuQuadtreeHierarchyGraph({
  tuEvents = [],
  cuX = 0,
  cuY = 0,
  cuSize = 32,
  component = 'Y',
  intraMode = null,
  selectedTu = null,
  activeNodeId = null,
  onSelectTu = null
}) {
  const containerRef = useRef(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Build recursive 4-ary RQT and layout
  const tree = useMemo(() => {
    return buildRqtTree(tuEvents, { cuX, cuY, cuSize, component, intraMode });
  }, [tuEvents, cuX, cuY, cuSize, component, intraMode]);

  const layout = useMemo(() => {
    return computeTuTreeLayout(tree);
  }, [tree]);

  // Active path highlight from root down to active or selected TU node
  const activePathIds = useMemo(() => {
    let targetNode = null;
    if (activeNodeId) {
      targetNode = layout.nodes.find(n => n.id === activeNodeId || n.altId === activeNodeId);
    }
    if (!targetNode && selectedTu) {
      const selRelX = selectedTu.relX ?? selectedTu.rel_x ?? (selectedTu.tu_x !== undefined ? selectedTu.tu_x - cuX : 0);
      const selRelY = selectedTu.relY ?? selectedTu.rel_y ?? (selectedTu.tu_y !== undefined ? selectedTu.tu_y - cuY : 0);
      const selSize = selectedTu.size || selectedTu.width || 8;

      targetNode = layout.nodes.find(n =>
        (n.relX === selRelX && n.relY === selRelY && n.size === selSize) ||
        (n.absX === selectedTu.tu_x && n.absY === selectedTu.tu_y && n.size === selSize) ||
        n.id === selectedTu.id
      );
    }

    if (!targetNode) return new Set();

    const path = new Set([targetNode.id]);
    let curr = targetNode;
    while (curr && curr.parentId) {
      path.add(curr.parentId);
      curr = layout.nodes.find(n => n.id === curr.parentId);
    }
    return path;
  }, [activeNodeId, selectedTu, cuX, cuY, layout]);

  // Fit View handler: scales and centers the diagram comfortably
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    const scaleX = (clientWidth - 48) / (layout.totalWidth || 480);
    const scaleY = (clientHeight - 48) / (layout.totalHeight || 300);
    const initialFit = Math.min(Math.min(scaleX, scaleY), 1.05);
    const safeFit = Math.max(initialFit, 0.2);

    setZoom(safeFit);
    const offsetX = (clientWidth - (layout.totalWidth || 480) * safeFit) / 2;
    const offsetY = (clientHeight - (layout.totalHeight || 300) * safeFit) / 2;
    setPan({ x: Math.round(offsetX), y: Math.max(12, Math.round(offsetY)) });
  }, [layout.totalWidth, layout.totalHeight]);

  // ResizeObserver for reliable auto-fit
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
    if (e.button !== 0) return;
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

  // Wheel zoom listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom(prevZoom => Math.max(0.2, Math.min(3.0, Number((prevZoom * zoomFactor).toFixed(3)))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleNodeClick = (node, e) => {
    e.stopPropagation();
    if (!onSelectTu) return;
    onSelectTu(node.rawEvent || {
      tu_x: node.absX,
      tu_y: node.absY,
      width: node.size,
      height: node.size,
      tu_depth: node.depth,
      component,
      is_dst: node.isDst,
      is_transform_skip: node.isTransformSkip,
      sig_coeff_count: node.sigCoeffCount,
      energy_compaction_ratio: node.energyCompactionRatio,
      sparsity_ratio: node.sparsityRatio,
      qp: node.qp
    });
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
            Transform QuadTree Geometric Square Blocks
          </span>
          <span style={{ color: 'var(--apple-label-secondary)' }}>
            CU ({cuX}, {cuY}) {cuSize}×{cuSize} • {tree.totalLeaves || 0} Leaf TUs • Depth 0..{Math.max(0, ...layout.nodes.map(n => n.depth))}
          </span>
        </div>

        {/* Pan/Zoom Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => setZoom(z => Math.min(3.0, Number((z * 1.2).toFixed(2))))}
            title="Zoom In (+)"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', minWidth: '24px', justifyContent: 'center' }}
          >
            +
          </button>
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => setZoom(z => Math.max(0.15, Number((z / 1.2).toFixed(2))))}
            title="Zoom Out (-)"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', minWidth: '24px', justifyContent: 'center' }}
          >
            −
          </button>
          <button
            type="button"
            className="apple-btn-tool"
            onClick={handleFitView}
            title="Fit Entire Tree to Viewport"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', minWidth: '60px', justifyContent: 'center' }}
          >
            Fit View
          </button>
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => { setZoom(1); setPan({ x: 20, y: 20 }); }}
            title="Reset Zoom to 100%"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', minWidth: '82px', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}
          >
            100% ({Math.round(zoom * 100)}%)
          </button>
        </div>
      </div>

      {/* SVG Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: '100%',
          height: 'min(58vh, 600px)',
          minHeight: '440px',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--apple-canvas, #ffffff)',
          userSelect: 'none'
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* LAYER 1: Orthogonal Connector Edges */}
            <g className="tree-connectors">
              {layout.edges.map(edge => {
                const isActive = activePathIds.has(edge.parentId) && activePathIds.has(edge.childId);
                return (
                  <path
                    key={edge.id}
                    d={edge.path}
                    fill="none"
                    stroke={isActive ? 'var(--apple-blue, #007AFF)' : 'var(--apple-label, #000000)'}
                    strokeWidth={isActive ? 3.0 : 1.8}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    style={{ transition: 'stroke 150ms ease, stroke-width 150ms ease' }}
                  />
                );
              })}
            </g>

            {/* LAYER 2: Geometric Square TU Blocks */}
            <g className="tree-tu-blocks">
              {layout.nodes.map(node => {
                const { x, y, size } = node.layout;
                const selX = selectedTu?.rawTuX ?? selectedTu?.tu_x ?? selectedTu?.absX;
                const selY = selectedTu?.rawTuY ?? selectedTu?.tu_y ?? selectedTu?.absY;
                const selSize = selectedTu?.size || selectedTu?.width;
                const isSelected = Boolean(selectedTu && (
                  (selectedTu.id && (selectedTu.id === node.id || selectedTu.id === node.altId)) ||
                  (selX !== undefined && selY !== undefined && (
                    (selX === node.absX && selY === node.absY) ||
                    (selX === node.relX && selY === node.relY) ||
                    (cuX !== 0 && (selX - cuX) === node.relX && (selY - cuY) === node.relY)
                  ) && (!selSize || selSize === node.size))
                ));
                const isStepperActive = activeNodeId && (activeNodeId === node.id || activeNodeId === node.altId);

                const _theme = getTuNodeColorTheme(node.size, node.isSplit, node.isDst);
                const strokeColor = isSelected
                  ? '#007AFF'
                  : isStepperActive
                    ? '#FF9500'
                    : 'var(--apple-label, #000000)';
                const strokeWidth = isSelected || isStepperActive ? 4.0 : 2.5;

                return (
                  <g
                    key={node.id}
                    onClick={(e) => handleNodeClick(node, e)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Dimension Markers for Root TU */}
                    {node.depth === 0 && (
                      <g className="tu-dimension-markers" pointerEvents="none">
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
                          {node.size}
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
                          {node.size}
                        </text>
                      </g>
                    )}

                    {/* Outer Geometric Square Block */}
                    <rect
                      x={x}
                      y={y}
                      width={size}
                      height={size}
                      fill={isSelected ? 'rgba(0, 122, 255, 0.08)' : (isStepperActive ? 'rgba(255, 149, 0, 0.12)' : 'var(--apple-canvas, #ffffff)')}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      shapeRendering="crispEdges"
                    />

                    {/* Split Node: Draw internal cross divisions matching Draw.io Trang-8 */}
                    {node.isSplit ? (
                      <InternalTuPartitionGrid
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
                        fontSize={Math.max(9, Math.round(size * 0.38))}
                        fontFamily="Helvetica, Arial, sans-serif"
                        fontWeight="700"
                        fill="var(--apple-label, #000000)"
                        pointerEvents="none"
                      >
                        {node.zScanIndex !== null ? node.zScanIndex : `${node.size}`}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Floating HUD: Details of active / selected TU */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            right: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--apple-surface, rgba(255, 255, 255, 0.94))',
            backdropFilter: 'blur(8px)',
            border: '0.5px solid var(--separator, rgba(0, 0, 0, 0.15))',
            borderRadius: '6px',
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--apple-label, #000000)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: 'var(--apple-blue, #007AFF)' }}>
              {selectedTu ? `Selected TU ${selectedTu.width || selectedTu.size}×${selectedTu.height || selectedTu.size}` : `Transform QuadTree • CU (${cuX}, ${cuY}) ${cuSize}×${cuSize}`}
            </span>
            {selectedTu && (
              <span style={{ color: 'var(--apple-label-secondary)' }}>
                • Pos ({selectedTu.tu_x ?? selectedTu.absX ?? 0}, {selectedTu.tu_y ?? selectedTu.absY ?? 0}) • QP {selectedTu.qp ?? 32}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10.5px' }}>
            <span>Type: <strong>{selectedTu?.width === 4 && selectedTu?.height === 4 && component === 'Y' ? '2D DST-VII' : '2D DCT-II'}</strong></span>
            {selectedTu?.sig_coeff_count !== undefined && (
              <span>Non-zero Coeffs: <strong>{selectedTu.sig_coeff_count}</strong></span>
            )}
            <span style={{ color: 'var(--apple-label-tertiary)' }}>Click any TU block to inspect</span>
          </div>
        </div>
      </div>
    </div>
  );
}
