# Protota, Libadwaita Prototype Tool — Document of Decisions

## Vision

**Protota** will be a browser-based mockup tool for **Libadwaita app UIs** based on GJSify library. A document holds multiple screens laid out side by side, with starting steps like these:
- Pick a page template (Single page? Page with sidebar? About modal?)
- Get a scaffolded screen
- Add Adwaita widget elements (buttons, texts, icons, custom Blueprint widget)
- Edit texts & elements easily with inline controls or from Properties sidebar
This uses real `@gjsify/adwaita-web` components to make prototypes look *and behave* like real Adwaita, instead of pixel replicas. The project document will use compressed file format, meanwhile the design output will be .blp/Blueprint files.

## Tech foundation

- **Vite Plus project**
- Pure browser webapp — no GJS, no Node runtime, no native bridges
- `@gjsify/adwaita-web` — 44 custom elements, real look + behavior, self-applies CSS on import
- `@gjsify/adwaita-core` — headless behavior (toast queue, combo/spin/toggle/expander state machines, breakpoints, color-scheme observable). Already composed into adwaita-web; import directly only when driving behavior from app code
- `@gjsify/adwaita-fonts` + `@gjsify/adwaita-icons` — transitive deps, no GJS
- Dependency chain is clean: every package declares `gjs: "none"`. Zero `gi://`/`@girs/*` in adwaita-web source.

## Navigating the gjsify codebase

The mockup tool lives outside this repo, but these are the source paths to
consult when building it. All paths relative to the repo root.

### Packages we'll depend on (`packages/web/`)

| Path | What's there |
|---|---|
| `packages/web/adwaita-web/src/index.ts` | Root entry — imports fonts, self-applies CSS, registers all 44 custom elements. Import this once. |
| `packages/web/adwaita-web/src/elements/adw-*.ts` | One file per custom element (44 files). Read these to learn each widget's properties, slots, events. |
| `packages/web/adwaita-web/scss/` | 50 SCSS partials (`_window.scss`, `_headerbar.scss`, `_switch_row.scss`…). Selectors target `adw-*` tag names directly. |
| `packages/web/adwaita-web/scss/adwaita-skin.scss` | Main SCSS entry — `@use`s all partials. |
| `packages/web/adwaita-web/style.css` export | Pre-compiled CSS at `@gjsify/adwaita-web/style.css` (for a `<link>`). |
| `packages/web/adwaita-core/src/` | Headless behavior: `breakpoint.ts`, `color-scheme.ts`, `toast.ts`, `dialog.ts`, `rows.ts`. Pure TS, no platform imports. |
| `packages/web/adwaita-fonts/` | `@font-face` CSS + TTF files. Auto-loaded by adwaita-web. |
| `packages/web/adwaita-icons/` | Adwaita symbolic icons as importable SVG strings + `toDataUri()` helper. |

### Storybook contract + logic (our property schema source) (`packages/framework/`)

| Path | What's there |
|---|---|
| `packages/framework/stories/src/types.ts` | **The schema contract.** `ControlType` enum (TEXT/NUMBER/BOOLEAN/SELECT/RANGE/COLOR), `StoryControl` discriminated union, `StoryMeta`, `StoryArgs`. This is what you reuse for D18. |
| `packages/framework/stories/src/args.ts` | `argsFromControls()` — seeds default values from a control list. |
| `packages/framework/storybook-core/src/controls.ts` | **`bindControl()`** — the form-renderer. Takes a `StoryControl` + a `ControlWidgetFactory` (the only renderer seam), owns all per-kind coercion (SELECT index↔value, RANGE rounding). This is the inspector's binding logic. |
| `packages/framework/storybook-core/src/story-view-base.ts` | `StoryViewBase<TNode>` — generic story view with `meta`/`args`/`updateArgs`/`onArgsChanged`. Pattern reference for model-view separation. |
| `packages/framework/storybook-core/src/registry.ts` | `StoryRegistry` — register/filter/instantiate, category grouping by `title.split('/')`. |
| `packages/framework/storybook-core/src/controller.ts` | `StorybookController` — app state machine: mount → select → wire controls → refresh. |

