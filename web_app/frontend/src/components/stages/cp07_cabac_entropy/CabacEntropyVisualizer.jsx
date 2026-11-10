import React, { useState, useMemo } from 'react';
import { Badge, SegmentedControl } from '../../apple';
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

      {/* Compact Telemetry Ribbon (1-Line HUD, 34px) */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>TOTAL CABAC BINS:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>{totalBins.toLocaleString()} Bins</span>
          <Badge variant="blue" style={{ fontSize: '9.5px', padding: '1px 5px' }}>HM TEncSbac</Badge>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>ENCODED BITSTREAM:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>{totalBits.toLocaleString()} Bits</span>
          <span style={{ color: 'var(--apple-label-secondary)', fontSize: '10.5px' }}>({(totalBits / 8).toFixed(1)} Bytes)</span>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>SYNTAX ELEMENTS:</span>
          <span style={{ fontWeight: 700, color: 'var(--apple-label)' }}>{syntaxElements.length} Types</span>
        </div>

        <span style={{ color: 'var(--separator)' }}>|</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--apple-label-secondary)', fontWeight: 600 }}>CABAC FSM:</span>
          <span style={{ color: 'var(--apple-label)', fontWeight: 600 }}>63 States (0..62) &bull; MPS/LPS</span>
        </div>
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
