/**
 * Rendering settles asynchronously: webfonts load, the runtime icon registry
 * injects CSS, and the adw-* custom elements upgrade. This waits for all of
 * that to have painted, so automation — screenshot tests, the capture
 * tooling, anything driving the app — can wait for a settled frame instead
 * of guessing with a timeout. The editor (App) and the URL render mode
 * (RenderView) both publish `data-protota-ready` on <html> after this
 * resolves; `protota.renderScreenshot` awaits it before capturing.
 */
export async function settleRender(): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    // A browser without the font API still gets the frame wait below.
  }
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
