# examples/

教學範例頁面集合。大部分是獨立的教學展示頁（`hello-world.html`、`joystick.html`、`voice-control.html` 等），跟 e-learning 平台主體（Firebase/Firestore/課程/金流）沒有耦合，可以直接當靜態頁面看待。

## ESP32-C3 遙控車子專案

以下三個頁面屬於同一個獨立的子專案（跟 e-learning 平台本身無關，純粹借用這裡當靜態頁面 host）：

- `d-pad.html` — Web Bluetooth D-Pad 遙控介面
- `motor-config.html` — 馬達參數校正 + 內嵌 D-Pad 即時測試
- `wifi-config.html` — 透過 BLE 幫車輛設定 Wi-Fi SSID/密碼，顯示連線後的 IP/mDNS

這三個頁面透過 Web Bluetooth 直接跟車輛主控板（ESP32-C3）溝通，不經過 Firebase 後端。

**韌體原始碼在另一個獨立 repo**：`esp32c3-vehicle`（github.com/vibe-coding-tw/esp32c3-vehicle）。

找脈絡請看這裡，不要只看程式碼猜：

- **這三個網頁本身的變更記錄**：本 repo 根目錄的 `REVISIONS.md`
- **韌體端的變更記錄**：`esp32c3-vehicle` repo 根目錄的 `REVISIONS.md`
- **韌體目前狀態、已知問題（例如某塊主控板 Wi-Fi 不穩定、轉向軸硬體異常尚未解決）、OTA 更新流程**：`esp32c3-vehicle` repo 的 `.opencode/plans/development.md` 第 6 節「目前狀態、已知問題與操作手冊」

修改這三個網頁時，記得同步在本 repo的 `REVISIONS.md` 補一筆；如果牽涉到韌體端行為（例如 BLE characteristic UUID、JSON schema），要對照 `esp32c3-vehicle` repo 是否也需要同步修改。
