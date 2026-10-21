import React from 'react';

/**
 * ErrorBoundary
 * macOS Tahoe Styled React Error Boundary.
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the app.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Rendering Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '380px',
            padding: '24px',
            margin: '20px auto',
            maxWidth: '680px',
            background: 'var(--apple-canvas, #1E1E1E)',
            border: '1px solid var(--apple-hairline, rgba(255, 255, 255, 0.15))',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            boxSizing: 'border-box',
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 59, 48, 0.15)',
              border: '1px solid rgba(255, 59, 48, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
              color: 'var(--apple-red, #FF3B30)',
              fontSize: '20px',
              fontWeight: 800
            }}
          >
            !
          </div>

          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--apple-label, #FFFFFF)',
              letterSpacing: '-0.01em'
            }}
          >
            {this.props.title || 'Component Render Error'}
          </h3>

          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '12px',
              color: 'var(--apple-label-secondary, #A1A1A6)',
              lineHeight: 1.5,
              maxWidth: '520px'
            }}
          >
            An unexpected error occurred while rendering this view. You can reset the active workspace or reload the session.
          </p>

          {this.state.error && (
            <div
              style={{
                width: '100%',
                maxHeight: '140px',
                overflowY: 'auto',
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--apple-hairline, rgba(255, 255, 255, 0.1))',
                borderRadius: '6px',
                padding: '10px 12px',
                marginBottom: '18px',
                textAlign: 'left',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: 'var(--apple-red, #FF6961)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                boxSizing: 'border-box'
              }}
            >
              {String(this.state.error.message || this.state.error)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleReset}
              className="apple-btn-secondary"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 14px',
                height: '28px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="apple-btn-primary"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 14px',
                height: '28px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
