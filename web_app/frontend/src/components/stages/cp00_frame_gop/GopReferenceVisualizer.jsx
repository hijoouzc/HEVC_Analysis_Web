import React from 'react';
import FullFrameViewer from './FullFrameViewer';
import { Badge } from '../../apple';

/**
 * GopReferenceVisualizer (CP_00_FRAME_GOP)
 * Specializes in Frame & GOP structure, Reference Dependency Graph (DPB), and CTU Navigator.
 * Design standard: Apple Pro-Grade, 100% English, no emoji icons, zero overflow.
 */
function GopReferenceVisualizer({
  imageSrc,
  imageDims,
  ctuX,
  ctuY,
  onSelectCTU,
  onNavigateToQuadTree,
  partitionData,
  ctuPartitionsMap,
  isAnalyzed = true,
  onReAnalyze,
  loading = false,
  selectedCu = null,
  onSelectCU,
  frameGopData = [],
  committedCtuKeys = null,
}) {
  const currentFrame = Array.isArray(frameGopData) && frameGopData.length > 0 ? frameGopData[0] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Bar: Compact Frame & DPB Telemetry Ribbon (1-Line HUD, 34px) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px 12px',
          padding: '6px 12px',
          background: 'var(--fill-1)',
          border: '0.5px solid var(--separator)',
          borderRadius: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          boxSizing: 'border-box',
        }}
      >
        {/* Metric 1: Frame Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>FRAME STATUS:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>
            POC {currentFrame ? currentFrame.poc : 0}
          </span>
          <Badge variant={currentFrame?.slice_type === 'I' ? 'green' : 'blue'} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
            {currentFrame ? `${currentFrame.slice_type}-SLICE` : 'I-SLICE'}
          </Badge>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 2: Temporal Layer & QP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>TEMPORAL LAYER &amp; QP:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>
            TID {currentFrame ? currentFrame.temporal_id : 0}
          </span>
          <span style={{ color: 'var(--apple-label-secondary)', fontSize: '10.5px' }}>
            QP {currentFrame ? currentFrame.qp : 22}
          </span>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 3: DPB Ref List 0 (L0) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>DPB REF LIST 0 (L0):</span>
          {currentFrame && currentFrame.ref_l0 && currentFrame.ref_l0.length > 0 ? (
            currentFrame.ref_l0.map((poc, idx) => (
              <span
                key={`ref0-${idx}`}
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 5px',
                  background: 'var(--fill-3)',
                  borderRadius: '3px',
                  border: '0.5px solid var(--separator)',
                }}
              >
                POC {poc}
              </span>
            ))
          ) : (
            <span style={{ color: 'var(--apple-label-tertiary)', fontSize: '10.5px' }}>
              None (Intra Anchor)
            </span>
          )}
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        {/* Metric 4: DPB Ref List 1 (L1) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>DPB REF LIST 1 (L1):</span>
          {currentFrame && currentFrame.ref_l1 && currentFrame.ref_l1.length > 0 ? (
            currentFrame.ref_l1.map((poc, idx) => (
              <span
                key={`ref1-${idx}`}
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 5px',
                  background: 'var(--fill-3)',
                  borderRadius: '3px',
                  border: '0.5px solid var(--separator)',
                }}
              >
                POC {poc}
              </span>
            ))
          ) : (
            <span style={{ color: 'var(--apple-label-tertiary)', fontSize: '10.5px' }}>
              None
            </span>
          )}
        </div>
      </div>

      {/* Main View: Full Frame CTU Grid & Spatial Navigator */}
      <div className="stage-section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <FullFrameViewer
          imageSrc={imageSrc}
          imageDims={imageDims}
          ctuX={ctuX}
          ctuY={ctuY}
          onSelectCTU={onSelectCTU}
          onNavigateToQuadTree={onNavigateToQuadTree}
          partitionData={partitionData}
          ctuPartitionsMap={ctuPartitionsMap}
          isAnalyzed={isAnalyzed}
          onReAnalyze={onReAnalyze}
          loading={loading}
          selectedCu={selectedCu}
          onSelectCU={onSelectCU}
          committedCtuKeys={committedCtuKeys}
        />
      </div>
    </div>
  );
}

export default React.memo(GopReferenceVisualizer);
