# GNOME app visual conformance

The machine-readable source of truth is
[`tests/fixtures/gnome-app-catalog.json`](../tests/fixtures/gnome-app-catalog.json).
An app is **passed** only after its isolated native Broadway image, isolated
Protota image, and generated diff have all been visually inspected. A passing
test alone is not enough.

| State | Apps |
| --- | --- |
| Passed | None yet |
| Needs tuning | Software (2026-07-31 Wave 2 probed pass, local rootless podman capture): 5.1% raw difference, 94.9% source-resolved similarity, probe match rate 90% (259 of 368 joins by buildable id). The honest state: the Protota overview renders the shell chrome plus the probe-revealed section headings; the native container (Fedora 43, session bus aliased as system bus) still populates GTK's bundled metainfo apps as tiles, and that store content is runtime package data the preset does not fake. Residual deltas: tile grid content, the headerbar Explore/Installed/Updates switcher, font rasterisation. Weather (2026-07-30 fidelity pass) — visually near-identical to native: real app artwork embedded from source, window controls, GTK size-request minimums; 4.5% difference with the remainder in font rasterisation and window shadow. Earlier note: Weather — paired capture vs native 49.x (Fedora 43 runner on himachal): 4.4% difference, 95.6% source-resolved similarity; gaps: app-resource status icon, window controls. Text Editor — 0.7% raw difference (whitespace-dominated; real gaps: tab-bar placement, MultiLayoutView default layout selection). Calendar — 35.2% difference; overlay stacking and month grid are runtime-drawn. Amberol — native/Protota surfaces inspected; StatusPage centering and action layout are being tuned generically. Calculator — source-bundle import structurally complete after the Phase 1 parser fix (`_buttons` and every declarative sibling retained; 2 honest boundaries: GtkSourceView, MathButtons). Local paired capture 2026-07-29: source-resolved similarity 79.9%, foreground IoU 24.4%, unresolved coverage 3.5%. Phase 4 (2026-07-30): MathButtons keypad now renders its 24-button basic panel from buttons-basic.blp via Vala construction facts; converter_box hidden via declared property default. Dominant remaining deltas: converter/status region visible because button-mode comes from GSettings at runtime (Phase 5 probe), StatusPage vertical footprint, header-bar icon-name rendering. |
| Not yet validated | Calendar, Clocks, Disks, Files, Settings, Software, Text Editor, Weather, Web |
| Next native capture | Authenticator (GNOME Circle) — Broadway image built on `himachal`; preset still to be created. |


## Fleet state (2026-07-30)

Generated presets, their screen counts, and how many nodes remain explicit
custom-widget boundaries. A boundary is an honest result -- an
application-defined composite the importer will not invent -- so the number
to drive down is the app-defined count, not boundaries in general.

| App | Screens | Nodes | Boundaries | Unresolved classes |
| --- | ---: | ---: | ---: | --- |
| text-editor | 2 | 93 | 1 | EditorFullscreenBox (C pass-through) |
| ear-tag | 1 | 90 | 13 | Eartag* composites (Python/GTK) |
| amberol | 1 | 74 | 10 | Amberol* composites (Rust) |
| calendar | 2 | 276 | 8 | Gcal* composites (C) |
| files | 4 | 184 | 2 | NautilusShortcutManager, NautilusSidebar (C; static chrome resolved) |
| calculator | 6 | 1939 | 5 | MathButtons instances (Vala; keypad renders) |
| software | 1 | 462 | 36 | Gs* pages (pass-through, probe-confirmed) + snapshot-drawn star/review primitives |
| disks | 3 | 65 | 2 | GduBenchmarkGraph, GduSpaceAllocationBar (C) |
| clocks | 5 | 380 | 0 | -- |
| graphs | 1 | 52 | 0 | -- |
| settings | 1 | 17 | 0 | -- |
| weather | 1 | 15 | 0 | -- |

Four apps import with no unresolved widgets at all. The largest remaining
category is C-defined composites: one C language adapter would cover
Nautilus, Calendar, Text Editor, and Disks together. The two stock-widget
renderer gaps this table originally recorded are closed: GtkLevelBar's meter
renders generically, and AdwTabBar was promoted to a registry widget (#59
Wave 1, 2026-07-31) — its tab strip derives from the linked AdwTabView's
declared pages, with runtime-populated views honestly empty until the #58
probe. Text Editor's and Files' rows above reflect the 2026-07-31
regenerations (Text Editor also dropped its non-visual `Gtk.SourceBuffer`
boundary node, which the importer now filters). The second Wave 1 PR
extended the C adapter generically: a code-defined subclass of a renderable
library widget resolves to its base class with its code-constructed
children, which resolved the eleven `EditorPreferences*` rows,
`NautilusLocationEntry`, and `NautilusPathBar`'s chrome, and gave
`NautilusSidebar` its scrolled `navigation-sidebar` list chrome. Row/button
content and GSettings-driven state remain #58 probe territory. The Wave 2
pass (2026-07-31) added Software with its committed probe dump: paintables
are filtered as non-visual, constructions read through `g_object_ref_sink`,
`can-unfold=False` leaflets import as navigation stacks, and the shell's
page state is carried by probe-evidenced finishing entries — 38 → 36
boundary nodes, with the star/review drawing primitives confirmed
`snapshot()`-permanent against pinned source.

## Required sequence

1. Add the app and its source/launch metadata to the catalogue.
2. Capture the real GTK app with Broadway on `himachal`.
3. Add a generic-widget-only preset.
4. Run the paired capture, inspect native, Protota, and diff images.
5. Set `visualStatus` to `passed` only when the inspection is acceptable and a
   calibrated difference threshold can be enforced.
