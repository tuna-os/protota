# GNOME Core source-import loop

Conformance input is the official application's UI source, not a hand-authored
mockup. A source-derived document can only be marked ready when its declared
templates resolve and every visual widget is either generically supported or
explicitly reported as a custom-widget boundary.

| App | Official entry UI | First generic support needed | Source-only boundary |
| --- | --- | --- | --- |
| Calculator | `src/ui/math-window.blp` | source-bundle template resolution, `GtkScrolledWindow`, text editor surface | `MathButtons` is Vala-constructed; display uses `GtkSourceView` |
| Calendar | `src/gui/gcal-window.blp` | template resolution, navigation/stack pages, scrollers | month grid is a custom C widget |
| Clocks | `data/ui/window.ui` | GtkBuilder template resolution, stack pages, scrollers | clock/alarm faces are custom widgets |
| Files | `src/resources/ui/nautilus-window.blp` | tab bar, action bar, stacks, overlays, scrollers | directory list/grid and sidebar are runtime C widgets |
| Settings | `shell/cc-window.blp` | navigation split/page, search bar, scroller | panel list and selected panel are runtime C widgets |
| Software | `src/gs-shell.ui`, `src/gs-overview-page.ui` | leaflet/page, search bar, stacks, scrollers | overview tiles/carousel are runtime package data/widgets |
| Text Editor | `src/editor-window.ui` | multi-layout view, stacks, revealers, image | editor panels and open/status controls are custom widgets |
| Weather | `data/window.ui`, `data/weather-widget.ui` | stacks, overlays, scrollers, list view | forecast widget is custom GJS/template content |
| Web | programmatic `src/ephy-window.c` | C/GObject construction extractor | main window is not declarative UI markup |
| Disks | `src/resources/ui/gdu-window.blp` | scrollers, stacks/pages, popovers | drive/detail rows are linked custom templates/widgets |

## Loop

1. Fetch the official source at its revision used for validation.
2. Resolve its declared `.blp`/`.ui` template bundle into a typed document.
3. Render only the supported declared structure; list unresolved custom widgets
   in the artifact metadata.
4. Compare the source-derived render with native Broadway output and record
   raw pixel delta plus foreground IoU.
5. Add a generic widget, slot, or layout rule only when the source input
   identifies it; rerun the same app and record the percentage change.

An app is not source-derived merely because a similar preset exists. The
existing JSON presets remain transitional and are not visual baselines for
this loop.