### Harvestable starter schemas (`showcases/gtk/adwaita-storybook/`)

The adwaita-storybook showcase has **35 `.meta.ts` files** already written for `adw-*` elements — use these as initial property schemas (D18):

```
showcases/gtk/adwaita-storybook/src/
  buttons/    *.meta.ts  (button-content, button-styles, split-button, toggle-group)
  feedback/   *.meta.ts  (about-dialog, alert-dialog, preferences-dialog, toast)
  layout/     *.meta.ts  (clamp, header-bar, toolbar-view, wrap-box)
  navigation/ *.meta.ts  (bottom-sheet, navigation-split-view, navigation-view, …)
  rows/       *.meta.ts  (action-row, combo-row, entry-row, spin-row, switch-row, …)
  view-switching/ *.meta.ts
  presentation/   *.meta.ts
```

Each `.meta.ts` exports a `StoryMeta` with `controls: StoryControl[]` — the
exact shape our properties panel needs. Pair with the browser renderer's `*.web.ts`
files (same directory, under `browser/`) to see how each control binds to a
real `adw-*` element.

### Browser storybook renderer (reference for adw-* usage)

```
showcases/gtk/adwaita-storybook/src/browser/
  main.ts          # app entry — registers adw-* elements, builds the storybook
  stories.ts       # imports all .web.ts story modules
  *.web.ts         # one per widget — builds real <adw-*> DOM from StoryMeta
```

These `.web.ts` files are the closest existing reference for "how do I
instantiate and bind an `adw-*` element from code" — exactly what the mockup
tool does when it renders a screen from the document model.

## Locked decisions

### 1. Parent layout

#### D10 — Collapsible drawer layout: Layers (left), Properties (right)
Two **collapsible drawers** flank a maximized canvas:
- **Left drawer** — Layers pane (D9, per-screen element tree). Collapsible.
- **Right drawer** — Properties panel (D6). Collapsible.
- **Center** — Canvas (D5, horizontal auto-flow grid of screens). Grows to fill
  when either drawer is collapsed.

#### D6 — Dedicated Properties panel (three-pane layout)
- Classic three-pane: **Layers (left) / Screens canvas area (center) / Properties (right)**.
- Selecting an element fills the properties panel with a form generated from that widget's property schema (text, toggle state, combo options, spin bounds, image src, …). 
- Adwaita widgets have real structured properties that don't fit a popover comfortably; dedicated properties panel would suit this.

#### D9 — Layers pane per screen (Figma-style)
- A **Layers pane** that lives in the left drawer (D10) shows the element tree of the currently-focused screen: nested containers + leaf widgets, selectable, reorderable, deletable/duplicable.
- This solves selecting deeply-nested elements that are hard to click directly on the canvas, and gives a second surface for the D8 reordering. 

The palette is placed via D11 (toolbar dropdown + inline "+").

#### D11 — Palette: top toolbar dropdown + inline "+" on containers
The context-sensitive element palette (D2) lives in **two places**:

- **Top toolbar** — holds global chrome (Add Screen, undo/redo, view mode,
  zoom) AND an **"Add element" dropdown** that is context-sensitive to the
  current selection (shows only legal add-actions for the selected container).
  It's a menu, not a fixed 44-widget grid — legal options per container are
  usually 3–6.
- **Inline "+" buttons** — selecting a container shows a small "+" at its
  bottom edge (or an empty-container placeholder "Drop widgets here"). Click
  "+" → context-sensitive menu pops up at the insertion point. The primary,
  Canva-like add gesture.

Left drawer stays pure Layers, right drawer stays pure Properties. No
tab-toggling between add and rearrange.

### 2. Canvas layout

#### D5 — Horizontal auto-flow grid (Canva-slides style)
Screens tile into a **horizontal** auto-flow grid. Position is computed, not free-placed. If two screens have different heights, both will be aligned from their top side. Each card has a label. Reordering is via a per-screen menu (Add Screen button + wizard for creation). No infinite free-drag canvas.

