import React, { useState } from 'react';
import { FourPictureComparison, ReconPictureVisualizer } from '../stages/cp05_recon_picture';
import { InLoopFilterVisualizer } from '../stages/cp06_inloop_filter';
import { SegmentedControl } from '../apple';

/**
 * Step4ReconInLoop (Guided Flow Step 4)
 * Spatial Reconstruction S' = Clip_BD(P + R') & CTU-Level In-Loop Filters (DBF, SAO).
 * Strictly differentiates between candidate trial reconstruction S'_trial and committed PicYuvRec.
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
  const [reconTab, setReconTab] = useState('buffer'); // 'buffer' | 'cu_planar' | 'inloop'
  const [internalChannel, setInternalChannel] = useState('Y'); // 'Y' | 'Cb' | 'Cr'
  const channel = propsChannel !== undefined ? propsChannel : internalChannel;
  const setChannel = onSelectChannel || setInternalChannel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Controls: Chroma Channel Switcher & Recon Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
        {/* Chroma Channel Switcher [ Y | Cb | Cr ] - Only render when uncontrolled */}
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

        <SegmentedControl
          value={reconTab}
          onChange={setReconTab}
          size="small"
          items={[
            { id: 'buffer', label: "Full CTU Buffer (S')" },
            { id: 'cu_planar', label: 'CU Planar Inspector' },
            { id: 'inloop', label: 'In-Loop Filter (DBF & SAO)' },
          ]}
        />
      </div>

      {/* Main Interactive Workspace */}
      <div className="stage-section-card">
        {reconTab === 'buffer' && (
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

        {reconTab === 'cu_planar' && (
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

        {reconTab === 'inloop' && (
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
