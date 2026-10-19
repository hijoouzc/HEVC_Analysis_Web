import React from 'react';
import { Card } from '../../../apple';

/**
 * RdoDecisionCard
 * Compact mathematical formulation card for Rate-Distortion Optimization (RDO):
 * J = D + lambda * R
 * Direct benchmark comparison between Non-Split and Split decisions.
 * Displays exact parameters conforming to HEVC standard and HM xCompressCU.
 */
export default function RdoDecisionCard({
  qp,
  qstepVal,
  lambdaVal,
  activeEval,
  currentStep
}) {
  return (
    <Card style={{
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.55rem',
      minWidth: 0,
      height: '235px',
      minHeight: '235px',
      maxHeight: '235px',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '20px', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--label)', whiteSpace: 'nowrap' }}>RDO Decision</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--system-blue)',
          backgroundColor: 'rgba(0, 122, 255, 0.12)',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '0.5px solid rgba(0, 122, 255, 0.25)',
          whiteSpace: 'nowrap'
        }}>
          J = D + λR
        </span>
      </div>

      {/* Metrics Parameter Subgrid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        columnGap: '0.75rem',
        rowGap: '0.25rem',
        background: 'var(--fill-4)',
        padding: '6px 10px',
        border: '0.5px solid var(--separator)',
        borderRadius: '6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '17px', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--label-2)' }}>QP:</span>
          <span style={{ fontWeight: 700, color: 'var(--label)', fontVariantNumeric: 'tabular-nums' }}>{qp}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '17px', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--label-2)' }}>Qstep:</span>
          <span style={{ fontWeight: 700, color: 'var(--label)', fontVariantNumeric: 'tabular-nums' }}>{qstepVal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '17px', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--label-2)' }}>λ:</span>
          <span style={{ fontWeight: 700, color: 'var(--system-orange)', fontVariantNumeric: 'tabular-nums' }}>{lambdaVal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '17px', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--label-2)' }}>Mode:</span>
          <span style={{ fontWeight: 700, color: 'var(--label)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }} title={activeEval?.modeName}>{activeEval?.modeName || 'Testing'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '17px', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--label-2)' }}>Dist (D):</span>
          <span style={{ fontWeight: 700, color: 'var(--label)', fontVariantNumeric: 'tabular-nums' }}>
            {activeEval?.ssd !== undefined ? Math.round(activeEval.ssd).toLocaleString() : '---'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '17px', whiteSpace: 'nowrap' }} title="HM RDO Rate Estimate: (J - D) / λ">
          <span style={{ color: 'var(--label-2)' }}>Rate (R):</span>
          <span style={{ fontWeight: 700, color: 'var(--label)', fontVariantNumeric: 'tabular-nums' }}>
            {activeEval?.bits !== undefined ? `${activeEval.bits} b` : '---'}
          </span>
        </div>
      </div>

      {/* RDO Benchmark Comparison Box */}
      <div style={{
        background: 'var(--fill-4)',
        padding: '6px 10px',
        border: '0.5px solid var(--separator)',
        borderRadius: '6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '18px', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--label-2)', whiteSpace: 'nowrap' }}>No-Split (J_nosplit):</span>
          <span style={{ fontWeight: 700, color: 'var(--label)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {currentStep?.jNonSplit ? Math.round(currentStep.jNonSplit).toLocaleString() : '---'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '18px', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--label-2)', whiteSpace: 'nowrap' }}>Split (J_split):</span>
          <span style={{
            fontWeight: 700,
            color: (currentStep?.jSplit && currentStep.jSplit < Infinity) ? 'var(--system-orange)' : 'var(--label-3)',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap'
          }}>
            {currentStep?.jSplit && currentStep.jSplit < Infinity
              ? Math.round(currentStep.jSplit).toLocaleString()
              : (currentStep?.decision === 'KEEP' && (currentStep?.depth >= 3 || currentStep?.size <= 8) ? '— (Leaf CU)' : '— (N/A)')}
          </span>
        </div>

        {/* Decision Verdict Tag (Pre-reserved fixed slot to prevent layout jitter) */}
        <div style={{
          marginTop: '0.15rem',
          height: '24px',
          minHeight: '24px',
          maxHeight: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '11px',
          borderRadius: '5px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxSizing: 'border-box',
          backgroundColor: currentStep?.decision === 'SPLIT'
            ? 'rgba(52, 199, 89, 0.15)'
            : currentStep?.decision === 'KEEP'
            ? 'rgba(0, 122, 255, 0.15)'
            : 'var(--fill-2)',
          color: currentStep?.decision === 'SPLIT'
            ? 'var(--system-green)'
            : currentStep?.decision === 'KEEP'
            ? 'var(--system-blue)'
            : 'var(--label-3)',
          border: currentStep?.decision === 'SPLIT'
            ? '0.5px solid rgba(52, 199, 89, 0.35)'
            : currentStep?.decision === 'KEEP'
            ? '0.5px solid rgba(0, 122, 255, 0.35)'
            : '0.5px dashed var(--separator)'
        }}>
          {currentStep?.decision === 'SPLIT'
            ? 'Decision: Split into 4 Sub-CUs'
            : currentStep?.decision === 'KEEP'
            ? 'Decision: Keep Block (Leaf CU)'
            : 'Testing candidate modes...'}
        </div>
      </div>
    </Card>
  );
}
