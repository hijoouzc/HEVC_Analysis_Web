import React, { useMemo } from 'react';
import { Card, Badge, Button } from '../apple';
import { HEVC_DEPTH_COLORS, getIntraModeInfo } from '../../utils/colorUtils';

/**
 * AnalysisInspector
 * Apple Photos / Pro Video style Unified Info Inspector Panel.
 * Acts as the SINGLE SOURCE OF TRUTH for all spatial, block, coding,
 * and sequence telemetry in the active workspace.
 */
const AnalysisInspector = ({
  file,
  imageDims = { width: 640, height: 360 },
  ctuX = 0,
  ctuY = 0,
  analyzedCtu = null,
  selectedCu = null,
  analyzedCuSize = 8,
  currentMode = null,
  partitionData = null,
  ctuPartitionsMap = {},
  onClose = null,
  onReAnalyze = null,
  loading = false,
}) => {
  const width = imageDims?.width || 640;
  const height = imageDims?.height || 360;
  const numCols = Math.max(1, Math.ceil(width / 64));
  const numRows = Math.max(1, Math.ceil(height / 64));

  const ctuIndex = (ctuY !== null && ctuX !== null) ? ctuY * numCols + ctuX : 0;
  const ctuPx = (ctuX || 0) * 64;
  const ctuPy = (ctuY || 0) * 64;
  const ctuPw = Math.min(64, width - ctuPx);
  const ctuPh = Math.min(64, height - ctuPy);
  const isBoundary = !(ctuPx + 63 < width && ctuPy + 63 < height);

  // Active CU parameters
  const cuW = selectedCu?.width || analyzedCuSize || 8;
  const cuH = selectedCu?.height || analyzedCuSize || 8;
  const cuDepth = selectedCu?.depth !== undefined ? selectedCu.depth : Math.max(0, Math.round(Math.log2(64 / cuW)));
  const depthConf = HEVC_DEPTH_COLORS[cuDepth] || HEVC_DEPTH_COLORS[0];

  // Check whether active CTU matches the analyzed sequence CTU
  const isMatchingCtu = analyzedCtu ? (ctuX === analyzedCtu.x && ctuY === analyzedCtu.y) : true;

  // Intra Mode Details
  const activeModeNum = (selectedCu && selectedCu.intra_dir !== null && selectedCu.intra_dir !== undefined)
    ? selectedCu.intra_dir
    : (isMatchingCtu ? (currentMode?.mode ?? 0) : null);
  const modeInfo = activeModeNum !== null ? getIntraModeInfo(activeModeNum) : null;
  const activeCost = selectedCu?.cost ?? (isMatchingCtu ? (currentMode?.cost ?? null) : null);

  // Active CTU Partition summary
  const cachedPart = ctuPartitionsMap[`${ctuX}_${ctuY}`] || partitionData;
  const leafCount = cachedPart?.leaf_nodes || cachedPart?.nodes?.filter(n => !n.split).length || 1;

  // Spatial Reference Availability (ITU-T H.265 Section 8.4.4.2 & HM-18.0 getCuAbove/getCuLeft)
  const neighbors = useMemo(() => {
    const x = ctuX ?? 0;
    const y = ctuY ?? 0;
    return {
      tl: { label: 'TL', name: 'Top-Left', avail: x > 0 && y > 0 },
      t:  { label: 'T',  name: 'Above',    avail: y > 0 },
      tr: { label: 'TR', name: 'Above-Right', avail: y > 0 && x + 1 < numCols },
      l:  { label: 'L',  name: 'Left',     avail: x > 0 },
    };
  }, [ctuX, ctuY, numCols]);

  return (
    <aside className="workspace-inspector" aria-label="Analysis Inspector">
      {/* Inspector Titlebar */}
      <Card style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--apple-label)' }}>
              Analysis Inspector
            </span>
            <Badge variant="blue" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
              CTU ({ctuX ?? 0}, {ctuY ?? 0})
            </Badge>
          </div>
          {onClose && (
            <Button
              variant="plain"
              size="mini"
              onClick={onClose}
              title="Close Inspector (I)"
              style={{ color: 'var(--label-2)', padding: '2px 6px', fontSize: '12px' }}
            >
              ✕
            </Button>
          )}
        </div>
      </Card>

      {/* Section 1: CTU Properties */}
      <Card style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--apple-label-2)' }}>
            CTU Properties
          </span>
          <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--label-2)' }}>
            Raster Scan #{ctuIndex}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>CTU Position:</span>
            <strong style={{ color: 'var(--system-blue)' }}>({ctuX ?? 0}, {ctuY ?? 0})</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>CTU Size:</span>
            <span style={{ color: 'var(--apple-label)' }}>{ctuPw} × {ctuPh} samples</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>Leaf Partitions:</span>
            <span style={{ color: 'var(--apple-label)', fontWeight: 600 }}>{leafCount} CUs</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>Frame Border:</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                background: isBoundary ? 'rgba(255, 141, 40, 0.15)' : 'rgba(52, 199, 89, 0.15)',
                color: isBoundary ? 'var(--system-orange)' : 'var(--system-green)',
                border: `0.5px solid ${isBoundary ? 'var(--system-orange)' : 'var(--system-green)'}`,
              }}
            >
              {isBoundary ? 'Picture Boundary' : 'Inside Picture'}
            </span>
          </div>
        </div>

        {onReAnalyze && (
          <Button
            variant={isMatchingCtu ? "gray" : "filled"}
            size="small"
            onClick={() => onReAnalyze(ctuX, ctuY)}
            disabled={loading}
            style={{ width: '100%', marginTop: '10px', fontSize: '11px' }}
          >
            {loading ? 'Analyzing...' : isMatchingCtu ? `Re-Analyze CTU (${ctuX ?? 0}, ${ctuY ?? 0})` : `Analyze CTU (${ctuX ?? 0}, ${ctuY ?? 0})`}
          </Button>
        )}
      </Card>

      {/* Section 2: Selected Coding Unit & Intra RDO */}
      <Card style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--apple-label-2)' }}>
            Selected Coding Unit
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              background: depthConf.bgSolid || 'var(--fill-3)',
              color: depthConf.text || 'var(--apple-label)',
              border: `0.5px solid ${depthConf.border}`,
            }}
          >
            Depth {cuDepth}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>CU Size:</span>
            <strong style={{ color: 'var(--apple-label)' }}>
              {cuW} × {cuH} samples
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>Tree Depth:</span>
            <strong style={{ color: depthConf.text }}>Depth {cuDepth} (64×64 → {cuW}×{cuH})</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>Intra Mode:</span>
            {modeInfo ? (
              <strong style={{ color: 'var(--system-purple)' }}>
                Mode {activeModeNum} ({modeInfo.name})
              </strong>
            ) : (
              <span style={{ color: 'var(--apple-label-tertiary, #8E8E93)', fontStyle: 'italic' }}>
                Pending Analysis
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>Mode Class:</span>
            <span style={{ color: 'var(--apple-label)' }}>{modeInfo ? modeInfo.type : '—'}</span>
          </div>
          {activeCost !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--apple-label-2)' }}>RD Cost (J):</span>
              <strong style={{ color: 'var(--system-green)' }}>
                {Math.round(activeCost).toLocaleString()}
              </strong>
            </div>
          )}
        </div>
      </Card>

      {/* Section 3: Spatial Neighbor Reference Availability */}
      <Card style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', color: 'var(--apple-label-2)' }}>
          Spatial Neighbor Availability
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
          {Object.entries(neighbors).map(([k, n]) => (
            <div
              key={k}
              title={`${n.name} (${n.label}): ${n.avail ? 'Available for Reference' : 'Outside Picture Border'}`}
              style={{
                padding: '5px 2px',
                borderRadius: '5px',
                background: n.avail ? 'rgba(52, 199, 89, 0.10)' : 'rgba(255, 56, 60, 0.10)',
                border: `0.5px solid ${n.avail ? 'rgba(52, 199, 89, 0.35)' : 'rgba(255, 56, 60, 0.35)'}`,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: n.avail ? 'var(--system-green)' : 'var(--system-red)' }}>
                {n.label}
              </div>
              <div style={{ fontSize: '8.5px', color: 'var(--apple-label-2)', marginTop: '2px' }}>
                {n.avail ? 'Available' : 'Border'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Section 4: Sequence Properties */}
      <Card style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', color: 'var(--apple-label-2)' }}>
          Sequence Properties
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          {file?.name && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--apple-label-2)' }}>Input File:</span>
              <span style={{ color: 'var(--apple-label)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                {file.name}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>Resolution:</span>
            <span style={{ color: 'var(--apple-label)' }}>{width} × {height}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>CTU Grid:</span>
            <span style={{ color: 'var(--apple-label)' }}>{numCols} × {numRows} ({numCols * numRows} CTUs)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>Chroma Format:</span>
            <span style={{ color: 'var(--apple-label)' }}>YCbCr 4:2:0 BT.709</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--apple-label-2)' }}>Reference Codec:</span>
            <span style={{ color: 'var(--apple-label)' }}>HM-18.0 Reference</span>
          </div>
        </div>
      </Card>
    </aside>
  );
};

export default React.memo(AnalysisInspector);
