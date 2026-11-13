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
  selectedPoc = 0,
  onSelectPoc = null,
  committedCtuKeys = null,
}) {
  const currentFrame = (Array.isArray(frameGopData) && frameGopData.length > 0)
    ? (frameGopData.find(f => f.poc === selectedPoc) || frameGopData[0])
    : null;

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
        {/* Metric 1: Frame Status + Multi-Frame POC Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>FRAME STATUS:</span>
          {Array.isArray(frameGopData) && frameGopData.length > 1 && onSelectPoc ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {frameGopData.map((frm) => {
                const isSelected = (currentFrame ? currentFrame.poc : 0) === frm.poc;
                return (
                  <button
                    key={`poc-btn-${frm.poc}`}
                    type="button"
                    onClick={() => onSelectPoc(frm.poc)}
                    style={{
                      height: '22px',
                      padding: '0 6px',
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '4px',
                      border: '0.5px solid var(--separator)',
                      background: isSelected ? 'var(--system-blue)' : 'var(--fill-2)',
                      color: isSelected ? '#FFFFFF' : 'var(--apple-label)',
                      cursor: 'pointer',
                    }}
                  >
                    POC {frm.poc} ({frm.slice_type})
                  </button>
                );
              })}
            </div>
          ) : (
            <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>
              POC {currentFrame ? currentFrame.poc : 0}
            </span>
          )}
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
