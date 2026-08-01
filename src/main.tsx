import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './components/App';
import { RenderView } from './components/RenderView';
import { parseRenderParams } from './utils/renderRequest';
import { protota } from './utils/agent-api';

// Adwaita web components first — their stylesheet self-applies on import —
// then ours. Our sheet is the override layer, so equal-specificity rules
// (AdwClamp fill semantics, StatusPage metrics) must come last in the
// cascade to win.
import '@gjsify/adwaita-web';
import './index.css';
import { publishIconVariables, restoreStoredSourceIcons } from './utils/adwIcons';
import { installVariableAdwaitaFonts } from './fonts';

// Real variable-font weights instead of browser-synthesised bold.
installVariableAdwaitaFonts();

// Icons used by plain CSS rules rather than .adw-icon-- classes.
publishIconVariables(['window-minimize', 'window-maximize', 'window-close']);
// App-shipped artwork from the loaded preset, registered before first render.
restoreStoredSourceIcons();

document.documentElement.style.margin = '0';
document.documentElement.style.padding = '0';
document.body.style.margin = '0';
document.body.style.padding = '0';

// The live agent handle (docs/render-api.md): selection, transactions,
// events, renderScreenshot. Exposed unconditionally — the deployed app IS
// the agent surface on static hosting.
(window as unknown as Record<string, unknown>).protota = protota;

// `?render=1&…` swaps the editor for the chromeless render view: the
// interactive chrome (top bar, panels, canvas, bottom bar) never mounts.
const mode = parseRenderParams(window.location.search);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {mode.mode === 'editor' ? (
      <App />
    ) : (
      <RenderView
        request={mode.mode === 'render' ? mode.request : undefined}
        error={mode.mode === 'render-error' ? mode.error : undefined}
      />
    )}
  </React.StrictMode>,
);
