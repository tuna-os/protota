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

for (const [key, value] of Object.entries({
  BROADWAY_APP_ID: appId,
  BROADWAY_APP_PACKAGE: app.aptPackage,
  BROADWAY_APP_COMMAND: app.command,
  BROADWAY_PRESET_ID: app.presetId,
  BROADWAY_VIEWPORT_WIDTH: app.viewport.width,
  BROADWAY_VIEWPORT_HEIGHT: app.viewport.height,
})) {
  console.log(`${key}=${value}`);
}
