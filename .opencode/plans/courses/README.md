# `.opencode/plans/courses/` — Snapshot Notice

**Added 2026-07-14.**

The 10 files in this directory are 2026-07-02 point-in-time copies of the corresponding
files under `docs/courses/`. They were originally written here as planning docs, then
also landed in `docs/courses/` as the maintained versions. **`docs/courses/` is the
canonical source** — treat everything in this directory as a historical snapshot, not a
live document.

Status as of 2026-07-14 (verified with `diff` against `docs/courses/`):

| File | vs. `docs/courses/` |
|---|---|
| `assignment-url-migration-plan.md` | byte-identical |
| `course-slug-alias-implementation.md` | byte-identical |
| `curriculum-migration-plan.md` | had 1 stale relative link, fixed 2026-07-14 |
| `lesson-level-metadata-lessons-import-guide.md` | byte-identical |
| `lesson-level-metadata-lessons-plan.md` | byte-identical |
| `metadata-lessons-advanced-v2-draft.md` | byte-identical |
| `metadata-lessons-basic-v2-draft.md` | byte-identical |
| `metadata-lessons-creation-checklist.md` | byte-identical |
| `metadata-lessons-starter-v2-draft.md` | byte-identical |
| `pilot-validation-checklist.md` | byte-identical |

**Why they weren't removed**: converting these to symlinks (or deleting them outright)
was the preferred fix, but the sandbox environment used to make this pass could create
new symlinks fine, yet could not `rm`/`unlink` any existing file on this mount (fails
with `EPERM` regardless of method — `rm`, Python `os.remove()`, `find -delete`, `unlink`
all fail the same way; only `mv`/rename succeeds). Removing or replacing the 10 files
here needs to be done from a normal shell on the actual machine, e.g.:

```bash
cd .opencode/plans/courses
for f in assignment-url-migration-plan.md course-slug-alias-implementation.md \
         curriculum-migration-plan.md lesson-level-metadata-lessons-import-guide.md \
         lesson-level-metadata-lessons-plan.md metadata-lessons-advanced-v2-draft.md \
         metadata-lessons-basic-v2-draft.md metadata-lessons-creation-checklist.md \
         metadata-lessons-starter-v2-draft.md pilot-validation-checklist.md; do
  rm "$f" && ln -s "../../../docs/courses/$f" "$f"
done
```

Until that's run, if you edit anything in `docs/courses/`, remember this directory will
not reflect the change — don't treat a match here as confirmation that `docs/courses/`
hasn't moved on.
