# Protota agent guide

## Product contract

Protota is a generic GTK4/Libadwaita mockup renderer. Implement rendering by
widget class, properties, slots, and layout semantics—not by preset ID, app
name, or screenshot-shaped per-app components. An unsupported GTK/Libadwaita
widget must be surfaced explicitly; do not silently substitute a generic box.

Presets are conformance inputs. The target is a reversible pipeline:

`Blueprint / GtkBuilder → MockupDocument → generic renderer → Blueprint`

## Verification

- `npm run build` checks TypeScript and the production bundle.
- `npm run test:unit` runs import/export and renderer conformance tests.
- `npm test` runs the Playwright application suite.
- The manual **Broadway Reference Capture** workflow runs a real native GNOME
  application via GTK Broadway and uploads it beside the matching Protota
  preset capture. Add apps through `tests/fixtures/gnome-app-catalog.json`;
  do not create a bespoke test harness per app.

The normal CI workflow runs the unit conformance suite before Playwright.
Visual captures are a regression oracle, not a substitute for correct generic
rendering semantics.

## Resource use

This checkout is on a lightweight VPS. Avoid local container builds, browser
downloads, and large dependency installs when possible. Use the `himachal`
SSH host for Broadway/container/Playwright-heavy work; it has the dedicated
clone at `/var/home/james/work/protota`. Keep local temporary worktrees and
generated reports cleaned up after use.

## Diagnosing a rendering failure

If a preset renders wrongly, **observe the DOM before theorising**. This
checkout cannot launch Chromium, but himachal can:

```sh
ssh himachal 'cd /var/home/james/work/protota && git fetch && git checkout <sha> \
  && npx playwright test tests/presets.spec.ts --reporter=line'
```

One observation beats several rounds of source-reading. A CI round trip costs
about five minutes; four consecutive wrong guesses about Software's blank
render (2026-07-31) cost far more than setting this up once would have.

Rendering defects chain, so fixing one only reveals the next: Software had a
window hidden by `visible=False`, then its whole tree inside an unmapped
`Adw.Leaflet` boundary, then `adw-view-stack` discarding non-page children.
Expect the second failure after fixing the first; it is not a sign the fix
was wrong.

When several presets pass and one fails, diff their shapes before reading
code — comparing root chains isolated the view-stack bug in a single query
after source-reading had failed repeatedly.

Custom elements are a recurring cause: `adw-view-stack` and
`adw-navigation-view` keep only their own page children and discard the rest.
Anything similar belongs in `DIV_TYPES`.

## Reading CI status

`gh pr checks` lists **skipped** jobs as though they were finished, so a PR
whose real test job has not started can look complete. Key the wait on the
run for a specific commit instead:

```sh
gh run list --branch <branch> --json headSha,status,conclusion \
  --jq '.[] | select((.headSha|startswith("<sha>")) and .status=="completed")'
```

Do not chain a push off a grep of test output: `npx vitest run | grep ... && git push`
runs on grep's exit status, not the suite's. Gate on the runner itself
(`if npx vitest run >/dev/null 2>&1; then ...`).

## Metrics that mislead

Boundary counts are unweighted, so they read as reassuring exactly when they
should not: Software measured "44 boundaries of 441 nodes, 10%" while
rendering as a single empty box, because one boundary sat near the root and
hid everything. Weight a boundary by the size of the subtree it hides.

Segment before concluding. Fleet-wide counts are dominated by out-of-scope
GNOME Circle presets, which come from a separate generator that never
canonicalises class names; core-app numbers are much better than the totals
suggest.

Verify a claim about the codebase by parsing it, never by a range-limited
grep. A "40 missing components" backlog reported on 2026-07-31 was an
artefact of grepping a truncated slice of `CLASS_TO_WIDGET_MAP`; the registry
already had all of them.

Measure before building. The C adapter (#78) was built on the premise that it
would resolve composites in four apps; one query afterwards showed zero of the
fleet's unresolved boundaries were template-backed C classes. The same query
would have been just as cheap beforehand.

## Pull requests and merges

1. Review the current PR head, mergeability, checks, and any prior review.
2. Do not bypass required checks by default.
3. If a maintainer explicitly authorizes a protected-branch merge and no
   merge queue exists, use the maintainer path:

   ```bash
   gh pr merge <number> --repo tuna-os/protota --admin --merge --delete-branch
   ```

4. If a queue is requested, first confirm it exists. GitHub's
   `enqueuePullRequest` API returns `No merge queue found for branch 'main'`
   when the repository has not enabled one; report that fact rather than
   claiming the PR was queued.

The #33 merge used this approved-maintainer fallback on 2026-07-29.
