import React, { useState, useMemo } from 'react';
import { generateDrawioXml, copyXmlToClipboard, downloadDrawioFile } from '../../utils/drawioXmlGenerator';

/**
 * DrawioExportModal
 * Apple macOS Tahoe themed modal for viewing, copying, and downloading
 * Draw.io / diagrams.net compatible (<mxGraphModel>) XML for HEVC CTU QuadTree.
 */
export default function DrawioExportModal({
  isOpen,
  onClose,
  treeRoot = null,
  partitionNodes = [],
  ctuX = 0,
  ctuY = 0,
  leafCount = 0,
  maxDepth = 3
}) {
  const [includeCost, setIncludeCost] = useState(true);
  const [includeMode, setIncludeMode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate XML dynamically based on options
  const xmlContent = useMemo(() => {
    if (!isOpen) return '';
    return generateDrawioXml({
      treeRoot,
      partitionNodes,
      ctuX,
      ctuY,
      options: {
        includeCost,
        includeMode
      }
    });
  }, [isOpen, treeRoot, partitionNodes, ctuX, ctuY, includeCost, includeMode]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const success = await copyXmlToClipboard(xmlContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const filename = `hevc_ctu_${ctuX}_${ctuY}_quadtree.drawio`;
    downloadDrawioFile(xmlContent, filename);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.25rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="apple-card"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--apple-surface)',
          borderRadius: '12px',
          border: '1px solid var(--apple-hairline)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--apple-hairline)',
            backgroundColor: 'var(--apple-canvas)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#FF5F56',
                display: 'inline-block',
                cursor: 'pointer'
              }}
              onClick={onClose}
              title="Close window"
            />
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--apple-label)' }}>
                Export Draw.io / diagrams.net (XML)
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--apple-label-secondary)', fontFamily: 'JetBrains Mono' }}>
                CTU ({ctuX}, {ctuY}) • {leafCount} Leaf CUs • Max Depth {maxDepth}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="apple-btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
          >
            Done
          </button>
        </div>

        {/* Options & Action Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            background: 'var(--apple-surface)',
            borderBottom: '1px solid var(--apple-hairline)'
          }}
        >
          {/* Checkbox Options */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--apple-label)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeCost}
                onChange={(e) => setIncludeCost(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Include RDCost</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--apple-label)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeMode}
                onChange={(e) => setIncludeMode(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Include Modes</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="apple-btn-secondary"
              onClick={handleDownload}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              title="Download file for diagrams.net"
            >
              <span>⬇</span>
              <span>Download .drawio</span>
            </button>

            <button
              type="button"
              className="apple-btn-primary"
              onClick={handleCopy}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '88px',
                backgroundColor: copied ? '#34C759' : 'var(--apple-blue)'
              }}
              title="Copy raw XML code"
            >
              {copied ? 'Copied!' : 'Copy XML'}
            </button>
          </div>
        </div>

        {/* XML Code Viewer */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.25rem',
            background: 'var(--apple-canvas)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.74rem',
            lineHeight: '1.5',
            color: 'var(--apple-label)',
            userSelect: 'text',
            minHeight: '260px',
            maxHeight: '440px'
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {xmlContent}
          </pre>
        </div>

        {/* Modal Footer / Instructions */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            background: 'var(--apple-surface)',
            borderTop: '1px solid var(--apple-hairline)',
            fontSize: '0.72rem',
            color: 'var(--apple-label-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}
        >
          <div>
            <strong>Quick Import Guide:</strong> Open <a href="https://app.diagrams.net" target="_blank" rel="noreferrer" style={{ color: 'var(--apple-blue)', textDecoration: 'none' }}>draw.io</a> → Press <kbd style={{ padding: '0.1rem 0.35rem', background: 'var(--fill-3)', border: '1px solid var(--apple-hairline)', borderRadius: '3px' }}>Ctrl+V</kbd> or menu <em>Arrange → Insert → Advanced → From Text</em>.
          </div>
          <a
            href="https://app.diagrams.net"
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--apple-blue)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.72rem'
            }}
          >
            Launch Draw.io ↗
          </a>
        </div>
      </div>
    </div>
  );
}
