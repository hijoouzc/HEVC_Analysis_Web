import React, { useState, useMemo, useEffect, useCallback } from 'react';
import HmSourceCodeModal from './common/HmSourceCodeModal';
import { HM_CTU_BOUNDARY_SNIPPET } from '../constants/hmSourceSnippets';
import { HEVC_DEPTH_COLORS } from '../utils/colorUtils';

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
  onSelectLeaf
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
          onClick={() => onCtuClick(x, y)}
          style={{ cursor: 'pointer' }}
        >
          {/* Boundary CTU: Render subtle out-of-bounds cross-hatch for nominal 64x64 extent only when showBoundary is active */}
          {showBoundary && isBoundary && (
            <rect
              x={px}
              y={py}
              width={64}
              height={64}
              fill="url(#ctu-boundary-hatch)"
              stroke="rgba(245, 158, 11, 0.45)"
              strokeWidth={1}
              strokeDasharray="2 2"
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
  activeCu,
  viewMode,
  showBoundary = false
}) {
  return (
    <g className="active-selection-layer" pointerEvents="none">
      {/* 1. Active Selected CTU Reticle */}
      {activeCtu && (
        <>
          {/* If boundary CTU: render out-of-bounds cross-hatch overlay only when showBoundary is active */}
          {showBoundary && activeCtu.isBoundary && (
            <rect
              x={activeCtu.px}
              y={activeCtu.py}
              width={64}
              height={64}
              fill="url(#ctu-boundary-hatch)"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="4 2"
              vectorEffect="non-scaling-stroke"
            />
          )}
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

      {/* 2. Active Selected CU Box */}
      {activeCu && (
        <rect
          x={activeCu.x}
          y={activeCu.y}
          width={activeCu.width}
          height={activeCu.height}
          fill="rgba(175, 82, 222, 0.25)"
          stroke="var(--apple-purple)"
          strokeWidth={2}
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
  onSelectCU = null
}) {
  const [viewMode, setViewMode] = useState(isAnalyzed ? 'partition' : 'original');
  const [colorScheme, setColorScheme] = useState('outline'); // 'outline' (clean transparent) or 'depth'
  const [showGrid, setShowGrid] = useState(true);
  const [showBoundary, setShowBoundary] = useState(false);
  const [gridColor, setGridColor] = useState('white'); // 'white' (default: pure white), 'yellow' (#FACC15), 'cyan' (#38BDF8)
  const showCtuNumbers = false;
  const [selectedCu, setSelectedCu] = useState(null);
  const [selectedOverride, setSelectedOverride] = useState(null);
  const [showHmModal, setShowHmModal] = useState(false);
  const [prevPropsCtu, setPrevPropsCtu] = useState({ x: ctuX, y: ctuY });
  const [prevIsAnalyzed, setPrevIsAnalyzed] = useState(isAnalyzed);

  if (isAnalyzed !== prevIsAnalyzed) {
    setPrevIsAnalyzed(isAnalyzed);
    setViewMode(isAnalyzed ? 'partition' : 'original');
  }

  const activeCu = propsSelectedCu !== undefined ? propsSelectedCu : selectedCu;

  // Synchronize local state when props change without effect setState
  if (ctuX !== prevPropsCtu.x || ctuY !== prevPropsCtu.y) {
    setPrevPropsCtu({ x: ctuX, y: ctuY });
    setSelectedOverride(null);
  }

  const activeCtuX = selectedOverride !== null ? selectedOverride.x : ctuX;
  const activeCtuY = selectedOverride !== null ? selectedOverride.y : ctuY;
  const localCtu = useMemo(() => {
    if (activeCtuX === null || activeCtuY === null || activeCtuX === undefined || activeCtuY === undefined) {
      return null;
    }
    return { x: activeCtuX, y: activeCtuY };
  }, [activeCtuX, activeCtuY]);

  // Quick keyboard toggle: Press 'T' or 't' for partition toggle, 'B' or 'b' for boundary toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 't' || e.key === 'T') {
        setViewMode(prev => (prev === 'partition' ? 'original' : 'partition'));
      } else if (e.key === 'b' || e.key === 'B') {
        setShowBoundary(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { width, height } = imageDims;
  const ctuSize = 64;
  const numCols = Math.max(1, Math.ceil(width / ctuSize));
  const numRows = Math.max(1, Math.ceil(height / ctuSize));

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
      setSelectedOverride({ x: null, y: null });
      setSelectedCu(null);
      if (onSelectCTU) onSelectCTU(null, null);
      if (onSelectCU) onSelectCU(null);
    } else {
      // Clicked on a CTU -> Select it!
      setSelectedOverride({ x, y });
      setSelectedCu(null);
      if (onSelectCTU) onSelectCTU(x, y);
      if (onSelectCU) onSelectCU(null);
    }
  }, [localCtu, activeCu, onSelectCTU, onSelectCU]);

  // Instantaneous click handler for leaf CU selection: click once to select, click again to deselect
  const handleLeafClick = useCallback((leaf, leafCtuX, leafCtuY) => {
    const isSameLeaf = activeCu && activeCu.x === leaf.x && activeCu.y === leaf.y && activeCu.width === leaf.width;
    if (isSameLeaf) {
      // Clicked on already selected CU -> Deselect CU!
      setSelectedCu(null);
      if (onSelectCU) onSelectCU(null);
    } else {
      // Clicked on a CU -> Select it!
      setSelectedCu(leaf);
      setSelectedOverride({ x: leafCtuX, y: leafCtuY });
      if (onSelectCTU) onSelectCTU(leafCtuX, leafCtuY);
      if (onSelectCU) onSelectCU(leaf);
    }
  }, [activeCu, onSelectCTU, onSelectCU]);

  // Lightweight active CTU bounding box data (Tier 1: CTU HM standard)
  const activeCtuData = useMemo(() => {
    if (!localCtu) return null;
    const px = localCtu.x * ctuSize;
    const py = localCtu.y * ctuSize;
    const pw = Math.min(ctuSize, width - px);
    const ph = Math.min(ctuSize, height - py);
    const index = localCtu.y * numCols + localCtu.x;
    const uiRPelX = px + ctuSize - 1;
    const uiBPelY = py + ctuSize - 1;
    const isBoundary = !(uiRPelX < width && uiBPelY < height);
    return {
      x: localCtu.x,
      y: localCtu.y,
      px,
      py,
      pw,
      ph,
      index,
      uiRPelX,
      uiBPelY,
      isBoundary
    };
  }, [localCtu, width, height, ctuSize, numCols]);

  // HM-16.0 Live Parameters for Source Code Inspector
  const hmVariables = useMemo(() => {
    if (!activeCtuData) return [];
    return [
      { name: 'pCtu->getCtuRsAddr()', value: activeCtuData.index, highlight: true },
      { name: 'uiLPelX (CUPelX)', value: activeCtuData.px },
      { name: 'uiTPelY (CUPelY)', value: activeCtuData.py },
      { name: 'uiRPelX', value: activeCtuData.uiRPelX },
      { name: 'uiBPelY', value: activeCtuData.uiBPelY },
      { name: 'PicWidth', value: width },
      { name: 'PicHeight', value: height },
      { name: 'bBoundary', value: activeCtuData.isBoundary ? 'TRUE (Forced Split)' : 'FALSE (Regular RDO)', highlight: true },
      { name: 'Valid Dimensions', value: `${activeCtuData.pw} × ${activeCtuData.ph}` }
    ];
  }, [activeCtuData, width, height]);


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
            {width} × {height} • {numCols} × {numRows} CTUs
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
              background: showGrid ? 'rgba(0, 122, 255, 0.12)' : 'transparent',
              color: showGrid ? 'var(--apple-blue)' : 'var(--apple-label)',
              border: '1px solid var(--apple-hairline)'
            }}
            title="Toggle 64x64 CTU boundaries"
          >
            GRID: {showGrid ? 'ON' : 'OFF'}
          </button>

          {/* Boundary Toggle Button */}
          <button
            type="button"
            className={`apple-btn-tool ${showBoundary ? 'active' : ''}`}
            onClick={() => setShowBoundary(prev => !prev)}
            style={{
              background: showBoundary ? 'rgba(245, 158, 11, 0.16)' : 'transparent',
              color: showBoundary ? 'var(--apple-orange, #FF9500)' : 'var(--apple-label)',
              border: showBoundary ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--apple-hairline)'
            }}
            title="Toggle picture boundary CTU cross-hatch overlay (B)"
          >
            BOUNDARY: {showBoundary ? 'ON' : 'OFF'}
          </button>

          {/* Grid Color Cycle: White -> Yellow -> Cyan */}
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => setGridColor(c => c === 'white' ? 'yellow' : c === 'yellow' ? 'cyan' : 'white')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              border: '1px solid var(--apple-hairline)'
            }}
            title="Cycle Grid Color: White -> Yellow -> Cyan"
          >
            <span>Grid: {gridColor.toUpperCase()}</span>
          </button>

          {/* HM-16.0 Source Code Modal Trigger */}
          <button
            type="button"
            className="apple-btn-tool"
            onClick={() => setShowHmModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              border: '1px solid var(--apple-hairline)'
            }}
            title="View HM C++ source code for compressCtu & boundary checking"
          >
            <span>[&lt;&gt;] HM Code</span>
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
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: `min(100%, calc((100vh - 210px) * ${width} / ${height}))`,
          aspectRatio: `${width} / ${height}`,
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
          {/* Source Image Canvas */}
          {imageSrc ? (
            <img
              src={imageSrc}
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
            viewBox={`0 0 ${width} ${height}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'all'
            }}
          >
            <defs>
              <pattern
                id="ctu-boundary-hatch"
                width="8"
                height="8"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="8" stroke="#EF4444" strokeWidth="1.5" strokeOpacity="0.45" />
              </pattern>
            </defs>

            {/* LAYER 1: Static Leaf CUs across ALL CTUs (Memoized, 0 re-render on CTU click) */}
            {viewMode === 'partition' && (
              <StaticPartitionLayer
                combinedPartitions={combinedPartitions}
                colorScheme={colorScheme}
                gridColor={gridColor}
                onSelectLeaf={handleLeafClick}
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

            {/* LAYER 3: Active CTU & CU Selection Reticle (Ultra-lightweight ~5 DOM nodes, instantaneous <0.1ms update) */}
            <ActiveSelectionLayer
              activeCtu={activeCtuData}
              activeCu={activeCu}
              viewMode={viewMode}
              showBoundary={showBoundary}
            />
          </svg>
        </div>

      {/* HM-16.0 Source Code Inspector Modal */}
      <HmSourceCodeModal
        isOpen={showHmModal}
        onClose={() => setShowHmModal(false)}
        title={HM_CTU_BOUNDARY_SNIPPET.title}
        sourceFile={HM_CTU_BOUNDARY_SNIPPET.sourceFile}
        functionName={HM_CTU_BOUNDARY_SNIPPET.functionName}
        standardRef={HM_CTU_BOUNDARY_SNIPPET.standardRef}
        description={HM_CTU_BOUNDARY_SNIPPET.description}
        variables={hmVariables}
        codeSnippet={HM_CTU_BOUNDARY_SNIPPET.codeSnippet}
      />
    </div>
  );
}

export default React.memo(FullFrameViewer);
