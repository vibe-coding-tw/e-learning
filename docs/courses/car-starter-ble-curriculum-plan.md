# Car Starter BLE Curriculum Plan
**Last updated**: 2026-06-14

這份文件先不修改任何課程 HTML 內容，而是把目前 `car-starter-*` 15 個 starter 單元整理成一條完整的 BLE 學習路線。

目標是讓學生從「會在手機上操作遙控介面」逐步走到「能安全、穩定地用 Web BLE 控制無人車」，並且在每一個單元的作業裡都留下對下一關有用的產物。

---

## 1. 核心設計原則

1. 先建立同一條主題敘事。
   - 整個 starter track 的主題不是泛前端，而是「用手機透過 Web 介面與 BLE 控制無人車」。
   - 每個單元都要能回答同一個問題：這一關完成後，學生離真正的 BLE 遙控還差哪一步？

2. 先做控制模型，再做 BLE。
   - 先完成觸控、排版、輸出節奏、封包結構。
   - 再進入 `requestDevice()`、`connect()`、`getCharacteristic()`、寫入資料與安全檢查。

3. BLE 練習要分層，不要一次塞滿。
   - 前段以 UI、狀態、輸入模型為主。
   - 中段以資料封包、節奏控制、同步/非同步為主。
   - 後段才是權限、連線、寫入、部署與例外處理。

4. 每個作業都應產出可接續的中間成果。
   - 例如：控制狀態物件、Payload、連線狀態列、錯誤碼處理、測試紀錄。
   - 這樣後一關只需要接續前一關的產物，不會重新發明一套流程。

5. 不先改課程內容。
   - 本文件只定義規劃。
   - 等確認這份路線圖之後，再逐一回寫到 `content-repo` 的 `assignment-guide`。

---

## 2. 15 個單元的 BLE 漸進式路線

### 01. HTML5 Basics

- 現有重點：手機實機預覽、viewport、基礎控制台骨架。
- BLE 練習目標：建立「BLE 連線前的開發環境檢查」概念。
- 作業可加的練習：
  - 在 README 加一段「Web BLE 前置條件」檢查清單。
  - 用文字說明 HTTPS、手機瀏覽器、裝置相容性與同網段測試。
  - 把頁面上的控制台結構先規劃成未來 BLE 面板的區塊。
- 產物：
  - `mobile preview` 截圖
  - `BLE readiness checklist`

### 02. Touch vs Mouse

- 現有重點：touch / mouse 行為一致化。
- BLE 練習目標：把不同輸入來源統一成同一種「控制意圖」。
- 作業可加的練習：
  - 將 `click` / `touchstart` 都輸出成同一個 `controlIntent`。
  - 記錄哪些事件適合最終轉成 BLE 指令。
- 產物：
  - 統一輸入事件表
  - `controlIntent` 資料格式草稿

### 03. Touch Basics

- 現有重點：多指追蹤、座標映射、identifier。
- BLE 練習目標：建立「搖桿與按鈕」的控制狀態模型。
- 作業可加的練習：
  - 左手搖桿、右手按鈕的狀態合併成單一控制物件。
  - 定義哪些值之後要送到 BLE，例如方向、速度、煞車。
- 產物：
  - `controlState` / `inputState` 物件
  - 多指輸入映射表

### 04. Prevent Default

- 現有重點：鎖捲動、鎖縮放、鎖選單。
- BLE 練習目標：讓操作流程不被瀏覽器預設行為打斷。
- 作業可加的練習：
  - 設計「連線中」狀態時的禁用規則。
  - 說明哪些 UI 行為會造成 BLE 操作中斷。
- 產物：
  - 安全鎖定規則表
  - `connecting / connected` UI 行為草稿

### 05. Long Press

- 現有重點：長按、持續觸發、保險機制。
- BLE 練習目標：把「按住才持續有效」的概念套到控制發送。
- 作業可加的練習：
  - 長按前進鍵時，維持控制意圖但不真的連線寫入。
  - 設計 `press-hold -> send loop -> release stop` 的流程圖。
- 產物：
  - 長按控制流程圖
  - 自動停止規則

### 06. Flexbox Layout

- 現有重點：遙控器版面、響應式排列。
- BLE 練習目標：把操作按鈕與連線面板做成手機優先版。
- 作業可加的練習：
  - 讓 `Connect`、`Disconnect`、`Status`、`RSSI` 區塊在手機上可單手操作。
  - 規劃 BLE 狀態列的版面位置。
- 產物：
  - 手機版 BLE 面板草圖

### 07. UI/UX Standards

- 現有重點：拇指熱區、視覺層級、盲操作。
- BLE 練習目標：把連線資訊做成使用者看得懂的狀態語言。
- 作業可加的練習：
  - 連線前、連線中、成功、失敗、重試的顯示文案。
  - 讓學生理解「錯誤提示」也是 BLE 介面的一部分。
- 產物：
  - BLE 狀態文案規格
  - 錯誤提示層級表

### 08. Control Panel

- 現有重點：控制面板、grid 佈局、按壓回饋。
- BLE 練習目標：把 UI 元件和 BLE 狀態機綁在一起。
- 作業可加的練習：
  - 讓按鈕狀態跟 `disconnected / scanning / connected / error` 同步。
  - 在面板上保留一個固定的連線進度區。
- 產物：
  - BLE dashboard skeleton
  - 狀態機對照表

### 09. Canvas Joystick

- 現有重點：Canvas 搖桿、視覺化座標、互動反饋。
- BLE 練習目標：把搖桿輸出值準備成可傳送資料。
- 作業可加的練習：
  - 把搖桿位置映射成標準化數值。
  - 先輸出 debug data，不直接寫入 BLE。
