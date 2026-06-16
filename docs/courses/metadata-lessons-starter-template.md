# metadata_lessons Starter Template
**Last updated**: 2026-06-14

這份範本適用於 `starter` 課程線的新課程 document。

主題重點通常是：

- 手機端操作
- 觸控與 UI 互動
- BLE 連線與安全
- 控制意圖與封包準備

---

## 1. Suggested Shape

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
      "summary": "從手機操作與觸控模型開始，逐步完成 BLE 連線與安全上線。",
      "description": "這門課帶領學生把手機操作、資料封包、BLE 連線和安全部署串成一條完整主線。",
      "coreContent": "..."
    },
    "en": {
      "title": "Mobile BLE Remote Control for an Autonomous Car",
      "summary": "From mobile interaction and payload design to BLE connection and secure rollout.",
      "description": "This course guides students from touch-based control models to Web BLE connectivity and safe deployment.",
      "coreContent": "..."
    }
  }
}
```

---

## 2. Starter Rules

1. 先把手機操作與控制意圖定義好。
2. 再把資料打包成 JSON 與 binary payload。
3. 最後才進入 BLE 連線與安全。
4. 所有新版本先 `hiddenFromCatalog = true`。
5. 舊 starter 課程只做必要修正，不直接改成新主線。

---

## 3. Recommended Starter Units

- `car-starter-html5-basics.html`
- `car-starter-touch-basics.html`
- `car-starter-touch-vs-mouse.html`
- `car-starter-data-json.html`
- `car-starter-typed-arrays.html`
- `car-starter-ble-async.html`
- `car-starter-ble-security.html`

---

## 4. Starter Versioning Notes

- 如果只是修字句，可以小修舊文件。
- 如果主題已變成「BLE 遙控無人車」，應開新 document。
- 新版本正式公開前一定要先 pilot。
