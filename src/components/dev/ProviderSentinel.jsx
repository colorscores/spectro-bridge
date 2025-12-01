import React from 'react';

// Lightweight error boundary to pinpoint which provider fails during render
class ProviderSentinel extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log with provider name context
    // eslint-disable-next-line no-console
    console.error(`[ProviderSentinel] Error in ${this.props.name}:`, error, info);
  }

  render() {
    const { hasError, error } = this.state;
    const { name, children } = this.props;

    if (hasError) {
      return (
        <div style={{
          position: 'relative',
          padding: '8px 12px',
          margin: '8px',
          border: '1px solid rgba(255,0,0,0.3)',
          borderRadius: 8,
          background: 'rgba(255,0,0,0.05)'
        }}>
          <strong>Provider crashed:</strong> {name}
          <div style={{ fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>
            {String(error?.message || error)}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ProviderSentinel;
