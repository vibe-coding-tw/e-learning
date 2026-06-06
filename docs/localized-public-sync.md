# Localized Public Pages Sync

> Current: the localized student / tutor entry pages are served dynamically through `serveCourse` from the external `content-repo`. This repo does not keep local mirror files for those pages.

## Canonical Source

- `content-repo/public/en/`
- `content-repo/public/zh-TW/`

These files are the canonical editorial sources for the localized public pages. The public URLs `/en/students.html`, `/en/tutors.html`, `/tw/students.html`, and `/tw/tutors.html` are served from `content-repo` at request time and should not be redirected to `learning-path.html` or `index.html#core-values`.

## Runtime Delivery

- Hosting rewrites route the localized support URLs to `serveCourse`.
- `serveCourse` fetches the matching HTML from `content-repo/public/en/` or `content-repo/public/zh-TW/` based on locale.
- No local `public/en/` or `public/tw/` mirror directories are maintained in this repo.

## Historical Notes

- `public/en/`
- `public/tw/`

These directories previously existed as local mirror outputs. They are now removed.

## Historical Commands

```bash
node scripts/fingerprint-static-assets.js
```

The old local sync command is retired and no longer used by this repo.
