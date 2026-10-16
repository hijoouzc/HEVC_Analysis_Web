import React from 'react';
import { Badge } from '../apple';

/**
 * SectionHeader
 * High-signal, Apple Pro section header for HM execution stages.
 * Strictly displays only:
 *   - Primary Block Title (Stage Name)
 *   - Primary HM Function (Reference function in HM-18.0)
 *   - Clean technical context description
 * Zero "Step X" numbering.
 */
export function SectionHeader({
  title = '',
  hmFunction = '',
  description = '',
  badge = 'HM-18.0',
  badgeVariant = 'blue',
  rightContent = null,
}) {
  return (
    <div
      style={{
        background: 'var(--window-bg)',
        border: '0.5px solid var(--separator)',
        borderRadius: '8px',
        padding: '8px 14px',
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--apple-label)',
            }}
          >
            {title}
          </h2>

          {hmFunction && (
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--system-blue)',
                background: 'var(--fill-2)',
                padding: '2px 8px',
                borderRadius: '5px',
                border: '0.5px solid var(--separator)',
              }}
            >
              {hmFunction}
            </code>
          )}

          {badge && (
            <Badge variant={badgeVariant} style={{ fontSize: '9.5px', padding: '1px 6px' }}>
              {badge}
            </Badge>
          )}
        </div>

        {description && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--apple-label-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {description}
          </span>
        )}
      </div>

      {rightContent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rightContent}
        </div>
      )}
    </div>
  );
}

export default React.memo(SectionHeader);
