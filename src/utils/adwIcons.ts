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

/** The shared stylesheet that carries runtime icon rules, created on first use. */
function runtimeSheet(): HTMLStyleElement {
  const existing = document.getElementById('protota-runtime-icons') as HTMLStyleElement | null;
  if (existing) return existing;
  const sheet = document.createElement('style');
  sheet.id = 'protota-runtime-icons';
  document.head.appendChild(sheet);
  return sheet;
}

/**
 * The CSS text for one icon's rule, or null when it needs none.
 *
 * Pure apart from the `registered` memo, so both entry points below emit
 * byte-identical rules — the batch path differs only in how often it writes.
 */
function ruleForIcon(name: string): string | null {
  if (registered.has(name)) return null;
  registered.add(name);
  // Application icon names are reverse-DNS ("org.gnome.Weather"); their dots
  // must be escaped or the selector reads as a chain of class names.
  // Two classes so the rule outranks element-scoped defaults such as
  // `adw-status-page .adw-status-page-icon { background-color: currentColor }`.
  const selector = `.adw-icon.adw-icon--${name.replace(/[.:]/g, '\\$&')}`;
  const svg = catalog.get(name);
  if (svg) {
    const uri = toDataUri(svg);
    // Symbolic icons are masks tinted with the current colour; full-colour
    // application artwork must be drawn as an image, not flattened to a mask.
    const isSymbolic = svg.includes('currentColor');
    return isSymbolic
      ? `${selector} { mask-image: ${uri}; -webkit-mask-image: ${uri}; }\n`
      : `${selector} { background-color: transparent; background-image: ${uri}; ` +
        `background-repeat: no-repeat; background-position: center; background-size: contain; ` +
        `mask-image: none; -webkit-mask-image: none; opacity: 1; }\n`;
  }
  return `${selector} { background-color: transparent; ` +
    `border: 1px dashed color-mix(in srgb, currentColor 35%, transparent); border-radius: 8px; ` +
    `opacity: 0.5; mask-image: none; -webkit-mask-image: none; }\n`;
}

/**
 * Register many icons in one stylesheet write.
 *
 * `ensureAdwIcon` appends with `textContent +=`, and every assignment makes the
 * engine re-parse the whole accumulated sheet: N icons cost O(N²) parsing. The
 * Icon Library renders the entire catalog at once (586 rules, ~340KB of CSS),
 * which blocked the main thread for ~16s — long enough that Playwright's click
 * timed out and the modal appeared "missing". Building the batch as one string
 * and assigning it once makes the same work ~12ms.
 *
 * Callers that render many icons should prefer this over a per-icon loop.
 */
export function ensureAdwIcons(iconNames: readonly (string | undefined)[]): void {
  if (typeof document === 'undefined') return;
  let batch = '';
  for (const iconName of iconNames) {
    if (!iconName) continue;
    const rule = ruleForIcon(iconName.replace(/-symbolic$/, ''));
    if (rule) batch += rule;
  }
  if (!batch) return;
  runtimeSheet().textContent += batch;
}

/**
 * Publish `--icon-<name>` custom properties for icons the stylesheet does not
 * ship, so plain CSS rules (window controls, decorations) can mask with them.
 */
export function publishIconVariables(names: string[]): void {
  if (typeof document === 'undefined') return;
  const declarations = names
    .map((name) => {
      const svg = catalog.get(name.replace(/-symbolic$/, ''));
      return svg ? `  --icon-${name.replace(/-symbolic$/, '')}: ${toDataUri(svg)};` : '';
    })
    .filter(Boolean)
    .join('\n');
  if (!declarations) return;
  const sheet = document.createElement('style');
  sheet.id = 'protota-icon-variables';
  sheet.textContent = `:root {\n${declarations}\n}\n`;
  document.head.appendChild(sheet);
}

/** Preset-embedded app artwork survives the reload the editor does on load. */
export const SOURCE_ICONS_STORAGE_KEY = 'protota_source_icons_v1';

/** Restore app artwork registered by a previously loaded preset. */
export function restoreStoredSourceIcons(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    registerSourceIcons(JSON.parse(localStorage.getItem(SOURCE_ICONS_STORAGE_KEY) || '{}'));
  } catch { /* a corrupt cache simply means placeholders */ }
}

/**
 * Register artwork an application ships in its own source tree (embedded in
 * a preset's `sourceIcons`). Registering before render means the app's real
 * icon is used instead of the unknown-icon placeholder.
 */
export function registerSourceIcons(icons: Record<string, string> | undefined): void {
  if (!icons) return;
  for (const [name, svg] of Object.entries(icons)) {
    const key = name.replace(/-symbolic$/, '');
    if (typeof svg !== 'string' || !svg.includes('<svg')) continue;
    catalog.set(key, svg);
    registered.delete(key);
  }
}

/** Whether the Adwaita symbolic set contains this icon. */
export function hasAdwIcon(iconName: string | undefined): boolean {
  return !!iconName && catalog.has(iconName.replace(/-symbolic$/, ''));
}

/**
 * Make `.adw-icon--<name>` renderable, injecting its mask rule if needed.
 *
 * An icon outside the symbolic set — an application's own artwork, such as
 * `org.gnome.Weather` — gets a neutral placeholder rule instead. Without it
 * the shipped `.adw-icon` styling (a mask with no mask-image) paints a solid
 * block, which is both ugly and a false claim about the app's artwork.
 */
export function ensureAdwIcon(iconName: string | undefined): void {
  if (!iconName || typeof document === 'undefined') return;
  const rule = ruleForIcon(iconName.replace(/-symbolic$/, ''));
  if (rule) runtimeSheet().textContent += rule;
}
