# Curriculum Migration Plan
**Last updated**: 2026-06-14

> **2026-07-14 note**: this file is a 2026-07-02 point-in-time snapshot copy of
> `docs/courses/curriculum-migration-plan.md`. **`docs/courses/curriculum-migration-plan.md`
> is canonical** — check there for the current version. This copy had drifted (one relative
> link was wrong, fixed 2026-07-14); see `.opencode/plans/courses/README.md` for why these
> snapshots exist and their known limitations.

這份文件的目的，是在**不影響現有上課進行**的前提下，逐步把既有課程平滑遷移到新的課綱主線。

核心原則：

1. 舊課程先維持穩定，不做大改。
2. 新課綱先以文件化方式定義，再逐關回寫。
3. 先改作業敘事與中間產物，再改頁面內容與結構。
4. 先做小型 pilot，再擴大到整條課程線。
5. 任何時候都保留可回退的版本。

---

## 1. Migration Goals

本次遷移的最終目標，是讓三條課程線各自收斂成清楚主題：

- `starter`：手機透過 BLE 遙控無人車
- `basic`：透過 ESP32 精準控制馬達
- `advanced`：Vision AI 自動駕駛無人車

但在實務上，不能直接一次切換成新版本，而要採取：

- **舊版持續授課**
- **新版逐步上線**
- **兩版在一段時間內並存**

---

## 2. Migration Strategy

### 2.1 Phase A: Freeze Existing Content

先凍結現有正式課程內容，僅保留必要修正。

可做：
- 修正錯字、連結、明顯錯誤
- 更新文件與規劃
- 修正會導致授課中斷的 bug

先不做：
- 不重寫整份 assignment-guide
- 不調整課程順序
- 不改作業主軸
- 不替換整個教學敘事

### 2.2 Phase B: Build the New Curriculum Map

把每個舊單元對應到新課綱中的能力點。

輸出物應包含：
- 單元對照表
- 前置能力表
- 作業產物表
- Pilot 單元清單

### 2.3 Phase C: Rewrite Assignments First

先改作業敘事，不先改課程主體。

原因：
- 學員對頁面結構最敏感
- 作業敘事可以先讓教學方向變一致
- 這樣不會打斷正在進行的課程

### 2.4 Phase D: Pilot Small Sets

每條課程線先挑 2 到 3 個單元試教。

評估指標：
- 學員能否跟上
- 老師是否需要補充太多口語說明
- 作業是否太跳
- 是否容易和現有教材共存

### 2.5 Phase E: Gradual Rollout

pilot 穩定後，再逐段擴大到整條課程線。

切換順序建議：
1. 作業文字
2. tutor guide
3. grader / rubric
4. 課程頁內容
5. 最後才是完全替換或停用舊版

---

## 3. Starter Track Migration Table

| 優先級 | 單元 | 先改內容 | 暫時不動 | Pilot 備註 |
|---|---|---|---|---|
| P0 | HTML5 Basics | 將作業定位成 BLE 前置條件與手機操作檢查 | 頁面結構與主要教學影片 | 最適合做第一個 pilot |
| P0 | Touch Basics | 統一控制狀態物件與多指輸入模型 | 現有觸控互動示範 | 作為後續控制資料的底座 |
| P0 | Prevent Default | 改成「連線中不被瀏覽器打斷」的情境 | 原本防捲動敘事 | 可和 BLE Async 串成一組 |
| P0 | Data JSON | 改成控制資料 JSON schema 與 payload 規劃 | 目前序列化練習架構 | 適合銜接 Typed Arrays |
| P1 | Flow Logic | 改成控制節奏、timeout、fail-safe | 介面骨架與示範互動 | 需要和 BLE 連線共同說明 |
| P1 | Typed Arrays | 改成 BLE byte packet 與封包 schema | 二進位基礎說明 | 與 BLE Async 連動最強 |
| P1 | BLE Async | 改成正式連線收尾課 | 主要狀態機骨架 | 可作為第二波 pilot |
| P1 | BLE Security | 改成安全上線與相容性排查 | 基本權限教學 | 收尾與部署用 |
| P2 | Long Press | 轉成持續控制與安全停止 | 長按互動骨架 | 與 Flow Logic 合併最好 |
| P2 | Control Panel | 轉成 BLE dashboard 與狀態列 | 版面與元件配置 | 適合與 UI/UX 一起改 |
| P2 | Canvas Joystick | 轉成搖桿值輸出與 debug data | 視覺化範例 | 可接到 Typed Arrays |
| P2 | UI/UX Standards | 轉成 BLE 狀態文案與回饋層級 | 既有設計原理 | 可放到中期批次 |
| P3 | Joystick Math | 轉成封包值與 dead zone | 數學推導主軸 | 是進階控制的中繼站 |
| P3 | Flexbox Layout | 轉成手機優先 BLE 控制面板 | CSS 排版教學 | 可與 Control Panel 合併 |
| P3 | Touch vs Mouse | 轉成輸入意圖統一 | 基礎事件比較 | 可和 HTML5 Basics 一起 pilot |

