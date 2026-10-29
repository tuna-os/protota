# Protota agent guide

## Product contract

Protota is a prototyping tool for GTK4/Libadwaita built on top of gjsify. Implement mockup rendering by widget class, properties, slots, and layout semantics instead of preset ID, app name, or screenshot-shaped per-app components. An unsupported GTK/Libadwaita widget must be surfaced explicitly; do not silently substitute a generic box.

Presets are conformance inputs. The target is a reversible pipeline: `Blueprint / GtkBuilder → MockupDocument → generic renderer → Blueprint`

## Icons in toolbars

Icons live in `node_modules/@gjsify/adwaita-icons/` — one file per category (`actions.ts`, `devices.ts`, `places.ts`, `status.ts`, `ui.ts`).

```typescript
import { editUndoSymbolic } from '@gjsify/adwaita-icons/actions';
import { toDataUri } from '@gjsify/adwaita-icons/utils';
```

```tsx
<span
  className="adw-toolbar-icon"
  style={{
    maskImage: toDataUri(editUndoSymbolic),
    WebkitMaskImage: toDataUri(editUndoSymbolic),
  }}
/>
```

Never use `background-image` for symbolic icons, it breaks theming. For runtime icons (`icon-name` attributes), use `ensureAdwIcon()` from `src/utils/adwIcons.ts`.

## Verification

- `npm run build` checks TypeScript & prod bundle
- `npm run test:unit` runs import/export & renderer conformance tests
- `npm test` runs Playwright suite
- `npx tsc -b` typechecks `src/**` (including `src/__tests__`) but not `tests/**` specs, so neither `npm test` nor `npm run build` catches a type error in a spec
- `npm run lint` (oxlint) is a documented pre-push check, but no CI job runs it (#473)
- Manual **Broadway Reference Capture** workflow runs a real native GNOME app via GTK Broadway & uploads it beside matching Protota preset capture. Add apps through `tests/fixtures/gnome-app-catalog.json`; don't create a bespoke test harness per app.
- Broadway has failed every scheduled run since 2026-08-03 (#472); dispatch it manually instead of waiting on the weekly matrix.

The normal CI workflow runs the unit conformance suite before Playwright. Visual captures are a regression oracle, not a substitute for correct generic rendering semantics.

## Dependency bumps

- After a `@gjsify/*` bump, confirm the app boots before running the suite: `adwaita-web` lists `@gjsify/app-settings` as an optional peer, so a missing install yields no `adw-window` and every Playwright test fails (#455).
- A bump changes the DOM/CSS contract too (tag renames, window sizing via attributes, rules that moved upstream), so re-run one preset capture rather than trusting a green unit suite.

## Diagnosing a rendering failure

If a preset renders wrongly, **observe the DOM before theorising** with whatever browser tool is available: Chrome CDP, Playwright, or a preview pane.

One observation beats several rounds of source-reading. A CI round trip costs about five minutes; four consecutive wrong guesses about Software's blank render (2026-07-31) cost far more than setting this up once would have.

Rendering defects chain, so fixing one only reveals the next: Software had a window hidden by `visible=False`, then its whole tree inside an unmapped `Adw.Leaflet` boundary, then `adw-view-stack` discarding non-page children. Expect the second failure after fixing the first; it is not a sign the fix was wrong.

When several presets pass and one fails, diff their shapes before reading code — comparing root chains isolated the view-stack bug in a single query after source-reading had failed repeatedly.

Custom elements are a recurring cause: `adw-view-stack` and `adw-navigation-view` keep only their own page children and discard the rest. Anything similar belongs in `DIV_TYPES`.

## Playwright specs

- Changing a UI default (zoom/fit, drawer visibility, animation, focus) breaks the specs that encoded the old one — grep `tests/` and fix them all in the same commit, or they surface one per CI roundtrip.
- Assert on settled state only: poll until two consecutive reads agree, and take any "before" baseline after settling (PR #503); fixed `waitForTimeout` guesses fail under CI load.

## Reading CI status

`gh pr checks` lists **skipped** jobs as though they were finished, so a PR whose real test job has not started can look complete. Key the wait on the run for a specific commit instead:

```sh
gh run list --branch <branch> --json headSha,status,conclusion \
  --jq '.[] | select((.headSha|startswith("<sha>")) and .status=="completed")'
```

Do not chain a push off a grep of test output: `npx vitest run | grep ... && git push` runs on grep's exit status, not the suite's. Gate on the runner itself (`if npx vitest run >/dev/null 2>&1; then ...`).

## Metrics that mislead

Boundary counts are unweighted, so they read as reassuring exactly when they should not: Software measured "44 boundaries of 441 nodes, 10%" while rendering as a single empty box, because one boundary sat near the root and hid everything. Weight a boundary by the size of the subtree it hides.

Segment before concluding. Fleet-wide counts are dominated by out-of-scope GNOME Circle presets, which come from a separate generator that never canonicalises class names; core-app numbers are much better than the totals suggest.

Verify a claim about the codebase by parsing it, never by a range-limited grep. A "40 missing components" backlog reported on 2026-07-31 was an artefact of grepping a truncated slice of `CLASS_TO_WIDGET_MAP`; the registry already had all of them.

Measure before building. The C adapter (#78) was built on the premise that it would resolve composites in four apps; one query afterwards showed zero of the fleet's unresolved boundaries were template-backed C classes. The same query would have been just as cheap beforehand.

## Comments and commit messages

- Comment only what the code cannot say: a non-obvious constraint, a workaround, a rejected alternative; drop narration of what the next line already states.
- A commit body names what broke and why this fixes it, in a sentence or two; no walkthrough of the diff and no restating the subject.

## Pull requests and merges

1. Review the current PR head, mergeability, checks, and any prior review.
2. Do not bypass required checks by default.
3. If a maintainer explicitly authorizes a protected-branch merge and no merge queue exists, use maintainer path:

   ```bash
   gh pr merge <number> --repo tuna-os/protota --admin --merge --delete-branch
   ```

4. If a queue is requested, first confirm it exists. GitHub's `enqueuePullRequest` API returns `No merge queue found for branch 'main'` when the repository has not enabled one; report that fact rather than claiming PR was queued.

## Issues

- 56 of 57 open issues are agent-filed and the same finding is filed up to 13 times (#359/#360 filed 3s apart), so search open issues and close duplicates against the canonical one before filing.
