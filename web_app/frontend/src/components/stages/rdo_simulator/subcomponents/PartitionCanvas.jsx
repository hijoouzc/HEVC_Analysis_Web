import React, { useRef, useEffect, useMemo } from 'react';
import { HEVC_DEPTH_COLORS } from '../../../../utils/colorUtils';
import { buildSimulatorQuadtreeTree } from '../../../../utils/quadtreeTreeLayout';

/**
 * PartitionCanvas
 * 64x64 CTU spatial partitioning canvas with SVG quadtree subdivision overlay.
 * Adheres strictly to hevc-pixel-accurate-design:
 * - imageSmoothingEnabled = false, image-rendering: pixelated.
 * - Neutral chrome, thin hairline borders.
 * - Progressive quadtree traversal avoiding ghost/pruned trial splits.
 * - Inset active node bounds preventing outer edge clipping and 8x8 interior occlusion.
 * - Zero hover bounces or decorative glowing halos.
 */
function PartitionCanvas({
  activeCtuPatch,
  currentStep,
  activeNode = {},
  treeRoot = null
}) {
  const dConf = HEVC_DEPTH_COLORS[activeNode?.depth] || HEVC_DEPTH_COLORS[0];
  const canvasRef = useRef(null);

  // Fallback to building progressive quadtree if treeRoot not directly provided
  const effectiveTreeRoot = useMemo(() => {
    if (treeRoot) return treeRoot;
    return buildSimulatorQuadtreeTree(currentStep?.treeSnapshot, activeNode?.id, currentStep?.callStack);
  }, [treeRoot, currentStep?.treeSnapshot, activeNode?.id, currentStep?.callStack]);

  // Extract only genuine progressive split nodes from the hierarchical tree
  const splitNodes = useMemo(() => {
    const splits = [];
    if (!effectiveTreeRoot) return splits;

    function traverse(n) {
      if (!n) return;
      if (n.isSplit && n.children && n.children.length > 0) {
        splits.push(n);
        for (const child of n.children) {
          traverse(child);
        }
      }
    }

    traverse(effectiveTreeRoot);
    return splits;
  }, [effectiveTreeRoot]);

  // Redraw canvas ONLY when activeCtuPatch actually changes (zero redraw during timeline step progression)
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !activeCtuPatch || activeCtuPatch.length !== 4096) return;
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const imgData = ctx.createImageData(64, 64);
    for (let i = 0; i < 4096; i++) {
      const v = activeCtuPatch[i];
      const idx = i * 4;
      imgData.data[idx] = v;
      imgData.data[idx + 1] = v;
      imgData.data[idx + 2] = v;
      imgData.data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }, [activeCtuPatch]);

  return (
    <div className="apple-card" style={{
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.55rem',
      height: '315px',
      minHeight: '315px',
      maxHeight: '315px',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '22px', flexShrink: 0, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--apple-label-primary)', whiteSpace: 'nowrap' }}>Partition QuadTree (64×64)</span>
        <span style={{
          fontSize: '11px',
          color: dConf.text,
          background: dConf.bgSolid,
          border: `0.5px solid ${dConf.border}`,
          borderRadius: '4px',
          padding: '1px 6px',
          fontFamily: 'JetBrains Mono',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 700,
          width: '105px',
          minWidth: '105px',
          textAlign: 'center',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box'
        }}>
          Depth {activeNode?.depth ?? 0} ({activeNode?.size ?? 64}×{activeNode?.size ?? 64})
        </span>
      </div>

      <div style={{
        position: 'relative',
        width: '256px',
        height: '256px',
        margin: '0 auto',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: '4px',
        overflow: 'hidden',
        background: '#000000'
      }}>
        {/* Discrete 64x64 pixel canvas */}
        <canvas
          ref={canvasRef}
          width="64"
          height="64"
          className="pixelated"
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />

        {/* SVG Quadtree overlay */}
        <svg
          viewBox="0 0 64 64"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        >
          {/* Split boundary divider lines (pixel-accurate crosshairs) */}
          {splitNodes.map((n) => {
            const half = n.size / 2;
            const x = n.relX ?? n.absX ?? n.x ?? 0;
            const y = n.relY ?? n.absY ?? n.y ?? 0;
            const midX = x + half;
            const midY = y + half;
            const endX = x + n.size;
            const endY = y + n.size;

            return (
              <g key={n.id}>
                {/* Crisp dark background underlay for high contrast on light pixels */}
                <line
                  x1={midX}
                  y1={y}
                  x2={midX}
                  y2={endY}
                  stroke="rgba(0, 0, 0, 0.75)"
                  strokeWidth="0.8"
                  shapeRendering="crispEdges"
                />
                <line
                  x1={x}
                  y1={midY}
                  x2={endX}
                  y2={midY}
                  stroke="rgba(0, 0, 0, 0.75)"
                  strokeWidth="0.8"
                  shapeRendering="crispEdges"
                />
                {/* Crisp white hairline overlay */}
                <line
                  x1={midX}
                  y1={y}
                  x2={midX}
                  y2={endY}
                  stroke="#FFFFFF"
                  strokeWidth="0.4"
                  shapeRendering="crispEdges"
                />
                <line
                  x1={x}
                  y1={midY}
                  x2={endX}
                  y2={midY}
                  stroke="#FFFFFF"
                  strokeWidth="0.4"
                  shapeRendering="crispEdges"
                />
              </g>
            );
          })}

          {/* Active node highlight with depth-adaptive stroke width and exact border insetting */}
          {activeNode && activeNode.size && (() => {
            const nodeSize = activeNode.size ?? 64;
            const nodeX = activeNode.x ?? 0;
            const nodeY = activeNode.y ?? 0;
            const strokeW = nodeSize <= 8 ? 0.5 : (nodeSize <= 16 ? 0.75 : 1);
            const inset = strokeW / 2;

            return (
              <rect
                x={nodeX + inset}
                y={nodeY + inset}
                width={Math.max(0, nodeSize - strokeW)}
                height={Math.max(0, nodeSize - strokeW)}
                fill={dConf.bgAlpha ? dConf.bgAlpha(0.22) : 'rgba(0, 122, 255, 0.22)'}
                stroke={dConf.border || '#007AFF'}
                strokeWidth={strokeW}
                shapeRendering="crispEdges"
              />
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

export default React.memo(PartitionCanvas);

