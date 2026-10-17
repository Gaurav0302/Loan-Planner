import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DATA_KEY } from '../data/load';
import { readItem } from '../lib/storage';

interface State {
  error: Error | null;
}

/**
 * If a screen fails, show what happened instead of a blank page. Saved data is never touched here,
 * and it can still be downloaded as a backup straight from storage.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Timbertop screen failed', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Moving to another screen gives it a fresh start.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private download = () => {
    const raw = readItem(DATA_KEY);
    if (!raw) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timbertop-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <section className="card" role="alert">
          <h1 className="page-title" tabIndex={-1}>Something went wrong on this screen</h1>
          <p className="muted">Your plans and balances are still saved in this browser. Try another screen, or reload the page.</p>
          <p className="muted small">Details: {this.state.error.message}</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>Reload</button>
            <a className="btn" href="#/dashboard">Go to the dashboard</a>
            <button type="button" className="btn" onClick={this.download}>Download a backup file</button>
          </div>
        </section>
      </div>
    );
  }
}
