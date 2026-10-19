import React, { useState } from 'react';
import IntraPredictionFlow from '../IntraPredictionFlow';
import InterSearchVisualizer from '../InterSearchVisualizer';
import { CompactStepRibbon } from './CompactStepRibbon';
import { PuPartitionGeometry } from './PuPartitionGeometry';
import { Badge, SegmentedControl, Button } from '../apple';

/**
 * Step2Prediction (Guided Flow Step 2)
 * Prediction Candidates Generation & Screening (HM TEncSearch::estIntraPredLumaQT)
 * Features Compact I/O Ribbon, PU Partition Geometry (2Nx2N vs NxN, SMP/AMP),
 * and dedicated Reference & Prediction Inspector.
 */
export function Step2Prediction({
  modeData,
  modesData,
  currentModeIdx,
  onSelectModeIndex,
  isPlaying,
  onTogglePlay,
  refSamples,
  selectedCu,
  cuSize,
  setCuSize,
  setSelectedCu,
  handleSelectSize,
  imagePreview,
  imageDims,
  ctuX,
  ctuY,
  jobId,
  API_BASE_URL,
  transformData,
  quantData,
  interSearchData,
  frameGopData,
  onSelectBlock = null,
  partitionData = null,
  onProceedToResidual = null,
  onProceedToRdo = null,
  channel = 'Y',
  onSelectChannel = null,
}) {
  const [predictionType, setPredictionType] = useState('intra'); // 'intra' | 'inter'
  const [partSize, setPartSize] = useState('2Nx2N');
  const [activeSubPu, setActiveSubPu] = useState(0);

  const activeBlockSize = selectedCu?.width || cuSize || 8;
  const activeModeNum = modeData?.mode ?? 0;
  const activeModeName = modeData?.direction_name || `Mode ${activeModeNum}`;
  const isParentCu = selectedCu?.split === true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Compact I/O Strip */}
      <CompactStepRibbon
        stepNumber={2}
        inputItems={[`S_orig (${activeBlockSize}×${activeBlockSize})`, 'Ref Samples']}
        processTitle="Intra Search"
        processDesc=""
        outputItems={[`Pred P (${activeModeName})`]}
        hmFunction="TEncSearch::estIntraPredLumaQT"
        specReference="Intra Angular Prediction & MPM Derivation"
        formula="Cost_RMD = SATD + ModeBits * sqrt(lambda_firstPass)"
      />

      {/* PU Partition Geometry Bar */}
      <PuPartitionGeometry
        isInter={predictionType === 'inter'}
        cuSize={activeBlockSize}
        partSize={partSize}
        onSelectPartSize={setPartSize}
        activeSubPu={activeSubPu}
        onSelectSubPu={setActiveSubPu}
        interData={interSearchData?.[0] || null}
      />

      {/* Parent CU Notice */}
      {isParentCu && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', background: 'var(--fill-1)', borderRadius: '6px', border: '0.5px solid var(--separator)', flexWrap: 'wrap' }}>
          <Badge variant="purple" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            SPLIT CU TRIAL: ({selectedCu.x ?? 0}, {selectedCu.y ?? 0}) Split into 4 child CUs in final tree
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

      {/* Prediction Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
        <SegmentedControl
          value={predictionType}
          onChange={setPredictionType}
          size="small"
          items={[
            { id: 'intra', label: 'Intra Prediction (35 Modes + MPM)' },
            { id: 'inter', label: 'Inter Prediction (ME & AMVP)' },
          ]}
        />
      </div>

      {/* Intra Prediction Workspace */}
      {predictionType === 'intra' ? (
        <IntraPredictionFlow
          modeData={modeData}
          modesData={modesData}
          currentModeIdx={currentModeIdx}
          onSelectModeIndex={onSelectModeIndex}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          refSamples={refSamples}
          currentMode={activeModeNum}
          blockSize={activeBlockSize}
          onChangeBlockSize={(newSize) => {
            if (setCuSize) setCuSize(newSize);
            if (setSelectedCu && selectedCu) {
              setSelectedCu({ ...selectedCu, width: newSize, height: newSize });
            }
            if (handleSelectSize) handleSelectSize(newSize);
          }}
          imagePreview={imagePreview}
          imageDims={imageDims}
          ctuX={ctuX}
          ctuY={ctuY}
          jobId={jobId}
          API_BASE_URL={API_BASE_URL}
          transformData={transformData}
          quantData={quantData}
          selectedCu={selectedCu}
          onSelectBlock={onSelectBlock}
          partitionData={partitionData}
          channel={channel}
          onSelectChannel={onSelectChannel}
        />
      ) : (
        /* Inter Prediction Workspace */
        <div className="stage-section-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(!interSearchData || interSearchData.length === 0) ? (
              <div
                style={{
                  padding: '18px 16px',
                  textAlign: 'center',
                  background: 'var(--fill-1)',
                  borderRadius: '8px',
                  border: '0.5px solid var(--separator)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--apple-label)' }}>
                  All-Intra (AI) Configuration Active
                </div>
                <Badge variant="blue">
                  Slice Type: I-SLICE (Intra Only)
                </Badge>
              </div>
            ) : (
              <InterSearchVisualizer
                interSearchData={interSearchData}
                ctuX={ctuX}
                ctuY={ctuY}
                selectedCu={selectedCu}
                frameGopData={frameGopData}
              />
            )}
          </div>
        </div>
      )}
      {/* Stream Advance to Step 3 */}
      {onProceedToResidual && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Button
            variant="filled"
            size="small"
            onClick={onProceedToResidual}
            title="Proceed to Step 3: Transform & Quantization"
            style={{ fontSize: '11px', background: 'var(--system-blue)', color: '#FFFFFF', padding: '0 12px', height: '28px' }}
          >
            Next: Transform &amp; Quantization &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}

export default React.memo(Step2Prediction);
