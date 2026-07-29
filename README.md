# Protota

GNOME HIG-compliant mockup tool for Adwaita app UIs.

Uses real [`@gjsify/adwaita-web`](https://github.com/gjsify/adwaita-web) web components so mockups look **and behave** like real Adwaita — not pixel replicas.

**Live:** https://tuna-os.github.io/protota/

## Development

```bash
npm install
npm run dev        # Vite dev server
npm run build      # Production build → dist/
npm run test:unit  # Blueprint/renderer conformance tests
npm test            # Playwright tests
```

## Rendering and conformance

Protota renders GTK4/Libadwaita from a typed widget tree. The renderer is
generic: presets must not add app-specific rendering branches. Blueprint and
GtkBuilder imports preserve supported tree structure and properties; unknown
visual widgets are reported so support can be added deliberately.

### Editing an app UI file

Import a work-in-progress `.blp` (Blueprint) or `.ui` (GtkBuilder) file using
**File → Import**. Protota turns it into an editable `MockupDocument`; after
editing, use **File → Export Blueprint** and replace the corresponding UI
file in your checkout before rebuilding the app. The browser deliberately
downloads the result rather than writing into a local source tree. Unsupported
GTK/Libadwaita widgets fail import explicitly, so the generated UI is never a
plausible-but-wrong substitute.

The `tests/fixtures/gnome-app-catalog.json` catalog connects a GNOME app,
its source, its preset, and a canonical viewport. The manual **Broadway
Reference Capture** GitHub workflow runs the native app under GTK Broadway
and uploads its capture alongside the matching Protota preset. This provides
an external visual oracle while the structural tests keep the renderer honest.
Each run also creates a pixel-diff image and JSON metric. It reports the
metric during baseline tuning; supplying a maximum difference ratio makes the
same comparison a CI gate for a calibrated preset.

List the currently runnable suite locally with `node scripts/broadway-app.mjs
--list`. Adding an app means adding its catalogue entry and preset together;
the conformance test rejects either an untracked preset or an incomplete
native-reference target. Core and Circle use the same catalogue fields and
renderer path.

See [GNOME app visual conformance](docs/gnome-app-conformance.md) for the
current validation state. "Passed" always means the paired screenshots and
their diff were visually reviewed, not merely that a capture command exited.
See [GNOME Core source-import loop](docs/gnome-source-import.md) for the
official-source UI inputs and explicit custom-widget boundaries.

## Pull requests

Required checks should be allowed to complete normally. If the repository has
no merge queue and a maintainer explicitly authorizes a protected-branch
merge, use the approved maintainer merge path. See [AGENTS.md](AGENTS.md) for
the exact procedure and resource-use guidance.
