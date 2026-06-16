# Lesson-Level Curriculum Map
**Last updated**: 2026-06-14

這份文件把三條課程線拆成 lesson-level 規劃，沿用目前的管理節奏：

- `starter`：15 個 units -> 5 個 lessons
- `basic`：30 個 units -> 10 個 lessons
- `advanced`：50 個 units -> 15 個 lessons

原則上先維持 **3 個 units = 1 個 lesson** 的節奏。  
若某些內容量特別重，可以在正式執行時微調為 2 或 4 個 units，但那應該是例外，不是預設。

---

## 1. Starter Track: 5 Lessons

### Lesson 1: Mobile Control Foundation

- `car-starter-html5-basics.html`
- `car-starter-touch-vs-mouse.html`
- `car-starter-touch-basics.html`

Focus:
- 手機開發環境
- 輸入事件統一
- 觸控座標與控制意圖

### Lesson 2: Interaction Polish

- `car-starter-prevent-default.html`
- `car-starter-long-press.html`
- `car-starter-flexbox-layout.html`

Focus:
- 防止瀏覽器干擾
- 長按與持續控制
- 手機優先 UI 排版

### Lesson 3: Control UI & State

- `car-starter-ui-ux-standards.html`
- `car-starter-control-panel.html`
- `car-starter-canvas-joystick.html`

Focus:
- 拇指熱區與狀態文案
- BLE 控制面板
- 搖桿視覺與互動

### Lesson 4: Control Data Modeling

- `car-starter-joystick-math.html`
- `car-starter-flow-logic.html`
- `car-starter-data-json.html`

Focus:
- 搖桿數值轉換
- 控制節奏與 fail-safe
- JSON payload 設計

### Lesson 5: BLE Readiness

- `car-starter-typed-arrays.html`
- `car-starter-ble-async.html`
- `car-starter-ble-security.html`

Focus:
- binary packet
- BLE connection state machine
- security / permissions / compatibility

---

## 2. Basic Track: 10 Lessons

### Lesson 1: Dev Environment & Hardware Map

- `car-basic-platformio-setup.html`
- `car-basic-esp32-architecture.html`
- `car-basic-pinout.html`

Focus:
- 開發環境
- ESP32 架構
- 腳位與硬體規劃

### Lesson 2: PWM Motor Output

- `car-basic-pwm-basics.html`
- `car-basic-ledc-syntax.html`
- `car-basic-h-bridge.html`

Focus:
- PWM 控速
- LEDC API
- 正反轉與煞車

### Lesson 3: Signal Quality & Input Stability

- `car-basic-pullup-debounce.html`
- `car-basic-adc-resolution.html`
- `car-basic-sampling-rate.html`

Focus:
- 按鍵穩定
- 類比訊號精度
- 採樣頻率

### Lesson 4: Motion Mapping

- `car-basic-joystick-mapping.html`
- `car-basic-unicycle-model.html`
- `car-basic-response-curves.html`

Focus:
- 搖桿到馬達映射
- 差速模型
- 線性 / 非線性手感調整

### Lesson 5: Control Logic Core

- `car-basic-fsm.html`
- `car-basic-millis.html`
- `car-basic-hardware-timer.html`

Focus:
- 狀態機
- 非阻塞控制
- 固定節拍

### Lesson 6: State & Messaging

- `car-basic-state-consistency.html`
- `car-basic-http-request.html`
- `car-basic-http-lifecycle.html`

Focus:
- 命令一致性
- HTTP 命令傳輸
- 請求生命週期與延遲

### Lesson 7: Web Control Stack

- `car-basic-fetch-api.html`
- `car-basic-async-webserver.html`
- `car-basic-cors-security.html`

Focus:
- 前端送命令
- ESP32 非同步伺服器
- 跨域與安全

### Lesson 8: Connectivity Modes

- `car-basic-wifi-ap-sta.html`
- `car-basic-ble-properties.html`
- `car-basic-gatt-structure.html`

Focus:
- 配網與控制模式
- BLE read/write/notify
- GATT 服務設計

### Lesson 9: BLE Transport

- `car-basic-advertising-connection.html`
- `car-basic-ble-async.html`
- `car-basic-ble-notify.html`

Focus:
- BLE 廣播與配對
- BLE 連線流程
- 狀態與遙測回報

### Lesson 10: Deployment & Update

- `car-basic-ble-mtu.html`
- `car-basic-ota-principles.html`
- `car-basic-ota-security.html`

Focus:
- BLE 分段傳輸
- OTA 更新流程
- OTA 安全與版本控制

---

## 3. Advanced Track: 15 Lessons

### Lesson 1: Sensor & Stream Foundations

