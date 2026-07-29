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
