import { Component, type ErrorInfo, type ReactNode } from "react";

import type { CapturedError } from "@/lib/error-report";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown in place of the children after they throw; `reset` renders them again. */
  fallback: (reset: () => void, failure: CapturedError) => ReactNode;
}

/** Keeps a rendering error from closing the app; React logs it. Only possible as a class. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  { failure: CapturedError | null }
> {
  state: { failure: CapturedError | null } = { failure: null };

  static getDerivedStateFromError(error: unknown) {
    return { failure: { error, componentStack: "" } };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ failure: { error, componentStack: info.componentStack ?? "" } });
  }

  reset = () => this.setState({ failure: null });

  render() {
    return this.state.failure
      ? this.props.fallback(this.reset, this.state.failure)
      : this.props.children;
  }
}
