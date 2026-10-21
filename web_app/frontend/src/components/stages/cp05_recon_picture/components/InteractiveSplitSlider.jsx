import React, { useState, useRef, useEffect } from 'react';

/**
 * InteractiveSplitSlider: Draggable split-view divider with physics and percentage badge.
 */
const InteractiveSplitSlider = ({
  isFrame,
  imgWidth,
  imgHeight,
  leftSrc,
  rightSrc,
  imageSrc,
  initialPos = 50,
  splitLeft,
  splitRight,
  renderPixelMatrix,
}) => {
  const [splitPos, setSplitPos] = useState(initialPos);
  const splitContainerRef = useRef(null);
  const isDraggingSplit = useRef(false);

  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    isDraggingSplit.current = true;
  };

  const handleSplitTouchStart = () => {
    isDraggingSplit.current = true;
  };

  useEffect(() => {
    const handleMove = (clientX) => {
      if (!isDraggingSplit.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setSplitPos(pos);
    };

    const handleMouseMove = (e) => handleMove(e.clientX);
    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX);
    };

    const handleEnd = () => {
      isDraggingSplit.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  return (
    <div
      ref={splitContainerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: isFrame ? '860px' : '560px',
        margin: '0 auto',
        aspectRatio: isFrame ? `${imgWidth} / ${imgHeight}` : '1 / 1',
        border: '1px solid var(--apple-hairline)',
        borderRadius: 0,
        boxShadow: 'none',
        overflow: 'hidden',
        userSelect: 'none',
        background: 'var(--apple-canvas)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        {isFrame ? (
          <img
            src={rightSrc}
            alt="Right"
            onError={(e) => {
              if (e.currentTarget.src !== imageSrc && imageSrc) {
                e.currentTarget.src = imageSrc;
              }
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderPixelMatrix(splitRight, `${splitRight.toUpperCase()}`, 'Right', true)}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)`,
        }}
      >
        {isFrame ? (
          <img
            src={leftSrc}
            alt="Left"
            onError={(e) => {
              if (e.currentTarget.src !== imageSrc && imageSrc) {
                e.currentTarget.src = imageSrc;
              }
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderPixelMatrix(splitLeft, `${splitLeft.toUpperCase()}`, 'Left', true)}
          </div>
        )}
      </div>

      <div
        onMouseDown={handleSplitMouseDown}
        onTouchStart={handleSplitTouchStart}
        tabIndex={0}
        role="slider"
        aria-valuenow={Math.round(splitPos)}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setSplitPos(p => Math.max(0, p - 2));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setSplitPos(p => Math.min(100, p + 2));
          }
        }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${splitPos}%`,
          width: '1.5px',
          background: '#FFFFFF',
          filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.4))',
          cursor: 'ew-resize',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          outline: 'none',
        }}
      >
        {/* Frosted Glass Handle Knob */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--apple-surface)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            border: '0.5px solid var(--separator)',
            boxShadow: 'var(--shadow-thumb)',
            color: 'var(--label)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 600,
            userSelect: 'none',
            transition: 'transform 0.1s ease',
          }}
        >
          ↔
        </div>

        {/* Floating Percent Badge */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            background: 'var(--apple-surface)',
            color: 'var(--label)',
            border: '0.5px solid var(--separator)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-card-small)'
          }}
        >
          {Math.round(splitPos)}%
        </div>
      </div>
    </div>
  );
};

export default React.memo(InteractiveSplitSlider);
