# Basic Lesson-Level Course Description
**Last updated**: 2026-06-14

這份說明稿對應 basic 線的新 lesson-level 規劃。  
主軸是把「ESP32 精準馬達控制」拆成 10 個逐步建立控制能力的 lesson。

---

## 1. Course Positioning

- 課程層級：`basic`
- 主題：ESP32 精準馬達控制
- 對象：已經有基礎硬體與程式觀念，想往控制系統前進的學員
- 目標：從 PWM、H-Bridge、狀態機一路走到 BLE 與 OTA

---

## 2. Learning Outcomes

完成後，學員應該能：

1. 建立 ESP32 開發環境與硬體地圖。
2. 掌握 PWM 與馬達輸出控制。
3. 理解輸入穩定性、取樣率與訊號品質。
4. 把搖桿輸入映射成車體運動。
5. 寫出可維運的控制主迴路。
6. 完成 Web / BLE 控制與 OTA 更新前置。

---

## 3. Lesson Map

| 課次 | lessonKey | 主題 | units |
|---|---|---|---|
| 01 | `dev-environment-hardware-map` | 開發環境與硬體地圖 | `platformio-setup`, `esp32-architecture`, `pinout` |
| 02 | `pwm-motor-output` | PWM 與馬達輸出 | `pwm-basics`, `ledc-syntax`, `h-bridge` |
| 03 | `signal-quality-input-stability` | 訊號品質與輸入穩定 | `pullup-debounce`, `adc-resolution`, `sampling-rate` |
| 04 | `motion-mapping` | 運動映射 | `joystick-mapping`, `unicycle-model`, `response-curves` |
| 05 | `control-logic-core` | 控制邏輯核心 | `fsm`, `millis`, `hardware-timer` |
| 06 | `state-and-messaging` | 狀態與訊息傳遞 | `state-consistency`, `http-request`, `http-lifecycle` |
| 07 | `web-control-stack` | Web 控制堆疊 | `fetch-api`, `async-webserver`, `cors-security` |
| 08 | `connectivity-modes` | 連線模式 | `wifi-ap-sta`, `ble-properties`, `gatt-structure` |
| 09 | `ble-transport` | BLE 傳輸 | `advertising-connection`, `ble-async`, `ble-notify` |
| 10 | `deployment-update` | 部署與更新 | `ble-mtu`, `ota-principles`, `ota-security` |

---

## 4. Writing Strategy

- 控制精度與安全性放在前半段。
- 連線與部署放在後半段。
- 每一段都能獨立做 pilot，不影響舊課程。
- BLE 與 OTA 是收尾，不是起點。

