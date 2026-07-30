import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './components/App';
import './index.css';

// Import Adwaita web components (CSS + custom elements self-apply)
import '@gjsify/adwaita-web';
import { publishIconVariables, restoreStoredSourceIcons } from './utils/adwIcons';

// Icons used by plain CSS rules rather than .adw-icon-- classes.
publishIconVariables(['window-minimize', 'window-maximize', 'window-close']);
// App-shipped artwork from the loaded preset, registered before first render.
restoreStoredSourceIcons();

document.documentElement.style.margin = '0';
document.documentElement.style.padding = '0';
document.body.style.margin = '0';
document.body.style.padding = '0';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