#### D16 — Viewport: zoom + pan, with Select/Hand tool modes
The canvas is a `transform: scale() translate()` container (zoom affects only
the screen grid, not the toolbar/drawers). Two **tool modes** (Figma-style,
toggled from the top toolbar):

- **Select mode (V)** — default. Click to select elements, inline-edit text,
  use the properties panel. Click+drag on empty canvas does nothing (or rubber-band
  select, deferred per D8 single-select MVP).
- **Hand mode (H)** — click+drag pans the canvas. Spacebar temporarily enters
  hand mode (hold space, drag, release) — the standard shortcut.

Zoom controls: fit-to-screen, zoom-to-100%, zoom-to-selection, plus Ctrl+scroll.
Pan: hand-tool drag or space+drag.

**Known quirk:** contenteditable caret positioning is quirky at non-100% zoom.
Mitigation: zoom to 100% when entering inline text edit, or accept the caret
quirk (Figma has it too).

### 3. Screen & Templates

#### D3 — "Screen" can be one of several top-level Adwaita surfaces

A screen is **not** always a window. Templates (chosen via Add Screen wizard):
- Window
- Dialog
- Preferences Dialog
- Alert Dialog
- Bottom Sheet
- Status Page
Each scaffolds a valid Adwaita top-level structure. The canvas card adapts its shape to the template (a dialog card renders as a dialog instead of window).

#### D4 — Flat now, flow later
Screens are independent in MVP, there are no typed edges between them (no navigation-push / dialog-open connectors). **But, the document model reserves an `edges: []` slot** from day one, so adding flow/connector rendering later is additive, not a migration.

#### D17 — Screen sizes: presets per template + user-resizeable + live breakpoints
Each screen template (D3) ships **named size presets** (e.g. Window:
{Mobile 360×640, Desktop 800×600, Large 1200×800}; Dialog: {Compact, Wide};
etc.). The user picks a preset when creating the screen via the Add Screen
wizard.

**After creation, the screen window is user-resizeable** — drag an edge/corner
handle to change its dimensions. Critically, the resize drives
**`@gjsify/adwaita-core`'s breakpoint state machine**: as the width crosses a
breakpoint condition (e.g. `max-width: 720px`), the screen's `AdwBreakpoint`
fires its `onApply`/`onUnapply` handlers, so the mockup **behaves like real
Adwaita responsive layout** — drag narrower and a split view collapses, drag
wider and it expands. This makes each screen a live Adwaita surface, not a
static frame.

Pairs breakpoint presets with the chosen size preset: a Mobile preset renders
in its narrow layout, a Desktop preset in its wide layout, and dragging
between them animates the transition through the breakpoint boundary.

### 4. Property schema from GJSify

#### D18 — Property schemas: reuse `@gjsify/stories`' `StoryControl`/`StoryMeta` contract
The per-widget property schema (D6 properties panel) reuses gjsify's existing
storybook contract rather than hand-rolling a new one:

- **`@gjsify/stories`** exports `StoryControl` (a discriminated union:
  TEXT/NUMBER/BOOLEAN/SELECT/RANGE/COLOR) and `StoryMeta` (title + description
  + `controls: StoryControl[]`). Battle-tested across 3 renderers (GTK,
  browser, NativeScript).
- **`@gjsify/storybook-core`**'s `bindControl(story, control, factory)` is the
  properties panel's form-renderer: takes a schema + a widget factory, owns all
  per-kind coercion (SELECT index↔value, RANGE rounding, type guards). The
  factory is the only seam — reuse it to build `adw-*` properties panel controls.
- **Starter schemas exist**: the `@gjsify/adwaita-storybook` showcase ships
  `.meta.ts` files per widget (e.g. `toggle-group.meta.ts`) already written for
  `adw-*` elements. Harvest them as initial schemas for the ~44 widgets.

