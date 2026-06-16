# metadata_lessons Basic v2 Draft
**Last updated**: 2026-06-14

這是一份第一筆新 basic 課程 document 的草稿。  
用途是把新課程先以 `hiddenFromCatalog = true` 的 pilot 方式建立，避免影響現有上課。

---

## 1. Draft Goal

這份草稿對應的第一個新 basic 課程，建議以：

- 主題：ESP32 精準馬達控制
- 版本：v2
- 狀態：pilot / hidden

作為新課程的起點。

---

## 2. Suggested Firestore Document

```json
{
  "id": "car-basic-motor-v2",
  "docId": "car-basic-motor-v2",
  "metadataType": "course",
  "level": "basic",
  "category": "car-basic",
  "orderWeight": 1,
  "hiddenFromCatalog": true,
  "isDeprecated": false,
  "pilotOnly": true,
  "course_units": [
    "car-basic-platformio-setup.html",
    "car-basic-esp32-architecture.html",
    "car-basic-pinout.html",
    "car-basic-pwm-basics.html",
    "car-basic-ledc-syntax.html",
    "car-basic-h-bridge.html",
    "car-basic-joystick-mapping.html",
    "car-basic-unicycle-model.html",
    "car-basic-fsm.html",
    "car-basic-millis.html",
    "car-basic-http-request.html",
    "car-basic-async-webserver.html",
    "car-basic-ble-properties.html",
    "car-basic-gatt-structure.html",
    "car-basic-ble-async.html",
    "car-basic-ble-notify.html",
    "car-basic-ble-mtu.html",
    "car-basic-ota-principles.html",
    "car-basic-ota-security.html"
  ],
  "i18n": {
    "zh-TW": {
      "title": "ESP32 精準馬達控制",
      "summary": "從硬體設定、PWM 與 H-Bridge 開始，逐步完成可部署的馬達控制主線。",
      "description": "這門課帶領學生從 ESP32 基礎出發，建立精準、穩定、可遠端控制的馬達系統。",
      "coreContent": ""
    },
    "en": {
      "title": "Precision Motor Control with ESP32",
      "summary": "From hardware setup, PWM, and H-Bridge to a deployable motor control system.",
      "description": "This course guides students from ESP32 fundamentals to a precise and remotely controllable motor system.",
      "coreContent": ""
    }
  },
  "tags": [
    "esp32",
    "motor-control",
    "pwm",
    "ble",
    "basic"
  ],
  "prerequisites": [
    "ESP32 development environment",
    "Basic C/C++ and wiring concepts"
  ],
  "publishedAt": null
}
```

---

## 3. Field Notes

- `hiddenFromCatalog` 必須先設為 `true`。
- `pilotOnly = true` 可明確標記這是內測版本。
- `course_units` 先依目前最適合的基礎控制順序排列。
- 如果後續要改成更強調 BLE 遠端控制，也可以在正式公開前再調整。

---

## 4. Recommended Next Steps

1. 先在 Firestore 建立這筆新 document。
2. 設定 `hiddenFromCatalog = true`。
3. 把 `course_units` 與 `i18n` 填完整。
4. 不要動舊 basic 文件。
5. 用 [`Pilot Validation Checklist`](./pilot-validation-checklist.md) 做驗證。
