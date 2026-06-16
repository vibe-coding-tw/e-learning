# Lesson-Level `metadata_lessons` Plan
**Last updated**: 2026-06-14

這份文件把 `starter`、`basic`、`advanced` 三條課程線，整理成可直接建立 `metadata_lessons` 的 lesson-level 清單。

原則：

1. `metadata_lessons` 以 lesson 為單位建立。
2. 每個 lesson 約對應 3 個 units。
3. lesson 是管理單位，unit 是教學步驟。
4. 若某個 lesson 特別重，可以在正式發布前微調為 2 或 4 個 units。
5. 新 lesson 一律先 hidden / pilot，再正式公開。

---

## 1. Lesson Document Shape

每個 lesson 建議使用以下 document 結構：

```json
{
  "id": "car-starter-lesson-01",
  "docId": "car-starter-lesson-01",
  "metadataType": "course",
  "level": "starter",
  "category": "car-starter",
  "orderWeight": 1,
  "hiddenFromCatalog": true,
  "isDeprecated": false,
  "pilotOnly": true,
  "lessonIndex": 1,
  "lessonKey": "mobile-control-foundation",
  "course_units": [
    "car-starter-html5-basics.html",
    "car-starter-touch-vs-mouse.html",
    "car-starter-touch-basics.html"
  ],
  "i18n": {
    "zh-TW": {
      "title": "手機控制基礎",
      "summary": "建立手機端操作與觸控控制的第一個完整 lesson。",
      "description": "..."
    },
    "en": {
      "title": "Mobile Control Foundation",
      "summary": "Build the first complete lesson for mobile operation and touch-based control.",
      "description": "..."
    }
  }
}
```

### Fields to keep consistent

- `level`
- `category`
- `orderWeight`
- `course_units`
- `lessonIndex`
- `lessonKey`
- `hiddenFromCatalog`
- `pilotOnly`

> 其中 `category` 是優先分類鍵，建議直接使用 `common`、`car-starter`、`car-basic`、`car-advanced`；`orderWeight` 用於排序。

---

## 2. Starter Lessons

### Starter Lesson 1

- `lessonKey`: `mobile-control-foundation`
- `lessonIndex`: 1
- `docId`: `car-starter-lesson-01`
- `course_units`:
  - `car-starter-html5-basics.html`
  - `car-starter-touch-vs-mouse.html`
  - `car-starter-touch-basics.html`

### Starter Lesson 2

- `lessonKey`: `interaction-polish`
- `lessonIndex`: 2
- `docId`: `car-starter-lesson-02`
- `course_units`:
  - `car-starter-prevent-default.html`
  - `car-starter-long-press.html`
  - `car-starter-flexbox-layout.html`

### Starter Lesson 3

- `lessonKey`: `control-ui-state`
- `lessonIndex`: 3
- `docId`: `car-starter-lesson-03`
- `course_units`:
  - `car-starter-ui-ux-standards.html`
  - `car-starter-control-panel.html`
  - `car-starter-canvas-joystick.html`

### Starter Lesson 4

- `lessonKey`: `control-data-modeling`
- `lessonIndex`: 4
- `docId`: `car-starter-lesson-04`
- `course_units`:
  - `car-starter-joystick-math.html`
  - `car-starter-flow-logic.html`
  - `car-starter-data-json.html`

### Starter Lesson 5

- `lessonKey`: `ble-readiness`
- `lessonIndex`: 5
- `docId`: `car-starter-lesson-05`
- `course_units`:
  - `car-starter-typed-arrays.html`
  - `car-starter-ble-async.html`
  - `car-starter-ble-security.html`

---

## 3. Basic Lessons

### Basic Lesson 1

- `lessonKey`: `dev-environment-hardware-map`
- `lessonIndex`: 1
- `docId`: `car-basic-lesson-01`
- `course_units`:
  - `car-basic-platformio-setup.html`
  - `car-basic-esp32-architecture.html`
  - `car-basic-pinout.html`

### Basic Lesson 2

- `lessonKey`: `pwm-motor-output`
- `lessonIndex`: 2
- `docId`: `car-basic-lesson-02`
- `course_units`:
  - `car-basic-pwm-basics.html`
  - `car-basic-ledc-syntax.html`
  - `car-basic-h-bridge.html`

### Basic Lesson 3

- `lessonKey`: `signal-quality-input-stability`
- `lessonIndex`: 3
- `docId`: `car-basic-lesson-03`
- `course_units`:
  - `car-basic-pullup-debounce.html`
  - `car-basic-adc-resolution.html`
  - `car-basic-sampling-rate.html`

