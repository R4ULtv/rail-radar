import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown in place of the children after they throw; `reset` renders them again. */
  fallback: (reset: () => void) => ReactNode;
}

/** Keeps a rendering error from closing the app; React logs it. Only possible as a class. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  reset = () => this.setState({ hasError: false });

  render() {
    return this.state.hasError ? this.props.fallback(this.reset) : this.props.children;
  }
}
