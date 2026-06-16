# metadata_lessons Basic Template
**Last updated**: 2026-06-14

這份範本適用於 `basic` 課程線的新課程 document。

主題重點通常是：

- ESP32 開發環境
- 硬體腳位與 PWM
- 馬達驅動與控制迴圈
- Wi-Fi / BLE 控制與資料流

---

## 1. Suggested Shape

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
      "coreContent": "..."
    },
    "en": {
      "title": "Precision Motor Control with ESP32",
      "summary": "From hardware setup, PWM, and H-Bridge to a deployable motor control system.",
      "description": "This course guides students from ESP32 fundamentals to a precise and remotely controllable motor system.",
      "coreContent": "..."
    }
  }
}
```

---

## 2. Basic Rules

1. 先做輸出精度與控制迴圈。
2. 再做速度映射、狀態機與安全停機。
3. 最後才進入 Web / BLE 控制、通知與 OTA。
4. 新版本先隱藏，等 pilot 成熟後再公開。
5. 舊 basic 課程維持正常授課，避免中途換主題。

---

## 3. Recommended Basic Units

- `car-basic-platformio-setup.html`
- `car-basic-esp32-architecture.html`
- `car-basic-pinout.html`
- `car-basic-pwm-basics.html`
- `car-basic-ledc-syntax.html`
- `car-basic-h-bridge.html`
- `car-basic-joystick-mapping.html`
- `car-basic-unicycle-model.html`
- `car-basic-fsm.html`
- `car-basic-millis.html`
- `car-basic-ble-properties.html`
- `car-basic-gatt-structure.html`
- `car-basic-ble-async.html`
- `car-basic-ble-notify.html`
- `car-basic-ble-mtu.html`
- `car-basic-ota-principles.html`
- `car-basic-ota-security.html`

---

## 4. Basic Versioning Notes

- 若是教學主線升級成「精準馬達控制」，請開新 document。
- 若只是硬體參數或錯字修正，可小修舊文件。
- BLE 與 OTA 建議作為收尾段，不要放在最前面。
