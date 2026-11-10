import React, { useState } from 'react';
import { FourPictureComparison, ReconPictureVisualizer } from '../stages/cp05_recon_picture';
import { InLoopFilterVisualizer } from '../stages/cp06_inloop_filter';
import { Badge, SegmentedControl } from '../apple';

/**
 * Step4ReconInLoop (Guided Flow Step 4)
 * Phase 1: Spatial Reconstruction S' = Clip_BD(P + R') (HM: TComTrQuant::invTransformNxN + addClip)
 * Phase 2: In-Loop Post-Filtering (DBF & SAO) on Picture Buffer (HM: TComLoopFilter::loopFilterPic + TEncSampleAdaptiveOffset::SAOProcess)
 * Streamlined 2-Phase Apple Pro-Grade layout strictly aligned with C++ HM execution flow.
 */
export function Step4ReconInLoop({
  imageSrc,
  imageDims,
  ctuX,
  ctuY,
  currentMode,
  selectedCu,
  cuSize,
  reconPictureData,
  inloopFilterData,
  jobId,
  API_BASE_URL,
  onSelectCTU,
  onNavigateToIntra,
  splitDecision: _splitDecision = null,
  _onProceedToRdo = null,
  channel: propsChannel = undefined,
  onSelectChannel = null,
  showValues = undefined,
  resiGain = 4,
  onSelectResiGain = null,
}) {
  const [activePhase, setActivePhase] = useState('recon'); // 'recon' | 'inloop'
  const [reconSubView, setReconSubView] = useState('studio'); // 'studio' | 'planar'
  const [internalChannel, setInternalChannel] = useState('Y'); // 'Y' | 'Cb' | 'Cr'
  const channel = propsChannel !== undefined ? propsChannel : internalChannel;
  const setChannel = onSelectChannel || setInternalChannel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Top Command Ribbon: HM Phase, C++ Pipeline Stage, and Channel Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--fill-1)',
          border: '0.5px solid var(--separator)',
          borderRadius: '8px',
        }}
      >
        {/* Left: Stage Badges & Channel Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Badge
            variant="purple"
            style={{ fontSize: '10px' }}
            title="Spatial Reconstruction: S' = Clip_BD(P + R') [ITU-T H.265 Section 8.5]"
          >
            S' = Clip(P + R')
          </Badge>

          <Badge
            variant="gray"
            style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}
            title="C++ HM Reference Software Execution Target"
          >
            {activePhase === 'recon' ? 'TComTrQuant::invTransformNxN' : 'TComLoopFilter::loopFilterPic'}
          </Badge>

          {/* Chroma Channel Switcher [ Y | Cb | Cr ] - Rendered when uncontrolled */}
          {!onSelectChannel && (
            <div style={{ display: 'flex', gap: '3px' }}>
              {['Y', 'Cb', 'Cr'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: channel === ch ? 'var(--system-blue)' : 'var(--fill-2)',
                    color: channel === ch ? '#FFFFFF' : 'var(--apple-label)',
                    border: '0.5px solid var(--separator)',
                    cursor: 'pointer',
                    fontWeight: channel === ch ? 700 : 500,
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Phase & Sub-View Switchers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sub-view switcher for Reconstruction Phase */}
          {activePhase === 'recon' && (
            <SegmentedControl
              value={reconSubView}
              onChange={setReconSubView}
              size="small"
              items={[
                { id: 'studio', label: 'Studio (4-Up/Slider)' },
                { id: 'planar', label: 'Planar YUV' },
              ]}
            />
          )}

          {/* 2-Phase Master Switcher */}
          <SegmentedControl
            value={activePhase}
            onChange={setActivePhase}
            size="small"
            items={[
              { id: 'recon', label: "1. Spatial Reconstruction (S')" },
              { id: 'inloop', label: '2. In-Loop Filters (DBF & SAO)' },
            ]}
          />
        </div>
      </div>

      {/* Main Interactive Workspace */}
      <div className="stage-section-card">
        {activePhase === 'recon' && reconSubView === 'studio' && (
          <FourPictureComparison
            imageSrc={imageSrc}
            imageDims={imageDims}
            ctuX={ctuX}
            ctuY={ctuY}
            currentMode={currentMode}
            selectedCu={selectedCu}
            reconPictureData={reconPictureData}
            jobId={jobId}
            API_BASE_URL={API_BASE_URL}
            onSelectCTU={onSelectCTU}
            onNavigateToIntra={onNavigateToIntra}
            channel={channel}
            showValues={showValues}
            resiGain={resiGain}
            onSelectResiGain={onSelectResiGain}
          />
        )}

        {activePhase === 'recon' && reconSubView === 'planar' && (
          <ReconPictureVisualizer
            currentMode={currentMode}
            reconPictureData={reconPictureData}
            ctuX={ctuX}
            ctuY={ctuY}
            selectedCu={selectedCu}
            cuSize={cuSize}
            imageSrc={imageSrc}
            imageDims={imageDims}
            jobId={jobId}
            API_BASE_URL={API_BASE_URL}
            component={channel}
            onSelectComponent={setChannel}
          />
        )}

        {activePhase === 'inloop' && (
          <InLoopFilterVisualizer
            inloopFilterData={inloopFilterData}
            ctuX={ctuX}
            ctuY={ctuY}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(Step4ReconInLoop);
