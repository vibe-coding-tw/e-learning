# Vibe Coding: 零元帳單部署與開發規範 (GCP Zero-Cost Rules)

本專案致力於維持在 **Google Cloud Platform (GCP) 永久免費層級 (Always Free Tier)** 之內，請所有開發與部署工作嚴格遵守以下準則：

## 1. 存儲與鏡像管理 (Stop the Artifact Leak)
所有 Artifact Registry 與 Cloud Storage 必須設定自動清理策略，避免歷史累積費用。
- **規則 A**：超過 24 小時的 Docker 鏡像自動刪除。
- **規則 B**：超過 24 小時的 Cloud Functions 部署來源檔與暫存檔自動過期。
- **維護**：定期執行 `gcloud artifacts repositories list` 監控 `asia-east1` 的鏡像存儲量，確保低於 **0.5 GB**。

## 2. 算力資源配置 (Cloud Functions / Run)
雖然有 200 萬次免費調用額度，但計算時長 (GB-秒) 有限。
- **規則 C**：所有函數 `minInstances` 必須設為 **0** (預設)。
- **規則 D**：非計算密集型函數（如權限判斷、簡單 CRUD）記憶體配置上限為 **128MB**。
- **規則 E**：避免在函數內進行大規模循環或長時間連線等待，所有連線超時設定應低於 10 秒。

## 3. AI 模型調度 (Gemini API Efficiency)
為了最大化免費額度並維持高性能，採用「Flash 優先」策略。
- **規則 F**：任務中優先使用 **`gemini-1.5-flash`**。
- **規則 G**：僅在需要進行「超長文本推理」或「極高邏輯複雜度」的任務中才啟用 `gemini-1.5-pro`。
- **緩存機制**：前端或中間層必須實作重複請求緩存，避免相同的輸入重複調用 API 消耗 Token。

## 4. 監控與預警 (Budget Safeguards)
- **硬警報**：專案必須設定 **$1 預算警告**。一旦帳單產生任何變動（即便是 0.01 鎂），開發者應立即收到通知並檢查是否發生資源洩漏。
- **地區鎖定**：核心服務鎖定在 `asia-east1` (台灣)，減少跨區域傳輸費。

---
*最後更新日期: 2026-04-02*
