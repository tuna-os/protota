#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blueprintBundleToDocument } from '../src/utils/blueprint.js';

const catalogPath = new URL('../tests/fixtures/gnome-app-catalog.json', import.meta.url);
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

// Additional GNOME Circle applications in the World namespace
const additionalCircleApps = [
  {
    id: 'shortwave',
    name: 'Shortwave',
    aptPackage: 'shortwave',
    command: 'shortwave',
    viewport: { width: 900, height: 650 },
    source: 'https://gitlab.gnome.org/World/Shortwave',
    sourceImport: {
      repository: 'https://gitlab.gnome.org/World/Shortwave.git',
      uiPath: 'ui',
      entry: 'window.ui',
    },
    suite: 'circle',
  },
  {
    id: 'fragments',
    name: 'Fragments',
    aptPackage: 'fragments',
    command: 'fragments',
    viewport: { width: 800, height: 600 },
    source: 'https://gitlab.gnome.org/World/Fragments',
    sourceImport: {
      repository: 'https://gitlab.gnome.org/World/Fragments.git',
      uiPath: 'data/ui',
      entry: 'window.ui',
    },
    suite: 'circle',
  },
  {
    id: 'secrets',
    name: 'Secrets',
    aptPackage: 'gnome-passwordsafe',
    command: 'secrets',
    viewport: { width: 900, height: 650 },
    source: 'https://gitlab.gnome.org/World/secrets',
    sourceImport: {
      repository: 'https://gitlab.gnome.org/World/secrets.git',
      uiPath: 'data/ui',
      entry: 'window.ui',
    },
    suite: 'circle',
  },
  {
    id: 'pika-backup',
    name: 'Pika Backup',
    aptPackage: 'pika-backup',
    command: 'pika-backup',
    viewport: { width: 900, height: 650 },
    source: 'https://gitlab.gnome.org/World/pika-backup',
    sourceImport: {
      repository: 'https://gitlab.gnome.org/World/pika-backup.git',
      uiPath: 'data/resources/ui',
      entry: 'window.ui',
    },
    suite: 'circle',
  },
  {
    id: 'warp',
    name: 'Warp',
    aptPackage: 'warp',
    command: 'warp',
    viewport: { width: 800, height: 600 },
    source: 'https://gitlab.gnome.org/World/warp',
    sourceImport: {
      repository: 'https://gitlab.gnome.org/World/warp.git',
      uiPath: 'data/resources/ui',
      entry: 'window.ui',
    },
    suite: 'circle',
  },
  {
    id: 'podcasts',
    name: 'Podcasts',
    aptPackage: 'gnome-podcasts',
    command: 'gnome-podcasts',
    viewport: { width: 900, height: 650 },
    source: 'https://gitlab.gnome.org/World/podcasts',
    sourceImport: {
      repository: 'https://gitlab.gnome.org/World/podcasts.git',
      uiPath: 'podcasts-gtk/resources/ui',
      entry: 'window.ui',
    },
    suite: 'circle',
  },
];

for (const app of additionalCircleApps) {
  if (!catalog[app.id]) {
    catalog[app.id] = {
      name: app.name,
      aptPackage: app.aptPackage,
      command: app.command,
      presetId: app.id,
      viewport: app.viewport,
      source: app.source,
      sourceImport: app.sourceImport,
      suite: app.suite,
      status: 'preset',
      visualStatus: 'not-validated',
    };
  }
}

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

    const uiRoot = join(cloneDir, app.sourceImport.uiPath);
    let entry = app.sourceImport.entry;

    // Auto-detect entry file if original path is non-standard
    if (!existsSync(join(uiRoot, entry))) {
      console.log(`Entry ${entry} not found in ${uiRoot}, scanning for root UI file...`);
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(uiRoot, { recursive: true }).filter(f => f.endsWith('.ui') || f.endsWith('.blp'));
      const candidate = files.find(f => /window\.(ui|blp)$/i.test(f) || /main\.(ui|blp)$/i.test(f)) || files[0];
      if (candidate) {
        entry = candidate;
        app.sourceImport.entry = entry;
        console.log(`Auto-selected entry: ${entry}`);
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
