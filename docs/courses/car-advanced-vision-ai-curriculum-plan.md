# Car Advanced Vision AI Curriculum Plan
**Last updated**: 2026-06-14

這份文件先不修改任何 `content-repo` 課程 HTML 內容，而是把目前 `car-advanced-*` 50 個進階單元整理成一條完整的 Vision AI 自動駕駛無人車學習路線。

目標不是只教「看得懂影像」或「會呼叫模型」，而是讓學生一路走到：

- 能穩定取得影像與感測資料
- 能做出可量化的視覺前處理與目標追蹤
- 能將感知結果轉成路徑與控制決策
- 能把控制閉環穩定地跑在 ESP32 / Web / BLE / HTTP 混合系統上
- 能把系統做成可量測、可除錯、可部署的產品

---

## 1. 核心設計原則

1. 先做感知管線，再做自動駕駛。
   - 影像來源、壓縮、傳輸、解析、前處理、特徵抽取，這些都要先穩。
   - 沒有穩定感知，就沒有可控的自駕。

2. 先做可測量的中間層。
   - 每一關都要產出可觀測的中間資料，例如 FPS、延遲、ROI、centroid、error、KPI、packet size。
   - 這些中間資料會變成下一關的輸入。

3. 控制與感知要交錯前進。
   - 視覺模型不是孤島。
   - 感知結果一定要和 P / PID / closed-loop / speed algorithm 連在一起。

4. 對學生來說，路線要像真實產品流程。
   - 感知
   - 決策
   - 控制
   - 通訊
   - 除錯
   - 部署

5. 本文件只定義規劃，不改課程內容。
   - 等這份路線確認後，再回寫到各單元的 `assignment-guide` / `tutor-guide`。

---

## 2. 50 個進階單元的推薦學習路徑

### Phase 1. 影像來源、傳輸與算力預算

這一段的目標是先把「車上的眼睛」接起來，知道影像從哪裡來、怎麼壓縮、怎麼傳、怎麼不把頻寬吃爆。

#### 01. `car-advanced-s3-interfaces.html`
- 現有重點：ESP32-S3 感測介面、PSRAM。
- Vision AI 練習目標：理解影像感測器與記憶體資源如何影響攝影機管線。
- 作業可加的練習：
  - 畫出 camera / PSRAM / sensor 的資料流圖。
  - 比較不同 buffer 策略對影像延遲的影響。
- 產物：
  - 感測器與記憶體配置圖。

#### 02. `car-advanced-image-dma.html`
- 現有重點：硬體加速影像擷取、DMA。
- Vision AI 練習目標：建立低延遲影像搬移能力。
- 作業可加的練習：
  - 比較 CPU copy 與 DMA 的延遲差異。
  - 設計雙 buffer / ring buffer 的影像流轉方式。
- 產物：
  - DMA 取像時序圖。

#### 03. `car-advanced-jpeg-quality.html`
- 現有重點：JPEG 品質、大小、FPS 權衡。
- Vision AI 練習目標：理解畫質與即時性之間的 trade-off。
- 作業可加的練習：
  - 記錄不同 quality 對畫面清晰度與頻寬的影響。
  - 找出自駕情境下可接受的品質下限。
- 產物：
  - JPEG quality vs latency 表。

#### 04. `car-advanced-bandwidth-fps.html`
- 現有重點：頻寬與 FPS 的數學關係。
- Vision AI 練習目標：建立系統算力預算。
- 作業可加的練習：
  - 估算傳輸頻寬、畫面幀率、封包大小之間的關係。
  - 比較「低延遲低解析」與「高畫質高延遲」的行為差異。
- 產物：
  - FPS / bandwidth profiling 報告。

#### 05. `car-advanced-mjpeg-stream.html`
- 現有重點：MJPEG 串流與 HTTP 邊界原理。
- Vision AI 練習目標：建立相機即時串流的基礎。
- 作業可加的練習：
  - 手寫簡化版 MJPEG stream handler。
  - 分析每個 frame boundary 的效能與穩定性。
- 產物：
  - 串流穩定性觀察表。

