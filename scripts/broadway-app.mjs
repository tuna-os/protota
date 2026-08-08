import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../tests/fixtures/gnome-app-catalog.json', import.meta.url), 'utf8'));
const appId = process.argv[2] || 'calculator';
if (appId === '--list') {
  for (const [id, app] of Object.entries(catalog)) {
    if (app.status === 'preset') console.log(id);
  }
  process.exit(0);
}
const app = catalog[appId];

if (!app) {
  throw new Error(`Unknown GNOME app "${appId}". Add it to tests/fixtures/gnome-app-catalog.json first.`);
}
if (app.status !== 'preset') {
  throw new Error(`GNOME app "${appId}" has no preset/reference capture target yet.`);
}

const environment = {
  BROADWAY_APP_ID: appId,
  BROADWAY_APP_PACKAGE: app.aptPackage,
  BROADWAY_APP_COMMAND: app.command,
  BROADWAY_PRESET_ID: app.presetId,
  BROADWAY_VIEWPORT_WIDTH: app.viewport.width,
  BROADWAY_VIEWPORT_HEIGHT: app.viewport.height,
};
if (app.sourceImport) {
  environment.BROADWAY_SOURCE_REPOSITORY = app.sourceImport.repository;
  // importRoot is the directory the preset generator walks (may include Vala
  // sources for static enrichment); fall back to the legacy uiPath.
  environment.BROADWAY_SOURCE_UI_PATH = app.sourceImport.importRoot ?? app.sourceImport.uiPath;
  environment.BROADWAY_SOURCE_ENTRY = app.sourceImport.entry;
  // The tag is the upstream release this app's entry path and per-app gates
  // were calibrated against, so the capture must check it out rather than
  // whatever the default branch happens to hold today.
  if (app.sourceImport.tag) environment.BROADWAY_SOURCE_TAG = app.sourceImport.tag;
}

for (const [key, value] of Object.entries(environment)) {
  console.log(`${key}=${value}`);
}
