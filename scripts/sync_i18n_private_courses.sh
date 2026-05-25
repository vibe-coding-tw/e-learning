#!/usr/bin/env bash
set -euo pipefail

# MVP: sync localized course html from external private content repo
#
# Expected content repo layout:
#   courses/zh-TW/*.html
#   courses/en/*.html
#
# Usage:
#   scripts/sync_i18n_private_courses.sh \
#     --source=/absolute/path/to/content-repo \
#     --locales=zh-TW,en \
#     --apply-delete
#
# Default behavior:
#   - sync/update source html files into functions/private_courses_i18n
#   - report stale local html files
#   - do not delete stale files unless --apply-delete is provided

SOURCE=""
LOCALES="zh-TW,en"
TARGET_ROOT="functions/private_courses_i18n"
DRY_RUN=0
APPLY_DELETE=0

for arg in "$@"; do
  case "$arg" in
    --source=*) SOURCE="${arg#*=}" ;;
    --locales=*) LOCALES="${arg#*=}" ;;
    --target=*) TARGET_ROOT="${arg#*=}" ;;
    --dry-run) DRY_RUN=1 ;;
    --apply-delete) APPLY_DELETE=1 ;;
    *)
      echo "Unknown arg: $arg"
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE" ]]; then
  echo "Missing --source"
  exit 1
fi

if [[ ! -d "$SOURCE/courses" ]]; then
  echo "Invalid source repo layout: $SOURCE/courses not found"
  exit 1
fi

mkdir -p "$TARGET_ROOT"
report="/tmp/i18n_sync_report_$(date +%Y%m%d_%H%M%S).csv"
echo "locale,file,status" > "$report"

IFS=',' read -r -a locale_arr <<< "$LOCALES"
for locale in "${locale_arr[@]}"; do
  src_dir="$SOURCE/courses/$locale"
  dst_dir="$TARGET_ROOT/$locale"
  mkdir -p "$dst_dir"

  if [[ ! -d "$src_dir" ]]; then
    echo "$locale,,missing_source_dir" >> "$report"
    continue
  fi

  declare -A source_files=()

  # Sync HTML only for MVP
  while IFS= read -r -d '' file; do
    base="$(basename "$file")"
    source_files["$base"]=1
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "$locale,$base,preview_sync" >> "$report"
    else
      cp "$file" "$dst_dir/$base"
      echo "$locale,$base,synced" >> "$report"
    fi
  done < <(find "$src_dir" -type f -name "*.html" -print0)

  while IFS= read -r -d '' existing; do
    base="$(basename "$existing")"
    if [[ -z "${source_files[$base]:-}" ]]; then
      if [[ "$APPLY_DELETE" -eq 1 && "$DRY_RUN" -eq 0 ]]; then
        rm -f "$existing"
        echo "$locale,$base,deleted_stale_local" >> "$report"
      else
        echo "$locale,$base,stale_local" >> "$report"
      fi
    fi
  done < <(find "$dst_dir" -type f -name "*.html" -print0)

  unset source_files
done

echo "[DONE] report=$report"
