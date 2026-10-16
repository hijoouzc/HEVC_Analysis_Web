import React, { useState } from 'react';
import { Button } from '../apple';

/**
 * CompactStepRibbon
 * Slim, space-efficient horizontal ribbon showing Input -> Process -> Output
 * for the active step in Guided Flow. Includes expandable technical drawer.
 */
export function CompactStepRibbon({
  _stepNumber = 1,
  inputItems = [],
  processTitle = '',
  processDesc = '',
  outputItems = [],
  hmFunction = '',
  specReference = '',
  formula = '',
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: 'var(--fill-1)',
        border: '0.5px solid var(--separator)',
        borderRadius: '8px',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        marginBottom: '10px',
      }}
    >
      {/* Primary Slim Strip: Input -> Process -> Output */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          {/* INPUT PILL */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '5px',
              background: 'var(--fill-2)',
              border: '0.5px solid var(--separator)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ color: 'var(--apple-label-tertiary)', fontWeight: 700 }}>IN:</span>
            <span style={{ color: 'var(--apple-label)', fontWeight: 500 }}>
              {inputItems.join(' • ')}
            </span>
          </div>

          <span style={{ color: 'var(--separator)', fontSize: '13px', userSelect: 'none' }}>➔</span>

          {/* PROCESS PILL */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '5px',
              background: 'var(--fill-3)',
              border: '0.5px solid var(--separator)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ color: 'var(--apple-blue)', fontWeight: 700 }}>OP:</span>
            <span style={{ color: 'var(--apple-label)', fontWeight: 600 }}>{processTitle}</span>
            {processDesc && (
              <span style={{ color: 'var(--apple-label-secondary)', fontSize: '10.5px' }}>
                ({processDesc})
              </span>
            )}
          </div>

          <span style={{ color: 'var(--separator)', fontSize: '13px', userSelect: 'none' }}>➔</span>

          {/* OUTPUT PILL */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '5px',
              background: 'var(--fill-2)',
              border: '0.5px solid var(--separator)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ color: 'var(--system-green)', fontWeight: 700 }}>OUT:</span>
            <span style={{ color: 'var(--apple-label)', fontWeight: 500 }}>
              {outputItems.join(' • ')}
            </span>
          </div>
        </div>

        {/* Expand/Collapse Button for Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Button
            variant="plain"
            size="mini"
            onClick={() => setExpanded((p) => !p)}
            style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)' }}
            title="Toggle Technical Process Formula & Reference"
          >
            {expanded ? 'Hide Details' : 'Details ▾'}
          </Button>
        </div>
      </div>

      {/* Expandable Technical Drawer */}
      {expanded && (
        <div
          style={{
            marginTop: '4px',
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'var(--fill-4)',
            border: '0.5px solid var(--separator)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {hmFunction && (
            <div>
              <span style={{ color: 'var(--apple-label-tertiary)', fontWeight: 600 }}>HM METHOD: </span>
              <span style={{ color: 'var(--apple-blue)', fontWeight: 600 }}>{hmFunction}</span>
            </div>
          )}
          {formula && (
            <div>
              <span style={{ color: 'var(--apple-label-tertiary)', fontWeight: 600 }}>FORMULA: </span>
              <span style={{ color: 'var(--apple-label)', fontWeight: 600 }}>{formula}</span>
            </div>
          )}
          {specReference && (
            <div>
              <span style={{ color: 'var(--apple-label-tertiary)', fontWeight: 600 }}>SPEC REFERENCE: </span>
              <span style={{ color: 'var(--apple-label-secondary)' }}>{specReference}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(CompactStepRibbon);