### Starter 建議 pilot 順序

1. `HTML5 Basics`
2. `Touch Basics`
3. `Data JSON`
4. `Typed Arrays`
5. `BLE Async`
6. `BLE Security`

---

## 4. Basic Track Migration Table

| 優先級 | 單元 | 先改內容 | 暫時不動 | Pilot 備註 |
|---|---|---|---|---|
| P0 | PlatformIO Setup | 改成精準馬達課的開發入口 | 環境安裝細節 | 必須先穩 |
| P0 | ESP32 Architecture | 改成硬體資源與控制邏輯理解 | 架構說明骨架 | 為後面所有單元打底 |
| P0 | Pinout | 改成馬達 / 感測 / 通訊腳位規劃 | 腳位基本介紹 | 很適合做第一批 pilot |
| P0 | PWM Basics | 改成馬達速度控制核心 | PWM 基礎教學 | 最核心的實作底層 |
| P0 | H-Bridge | 改成正反轉、煞車、滑行控制 | 真值表骨架 | 必改，且要盡早 |
| P1 | LEDC Syntax | 改成 motorSetSpeed API 封裝 | LEDC 語法原說明 | 可接 PWM Basics |
| P1 | Response Curves | 改成速度手感與線性/非線性控制 | 曲線比較內容 | 適合和 Joystick Mapping 聯動 |
| P1 | Sampling Rate | 改成控制更新頻率與穩定性 | 資料節流原敘事 | 為閉環控制打底 |
| P1 | FSM | 改成馬達控制狀態機 | FSM 結構 | 是控制主軸之一 |
| P1 | State Consistency | 改成命令版本與 ACK / retry | 原本非同步一致性內容 | 很適合收斂安全性 |
| P1 | Joystick Mapping | 改成速度 / 轉向映射 | 既有映射示範 | 與 Unicycle Model 串接 |
| P1 | Unicycle Model | 改成差速與轉向控制 | 運動學推導 | 進階控制關鍵 |
| P2 | ADC Resolution | 改成類比感測與控制精度 | 解析度教學 | 可做校正作業 |
| P2 | Pull-up & Debounce | 改成啟動 / 停止按鍵可靠性 | 去抖範例 | 可併入控制面板 |
| P2 | Millis | 改成非阻塞控制迴圈 | millis 技巧 | 非常適合做中段 pilot |
| P2 | Hardware Timer | 改成固定週期控制節拍 | timer/ISR 內容 | 對精準控制很重要 |
| P3 | HTTP Request | 改成手機控制命令送往 ESP32 | HTTP 基本概念 | 遠端控制入口 |
| P3 | HTTP Lifecycle | 改成連線延遲與 keep-alive 觀察 | 請求流程內容 | 與實機互動相容 |
| P3 | Async WebServer | 改成控制命令伺服器 | 非同步伺服器骨架 | 可作為實戰中段 |
| P3 | Fetch API | 改成前端送控制命令 | 前端請求範例 | 與 HTTP Request 配對 |
| P3 | CORS Security | 改成前端控制頁安全呼叫 | CORS 原理 | 保持部署可用性 |
| P4 | Wi-Fi AP vs STA | 改成配網與控制模式切換 | AP/STA 原說明 | 遠端控制部署用 |
| P4 | BLE Properties | 改成 BLE read/write/notify 控制層 | BLE 基礎教學 | 進入 BLE 控制重點 |
| P4 | Advertising & Connection | 改成裝置識別與配對入口 | 廣播/連線原理 | 連接實機前關鍵一步 |
| P4 | GATT Structure | 改成控制服務與遙測服務 | GATT 層級說明 | 很適合做正式 schema |
| P4 | BLE Async | 改成收尾版連線與自癒流程 | 連線骨架 | 與 starter 的 BLE 類似但更硬體導向 |
| P4 | BLE Notify | 改成速度 / 狀態 / 警報回報 | Notify 原理 | 可當閉環回饋入口 |
| P4 | BLE MTU | 改成封包分段與控制吞吐 | MTU 知識 | 收尾與效能優化用 |
| P4 | OTA Principles | 改成韌體升級與控制不中斷 | OTA 基本流程 | 上線部署用 |
| P4 | OTA Security | 改成安全更新與版本控制 | OTA 安全機制 | 最後的產品化收尾 |