#### 06. `car-advanced-video-streaming.html`
- 現有重點：MJPEG vs H.264、串流系統。
- Vision AI 練習目標：理解影像串流格式對自駕延遲的影響。
- 作業可加的練習：
  - 比較不同影片編碼格式的延遲、畫質與 CPU 負擔。
  - 為後續視覺推理選出最合適的串流策略。
- 產物：
  - 影像串流格式選型報告。

---

### Phase 2. 影像前處理、特徵與目標定位

這一段的目標是把影像從「看得到」變成「算得出」。

#### 07. `car-advanced-canvas-image.html`
- 現有重點：Canvas 影像處理與即時標註。
- Vision AI 練習目標：建立視覺 debug 面板。
- 作業可加的練習：
  - 在畫面上疊加 ROI、bounding box、路徑提示。
  - 設計可視化除錯視窗。
- 產物：
  - 視覺標註工作台。

#### 08. `car-advanced-color-spaces.html`
- 現有重點：RGB / HSV / YUV 顏色空間。
- Vision AI 練習目標：理解不同顏色表示法在辨識上的優劣。
- 作業可加的練習：
  - 比較 RGB 與 HSV 在車道 / 標誌辨識上的可用性。
  - 為後續 threshold filter 建立色彩前處理基礎。
- 產物：
  - 顏色空間對照表。

#### 09. `car-advanced-hsv-math.html`
- 現有重點：HSV 數學、遮罩、行為決策。
- Vision AI 練習目標：用顏色遮罩找出關鍵目標。
- 作業可加的練習：
  - 建立動態 HSV mask。
  - 觀察不同光線下的辨識穩定性。
- 產物：
  - HSV 遮罩參數集。

#### 10. `car-advanced-threshold-filter.html`
- 現有重點：門檻濾波、雜訊抑制、特徵中心。
- Vision AI 練習目標：讓辨識結果從雜訊中浮現。
- 作業可加的練習：
  - 調整 threshold 以保留可用區域。
  - 比較 hard threshold 與 soft filter 的差異。
- 產物：
  - 門檻濾波校正紀錄。

#### 11. `car-advanced-filter-algorithms.html`
- 現有重點：移動平均、中值濾波、自適應 alpha。
- Vision AI 練習目標：把前處理做成能抗抖動的基礎模組。
- 作業可加的練習：
  - 比較不同濾波器對目標抖動的改善效果。
  - 記錄在車輛高速移動時的濾波延遲。
- 產物：
  - 濾波器比較報告。

#### 12. `car-advanced-feature-extraction.html`
- 現有重點：邊緣、幾何、特徵抽取。
- Vision AI 練習目標：把影像轉成可供決策的結構化特徵。
- 作業可加的練習：
  - 抽取道路邊界、標線或路標輪廓。
  - 讓學生理解 feature 不是 image 本身，而是可計算的描述。
- 產物：
  - 特徵抽取筆記與 debug 圖。

#### 13. `car-advanced-centroid-algorithm.html`
- 現有重點：質心追蹤、座標轉換、穩定化。
- Vision AI 練習目標：建立最基本的目標追蹤能力。
- 作業可加的練習：
  - 從二值圖中找 centroid。
  - 追蹤目標在畫面中的移動軌跡。
- 產物：
  - centroid tracking log。

#### 14. `car-advanced-centroid-error.html`
- 現有重點：質心誤差、deadzone、環境干擾。
- Vision AI 練習目標：把視覺誤差轉成控制誤差。
- 作業可加的練習：
  - 將 centroid offset 正規化成 steering error。
  - 設計 deadzone 防止方向盤左右抖動。
- 產物：
  - error normalization 規格。

#### 15. `car-advanced-look-ahead.html`
- 現有重點：預視控制、前瞻距離。
- Vision AI 練習目標：從單點追蹤升級成路徑預測。
- 作業可加的練習：
  - 根據道路曲線估算下一個控制點。
  - 比較短前瞻與長前瞻對穩定性的影響。
- 產物：
  - look-ahead 參數表。

#### 16. `car-advanced-chart-canvas.html`
- 現有重點：即時圖表、監控、視覺化。
- Vision AI 練習目標：建立自駕資料觀測儀表板。
- 作業可加的練習：
  - 顯示 centroid error、FPS、推理時間、控制輸出。
  - 讓學生用圖表找出系統瓶頸。
