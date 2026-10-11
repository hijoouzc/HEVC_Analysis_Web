import React, { memo } from 'react';
import { SELECTION_HIGHLIGHT_COLOR } from '../../utils/colorUtils';

/**
 * Individual memoized cell in the block matrix.
 * Re-renders ONLY if its own value, selection state, or coordinate changes.
 */
const MatrixCell = memo(function MatrixCell({
  x,
  y,
  width,
  isSelected,
  isDC,
  style,
  displayVal,
  title,
  onSelect
}) {
  return (
    <div
      onClick={() => onSelect({ x, y })}
      style={{
        backgroundColor: style.bg,
        color: style.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: width > 8 ? '0.55rem' : '0.72rem',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: style.fontWeight || 700,
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'clip',
        padding: '1px',
        borderRadius: 0,
        outline: isSelected
          ? `2px solid ${SELECTION_HIGHLIGHT_COLOR}`
          : (isDC ? '1.5px solid var(--apple-blue)' : 'none'),
        boxShadow: 'none',
        zIndex: isSelected ? 10 : (isDC ? 2 : 1),
        cursor: 'pointer',
        userSelect: 'none'
      }}
      title={title}
    >
      {displayVal}
    </div>
  );
});

/**
 * BlockMatrixGrid
 * High-performance, pixel-accurate 2D matrix renderer for Residual, DCT/DST,
 * and Quantized coefficient blocks.
 * Enforces strict 90-degree right angles (border-radius: 0) and 60 FPS fluid interaction.
 */
function BlockMatrixGrid({
  data = [],
  width = 8,
  selectedCell = null,
  onSelectCell,
  getColor,
  formatValue,
  getTooltip
}) {
  const handleCellClick = (coord) => {
    if (onSelectCell) {
      onSelectCell(coord);
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, 1fr)`,
        gap: '1px',
        background: 'var(--apple-hairline)',
        padding: '1px',
        border: '1px solid var(--apple-hairline)',
        borderRadius: 0,
        overflow: 'hidden',
        aspectRatio: '1/1'
      }}
    >
      {data.map((val, idx) => {
        const x = idx % width;
        const y = Math.floor(idx / width);
        const isSelected = selectedCell && selectedCell.x === x && selectedCell.y === y;
        const isDC = (x === 0 && y === 0);
        const style = getColor ? getColor(val, isDC, x, y) : { bg: 'var(--apple-surface)', color: 'var(--apple-label)' };
        const displayVal = formatValue ? formatValue(val, x, y, isDC) : val;
        const title = getTooltip ? getTooltip(val, x, y, isDC) : `(${x}, ${y}): ${val}`;

        return (
          <MatrixCell
            key={`${x}-${y}`}
            x={x}
            y={y}
            val={val}
            width={width}
            isSelected={isSelected}
            isDC={isDC}
            style={style}
            displayVal={displayVal}
            title={title}
            onSelect={handleCellClick}
          />
        );
      })}
    </div>
  );
}

export default memo(BlockMatrixGrid);
