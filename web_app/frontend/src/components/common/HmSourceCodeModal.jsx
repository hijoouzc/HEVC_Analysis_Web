import React, { useState, useEffect, useMemo } from 'react';
import { Button, Badge, SegmentedControl, Card } from '../apple';

// Official C++ tokens for HEVC HM-16.0 Reference Software syntax highlighting
const C_TYPES = new Set([
  'Void', 'UInt', 'Int', 'Bool', 'Double', 'Pel', 'Char', 'UChar',
  'TComDataCU', 'TComPic', 'TCoeff', 'ComponentID', 'QpParam',
  'TComPrediction', 'TComTrQuant', 'TEncCu', 'TComSlice', 'TComYuv',
  'Short', 'UShort', 'Float'
]);

const C_KEYWORDS = new Set([
  'const', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
  'return', 'true', 'false', 'NULL', 'static', 'inline', 'auto', 'sizeof',
  'new', 'delete', 'namespace', 'class', 'struct', 'enum', 'virtual'
]);

const C_MACROS = new Set([
  'PLANAR_IDX', 'DC_IDX', 'I_SLICE', 'P_SLICE', 'B_SLICE',
  'COMPONENT_Y', 'COMPONENT_Cb', 'COMPONENT_Cr',
  'DEBUG_STRING_NEW', 'DEBUG_STRING_FN_DECLARE', 'MAX_INT', 'MIN_INT'
]);

/**
 * Tokenizes and renders a single line of C++ code with Xcode-grade syntax coloring.
 */
function renderHighlightedLine(line) {
  if (!line || line.trim() === '') {
    return <span>&nbsp;</span>;
  }

  // Handle single-line comments
  const commentIdx = line.indexOf('//');
  if (commentIdx !== -1) {
    const before = line.slice(0, commentIdx);
    const comment = line.slice(commentIdx);
    return (
      <>
        {renderCodeTokens(before)}
        <span style={{ color: 'var(--apple-label-tertiary, #8E8E93)', fontStyle: 'italic' }}>
          {comment}
        </span>
      </>
    );
  }

  return renderCodeTokens(line);
}

/**
 * Parses raw code text into syntax-highlighted tokens.
 */