- 產物：
  - Vision telemetry dashboard。

---

### Phase 3. 模型、感知與多模態輸入

這一段的目標是從傳統影像處理走向 AI 感知，並把聲音、手勢、事件流也納入自駕介面。

#### 17. `car-advanced-teachable-machine.html`
- 現有重點：自訂手勢訓練、AI-BLE 元件。
- Vision AI 練習目標：讓學生做出自己的輕量模型入口。
- 作業可加的練習：
  - 訓練「左轉 / 右轉 / 停止 / 緊急煞車」手勢分類器。
  - 讓模型輸出可直接餵給控制層的意圖標籤。
- 產物：
  - gesture intent classifier。

#### 18. `car-advanced-mobilenet-ssd.html`
- 現有重點：MobileNet-SSD 偵測模型。
- Vision AI 練習目標：建立物件偵測能力。
- 作業可加的練習：
  - 偵測行人、障礙物、車道標誌或交通錐。
  - 使用偵測結果決定是否減速或停車。
- 產物：
  - detection benchmark report。

#### 19. `car-advanced-cnn-audio.html`
- 現有重點：CNN 音訊辨識原理。
- Vision AI 練習目標：把聲音當成輔助感知通道。
- 作業可加的練習：
  - 辨識「前進 / 停止 / 倒車」口令或警示聲。
  - 討論聲音訊號在駕駛輔助上的用途。
- 產物：
  - audio intent supplement。

#### 20. `car-advanced-webspeech-api.html`
- 現有重點：Web Speech、語音意圖解析、雙向回饋。
- Vision AI 練習目標：建立語音輔助駕駛介面。
- 作業可加的練習：
  - 用語音控制模式切換或故障回報。
  - 將語音結果轉成高層指令，再交給感知與控制層。
- 產物：
  - voice command fallback spec。

#### 21. `car-advanced-sensor-principles.html`
- 現有重點：感測器原理、編碼器、速度資料。
- Vision AI 練習目標：把視覺與輪速 / IMU / 編碼器資料結合。
- 作業可加的練習：
  - 比較視覺速度估計與編碼器速度讀值。
  - 建立 sensor fusion 的前置認知。
- 產物：
  - multi-sensor observation table。

#### 22. `car-advanced-i2c-spi.html`
- 現有重點：I2C / SPI 通訊協定。
- Vision AI 練習目標：理解攝影機、IMU、顯示器等周邊的底層通訊。
- 作業可加的練習：
  - 掃描 I2C 裝置並確認感測器存在。
  - 比較 SPI 與 I2C 對資料吞吐與延遲的差異。
- 產物：
  - peripheral bus map。

#### 23. `car-advanced-hardware-interrupts.html`
- 現有重點：中斷、反應、效能。
- Vision AI 練習目標：建立低延遲事件驅動的控制感。
- 作業可加的練習：
  - 用 interrupt 記錄相機 / 感測器關鍵事件。
  - 比較 polling 與 interrupt 的反應速度。
- 產物：
  - event latency comparison。

#### 24. `car-advanced-event-polling.html`
- 現有重點：Event-driven vs polling。
- Vision AI 練習目標：理解感知迴圈如何從輪詢過渡到事件驅動。
- 作業可加的練習：
  - 將固定輪詢改為事件觸發流程。
  - 評估不同資料流下的 CPU 開銷。
- 產物：
  - event loop design note。

---

### Phase 4. 資料流、系統架構與產品化抽象

這一段的目標是把感知結果變成系統資料，讓整個自駕平台可以維護、擴充、測量與除錯。

#### 25. `car-advanced-data-flow.html`
- 現有重點：端到端資料流、壅塞測試、髒資料清理。
- Vision AI 練習目標：理解影像 -> 推理 -> 決策 -> 控制 的全鏈路。
- 作業可加的練習：
  - 標出 frame 在每一層的流向與延遲。
  - 注入髒資料驗證系統是否能重置。
- 產物：
  - end-to-end data flow diagram。

