# metadata_lessons Advanced Template
**Last updated**: 2026-06-14

這份範本適用於 `advanced` 課程線的新課程 document。

主題重點通常是：

- Vision AI 感知管線
- 目標追蹤與路徑規劃
- P / PID / closed-loop 控制
- 系統化觀測、除錯與部署

---

## 1. Suggested Shape

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
      "coreContent": "..."
    },
    "en": {
      "title": "Vision AI Autonomous Car",
      "summary": "From perception and feature extraction to control loops and product deployment.",
      "description": "This course guides students through the full engineering path of a Vision AI autonomous driving system.",
      "coreContent": "..."
    }
  }
}
```

---

## 2. Advanced Rules

1. 先做影像與感知管線，再做決策與控制。
2. 中間資料必須可觀測、可量化、可除錯。
3. 模型不是終點，閉環控制才是終點。
4. 每關都要留下 KPI、telemetry、debug artifact。
5. 新版本先 hidden pilot，確認穩定後再公開。

---

## 3. Recommended Advanced Units

- `car-advanced-image-dma.html`
- `car-advanced-jpeg-quality.html`
- `car-advanced-bandwidth-fps.html`
- `car-advanced-mjpeg-stream.html`
- `car-advanced-video-streaming.html`
- `car-advanced-threshold-filter.html`
- `car-advanced-filter-algorithms.html`
- `car-advanced-feature-extraction.html`
- `car-advanced-centroid-algorithm.html`
- `car-advanced-centroid-error.html`
- `car-advanced-look-ahead.html`
- `car-advanced-mobilenet-ssd.html`
- `car-advanced-teachable-machine.html`
- `car-advanced-p-control.html`
- `car-advanced-closed-loop.html`
- `car-advanced-pid-control.html`
- `car-advanced-pid-simulation.html`
- `car-advanced-robustness.html`
- `car-advanced-ble-notify.html`
- `car-advanced-ble-async.html`

---

## 4. Advanced Versioning Notes

- 若課綱主線從一般 AI 練習升級成 Vision AI 自駕，請直接開新 document。
- 舊 advanced 課程保留給既有授課與歷史資料。
- BLE 與自駕 telemetry 可以留在收尾段，但不要搶掉 Vision AI 主軸。
