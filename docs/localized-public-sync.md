# Localized Public Pages Sync

> Deprecated: `public/en/` and `public/tw/` mirror outputs have been removed from this repo. This document is retained for historical reference only.

## Historical Source of Truth

- `content-repo/public/en/`
- `content-repo/public/zh-TW/`

These files are the canonical editorial sources for the localized public pages.

## Historical Deployment Outputs

- `public/en/`
- `public/tw/`

These mirrored directories used to be produced from `content-repo/public/en/` and `content-repo/public/zh-TW/`.

## Historical Sync Commands

```bash
node scripts/sync_localized_public_pages.js
node scripts/fingerprint-static-assets.js
```

These commands are kept for historical reference only. They no longer regenerate `public/en/` or `public/tw/` in this repo.
