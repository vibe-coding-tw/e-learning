# GitHub Classroom 學生 Repo 同步 PR 流程

## 目的
當單元 template repo（例如 `01-unit-vscode-setup`）更新後，批次對學生 assignment repo 開「同步 PR」，避免學生停留在舊版題目或舊測試。

## 先備條件
- 已安裝並登入 GitHub CLI：`gh auth status`
- 具備學生 repos 的 push / PR 權限
- 本專案腳本：`scripts/sync_classroom_repos.sh`

## CSV 格式
請準備 CSV（可參考 `docs/examples/classroom-sync-sample.csv`）：

- `student_repo`：學生作業 repo（`org/repo`）
- `upstream_repo`：單元 template repo（`org/repo`）
- `base_branch`：學生 repo 目標分支（預設 `main`）
- `upstream_branch`：template 分支（預設 `main`）

## 執行步驟
1. 先 dry-run（不會 push、不會開 PR）
```bash
scripts/sync_classroom_repos.sh --csv docs/examples/classroom-sync-sample.csv
```

2. 確認輸出計畫後，正式執行
```bash
scripts/sync_classroom_repos.sh \
  --csv docs/examples/classroom-sync-sample.csv \
  --apply \
  --pr-label classroom-sync
```

3. 檢查報表
- 腳本會輸出 report 路徑，例如：`/tmp/classroom-sync-xxxx/sync_report_2026-05-13.csv`
- 狀態說明：
  - `opened`：PR 已建立
  - `noop`：學生 repo 已是最新
  - `conflict`：有衝突，需人工處理
  - `error`：clone/push/PR 建立失敗

## 衝突處理建議
1. 在該學生 repo checkout 同步分支
2. 手動解衝突，優先保留學生解答檔
3. push 同步分支，PR 會自動更新

## 風險控制
- 腳本預設 `dry-run`，必須加 `--apply` 才會動作。
- 建議先小批次（3-5 個 repo）驗證流程，再全量跑。
- 若 template 改動包含評分規則，請同步通知 tutor 與學生重跑/重交。

## 與系統自動評分的關係
- 同步 PR merge 後，學生 push 新提交會觸發 GitHub Classroom 內建的自動評分機制。
- GitHub Classroom 會透過 Webhook 將結果直接發送給 Vibe Coding 後端 (`ingestGithubAutograde`)。
- `autograde-and-sync.yml` 等 workflow 定義由學生 / bridge repo 維護，這個 repo 不包含該 workflow 檔案。
- 自動評分結果將回寫至 Firestore `assignments.autoGrade*`，不需在個別 repo 中維護額外的 GitHub Actions workflow。
