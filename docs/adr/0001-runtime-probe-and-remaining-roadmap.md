# ADR 0001: The native runtime probe is the next unblocking investment

- **Status:** accepted
- **Date:** 2026-07-31
- **Deciders:** maintainer (hanthor)
- **Informs:** #58, #55 (exit gate), #59, #81
- **Supersedes:** the per-issue orderings recorded in #81 comments

## Context

As of 2026-07-31 the architecture in `docs/source-widget-architecture.md` is
delivered through Phase 4, and most of Phase 2 and all of Phase 3 landed today:

| Track | State | Evidence |
| --- | --- | --- |
| Source-first import (Blueprint, GtkBuilder, Vala, C) | done | Phases 1/4, PR #92 |
| Export validity | done, CI-enforced | 28/28 screens compile; `blueprint-export` job (PR #104) |
| Host round trip | done | `protota-import` / `protota-writeback` (PR #111), byte-stable untouched files |
| Editor completeness | done | #79 closed across PRs #105/#110/#112/#114 |
| Diagnostics | done | 24 cited HIG rules + 4 Blueprint ids (PR #108) |
| Boundary geometry | static portion done | origin+confidence facts in DOM marker and comparison artifact (PR #113) |
| Boundary inventory | done | `docs/permanent-boundaries.md`: 88 boundary nodes, 74 in probe territory |

What did **not** move today, and cannot move statically, is runtime-driven
state. The Calculator ablation in PR #113 is the clean demonstration: with
layout-correct geometry the unresolved boundary still renders wrong because a
sibling's visibility is decided by GSettings at runtime. The same cause
accounts for the dominant residual deltas across the fleet (Settings panels,
Nautilus directory view, Calendar month grid, Software's runtime-populated
pages). Every remaining open issue reduces to this:

- **#55** cannot meet its exit criterion ("coverage describes the region GTK
  assigns") without native allocation evidence.
- **#59** cannot tighten per-app gates while runtime state is guessed.
- **#32/#6** were closed *conditionally on* #58 absorbing the runtime tail
  (74 of 88 boundary nodes are classified probe-territory).

**Decision: build the Phase 5 probe next, as specified below, before any
further breadth work.** Everything else in this document is sequenced after
it or explicitly independent of it.

## Part 1 — #58: the native runtime probe

### Decision

A read-only C shim, injected into the *unmodified* packaged GNOME app inside
the existing per-app Broadway container via `LD_PRELOAD`, that serializes the
live widget tree to JSON after the first stable mapped frame. No app
patching, no screenshots as input, no writes into the app process beyond the
probe's own output file.

### Mechanism

1. **Injection.** GTK4 removed `GTK_MODULES`, so the shim is a small shared
   library (`probe.so`, built with gcc + gtk4-devel in the existing Fedora
   runner image) loaded via `LD_PRELOAD` from `entrypoint.sh`. Its
   constructor spawns a plain pthread that polls (`g_usleep`) until
   `gdk_display_get_default()` is non-NULL, then schedules the probe onto the
   GTK main loop with `g_idle_add` — the only thread-safe handoff point; all
   widget access happens on the main thread.
2. **Stability criterion.** "First stable mapped frame" = a mapped toplevel
   exists AND its frame clock has ticked N (default 5) times with no
   allocation change on the toplevel. This mirrors the settle logic the
   Playwright capture already uses (`data-protota-ready`) so the screenshot
   and the probe dump describe the same frame.
3. **Walk.** From each `GtkWindow` in `gtk_window_get_toplevels()`, recurse
   `gtk_widget_get_first_child` / `gtk_widget_get_next_sibling`. Per widget,
   record exactly the issue's field list:
   - `gtype` (`G_OBJECT_TYPE_NAME`), `buildableId`
     (`gtk_buildable_get_buildable_id`), `indexPath` (sibling indices from
     the toplevel — stable structural address),
   - `mapped`, `visible`,
   - `bounds` via `gtk_widget_compute_bounds(widget, toplevel)`,
   - `halign`/`valign`, `hexpand`/`vexpand` **plus** `hexpand-set`/
     `vexpand-set` (set-state is what Phase 2 geometry needs),
   - margins, `width-request`/`height-request`,
   - `cssClasses` (`gtk_widget_get_css_classes`),
   - for `GtkStack`/`AdwViewStack`: `visible-child-name`.
4. **Output.** One JSON document to `$PROBE_OUTPUT` (bind-mounted path),
   `{ probeVersion, app, capturedAtFrame, widgets: [...] }`. The capture
   workflow copies it next to the existing `comparison-<app>.json`.
5. **Matching (host side, JS).** A new `scripts/match-runtime-profile.mjs`
   joins probe records to the source graph: **buildable ID first** (the
   issue's rule — template children carry their XML ids), then structural
   `indexPath` + gtype within an already-matched parent. Never by pixel
   position. Output: per-source-node runtime evidence merged into the
   comparison artifact under the `origin: "native:*"` /
   `confidence: "native"` tier — one rung above `declared` in the Phase 2
   scale, because it is GTK's own answer.

### Consumers (in order)

1. **#55 exit:** boundary nodes take their allocation from matched native
   bounds; rerun the Calculator ablation — the `BasicButtonPanel` sliver
   disappears because `converter_box`'s native `mapped:false` is now
   evidence, not a guess. Close #55 on that artifact.
2. **Finishing-file generation:** runtime visibility/active-state entries
   (converter_box, Calculator's GSettings mode, Settings' active panel)
   become *generated, audited* entries in `presets-src/<app>.finishing.json`
   with a `probeEvidence` field, replacing hand-written guesses. Stale
   probe-generated entries fail loudly exactly like manual ones do today.
3. **`docs/permanent-boundaries.md` reclassification:** each of the 74
   probe-territory nodes either gains native geometry (stays a boundary,
   now correctly allocated) or is demoted to "permanent" with the probe
   dump as the recorded reason. The "probe verifies (likely permanent)"
   hedges disappear.

### Risks and containment

- **LD_PRELOAD constructor timing** (GTK not initialized when the thread
  starts): contained by polling for the display rather than assuming init
  order; worst case the probe never fires and the capture proceeds
  probe-less — the capture pipeline must treat a missing probe file as
  "no evidence", never as failure.
- **Renderer differences under Broadway** (bounds in surface coordinates):
  acceptable — the comparison screenshots come from the same surface.
- **Apps without buildable ids on interesting widgets:** structural
  matching covers them; matcher reports match-rate per app so a weak match
  is visible in the artifact rather than silently wrong.
- **Distro build friction:** the shim builds in the same Fedora image that
  already installs `gtk4-devel-tools`; Ubuntu runner variant compiles it
  with `libgtk-4-dev`. One C file, no external deps beyond GTK itself.

### Exit condition (verbatim from the issue, now measurable)

Exact-ID boundaries such as `_buttons` carry auditable native allocation
evidence — concretely: the Calculator ablation artifact contains a
`native:*`-origin bounds fact for `_buttons`, matched by buildable ID.

## Part 2 — #59: catalog broadening, gated not aspirational

Phase 6 stays **after** the probe because promotion decisions need honest
per-app numbers. The plan makes broadening mechanical:

1. **Promotion policy.** A class is promoted from boundary to registry
   widget when (a) it appears in ≥2 catalogued apps or ≥3 times in one, and
   (b) its layout semantics are expressible statically (else it waits for
   probe evidence). Each promotion ships schema + legality + renderer +
   a unit test + a regenerated preset in one PR.
2. **Wave 1 (highest leverage, from `docs/permanent-boundaries.md`):**
   `AdwTabBar` (files, text-editor — already classified "statically
   fixable renderer gap"), the eleven `EditorPreferences*` rows
   (text-editor), `NautilusSidebar`/`NautilusLocationEntry` (files).
3. **Wave 2 (probe-informed):** Software's eight `Gs*Page` composites and
   star/review primitives; Ear Tag and Amberol composites — promoted only
   where probe evidence shows stable, modelable structure.
4. **Gates.** Per-app rows in `tests/fixtures/gnome-app-catalog.json` carry
   `maxUnresolvedCoverage` and `minSimilarity`; the Broadway workflow fails
   a PR that regresses a passed app. Gates tighten in the same PR that
   promotes a class — never speculatively.
5. **Cadence.** One app promoted to "passing" per wave-PR; an app passes
   only after native/Protota/diff visual inspection (existing rule).

## Part 3 — product tail (independent of the probe)

Ordered by leverage; none blocks the phase track:

1. **Write-back UX bridge.** `protota-writeback` exists but is
   terminal-only. Add an "Export → Patch into checkout…" flow that
   downloads the `.mockup.json` beside a generated one-line command, and
   (later) a File System Access API path for Chromium hosts. Explicitly out
   of scope: the browser writing into a checkout silently — the host action
   stays explicit (decided in #80).
2. **Blueprint LSP tier** (the #95 remainder): Pyodide-hosted
   blueprint-compiler for live diagnostics on the export preview. The
   diagnostics engine already reserves the `blueprint` source and BLP-E001
   surfaces compile errors at export; this upgrade makes them live. Do
   after Wave 1, sized ~1 week, no architectural risk (worker-isolated).
3. **Forest clipboard.** #112 deliberately kept copy/paste single-subtree;
   extend the clipboard to ordered forests once multi-select usage settles.
4. **Agent/plugin API live handle** (Penpot study §plugin-API): expose
   `selection`, `on('selectionchange'|'documentchange')`, and
   `transaction()` on `MockupBuilder`; `transaction()` doubles as the
   batched-undo primitive align/distribute already implements internally.
5. **Dependency hygiene.** Renovate stays; `@gjsify/adwaita-web` bumps are
   merged only with the full Playwright suite green **and** a paired-capture
   spot check on one app (the stylesheet is the render substrate, so CI
   text assertions alone under-test it). Recorded here as standing policy.

## Sequencing summary

```
#58 probe shim → matcher → capture integration      (unblocks everything)
  └─ #55 exit artifact → close #55
  └─ finishing-file generation → permanent-boundaries reclassification
#59 Wave 1 (static promotions, can start in parallel with probe)
#59 Wave 2 (probe-informed promotions)
Product tail items 1–5 interleaved as capacity allows
#81 closes when #58/#55/#59 close; #4 (Renovate dashboard) is permanent
```

## Consequences

- Runtime state stops being hand-finished guesswork; every visibility and
  allocation claim in a preset traces to source, code, or a native probe
  dump — completing the "prefer an external authority to our own
  agreement" principle that produced every fidelity gain so far.
- The probe adds a C artifact to a JS repo. Contained: one file, built and
  exercised only inside the existing capture containers, never shipped to
  the web app.
- Catalog growth becomes gate-driven; a regression in a passed app fails CI
  rather than surfacing in a quarterly audit.
