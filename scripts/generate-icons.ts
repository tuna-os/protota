import { readFileSync, writeFileSync } from 'fs';

const md = readFileSync('/home/james/.pi/agent/skills/james/gnome-gui/reference/icons.md', 'utf-8');

interface IconCategory { label: string; icons: string[] }
const cats: IconCategory[] = [];
let currentCat = '';
let currentIcons: string[] = [];

const lines = md.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/^### /)) {
    if (currentCat && currentIcons.length) {
      cats.push({ label: currentCat, icons: [...new Set(currentIcons)] });
    }
    currentCat = line.replace(/^### /, '').trim();
    currentIcons = [];
  } else {
    const ms = line.matchAll(/`([a-z][a-z-]+-symbolic)`/g);
    for (const m of ms) currentIcons.push(m[1]);
  }
}
if (currentCat && currentIcons.length) {
  cats.push({ label: currentCat, icons: [...new Set(currentIcons)] });
}

const allIcons = [...new Set(cats.flatMap(c => c.icons))].sort();

const output = `// Auto-generated from gnome-gui-spec reference/icons.md — ${allIcons.length} Adwaita symbolic icons
export interface IconCategory {
  label: string;
  icons: string[];
}

export const ICON_CATEGORIES: IconCategory[] = ${JSON.stringify(cats, null, 2)};

export const ALL_ICONS: string[] = ${JSON.stringify(allIcons)};

export function iconClass(name: string): string {
  return \`adw-icon adw-icon--\${name.replace(/-symbolic$/, '')}\`;
}
`;

writeFileSync('src/data/icons.ts', output);
console.log(`Wrote ${allIcons.length} icons in ${cats.length} categories`);
