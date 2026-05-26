#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JS_DIR="$ROOT_DIR/public/js"
HTML_FILE="$ROOT_DIR/public/dashboard.html"
SOURCE_JS="$JS_DIR/dashboard.js"

if [[ ! -f "$SOURCE_JS" ]]; then
  echo "Source file not found: $SOURCE_JS" >&2
  exit 1
fi

if [[ ! -f "$HTML_FILE" ]]; then
  echo "HTML file not found: $HTML_FILE" >&2
  exit 1
fi

HASH="$(shasum -a 256 "$SOURCE_JS" | awk '{print $1}' | cut -c1-12)"
TARGET_BASENAME="dashboard.${HASH}.js"
TARGET_JS="$JS_DIR/$TARGET_BASENAME"

cp "$SOURCE_JS" "$TARGET_JS"

# Remove older fingerprinted dashboard bundles except current one.
find "$JS_DIR" -maxdepth 1 -type f -name 'dashboard.[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f].js' \
  ! -name "$TARGET_BASENAME" -delete

# Update dashboard.html script reference:
# from /js/dashboard.js?v=...
# or   /js/dashboard.<oldhash>.js
# to   /js/dashboard.<hash>.js
perl -0777 -i -pe \
  "s#/js/dashboard(?:\\.[0-9a-f]{12})?\\.js(?:\\?[^\"']*)?#/js/${TARGET_BASENAME}#g" \
  "$HTML_FILE"

echo "Fingerprint updated: /js/${TARGET_BASENAME}"
