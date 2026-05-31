# Autograde Full Automation

## Goal
Make repo grading write back to Vibe Coding automatically with no manual input for score submission.

## Current Architecture (Webhook & Central Grader Based)
- **極簡化 Workflow 設計**：所有學生作業與模板倉庫之 `.github/workflows/autograde-and-sync.yml` 已被極簡化為只包含 Checkout 及單行執行命令：
  `curl -fsSL https://vibe-coding.tw/graders/run.sh | bash`
  這大幅降低了各倉庫 Actions 的維護複雜度，亦確保模板倉庫除 `.github/` 外無其他殘留輔助檔案。
- **中央引導器 (`run.sh`)**：由 CDN 託管的引導器會在 Actions 運行時自動建立沙盒工作區，動態取得對應的單元評分檔 `${VC_UNIT_ID}.sh`。若該單元無特製腳本，則自動降級 (fallback) 採用 `default.sh` 通用評分器。
- **全量評分檔覆蓋 (104 個單元)**：線上 Firebase Hosting CDN 的 `/graders/` 目錄下已全量覆蓋所有 104 個課程單元之評分腳本（包含 VS Code、Flexbox、UI/UX 等 6 個核心活躍單元的客製化檢查，以及其餘 98 個單元的 fallback `default.sh` 複選框檢核器），完全避免了 404 下載失敗報錯。
- **後端 Webhook 簽署與寫入 (`ingestGithubAutograde`)**：
  - 評分腳本輸出分數後，`run.sh` 會組裝 JSON Payload，並用 `VC_AUTOGRADE_TOKEN` 進行 HMAC-SHA256 簽署，透過 Header `X-Hub-Signature-256` POST 回傳給雲端函式。
  - 後端 `ingestGithubAutograde` 驗簽成功後，會以 `assignmentDocId` 優先或 `userId + unitId` (採 `unitId-first` 自動去除 `.html` 後綴對齊) 定位 Firestore `assignments` 集合對應的作業紀錄並寫入 `autoGrade` 欄位（分數、時間、Sha、Run URL 等）。
  - **TutorMode 特例**：Tutor 測試單元時，前端不會寫入 `status=started` 的 assignments 文件，以避免干擾付費授權邏輯及產生測試噪音。

