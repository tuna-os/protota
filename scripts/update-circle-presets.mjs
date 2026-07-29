#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blueprintBundleToDocument } from '../src/utils/blueprint.js';

const catalogPath = new URL('../tests/fixtures/gnome-app-catalog.json', import.meta.url);
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const targetAppId = process.argv[2];
const tmpDir = join(process.cwd(), '.tmp-gnome-circle-fetch');

if (!existsSync(tmpDir)) {
  mkdirSync(tmpDir, { recursive: true });
}

for (const [id, app] of Object.entries(catalog)) {
  if (targetAppId && targetAppId !== id) continue;
  if (!app.sourceImport) continue;

  console.log(`\n=== Processing ${app.name} (${id}) ===`);
  const cloneDir = join(tmpDir, id);
  
  if (existsSync(cloneDir)) {
    rmSync(cloneDir, { recursive: true, force: true });
  }

  try {
    console.log(`Cloning ${app.sourceImport.repository}...`);
    execSync(`git clone --depth 1 "${app.sourceImport.repository}" "${cloneDir}"`, { stdio: 'inherit' });

    const uiRoot = join(cloneDir, app.sourceImport.uiPath);
    const entry = app.sourceImport.entry;
    
    // Package source files
    console.log(`Packaging source bundle for ${id} (entry: ${entry})...`);
    execSync(`node scripts/source-package.mjs "${uiRoot}" "${entry}" "public/source-imports/${id}.source.json"`, { stdio: 'inherit' });

    // Generate mockup json preset
    console.log(`Generating public/presets/${id}.mockup.json...`);
    const sourcePkg = JSON.parse(readFileSync(`public/source-imports/${id}.source.json`, 'utf8'));
    const doc = blueprintBundleToDocument(sourcePkg.files, sourcePkg.entry, app.name);
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      document: doc,
      assets: {}
    };
    writeFileSync(`public/presets/${id}.mockup.json`, JSON.stringify(payload, null, 2));

    // Update catalog status
    app.status = 'preset';
    console.log(`Updated catalog status to 'preset' for ${id}`);
  } catch (err) {
    console.error(`Failed to process ${id}:`, err.message);
  } finally {
    if (existsSync(cloneDir)) {
      rmSync(cloneDir, { recursive: true, force: true });
    }
  }
}

// Write updated catalog back
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log('\nUpdated tests/fixtures/gnome-app-catalog.json');
