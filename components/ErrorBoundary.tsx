import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    // Clear potentially corrupt state
    try {
      const zenState = localStorage.getItem('zen-state');
      if (zenState) {
        const parsed = JSON.parse(zenState);
        // Clear quiz progress which is the most common cause of crashes
        if (parsed.quizProgress) {
          parsed.quizProgress = null;
          localStorage.setItem('zen-state', JSON.stringify(parsed));
        }
      }
    } catch (e) {
      console.error('Failed to clean state:', e);
    }
    
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleClearAll = () => {
    localStorage.removeItem('zen-state');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-zen-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zen-card rounded-3xl p-8 border border-zen-surface text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-light text-zen-text-primary mb-2">Something went wrong</h2>
            <p className="text-zen-text-secondary mb-6">
              The app encountered an unexpected error. This is usually caused by corrupted data.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-zen-primary text-zen-bg rounded-xl font-bold uppercase tracking-wider text-sm hover:brightness-110 active:scale-95 transition-all"
              >
                Try Again
              </button>
              <button
                onClick={this.handleClearAll}
                className="w-full py-3 bg-zen-surface text-zen-text-secondary rounded-xl font-medium text-sm hover:bg-zen-surface/80 active:scale-95 transition-all"
              >
                Clear Data & Reload
              </button>
            </div>
            
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-zen-text-disabled cursor-pointer hover:text-zen-text-secondary">
                  Technical Details
                </summary>
                <pre className="mt-2 p-3 bg-zen-bg rounded-lg text-xs text-red-400 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
