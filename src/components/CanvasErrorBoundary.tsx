import React from 'react';

interface Props {
  /**
   * Identity of the rendered document state (pass the store's `doc`). Any
   * change — an edit, an undo, a redo — clears a caught failure so the
   * canvas immediately tries to render the new state. This is what makes
   * "crash → Ctrl+Z → canvas is back" work without a manual reset.
   */
  resetKey: unknown;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Containment for canvas render/commit crashes (#137).
 *
 * The canvas renders adw-* custom elements that manage their own DOM; a
 * disagreement between React's virtual DOM and the real DOM surfaces as a
 * commit-phase exception (e.g. NotFoundError from removeChild). Without a
 * boundary that exception unmounts the entire application — a blank page
 * with the document still intact in the store. This boundary catches the
 * crash at the screen frame, shows an in-canvas "render failed" card with
 * the error message, and leaves the rest of the editor (toolbar, panels,
 * keyboard shortcuts — including undo) fully functional.
 */
export class CanvasErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    // The document moved on (undo, redo, any edit): retry the render. The
    // setState is guarded by the resetKey comparison, so it runs exactly
    // once per document change — no update loop.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="protota-render-error-card" role="alert" data-testid="render-error-card">
          <strong>This screen failed to render</strong>
          <div className="protota-render-error-message">
            {String(error?.message ?? error)}
          </div>
          <p>
            Your document is intact — press Ctrl+Z to undo the last change,
            or try rendering again.
          </p>
          <button
            type="button"
            className="protota-btn"
            data-testid="render-error-retry"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
