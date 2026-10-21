import React from 'react';

/**
 * CuCellInspector: Micro-inspection popover showing exact pixel metrics
 * for Original, Prediction, Residual, and Reconstructed samples upon deliberate click.
 */
const CuCellInspector = ({ selectedCell, setSelectedCell, cuData }) => {
  if (!selectedCell || !cuData) return null;

  const idx = selectedCell.y * cuData.cuSize + selectedCell.x;
  const curOrig = (cuData.orig && cuData.orig[idx] !== undefined) ? cuData.orig[idx] : selectedCell.orig;
  const curPred = (cuData.pred && cuData.pred[idx] !== undefined) ? cuData.pred[idx] : selectedCell.pred;
  const curResi = (cuData.resi && cuData.resi[idx] !== undefined) ? cuData.resi[idx] : selectedCell.resi;
  const curRecon = (cuData.recon && cuData.recon[idx] !== undefined) ? cuData.recon[idx] : selectedCell.recon;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.45rem 0.85rem',
        background: 'var(--apple-canvas)',
        border: '1px solid var(--apple-hairline)',
        fontFamily: 'JetBrains Mono',
        fontSize: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700 }}>
          Sample ({selectedCell.x}, {selectedCell.y})
        </span>
        <span>Original: <strong>{curOrig}</strong></span>
        <span>Prediction: <strong>{curPred}</strong></span>
        <span>Residual: <strong>{curResi > 0 ? `+${curResi}` : curResi}</strong></span>
        <span>Reconstructed: <strong>{curRecon}</strong></span>
        <span>Error: <strong>{Math.abs(curOrig - curRecon)}</strong></span>
      </div>
      <button
        type="button"
        onClick={() => setSelectedCell(null)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--apple-label-secondary)',
          fontSize: '0.7rem'
        }}
        title="Close Inspector"
      >
        ✕
      </button>
    </div>
  );
};

export default React.memo(CuCellInspector);
