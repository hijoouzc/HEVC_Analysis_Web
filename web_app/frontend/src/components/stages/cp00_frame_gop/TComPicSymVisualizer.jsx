import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Badge, Button, SegmentedControl } from '../../apple';
import {
  SLICE_CONSTRAINTS,
  runTComPicSymSimulation,
  generateEdgeClampedPaddedImage,
} from '../../../utils/tcomPicSymEngine.js';

const SLICE_PALETTE = [
  { bg: 'rgba(0, 122, 255, 0.22)', flatBg: '#1D4ED8', border: '#60A5FA', badge: 'blue', name: 'Slice #0' },
  { bg: 'rgba(52, 199, 89, 0.24)', flatBg: '#047857', border: '#34D399', badge: 'green', name: 'Slice #1' },
  { bg: 'rgba(175, 82, 222, 0.24)', flatBg: '#6D28D9', border: '#C084FC', badge: 'purple', name: 'Slice #2' },
  { bg: 'rgba(255, 149, 0, 0.24)', flatBg: '#B45309', border: '#FBBF24', badge: 'orange', name: 'Slice #3' },
  { bg: 'rgba(255, 59, 48, 0.24)', flatBg: '#B91C1C', border: '#F87171', badge: 'red', name: 'Slice #4' },
  { bg: 'rgba(0, 199, 190, 0.24)', flatBg: '#0F766E', border: '#2DD4BF', badge: 'teal', name: 'Slice #5' },
];

/**
 * TComPicSymVisualizer
 * 2-Column Split Studio Layout:
 * - Left Column: Pure, uncluttered 2D Frame SVG Canvas (zero top/bottom horizontal toolbars pushing height).
 * - Right Column (Sticky Control & Telemetry Dock): Tile/Slice configuration studio, TS stepper with live
 *   address translation readout, and TComPicSym C++ memory arrays.
 */
