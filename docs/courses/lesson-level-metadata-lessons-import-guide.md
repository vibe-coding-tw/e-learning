# Lesson-Level `metadata_lessons` Import Guide
**Last updated**: 2026-06-14

這份文件說明如何把 lesson-level 的 seed JSON 批次寫入 Firestore，並保持現有上課流程不受影響。

---

## 1. Recommended Script

建議使用：

- [`functions/scripts/import_lesson_level_metadata_lessons.js`](../../functions/scripts/import_lesson_level_metadata_lessons.js)

它會讀取：

- [`lesson-level-metadata-lessons-starter-seed.json`](./lesson-level-metadata-lessons-starter-seed.json)
- [`lesson-level-metadata-lessons-basic-seed.json`](./lesson-level-metadata-lessons-basic-seed.json)
- [`lesson-level-metadata-lessons-advanced-seed.json`](./lesson-level-metadata-lessons-advanced-seed.json)

---

## 2. Import Rules

1. 每筆 lesson 都是獨立 document。
2. Canonical identity 只看 Firestore document ID。
3. 入口不再寫 `entryUnitId`，而是由 `course_units[0]` 推導。
4. `contentRef` 不作為新寫入欄位。
5. `track` 不再作為 canonical 寫入欄位。
6. 新 lesson 一律先 `hiddenFromCatalog = true`。
7. `pilotOnly = true` 建議一起保留。

---

## 3. Field Alignment

匯入腳本會把 seed JSON 整理成實際 runtime 需要的欄位：

- `id` / `docId`
- `metadataType`
- `level`
- `category`
- `orderWeight`
- `hiddenFromCatalog`
- `isDeprecated`
- `pilotOnly`
- `lessonIndex`
- `lessonKey`
- `orderWeight`
- `title`
- `summary`
- `description`
- `lessonLabel`
- `titleEn`
- `summaryEn`
- `descriptionEn`
- `lessonLabelEn`
- `coreContent`
- `coreContentEn`
- `i18n`
- `course_units`
- `courseUnits`
- `course_unit_titles`
- `courseUnitTitles`

如果 seed 內沒有 `course_unit_titles`，腳本會自動用 unit 檔名產生可讀的預設標題。

---

## 4. Run Examples

先試跑：

```bash
node functions/scripts/import_lesson_level_metadata_lessons.js --dry-run
```

正式寫入：

```bash
node functions/scripts/import_lesson_level_metadata_lessons.js --apply
```

只匯入 starter：

```bash
node functions/scripts/import_lesson_level_metadata_lessons.js --apply --files=docs/courses/lesson-level-metadata-lessons-starter-seed.json
```

若要做 local emulator preview，讓 catalog 在本機看得到這批 lesson cards，可以加上：

```bash
node functions/scripts/import_lesson_level_metadata_lessons.js --apply --catalog-visible
```

這個旗標只應用在 emulator / local preview，不建議用在正式上線資料。

---

## 5. Verification

匯入後請確認：

1. Firestore 的 document ID 正確。
2. `course_units[0]` 已是正確入口。
3. `hiddenFromCatalog` 與 `pilotOnly` 都維持啟用。
4. 前台學習路徑可以正常讀到 `i18n`.
5. 既有課程沒有被覆寫。
