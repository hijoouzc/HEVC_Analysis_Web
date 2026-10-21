import React, { useState } from 'react';
import { IntraPredictionFlow } from '../stages/cp02_intra_search';
import { InterSearchVisualizer } from '../stages/cp03_inter_search';
import { PuPartitionGeometry } from './PuPartitionGeometry';
import { Badge, SegmentedControl } from '../apple';

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
  _setSelectedCu,
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
  _onProceedToResidual = null,
  _onProceedToRdo = null,
  channel = 'Y',
  onSelectChannel = null,
  showValues = undefined,
}) {
  const [predictionType, setPredictionType] = useState('intra'); // 'intra' | 'inter'
  const [partSize, setPartSize] = useState('2Nx2N');
  const [activeSubPu, setActiveSubPu] = useState(0);

  const activeBlockSize = selectedCu?.width || cuSize || 8;
  const activeModeNum = modeData?.mode ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
            if (handleSelectSize) {
              handleSelectSize(newSize);
            } else if (setCuSize) {
              setCuSize(newSize);
            }
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
          showValues={showValues}
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
    </div>
  );
}

export default React.memo(Step2Prediction);
