#!/usr/bin/env bash
set -euo pipefail

if [ -z "${FIREBASE_STAGING_PROJECT:-}" ]; then
  echo "Set FIREBASE_STAGING_PROJECT to your staging Firebase project id."
  exit 1
fi

firebase deploy --project "${FIREBASE_STAGING_PROJECT}"
