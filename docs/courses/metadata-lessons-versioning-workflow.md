# metadata_lessons Versioning Workflow
**Last updated**: 2026-06-14

這份文件說明：當要新增一個新課程版本時，`metadata_lessons` 應該如何操作，才能**不影響現有上課**。

核心原則：

1. 舊課程文件不改成新課程。
2. 新課程一定開新 document。
3. 先隱藏測試，再公開。
4. 舊版只做停用，不做硬改。

---

## 1. Golden Rule

### Do

- 為新課程建立新的 Firestore document
- 使用新的 `docId` / document ID 作為 canonical identity
- 先將新版本設為 `hiddenFromCatalog = true`
- 完成 pilot 驗證後，再公開到前台

### Don't

- 不要直接覆寫舊課程的 `docId`
- 不要把舊課程的 `course_units` 改成新課綱
- 不要把舊 `i18n`、`level`、`category`、`orderWeight` 直接改成新主線內容
- 不要用同一筆 document 同時承載舊版與新版授課語意

---

## 2. Field-by-Field Policy

| 欄位 | 舊文件是否可改 | 新文件是否要填 | 建議做法 |
|---|---:|---:|---|
| `docId` / Document ID | 否 | 是 | 新課程一定用新 docId；舊文件不可改成新版本 |
| `id` | 否 | 是 | 視為 canonical identity 的一部分，和 document ID 保持一致 |
| `i18n` | 小修可改 | 是 | 新課程的主內容與多語資料應全部寫在新文件 |
| `level` | 原則上不改 | 是 | 新課程版本重新定義 level，避免混淆 |
| `category` | 原則上不改 | 是 | 新課程請使用對應分類，不沿用舊誤差 |
| `orderWeight` | 原則上不改 | 是 | 新課程版本重新定義排序，避免混淆 |
| `course_units` | 否 | 是 | 新課程的單元結構請在新文件中完整定義 |
| `metadataType` | 否 | 是 | 依實際課程型態建立正確類型，並作為 `isPhysical` 的主推導來源；新文件只用 `course` / `product` |
| `hiddenFromCatalog` | 可改 | 是 | 新課程先設 `true` 做內部測試 |
| `isDeprecated` | 可改 | 視需要 | 舊課程退場時才設為 `true` |
| `isPhysical` | 視情況 | 視情況 | 相容欄位；若保留，應與 `metadataType` 一致，不要手動填出衝突值 |
| `dealerPrice` / price book | 視情況 | 視情況 | 如果課程有售價，請獨立確認，不要和版本切換綁死 |

---

## 3. Recommended New-Version Workflow

### Step 1: Freeze the old course

- 保留既有文件內容不動
- 只修 bug、錯字、壞連結
- 不調整教學主線、不調整單元順序

### Step 2: Create a new document

- 複製舊文件的必要欄位
- 指定新的 `docId`
- 重新寫入新的 `i18n`、`course_units`、`category`、`orderWeight`、`level`

### Step 3: Hide the new version

- 設定 `hiddenFromCatalog = true`
- 僅供 admin、pilot 班級、內部 QA 使用

### Step 4: Pilot and validate

- 驗證前台顯示
- 驗證作業入口
- 驗證授權與價格
- 驗證課程 shell 與單元順序

### Step 5: Publish the new version

- 驗證穩定後，取消 `hiddenFromCatalog`
- 讓 catalog 正式出現新課程

### Step 6: Deprecate the old version

- 舊版本設定 `hiddenFromCatalog = true`
- 視需要加上 `isDeprecated = true`
- 保留歷史連結與資料一致性

---

## 4. Versioning Patterns

### Pattern A: Same course, minor correction

適用情境：
- 錯字修正
- 小段內容補強
- 連結修正

做法：
- 直接更新舊文件
- 不改 `docId`
- 不改主課綱

### Pattern B: Same theme, new curriculum line

適用情境：
- 課綱主線變了
- 單元順序變了
- 作業產物與授課目標大幅改寫

做法：
- 新建 document
- 用新 `docId`
- 舊版保留，避免打斷授課

### Pattern C: Pilot preview

適用情境：
- 內容還沒完全穩定
- 只想先讓少數老師或學生測試

做法：
- 新建 document
- `hiddenFromCatalog = true`
- 僅對內部使用

---

## 5. Safe Rollout Checklist

在新版本公開前，至少確認：

1. 新 `docId` 已建立且唯一。
2. 新文件的 `i18n` 完整。
3. 新文件的 `course_units` 正確。
4. 舊文件沒有被覆寫成新課程。
5. 新版本先隱藏，不會影響正式 catalog。
6. 作業入口與授權資料都能對上新版本。
7. 舊版本仍可正常上課與查歷史資料。
8. 需要停用舊版時，採 `hiddenFromCatalog` + `isDeprecated`，不要硬刪。

---

## 6. Practical Examples

### Example 1: Starter course redesign

- 舊 `metadata_lessons` 保留
- 新 starter 主線建立新 document
- 先隱藏，做 pilot 班試教
- 穩定後才正式公開

### Example 2: Basic course re-theme

- 舊 basic 課程若只是微調可直接修正
- 如果主題從一般硬體練習升級成「ESP32 精準馬達控制」，應建立新 document
- 兩版可並存一段時間

### Example 3: Advanced course Vision AI line

- 舊 advanced 課程維持原樣
- Vision AI 自動駕駛主線應建立新 document
- 先隱藏做 QA 與 pilot
- 成熟後再正式公開

---

## 7. Recommended Operating Sequence

如果要實際執行新課程上線，建議照這個順序：

1. 先建立新 `metadata_lessons` document
2. 完成新 `i18n`、`course_units`、`category`、`orderWeight`、`level`
3. 設定 `hiddenFromCatalog = true`
4. 讓 pilot 班級試用
5. 驗證沒有影響舊課程
6. 取消隱藏，正式公開
7. 舊版本再視情況停用

---

## 8. Related Docs

- [`docs/course-management-runbook.md`](../course-management-runbook.md)
- [`docs/legacy-and-backlog.md`](../legacy-and-backlog.md)
- [`docs/curriculum-migration-plan.md`](./curriculum-migration-plan.md)
- [`docs/courses/course-ui-runtime-spec.md`](./course-ui-runtime-spec.md)
