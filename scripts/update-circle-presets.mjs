#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { blueprintBundleToDocument } from '../src/utils/blueprint.js';

const catalogPath = new URL('../tests/fixtures/gnome-app-catalog.json', import.meta.url);
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const tmpDir = join(process.cwd(), '.tmp-gnome-circle-fetch');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

for (const [id, app] of Object.entries(catalog)) {
  if (!app.sourceImport) continue;

  console.log(`\n=== Processing ${app.name} (${id}) ===`);
  const cloneDir = join(tmpDir, id);
  if (existsSync(cloneDir)) rmSync(cloneDir, { recursive: true, force: true });

  try {
    console.log(`Cloning ${app.sourceImport.repository}...`);
    execSync(`git clone --depth 1 "${app.sourceImport.repository}" "${cloneDir}"`, { stdio: 'inherit' });

    let uiRoot = join(cloneDir, app.sourceImport.uiPath);
    
    // Auto-detect UI directory if specified path doesn't exist
    if (!existsSync(uiRoot)) {
      console.log(`UI root ${app.sourceImport.uiPath} not found in ${id}, auto-searching for UI directory...`);
      const possibleDirs = ['data/ui', 'data/resources/ui', 'src/ui', 'src/gtk', 'ui', 'data', 'src'];
      const foundDir = possibleDirs.find(d => existsSync(join(cloneDir, d)));
      if (foundDir) {
        uiRoot = join(cloneDir, foundDir);
        app.sourceImport.uiPath = foundDir;
        console.log(`Auto-detected UI root: ${foundDir}`);
      } else {
        uiRoot = cloneDir;
        app.sourceImport.uiPath = '.';
      }
    }

    let entry = app.sourceImport.entry;

    // Auto-detect entry file if original path is missing or non-existent
    const files = readdirSync(uiRoot, { recursive: true }).filter(f => typeof f === 'string' && (f.endsWith('.ui') || f.endsWith('.blp')));
    if (!files.length) {
      console.warn(`No .ui or .blp files found in ${uiRoot} for ${id}`);
      continue;
    }

    if (!files.includes(entry)) {
      const candidate = files.find(f => /window\.(ui|blp)$/i.test(f) || /main\.(ui|blp)$/i.test(f) || /app\.(ui|blp)$/i.test(f)) || files[0];
      if (candidate) {
        entry = candidate;
        app.sourceImport.entry = entry;
        console.log(`Auto-selected entry file: ${entry}`);
      }
    }

    console.log(`Packaging source bundle for ${id} (entry: ${entry})...`);
    execSync(`node scripts/source-package.mjs "${uiRoot}" "${entry}" "public/source-imports/${id}.source.json"`, { stdio: 'inherit' });

    console.log(`Generating preset mockup for ${id}...`);
    const sourcePkg = JSON.parse(readFileSync(`public/source-imports/${id}.source.json`, 'utf8'));
    const doc = blueprintBundleToDocument(sourcePkg.files, sourcePkg.entry, app.name);
    const payload = { version: 1, exportedAt: new Date().toISOString(), document: doc, assets: {} };
    writeFileSync(`public/presets/${id}.mockup.json`, JSON.stringify(payload, null, 2));
    app.status = 'preset';
    console.log(`Successfully generated preset for ${id}`);
  } catch (err) {
    console.error(`Failed to process ${id}:`, err.message);
  } finally {
    if (existsSync(cloneDir)) rmSync(cloneDir, { recursive: true, force: true });
  }
}

writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log('\nUpdated tests/fixtures/gnome-app-catalog.json');
