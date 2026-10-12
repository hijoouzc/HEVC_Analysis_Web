import React from 'react';
import { Card } from '../apple';

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
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--label)' }}>RDO Decision</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--system-blue)',
          backgroundColor: 'rgba(0, 122, 255, 0.12)',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '0.5px solid rgba(0, 122, 255, 0.25)'
        }}>
          J = D + λR
        </span>
      </div>

      {/* Metrics Parameter Subgrid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.4rem',
        background: 'var(--fill-4)',
        padding: '8px',
        border: '0.5px solid var(--separator)',
        borderRadius: '6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px'
      }}>
        <div>
          <span style={{ color: 'var(--label-2)' }}>QP: </span>
          <span style={{ fontWeight: 700, color: 'var(--label)' }}>{qp}</span>
        </div>
        <div>
          <span style={{ color: 'var(--label-2)' }}>Qstep: </span>
          <span style={{ fontWeight: 700, color: 'var(--label)' }}>{qstepVal.toFixed(2)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--label-2)' }}>λ: </span>
          <span style={{ fontWeight: 700, color: 'var(--system-orange)' }}>{lambdaVal.toFixed(2)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--label-2)' }}>Mode: </span>
          <span style={{ fontWeight: 700, color: 'var(--label)' }}>{activeEval?.modeName || 'Testing'}</span>
        </div>
        <div>
          <span style={{ color: 'var(--label-2)' }}>SSD (D): </span>
          <span style={{ fontWeight: 700, color: 'var(--label)' }}>
            {activeEval?.ssd !== undefined ? Math.round(activeEval.ssd).toLocaleString() : '---'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--label-2)' }}>Rate (R): </span>
          <span style={{ fontWeight: 700, color: 'var(--label)' }}>
            {activeEval?.bits !== undefined ? `${activeEval.bits} b` : '---'}
          </span>
        </div>
      </div>

      {/* RDO Benchmark Comparison Box */}
      <div style={{
        background: 'var(--fill-4)',
        padding: '8px',
        border: '0.5px solid var(--separator)',
        borderRadius: '6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--label-2)' }}>J (No Split):</span>
          <span style={{ fontWeight: 700, color: 'var(--label)' }}>
            {currentStep?.jNonSplit ? Math.round(currentStep.jNonSplit).toLocaleString() : '---'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--label-2)' }}>J (Split 4 CUs):</span>
          <span style={{ fontWeight: 700, color: currentStep?.jSplit ? 'var(--system-orange)' : 'var(--label-3)' }}>
            {currentStep?.jSplit && currentStep.jSplit < Infinity
              ? Math.round(currentStep.jSplit).toLocaleString()
              : '---'}
          </span>
        </div>

        {/* Decision Verdict Tag */}
        {currentStep?.decision && (
          <div style={{
            marginTop: '0.25rem',
            padding: '4px 8px',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '11.5px',
            borderRadius: '6px',
            backgroundColor: currentStep.decision === 'SPLIT' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 122, 255, 0.15)',
            color: currentStep.decision === 'SPLIT' ? 'var(--system-green)' : 'var(--system-blue)',
            border: currentStep.decision === 'SPLIT' ? '0.5px solid rgba(52, 199, 89, 0.35)' : '0.5px solid rgba(0, 122, 255, 0.35)'
          }}>
            {currentStep.decision === 'SPLIT' ? 'Decision: Split into 4 Sub-CUs' : 'Decision: Keep Block (Leaf CU)'}
          </div>
        )}
      </div>
    </Card>
  );
}