## Actions 額度受限之本地/沙盒評分機制 (Local Sandbox Grader)
當學生的 Classroom 組織面臨 Actions 額度耗盡或付費逾期等限制，無法在 GitHub 上觸發 Actions 時，管理員可使用本地/沙盒評分腳本進行批次更新與回寫：
- **批次評分腳本**：[`grade_all_students.js`](file:///Users/roverchen/.gemini/antigravity/brain/baad103e-f43a-454f-ade1-5e28f917cf42/scratch/grade_all_students.js)。
- **運作原理**：
  1. 呼叫 Firebase Secret API 提取 `GITHUB_API_TOKEN`，以便動態且安全地 clone 私有的學生作業倉庫。
  2. 向 Firestore 查詢當前所有綁定 `vibe-coding-classroom` 倉庫的學生 assignment 文件。
  3. 批次 clone 學生倉庫，利用單元名稱正規化（相容歷史 / 轉換至 canonical ID）定位對應的 `.sh` 評分檔案。
  4. 於本地/沙盒的 cloned 倉庫目錄下執行評分，並擷取分數 stdout。
  5. 以系統的 Webhook Secret 計算 HMAC-SHA256 簽署，POST 至 API 回寫，直接透過 `assignmentDocId` 進行精準的分數與狀態變更，無需依賴 GitHub 端 Actions。

## Step 1: Configure Autograding in the Unit / Student Repo
1. 學生倉庫或模板倉庫只需要在 `.github/workflows/autograde-and-sync.yml` 寫入極簡版的引導配置：
   ```yaml
   name: Classroom Grade + Sync
   on: [push]
   jobs:
     grade_and_sync:
       runs-on: ubuntu-latest
       steps:
         - name: Checkout code
           uses: actions/checkout@v4
         - name: Run Central Grader
           env:
             VC_USER_ID: ${{ vars.VC_USER_ID }}
             VC_UNIT_ID: ${{ vars.VC_UNIT_ID }}
             VC_AUTOGRADE_URL: ${{ secrets.VC_AUTOGRADE_URL }}
             VC_AUTOGRADE_TOKEN: ${{ secrets.VC_AUTOGRADE_TOKEN }}
           run: |
             curl -fsSL https://vibe-coding.tw/graders/run.sh | bash
   ```

## Step 2: Configure the Webhook (Optional for direct Webhooks)
1. 在同一頁面或 repository 的設定中，找到 Webhook 設定。
2. 設定 Payload URL 為您的 `ingestGithubAutograde` 端點 (例如: `https://asia-east1-e-learning-942f7.cloudfunctions.net/ingestGithubAutograde`)。
3. Content type 設定為 `application/json`。
4. 在 Secret 欄位填寫與 Firebase `.env` 中 `GITHUB_WEBHOOK_SECRET` 相同的值。
5. 儲存設定。

## Validation Checklist
1. 學生在對應作業 repo 推送 (push) 程式碼，或者管理員執行本地沙盒評分。
2. 進入該 repo 的 Actions 頁籤確認 Autograding 成功執行（若是使用沙盒評分則免除此步驟）。
3. 進入 Vibe Coding 的 Dashboard 或是 Firebase Firestore `assignments` 集合，確認以下欄位已更新：
   - `autoGrade.score`
   - `autoGrade.maxScore`
   - `autoGradeUpdatedAt`
   - `autoGradeSource`
4. 到該學生作業 repo 的 Settings -> Secrets and variables -> Actions -> Variables，確認有：
   - `VC_USER_ID`
   - `VC_UNIT_ID`

## New Repo Bootstrap (Native student repos)
當平台產生新的學生作業 repo 時，Template 不會自動繼承 Secrets。建議使用批次腳本補齊設定：

1. 準備 mapping CSV（含 header）：
   - `repo,unit_id,user_id`
2. 先 dry-run：
   - `scripts/bootstrap_classroom_repo_autograde.sh --dry-run <csv_path>`
3. 正式套用：
   - `scripts/bootstrap_classroom_repo_autograde.sh --apply <csv_path>`

腳本行為：
- 會依 `unit_id` 套用對應模板：
  - `scripts/workflow-templates/<unit_id>.yml`
  - 找不到則 fallback `scripts/workflow-templates/default.yml`
- 套用位置：`repo/.github/workflows/autograde-and-sync.yml`
- 會寫入 Variables：
  - `VC_USER_ID`
  - `VC_UNIT_ID`
- Secrets 檢查：
  - 若 repo 已有 `VC_AUTOGRADE_URL` + `VC_AUTOGRADE_TOKEN`：通過
  - 若缺少且有提供環境變數 `VC_AUTOGRADE_URL_VALUE` / `VC_AUTOGRADE_TOKEN_VALUE`：自動寫入
  - 若缺少且未提供環境變數：報表標記 `missing_secrets`（需由 org-level shared secret 或手動補齊）

### Firestore source-of-truth scope (important)
- `unit_id`、課程結構、授權與作業紀錄來源皆以 Firestore 為準。
- `VC_USER_ID` + `VC_UNIT_ID` 可直接由課程/使用者關聯取得，不依賴單一 task doc。
- `missing_mapping` 不代表錯誤，代表目前缺少 `user_id` 或 `unit_id` 對應資料。
- 建議策略：
  1. 新 repo 先補齊 workflow + secrets。
  2. 等學生首次建立作業後，回寫邏輯會依 `userId + unitId` 自動定位最新作業。

## Low-cost automation strategy (recommended)
為避免浪費 GitHub Actions，建議採用「事件驅動 + 每日補漏」：

1. 事件驅動（主流程）
   - 建立 `repository_dispatch` 事件：`classroom_repo_created`
   - payload 至少帶：`repo`, `unit_id`
   - 可選帶：`user_id`
   - 收到事件後只處理「單一新 repo」，成本最低

2. 每日補漏（保險）
   - 排程 workflow 每日跑一次
   - 只處理 Firestore 匯出中「已具 mapping」的 repo（非全量硬跑）

對應 workflow：
- `.github/workflows/autograde-bootstrap-automation.yml`
- `.github/workflows/autograde-bridge-daily-audit.yml`（每日稽核 104 bridge repos 的 workflow/secrets/variables 一致性）
- 需要在此管理 repo 的 Secrets 設定：
  - `VC_AUTOGRADE_URL`
  - `VC_AUTOGRADE_TOKEN`

## Auto-generate token and distribute (secure flow)
若要避免手動建立 token，可使用腳本自動生成並分發到所有目標 repos：

1. 先 dry-run（不寫入）：
   - `scripts/generate_and_distribute_autograde_token.sh --dry-run docs/examples/autograde-repo-mapping.firestore.csv`

2. 正式執行（會生成新 token 並寫入每個 repo 的 `VC_AUTOGRADE_TOKEN`）：
   - `scripts/generate_and_distribute_autograde_token.sh --apply docs/examples/autograde-repo-mapping.firestore.csv`

3. 會輸出兩個檔案：
   - 報表（/tmp/*.csv）
   - token 檔（/tmp/*.txt，權限 600）

4. 將同一 token 同步設到系統後端驗簽來源（例如 Cloud Functions / Secret Manager）後，分數回寫才會通過驗簽。

## Troubleshooting
- 如果評分未觸發：
  - 檢查 GitHub Actions 是否因額度限制或設定錯誤未執行。
- 如果評分成功但 Vibe Coding 未更新：
  - 檢查 Webhook Secret 是否相符。
  - 檢查 Firebase Functions Log (`ingestGithubAutograde`) 是否有報錯。
  - 確認學生的 GitHub 帳號與 Vibe Coding 帳號的連結狀態，或 repository 命名是否正確。
