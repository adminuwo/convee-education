import React from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught a component error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6" data-testid="error-boundary-view">
          <div className="max-w-lg w-full bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                An unexpected interface error occurred while rendering this tab. Your session data and workspace are safe.
              </p>
            </div>

            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <div className="p-3 bg-muted/40 rounded-xl text-left border border-border/60 overflow-x-auto text-[11px] font-mono text-rose-300 max-h-32">
                {this.state.error?.toString()}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="gap-2 rounded-xl text-xs font-semibold"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => (window.location.href = '/app/home')}
                className="gap-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Home className="w-4 h-4" /> Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
