#!/bin/bash
# Everything a pull request must pass, in one place, so GitHub Actions and
# Bitbucket Pipelines run exactly the same checks (and so can you: scripts/ci.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== App: unit tests"
node --test

echo "== App: build (also checks the bundle parses and has no duplicate top-level names)"
python3 build.py

echo "== Website: tests and build"
cd site
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm test
pnpm build
