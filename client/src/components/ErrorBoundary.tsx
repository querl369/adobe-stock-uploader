import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-[#efefef]">
          <div className="grain-gradient bg-gradient-to-br from-white/80 to-white/60 border-2 border-border/20 rounded-2xl p-8 space-y-4 text-center max-w-md">
            <div className="text-[1.25rem] tracking-[-0.02em] opacity-90">
              Something unexpected happened
            </div>
            <p className="tracking-[-0.01em] opacity-50 text-[0.9rem]">
              The application encountered an error. Please reload to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="grain-gradient px-8 py-3 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-primary-foreground rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] tracking-[-0.01em] text-[0.95rem] relative overflow-hidden group"
            >
              <span className="relative z-10">Reload</span>
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 rounded-2xl pointer-events-none" />
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
