# Autograde Full Automation

## Goal
Make GitHub Classroom grading write back to Vibe Coding automatically with no manual input for `assignmentDocId` or score submission.

## Current architecture (Webhook Based)
- 自動評分系統已全面轉移至 GitHub Classroom 內建的 Autograding Webhook 機制。
- Workflow 定義與觸發條件由各 Classroom / bridge repo 維護，這個 root repo 不包含 `autograde-and-sync.yml`。
- GitHub Classroom Autograding 會在學生 Push 程式碼時自動觸發測試。
- 評分完成後，Classroom 會發送 Webhook (HTTP POST) 到平台的 `ingestGithubAutograde` 雲端函式。
- Backend:
  - `ingestGithubAutograde` 接收 webhook 後，會解析 payload 並將分數回寫至 `assignments` 集合的 `autoGrade` 欄位。
  - 系統會透過 Webhook 內的 repository 等資訊自動解析並比對學生的作業記錄。若配對失敗或存在多筆相同的作業記錄，會回傳錯誤並發送管理員通知信。

## Step 1: Configure Autograding in GitHub Classroom
1. 進入 GitHub Classroom，選擇您的 Assignment。
2. 進入 Assignment 的編輯頁面 (Edit Assignment)。
3. 在 Autograding 區塊，設定好您的自動測試規則 (Tests)。

## Step 2: Configure the Webhook
1. 在同一頁面或 Classroom 的設定中，找到 Webhook 設定。
2. 設定 Payload URL 為您的 `ingestGithubAutograde` 端點 (例如: `https://asia-east1-e-learning-942f7.cloudfunctions.net/ingestGithubAutograde`)。
3. Content type 設定為 `application/json`。
4. 在 Secret 欄位填寫與 Firebase `.env` 中 `GITHUB_WEBHOOK_SECRET` 相同的值。
5. 儲存設定。

## Validation checklist
1. 學生在 Classroom repo 推送 (push) 程式碼。
2. 進入該 repo 的 Actions 頁籤確認 Autograding 成功執行。
3. 進入 Vibe Coding 的 Dashboard 或是 Firebase Firestore `assignments` 集合，確認以下欄位已更新：
   - `autoGrade.score`
   - `autoGrade.maxScore`
   - `autoGradeUpdatedAt`
   - `autoGradeSource`

## Troubleshooting
- 如果評分未觸發：
  - 檢查 GitHub Actions 是否因額度限制或設定錯誤未執行。
- 如果評分成功但 Vibe Coding 未更新：
  - 檢查 Webhook Secret 是否相符。
  - 檢查 Firebase Functions Log (`ingestGithubAutograde`) 是否有報錯。
  - 確認學生的 GitHub 帳號與 Vibe Coding 帳號的連結狀態，或 repository 命名是否正確。
