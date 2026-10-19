import React, { useState, useRef, useEffect } from 'react';

/* ----------------------------------------------------------------------------
 * 5. SEGMENTED CONTROL (With Animated Sliding Indicator)
 * ---------------------------------------------------------------------------- */

export function SegmentedControl({
  value,
  onChange,
  items = [],
  size = 'regular',
  className = '',
  style = {},
}) {
  const trackRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  const sizeClasses = {
    small: 'apple-segmented-small',   // 20px
    regular: 'apple-segmented-regular', // 24px
    large: 'apple-segmented-large',   // 32px
  };

  useEffect(() => {
    const updateIndicator = () => {
      if (!trackRef.current) return;
      const activeBtn = trackRef.current.querySelector('[data-state="active"]');
      if (activeBtn) {
        setIndicatorStyle({
          width: `${activeBtn.offsetWidth}px`,
          transform: `translateX(${activeBtn.offsetLeft}px)`,
          opacity: 1,
        });
      } else {
        setIndicatorStyle({ opacity: 0 });
      }
    };

    updateIndicator();
    const rafId = requestAnimationFrame(updateIndicator);
    window.addEventListener('resize', updateIndicator);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [value, items]);

  return (
    <div
      ref={trackRef}
      className={`apple-segmented-track ${sizeClasses[size] || sizeClasses.regular} ${className}`}
      role="tablist"
      style={style}
    >
      <div
        className="apple-segmented-indicator"
        style={indicatorStyle}
        aria-hidden="true"
      />
      {items.map((item) => {
        const isSelected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-state={isSelected ? 'active' : 'inactive'}
            className={`apple-segmented-item ${isSelected ? 'active' : ''}`}
            onClick={() => onChange && onChange(item.id)}
            title={item.tooltip || item.label}
          >
            {item.icon && <span className="segmented-icon">{item.icon}</span>}
            <span className="segmented-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