#### 26. `car-advanced-json-serialization.html`
- 現有重點：序列化 / 反序列化、資料瘦身。
- Vision AI 練習目標：把感知與控制資料整理成標準交換格式。
- 作業可加的練習：
  - 設計自駕 telemetry JSON schema。
  - 比較完整欄位與瘦身欄位的大小差異。
- 產物：
  - telemetry JSON spec。

#### 27. `car-advanced-json-parsing.html`
- 現有重點：解析、巢狀結構、payload slimming。
- Vision AI 練習目標：把感知資料包拆成控制可用的欄位。
- 作業可加的練習：
  - 從 JSON 中提取 centroid、confidence、error、speed。
  - 增加 defensive parsing。
- 產物：
  - parser validation notes。

#### 28. `car-advanced-json-rest.html`
- 現有重點：RESTful return、標準化 payload。
- Vision AI 練習目標：建立感知結果 / 控制命令 API。
- 作業可加的練習：
  - 規劃 `/telemetry` 與 `/command` 的 API 格式。
  - 為前端 dashboard 與 ESP32 後端建立一致契約。
- 產物：
  - REST contract。

#### 29. `car-advanced-api-design.html`
- 現有重點：API 設計、抽象、運動學類別。
- Vision AI 練習目標：把自駕能力封裝成乾淨的高層介面。
- 作業可加的練習：
  - 設計 `AutonomousDriveController` 或類似抽象層。
  - 分離 perception / planning / actuation。
- 產物：
  - driver API abstraction。

#### 30. `car-advanced-ui-framework.html`
- 現有重點：元件化 UI、事件 emitter、儀表板重構。
- Vision AI 練習目標：做出可操作、可觀測的自駕控制台。
- 作業可加的練習：
  - 建立 telemetry cards、status chips、mode switcher。
  - 將 UI 元件與資料流解耦。
- 產物：
  - autonomous dashboard component map。

#### 31. `car-advanced-refactoring.html`
- 現有重點：重構、解耦、插件化管線。
- Vision AI 練習目標：讓整個自駕系統可以長期維護。
- 作業可加的練習：
  - 將感知、控制、通訊拆分成模組。
  - 讓單一模組可替換，不影響其他層。
- 產物：
  - clean architecture refactor plan。

#### 32. `car-advanced-system-perf.html`
- 現有重點：系統效能 profiling、UI rendering 優化。
- Vision AI 練習目標：找出自駕系統瓶頸。
- 作業可加的練習：
  - 分析影像、推理、渲染、控制各自耗時。
  - 設計 performance budget。
- 產物：
  - system performance report。

#### 33. `car-advanced-kpi-definition.html`
- 現有重點：KPI、量化指標、壓測。
- Vision AI 練習目標：定義「自駕做得好不好」的量測標準。
- 作業可加的練習：
  - 設定 FPS、latency、lane error、stop accuracy 等 KPI。
  - 為每個 KPI 定義驗收門檻。
- 產物：
  - Vision AI KPI sheet。

#### 34. `car-advanced-debugging-art.html`
- 現有重點：除錯方法、工程師素養。
- Vision AI 練習目標：讓學生能處理模型失準、影像失真、控制抖動。
- 作業可加的練習：
  - 條列最常見的 vision pipeline 故障。
  - 用科學方法記錄問題、假設、實驗、結論。
- 產物：
  - debugging playbook。

#### 35. `car-advanced-technical-narrative.html`
- 現有重點：技術敘事、作品集包裝。
- Vision AI 練習目標：把自駕系統變成可展示的工程成果。
- 作業可加的練習：
  - 寫出 perception -> planning -> control 的故事線。
  - 用數據與畫面證明系統有效。
- 產物：
  - portfolio narrative draft。

---

### Phase 5. 控制閉環、運動學與穩定性

這一段的目標是把「看見了什麼」變成「車子怎麼動」，也就是從視覺感知走到真實控制。

#### 36. `car-advanced-error-calculation.html`
- 現有重點：誤差計算、補償、平滑。
- Vision AI 練習目標：將感知偏差轉成控制誤差。
- 作業可加的練習：
  - 計算車道中心線誤差與目標誤差。
  - 設計補償映射避免過度修正。
- 產物：
  - error compensation sheet。

