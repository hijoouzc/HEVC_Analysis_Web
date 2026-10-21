import React, { useState, useMemo } from 'react';
import { Card, Badge, SegmentedControl } from '../../apple';
import SyntaxBreakdownTable from './subcomponents/SyntaxBreakdownTable';
import BacIntervalStudio from './subcomponents/BacIntervalStudio';
import BinarizationTreeViewer from './subcomponents/BinarizationTreeViewer';

/**
 * CabacEntropyVisualizer (CP_07_CABAC_ENTROPY)
 * Comprehensive CABAC Entropy Studio for HEVC ITU-T H.265.
 * Features:
 *  - 1) BAC Interval Studio: Dynamic range [L, L+R), 64-state FSM tracker, and Renorm bit emission
 *  - 2) Intra Binarization Trees: Decision path explorer for FL, TR, and TB syntax elements
 *  - 3) Syntax Stream & Bitrate: Filterable bin log table and syntax element bitrate allocation
 * 
 * Design standard: Apple Pro-Grade, 100% English, no emoji icons, zero overflow.
 */
function CabacEntropyVisualizer({
  cabacEntropyData,
  _ctuX,
  _ctuY,
}) {
  const [activeTab, setActiveTab] = useState('studio'); // 'studio' | 'binarization' | 'breakdown'
  const [externalBinFeed, setExternalBinFeed] = useState(null);

  const bins = useMemo(() => cabacEntropyData?.bins || [], [cabacEntropyData?.bins]);
  const totalBins = cabacEntropyData?.total_bins || bins.length;
  const totalBits = useMemo(() => {
    return cabacEntropyData?.total_bits || bins.reduce((sum, b) => sum + (b.bits || 1), 0);
  }, [cabacEntropyData?.total_bits, bins]);
  const breakdown = useMemo(() => cabacEntropyData?.syntax_breakdown || {}, [cabacEntropyData?.syntax_breakdown]);
  const syntaxElements = useMemo(() => Object.keys(breakdown), [breakdown]);

  const handleSendToBacStudio = (feedData) => {
    setExternalBinFeed(feedData);
    setActiveTab('studio');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
      {/* Scope Clarification & Navigation Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--fill-2)',
          borderRadius: '8px',
          border: '0.5px solid var(--separator)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>SCOPE:</span>
          <Badge variant="blue">CTU-Level Final Syntax Stream</Badge>
          <span style={{ color: 'var(--apple-label-tertiary)' }}>
            HM TEncSbac writes decided CU syntax &bull; ITU-T H.265 §9.3 Arithmetic Engine
          </span>
        </div>

        {/* Tab Switcher */}
        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          size="small"
          items={[
            { id: 'studio', label: 'BAC Interval Studio' },
            { id: 'binarization', label: 'Intra Binarization Trees' },
            { id: 'breakdown', label: 'Syntax Stream & Bitrate' },
          ]}
        />
      </div>

      {/* Top Telemetry Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
          width: '100%',
        }}
      >
        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            TOTAL CABAC BINS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {totalBins.toLocaleString()} Bins
            </span>
            <Badge variant="blue">HM TEncSbac</Badge>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            ENCODED BITSTREAM
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {totalBits.toLocaleString()} Bits
            </span>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              ({(totalBits / 8).toFixed(1)} Bytes)
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            SYNTAX ELEMENT DIVERSITY
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {syntaxElements.length} Types
            </span>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              in active window
            </span>
          </div>
        </Card>

        <Card style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--apple-label-tertiary)', fontFamily: 'var(--font-mono)' }}>
            CABAC FSM MODEL
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
              63 States (0..62) &bull; MPS/LPS
            </span>
          </div>
        </Card>
      </div>

      {/* Main Active Tab Content */}
      {activeTab === 'studio' && (
        <BacIntervalStudio
          traceBins={bins}
          externalBinFeed={externalBinFeed}
        />
      )}

      {activeTab === 'binarization' && (
        <BinarizationTreeViewer
          onSendToBacStudio={handleSendToBacStudio}
        />
      )}

      {activeTab === 'breakdown' && (
        <SyntaxBreakdownTable
          bins={bins}
          breakdown={breakdown}
          totalBits={totalBits}
        />
      )}
    </div>
  );
}

export default React.memo(CabacEntropyVisualizer);
