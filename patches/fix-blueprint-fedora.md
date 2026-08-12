# blueprint-export container fix (fedora:45 -> fedora:42)

## Why

The `blueprint-export` job in `.github/workflows/deploy.yml` runs in
`registry.fedoraproject.org/fedora:45`. Fedora 45 does not exist as a
release in this timeline (latest is Fedora 42/43), so the container's
`dnf install` step always fails:

    Status code: 404 for https://mirrors.fedoraproject.org/metalink?repo=fedora-45&arch=x86_64

This blocks EVERY protota PR that is not markdown-only (check-changes gate),
including protota#206 whose Playwright suite is green.

## Fix (one line)

Apply `fix-blueprint-fedora.patch` — change the container tag to
`fedora:42`. The GitHub App cannot push `.github/workflows/*` files
(org-wide App `workflows` permission missing), so the change ships as a
patch for a maintainer to apply.

Apply: `git apply patches/fix-blueprint-fedora.patch`