#### 37. `car-advanced-p-control.html`
- 現有重點：P 控制、Kp 調參、視覺伺服。
- Vision AI 練習目標：做出第一個可工作的視覺閉環。
- 作業可加的練習：
  - 用 centroid error 直接控制 steering。
  - 調整 Kp 找到最穩的視覺跟隨。
- 產物：
  - P controller tuning notes。

#### 38. `car-advanced-pwm-limits.html`
- 現有重點：PWM 飽和、縮放、死區補償。
- Vision AI 練習目標：把控制輸出轉成馬達可接受的範圍。
- 作業可加的練習：
  - 設定最小啟動 PWM 與最大限制。
  - 避免控制值過小時車子不動、過大時失控。
- 產物：
  - PWM linearization table。

#### 39. `car-advanced-speed-algorithms.html`
- 現有重點：速度量測、頻率法、週期法、混合法。
- Vision AI 練習目標：理解車速回授是控制穩定的核心。
- 作業可加的練習：
  - 比較不同速度估計法的誤差與更新率。
  - 讓視覺控制與速度回授一起工作。
- 產物：
  - speed estimation report。

#### 40. `car-advanced-icc-geometry.html`
- 現有重點：ICC 幾何、轉彎半徑、路徑規劃。
- Vision AI 練習目標：把視覺決策轉成幾何上合理的轉向路徑。
- 作業可加的練習：
  - 用 ICC 推導最小轉彎半徑。
  - 比較不同路徑曲率下的穩定性。
- 產物：
  - path geometry notebook。

#### 41. `car-advanced-closed-loop.html`
- 現有重點：視覺閉環、P control、安全保護。
- Vision AI 練習目標：讓整個感知到控制形成真正的閉迴路。
- 作業可加的練習：
  - 將 centroid / lane error 接到控制輸出。
  - 加上 failsafe 與 timeout。
- 產物：
  - closed-loop integration report。

#### 42. `car-advanced-pid-math.html`
- 現有重點：離散 PID、抗飽和、抗雜訊。
- Vision AI 練習目標：提升自駕穩定度與可調性。
- 作業可加的練習：
  - 用離散 PID 修正視覺控制誤差。
  - 調整 `Kp / Ki / Kd` 對路徑追蹤的影響。
- 產物：
  - PID math tuning sheet。

#### 43. `car-advanced-pid-control.html`
- 現有重點：PID 控制原理、穩態誤差、回授。
- Vision AI 練習目標：把 PID 套入自駕 steering / speed。
- 作業可加的練習：
  - 比較 P 與 PID 在彎道中的差異。
  - 觀察穩態誤差是否下降。
- 產物：
  - PID performance comparison。

#### 44. `car-advanced-pid-simulation.html`
- 現有重點：高頻 telemetry、Z-N 調參、抗 windup。
- Vision AI 練習目標：先在模擬中驗證控制器，再上實車。
- 作業可加的練習：
  - 建立視覺控制的模擬環境。
  - 比較不同 tuning 對 overshoot 的影響。
- 產物：
  - PID simulation benchmark。

#### 45. `car-advanced-robustness.html`
- 現有重點：非法資料壓測、heartbeat、failsafe。
- Vision AI 練習目標：讓自駕車在感知異常時仍可安全停車。
- 作業可加的練習：
  - 注入壞 frame、錯誤命令、掉線情境。
  - 驗證 heartbeat 與 emergency stop 是否生效。
- 產物：
  - robustness test matrix。

---

### Phase 6. 通訊、部署與產品化收尾

這一段的目標是把整個 Vision AI 自動駕駛系統變成可部署、可串流、可遠端觀察、可維護的產品。

#### 46. `car-advanced-flow-control.html`
- 現有重點：流量控制、節流、去抖。
- Vision AI 練習目標：限制影像、推理、控制命令的頻率，避免系統崩潰。
- 作業可加的練習：
  - 控制指令節流與影像更新節流。
  - 觀察過載時的行為。
- 產物：
  - flow control policy。

#### 47. `car-advanced-code-logic.html`
- 現有重點：程式流程邏輯、非阻塞、fail-safe。
- Vision AI 練習目標：讓整個自駕程式可被拆解與維護。
- 作業可加的練習：
  - 建立清楚的 state machine。
  - 確保異常時能回到安全模式。
