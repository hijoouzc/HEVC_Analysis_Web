import React from 'react';
import FullFrameViewer from './FullFrameViewer';
import { Badge, Card } from './apple';

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
      {/* Top Bar: Frame & DPB Telemetry Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          width: '100%',
        }}
      >
        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            FRAME STATUS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              POC {currentFrame ? currentFrame.poc : 0}
            </span>
            <Badge variant={currentFrame?.slice_type === 'I' ? 'green' : 'blue'}>
              {currentFrame ? `${currentFrame.slice_type}-SLICE` : 'I-SLICE'}
            </Badge>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            TEMPORAL LAYER & QP
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              TID {currentFrame ? currentFrame.temporal_id : 0}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              QP {currentFrame ? currentFrame.qp : 22}
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            DPB REF LIST 0 (L0)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            {currentFrame && currentFrame.ref_l0 && currentFrame.ref_l0.length > 0 ? (
              currentFrame.ref_l0.map((poc, idx) => (
                <span
                  key={`ref0-${idx}`}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 6px',
                    background: 'var(--fill-3)',
                    borderRadius: '4px',
                    border: '0.5px solid var(--separator)',
                  }}
                >
                  POC {poc}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                None (Intra Anchor)
              </span>
            )}
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            DPB REF LIST 1 (L1)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            {currentFrame && currentFrame.ref_l1 && currentFrame.ref_l1.length > 0 ? (
              currentFrame.ref_l1.map((poc, idx) => (
                <span
                  key={`ref1-${idx}`}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 6px',
                    background: 'var(--fill-3)',
                    borderRadius: '4px',
                    border: '0.5px solid var(--separator)',
                  }}
                >
                  POC {poc}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                None
              </span>
            )}
          </div>
        </Card>
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
