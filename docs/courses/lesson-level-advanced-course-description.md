# Advanced Lesson-Level Course Description
**Last updated**: 2026-06-14

這份說明稿對應 advanced 線的新 lesson-level 規劃。  
主軸是把「Vision AI 自動駕駛無人車」拆成 15 個可以逐段建立能力的 lesson。

---

## 1. Course Positioning

- 課程層級：`advanced`
- 主題：Vision AI 自動駕駛無人車
- 對象：已具備影像、控制與系統整合基礎的學員
- 目標：從影像串流、前處理、感知、控制到部署，完成完整自駕工程線

---

## 2. Learning Outcomes

完成後，學員應該能：

1. 建立影像與感測資料的串流前置。
2. 完成視覺前處理與特徵抽取。
3. 觀察追蹤誤差並視覺化控制資料。
4. 將 AI 感知與傳統控制系統整合。
5. 建立閉環、PID、穩健性與部署策略。
6. 讓系統具備可觀測、可除錯、可交付的能力。

---

## 3. Lesson Map

| 課次 | lessonKey | 主題 | units |
|---|---|---|---|
| 01 | `sensor-stream-foundations` | 感測串流基礎 | `s3-interfaces`, `image-dma`, `jpeg-quality`, `bandwidth-fps` |
| 02 | `video-pipeline` | 影像管線 | `mjpeg-stream`, `video-streaming`, `canvas-image`, `color-spaces` |
| 03 | `vision-preprocessing` | 視覺前處理 | `hsv-math`, `threshold-filter`, `filter-algorithms`, `feature-extraction` |
| 04 | `tracking-visualization` | 追蹤與視覺化 | `centroid-algorithm`, `centroid-error`, `look-ahead`, `chart-canvas` |
| 05 | `ai-perception-entry` | AI 感知入門 | `teachable-machine`, `mobilenet-ssd`, `cnn-audio`, `webspeech-api` |
| 06 | `sensor-integration` | 感測整合 | `sensor-principles`, `i2c-spi`, `hardware-interrupts` |
| 07 | `event-driven-data-flow` | 事件驅動資料流 | `event-polling`, `data-flow`, `json-serialization` |
| 08 | `protocol-api-design` | 協定與 API 設計 | `json-parsing`, `json-rest`, `api-design` |
| 09 | `ui-architecture` | UI 架構 | `ui-framework`, `refactoring`, `system-perf` |
| 10 | `metrics-communication` | 指標與溝通 | `kpi-definition`, `debugging-art`, `technical-narrative` |
| 11 | `error-to-control` | 誤差到控制 | `error-calculation`, `p-control`, `pwm-limits` |
| 12 | `kinematics-closed-loop` | 運動學與閉環 | `speed-algorithms`, `icc-geometry`, `closed-loop` |
| 13 | `pid-control` | PID 控制 | `pid-math`, `pid-control`, `pid-simulation` |
| 14 | `robustness-flow-control` | 穩健性與流程控制 | `robustness`, `flow-control`, `code-logic` |
| 15 | `ble-telemetry-deployment` | BLE 遙測與部署 | `ble-mtu`, `ble-notify`, `ble-async` |

---

## 4. Writing Strategy

- 先做感知與資料流，再做控制。
- 每個 lesson 都要留下可量化證據。
- 模型能力不是終點，閉環控制才是終點。
- 後半段特別重視除錯、KPI 與部署可讀性。

