#!/bin/bash
set -e
EMULATOR_DATA=".emulator-data"
PROJECT_ID="${FIREBASE_EMULATOR_PROJECT:-e-learning-942f7}"
mkdir -p "$EMULATOR_DATA"
echo "Starting Firebase Emulators with import from $EMULATOR_DATA..."
npx firebase emulators:start --project "$PROJECT_ID" \
  --import "$EMULATOR_DATA" \
  --export-on-exit "$EMULATOR_DATA"
