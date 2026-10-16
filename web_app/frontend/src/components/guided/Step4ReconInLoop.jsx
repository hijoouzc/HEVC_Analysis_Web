import React, { useState } from 'react';
import FourPictureComparison from '../FourPictureComparison';
import ReconPictureVisualizer from '../ReconPictureVisualizer';
import InLoopFilterVisualizer from '../InLoopFilterVisualizer';
import { CompactStepRibbon } from './CompactStepRibbon';
import { Badge, SegmentedControl, Button } from '../apple';

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
  splitDecision = null,
  onProceedToRdo = null,
  channel: propsChannel = undefined,
  onSelectChannel = null,
}) {
  const [reconTab, setReconTab] = useState('buffer'); // 'buffer' | 'cu_planar' | 'inloop'
  const [internalChannel, setInternalChannel] = useState('Y'); // 'Y' | 'Cb' | 'Cr'
  const channel = propsChannel !== undefined ? propsChannel : internalChannel;
  const setChannel = onSelectChannel || setInternalChannel;

  const wasSplit = splitDecision?.split_decision === true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Compact I/O Strip */}
      <CompactStepRibbon
        stepNumber={4}
        inputItems={['Pred P', 'Quantized Q']}
        processTitle="Inverse Transform & Recon"
        processDesc=""
        outputItems={["Recon S'", 'Distortion (SSE)']}
        hmFunction="TComPic::getPicYuvRec"
        specReference="ITU-T H.265 Section 8.6.4 (Inverse Transformation) & Section 8.7 (In-loop filter)"
        formula="S'_trial = Clip3(0, (1 << bitDepth) - 1, P + R'); Distortion D = sum((S_orig - S'_trial)^2)"
      />

      {/* Controls: Chroma Channel Switcher & Recon Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
        {/* Chroma Channel Switcher [ Y | Cb | Cr ] */}
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

      {/* Split CU Notice Banner */}
      {wasSplit && reconTab !== 'inloop' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', background: 'var(--fill-1)', borderRadius: '6px', border: '0.5px solid var(--separator)', flexWrap: 'wrap' }}>
          <Badge variant="purple" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            [CU PARTITION NOTICE]: CU split into 4 child CUs; picture buffer committed from child nodes
          </Badge>
          {onProceedToRdo && (
            <Button
              variant="tinted"
              size="mini"
              onClick={onProceedToRdo}
              title="Jump to Step 5: Rate-Distortion Split Decision"
              style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}
            >
              Jump to RDO Decision (Step 5) &rarr;
            </Button>
          )}
        </div>
      )}

      {/* In-Loop Filter CTU-Level Notice */}
      {reconTab === 'inloop' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Badge variant="gray" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            In-Loop Filters (Deblocking Filter &amp; Sample Adaptive Offset) execute at CTU and Picture level
          </Badge>
        </div>
      )}

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

      {/* Stream Advance to Step 5 */}
      {onProceedToRdo && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Button
            variant="filled"
            size="small"
            onClick={onProceedToRdo}
            title="Proceed to Step 5: RDO Decision"
            style={{ fontSize: '11px', background: 'var(--system-blue)', color: '#FFFFFF', padding: '0 12px', height: '28px' }}
          >
            Next: RDO Decision &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}

export default React.memo(Step4ReconInLoop);