function TComPicSymVisualizer({
  imageSrc,
  imageDims = { width: 640, height: 360 },
  ctuX = null,
  ctuY = null,
  ctuPartitionsMap = {},
  partitionData = null,
  frameGopData = [],
  onSelectCTU,
  onNavigateToQuadTree,
}) {
  const actualW = Number(imageDims?.width) || 640;
  const actualH = Number(imageDims?.height) || 360;
  const isSingleCtuSession = actualW <= 64 && actualH <= 64;

  // Tile & Slice parameters (Default: 1×1 single tile per HEVC specification)
  const [tileCols, setTileCols] = useState(1);
  const [tileRows, setTileRows] = useState(1);
  const [tileUniformSpacing, setTileUniformSpacing] = useState(true);
  const [tileCol0Width, setTileCol0Width] = useState(4);
  const [sliceMode, setSliceMode] = useState(SLICE_CONSTRAINTS.FIXED_NUMBER_OF_CTU);
  const [sliceArgument, setSliceArgument] = useState(10);
  const [respectTileBoundaries, _setRespectTileBoundaries] = useState(true);
  const [showBoundaryPadding, setShowBoundaryPadding] = useState(false);

  // Stepper & inspection states
  const [activeTsAddr, setActiveTsAddr] = useState(0);
  const [isPlayingTs, setIsPlayingTs] = useState(false);
  const [localInspectedRsAddr, setLocalInspectedRsAddr] = useState(() => {
    if (ctuX !== null && ctuX !== undefined && ctuY !== null && ctuY !== undefined) {
      const numCtuX = Math.ceil(actualW / 64);
      return ctuY * numCtuX + ctuX;
    }
    return null;
  });
  const [drawerTab, setDrawerTab] = useState('ts_map');
  const [indexDisplayMode, setIndexDisplayMode] = useState('auto'); // 'auto' | 'ts' | 'rs'
  const [showScanPath, setShowScanPath] = useState(false);
  const [showTileOverlay, setShowTileOverlay] = useState(true);
  const [flatColorMode, setFlatColorMode] = useState(false);

  const effectiveDims = useMemo(() => {
    if (isSingleCtuSession) {
      return { width: 416, height: 240, label: 'RaceHorses 416 × 240' };
    }
    return {
      width: actualW,
      height: actualH,
      label: `${actualW} × ${actualH}`,
    };
  }, [isSingleCtuSession, actualW, actualH]);

  const maxTileCols = useMemo(() => Math.ceil(effectiveDims.width / 64), [effectiveDims.width]);
  const maxTileRows = useMemo(() => Math.ceil(effectiveDims.height / 64), [effectiveDims.height]);

  const tileConfig = useMemo(() => {
    const cols = Math.max(1, Math.min(maxTileCols, Number(tileCols) || 1));
    const rows = Math.max(1, Math.min(maxTileRows, Number(tileRows) || 1));
    const isUniform = tileUniformSpacing !== false;
    return {
      uniformSpacing: isUniform,
      numCols: cols,
      numRows: rows,
      colWidths: !isUniform && cols > 1 ? [Math.max(1, Math.min(cols - 1, tileCol0Width))] : undefined,
    };
  }, [tileCols, tileRows, tileUniformSpacing, tileCol0Width, maxTileCols, maxTileRows]);

  const ctuActualBitsMap = useMemo(() => {
    const map = {};
    if (ctuPartitionsMap && typeof ctuPartitionsMap === 'object') {
      for (const [key, val] of Object.entries(ctuPartitionsMap)) {
        if (val && typeof val.ctu_actual_bits === 'number') {
          map[key] = val.ctu_actual_bits;
        }
      }
    }
    if (partitionData && typeof partitionData.ctu_actual_bits === 'number') {
      const activeX = ctuX ?? 0;
      const activeY = ctuY ?? 0;
      map[`${activeX}_${activeY}`] = partitionData.ctu_actual_bits;
    }
    return map;
  }, [ctuPartitionsMap, partitionData, ctuX, ctuY]);

  const currentFrameMeta =
    Array.isArray(frameGopData) && frameGopData.length > 0 ? frameGopData[0] : null;

  const sim = useMemo(() => {
    return runTComPicSymSimulation({
      picWidth: effectiveDims.width,
      picHeight: effectiveDims.height,
      maxCuWidth: 64,
      maxCuHeight: 64,
      maxDepth: 4,
      tileConfig,
      sliceConfig: {
        sliceMode,
        sliceArgument,
        respectTileBoundaries,
        qp: currentFrameMeta?.qp ?? 32,
        poc: currentFrameMeta?.poc ?? 0,
        sliceType: currentFrameMeta?.slice_type ? `${currentFrameMeta.slice_type}_SLICE` : 'I_SLICE',
      },
      ctuActualBitsMap,
    });
  }, [
    effectiveDims.width,
    effectiveDims.height,
    tileConfig,
    sliceMode,
    sliceArgument,
    respectTileBoundaries,
    currentFrameMeta,
    ctuActualBitsMap,
  ]);

  const { grid, tileInfo, tsRsMaps, sliceInfo, compressSteps } = sim;
  const safeTsAddr = Math.max(0, Math.min(grid.numCtusInFrame - 1, activeTsAddr));
  const currentStep = compressSteps[safeTsAddr] || compressSteps[0];

  const displayedTsToRsMap = tsRsMaps.ctuTsToRsAddrMap;
  const isTsActive = indexDisplayMode === 'auto' ? true : indexDisplayMode === 'ts';
  const visibleSlices = sliceInfo.apSlices;

  // Derive RS address from props
  const sessionRsFromProps = useMemo(() => {
    if (ctuX === null || ctuY === null || ctuX === undefined || ctuY === undefined) {
      return null;
    }
    const rs = ctuY * grid.frameWidthInCtus + ctuX;
    return rs >= 0 && rs < grid.numCtusInFrame ? rs : null;
  }, [ctuX, ctuY, grid.frameWidthInCtus, grid.numCtusInFrame]);

  const inspectedRsAddr = onSelectCTU ? sessionRsFromProps : localInspectedRsAddr;

  const handleDeselectCtu = useCallback(() => {
    setLocalInspectedRsAddr(null);
    if (onSelectCTU) {
      onSelectCTU(null, null);
    }
  }, [onSelectCTU]);

  // Auto-advance TS stepper during playback
  useEffect(() => {
    if (!isPlayingTs) return undefined;
    const timer = setInterval(() => {
      setActiveTsAddr((prev) => {
        if (prev + 1 >= grid.numCtusInFrame) {
          setIsPlayingTs(false);
          return prev;
        }
        const nextTs = prev + 1;
        const nextRs = tsRsMaps.ctuTsToRsAddrMap[nextTs];
        if (nextRs !== undefined) {
          setLocalInspectedRsAddr(nextRs);
          const ctu = grid.ctuList[nextRs];
          if (ctu && onSelectCTU) {
            onSelectCTU(ctu.col, ctu.row);
          }
        }
        return nextTs;
      });
    }, 550);
    return () => clearInterval(timer);
  }, [isPlayingTs, grid.numCtusInFrame, grid.ctuList, tsRsMaps.ctuTsToRsAddrMap, onSelectCTU]);

  const handleStepToTs = useCallback(
    (targetTs) => {
      setIsPlayingTs(false);
      const clampedTs = Math.max(0, Math.min(grid.numCtusInFrame - 1, targetTs));
      setActiveTsAddr(clampedTs);
      const nextRs = tsRsMaps.ctuTsToRsAddrMap[clampedTs];
      if (nextRs !== undefined) {
        setLocalInspectedRsAddr(nextRs);
        const ctu = grid.ctuList[nextRs];
        if (ctu && onSelectCTU) {
          onSelectCTU(ctu.col, ctu.row);
        }
      }
    },
    [grid.numCtusInFrame, grid.ctuList, tsRsMaps.ctuTsToRsAddrMap, onSelectCTU]
  );

  const handleClickCtu = useCallback(
    (rsAddr) => {
      if (inspectedRsAddr === rsAddr) {
        // Toggle OFF / Deselect!
        handleDeselectCtu();
        return;
      }

      setLocalInspectedRsAddr(rsAddr);
      const targetTs = tsRsMaps.ctuRsToTsAddrMap[rsAddr] ?? 0;
      setActiveTsAddr(targetTs);
      const ctu = grid.ctuList[rsAddr];
      if (ctu && onSelectCTU) {
        onSelectCTU(ctu.col, ctu.row);
      }
    },
    [inspectedRsAddr, handleDeselectCtu, tsRsMaps.ctuRsToTsAddrMap, grid.ctuList, onSelectCTU]
  );

  const inspectedCtuStep = useMemo(() => {
    if (inspectedRsAddr === null || inspectedRsAddr === undefined) return null;
    const targetRs = inspectedRsAddr;
    const ts = tsRsMaps.ctuRsToTsAddrMap[targetRs] ?? 0;
    return compressSteps[ts] || null;
  }, [inspectedRsAddr, tsRsMaps.ctuRsToTsAddrMap, compressSteps]);

  const [paddedImageSrc, setPaddedImageSrc] = useState(null);

  useEffect(() => {
    if (!imageSrc || !showBoundaryPadding || (grid.rightPadding <= 0 && grid.bottomPadding <= 0)) {
      return;
    }
    let isCurrent = true;
    generateEdgeClampedPaddedImage(
      imageSrc,
      grid.picWidth,
      grid.picHeight,
      grid.nominalWidth,
      grid.nominalHeight
    ).then((src) => {
      if (isCurrent) {
        setPaddedImageSrc(src);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [imageSrc, showBoundaryPadding, grid.picWidth, grid.picHeight, grid.nominalWidth, grid.nominalHeight, grid.rightPadding, grid.bottomPadding]);

  const viewW = showBoundaryPadding ? grid.nominalWidth : grid.picWidth;
  const viewH = showBoundaryPadding ? grid.nominalHeight : grid.picHeight;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 340px',
        gap: '12px',
        alignItems: 'start',
        width: '100%',
        boxSizing: 'border-box',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* LEFT COLUMN: Pure, Uncluttered 2D Frame Canvas Card */}
      <div
        className="apple-card"
        style={{
          padding: '0.75rem 0.9rem',
          background: 'var(--apple-surface)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--apple-shadow-card)',
        }}
      >
        {/* Minimal Title Strip above Canvas */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '0.55rem',
            paddingBottom: '0.5rem',
            borderBottom: '1px solid var(--apple-hairline)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--apple-label)' }}>
              Tile &amp; Slice Map — {effectiveDims.label}
            </h2>
            <Badge variant="blue" style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}>
              {grid.frameWidthInCtus}×{grid.frameHeightInCtus} = {grid.numCtusInFrame} CTUs
            </Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="apple-btn-tool"
              onClick={() =>
                setIndexDisplayMode((m) =>
                  m === 'auto' ? 'rs' : m === 'ts' ? 'rs' : 'ts'
                )
              }
              style={{
                height: '24px',
                padding: '0 7px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: isTsActive ? 'rgba(250, 204, 21, 0.16)' : 'var(--fill-4)',
                color: isTsActive ? '#B45309' : 'var(--apple-label)',
                border: isTsActive
                  ? '1px solid rgba(250, 204, 21, 0.45)'
                  : '1px solid var(--apple-hairline)',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Toggle between Tile Scan order (ctuTsAddr) and Raster Scan order (ctuRsAddr)"
            >
              <span>INDEX:</span>
              <span>{isTsActive ? 'Tile Scan' : 'Raster'}</span>
            </button>

            <button
              type="button"
              className="apple-btn-tool"
              onClick={() => setFlatColorMode((f) => !f)}
              style={{
                height: '24px',
                padding: '0 7px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: flatColorMode ? 'rgba(99, 102, 241, 0.16)' : 'var(--fill-4)',
                color: flatColorMode ? '#4F46E5' : 'var(--apple-label)',
                border: flatColorMode
                  ? '1px solid rgba(99, 102, 241, 0.45)'
                  : '1px solid var(--apple-hairline)',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Toggle between Flat Solid Colors and Picture Overlay"
            >
              <span>COLOR:</span>
              <span>{flatColorMode ? 'Flat Solid' : 'Picture Overlay'}</span>
            </button>

            <button
              type="button"
              className={`apple-btn-tool ${showScanPath ? 'active' : ''}`}
              onClick={() => setShowScanPath((p) => !p)}
              style={{
                height: '24px',
                padding: '0 7px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: showScanPath ? 'var(--apple-blue-subtle)' : 'var(--fill-4)',
                color: showScanPath ? 'var(--apple-blue)' : 'var(--apple-label)',
                border: showScanPath
                  ? '1px solid var(--apple-blue)'
                  : '1px solid var(--apple-hairline)',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Toggle visual Tile Scan coding path trajectory"
            >
              Scan Path: {showScanPath ? 'ON' : 'OFF'}
            </button>

            {tsRsMaps.enrichedTiles.length > 1 && (
              <button
                type="button"
                className={`apple-btn-tool ${showTileOverlay ? 'active' : ''}`}
                onClick={() => setShowTileOverlay((o) => !o)}
                style={{
                  height: '24px',
                  padding: '0 7px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  background: showTileOverlay ? 'var(--apple-orange-subtle)' : 'var(--fill-4)',
                  color: showTileOverlay ? 'var(--apple-orange)' : 'var(--apple-label)',
                  border: showTileOverlay
                    ? '1px solid var(--apple-orange)'
                    : '1px solid var(--apple-hairline)',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                title="Toggle Tile boundaries and labels"
              >
                Tiles: {showTileOverlay ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
        </div>

        {/* Interactive Frame Canvas Viewport */}
        <div
          onClick={handleDeselectCtu}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: `min(100%, calc((100vh - 190px) * ${viewW} / ${viewH}))`,
            aspectRatio: `${viewW} / ${viewH}`,
            margin: '0 auto',
            border: '1px solid var(--apple-hairline)',
            background: 'var(--apple-canvas)',
            cursor: 'default',
            userSelect: 'none',
            overflow: 'hidden',
            boxSizing: 'border-box',
            lineHeight: 0,
          }}
        >
          {imageSrc && !flatColorMode ? (
            <img
              src={showBoundaryPadding && paddedImageSrc ? paddedImageSrc : imageSrc}
              alt="Source Frame"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                display: 'block',
                imageRendering: 'pixelated',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: flatColorMode
                  ? '#0F172A'
                  : 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)',
              }}
            />
          )}

          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'all',
            }}
          >
            <defs>
              <marker
                id="ts-arrow-head"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="4.5"
                markerHeight="4.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#FACC15" stroke="#000000" strokeWidth="0.6" />
              </marker>
            </defs>

            {/* Edge Padding Delineation Lines, Subtle Tint & Badges (Active when showBoundaryPadding is ON) */}
            {showBoundaryPadding && grid.rightPadding > 0 && (
              <g className="picsym-padding-right">
                <line
                  x1={grid.picWidth}
                  y1={0}
                  x2={grid.picWidth}
                  y2={grid.nominalHeight}
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <rect
                  x={grid.picWidth}
                  y={0}
                  width={grid.rightPadding}
                  height={grid.nominalHeight}
                  fill="rgba(245, 158, 11, 0.08)"
                  pointerEvents="none"
                />
                <text
                  x={grid.picWidth + grid.rightPadding / 2}
                  y={14}
                  fill="#F59E0B"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                  textAnchor="middle"
                  stroke="#000000"
                  strokeWidth={1.2}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  +{grid.rightPadding}px
                </text>
              </g>
            )}
            {showBoundaryPadding && grid.bottomPadding > 0 && (
              <g className="picsym-padding-bottom">
                <line
                  x1={0}
                  y1={grid.picHeight}
                  x2={grid.nominalWidth}
                  y2={grid.picHeight}
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <rect
                  x={0}
                  y={grid.picHeight}
                  width={grid.picWidth}
                  height={grid.bottomPadding}
                  fill="rgba(245, 158, 11, 0.08)"
                  pointerEvents="none"
                />
                <text
                  x={14}
                  y={grid.picHeight + grid.bottomPadding / 2 + 3}
                  fill="#F59E0B"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                  textAnchor="start"
                  stroke="#000000"
                  strokeWidth={1.2}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  +{grid.bottomPadding}px
                </text>
              </g>
            )}

            {grid.ctuList.map((ctu) => {
              const rs = ctu.rsAddr;
              const ts = tsRsMaps.ctuRsToTsAddrMap[rs];
              const sliceIdx = sliceInfo.ctuSliceMap[rs] ?? 0;

              const cellW = showBoundaryPadding ? ctu.nominalW : ctu.validW;
              const cellH = showBoundaryPadding ? ctu.nominalH : ctu.validH;

              const isPlayhead = isPlayingTs && currentStep?.ctuRsAddr === rs;
              const isInspected = inspectedRsAddr === rs;

              const pal = SLICE_PALETTE[sliceIdx % SLICE_PALETTE.length];
              const cellFill = flatColorMode ? pal.flatBg : pal.bg;
              const cellStroke = flatColorMode ? (isInspected ? '#38BDF8' : pal.border) : pal.border;

              return (
                <g
                  key={rs}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClickCtu(rs);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={ctu.px}
                    y={ctu.py}
                    width={cellW}
                    height={cellH}
                    fill={cellFill}
                    stroke={isInspected ? '#007AFF' : isPlayhead ? '#FACC15' : cellStroke}
                    strokeWidth={isInspected ? 2.5 : isPlayhead ? 2.0 : 1.25}
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Single Clean Index Number (FullFrameViewer minimalist style) */}
                  <text
                    x={ctu.px + 4}
                    y={ctu.py + 13}
                    fill={isTsActive ? '#FEF08A' : '#FFFFFF'}
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="800"
                    stroke="#000000"
                    strokeWidth={2}
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    {isTsActive ? ts : rs}
                  </text>
                </g>
              );
            })}

            {showTileOverlay &&
              tsRsMaps.enrichedTiles.length > 1 &&
              tsRsMaps.enrichedTiles.map((tile) => {
                const tx = tile.firstCtuX * grid.maxCuWidth;
                const ty = tile.firstCtuY * grid.maxCuHeight;
                const rawTw = tile.tileWidthInCtus * grid.maxCuWidth;
                const rawTh = tile.tileHeightInCtus * grid.maxCuHeight;
                const tw = showBoundaryPadding ? rawTw : Math.min(rawTw, grid.picWidth - tx);
                const th = showBoundaryPadding ? rawTh : Math.min(rawTh, grid.picHeight - ty);
                const isNonCompliant = !tile.isHevcMainProfileCompliant;
                const badgeW = isNonCompliant ? 52 : 42;
                const badgeH = 13;
                // Position in bottom-right corner of each Tile to guarantee zero overlap with top-left CTU index numbers!
                const bx = tx + tw - badgeW - 4;
                const by = ty + th - badgeH - 4;
                return (
                  <g key={`tile-border-${tile.tileIdx}`} pointerEvents="none">
                    {/* Tile Boundary Delineation */}
                    <rect
                      x={tx + 1}
                      y={ty + 1}
                      width={Math.max(1, tw - 2)}
                      height={Math.max(1, th - 2)}
                      fill="none"
                      stroke={isNonCompliant ? '#D97706' : '#FF9500'}
                      strokeWidth={flatColorMode ? 3 : 2}
                      strokeDasharray={isNonCompliant ? '5 3' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Compact, Non-obtrusive Translucent Glass Pill in Bottom-Right Corner */}
                    <rect
                      x={bx}
                      y={by}
                      width={badgeW}
                      height={badgeH}
                      rx="3"
                      fill="rgba(15, 23, 42, 0.78)"
                      stroke={isNonCompliant ? '#D97706' : '#FF9500'}
                      strokeWidth="1"
                    />
                    <text
                      x={bx + badgeW / 2}
                      y={by + 9.5}
                      fill={isNonCompliant ? '#FDE68A' : '#FFFFFF'}
                      fontSize="8"
                      fontWeight="800"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      {isNonCompliant ? `T${tile.tileIdx} ⚠️` : `TILE ${tile.tileIdx}`}
                    </text>
                  </g>
                );
              })}

            {showScanPath && grid.numCtusInFrame > 1 && (
              <g pointerEvents="none">
                {compressSteps
                  .slice(0, grid.numCtusInFrame - 1)
                  .map((st, idx) => {
                    const nextStep = compressSteps[idx + 1];
                    if (!nextStep) return null;
                    const x1 = st.px + (showBoundaryPadding ? 32 : st.validW / 2);
                    const y1 = st.py + (showBoundaryPadding ? 32 : st.validH / 2);
                    const x2 = nextStep.px + (showBoundaryPadding ? 32 : nextStep.validW / 2);
                    const y2 = nextStep.py + (showBoundaryPadding ? 32 : nextStep.validH / 2);
                    const isCrossTileJump = nextStep.tileIdx !== st.tileIdx;
                    return (
                      <line
                        key={`ts-vec-${st.ctuTsAddr}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isCrossTileJump ? '#FF3B30' : '#FACC15'}
                        strokeWidth={isCrossTileJump ? '2.2' : '1.4'}
                        strokeDasharray={isCrossTileJump ? '4,2' : undefined}
                        markerEnd="url(#ts-arrow-head)"
                        vectorEffect="non-scaling-stroke"
                        opacity={isCrossTileJump ? 1 : 0.65}
                      />
                    );
                  })}
              </g>
            )}
          </svg>
        </div>

        {/* Concise Configuration Footer */}
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '11px',
            color: 'var(--apple-label-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span>
            {tileInfo.numTiles} tile(s) ({tileInfo.numCols} col × {tileInfo.numRows} row) • {visibleSlices.length} slice(s)
          </span>
          <span style={{ fontSize: '10px', color: 'var(--apple-label-tertiary)' }}>
            Click CTU to inspect • Stepper advances in Tile Scan (TS) order
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN: Sticky Control & C++ Memory Dock (No vertical scrolling needed) */}
      <aside
        style={{
          position: 'sticky',
          top: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Dock Card 1: Tile & Slice Configuration Studio */}
        <div
          className="stage-section-card"
          style={{
            padding: '10px 12px',
            background: 'var(--apple-surface)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: 'var(--card-radius)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--apple-label-tertiary)' }}>
              1. TILE &amp; SLICE CONFIGURATION
            </span>
            <button
              type="button"
              onClick={() => setShowBoundaryPadding((p) => !p)}
              title="Toggle right/bottom boundary padding"
              style={{
                fontSize: '9.5px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: '4px',
                background: showBoundaryPadding ? 'var(--apple-orange-subtle)' : 'var(--fill-4)',
                color: showBoundaryPadding ? 'var(--apple-orange)' : 'var(--apple-label-secondary)',
                border: '1px solid var(--apple-hairline)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Padding: {showBoundaryPadding ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Tile Grid & Slice Mode Selectors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* PPS Tiles: C × R & 1×1 Default */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
                PPS Tiles:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-tertiary)' }}>Cols</span>
                <input
                  type="number"
                  min="1"
                  max={maxTileCols}
                  value={tileCols}
                  onChange={(e) => {
                    const c = Math.max(1, Math.min(maxTileCols, Number(e.target.value) || 1));
                    setTileCols(c);
                    setActiveTsAddr(0);
                  }}
                  style={{
                    width: '36px',
                    height: '24px',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'center',
                    padding: '0 2px',
                    borderRadius: '4px',
                    background: 'var(--fill-4)',
                    color: 'var(--apple-label)',
                    border: '1px solid var(--apple-hairline)',
                    boxSizing: 'border-box',
                  }}
                  title={`NumTileColumnsMinus1 + 1 (1..${maxTileCols})`}
                />
                <span style={{ fontSize: '10.5px', color: 'var(--apple-label-tertiary)' }}>×</span>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-tertiary)' }}>Rows</span>
                <input
                  type="number"
                  min="1"
                  max={maxTileRows}
                  value={tileRows}
                  onChange={(e) => {
                    const r = Math.max(1, Math.min(maxTileRows, Number(e.target.value) || 1));
                    setTileRows(r);
                    setActiveTsAddr(0);
                  }}
                  style={{
                    width: '36px',
                    height: '24px',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'center',
                    padding: '0 2px',
                    borderRadius: '4px',
                    background: 'var(--fill-4)',
                    color: 'var(--apple-label)',
                    border: '1px solid var(--apple-hairline)',
                    boxSizing: 'border-box',
                  }}
                  title={`NumTileRowsMinus1 + 1 (1..${maxTileRows})`}
                />
                {tileCols > 1 || tileRows > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTileCols(1);
                      setTileRows(1);
                      setTileUniformSpacing(true);
                      setActiveTsAddr(0);
                    }}
                    title="Reset to HEVC Default (1×1 Single Tile)"
                    style={{
                      height: '24px',
                      padding: '0 6px',
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '4px',
                      background: 'var(--apple-blue-subtle)',
                      color: 'var(--apple-blue)',
                      border: '1px solid var(--apple-hairline)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ↺ 1×1 Default
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--apple-label-tertiary)',
                      padding: '0 4px',
                    }}
                  >
                    (1 Tile Default)
                  </span>
                )}
              </div>
            </div>

            {/* Spacing Mode (Only visible when partitioned into > 1 Tile) */}
            {(tileCols > 1 || tileRows > 1) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
                  Spacing:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setTileUniformSpacing(true)}
                    style={{
                      height: '22px',
                      padding: '0 6px',
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '4px',
                      background: tileUniformSpacing ? 'var(--apple-blue-subtle)' : 'var(--fill-4)',
                      color: tileUniformSpacing ? 'var(--apple-blue)' : 'var(--apple-label-secondary)',
                      border: tileUniformSpacing ? '1px solid var(--apple-blue)' : '1px solid var(--apple-hairline)',
                      cursor: 'pointer',
                      fontWeight: tileUniformSpacing ? 700 : 500,
                    }}
                    title="TileUniformSpacing = 1 (Automatic arithmetic division of CTUs)"
                  >
                    Uniform (1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTileUniformSpacing(false)}
                    style={{
                      height: '22px',
                      padding: '0 6px',
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '4px',
                      background: !tileUniformSpacing ? 'var(--apple-orange-subtle)' : 'var(--fill-4)',
                      color: !tileUniformSpacing ? 'var(--apple-orange)' : 'var(--apple-label-secondary)',
                      border: !tileUniformSpacing ? '1px solid var(--apple-orange)' : '1px solid var(--apple-hairline)',
                      cursor: 'pointer',
                      fontWeight: !tileUniformSpacing ? 700 : 500,
                    }}
                    title="TileUniformSpacing = 0 (Explicit TileColumnWidthArray)"
                  >
                    Non-Uniform (0)
                  </button>
                  {!tileUniformSpacing && tileCols > 1 && (
                    <input
                      type="number"
                      min="1"
                      max={maxTileCols - 1}
                      value={tileCol0Width}
                      onChange={(e) => {
                        const w = Math.max(1, Math.min(maxTileCols - 1, Number(e.target.value) || 1));
                        setTileCol0Width(w);
                        setActiveTsAddr(0);
                      }}
                      style={{
                        width: '38px',
                        height: '22px',
                        fontSize: '9.5px',
                        fontFamily: 'var(--font-mono)',
                        textAlign: 'center',
                        padding: '0 2px',
                        borderRadius: '4px',
                        background: 'var(--fill-4)',
                        color: 'var(--apple-label)',
                        border: '1px solid var(--apple-hairline)',
                        boxSizing: 'border-box',
                      }}
                      title={`TileColumnWidth[0] in CTUs (1..${maxTileCols - 1})`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* HEVC Main Profile Minimum Tile Size Warning (HM-18.0 TComPicSym.cpp:371-391) */}
            {!tileInfo.isHevcMainProfileCompliant && (
              <div
                style={{
                  padding: '6px 8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.45)',
                  borderRadius: '5px',
                  fontSize: '9.5px',
                  color: '#B45309',
                  lineHeight: 1.4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                  <span>⚠️</span>
                  <span>HEVC Main Profile Limit (ITU-T H.265 Annex A)</span>
                </div>
                <div style={{ fontSize: '9px' }}>
                  {tileInfo.nonCompliantTiles.map((t) => (
                    <div key={`warn-tile-${t.tileIdx}`}>
                      • Tile #{t.tileIdx}: {t.tileWidthInPixels}×{t.tileHeightInPixels}px ({t.tileWidthInCtus}×{t.tileHeightInCtus} CTUs)
                      {t.isWidthViolated ? ' — Width < 256px min' : ''}
                      {t.isHeightViolated ? ' — Height < 64px min' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
                SliceMode:
              </span>
              <select
                value={sliceMode}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setSliceMode(m);
                  setActiveTsAddr(0);
                  if (m === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_CTU) setSliceArgument(10);
                  if (m === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES) setSliceArgument(950);
                  if (m === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_TILES) setSliceArgument(1);
                }}
                style={{
                  flex: 1,
                  height: '25px',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  padding: '0 6px',
                  borderRadius: '5px',
                  background: 'var(--fill-4)',
                  color: 'var(--apple-label)',
                  border: '1px solid var(--apple-hairline)',
                }}
              >
                <option value={SLICE_CONSTRAINTS.NO_SLICES}>0: NO_SLICES</option>
                <option value={SLICE_CONSTRAINTS.FIXED_NUMBER_OF_CTU}>1: FIXED_NUMBER_OF_CTU</option>
                <option value={SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES}>2: FIXED_NUMBER_OF_BYTES</option>
                <option value={SLICE_CONSTRAINTS.FIXED_NUMBER_OF_TILES}>3: FIXED_NUMBER_OF_TILES</option>
              </select>

              {sliceMode !== SLICE_CONSTRAINTS.NO_SLICES && (
                <input
                  type="number"
                  min={sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES ? 200 : 1}
                  max={sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES ? 10000 : grid.numCtusInFrame}
                  step={sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES ? 50 : 1}
                  value={sliceArgument}
                  onChange={(e) => {
                    setSliceArgument(Math.max(1, Number(e.target.value) || 1));
                  }}
                  style={{
                    width: '54px',
                    height: '25px',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    padding: '0 5px',
                    borderRadius: '5px',
                    background: 'var(--fill-4)',
                    color: 'var(--apple-label)',
                    border: '1px solid var(--apple-hairline)',
                    boxSizing: 'border-box',
                  }}
                  title={
                    sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_CTU
                      ? 'SliceArgument: max number of CTUs per slice'
                      : sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_BYTES
                        ? 'SliceArgument: max number of bytes per slice (MTU)'
                        : sliceMode === SLICE_CONSTRAINTS.FIXED_NUMBER_OF_TILES
                          ? 'SliceArgument: number of tiles per slice'
                          : 'SliceArgument'
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* Dock Card 2: compressSlice() TS Loop Stepper & Inspected CTU Telemetry */}
        <div
          className="stage-section-card"
          style={{
            padding: '10px 12px',
            background: 'var(--apple-surface)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: 'var(--card-radius)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--apple-label-tertiary)' }}>
              2. compressSlice() STEPPER
            </span>
            <Badge
              variant="yellow"
              style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}
              title={`ctuTsAddr = ${safeTsAddr}`}
            >
              CTU #{safeTsAddr} / {grid.numCtusInFrame - 1} (TS)
            </Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Button
              variant="tinted"
              size="mini"
              onClick={() => handleStepToTs(0)}
              style={{ fontSize: '10px', flex: 1, justifyContent: 'center' }}
            >
              ↺ TS=0
            </Button>
            <Button
              variant="tinted"
              size="mini"
              disabled={safeTsAddr <= 0}
              onClick={() => handleStepToTs(safeTsAddr - 1)}
              style={{ fontSize: '10px', flex: 1, justifyContent: 'center' }}
            >
              ◀ Prev
            </Button>
            <Button
              variant="primary"
              size="mini"
              onClick={() => {
                setIsPlayingTs((p) => !p);
              }}
              style={{ fontSize: '10px', flex: 1.4, justifyContent: 'center' }}
            >
              {isPlayingTs ? '⏸ Pause' : '▶ Play TS'}
            </Button>
            <Button
              variant="tinted"
              size="mini"
              disabled={safeTsAddr >= grid.numCtusInFrame - 1}
              onClick={() => handleStepToTs(safeTsAddr + 1)}
              style={{ fontSize: '10px', flex: 1, justifyContent: 'center' }}
            >
              Next ▶
            </Button>
          </div>

          {inspectedCtuStep ? (
            <div
              style={{
                padding: '8px',
                borderRadius: '6px',
                background: 'var(--fill-4)',
                border: '1px solid var(--apple-hairline)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong
                  style={{ color: 'var(--apple-blue)' }}
                  title={`m_pictureCtuArray[${inspectedCtuStep.ctuRsAddr}]`}
                >
                  CTU #{inspectedCtuStep.ctuRsAddr} (Raster)
                </strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--apple-label-secondary)' }}>
                    ({inspectedCtuStep.col}, {inspectedCtuStep.row}) · {inspectedCtuStep.validW}×{inspectedCtuStep.validH}px
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeselectCtu();
                    }}
                    title="Deselect CTU"
                    style={{
                      border: 'none',
                      background: 'var(--fill-3)',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: 'var(--apple-label-secondary)',
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div
                style={{ color: 'var(--apple-label-secondary)' }}
                title={`m_ctuTsToRsAddrMap[${inspectedCtuStep.ctuTsAddr}] = ${inspectedCtuStep.ctuRsAddr}`}
              >
                • Address: <strong style={{ color: 'var(--apple-label)' }}>Tile Scan TS: {inspectedCtuStep.ctuTsAddr} ↔ Raster RS: {inspectedCtuStep.ctuRsAddr}</strong>
              </div>
              <div
                style={{ color: 'var(--apple-label-secondary)' }}
                title={`m_puiTileIdxMap[${inspectedCtuStep.ctuRsAddr}] = ${inspectedCtuStep.tileIdx}, m_apSlices[${inspectedCtuStep.sliceIdx}]`}
              >
                • Region: <strong style={{ color: 'var(--apple-orange)' }}>Tile #{inspectedCtuStep.tileIdx}</strong> · <strong style={{ color: 'var(--apple-blue)' }}>Slice #{inspectedCtuStep.sliceIdx}</strong>
              </div>
              <div style={{ color: 'var(--apple-label-secondary)' }}>
                • Bitstream: <strong style={{ color: 'var(--apple-label)' }}>{inspectedCtuStep.ctuBits.toLocaleString()} b</strong> (Slice Total: {inspectedCtuStep.cumulativeSliceBytes} B)
              </div>

              {onNavigateToQuadTree && (
                <Button
                  variant="primary"
                  size="mini"
                  onClick={() => {
                    const targetX = inspectedCtuStep.col;
                    const targetY = inspectedCtuStep.row;
                    onNavigateToQuadTree(targetX, targetY);
                  }}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '10px', marginTop: '2px' }}
                >
                  Inspect CU QuadTree (xCompressCU) &rarr;
                </Button>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: '10px 8px',
                borderRadius: '6px',
                background: 'var(--fill-4)',
                border: '1px dashed var(--apple-hairline)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--apple-label-secondary)',
                textAlign: 'center',
              }}
            >
              No CTU selected • Click any CTU cell on the frame to inspect
            </div>
          )}
        </div>

        {/* Dock Card 3: Compact Tabbed TComPicSym C++ Memory Inspector */}
        <div
          className="stage-section-card"
          style={{
            padding: '10px 12px',
            background: 'var(--apple-surface)',
            border: '1px solid var(--apple-hairline)',
            borderRadius: 'var(--card-radius)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* TComPicSym C++ MEMORY ARRAYS */}
            <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--apple-label-tertiary)' }}>
              3. TComPicSym MEMORY ARRAYS
            </span>
            <SegmentedControl
              size="small"
              value={drawerTab}
              onChange={setDrawerTab}
              items={[
                { id: 'ts_map', label: 'TS→RS Map' },
                { id: 'slices', label: `Slices (${visibleSlices.length})` },
                { id: 'tiles', label: `Tiles (${tsRsMaps.enrichedTiles.length})` },
              ]}
            />
          </div>

          {drawerTab === 'ts_map' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
                gap: '3px',
                maxHeight: '135px',
                overflowY: 'auto',
              }}
            >
              {displayedTsToRsMap.map((rsVal, tsIdx) => {
                const isSentinel = tsIdx === grid.numCtusInFrame;
                const isInspectedCell = !isSentinel && inspectedRsAddr === rsVal;
                const isPlayheadCell = !isSentinel && isPlayingTs && tsIdx === safeTsAddr;
                const tileIdx = isSentinel ? '-' : tileInfo.tileIdxMap[rsVal];
                return (
                  <button
                    key={`ts-cell-${tsIdx}`}
                    type="button"
                    title={
                      isSentinel
                        ? `Sentinel guard: m_ctuTsToRsAddrMap[${tsIdx}] = ${rsVal} (TComPicSym.cpp:314)`
                        : `TS:${tsIdx} -> RS:${rsVal} (Tile ${tileIdx}, m_puiTileIdxMap)`
                    }
                    onClick={() => {
                      if (!isSentinel) {
                        handleClickCtu(rsVal);
                      }
                    }}
                    style={{
                      padding: '3px 2px',
                      borderRadius: '4px',
                      border: isInspectedCell
                        ? '1.5px solid var(--apple-blue)'
                        : isPlayheadCell
                          ? '1.5px solid #FACC15'
                          : isSentinel
                            ? '1px dashed var(--apple-purple)'
                            : '1px solid var(--apple-hairline)',
                      background: isInspectedCell
                        ? 'var(--apple-blue-subtle)'
                        : isPlayheadCell
                          ? 'rgba(250, 204, 21, 0.15)'
                          : isSentinel
                            ? 'var(--apple-purple-subtle)'
                            : 'var(--fill-4)',
                      cursor: isSentinel ? 'default' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--apple-label)',
                    }}
                  >
                    <span style={{ color: isSentinel ? 'var(--apple-purple)' : 'var(--apple-blue)', fontWeight: 700 }}>
                      {isSentinel ? 'Sentinel' : `TS:${tsIdx}`}
                    </span>
                    <span style={{ fontWeight: 700 }}>RS:{rsVal}</span>
                    <span style={{ fontSize: '8px', color: 'var(--apple-label-secondary)' }}>
                      {isSentinel ? 'END' : `T${tileIdx}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {drawerTab === 'slices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '135px', overflowY: 'auto' }}>
              {visibleSlices.map((sl) => {
                const pal = SLICE_PALETTE[sl.sliceIdx % SLICE_PALETTE.length];
                return (
                  <div
                    key={`slice-item-${sl.sliceIdx}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      padding: '5px 7px',
                      borderRadius: '4px',
                      background: flatColorMode ? pal.flatBg : pal.bg,
                      border: `1px solid ${pal.border}`,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9.5px',
                      color: flatColorMode ? '#FFFFFF' : 'var(--apple-label)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong title={`m_apSlices[${sl.sliceIdx}]`}>Slice #{sl.sliceIdx}</strong>
                      <span>
                        TS[{sl.startCtuTsAddr}..{sl.endCtuTsAddr}) ({sl.numCtus} CTUs)
                      </span>
                    </div>
                    <div style={{ color: 'var(--apple-label-secondary)', fontSize: '9px' }}>
                      {sl.totalBytes} B ({sl.totalBits} b)
                      {sl.terminatedByTileBoundary ? ' · [Tile Boundary]' : ''}
                      {sl.terminatedByByteLimit ? ' · [Byte Limit (MTU)]' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {drawerTab === 'tiles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '135px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9.5px' }}>
              {tsRsMaps.enrichedTiles.map((t) => (
                <div
                  key={`tile-meta-${t.tileIdx}`}
                  style={{
                    padding: '5px 7px',
                    borderRadius: '4px',
                    background: 'var(--apple-orange-subtle)',
                    border: '1px solid var(--apple-orange)',
                    color: 'var(--apple-label)',
                  }}
                >
                  <strong style={{ color: 'var(--apple-orange)' }} title={`m_tileParameters[${t.tileIdx}]`}>
                    Tile #{t.tileIdx}
                  </strong>{' '}
                  ({t.tileWidthInCtus}×{t.tileHeightInCtus} CTUs · {t.tileWidthInPixels}×{t.tileHeightInPixels}px)
                  {!t.isHevcMainProfileCompliant && (
                    <span style={{ color: '#D97706', fontWeight: 700, marginLeft: '4px' }}>
                      [⚠️ Non-compliant: {t.isWidthViolated ? '<256px' : ''}{t.isHeightViolated ? '<64px' : ''}]
                    </span>
                  )}
                  <div style={{ fontSize: '9px', color: 'var(--apple-label-secondary)' }}>
                    Origin: RS {t.firstCtuRsAddr} · Bounds: cols 0..{t.rightEdgePosInCtus}, rows 0..{t.bottomEdgePosInCtus} · TS [{t.startCtuTsAddr}..{t.endCtuTsAddr})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default React.memo(TComPicSymVisualizer);
