"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="h-dvh flex items-center justify-center bg-[#0a0a0b] px-6">
        <div className="text-center max-w-sm">
          <p className="text-[14px] font-medium text-[#e8e8e8] mb-2">Something went wrong</p>
          <p className="text-[12px] text-[#888] mb-4 font-mono break-all">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[#1c1c1c] text-[#e8e8e8] border border-[#2a2a2a] hover:bg-[#252525] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
