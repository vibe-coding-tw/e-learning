#!/bin/bash
set -e
EMULATOR_DATA=".emulator-data"
mkdir -p "$EMULATOR_DATA"
echo "Starting Firebase Emulators with import from $EMULATOR_DATA..."
npx firebase emulators:start --project e-learning-942f7 \
  --import "$EMULATOR_DATA" \
  --export-on-exit "$EMULATOR_DATA"
