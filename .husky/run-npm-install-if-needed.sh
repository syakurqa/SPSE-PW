#!/usr/bin/env sh
set -euo pipefail

# Determine the previous HEAD to compare against.
if ! git rev-parse --quiet --verify HEAD@{1} >/dev/null; then
  # Nothing to compare (e.g., first checkout); skip.
  exit 0
fi

changed_files="$(
  git diff --name-only HEAD@{1} HEAD -- \
    package-lock.json \
    package.json \
    'packages/*/package.json'
)"

if [ -n "$changed_files" ]; then
  echo "Detected dependency manifest changes:"
  echo "$changed_files"
  echo "Running npm install..."
  npm install
else
  echo "No dependency manifest changes detected; skipping npm install."
fi