- 產物：
  - `joystick vector` / `speed vector`
  - debug 資料區

### 10. Joystick Math

- 現有重點：歸一化、圓形限制、座標運算。
- BLE 練習目標：建立協定層需要的數值範圍與封包格式。
- 作業可加的練習：
  - 把 `-1 ~ 1` 的搖桿值轉成 `0 ~ 255` 或其他封包值。
  - 設計 dead zone、clamp、轉向與油門的對應規則。
- 產物：
  - 數值轉換規格
  - 封包值範例

### 11. Flow Logic

- 現有重點：重複送指令、multi-key、fail-safe。
- BLE 練習目標：把控制流改成「穩定、可節流、可停機」。
- 作業可加的練習：
  - BLE 寫入頻率節流。
  - 重複操作時避免 GATT busy。
  - 失焦、失連、鬆手時自動停車。
- 產物：
  - BLE send loop 規格
  - fail-safe 行為表

### 12. Data JSON

- 現有重點：資料序列化、payload 瘦身、巢狀狀態。
- BLE 練習目標：先做可讀的控制協定，再準備轉成二進位。
- 作業可加的練習：
  - 用 JSON 表達搖桿、按鈕、模式、速度。
  - 比較長鍵名與短鍵名對資料大小的影響。
- 產物：
  - JSON protocol spec
  - payload size comparison

### 13. Typed Arrays

- 現有重點：`ArrayBuffer`、`Uint8Array`、`DataView`、endianness。
- BLE 練習目標：把控制資料轉成真正能送進 BLE characteristic 的 byte packet。
- 作業可加的練習：
  - 讓 steering / speed / mode 封裝成固定長度封包。
  - 補一個 binary schema 文件，說明每個 byte 的意義。
- 產物：
  - binary packet schema
  - encoder / decoder 草稿

### 14. BLE Async

- 現有重點：`async/await`、`requestDevice`、`connect`、`getPrimaryService`、`getCharacteristic`。
- BLE 練習目標：正式完成 Web BLE 連線流程。
- 作業可加的練習：
  - 建立完整連線狀態機。
  - 重複點擊保護。
  - `Promise.race` timeout。
  - 連線成功後進入寫入狀態。
- 產物：
  - BLE connection flow
  - timeout handling
  - status timeline

### 15. BLE Security

- 現有重點：HTTPS、User Gesture、device filtering、iOS 限制。
- BLE 練習目標：讓學生知道怎麼安全上線與排查相容性。
- 作業可加的練習：
  - 連線失敗排查表。
  - 平台差異紀錄。
  - Device filter 與安全權限驗證。
- 產物：
  - security checklist
  - compatibility report
  - deployment notes

---

## 3. 建議的分階段落地方式

### Phase 1: 先統一敘事

- 把 15 個單元都視為同一個專案的不同階段。
- 每個單元的作業文案，都要能對上「手機遙控無人車」這個主題。
- 不要求每關都真的連 BLE，但要有通往 BLE 的自然銜接。

### Phase 2: 先做中間產物

- 先把控制狀態、封包格式、連線狀態、錯誤提示這些中間資料定義好。
- 這些文件先存在 `README`、assignment guide、tutor guide 或獨立 spec。
- 這樣之後改單元內容時，只是把已定義好的規格搬進去。

### Phase 3: 再回寫課程內容

- 把已定義的 BLE 練習拆回每個單元的 `assignment-guide`。
- 再依語系補齊英文與中文。
- 最後才調整頁面上是否要出現連線說明、封包示意或安全提醒。

---

## 4. 作業設計原則

1. 每關只能新增一個主要 BLE 概念。
   - 例如某關只教「狀態同步」，不要同時塞「連線 + 封包 + 安全」。

2. 讓產物可以接續。
   - `controlState` 可以被 `Flow Logic` 用。
   - `payload schema` 可以被 `Typed Arrays` 用。
   - `connection state machine` 可以被 `BLE Async` 用。

3. 先 debug，再真連線。
   - 先用模擬資料或 console log 驗證資料流。
   - 再接 BLE 寫入。

4. 讓學生理解失敗也是作業的一部分。
   - BLE 很常失敗。
   - 作業應包含 timeout、permission denied、device not found、iOS 不相容等狀況。

5. 一開始不要追求一次就上線實機。
   - 先把整個學習路徑做順。
   - 真正上線可以放在 BLE Async + BLE Security 的收尾階段。

---

## 5. 這份文件後續怎麼用

這份文件的用途不是直接改程式，而是當作以下幾個地方的共同依據：

- `content-repo` 的 `assignment-guide`
- `content-repo` 的 `tutor-guide`
- `docs/course-management-runbook.md`
- `public/graders/` 的評分命名與描述
- `metadata_lessons` 的課程摘要與階段說明

如果後續要開始實作，我建議先從以下順序處理：

1. 先把 `BLE Async` 與 `BLE Security` 的作業目標改成「正式連線收尾」。
2. 再把 `Typed Arrays`、`Data JSON`、`Flow Logic` 補上前置練習說明。
3. 最後回頭檢查前面 1 到 8 關，讓它們都明確對應到同一條無人車主線。

---

## 6. 相關文件

- [`docs/course-management-runbook.md`](../course-management-runbook.md)
- [`docs/course-ui-runtime-spec.md`](../course-ui-runtime-spec.md)
- [`docs/legacy-and-backlog.md`](../legacy-and-backlog.md)
- [`docs/platform-expansion-plan.md`](../platform-expansion-plan.md)
- [`docs/unit-repo-collaboration-workflow.md`](../unit-repo-collaboration-workflow.md)
