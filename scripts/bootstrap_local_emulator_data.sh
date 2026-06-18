#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIREBASE_EMULATOR_PROJECT:-${FIREBASE_STAGING_PROJECT:-e-learning-942f7}}"
SOURCE_PROJECT="${FIREBASE_SYNC_SOURCE_PROJECT:-${FIREBASE_STAGING_PROJECT:-${FIREBASE_EMULATOR_PROJECT:-${PROJECT_ID}}}}"
export FIRESTORE_EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:18080}"
export FIREBASE_EMULATOR_PROJECT="${PROJECT_ID}"

node functions/scripts/sync_firestore_to_emulator.js \
  --apply \
  --replace \
  --source-project="${SOURCE_PROJECT}" \
  --target-project="${PROJECT_ID}" \
  --collections=all \
  "$@"