- `car-advanced-s3-interfaces.html`
- `car-advanced-image-dma.html`
- `car-advanced-jpeg-quality.html`
- `car-advanced-bandwidth-fps.html`

Focus:
- 取像 / 記憶體 / 頻寬 / FPS

### Lesson 2: Video Pipeline

- `car-advanced-mjpeg-stream.html`
- `car-advanced-video-streaming.html`
- `car-advanced-canvas-image.html`
- `car-advanced-color-spaces.html`

Focus:
- 串流格式
- 視覺 debug
- 顏色空間

### Lesson 3: Vision Preprocessing

- `car-advanced-hsv-math.html`
- `car-advanced-threshold-filter.html`
- `car-advanced-filter-algorithms.html`
- `car-advanced-feature-extraction.html`

Focus:
- 遮罩
- 門檻
- 濾波
- 特徵抽取

### Lesson 4: Tracking & Visualization

- `car-advanced-centroid-algorithm.html`
- `car-advanced-centroid-error.html`
- `car-advanced-look-ahead.html`
- `car-advanced-chart-canvas.html`

Focus:
- centroid
- error
- preview / look-ahead
- telemetry chart

### Lesson 5: AI Perception Entry

- `car-advanced-teachable-machine.html`
- `car-advanced-mobilenet-ssd.html`
- `car-advanced-cnn-audio.html`
- `car-advanced-webspeech-api.html`

Focus:
- gesture / object detection / audio / voice

### Lesson 6: Sensor Integration

- `car-advanced-sensor-principles.html`
- `car-advanced-i2c-spi.html`
- `car-advanced-hardware-interrupts.html`

Focus:
- 感測器整合
- 周邊通訊
- 低延遲事件

### Lesson 7: Event-Driven Data Flow

- `car-advanced-event-polling.html`
- `car-advanced-data-flow.html`
- `car-advanced-json-serialization.html`

Focus:
- event vs polling
- end-to-end data flow
- telemetry schema

### Lesson 8: Protocol & API Design

- `car-advanced-json-parsing.html`
- `car-advanced-json-rest.html`
- `car-advanced-api-design.html`

Focus:
- defensive parsing
- REST contract
- API abstraction

### Lesson 9: UI & Architecture

- `car-advanced-ui-framework.html`
- `car-advanced-refactoring.html`
- `car-advanced-system-perf.html`

Focus:
- UI componentization
- clean architecture
- performance profiling

### Lesson 10: Metrics & Communication

- `car-advanced-kpi-definition.html`
- `car-advanced-debugging-art.html`
- `car-advanced-technical-narrative.html`

Focus:
- KPI
- debugging
- storytelling

### Lesson 11: Error to Control

- `car-advanced-error-calculation.html`
- `car-advanced-p-control.html`
- `car-advanced-pwm-limits.html`

Focus:
- vision error
- P control
- output scaling

### Lesson 12: Kinematics & Closed Loop

- `car-advanced-speed-algorithms.html`
- `car-advanced-icc-geometry.html`
- `car-advanced-closed-loop.html`

Focus:
- speed estimation
- turning geometry
- closed-loop integration

### Lesson 13: PID Control

- `car-advanced-pid-math.html`
- `car-advanced-pid-control.html`
- `car-advanced-pid-simulation.html`

Focus:
- discrete PID
- tuning
- simulation

### Lesson 14: Robustness & Flow Control

- `car-advanced-robustness.html`
- `car-advanced-flow-control.html`
- `car-advanced-code-logic.html`

Focus:
- robustness
- throttling
- fail-safe logic

### Lesson 15: BLE Telemetry & Deployment

- `car-advanced-ble-mtu.html`
- `car-advanced-ble-notify.html`
- `car-advanced-ble-async.html`

Focus:
- segmented BLE telemetry
- push notifications
- async reconnection and deployment

---

## 4. How to Use This Map

這份 map 的用途是把課程管理單位固定在 lesson，而 unit 則作為 lesson 內部的教學步驟。

建議執行方式：

1. 先以 lesson 為單位規劃 `metadata_lessons`
2. 再在 lesson 內保留 3 個 units 的漸進節奏
3. 若某 lesson 太重，再在正式發布前微調成 2 + 4 或 4 + 2 的結構
4. 先 pilot 一個 track，再推到整條課綱

---

## 5. Related Docs

- [`docs/courses/README.md`](./README.md)
- [`docs/courses/curriculum-migration-plan.md`](./curriculum-migration-plan.md)
- [`docs/courses/metadata-lessons-new-course-template.md`](./metadata-lessons-new-course-template.md)
- [`docs/courses/pilot-validation-checklist.md`](./pilot-validation-checklist.md)

