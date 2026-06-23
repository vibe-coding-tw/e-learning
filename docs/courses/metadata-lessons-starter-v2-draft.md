# metadata_lessons Starter v2 Draft
**Last updated**: 2026-06-14

這是一份第一筆新 starter 課程 document 的草稿。  
用途是把新課程先以 `hiddenFromCatalog = true` 的 pilot 方式建立，避免影響現有上課。

---

## 1. Draft Goal

這份草稿對應的第一個新 starter 課程，建議以：

- 主題：手機 BLE 遙控無人車
- 版本：v2
- 狀態：pilot / hidden

作為新課程的起點。

---

## 2. Suggested Firestore Document

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
    "car-starter-touch-vs-mouse.html",
    "car-starter-data-json.html",
    "car-starter-typed-arrays.html",
    "car-starter-ble-async.html",
    "car-starter-ble-security.html"
  ],
  "i18n": {
    "zh-TW": {
      "title": "手機 BLE 遙控無人車",
      "summary": "從手機操作與觸控模型開始，逐步完成資料封包、BLE 連線與安全上線。",
      "description": "這門課帶領學生把手機操作、控制資料、BLE 連線和安全部署串成一條完整主線。",
      "coreContent": "..."
    },
    "en": {
      "title": "Mobile BLE Remote Control for an Autonomous Car",
      "summary": "From mobile interaction and payload design to BLE connection and secure rollout.",
      "description": "This course guides students from touch-based control models to Web BLE connectivity and safe deployment.",
      "coreContent": "..."
    }
  },
  "tags": [
    "ble",
    "mobile-control",
    "remote-car",
    "starter"
  ],
  "prerequisites": [
    "Touch interaction basics",
    "Basic JSON payload understanding"
  ],
  "publishedAt": null,
  "pilotOnly": true
}
```

---

## 3. Field Notes

### Identity

- `id` 與 `docId` 先保持一致。
- 新版本請使用全新的 document，不要改舊 starter 文件。

### Visibility

- `hiddenFromCatalog` 必須先設為 `true`。
- `pilotOnly = true` 可明確標記這是內測版本。

### Course Units

- 先以目前最適合承接 BLE 主線的 starter 單元組成。
- 若後續要調整單元順序，可以在正式公開前再改。

### Content

- `i18n.zh-TW` 與 `i18n.en` 都先放完整骨架。
- `coreContent` 可以先留空白或放草稿內容，之後再補。

---

## 4. Recommended Next Steps

1. 先在 Firestore 建立這筆新 document。
2. 設定 `hiddenFromCatalog = true`。
3. 把 `course_units` 與 `i18n` 填完整。
4. 不要動舊 starter 文件。
5. 用 [Pilot Validation Checklist](./pilot-validation-checklist.md) 做驗證。
6. 驗證穩定後再公開。

---

## 5. Why This Draft Works

這個草稿的優點是：

- 不會干擾現有上課
- 新版本能先隱藏測試
- 主線已經清楚指向 BLE 遙控
- 單元順序仍保留可落地的漸進式流程
