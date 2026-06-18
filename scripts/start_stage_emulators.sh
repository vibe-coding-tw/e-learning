#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIREBASE_EMULATOR_PROJECT:-${FIREBASE_STAGING_PROJECT:-e-learning-942f7}}"

firebase emulators:start --project "${PROJECT_ID}" --only auth,functions,firestore,hosting
