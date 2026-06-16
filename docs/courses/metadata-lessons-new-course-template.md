# metadata_lessons New Course Template
**Last updated**: 2026-06-14

這份文件提供一個新的 `metadata_lessons` document 建立範本。  
用途是：**新課程直接開新 document，不動舊課程**。

---

## 1. Template Principles

1. 新課程請用新的 Firestore document ID。
2. `docId` / document ID 要視為 canonical identity。
3. 新版本先設為 `hiddenFromCatalog = true`。
4. 先完成 pilot，再正式公開。
5. 舊版本不要改成新課程。

---

## 2. Suggested Document Shape

以下是一個建議欄位骨架，可依實際課程調整。

```json
{
  "id": "car-starter-ble-v2",
  "docId": "car-starter-ble-v2",
  "metadataType": "course",
  "level": "starter",
  "category": "car-starter",
  "orderWeight": 1,
  "hiddenFromCatalog": true,
  "isDeprecated": false,
  "course_units": [
    "car-starter-html5-basics.html",
    "car-starter-touch-basics.html",
    "car-starter-data-json.html",
    "car-starter-typed-arrays.html",
    "car-starter-ble-async.html",
    "car-starter-ble-security.html"
  ],
  "i18n": {
    "zh-TW": {
      "title": "手機 BLE 遙控無人車",
      "summary": "從手機操作、封包格式到 BLE 連線與安全部署，循序漸進完成無人車遙控主線。",
      "description": "這門課將帶領學生從前端控制介面一路走到 Web BLE 連線與安全上線。",
      "coreContent": "..."
    },
    "en": {
      "title": "Mobile BLE Remote Control for an Autonomous Car",
      "summary": "Learn the full workflow from mobile interaction and payload design to BLE connection and secure deployment.",
      "description": "This course guides students from control UI fundamentals to Web BLE connectivity and safe rollout.",
      "coreContent": "..."
    }
  },
  "course_units": [
    "car-starter-html5-basics.html",
    "car-starter-touch-basics.html",
    "car-starter-data-json.html",
    "car-starter-typed-arrays.html",
    "car-starter-ble-async.html",
    "car-starter-ble-security.html"
  ]
}
```

---

## 3. Field Guidance

### Required fields

| 欄位 | 說明 |
|---|---|
| `id` | 課程 canonical id，建議與 document ID 一致 |
| `docId` | Firestore document ID，建立後不要再拿來改成別的課程 |
| `metadataType` | 一般課程用 `course` |
| `level` | 例如 `starter`、`basic`、`advanced` |
| `category` | 例如 `common`、`car-starter`、`car-basic`、`car-advanced` |
| `orderWeight` | 排序權重 |
| `course_units` | 課程單元 HTML 清單 |
| `i18n` | 多語內容主體 |

### Recommended fields

| 欄位 | 說明 |
|---|---|
| `hiddenFromCatalog` | 新版本先設 `true`，等 pilot 穩定再公開 |
| `isDeprecated` | 舊版本退場時才設 `true` |
| `course_units` 順序 | 依教學順序排列，不要只按檔名排序 |

### Optional fields

| 欄位 | 說明 |
|---|---|
| `tags` | 可加課程標籤，例如 `ble`、`motor-control`、`vision-ai` |
| `thumbnail` | 前台卡片縮圖 |
| `prerequisites` | 前置課程或能力 |
| `publishedAt` | 正式公開日期 |
| `pilotOnly` | 若要更明確標記內測版本可使用 |

---

## 4. Versioning Rules

### 新課程

- 一律建立新 document。
- `docId` 不要沿用舊課程。
- `course_units` 與 `i18n` 一起重新整理。

### 舊課程

- 保留原 document。
- 不要把舊課綱改成新課綱。
- 若要退場，改為 `hiddenFromCatalog = true`，必要時加 `isDeprecated = true`。

### 小修正

- 若只是錯字、短文案、連結修正，可直接修舊 document。
- 但只要涉及課綱主線、單元順序、教學主題變更，就應視為新版本。

---

## 5. Suggested Workflow

1. 先決定新課程的主題與課綱。
2. 以新的 `docId` 建立 document。
3. 寫入 `i18n` 與 `course_units`。
4. 先設 `hiddenFromCatalog = true`。
5. 用 pilot 班級或內部人員測試。
6. 驗證不影響舊課程。
7. 通過後再公開。
8. 舊版本最後才停用。

---

## 6. Example: Starter BLE v2

如果要做一份新的 starter BLE 課程，建議：

- `id` / `docId`: `car-starter-ble-v2`
- `level`: `starter`
- `category`: `car-starter`
- `orderWeight`: `1`
- `metadataType`: `course`
- `hiddenFromCatalog`: `true`

這樣可以保留舊版 starter 課程繼續授課，同時讓新版本先內測。

---

## 7. Sanity Checklist

建立新課程 document 前，請確認：

1. 舊 document 沒有被改寫。
2. 新 `docId` 是唯一的。
3. `i18n.zh-TW` 與 `i18n.en` 都已建立。
4. `course_units` 順序正確。
5. 新版本先 hidden。
6. pilot 測試不影響正式課程。
7. 要退場的只有舊版本，不是新版本。

---

## 8. Related Docs

- [`docs/metadata-lessons-versioning-workflow.md`](./metadata-lessons-versioning-workflow.md)
- [`docs/course-management-runbook.md`](../course-management-runbook.md)
- [`docs/curriculum-migration-plan.md`](./curriculum-migration-plan.md)