### Basic Lesson 4

- `lessonKey`: `motion-mapping`
- `lessonIndex`: 4
- `docId`: `car-basic-lesson-04`
- `course_units`:
  - `car-basic-joystick-mapping.html`
  - `car-basic-unicycle-model.html`
  - `car-basic-response-curves.html`

### Basic Lesson 5

- `lessonKey`: `control-logic-core`
- `lessonIndex`: 5
- `docId`: `car-basic-lesson-05`
- `course_units`:
  - `car-basic-fsm.html`
  - `car-basic-millis.html`
  - `car-basic-hardware-timer.html`

### Basic Lesson 6

- `lessonKey`: `state-and-messaging`
- `lessonIndex`: 6
- `docId`: `car-basic-lesson-06`
- `course_units`:
  - `car-basic-state-consistency.html`
  - `car-basic-http-request.html`
  - `car-basic-http-lifecycle.html`

### Basic Lesson 7

- `lessonKey`: `web-control-stack`
- `lessonIndex`: 7
- `docId`: `car-basic-lesson-07`
- `course_units`:
  - `car-basic-fetch-api.html`
  - `car-basic-async-webserver.html`
  - `car-basic-cors-security.html`

### Basic Lesson 8

- `lessonKey`: `connectivity-modes`
- `lessonIndex`: 8
- `docId`: `car-basic-lesson-08`
- `course_units`:
  - `car-basic-wifi-ap-sta.html`
  - `car-basic-ble-properties.html`
  - `car-basic-gatt-structure.html`

### Basic Lesson 9

- `lessonKey`: `ble-transport`
- `lessonIndex`: 9
- `docId`: `car-basic-lesson-09`
- `course_units`:
  - `car-basic-advertising-connection.html`
  - `car-basic-ble-async.html`
  - `car-basic-ble-notify.html`

### Basic Lesson 10

- `lessonKey`: `deployment-update`
- `lessonIndex`: 10
- `docId`: `car-basic-lesson-10`
- `course_units`:
  - `car-basic-ble-mtu.html`
  - `car-basic-ota-principles.html`
  - `car-basic-ota-security.html`

---

## 4. Advanced Lessons

### Advanced Lesson 1

- `lessonKey`: `sensor-stream-foundations`
- `lessonIndex`: 1
- `docId`: `car-advanced-lesson-01`
- `course_units`:
  - `car-advanced-s3-interfaces.html`
  - `car-advanced-image-dma.html`
  - `car-advanced-jpeg-quality.html`
  - `car-advanced-bandwidth-fps.html`

### Advanced Lesson 2

- `lessonKey`: `video-pipeline`
- `lessonIndex`: 2
- `docId`: `car-advanced-lesson-02`
- `course_units`:
  - `car-advanced-mjpeg-stream.html`
  - `car-advanced-video-streaming.html`
  - `car-advanced-canvas-image.html`
  - `car-advanced-color-spaces.html`

### Advanced Lesson 3

- `lessonKey`: `vision-preprocessing`
- `lessonIndex`: 3
- `docId`: `car-advanced-lesson-03`
- `course_units`:
  - `car-advanced-hsv-math.html`
  - `car-advanced-threshold-filter.html`
  - `car-advanced-filter-algorithms.html`
  - `car-advanced-feature-extraction.html`

### Advanced Lesson 4

- `lessonKey`: `tracking-visualization`
- `lessonIndex`: 4
- `docId`: `car-advanced-lesson-04`
- `course_units`:
  - `car-advanced-centroid-algorithm.html`
  - `car-advanced-centroid-error.html`
  - `car-advanced-look-ahead.html`
  - `car-advanced-chart-canvas.html`

### Advanced Lesson 5

- `lessonKey`: `ai-perception-entry`
- `lessonIndex`: 5
- `docId`: `car-advanced-lesson-05`
- `course_units`:
  - `car-advanced-teachable-machine.html`
  - `car-advanced-mobilenet-ssd.html`
  - `car-advanced-cnn-audio.html`
  - `car-advanced-webspeech-api.html`

### Advanced Lesson 6

- `lessonKey`: `sensor-integration`
- `lessonIndex`: 6
- `docId`: `car-advanced-lesson-06`
- `course_units`:
  - `car-advanced-sensor-principles.html`
  - `car-advanced-i2c-spi.html`
  - `car-advanced-hardware-interrupts.html`

### Advanced Lesson 7

