# metadata_lessons Advanced v2 Draft
**Last updated**: 2026-06-14

這是一份第一筆新 advanced 課程 document 的草稿。  
用途是把新課程先以 `hiddenFromCatalog = true` 的 pilot 方式建立，避免影響現有上課。

---

## 1. Draft Goal

這份草稿對應的第一個新 advanced 課程，建議以：

- 主題：Vision AI 自動駕駛無人車
- 版本：v2
- 狀態：pilot / hidden

作為新課程的起點。

---

## 2. Suggested Firestore Document

```json
{
  "id": "car-advanced-vision-v2",
  "docId": "car-advanced-vision-v2",
  "metadataType": "course",
  "level": "advanced",
  "category": "car-advanced",
  "orderWeight": 1,
  "hiddenFromCatalog": true,
  "isDeprecated": false,
  "pilotOnly": true,
  "course_units": [
    "car-advanced-s3-interfaces.html",
    "car-advanced-image-dma.html",
    "car-advanced-jpeg-quality.html",
    "car-advanced-bandwidth-fps.html",
    "car-advanced-mjpeg-stream.html",
    "car-advanced-video-streaming.html",
    "car-advanced-canvas-image.html",
    "car-advanced-color-spaces.html",
    "car-advanced-hsv-math.html",
    "car-advanced-threshold-filter.html",
    "car-advanced-filter-algorithms.html",
    "car-advanced-feature-extraction.html",
    "car-advanced-centroid-algorithm.html",
    "car-advanced-centroid-error.html",
    "car-advanced-look-ahead.html",
    "car-advanced-chart-canvas.html",
    "car-advanced-teachable-machine.html",
    "car-advanced-mobilenet-ssd.html",
    "car-advanced-cnn-audio.html",
    "car-advanced-webspeech-api.html",
    "car-advanced-sensor-principles.html",
    "car-advanced-i2c-spi.html",
    "car-advanced-hardware-interrupts.html",
    "car-advanced-event-polling.html",
    "car-advanced-data-flow.html",
    "car-advanced-json-serialization.html",
    "car-advanced-json-parsing.html",
    "car-advanced-json-rest.html",
    "car-advanced-api-design.html",
    "car-advanced-ui-framework.html",
    "car-advanced-refactoring.html",
    "car-advanced-system-perf.html",
    "car-advanced-kpi-definition.html",
    "car-advanced-debugging-art.html",
    "car-advanced-technical-narrative.html",
    "car-advanced-error-calculation.html",
    "car-advanced-p-control.html",
    "car-advanced-pwm-limits.html",
    "car-advanced-speed-algorithms.html",
    "car-advanced-icc-geometry.html",
    "car-advanced-closed-loop.html",
    "car-advanced-pid-math.html",
    "car-advanced-pid-control.html",
    "car-advanced-pid-simulation.html",
    "car-advanced-robustness.html",
    "car-advanced-flow-control.html",
    "car-advanced-code-logic.html",
    "car-advanced-ble-mtu.html",
    "car-advanced-ble-notify.html",
    "car-advanced-ble-async.html"
  ],
  "i18n": {
    "zh-TW": {
      "title": "Vision AI 自動駕駛無人車",
      "summary": "從影像感知、特徵抽取、模型推理到閉環控制與產品化部署。",
      "description": "這門課帶領學生完成 Vision AI 自動駕駛系統的完整工程路線。",
      "coreContent": ""
    },
    "en": {
      "title": "Vision AI Autonomous Car",
      "summary": "From perception and feature extraction to control loops and product deployment.",
      "description": "This course guides students through the full engineering path of a Vision AI autonomous driving system.",
      "coreContent": ""
    }
  },
  "tags": [
    "vision-ai",
    "autonomous-driving",
    "computer-vision",
    "control-loop",
    "advanced"
  ],
  "prerequisites": [
    "Image processing fundamentals",
    "Basic control loop concepts"
  ],
  "publishedAt": null
}
```

---

## 3. Field Notes

- `hiddenFromCatalog` 必須先設為 `true`。
- `pilotOnly = true` 可明確標記這是內測版本。
- `course_units` 依 Vision AI 主線排列。
- `coreContent` 可先留空，等課綱主體與作業確認後再補。

---

## 4. Recommended Next Steps

1. 先在 Firestore 建立這筆新 document。
2. 設定 `hiddenFromCatalog = true`。
3. 把 `course_units` 與 `i18n` 填完整。
4. 不要動舊 advanced 文件。
5. 用 [`Pilot Validation Checklist`](./pilot-validation-checklist.md) 做驗證。
