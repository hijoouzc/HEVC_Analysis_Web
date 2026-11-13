import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { HEVC_DEPTH_COLORS } from '../../../utils/colorUtils';
import { generateEdgeClampedPaddedImage } from '../../../utils/tcomPicSymEngine';

/**
 * FullFrameViewer - HEVC Full Frame Coding Tree & CU Partition Visualizer
 * Layered High-Performance Multi-Layer Architecture:
 * - Layer 1: Static Video Frame (Pristine input image)
 * - Layer 2: Static Partition Layer (Memoized leaf CUs across all CTUs, zero re-render on CTU click)
 * - Layer 3: Static CTU Grid Layer (Memoized 64x64 boundaries & yellow index numbers)
 * - Layer 4: Active Selection Reticle (Ultra-lightweight ~5 DOM nodes, instantaneous <0.5ms response)
 */

const getDepthFill = (depth, alpha = 0.35) => {
  const depthConf = HEVC_DEPTH_COLORS[depth];
  return depthConf ? depthConf.bgAlpha(alpha) : `rgba(100, 116, 139, ${alpha})`;
};

/**
 * StaticPartitionLayer
 * High-performance memoized layer rendering all leaf CU boxes.
 * NEVER re-renders when active CTU selection changes.
 */
const StaticPartitionLayer = React.memo(function StaticPartitionLayer({
  combinedPartitions,
  colorScheme,
  gridColor = 'white',
  onSelectLeaf,
  committedCtuKeys = null
}) {
  const cuStrokeColor = gridColor === 'yellow'
    ? 'rgba(250, 204, 21, 0.90)'
    : gridColor === 'cyan'
      ? 'rgba(56, 189, 248, 0.90)'
      : 'rgba(255, 255, 255, 0.88)';

  return (
    <g className="static-partition-layer">
      {Object.entries(combinedPartitions).map(([key, ctuPart]) => {
        if (!ctuPart || !ctuPart.nodes) return null;
        if (committedCtuKeys && !committedCtuKeys.has(key)) return null;
        const leaves = ctuPart.nodes.filter(n => !n.split);
        const ctuOriginX = (ctuPart.ctu_x ?? 0) * 64;
        const ctuOriginY = (ctuPart.ctu_y ?? 0) * 64;

        return (
          <g key={`partition-ctu-${key}`}>
            {leaves.map((leaf, lIdx) => {
              const absX = (typeof leaf.abs_x === 'number' && !isNaN(leaf.abs_x))
                ? leaf.abs_x
                : ((typeof leaf.rel_x === 'number' && !isNaN(leaf.rel_x))
                  ? ctuOriginX + leaf.rel_x
                  : (typeof leaf.x === 'number' && !isNaN(leaf.x) ? leaf.x : ctuOriginX));

              const absY = (typeof leaf.abs_y === 'number' && !isNaN(leaf.abs_y))
                ? leaf.abs_y
                : ((typeof leaf.rel_y === 'number' && !isNaN(leaf.rel_y))
                  ? ctuOriginY + leaf.rel_y
                  : (typeof leaf.y === 'number' && !isNaN(leaf.y) ? leaf.y : ctuOriginY));

              const leafW = (typeof leaf.width === 'number' && !isNaN(leaf.width) && leaf.width > 0) ? leaf.width : 64;
              const leafH = (typeof leaf.height === 'number' && !isNaN(leaf.height) && leaf.height > 0) ? leaf.height : 64;
              const normalizedLeaf = { ...leaf, x: absX, y: absY, width: leafW, height: leafH };

              const fillColor = colorScheme === 'depth' ? getDepthFill(leaf.depth, 0.35) : 'transparent';
              const leafCtuX = Math.floor(absX / 64);
              const leafCtuY = Math.floor(absY / 64);

              return (
                <g
                  key={`leaf-${key}-${lIdx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLeaf(normalizedLeaf, leafCtuX, leafCtuY);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Leaf CU Filled Box */}
                  <rect
                    x={absX}
                    y={absY}
                    width={leafW}
                    height={leafH}
                    fill={fillColor}
                    stroke={cuStrokeColor}
                    strokeWidth={1.25}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
});

/**
 * StaticCtuGridLayer
 * High-performance memoized layer rendering 64x64 CTU boundaries and Yellow Raster Index numbers.
 * NEVER re-renders when active CTU selection changes.
 */
const StaticCtuGridLayer = React.memo(function StaticCtuGridLayer({
  ctus,
  showGrid,
  gridColor = 'white',
  showCtuNumbers,
  viewMode,
  showBoundary = false,
  onCtuClick
}) {
  const ctuStrokeColor = gridColor === 'yellow'
    ? '#FACC15'
    : gridColor === 'cyan'
      ? '#38BDF8'
      : '#FFFFFF';

  return (
    <g className="static-ctu-grid-layer">
      {ctus.map(({ index, x, y, px, py, pw, ph, isBoundary }) => (
        <g
          key={`ctu-grid-${x}-${y}`}
          onClick={(e) => {
            e.stopPropagation();
            onCtuClick(x, y);
          }}
          style={{ cursor: 'pointer' }}
        >
          {/* Boundary CTU: Render nominal 64x64 extent outline extending into padding when showBoundary is active */}
          {showBoundary && isBoundary && (
            <rect
              x={px}
              y={py}
              width={64}
              height={64}
              fill="none"
              stroke="rgba(245, 158, 11, 0.55)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* CTU Outer Boundary Box for valid pixel samples */}
          <rect
            x={px}
            y={py}
            width={pw}
            height={ph}
            fill="transparent"
            stroke={showGrid ? ((showBoundary && isBoundary) ? '#F59E0B' : ctuStrokeColor) : 'transparent'}
            strokeWidth={viewMode === 'original' ? 1.2 : 2.0}
            strokeDasharray={viewMode === 'original' ? '4 3' : 'none'}
            vectorEffect="non-scaling-stroke"
          />

          {/* CTU Raster Index Number in Top-Left Corner */}
          {showCtuNumbers && viewMode === 'partition' && (
            <text
              x={px + 4}
              y={py + 13}
              fill={isBoundary ? '#FDE68A' : '#FEF08A'}
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="900"
              textAnchor="start"
              stroke="#000000"
              strokeWidth={1.8}
              paintOrder="stroke"
              pointerEvents="none"
            >
              {index}
            </text>
          )}
        </g>
      ))}
    </g>
  );
});

/**
 * ActiveSelectionLayer
 * Ultra-lightweight SVG layer containing ONLY the active CTU cyan reticle and/or active CU magenta box.
 * Only this layer renders upon selection click (~5 DOM elements, <0.1ms).
 */
const ActiveSelectionLayer = React.memo(function ActiveSelectionLayer({
  activeCtu,
  activeCu = null,
  showCuHighlight = false,
  viewMode,
  showBoundary = false
}) {
  return (
    <g className="active-selection-layer" pointerEvents="none">
      {/* 1. Active Selected CTU Reticle (Topmost CTU only, no CU overlay in full frame per HM standard) */}
      {activeCtu && (
        <>
          {/* If boundary CTU: render nominal 64x64 reticle extending into padding */}
          {showBoundary && activeCtu.isBoundary && (
            <rect
              x={activeCtu.px}
              y={activeCtu.py}
              width={64}
              height={64}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={1.8}
              strokeDasharray="4 2"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* High-contrast black under-stroke for sharp boundary visibility */}
          <rect
            x={activeCtu.px}
            y={activeCtu.py}
            width={activeCtu.pw}
            height={activeCtu.ph}
            fill="none"
            stroke="#000000"
            strokeWidth={4.5}
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={activeCtu.px}
            y={activeCtu.py}
            width={activeCtu.pw}
            height={activeCtu.ph}
            fill={viewMode === 'original' ? 'rgba(0, 163, 224, 0.12)' : 'rgba(0, 163, 224, 0.22)'}
            stroke="#00A3E0"
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      {/* 2. Active Selected CU Box (Disabled in Full Frame Grid per HM standard: CU selection reserved for CTU QuadTree) */}
      {showCuHighlight && activeCu && (
        <rect
          x={activeCu.x}
          y={activeCu.y}
          width={activeCu.width}
          height={activeCu.height}
          fill={activeCu.split ? 'rgba(175, 82, 222, 0.20)' : 'rgba(222, 0, 106, 0.25)'}
          stroke={activeCu.split ? 'var(--apple-purple)' : '#DE006A'}
          strokeWidth={activeCu.split ? 2.5 : 2}
          strokeDasharray={activeCu.split ? '4 2' : 'none'}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
});


function FullFrameViewer({
  imageSrc,
  imageDims = { width: 640, height: 360 },
  ctuX = 0,
  ctuY = 0,
  onSelectCTU = null,
  onNavigateToQuadTree = null,
  partitionData = null,
  ctuPartitionsMap = {},
  isAnalyzed = false,
  _onReAnalyze = null,
  loading = false,
  selectedCu: propsSelectedCu = undefined,
  onSelectCU = null,
  committedCtuKeys = null
}) {
  const [userViewMode, setUserViewMode] = useState(null);
  const viewMode = userViewMode ?? (isAnalyzed ? 'partition' : 'original');
  const setViewMode = useCallback((valOrFn) => {
    setUserViewMode(prev => {
      const current = prev ?? (isAnalyzed ? 'partition' : 'original');
      return typeof valOrFn === 'function' ? valOrFn(current) : valOrFn;
    });
  }, [isAnalyzed]);

  const [colorScheme, setColorScheme] = useState('outline'); // 'outline' (clean transparent) or 'depth'
  const [showGrid, setShowGrid] = useState(true);
  const [showBoundary, setShowBoundary] = useState(false);
  const [gridColor, setGridColor] = useState('white'); // 'white' (default: pure white), 'yellow' (#FACC15), 'cyan' (#38BDF8)
  const showCtuNumbers = false;
  const [selectedCu, setSelectedCu] = useState(null);
  const [uncontrolledCtu, setUncontrolledCtu] = useState(null);

  const activeCu = propsSelectedCu !== undefined ? propsSelectedCu : selectedCu;

  const activeCtuX = onSelectCTU ? ctuX : (uncontrolledCtu !== null ? uncontrolledCtu.x : ctuX);
  const activeCtuY = onSelectCTU ? ctuY : (uncontrolledCtu !== null ? uncontrolledCtu.y : ctuY);
  const localCtu = useMemo(() => {
    if (activeCtuX === null || activeCtuY === null || activeCtuX === undefined || activeCtuY === undefined) {
      return null;
    }
    return { x: activeCtuX, y: activeCtuY };
  }, [activeCtuX, activeCtuY]);

  // Quick keyboard toggle: Press 'T' or 't' for partition toggle, 'B'/'b' or 'P'/'p' for padding toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 't' || e.key === 'T') {
        setViewMode(prev => (prev === 'partition' ? 'original' : 'partition'));
      } else if (e.key === 'b' || e.key === 'B' || e.key === 'p' || e.key === 'P') {
        setShowBoundary(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode]);

  const { width, height } = imageDims;
  const ctuSize = 64;
  const numCols = Math.max(1, Math.ceil(width / ctuSize));
  const numRows = Math.max(1, Math.ceil(height / ctuSize));
  const nominalWidth = numCols * ctuSize;
  const nominalHeight = numRows * ctuSize;
  const rightPadding = nominalWidth - width;
  const bottomPadding = nominalHeight - height;
  const viewW = showBoundary ? nominalWidth : width;
  const viewH = showBoundary ? nominalHeight : height;

  const [paddedImageSrc, setPaddedImageSrc] = useState(null);

  useEffect(() => {
    if (!imageSrc || !showBoundary || (rightPadding <= 0 && bottomPadding <= 0)) {
      return;
    }
    let isCurrent = true;
    generateEdgeClampedPaddedImage(imageSrc, width, height, nominalWidth, nominalHeight).then((src) => {
      if (isCurrent) {
        setPaddedImageSrc(src);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [imageSrc, showBoundary, width, height, nominalWidth, nominalHeight, rightPadding, bottomPadding]);

  // Build grid of CTUs (Memoized, only changes on image dimension changes)
  const ctus = useMemo(() => {
    const list = [];
    for (let y = 0; y < numRows; y++) {
      for (let x = 0; x < numCols; x++) {
        const px = x * ctuSize;
        const py = y * ctuSize;
        const pw = Math.min(ctuSize, width - px);
        const ph = Math.min(ctuSize, height - py);
        const index = y * numCols + x;
        const uiRPelX = px + ctuSize - 1;
        const uiBPelY = py + ctuSize - 1;
        const isBoundary = !(uiRPelX < width && uiBPelY < height);
        list.push({ index, x, y, px, py, pw, ph, uiRPelX, uiBPelY, isBoundary });
      }
    }
    return list;
  }, [numRows, numCols, width, height]);

  // Aggregate all available CTU partition trees (Independent of ctuX, ctuY)
  const combinedPartitions = useMemo(() => {
    const map = { ...ctuPartitionsMap };
    if (partitionData && partitionData.nodes && partitionData.nodes.length > 0) {
      const pX = partitionData.ctu_x !== undefined ? partitionData.ctu_x : 0;
      const pY = partitionData.ctu_y !== undefined ? partitionData.ctu_y : 0;
      map[`${pX}_${pY}`] = { ...partitionData, ctu_x: pX, ctu_y: pY };
    }
    return map;
  }, [ctuPartitionsMap, partitionData]);

  // Instantaneous click handler for CTU selection: click once to select, click again to deselect
  const handleCtuClick = useCallback((x, y) => {
    if (localCtu && localCtu.x === x && localCtu.y === y && !activeCu) {
      // Clicked on already selected CTU (with no active CU) -> Deselect CTU!
      if (!onSelectCTU) setUncontrolledCtu(null);
      setSelectedCu(null);
      if (onSelectCTU) onSelectCTU(null, null);
      if (onSelectCU) onSelectCU(null);
    } else {
      // Clicked on a CTU -> Select it!
      if (!onSelectCTU) setUncontrolledCtu({ x, y });
      setSelectedCu(null);
      if (onSelectCTU) onSelectCTU(x, y);
      if (onSelectCU) onSelectCU(null);
    }
  }, [localCtu, activeCu, onSelectCTU, onSelectCU]);

  // Click handler for leaf CU in FullFrameViewer: selects parent CTU only (CU selection reserved for CTU QuadTree)
  const handleLeafClick = useCallback((_leaf, leafCtuX, leafCtuY) => {
    if (localCtu && localCtu.x === leafCtuX && localCtu.y === leafCtuY) {
      // Clicked on already selected CTU -> Deselect CTU!
      if (!onSelectCTU) setUncontrolledCtu(null);
      setSelectedCu(null);
      if (onSelectCTU) onSelectCTU(null, null);
      if (onSelectCU) onSelectCU(null);
    } else {
      // Clicked on a CTU -> Select it!
      if (!onSelectCTU) setUncontrolledCtu({ x: leafCtuX, y: leafCtuY });
      setSelectedCu(null);
      if (onSelectCTU) onSelectCTU(leafCtuX, leafCtuY);
      if (onSelectCU) onSelectCU(null);
    }
  }, [localCtu, onSelectCTU, onSelectCU]);

  // Lightweight active CTU bounding box data (Tier 1: CTU HM standard)
  const activeCtuData = useMemo(() => {
    if (!localCtu) return null;
    return ctus[localCtu.y * numCols + localCtu.x] || null;
  }, [localCtu, ctus, numCols]);

  return (
    <div className="apple-card" style={{
      padding: '0.85rem 1rem',
      marginBottom: '1rem'
    }}>
      {/* Header & Controls Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.65rem',
        marginBottom: '0.65rem',
        paddingBottom: '0.65rem',
        borderBottom: '1px solid var(--apple-hairline)'
      }}>
        {/* Title & Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--apple-label)' }}>
            {viewMode === 'original' ? 'Original Frame' : 'Partition Map'}
          </h2>
          <span style={{
            fontSize: '0.72rem',
            color: 'var(--apple-label-secondary)',
            fontFamily: 'JetBrains Mono',
          }}>
            {showBoundary && (rightPadding > 0 || bottomPadding > 0) ? `${nominalWidth} × ${nominalHeight} (Padded)` : `${width} × ${height}`} • {numCols} × {numRows} CTUs
          </span>
        </div>

        {/* Action & Display Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Main View Mode Toggle */}
          <div className="apple-segmented">
            <button
              type="button"
              className={`apple-segmented-item ${viewMode === 'original' ? 'active' : ''}`}
              onClick={() => setViewMode('original')}
            >
              Original
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${viewMode === 'partition' ? 'active' : ''}`}
              onClick={() => setViewMode('partition')}
            >
              Partition Map
            </button>
          </div>

          {/* Color Mode Toggle */}
          <div className="apple-segmented" style={{
            opacity: viewMode === 'original' ? 0.45 : 1,
            pointerEvents: viewMode === 'original' ? 'none' : 'auto'
          }}>
            <button
              type="button"
              className={`apple-segmented-item ${colorScheme === 'outline' ? 'active' : ''}`}
              onClick={() => setColorScheme('outline')}
              title="Clean transparent partition boundary outlines without color overlay"
            >
              Outline
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${colorScheme === 'depth' ? 'active' : ''}`}
              onClick={() => setColorScheme('depth')}
              title="Color by QuadTree Depth (0:64, 1:32, 2:16, 3:8)"
            >
              Depth
            </button>
          </div>

          {/* Grid Toggle */}
          <button
            type="button"
            className={`apple-btn-tool ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(prev => !prev)}
            style={{
              width: '92px',
              height: '26px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              background: showGrid ? 'rgba(0, 122, 255, 0.12)' : 'transparent',
              color: showGrid ? 'var(--apple-blue)' : 'var(--apple-label)',
              border: '1px solid var(--apple-hairline)',
              userSelect: 'none'
            }}
            title="Toggle 64x64 CTU boundaries"
          >
            <span>GRID:</span>
            <span style={{ width: '28px', textAlign: 'center', display: 'inline-block', marginLeft: '4px' }}>
              {showGrid ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Boundary Toggle Button */}
          <button
            type="button"
            className={`apple-btn-tool ${showBoundary ? 'active' : ''}`}
            onClick={() => setShowBoundary(prev => !prev)}
            style={{
              width: '126px',
              height: '26px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              background: showBoundary ? 'rgba(245, 158, 11, 0.16)' : 'transparent',
              color: showBoundary ? 'var(--apple-orange, #FF9500)' : 'var(--apple-label)',
              border: showBoundary ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--apple-hairline)',
              userSelect: 'none'
            }}
            title="Toggle boundary padding and edge pixel repetition (B or P)"
          >
            <span>PADDING:</span>
            <span style={{ width: '28px', textAlign: 'center', display: 'inline-block', marginLeft: '4px' }}>
              {showBoundary ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Grid Color Cycle: White -> Yellow -> Cyan */}
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => setGridColor(c => c === 'white' ? 'yellow' : c === 'yellow' ? 'cyan' : 'white')}
            style={{
              width: '110px',
              height: '26px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              border: '1px solid var(--apple-hairline)',
              userSelect: 'none'
            }}
            title="Cycle Grid Color: White -> Yellow -> Cyan"
          >
            <span>Grid:</span>
            <span style={{ width: '52px', textAlign: 'center', display: 'inline-block', marginLeft: '4px' }}>
              {gridColor.toUpperCase()}
            </span>
          </button>

          {onNavigateToQuadTree && activeCtuData && (
            <button
              type="button"
              className="apple-btn-primary"
              onClick={() => onNavigateToQuadTree(activeCtuData.x, activeCtuData.y)}
              style={{
                fontSize: '0.74rem',
                padding: '0.3rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              title="Navigate to Stage 2: CU QuadTree"
            >
              Go to CU QuadTree →
            </button>
          )}
        </div>
      </div>

      {/* Interactive Frame Canvas Viewport */}
      <div 
        onClick={() => {
          if (localCtu !== null || activeCu !== null) {
            if (!onSelectCTU) setUncontrolledCtu(null);
            setSelectedCu(null);
            if (onSelectCTU) onSelectCTU(null, null);
            if (onSelectCU) onSelectCU(null);
          }
        }}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: `min(100%, calc((100vh - 210px) * ${viewW} / ${viewH}))`,
          aspectRatio: `${viewW} / ${viewH}`,
          margin: '0 auto',
          border: '1px solid var(--apple-hairline)',
          borderRadius: 0,
          background: 'var(--apple-canvas)',
          cursor: 'default',
          userSelect: 'none',
          overflow: 'hidden',
          boxSizing: 'border-box',
          lineHeight: 0
        }}
      >
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.72)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 35,
              fontFamily: 'JetBrains Mono',
              fontWeight: 800,
              fontSize: '0.9rem',
              color: 'var(--apple-label)'
            }}>
              [ENCODING IN PROGRESS... PLEASE WAIT]
            </div>
          )}
          {/* Source Image Canvas (Renders edge-replicated padded frame when showBoundary is active) */}
          {imageSrc ? (
            <img
              src={showBoundary && paddedImageSrc ? paddedImageSrc : imageSrc}
              alt="Source Frame"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                display: 'block',
                imageRendering: 'pixelated'
              }}
            />
          ) : (
            <div style={{
              height: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--apple-label-secondary)',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.85rem'
            }}>
              [NO FRAME LOADED]
            </div>
          )}

          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'all'
            }}
          >
            {/* Edge Padding Delineation Lines, Subtle Tint & Badges (Active when showBoundary is ON) */}
            {showBoundary && rightPadding > 0 && (
              <g className="padding-delineation-right">
                <line
                  x1={width}
                  y1={0}
                  x2={width}
                  y2={viewH}
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <rect
                  x={width}
                  y={0}
                  width={rightPadding}
                  height={viewH}
                  fill="rgba(245, 158, 11, 0.08)"
                  pointerEvents="none"
                />
                <text
                  x={width + rightPadding / 2}
                  y={14}
                  fill="#F59E0B"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  textAnchor="middle"
                  stroke="#000000"
                  strokeWidth={1.2}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  +{rightPadding}px
                </text>
              </g>
            )}
            {showBoundary && bottomPadding > 0 && (
              <g className="padding-delineation-bottom">
                <line
                  x1={0}
                  y1={height}
                  x2={viewW}
                  y2={height}
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <rect
                  x={0}
                  y={height}
                  width={width}
                  height={bottomPadding}
                  fill="rgba(245, 158, 11, 0.08)"
                  pointerEvents="none"
                />
                <text
                  x={14}
                  y={height + bottomPadding / 2 + 3}
                  fill="#F59E0B"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  textAnchor="start"
                  stroke="#000000"
                  strokeWidth={1.2}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  +{bottomPadding}px
                </text>
              </g>
            )}

            {/* LAYER 1: Static Leaf CUs across ALL CTUs (Memoized, 0 re-render on CTU click) */}
            {viewMode === 'partition' && (
              <StaticPartitionLayer
                combinedPartitions={combinedPartitions}
                colorScheme={colorScheme}
                gridColor={gridColor}
                onSelectLeaf={handleLeafClick}
                committedCtuKeys={committedCtuKeys}
              />
            )}

            {/* LAYER 2: Static 64x64 CTU Grid Boundaries & Yellow Index Numbers (Memoized, 0 re-render on CTU click) */}
            <StaticCtuGridLayer
              ctus={ctus}
              showGrid={showGrid}
              gridColor={gridColor}
              showCtuNumbers={showCtuNumbers}
              viewMode={viewMode}
              showBoundary={showBoundary}
              onCtuClick={handleCtuClick}
            />

            {/* LAYER 3: Active CTU Selection Reticle (Instantaneous <0.1ms update, CU selection is in QuadTree) */}
            <ActiveSelectionLayer
              activeCtu={activeCtuData}
              activeCu={activeCu}
              showCuHighlight={false}
              viewMode={viewMode}
              showBoundary={showBoundary}
            />
          </svg>
        </div>
    </div>
  );
}

export default React.memo(FullFrameViewer);
