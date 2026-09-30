# protota Roadmap

**Last updated**: 2026-09-30 | **Maintainer**: tuna-os (hanthor)

---

## Mission

Protota is a GNOME HIG-compliant mockup tool for Adwaita app UIs. It uses real
[`@gjsify/adwaita-web`](https://github.com/gjsify/gjsify/tree/main/packages/web/adwaita-web) web components so
mockups look *and behave* like real Adwaita — not pixel replicas. Live at
<https://tuna-os.github.io/protota/>.

---

## Current Status (September 2026)

Development is fast. 45 pull requests merged in the last 30 days. The deploy
pipeline is green on every recent push to `main`.

The repository has no tags and no GitHub Releases. `package.json` declares
version `0.0.0` and `"private": true`. Protota ships as a deployed web page, not
as a package, so the deploy pipeline is the release. This roadmap states that
choice, because it makes a version number meaningless here and the earlier
roadmap did not say so.

18 issues are open. 9 of them are workflow-permissions reports, and 6 describe
the same `ste.yml` gap (#321, #324, #348, #352, #353, #354). Read those as one
item, not six.

### Priorities

| Priority | Item | Tracking | Status |
|----------|------|----------|--------|
| P0 | Broadway Reference Capture red since 2026-07-29 — 21 failed runs, now 8 of 11 apps | #255 | 🔴 Open |
| P1 | Workflow lint blocks every `ubuntu-26.04` runner bump; PR #329 parked 12 days | #355 | 🔴 Open |
| P1 | `ste.yml` has no top-level `permissions:` block — 6 duplicate reports, 1 fix | #348 | 🔴 Open |
| P2 | Unpinned action versions in workflows | #341 | 🟡 Open |
| P2 | STE prose budget: 1911 findings, ratchet only goes down | #314 | 🟡 Open |

#### On the Broadway reference gate (#255)

This is the oldest open item and the failure has grown. The issue was filed
against 2 failing apps. Run 36406797064 (09-28) fails 8 of 11:
`software`, `disks`, `settings`, `calculator`, `weather`, `web`, `text-editor`
and `calendar`. Only `files`, `clocks` and `amberol` pass.

The workflow has never been green. All 21 completed runs since 2026-07-29 are
`failure`; the other 10 were cancelled. A gate that has never passed cannot
detect a regression, so the visual oracle it is supposed to provide does not
exist yet. Decide whether to fix the container or mark the failing apps
advisory — a permanently red weekly run trains everyone to ignore it.

---

## Quarterly Goals

### Current Quarter (2026 Q3) — "Expand"

**Theme**: Stable, HIG-faithful mockup authoring.

| Goal | Owner | Tracking | Status |
|------|-------|----------|--------|
| Green E2E suite (no flaky tests) | protota | #156, #165 | ✅ Done |
| Complete community health files | guide / protota | #173 | ✅ Done |
| Adwaita component conformance pass | protota | #159, #160 | ✅ Done |
| Adopt TunaOS project CI baseline | protota | #184 | ✅ Done — closed 09-02 |
| Broadway reference capture green | protota | #255 | ❌ Not met — carries to Q4 |

### Next Quarter (2026 Q4) — "Mature"

| Goal | Tracking | Status |
|------|----------|--------|
| A CI signal that can go green — fix or descope #255 | #255 | 🔴 Open |
| Unblock the runner-label gate, and decide the actionlint pinning policy | #355 | 🔴 Open |
| Close the workflow-permissions item once, and stop the duplicate reports | #348 | 🔴 Open |
| Finish the module split in `blueprint.ts` and `mockupStore.ts` | #343, #284 | 🟡 In progress |
| Evaluate gtk-office-suite / suite-common as the shared Adwaita design surface | — | ⚪ Not started |

---

## Technical Debt Backlog

Two large modules are being split, and the work is partly done.

| Module | Lines | Tracking | State |
|--------|-------|----------|-------|
| `src/utils/blueprint.ts` | 1815 | #343, #285 | Enrichment engine extracted to `blueprintEnrichment.ts` (316 lines) in #345. Blueprint export, Blueprint parsing, GtkBuilder XML parsing and template resolution still share one module. |
| `src/store/mockupStore.ts` | 1103 | #284 | Persistence extracted to `persistence.ts` (86 lines). Diagnostics, history, clipboard and document mutation still share the store. |

`agent-api.ts` was split in #347: the store-free builder moved to
`src/utils/mockupBuilder.ts` and the live handle to
`src/runtime/agentHandle.ts`. That item is done.

The duplicate-report load is itself debt. Six issues describe one `ste.yml`
change. Closing the real one and the duplicates together is worth more than the
change is, because the backlog is what a new contributor reads first.

---

## How to Contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) and `AGENTS.md` for dev setup
(`npm install && npm run dev`). Pick an issue from the priorities above or
comment on a goal you would like to own.

---

## Roadmap Governance

Updates are published after major milestones or quarterly. Propose changes via
PR to this file with an issue reference. State what was measured and when, so a
later reader can tell a current row from a stale one.

---
*Updated 2026-09-30. Trackers verified against live GitHub state on that date.*
