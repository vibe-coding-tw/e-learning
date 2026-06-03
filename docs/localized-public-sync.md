# Localized Public Pages Sync

## Source of Truth

- `content-repo/public/en/`
- `content-repo/public/zh-TW/`

These files are the canonical editorial sources for the localized public pages.

## Deployment Outputs

- `public/en/`
- `public/tw/`

`public/en/` mirrors the English pages directly.
`public/tw/` mirrors the Traditional Chinese pages from `content-repo/public/zh-TW/`.

## Sync Commands

```bash
node scripts/sync_localized_public_pages.js
node scripts/fingerprint-static-assets.js
```

- `sync_localized_public_pages.js` copies the localized HTML files from `content-repo` into the deployable `public/` tree.
- `fingerprint-static-assets.js` runs the sync first, then fingerprints local public assets for deployment.

## Operating Rule

- Edit localized page content in `content-repo`.
- Sync into this repo before deploy.
- Do not hand-edit the mirrored `public/en/` or `public/tw/` pages unless you are intentionally patching the deploy output.
