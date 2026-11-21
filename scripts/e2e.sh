#!/bin/bash
# The browser tests (tests/e2e/): the smoke suite and the accounts flow, in
# headless Chromium against the built app. Run by scripts/ci.sh; on its own:
#
#   python3 build.py && scripts/e2e.sh
#
# Playwright is the one dependency, and it is not part of the repository
# (the app has no package.json). Where it is installed already (a Claude
# cloud session, the Playwright container image) it is used as it is.
# Anywhere else (GitHub Actions, Bitbucket Pipelines) the pinned version is
# installed into a cache directory outside the repository, with Chromium and
# the system libraries it needs.
set -euo pipefail
cd "$(dirname "$0")/.."

PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION:-1.63.0}"

if ! node -e "require('playwright')" >/dev/null 2>&1; then
  tools="${E2E_TOOLS:-${HOME:-/tmp}/.cache/oakhum-e2e}"
  if [ ! -d "$tools/node_modules/playwright" ]; then
    echo "Installing playwright@$PLAYWRIGHT_VERSION into $tools"
    mkdir -p "$tools"
    npm install --prefix "$tools" --no-save --no-audit --no-fund --loglevel=error "playwright@$PLAYWRIGHT_VERSION"
  fi
  export NODE_PATH="$tools/node_modules${NODE_PATH:+:$NODE_PATH}"
  # --with-deps installs Chromium's system libraries with apt: as root in a
  # container, with sudo on a GitHub runner. A no-op when all is there.
  "$tools/node_modules/.bin/playwright" install --with-deps chromium
fi

[ -f index.html ] || python3 build.py

for t in tests/e2e/*.e2e.mjs; do
  echo "-- $t"
  node "$t"
done
