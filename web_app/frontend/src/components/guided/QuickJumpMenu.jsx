import React, { useState, useEffect, useRef } from 'react';

const SECTIONS = [
  {
    id: 'STEP_1',
    num: '1',
    title: 'Frame & CU Partition',
    hmFunction: 'TEncCu::xCompressCU',
    badge: 'QuadTree',
  },
  {
    id: 'STEP_2',
    num: '2',
    title: 'Intra Prediction',
    hmFunction: 'TEncSearch::estIntraPredLumaQT',
    badge: 'Prediction',
  },
  {
    id: 'STEP_3',
    num: '3',
    title: 'Transform & Quantization',
    hmFunction: 'TComTrQuant::transformNxN',
    badge: 'Transform & Quant',
  },
  {
    id: 'STEP_4',
    num: '4',
    title: 'Reconstruction',
    hmFunction: 'TComPic::getPicYuvRec',
    badge: 'Picture Buffer',
  },
  {
    id: 'STEP_5',
    num: '5',
    title: 'RDO Decision',
    hmFunction: 'TEncCu::xCheckBestMode',
    badge: 'RDO Engine',
  },
];

/**
 * QuickJumpMenu
 * Apple Pro floating pop-up menu allowing rapid vertical jumping
 * between all HM execution stages in the continuous stream.
 * Pure vertical list layout, click-only ergonomics, zero hover clutter.
 */
export function QuickJumpMenu({
  activeStep = 'STEP_1',
  onSelectStep = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleJump = (stepId) => {
    if (onSelectStep) {
      onSelectStep(stepId);
    } else {
      const el = document.getElementById(stepId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setIsOpen(false);
  };

  const activeSection = SECTIONS.find((s) => s.id === activeStep) || SECTIONS[0];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
      }}
    >
      {/* Floating Trigger Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '20px',
          background: 'var(--window-bg)',
          color: 'var(--apple-label)',
          border: '0.5px solid var(--separator)',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.22)',
          backdropFilter: 'blur(20px)',
          cursor: 'pointer',
          fontFamily: 'var(--font-system)',
          fontSize: '12px',
          fontWeight: 600,
          transition: 'transform 0.15s ease, background 0.15s ease',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--system-blue)',
            display: 'inline-block',
          }}
        />
        <span>Jump to Stage</span>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--apple-label-secondary)',
            background: 'var(--fill-2)',
            padding: '1px 6px',
            borderRadius: '4px',
            border: '0.5px solid var(--separator)',
          }}
        >
          {activeSection.badge}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--apple-label-tertiary)' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Pop-up Vertical List Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '48px',
            right: '0px',
            width: '340px',
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--window-bg)',
            border: '0.5px solid var(--separator)',
            borderRadius: '12px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(24px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Pop-up Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '0.5px solid var(--separator)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--fill-1)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--apple-label)' }}>
                HM-18.0 Execution Stages
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--apple-label-secondary)', fontFamily: 'var(--font-mono)' }}>
                Select a stage to smooth-scroll
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--apple-label-tertiary)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close"
            >
              &times;
            </button>
          </div>

          {/* Vertical List of Stages */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '6px' }}>
            {SECTIONS.map((sec) => {
              const isActive = activeStep === sec.id;

              return (
                <div
                  key={sec.id}
                  onClick={() => handleJump(sec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    background: isActive ? 'var(--fill-2)' : 'transparent',
                    border: isActive ? '0.5px solid var(--separator)' : '0.5px solid transparent',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                    marginBottom: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isActive ? 'var(--system-blue)' : 'var(--apple-label-quaternary)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? 'var(--apple-label)' : 'var(--apple-label-secondary)',
                        }}
                      >
                        {sec.title}
                      </span>
                      <code
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          color: isActive ? 'var(--system-blue)' : 'var(--apple-label-tertiary)',
                        }}
                      >
                        {sec.hmFunction}
                      </code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontFamily: 'var(--font-mono)',
                        color: isActive ? 'var(--system-blue)' : 'var(--apple-label-tertiary)',
                        background: isActive ? 'var(--fill-3)' : 'var(--fill-1)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        border: '0.5px solid var(--separator)',
                      }}
                    >
                      [{sec.num}]
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: isActive ? 'var(--system-blue)' : 'var(--apple-label-tertiary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {isActive ? '●' : '→'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(QuickJumpMenu);