**Extensions needed** (the contract's value type is `string|number|boolean|null`):

- Add an **IMAGE** control type for D14's image references (`imageId` → blob).
- Add a **LIST/STRUCT** control type for nested structures (e.g. a combo-row's
  options array of `{label,value}`, a toggle-group's segment list).

**Options considered (for the record):**

- (a) Hand-write a schema per widget — precise, full control, ~44 schemas to
  author, drifts if adwaita-web adds props.
- (b) Auto-derive from observed attributes/properties — zero authoring but
  produces noise (every internal prop, no labels, no grouping).
- (c) Decorator/annotation-driven on adwaita-web elements — pollutes a library
  we don't own; not appropriate downstream.
- **(d) Reuse `@gjsify/stories` contract ✅** — proven schema shape + control
  binding, harvestable starter metas, extend for IMAGE/LIST.

### 5. Interaction & Editing

#### D1 — Flow-layout wins, not freeform

- Adwaita is a flow-layout toolkit (flex/box, container nesting). This tool respects it: elements are added *into containers* and reordered within them, not free-placed.
- "Canva-like" describes the **editing experience** (pick template → drop in → edit inline → see all screens at once), not pixel placement.
- Freeform annotation/sticky-note layer (arrows, comments, loose images between screens) is a **phase-2 possibility**, not MVP.

#### D2 — Adwaita-legal nesting, palette-enforced

- The element palette is **context-sensitive**: selecting a container shows only the add-actions legal for that container (e.g. select `adw-preferences-group` → "add row" actions; select a window → "add group/split-view/status-page").
- Illegal drops are rejected. The element tree is always a valid Adwaita structure, mockups never depict layouts that can't ship. No "raw slot" escape hatch in MVP.

#### D7 — Inline text editing + properties panel
- Double-click a text-bearing element (window title, row title, button label, entry placeholder, status-page description…) → `contenteditable` → type → blur commits to model. 
- The properties panel shows the same field for structured editing. Both write to the same model field. ~10 of 44 widgets are text-bearing; commit pattern is shared.

#### D8 — Reorder: up/down buttons first, drag-to-reorder later (phased)
- Reordering an element within its container ships with **up/down buttons** (in the properties panel or floating toolbar) as the MVP. **Drag-to-reorder** is a phase-2 polish; which is natural and Canva-like but fiddly on flow-layout DOM (drop indicators, reparent-vs-reorder ambiguity, autoscroll). 
- The model is identical either way (array-index position in parent's `children`), so adding drag later is purely an interaction-layer enhancement.

### 6. Data & Persistence

#### D12 — Undo/redo: state snapshots (escalate to commands if needed)
Undo/redo uses **full document-model snapshots** (via Immer or `structuredClone`).
Every edit: mutate model → push previous state to undo stack. Undo = restore
previous snapshot. Redo = re-apply next snapshot.

- **Why snapshots over commands:** mockup documents are small (≈10–20 screens
  × ≈20–40 elements each); snapshot memory is negligible at that scale (tens of
  KB per step, a few MB for 50 steps). Implementation is dead simple — no
  command classes, no inverse logic, no patch debugging. Every edit type costs
  zero history-system work.
- **Escalation path (documented, not MVP):** if document sizes grow such that
  snapshot memory becomes a real cost, migrate to the **command pattern** (D12
  option a) — each edit a `{do(), undo()}` command object. The snapshot-based
  history is an internal implementation detail; swapping it for commands does
  not change any edit's public flow, so the migration is localized to the
  history module.
- Cap history at a reasonable depth (e.g. 50 steps) to bound memory.

#### D13 — Persistence: autosave to localStorage + explicit JSON export/import
Two persistence layers, complementary:

- **Autosave to `localStorage`** — every edit writes the document model to
  `localStorage` automatically. Reopen the tab → the mockup is there. Zero
  friction, no "save" concept. The session safety net: never lose work to a
  refresh or accidental close.
- **Explicit file export/import** — a "Save" action downloads a `.mockup.json`
  file (the serialized document model); "Open" imports it. Full portability,
  no size limit, works as backup/share/cross-device. The durable artifact.

The export format is the same JSON shape as undo/redo snapshots (D12), so
export is nearly free. localStorage caps at ~5MB — images as data URLs eat
this fast (see D14).

#### D14 — Images: IndexedDB blob store + reference IDs in the model
No generic image element exists in `adwaita-web` (only `adw-avatar` takes an
image). We build a **custom image element**. Storage:

- **Image blobs** live in **IndexedDB** (generous quota, hundreds of MB+) under
  a stable ID.
- The **document model** holds only an **`imageId` reference** per image element
  — never the bytes. Keeps the model lean, keeps undo/redo snapshots (D12) small
  (snapshots carry structure/text, not image bytes).
- **localStorage** (D13 autosave) stores the model (text/structure only) —
  never the blobs.
- **Export/import** must bundle blobs alongside the JSON. Format TBD at build
  time: either a `.zip` (`document.json` + `images/` folder) or a single JSON
  with base64-inlined images materialized only at export time.

## Deferred decisions (post-MVP, not grilled yet)

### 7. Export Targets

#### D19 — Export targets: Blueprint (.blp) + PNG
Two output serializers from the document model — one to structural codegen, one to image.

- **Export as `.blp` (GNOME Blueprint)** — document model → Blueprint markup.
  Nearly 1:1 mapping (`<adw-window>` → `Adw.ApplicationWindow`,
  `<adw-header-bar>` → `Adw.HeaderBar`, `<adw-switch-row>` → `Adw.SwitchRow`,
  …). Breakpoints (D17) map natively to `.blp`'s `Adw.Breakpoint` syntax.
  User gets `.blp` files for any GTK/Adw project. The simpler, well-bounded
target. gjsify supports `.blp` officially via `@gjsify/vite-plugin-blueprint`
  (compiles `.blp` → GTK XML string for `Gtk.Builder` at build time).
- **Export as PNG** — render each screen as a standalone PNG image. Mechanism
  TBD (canvas screenshot, headless render, or export-time render). Not yet
  decided.

Both serializers draw from the same document model. The document model's
element types should map cleanly to Adw class names so serialization is
straightforward. Open sub-decisions when these land: how to handle elements
with no Blueprint equivalent (custom image element from D14), and how to
serialize widget state (combo options, spin bounds) vs. just structure.

#### D20 — Export to GJSify project scaffold (deprioritized)
Builds on top of the .blp export (D19). Produces a full runnable project
scaffold: `package.json` (gjsify deps), `main.ts` (creates `Adw.Application`,
loads the `.blp` via the blueprint plugin, runs), the `.blp` files, `gjsify`
config. Mirrors gjsify's own `templates/` shape (`templates/adw-canvas2d/`,
etc.). User unzips → `gjsify install` → `gjsify run`.

D20 can be deprioritised until the .blp export is stable. Open sub-decisions:
whether the scaffold includes behavior stubs or is layout-only.

### 8. Preview Mode

#### D15 — Preview mode: deferred (interactive prototype when it lands)
Preview mode is **not MVP**. When it ships, it will be option (c) — an
**interactive prototype** mode: hide editor chrome, render screens clean, and
honor the deferred flow edges (D4's `edges: []`) so clicking a button that has
an "opens dialog X" edge actually navigates to / opens that screen.

Blocked on D4 (flow edges). Not a separate MVP decision — it's the phase-2
upgrade that D4's deferral pushed out. The model already reserves `edges: []`,
so preview mode is additive when both land together.

## What adwaita-web gives vs. what we build

| Gives us | We build |
|---|---|
| 44 widgets, real look + behavior | viewport (horizontal grid + zoom) |
| light/dark, fonts, icons, CSS | document model + serialization |
| toast/combo/spin/toggle/expander state machines | element palette (context-sensitive) |
| breakpoints + color-scheme observable | selection chrome |
| | property panel + per-widget schema |
| | inline-edit wiring |
| | undo/redo, persistence |
| | Add Screen wizard + templates |