### Basic 建議 pilot 順序

1. `PlatformIO Setup`
2. `PWM Basics`
3. `H-Bridge`
4. `Joystick Mapping`
5. `FSM`
6. `Millis`
7. `BLE Properties`
8. `GATT Structure`

---

## 5. Advanced Track Migration Table

| 優先級 | 單元 | 先改內容 | 暫時不動 | Pilot 備註 |
|---|---|---|---|---|
| P0 | S3 Interfaces | 改成影像與感測器記憶體管線 | S3 硬體背景說明 | Vision AI 的硬體起點 |
| P0 | Image DMA | 改成低延遲取像與 buffer 管線 | DMA 說明骨架 | 必改，且要早做 |
| P0 | JPEG Quality | 改成畫質 / FPS / 延遲取捨 | JPEG 品質原教學 | 最直接的 Vision AI 入口 |
| P0 | Bandwidth FPS | 改成算力與頻寬預算 | 頻寬分析內容 | 必須先穩定 |
| P0 | MJPEG Stream | 改成即時影像串流基礎 | 串流實作骨架 | 影像入口關鍵 |
| P0 | Video Streaming | 改成編碼選型與延遲比較 | MJPEG/H.264 說明 | 可以和 MJPEG 串接 |
| P1 | Canvas Image | 改成視覺 debug 與 ROI 標註 | Canvas 教學 | 很適合第一批 pilot |
| P1 | Color Spaces | 改成顏色前處理與感知前置 | 顏色空間理論 | Vision AI 前處理核心 |
| P1 | HSV Math | 改成遮罩與目標分離 | HSV 運算內容 | 與 threshold filter 相連 |
| P1 | Threshold Filter | 改成環境適應型視覺閾值 | 濾波骨架 | 很適合做 pilot |
| P1 | Filter Algorithms | 改成去雜訊與穩定化 | 濾波演算法骨架 | 讓偵測更穩 |
| P1 | Feature Extraction | 改成邊緣 / 幾何 / 特徵抽取 | 特徵抽取原敘事 | 進入感知核心 |
| P1 | Centroid Algorithm | 改成目標追蹤與中心點定位 | centroid 計算 | Vision control 的橋樑 |
| P1 | Centroid Error | 改成 error normalization 與 deadzone | 誤差計算 | 直接接控制層 |
| P1 | Look Ahead | 改成路徑前瞻與預測控制 | 預視控制敘事 | 很適合進入自駕主軸 |
| P1 | Chart Canvas | 改成 telemetry dashboard | 圖表骨架 | 可幫助除錯與展示 |
| P2 | Teachable Machine | 改成 gesture / intent classifier | 模型訓練流程 | 先做 AI 概念入口 |
| P2 | MobileNet SSD | 改成物件偵測與障礙物識別 | 模型效能說明 | Vision AI 核心單元 |
| P2 | CNN Audio | 改成聲音輔助意圖 | CNN 音訊概念 | 可視為輔助感知 |
| P2 | WebSpeech API | 改成語音控制與 fallback | 語音辨識原理 | 可作輔助控制 |
| P2 | Sensor Principles | 改成多感測器融合前置 | 感測器原理 | 連到自駕系統整合 |
| P2 | I2C SPI | 改成周邊感測器通訊 | 通訊協定內容 | 硬體整合必要 |
| P2 | Hardware Interrupts | 改成低延遲事件驅動 | 中斷機制 | 對即時控制很有用 |
| P2 | Event Polling | 改成 event-driven 感知流程 | polling 與 event 比較 | 與硬體中斷形成對照 |
| P3 | Data Flow | 改成 end-to-end 感知到控制資料流 | 流程分析 | 系統總覽很重要 |
| P3 | JSON Serialization | 改成 telemetry schema | JSON 序列化 | 產品化的資料底層 |
| P3 | JSON Parsing | 改成感知資料解析與 defensive parsing | 巢狀解析 | 很適合與 API 結合 |
| P3 | JSON REST | 改成 telemetry / command API | REST 協定 | 通往系統化架構 |
| P3 | API Design | 改成 perception / planning / actuation abstraction | API 設計概念 | 橋接架構層 |
| P3 | UI Framework | 改成自駕 dashboard 元件化 | UI 框架內容 | 適合展示與維護 |
| P3 | Refactoring | 改成 clean architecture 與 pipeline 拆分 | 重構教學 | 方便長期維護 |
| P3 | System Perf | 改成 Vision AI 性能 profiling | 效能分析 | 必備產品化指標 |
| P3 | KPI Definition | 改成自駕 KPI 與驗收標準 | KPI 定義 | 可作為 demo gate |
| P3 | Debugging Art | 改成 vision pipeline debugging playbook | 除錯方法 | 非常重要 |
| P3 | Technical Narrative | 改成 Vision AI 作品集與 demo story | 技術敘事 | 結案展示用 |
| P4 | Error Calculation | 改成視覺誤差與控制誤差轉換 | 誤差公式 | 接近控制層 |
| P4 | P Control | 改成第一個可跑的 vision closed-loop | P 控制 | 很適合做 pilot |
| P4 | PWM Limits | 改成控制輸出縮放與飽和 | PWM 限制 | 讓輸出更穩 |
| P4 | Speed Algorithms | 改成速度回授與估測 | 速度量測 | 自駕穩定度關鍵 |
| P4 | ICC Geometry | 改成轉彎幾何與路徑規劃 | ICC 幾何 | 進階控制核心 |
| P4 | Closed Loop | 改成感知到控制的完整閉環 | 閉迴路骨架 | 必做核心單元 |
| P4 | PID Math | 改成離散 PID 與抗雜訊 | PID 數學 | 從 P 走向 PID |
| P4 | PID Control | 改成 PID 自駕控制器 | PID 原理 | 關鍵控制單元 |
| P4 | PID Simulation | 改成模擬調參與驗證 | 模擬流程 | 先模擬再上車 |
| P4 | Robustness | 改成異常資料與 failsafe | robustness 框架 | 收尾前必要 |
| P5 | Flow Control | 改成影像 / 推理 / 控制節流 | flow control | 避免過載 |
| P5 | Code Logic | 改成自駕狀態機與 fail-safe | 程式邏輯骨架 | 系統收斂用 |
| P5 | BLE MTU | 改成低延遲 telemetry 分段傳輸 | BLE MTU | 遠端監控用 |
| P5 | BLE Notify | 改成狀態推送與警報 | BLE Notify | 監控與救援用 |
| P5 | BLE Async | 改成遠端操作與自癒連線 | BLE Async | 收尾與部署 |

