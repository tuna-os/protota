#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const text = `Amberol
Apostrophe
Audio Sharing
Authenticator
Biblioteca
Binary
Blanket
Boatswain
Bobby
Bustle
Cartridges
Chess Clock
Citations
Clairvoyant
Collision
Commit
Constrict
Curtail
Déjà Dup Backups
Decoder
Dialect
Drum Machine
Ear Tag
Elastic
Emblem
Errands
Exercise Timer
Eyedropper
File Shredder
Forge Sparks
Fragments
Fretboard
Gaphor
Gradia
Graphs
Hieroglyphic
Identity
Impression
Iotas
Junction
Keypunch
Komikku
Lorem
Mahjongg
Mousai
Newsflash
Obfuscate
Paper Clip
Pika Backup
Podcasts
Polari
Railway
Resources
Secrets
Sessions
Share Preview
Shortwave
Solanum
Sudoku
Switcheroo
Tally
Tangram
Text Pieces
Tuba
Valuta
Video Trimmer
Warp
Webfont Bundler
Wike
Wordbook
Workbench`;

const catalogPath = new URL('../tests/fixtures/gnome-app-catalog.json', import.meta.url);
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const names = text.trim().split('\n');
console.log(`Enumerated ${names.length} official GNOME Circle apps.`);

for (const name of names) {
  const id = slugify(name);
  if (!catalog[id]) {
    catalog[id] = {
      name,
      aptPackage: id,
      command: id,
      presetId: id,
      viewport: { width: 900, height: 650 },
      source: `https://gitlab.gnome.org/World/${name.replace(/\s+/g, '')}`,
      sourceImport: {
        repository: `https://gitlab.gnome.org/World/${name.replace(/\s+/g, '')}.git`,
        uiPath: 'data/ui',
        entry: 'window.ui'
      },
      suite: 'circle',
      status: 'preset',
      visualStatus: 'not-validated'
    };
  }
}

writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Updated catalog total entries: ${Object.keys(catalog).length}`);