function renderCodeTokens(text) {
  if (!text) return null;
  const tokenRegex = /(\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+\b|"[^"]*")/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (C_TYPES.has(token)) {
      parts.push(
        <span key={match.index} style={{ color: 'var(--system-blue)', fontWeight: 600 }}>
          {token}
        </span>
      );
    } else if (C_KEYWORDS.has(token)) {
      parts.push(
        <span key={match.index} style={{ color: 'var(--system-purple)', fontWeight: 600 }}>
          {token}
        </span>
      );
    } else if (C_MACROS.has(token)) {
      parts.push(
        <span key={match.index} style={{ color: 'var(--system-orange)', fontWeight: 600 }}>
          {token}
        </span>
      );
    } else if (/^\d+$/.test(token)) {
      parts.push(
        <span key={match.index} style={{ color: 'var(--system-green)', fontWeight: 500 }}>
          {token}
        </span>
      );
    } else if (token.startsWith('"')) {
      parts.push(
        <span key={match.index} style={{ color: 'var(--system-red)' }}>
          {token}
        </span>
      );
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * HmSourceCodeModal
 * Refined Apple HIG / macOS Tahoe style modal window linking active pipeline stages
 * directly to official ITU-T H.265 / HEVC HM-16.0 C++ reference software implementations.
 */
export default function HmSourceCodeModal({
  isOpen,
  onClose,
  title,
  sourceFile,
  functionName,
  standardRef,
  codeSnippet,
  variables = [],
  description
}) {
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'params' | 'spec'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = () => {
    if (!codeSnippet) return;
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = useMemo(() => {
    if (!codeSnippet) return [];
    return codeSnippet.split('\n');
  }, [codeSnippet]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.48)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'apple-fade-in 150ms ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          backgroundColor: 'var(--apple-window)',
          border: '1px solid var(--apple-hairline)',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.28), 0 0 1px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--apple-label)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Title Bar - macOS Tahoe Window Header */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--apple-hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--apple-surface)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <Badge variant="blue" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
              HM-16.0 C++
            </Badge>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--apple-label)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {title || functionName || 'C++ Implementation'}
              </div>
              <div style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--apple-label-secondary)',
                marginTop: '1px'
              }}>
                {sourceFile}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <Button
              variant="gray"
              size="mini"
              onClick={handleCopy}
              title="Copy C++ source code to clipboard"
              style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '56px', justifyContent: 'center' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="gray"
              size="mini"
              onClick={onClose}
              title="Close window (Esc)"
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Sub-Header Navigation Toolbar */}
        <div
          style={{
            padding: '8px 18px',
            borderBottom: '1px solid var(--apple-hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--apple-canvas)',
            flexWrap: 'wrap',
            gap: '8px',
            flexShrink: 0
          }}
        >
          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab}
            size="small"
            items={[
              { id: 'code', label: 'C++ Source Code' },
              { id: 'params', label: `Runtime Parameters (${variables.length})` },
              { id: 'spec', label: 'H.265 Standard Spec' }
            ]}
          />

          {standardRef && (
            <Badge variant="purple" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
              {standardRef}
            </Badge>
          )}
        </div>

        {/* Modal Body Area */}
        <div
          style={{
            padding: '16px 18px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            flex: 1
          }}
        >
          {/* TAB 1: C++ SOURCE CODE */}
          {activeTab === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Technical Description Banner */}
              {description && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 122, 255, 0.08)',
                    border: '1px solid rgba(0, 122, 255, 0.2)',
                    fontSize: '12px',
                    lineHeight: 1.55,
                    color: 'var(--apple-label)'
                  }}
                >
                  <strong style={{ color: 'var(--system-blue)', marginRight: '6px' }}>HM Architecture:</strong>
                  {description}
                </div>
              )}

              {/* Xcode-Style C++ Code Viewport */}
              <div
                style={{
                  border: '1px solid var(--apple-hairline)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--apple-canvas)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Editor Top Bar */}
                <div
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--apple-hairline)',
                    backgroundColor: 'var(--fill-4)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--apple-label-secondary)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--apple-label-tertiary)' }}>file:</span>
                    <strong style={{ color: 'var(--apple-label)' }}>{sourceFile}</strong>
                  </div>
                  <span>HM-16.0 • C++11</span>
                </div>

                {/* Editor Content Area */}
                <div
                  style={{
                    padding: '12px 0',
                    overflowX: 'auto',
                    backgroundColor: 'var(--apple-surface)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    lineHeight: 1.6
                  }}
                >
                  {lines.map((line, idx) => (
                    <div
                      key={`line-${idx}`}
                      style={{
                        display: 'flex',
                        minHeight: '1.4em',
                        padding: '0 14px 0 0'
                      }}
                    >
                      {/* Line Number Gutter (Unselectable) */}
                      <span
                        style={{
                          width: '3.4rem',
                          flexShrink: 0,
                          textAlign: 'right',
                          paddingRight: '1rem',
                          color: 'var(--apple-label-tertiary)',
                          fontSize: '11px',
                          userSelect: 'none',
                          opacity: 0.75
                        }}
                      >
                        {idx + 1}
                      </span>
                      {/* Highlighted Code Line */}
                      <span style={{ flex: 1, whiteSpace: 'pre', color: 'var(--apple-label)' }}>
                        {renderHighlightedLine(line)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Runtime Highlights Strip */}
              {variables && variables.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--apple-hairline)',
                    backgroundColor: 'var(--apple-surface)'
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--apple-label-secondary)' }}>
                    Active Values:
                  </span>
                  {variables.map((v, i) => (
                    <span
                      key={`quick-var-${i}`}
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: v.highlight ? 'rgba(0, 122, 255, 0.1)' : 'var(--fill-4)',
                        border: `1px solid ${v.highlight ? 'rgba(0, 122, 255, 0.25)' : 'var(--apple-hairline)'}`,
                        color: v.highlight ? 'var(--system-blue)' : 'var(--apple-label)'
                      }}
                    >
                      {v.name}: <strong>{String(v.value)}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RUNTIME PARAMETERS */}
          {activeTab === 'params' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                fontSize: '12px',
                color: 'var(--apple-label-secondary)',
                lineHeight: 1.5
              }}>
                The parameters below reflect the actual runtime execution state inside HM-16.0 for the current active coding unit and target coordinates:
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '10px'
                }}
              >
                {variables.map((v, i) => (
                  <Card
                    key={`param-card-${i}`}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      backgroundColor: v.highlight ? 'rgba(0, 122, 255, 0.04)' : 'var(--apple-surface)',
                      border: v.highlight ? '1px solid rgba(0, 122, 255, 0.3)' : '1px solid var(--apple-hairline)'
                    }}
                  >
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--apple-label-secondary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {v.name}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: v.highlight ? 'var(--system-blue)' : 'var(--apple-label)'
                    }}>
                      {String(v.value)}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: H.265 STANDARD SPECIFICATION */}
          {activeTab === 'spec' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Card style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Badge variant="purple">Standard Reference</Badge>
                  <strong style={{ fontSize: '13px', color: 'var(--apple-label)' }}>
                    {standardRef || 'ITU-T Recommendation H.265 (High Efficiency Video Coding)'}
                  </strong>
                </div>
                <p style={{ fontSize: '12.5px', lineHeight: 1.6, color: 'var(--apple-label-secondary)', margin: '0 0 12px 0' }}>
                  {description || 'The HM reference software strictly enforces the normative specifications defined in the ITU-T H.265 standard document.'}
                </p>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--fill-4)',
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--apple-label)'
                }}>
                  <div><strong>Implementation File:</strong> {sourceFile}</div>
                  <div style={{ marginTop: '4px' }}><strong>Primary C++ Function:</strong> {functionName || 'Core Algorithm'}</div>
                </div>
              </Card>

              <Card style={{ padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--apple-label)', marginBottom: '6px' }}>
                  Normative Compliance & Decoder Guarantees
                </div>
                <div style={{ fontSize: '12px', color: 'var(--apple-label-secondary)', lineHeight: 1.55 }}>
                  Any standard-compliant HEVC decoder (such as FFmpeg, Apple VideoToolbox, or libde265) mirrors this exact logical state when decoding the generated NAL units. The decision outputs in HM-16.0 ensure bit-exact cross-platform decoding interoperability.
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Window Footer Toolbar */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--apple-hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--apple-surface)',
            fontSize: '11.5px',
            color: 'var(--apple-label-secondary)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>ITU-T H.265</span>
            <span style={{ color: 'var(--apple-label-tertiary)' }}>•</span>
            <span>ISO/IEC 23008-2</span>
            <span style={{ color: 'var(--apple-label-tertiary)' }}>•</span>
            <span>HM-16.0 Reference Software</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="gray"
              size="small"
              onClick={handleCopy}
              style={{ fontSize: '11.5px', minWidth: '88px', justifyContent: 'center' }}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
            <Button
              variant="filled"
              size="small"
              onClick={onClose}
              style={{ fontSize: '11.5px' }}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