### Advanced 建議 pilot 順序

1. `Image DMA`
2. `JPEG Quality`
3. `Threshold Filter`
4. `Centroid Algorithm`
5. `P Control`
6. `Closed Loop`
7. `PID Control`
8. `Robustness`
9. `BLE Notify`
10. `BLE Async`

---

## 6. Common Rollout Rules

1. 先改作業，再改講解，再改頁面。
2. 一次只推一小批單元。
3. 每個 pilot 都要保留舊版可回退。
4. 所有新課綱都先寫成文件，確認後再進 `content-repo`。
5. 不在學期中途做大規模 UI 或章節重排。
6. 若某單元牽涉到授課節奏較深，就先做 tutor guide，不急著改 student guide。

---

## 7. Suggested Internal Rollout Order

### 第一波
- Starter：`HTML5 Basics`、`Touch Basics`、`Data JSON`
- Basic：`PlatformIO Setup`、`PWM Basics`、`H-Bridge`
- Advanced：`Image DMA`、`JPEG Quality`、`Threshold Filter`

### 第二波
- Starter：`Typed Arrays`、`BLE Async`、`BLE Security`
- Basic：`Joystick Mapping`、`FSM`、`Millis`、`BLE Properties`
- Advanced：`Centroid Algorithm`、`Centroid Error`、`P Control`、`Closed Loop`

### 第三波
- Starter：剩餘收尾單元
- Basic：`BLE Notify`、`BLE MTU`、`OTA Principles`、`OTA Security`
- Advanced：`PID Control`、`Robustness`、`BLE Notify`、`BLE Async`

---

## 8. How to Use This Plan

這份文件適合拿來做以下事情：

- 內部教學會議討論
- 課程改版排程
- 單元 pilot 清單
- 作業題目改寫順序
- tutor guide 重寫順序

如果要實際執行，建議先從每條課程線各選一批 pilot 單元開始，跑完後再擴大到下一批。

---

## 9. Related Docs

- [`docs/car-starter-ble-curriculum-plan.md`](./car-starter-ble-curriculum-plan.md)
- [`docs/car-basic-esp32-motor-curriculum-plan.md`](./car-basic-esp32-motor-curriculum-plan.md)
- [`docs/car-advanced-vision-ai-curriculum-plan.md`](./car-advanced-vision-ai-curriculum-plan.md)
- [`docs/course-management-runbook.md`](../course-management-runbook.md)
- [`docs/courses/course-ui-runtime-spec.md`](../../../docs/courses/course-ui-runtime-spec.md)