- `lessonKey`: `event-driven-data-flow`
- `lessonIndex`: 7
- `docId`: `car-advanced-lesson-07`
- `course_units`:
  - `car-advanced-event-polling.html`
  - `car-advanced-data-flow.html`
  - `car-advanced-json-serialization.html`

### Advanced Lesson 8

- `lessonKey`: `protocol-api-design`
- `lessonIndex`: 8
- `docId`: `car-advanced-lesson-08`
- `course_units`:
  - `car-advanced-json-parsing.html`
  - `car-advanced-json-rest.html`
  - `car-advanced-api-design.html`

### Advanced Lesson 9

- `lessonKey`: `ui-architecture`
- `lessonIndex`: 9
- `docId`: `car-advanced-lesson-09`
- `course_units`:
  - `car-advanced-ui-framework.html`
  - `car-advanced-refactoring.html`
  - `car-advanced-system-perf.html`

### Advanced Lesson 10

- `lessonKey`: `metrics-communication`
- `lessonIndex`: 10
- `docId`: `car-advanced-lesson-10`
- `course_units`:
  - `car-advanced-kpi-definition.html`
  - `car-advanced-debugging-art.html`
  - `car-advanced-technical-narrative.html`

### Advanced Lesson 11

- `lessonKey`: `error-to-control`
- `lessonIndex`: 11
- `docId`: `car-advanced-lesson-11`
- `course_units`:
  - `car-advanced-error-calculation.html`
  - `car-advanced-p-control.html`
  - `car-advanced-pwm-limits.html`

### Advanced Lesson 12

- `lessonKey`: `kinematics-closed-loop`
- `lessonIndex`: 12
- `docId`: `car-advanced-lesson-12`
- `course_units`:
  - `car-advanced-speed-algorithms.html`
  - `car-advanced-icc-geometry.html`
  - `car-advanced-closed-loop.html`

### Advanced Lesson 13

- `lessonKey`: `pid-control`
- `lessonIndex`: 13
- `docId`: `car-advanced-lesson-13`
- `course_units`:
  - `car-advanced-pid-math.html`
  - `car-advanced-pid-control.html`
  - `car-advanced-pid-simulation.html`

### Advanced Lesson 14

- `lessonKey`: `robustness-flow-control`
- `lessonIndex`: 14
- `docId`: `car-advanced-lesson-14`
- `course_units`:
  - `car-advanced-robustness.html`
  - `car-advanced-flow-control.html`
  - `car-advanced-code-logic.html`

### Advanced Lesson 15

- `lessonKey`: `ble-telemetry-deployment`
- `lessonIndex`: 15
- `docId`: `car-advanced-lesson-15`
- `course_units`:
  - `car-advanced-ble-mtu.html`
  - `car-advanced-ble-notify.html`
  - `car-advanced-ble-async.html`

---

## 5. Recommended Creation Order

如果要開始真正建立 `metadata_lessons`，建議順序如下：

1. 先建 `starter` Lesson 1 到 5
2. 再建 `basic` Lesson 1 到 10
3. 最後建 `advanced` Lesson 1 到 15

原因是：

- `starter` 風險最低，最適合先驗證版本管理流程
- `basic` 已經有較完整的硬體與控制主線
- `advanced` 內容最重，應該等 lesson-level 節奏確定後再分批建立

---

## 6. Notes for Firestore Setup

- 每個 lesson 都應該是一筆新的 `metadata_lessons` document
- `hiddenFromCatalog` 先設為 `true`
- `pilotOnly` 建議先設為 `true`
- `course_units` 是 lesson 的核心
- 之後若要公開，再切換 `hiddenFromCatalog = false`

---

## 7. Related Docs

- [`docs/courses/lesson-level-curriculum-map.md`](./lesson-level-curriculum-map.md)
- [`docs/courses/lesson-level-metadata-lessons-import-guide.md`](./lesson-level-metadata-lessons-import-guide.md)
- [`docs/courses/lesson-level-starter-course-description.md`](./lesson-level-starter-course-description.md)
- [`docs/courses/lesson-level-basic-course-description.md`](./lesson-level-basic-course-description.md)
- [`docs/courses/lesson-level-advanced-course-description.md`](./lesson-level-advanced-course-description.md)
- [`docs/courses/metadata-lessons-new-course-template.md`](./metadata-lessons-new-course-template.md)
- [`docs/courses/pilot-validation-checklist.md`](./pilot-validation-checklist.md)
- [`docs/courses/README.md`](./README.md)