- 產物：
  - driving logic state chart。

#### 48. `car-advanced-ble-mtu.html`
- 現有重點：BLE MTU、分段傳輸。
- Vision AI 練習目標：把低延遲控制命令與 telemetry 壓進 BLE。
- 作業可加的練習：
  - 讓視覺摘要資料可以分段送出。
  - 比較不同 MTU 的吞吐與延遲。
- 產物：
  - BLE payload segmentation spec。

#### 49. `car-advanced-ble-notify.html`
- 現有重點：Notify、push model、即時回報。
- Vision AI 練習目標：把自駕車的狀態主動推回手機或 dashboard。
- 作業可加的練習：
  - 即時回傳速度、碰撞警報、模型信心值。
  - 讓手機端從純控制器變成監控台。
- 產物：
  - notification telemetry schema。

#### 50. `car-advanced-ble-async.html`
- 現有重點：BLE 非同步連線、自癒、雙工流。
- Vision AI 練習目標：完成遠端操作、監控與重連的最後一塊。
- 作業可加的練習：
  - 實作連線狀態機與 retry。
  - 讓車子在暫時斷線後能安全復原。
- 產物：
  - BLE connection recovery log。

> 注意：`car-advanced-*` 清單實際上有 50 個檔案，這份文件最後三個 BLE 單元是收尾段。若後續要調整成「Vision AI + BLE teleoperation」雙軌課程，也可以把它們拆成自駕 telemetry 與遠端救援兩條線。

---

## 3. 建議的課程節奏

### Phase A: 影像管線打底

- 單元：1 到 6
- 目標：把影像拿進來、壓得動、傳得穩。

### Phase B: 前處理與目標定位

- 單元：7 到 16
- 目標：把影像變成可追蹤、可量測、可視覺化的資料。

### Phase C: 模型與多模態輸入

- 單元：17 到 24
- 目標：把 AI 模型、聲音與感測器變成決策訊號。

### Phase D: 架構與產品化

- 單元：25 到 35
- 目標：把資料流、API、UI、效能與敘事整合成產品。

### Phase E: 控制閉環

- 單元：36 到 45
- 目標：把感知結果變成穩定控制，並且能安全失敗。

### Phase F: 通訊與部署

- 單元：46 到 50
- 目標：把系統收斂成可遠端監控、可維護、可部署的自駕平台。

---

## 4. 作業設計原則

1. 每關只新增一個主要 Vision AI 概念。
   - 例如某關只教 HSV threshold，不要同時塞 detection、PID、BLE 與 OTA。

2. 每關都要留下可重用的中間產物。
   - 例如 ROI、mask、centroid、error curve、KPI、API schema、telemetry dashboard。

3. 感知與控制交錯前進。
   - 看見了什麼，下一關就要知道怎麼把它變成控制誤差。

4. 先觀察，再推理，再閉環，再部署。
   - 這樣學生會自然理解自駕系統的工程結構。

5. 失敗與除錯必須是作業的一部分。
   - Vision AI 常會遇到光線變化、延遲、誤偵測、資料壅塞。
   - 課程必須讓學生學會怎麼判斷與修正。

---

## 5. 建議的下一步落地順序

如果接下來要開始回寫課程內容，我建議先做這三步：

1. 先把 1 到 16 關整理成完整的感知與前處理主線。
2. 再把 17 到 35 關整理成模型、架構與產品化主線。
3. 最後把 36 到 50 關整理成控制閉環、遠端通訊與部署主線。

這樣整個進階課程會自然長成一個完整的 Vision AI 自動駕駛無人車系統，而不是零散的影像處理、AI 模型或通訊實驗。

---

## 6. 相關文件

- [`docs/car-starter-ble-curriculum-plan.md`](./car-starter-ble-curriculum-plan.md)
- [`docs/car-basic-esp32-motor-curriculum-plan.md`](./car-basic-esp32-motor-curriculum-plan.md)
- [`docs/course-management-runbook.md`](../course-management-runbook.md)
- [`docs/course-ui-runtime-spec.md`](../course-ui-runtime-spec.md)
- [`docs/platform-expansion-plan.md`](../platform-expansion-plan.md)
