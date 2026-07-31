# Permanent static-import boundaries per core app

Every preset in `public/presets/` with `"generatedBy": "scripts/generate-preset.mjs"`
is produced from pinned official GNOME source (see `sourceImport` in
[`tests/fixtures/gnome-app-catalog.json`](../tests/fixtures/gnome-app-catalog.json))
plus a reviewable hand-finishing file in `presets-src/`. Whatever the importer
cannot honestly resolve from that source is kept as an explicit
`custom-widget` boundary node — a labelled, allocated region, never a
plausible fake (`docs/source-widget-architecture.md`).

This document is the closed list of those boundaries: what each one is, why
it cannot be resolved statically, and whether the #58 native runtime probe
can settle it or it is **permanent** — unreachable by any static importer or
runtime introspection because the widget paints itself in code.

Scope: the twelve source-generated presets (nine `core`-suite apps —
Calculator, Calendar, Clocks, Disks, Files, Settings, Software, Text Editor,
Weather — plus the three Circle apps routed through the same importer:
Amberol, Ear Tag, Graphs). Web is catalogued as `core` but has no
`sourceImport` and no generated preset, so it is out of scope here.

## How the numbers are produced

The counts below are extracted mechanically from the shipped preset JSON, not
maintained by hand. Reproduce them with:

```sh
node -e "
const fs=require('fs');
const size=n=>{let c=1;for(const k of (n.children||[]))c+=size(k);return c;};
for(const f of fs.readdirSync('public/presets').filter(x=>x.endsWith('.mockup.json'))){
  const j=JSON.parse(fs.readFileSync('public/presets/'+f));
  if(j.generatedBy!=='scripts/generate-preset.mjs')continue;
  const rows=[];let total=0;
  const walk=n=>{if(!n||typeof n!=='object')return;total++;
    if(n.type==='custom-widget')rows.push({id:n.id,cls:n.sourceClass||'?',resolved:size(n)-1});
    (n.children||[]).forEach(walk);};
  for(const s of j.document.screens)walk(s.rootNode);
  console.log(f.replace('.mockup.json',''),'screens='+j.document.screens.length,'nodes='+total,'boundaries='+rows.length);
  rows.forEach(r=>console.log('  ',r.cls,r.id,'resolved-children='+r.resolved));
}"
```

Heed the recorded caution (AGENTS.md, "Metrics that mislead"): raw boundary
counts are unweighted. The `resolved-children` column shows how many imported
nodes live *under* a boundary and still render — a boundary with a large
resolved subtree is a pass-through container, while a leaf boundary
(`resolved-children=0`) is a genuinely unrendered region.

## Classification

- **permanent** — the widget draws itself via `snapshot()` / custom
  `GskRenderNode`s, or is not a widget at all (a paintable, a non-visual
  buffer, a shortcut controller). No static importer resolves it, and #58's
  probe cannot return a declarative child tree for it either. It stays a
  documented boundary forever; the paired-capture diff masks it.
