/**
 * Runtime Adwaita icon registry.
 *
 * adwaita-web's stylesheet ships mask rules for only a few dozen common
 * symbolic icons; every other `icon-name` a real GNOME app uses would render
 * as a solid block (an `.adw-icon` mask with no mask-image). The full icon
 * theme is available as SVG strings in @gjsify/adwaita-icons, so missing
 * icons get their `.adw-icon--<name>` rule injected on first use, mirroring
 * the shipped rules exactly (currentColor mask).
 */
import * as icons from '@gjsify/adwaita-icons';
import { toDataUri } from '@gjsify/adwaita-icons/utils';

const catalog = new Map<string, string>();
for (const [exportName, svg] of Object.entries(icons)) {
  if (typeof svg !== 'string') continue;
  // editUndoSymbolic → edit-undo-symbolic; skip RTL variants.
  const kebab = exportName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  if (kebab.endsWith('-rtl')) continue;
  catalog.set(kebab.replace(/-symbolic$/, ''), svg);
}

const registered = new Set<string>();

/** Make `.adw-icon--<name>` renderable, injecting its mask rule if needed. */
export function ensureAdwIcon(iconName: string | undefined): void {
  if (!iconName || typeof document === 'undefined') return;
  const name = iconName.replace(/-symbolic$/, '');
  if (registered.has(name)) return;
  registered.add(name);
  const svg = catalog.get(name);
  if (!svg) return;
  let sheet = document.getElementById('protota-runtime-icons') as HTMLStyleElement | null;
  if (!sheet) {
    sheet = document.createElement('style');
    sheet.id = 'protota-runtime-icons';
    document.head.appendChild(sheet);
  }
  const uri = toDataUri(svg);
  sheet.textContent += `.adw-icon--${name} { mask-image: ${uri}; -webkit-mask-image: ${uri}; }\n`;
}
