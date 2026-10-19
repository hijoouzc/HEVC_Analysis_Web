import React from 'react';

/* ----------------------------------------------------------------------------
 * 2. SPLIT VIEW LAYOUT (Apple HIG Multi-Pane Pro Architecture)
 * ---------------------------------------------------------------------------- */

export function SplitView({ children, columns = 2, className = '', style = {}, ...props }) {
  return (
    <div
      data-slot="split-view"
      data-columns={columns}
      className={`apple-split-view cols-${columns} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function SplitViewSidebar({
  children,
  width = '240px',
  collapsed = false,
  className = '',
  style = {},
  'aria-label': label = 'Sidebar',
  ...props
}) {
  if (collapsed) return null;
  return (
    <aside
      data-slot="split-view-sidebar"
      aria-label={label}
      className={`apple-split-sidebar ${className}`}
      style={{ width, ...style }}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SplitViewContent({
  children,
  className = '',
  style = {},
  'aria-label': label = 'Content',
  ...props
}) {
  return (
    <main
      data-slot="split-view-content"
      aria-label={label}
      className={`apple-split-content ${className}`}
      style={style}
      {...props}
    >
      {children}
    </main>
  );
}

export function SplitViewDetail({
  children,
  width = '300px',
  collapsed = false,
  className = '',
  style = {},
  'aria-label': label = 'Detail Inspector',
  ...props
}) {
  if (collapsed) return null;
  return (
    <section
      data-slot="split-view-detail"
      aria-label={label}
      className={`apple-split-detail ${className}`}
      style={{ width, ...style }}
      {...props}
    >
      {children}
    </section>
  );
}