- **probe (#58)** — a code-defined composite or runtime-populated model whose
  real widget tree *does* exist in the running app. The native runtime probe
  is the honest route to it (issue #58; reaffirmed in #81: "the only route to
  runtime-populated composites").
- **renderer gap** — a stock GTK/libadwaita widget the renderer does not draw
  yet. Statically fixable; listed so it is not mistaken for a permanent
  boundary (`docs/gnome-app-conformance.md`: "AdwTabBar's tab strip").
- **pass-through** — a boundary node whose imported children resolved and
  render; the wrapper itself contributes no pixels by default. Permanent as a
  node, visually harmless.

## Summary

| App | Suite | Nodes | Boundary nodes | Dominant cause | Probe-resolvable? |
| --- | --- | ---: | ---: | --- | --- |
| calculator | core | 1949 | 5 | Vala composite (`MathButtons`, keypad renders) + GSettings mode state | yes (mode/state); node stays as marker |
| calendar | core | 276 | 6 | `snapshot()`-drawn week grid; runtime month grid | partly — month grid yes, week grid permanent |
| clocks | core | 380 | 0 | — (runtime list content is default-empty) | n/a |
| disks | core | 69 | 2 | C custom-drawn graph/meter | no (benchmark graph permanent); allocation bar probe-verified |
| files | core | 178 | 5 | runtime C composites; `snapshot()`-drawn path bar | partly — sidebar/entry yes, path bar permanent |
| settings | core | 17 | 0 | panel list and panels are runtime C widgets (no nodes emitted) | yes — entirely probe territory |
| software | core | 441 | 38 | runtime-populated pages + drawn star/review primitives | mostly yes; paintables permanent |
| text-editor | core | 83 | 14 | C preference composites; non-visual `Gtk.SourceBuffer` | yes except buffer (non-visual, permanent) |
| weather | core | 15 | 0 | GJS runtime tree; default screen is the empty search view | n/a (residual delta is font rasterisation/window shadow) |
| amberol | circle | 74 | 6 | Rust composites (waveform, marquee, cover art) | probe determines; waveform likely permanent |
| ear-tag | circle | 90 | 12 | Python/GTK composites | yes |
| graphs | circle | 52 | 0 | — | n/a |

Totals: 88 boundary nodes across the twelve presets. Of these, 4 are
documented permanently `snapshot()`-drawn, 8 are permanent-but-harmless
(non-visual or pass-through), 2 are statically fixable renderer gaps
(`Adw.TabBar`), and the remaining 74 are #58 probe territory.

## Per-app boundary list

Reasons below come from the finishing files (`presets-src/*.finishing.json`),
import diagnostics, `docs/gnome-source-import.md`,
`docs/gnome-app-conformance.md`, `docs/custom-widget-handoff.md`, and the
maintainer's recorded assessments on #32/#81. Nothing here is inferred from
guesswork about upstream code.

### Calculator (`gnome-calculator` 49.2) — 5 boundary nodes

| Boundary | Instances | Why static import stops | Status |
| --- | ---: | --- | --- |
| `MathButtons` (`_buttons`) | 5 (one per mode screen) | Vala-implemented composite instantiated at runtime (`docs/custom-widget-handoff.md`). Since the Vala construction-facts pass, each instance renders its keypad panel from `buttons-*.blp` (350 resolved children per instance) — the node remains as an honest marker. | pass-through / probe confirms panel choice |

Runtime state recorded in `presets-src/calculator.finishing.json` (not nodes,
but the same boundary class): converter visibility, active-mode button label,
history-card allocation, and the currency spinner all depend on the GSettings
`button-mode` and runtime data. `docs/gnome-app-conformance.md` already
assigns this to the probe: "button-mode comes from GSettings at runtime
(Phase 5 probe)". **Probe-resolvable.**

### Calendar (`gnome-calendar` 49.1) — 6 boundary nodes

| Boundary | Instances | Why static import stops | Status |
| --- | ---: | --- | --- |
| `GcalWeekGrid` | 2 | Drawn with `snapshot()` — named by the maintainer as a permanent honest boundary (#32, #81, 2026-07-31). | **permanent** |
| `GcalWeekHourBar` | 2 | C-defined composite beside the week grid; no declarative template in the pinned bundle. | probe determines |
| `GcalDropOverlay` | 2 | C drag-and-drop overlay; its 135 imported children resolve and render, and the overlay itself contributes nothing until a drag. | pass-through |

Beyond the nodes: the **month grid** is runtime-populated
(`docs/gnome-app-conformance.md`: "35.2% difference; overlay stacking and
month grid are runtime-drawn"; #81 names "Calendar's month grid" as probe
territory). **Probe-resolvable**, unlike the week grid.

### Clocks (`gnome-clocks` 49.0) — 0 boundary nodes

All five screens import clean. List content (world clocks, alarms) is
runtime-populated and default-empty; the finishing file only pins the
default `AdwViewStack` pages against official screenshots.

### Disks (`gnome-disk-utility`, untagged pin) — 2 boundary nodes

| Boundary | Instances | Why static import stops | Status |
| --- | ---: | --- | --- |
| `GduBenchmarkGraph` | 1 | Drawn with `snapshot()` — named by the maintainer as a permanent honest boundary (#32, #81). | **permanent** |
| `GduSpaceAllocationBar` | 1 | C custom-drawn allocation meter; no declarative template. Expected permanent for the same reason as the graph; the probe run settles it definitively. | probe verifies (likely permanent) |

### Files (`nautilus` 49.1) — 5 boundary nodes

| Boundary | Instances | Why static import stops | Status |
| --- | ---: | --- | --- |
| `NautilusShortcutManager` | 1 | Non-visual near-root wrapper; its 51 imported children render. | pass-through (permanent as a node) |
| `NautilusSidebar` | 1 | Runtime C widget (`docs/gnome-source-import.md`: "directory list/grid and sidebar are runtime C widgets"; #81: probe is the route to the Nautilus sidebar). | **probe** |
| `NautilusPathBar` | 1 | Drawn with `snapshot()` — named by the maintainer as a permanent honest boundary (#32, #81). | **permanent** |
| `NautilusLocationEntry` | 1 | C composite, swapped with the path bar at runtime. | probe |
| `Adw.TabBar` | 1 | Stock widget the renderer does not draw yet (`docs/gnome-app-conformance.md`). | renderer gap (statically fixable) |

Beyond the nodes: the directory list/grid view is runtime-populated —
**probe-resolvable**.

### Settings (`gnome-control-center` 49.1) — 0 boundary nodes

The 17-node preset is the shell only. "Panel list and selected panel are
runtime C widgets" (`docs/gnome-source-import.md`) — they produce no
importable declarative tree at all, so no boundary nodes are emitted. The
entire panel surface is **probe-resolvable**; until #58 lands, this preset is
honestly a shell.

### Software (`gnome-software` 49.4) — 38 boundary nodes

| Boundary | Instances | Why static import stops | Status |
| --- | ---: | --- | --- |
| `GsOverviewPage`, `GsInstalledPage`, `GsSearchPage`, `GsUpdatesPage`, `GsCategoryPage`, `GsExtrasPage`, `GsDetailsPage`, `GsLoadingPage` | 8 | Runtime-populated pages ("overview tiles/carousel are runtime package data/widgets", `docs/gnome-source-import.md`; #81: "Software's lists"). Their declarative shells resolve — `details_page` alone carries 234 resolved children. | **probe** (pages are pass-through today) |
| `GsUpdatesPausedBanner` | 1 | Runtime banner, shown on network state. | probe |
| `GsDescriptionBox` | 2 | C composite for expandable description text. | probe |
| `GsStarImage` | 20 | C-drawn star primitive (rating display). | probe verifies (likely permanent drawing) |
| `GsReviewBar` | 5 | C-drawn review histogram bar. | probe verifies (likely permanent drawing) |
| `Adw.SpinnerPaintable` | 2 | A paintable, not a widget — there is no child tree to introspect at runtime either. | **permanent** (non-visual node) |

Software is also the recorded caution against trusting raw counts: it once
measured "44 boundaries of 441 nodes, 10%" while rendering as an empty box,
because `gs-shell.ui` declares the template `visible=False` (presented
programmatically) — fixed by the single finishing override in
`presets-src/software.finishing.json`.

### Text Editor (`gnome-text-editor` 49.1) — 14 boundary nodes

| Boundary | Instances | Why static import stops | Status |
| --- | ---: | --- | --- |
| `EditorFullscreenBox` | 1 | C wrapper; its 49 imported children render. | pass-through |
| `Adw.TabBar` | 1 | Renderer does not draw the tab strip yet; finishing pins its 34px runtime allocation. | renderer gap |
| `Gtk.SourceBuffer` | 1 | Non-visual buffer object, not a widget (filtered from export for the same reason, PR #104). Document text is runtime/user content. | **permanent** (non-visual) |
| `EditorPreferencesFont` / `EditorPreferencesSwitch` / `EditorPreferencesSpin` | 11 | C preference-row composites in the preferences dialog; no declarative templates. | probe |

### Weather (`gnome-weather` 49.0) — 0 boundary nodes

The default screen is the empty "search for a city" view, which is fully
declarative (15 nodes, 4.4–4.5% difference vs native). Two runtime facts are
carried by `presets-src/weather.finishing.json`: the template's parent class
is omitted by GJS composite templates (a future JS language adapter could
recover it statically), and `searchViewStatus.icon_name` is set at runtime
from `pkg.name`. Populated forecast views are runtime GJS content — **probe**
territory if ever presetted. The residual visual delta is font rasterisation
and window shadow, which no importer or probe addresses.

### Amberol (Circle, 2026.1) — 6 boundary nodes

`DragOverlay` (pass-through; 71 resolved children), `AmberolCoverPicture`
(runtime cover art), `AmberolWaveformView` (Rust-drawn waveform — probe
verifies, likely permanent drawing), `AmberolMarquee` x3 (Rust animated
label). All are Rust composites with no declarative templates; **probe
determines** each.

### Ear Tag (Circle, 1.0.2) — 12 boundary nodes

`EartagFileList`, `EartagPopoverButton`, `EartagTagEditableLabel` x2,
`EartagFileInfoLabel`, `EartagTagEntryRow` x7 — Python/GTK composites
(`docs/gnome-app-conformance.md`). Real widget trees exist at runtime:
**probe-resolvable**.

### Graphs (Circle, v2.0.5) — 0 boundary nodes

Imports clean at 52 nodes.

## Maintenance rule

This list is part of the fail-loudly contract that already governs finishing
files (`scripts/generate-preset.mjs` aborts when an override id no longer
matches the source):

**Regenerating a preset that changes its boundary set must update this
document in the same change.** Run the extraction command above after any
`generate-preset.mjs` run or catalog `sourceImport` bump; if the per-app
boundary nodes differ from the tables here, the regeneration PR updates both
together. A boundary that disappears because a widget became genuinely
resolvable is progress to record; a boundary that disappears silently is a
bug (`docs/source-widget-architecture.md`: renderer work may improve a
boundary, "they may not disappear").

When #58 lands, probe results move rows from "probe" to either resolved
(delete the row, regenerate) or confirmed-permanent (mark it here); the
"permanent" set is then closed and the pixel-accuracy goal of #32 is bounded
rather than open-ended.
