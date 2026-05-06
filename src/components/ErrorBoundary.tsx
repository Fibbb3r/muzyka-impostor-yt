import React from 'react';

interface State { hasError: boolean; error: string }

export default class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 16,
          background: 'var(--bg)', color: 'var(--text)', padding: 24,
        }}>
          <div style={{ fontSize: 36 }}>💥</div>
          <h2 style={{ fontWeight: 800, fontSize: 18 }}>Coś się posypało</h2>
          <code style={{
            background: 'var(--bg3)', padding: '10px 16px', borderRadius: 10,
            fontSize: 12, color: 'var(--danger)', maxWidth: 520, wordBreak: 'break-word',
            textAlign: 'center',
          }}>
            {this.state.error}
          </code>
          <button
            className="btn btn-ghost"
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
          >
            Odśwież stronę
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
