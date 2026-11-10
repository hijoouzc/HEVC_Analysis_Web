import React, { useState } from 'react';
import { IntraPredictionFlow } from '../stages/cp02_intra_search';
import { InterSearchVisualizer } from '../stages/cp03_inter_search';
import { PuPartitionGeometry } from './PuPartitionGeometry';
import { Badge, Button, SegmentedControl } from '../apple';

/**
 * Step2Prediction (Guided Flow Step 2)
 * Prediction Candidates Generation & Screening (HM TEncSearch::estIntraPredLumaQT)
 * Features Streamlined Command Header, PU Partition Geometry (2Nx2N vs NxN, SMP/AMP),
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
  const [showPuDetails, setShowPuDetails] = useState(false);

  const activeBlockSize = selectedCu?.width || cuSize || 8;
  const activeModeNum = modeData?.mode ?? 0;
  const canSplitIntraNxN = activeBlockSize <= 8;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Top Command Ribbon: Prediction Type & PU Partition Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--fill-1)',
          border: '0.5px solid var(--separator)',
          borderRadius: '8px',
        }}
      >
        {/* Left: Prediction Type Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        {/* Right: Compact PU Partition Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--apple-label-secondary)' }}>
            PU PartSize:
          </span>
          {predictionType === 'intra' ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setPartSize('2Nx2N')}
                style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: partSize === '2Nx2N' ? 'var(--system-blue)' : 'var(--fill-2)',
                  color: partSize === '2Nx2N' ? '#FFFFFF' : 'var(--apple-label)',
                  border: '0.5px solid var(--separator)',
                  cursor: 'pointer',
                  fontWeight: partSize === '2Nx2N' ? 600 : 400,
                }}
              >
                2N×2N
              </button>
              {canSplitIntraNxN && (
                <button
                  type="button"
                  onClick={() => setPartSize('NxN')}
                  style={{
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: partSize === 'NxN' ? 'var(--system-blue)' : 'var(--fill-2)',
                    color: partSize === 'NxN' ? '#FFFFFF' : 'var(--apple-label)',
                    border: '0.5px solid var(--separator)',
                    cursor: 'pointer',
                    fontWeight: partSize === 'NxN' ? 600 : 400,
                  }}
                  title="Intra NxN split (4 sub-PUs)"
                >
                  N×N (4 PUs)
                </button>
              )}
              <Button
                variant={showPuDetails ? 'tinted' : 'gray'}
                size="small"
                onClick={() => setShowPuDetails(prev => !prev)}
                title="Toggle PU Geometry diagram"
                style={{ fontSize: '10px', height: '22px', padding: '0 6px' }}
              >
                Geometry: {showPuDetails ? 'Hide' : 'Show'}
              </Button>
            </div>
          ) : (
            <Badge variant="blue" style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>
              {partSize}
            </Badge>
          )}
        </div>
      </div>

      {/* PU Partition Geometry Bar (Always shown for Inter; Collapsible for Intra) */}
      {(predictionType === 'inter' || showPuDetails) && (
        <PuPartitionGeometry
          isInter={predictionType === 'inter'}
          cuSize={activeBlockSize}
          partSize={partSize}
          onSelectPartSize={setPartSize}
          activeSubPu={activeSubPu}
          onSelectSubPu={setActiveSubPu}
          interData={interSearchData?.[0] || null}
        />
      )}

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
