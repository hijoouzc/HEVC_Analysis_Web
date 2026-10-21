import React, { useState, useMemo } from 'react';
import { Card, Badge, Button } from '../../../apple';
import { INTRA_SYNTAX_DEFINITIONS } from '../../../../utils/cabacMathEngine';

/**
 * BinarizationTreeViewer
 * 
 * Interactive HEVC Intra Binarization Tree explorer.
 * Visualizes how high-level syntax elements are mapped into binary bin strings
 * using Fixed-Length (FL), Truncated Rice (TR), and Truncated Binarization (TB).
 */
const BinarizationTreeViewer = ({ onSendToBacStudio = null }) => {
  const [selectedSyntaxId, setSelectedSyntaxId] = useState('intra_chroma_pred_mode');
  const [selectedValueIdx, setSelectedValueIdx] = useState(0);

  const activeDef = useMemo(() => {
    return INTRA_SYNTAX_DEFINITIONS.find(d => d.id === selectedSyntaxId) || INTRA_SYNTAX_DEFINITIONS[0];
  }, [selectedSyntaxId]);

  const activeValue = useMemo(() => {
    if (!activeDef.values || activeDef.values.length === 0) return null;
    return activeDef.values[Math.min(selectedValueIdx, activeDef.values.length - 1)];
  }, [activeDef, selectedValueIdx]);

  const activeBinString = activeValue?.binString || '0';

  const handleSendToStudio = () => {
    if (onSendToBacStudio && activeValue) {
      onSendToBacStudio({
        syntaxId: activeDef.id,
        syntaxName: activeDef.name,
        val: activeValue.val,
        binString: activeValue.binString,
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Selector & Specification Banner */}
      <Card style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--apple-label)' }}>
              SYNTAX ELEMENT:
            </span>
            <select
              value={selectedSyntaxId}
              onChange={(e) => {
                setSelectedSyntaxId(e.target.value);
                setSelectedValueIdx(0);
              }}
              className="apple-select-control"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11.5px',
                height: '26px',
                padding: '2px 8px',
                minWidth: '240px',
              }}
            >
              {INTRA_SYNTAX_DEFINITIONS.map(def => (
                <option key={def.id} value={def.id}>
                  [{def.category}] {def.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Badge variant="blue">{activeDef.standardRef}</Badge>
            <Badge variant="gray">{activeDef.binarizationType}</Badge>
          </div>
        </div>

        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--apple-label-secondary)' }}>
          {activeDef.description}
        </div>
      </Card>

      {/* Main Workspace: Values Selector + Tree Visualization */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px' }}>
        {/* Left Column: Possible Values & Emitted Bin Strings */}
        <Card style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, borderBottom: '0.5px solid var(--separator)', paddingBottom: '6px' }}>
            Select Syntax Value
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeDef.values.map((v, idx) => {
              const isSelected = idx === selectedValueIdx;
              return (
                <div
                  key={`val-${idx}`}
                  onClick={() => setSelectedValueIdx(idx)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--apple-blue)' : 'var(--fill-2)',
                    color: isSelected ? '#FFFFFF' : 'var(--apple-label-primary)',
                    border: isSelected ? '1px solid #0056B3' : '0.5px solid var(--separator)',
                    transition: 'background 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500 }}>
                    {v.label}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: isSelected ? 'rgba(255, 255, 255, 0.9)' : 'var(--apple-label-tertiary)',
                    }}
                  >
                    Bin String: [{v.binString}] ({v.binString.length} bins)
                  </div>
                </div>
              );
            })}
          </div>

          {/* Send to BAC Studio Action */}
          {onSendToBacStudio && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '0.5px solid var(--separator)' }}>
              <Button
                variant="blue"
                size="small"
                onClick={handleSendToStudio}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Send to BAC Studio ➔
              </Button>
            </div>
          )}
        </Card>

        {/* Right Column: Visual Binarization Tree */}
        <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Decision Binarization Tree
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--apple-label-secondary)' }}>
                Active Path:
              </span>
              <Badge variant="green" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {activeBinString}
              </Badge>
            </div>
          </div>

          {/* Interactive Tree Graph Container */}
          <div
            style={{
              padding: '24px 16px',
              background: 'var(--apple-canvas)',
              borderRadius: '8px',
              border: '0.5px solid var(--separator)',
              minHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              overflowX: 'auto',
            }}
          >
            {/* Root Node */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--fill-4)',
                border: '1px solid var(--apple-blue)',
                color: 'var(--apple-label-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11.5px',
                fontWeight: 700,
                boxShadow: 'var(--shadow-card-small)',
              }}
            >
              Root: {activeDef.name}
            </div>

            {/* Tree Branches Representation */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', width: '100%', flexWrap: 'wrap' }}>
              {activeDef.values.map((valItem, vIdx) => {
                const isActiveBranch = vIdx === selectedValueIdx;
                return (
                  <div
                    key={`branch-${vIdx}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: isActiveBranch ? 1 : 0.45,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    {/* Vertical Connector Line */}
                    <div
                      style={{
                        width: '1.5px',
                        height: '20px',
                        background: isActiveBranch ? 'var(--apple-blue)' : 'var(--separator)',
                      }}
                    />

                    {/* Bin Step Node */}
                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: isActiveBranch ? 'var(--apple-blue)' : 'var(--fill-2)',
                        color: isActiveBranch ? '#FFFFFF' : 'var(--apple-label-secondary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: isActiveBranch ? '1.5px solid #0056B3' : '0.5px solid var(--separator)',
                        boxShadow: isActiveBranch ? '0 0 8px rgba(0, 122, 255, 0.4)' : 'none',
                        textAlign: 'center',
                        minWidth: '120px',
                      }}
                    >
                      <div>Bin: {valItem.binString}</div>
                      <div style={{ fontSize: '9.5px', fontWeight: 500, marginTop: '2px' }}>
                        {valItem.label.split(':')[1] || valItem.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Context Modeling Reference Bar */}
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--fill-1)',
              borderRadius: '6px',
              border: '0.5px solid var(--separator)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              Context Derivation: <strong>{activeDef.values[0]?.bins[0]?.ctx || 'ctx_default'}</strong>
            </span>
            <span style={{ color: 'var(--apple-label-secondary)' }}>
              Mode: {activeDef.values[0]?.bins[0]?.isBypass ? 'Bypass (Equal Prob)' : 'Regular (Context Adaptive)'}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default React.memo(BinarizationTreeViewer);
