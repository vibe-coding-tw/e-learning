# Revisions

## [v1.2.7] - 2026-07-14

### Changed
- **送出後清空 SSID/密碼欄位，重新連線自動帶回 SSID**：`sendConfig()` 成功送出並斷開 BLE 後，清空 `ssidInput`/`passwordInput`。下次按「連線 BLE」重新連線時，`readStatus()` 會從裝置 `status` 端點讀回 `wifi_ssid` 自動填回 SSID 欄位；密碼欄位則維持空白，因為韌體基於安全考量從不透過 `status` 回傳明文密碼，這不是遺漏，是設計上就不回傳。
- **狀態列同時顯示 mDNS 主機名稱與 IP**：`readStatus()` 原本只在 `wifi_state === 'connected'` 時顯示 IP 連結，現在同時顯示 mDNS `.local` 連結（`${app_name}.local`，不論連線狀態都能算出來，因為主機名稱固定等於裝置的 `app_name`）。兩個都給是因為 mDNS 在部分網路環境會解析失敗，IP 是更可靠的備援選項。

## [v1.2.6] - 2026-07-14

### Changed
- **傳送 Wi-Fi 設定後自動斷開 BLE**：`wifi-config.html` 的 `sendConfig()` 原本送出 SSID/密碼後會保持 BLE 連線並延遲 5 秒自動重讀狀態（v1.2.5），但實測透過 serial monitor 發現 ESP32-C3 只有一顆天線，BLE 與 Wi-Fi 共用無線電、靠時間切片共存，若送出設定後持續保持 BLE 連線，會佔用無線電時間干擾 STA 的 WPA 認證交握，導致連線一路逾時重試、永遠連不上（log 出現 `wifi:state: auth -> init` 反覆失敗與 `Coexist: Wi-Fi connect fail, apply reconnect coex policy`）。改為送出設定後等待 300ms（讓韌體端 BLE 回應送完）即主動呼叫 `window.bleClient.disconnect()`，把無線電讓給 Wi-Fi 交握用；並提示使用者等待 15-20 秒後手動重新連線 BLE 查看是否已連上並取得 IP（Web Bluetooth 的配對選擇視窗只能由使用者手動點擊觸發，無法用程式碼自動重連）。移除了原本的 5 秒自動重讀狀態邏輯，因為保持連線本身就是問題根源。

## [v1.2.5] - 2026-07-14

### Added
- **`wifi-config.html` 顯示裝置 IP**：讀取 BLE `status` 端點新增的 `wifi_ip` 欄位（韌體 v1.2.6+），STA 連線成功後顯示在狀態列，並附上可直接點開的 `http://<ip>/` 連結。傳送 Wi-Fi 設定成功後也會自動延遲 5 秒重新讀取一次狀態，讓裝置重新關聯 AP、拿到 DHCP 租約後 IP 能自動浮現，不用手動重新整理。起因：mDNS `.local` 主機名稱在某些網路環境下無法解析，找裝置 IP 只能翻路由器後台，這是目前找到 IP 最直接的管道（透過已連線的 BLE 通道問裝置自己）。

## [v1.2.4] - 2026-07-14

### Fixed
- **D-Pad 鬆手後馬達不停止（觸控裝置 pointerup 遺漏）**：`d-pad.html` 與 `motor-config.html` 內嵌的 D-Pad 都只在按鈕本身監聽 `pointerup`/`pointercancel`/`pointerleave`。觸控裝置上手指快速滑出按鈕範圍時，這些事件有時不會正確送達按鈕本身，導致 `currentThrottle`/`dpadThrottle` 卡在非零值，心跳定時器持續送出「還在按」的指令，鬆手後馬達不會停。新增 `document` 層級的 `pointerup`/`pointercancel` 監聽，加上視窗失焦（`blur`）與切分頁（`visibilitychange`）都會強制送出停止指令，作為按鈕本身事件遺漏時的保險機制。

## [v1.2.3] - 2026-07-14

### Changed
- **Reorganized Motor Config Field Grouping**: `driveTrim`/`driveInverted` moved from the Steering card into the Throttle card (they're drive-axis parameters, previously misplaced), `steeringInverted` moved into the Steering card next to `steeringTrim`, and `deadband` (the one genuinely shared value applied to both axes in firmware) was pulled into its own "共用設定 (Shared)" card instead of living inside Steering by coincidence of layout history. Each axis card is now self-contained (timeout/kick/ramp/limit/trim/inverted all in one place). No element IDs changed, so no BLE/JS wiring was affected.

## [v1.2.2] - 2026-07-14

### Added
- **Steering Ramp Speed Field**: Added a "漸進步長 (Ramp Speed)" input to the Steering section of `motor-config.html` (`steering_ramp_speed`), matching the firmware's newly split per-axis ramp parameter (`motor_config_t.steering_ramp_speed`). Previously ramp speed was shared across both axes, which masked the real bottleneck when tuning steering torque (kick_pwm increases had no visible effect because the shared ramp was too slow to ever reach the kick level during a normal button press).

## [v1.2.1] - 2026-07-14

### Added
- **D-Pad Embedded in Motor Config Page**: Added a live D-Pad control widget directly inside `motor-config.html`, reusing the same BLE connection/service already opened for reading and writing motor calibration (writes to the `motor-control` characteristic `0xff55` via `window.bleClient.writeTo`). Lets you tune `kick_pwm`/`pwm_limit`/etc. and test driving without switching to `d-pad.html` and reconnecting. Added `steering_pwm_limit`/`steering_kick_pwm` input fields to the Steering section to match the firmware's new per-axis motor config fields.

## [v1.2.0] - 2026-07-13

### Changed
- **D-Pad Web Bluetooth Refactor**: Changed the D-Pad controller transmission method to use `writeValueWithResponse` (GATT Write Request) to ensure the ESP32 NimBLE stack triggers the motor control handler, avoiding silent drops of `writeValueWithoutResponse`.
- **Diagnostics Dashboard**: Integrated a real-time diagnostics card inside `d-pad.html` to show battery voltage, low voltage lockouts, wifi/ble status, and verify the motor's command response ok/error.

## [v1.1.0] - 2026-07-11

### Changed
- **GATT Cache Bypass Alignment**: Updated characteristic UUIDs in `wifi-config.html` and `motor-config.html` to align with the new byte-replacement scheme for `protocomm_ble` characteristics (endpoint ID is loaded into bytes[12:13] in little-endian order, shifting the 16-bit UUID to the first group, e.g. `6e40ff51-b5a3-...`).
- **Status Endpoint Read Protocol**: Adjusted `wifi-config.html` to perform a write-then-read pattern when calling the `"status"` endpoint, solving the issue where direct reads returned empty values due to protocomm session cache behavior.
- **Motor Config Page Protocol Refactor**: Rewrote the BLE connection configuration in `motor-config.html` to use the unified protocomm BLE service and switched the transmission protocol from a binary 28-byte array to JSON matching the firmware's `motor_config_t` schema.
