# 導師合作 (Tutor Collaboration) - 03-unit-github-classroom

## 單元簡介

本單元 **`03-unit-github-classroom`（GitHub Classroom 實戰工作流）** 是課程中第一個讓學生「真正動手操作 GitHub Classroom 完整流程」的單元。透過三個由淺至深的任務，學生將建立「雲端 IDE → Commit → 自動評分 → Code Review」的核心工作習慣，為後續所有實作課程打下基礎。

---

## 作業總覽：三個核心任務

| 任務 | 重點技能 | 預計時間 | 自動評分 |
|------|---------|---------|---------|
| 3-1 啟動 Codespaces | 雲端環境、Classroom 邀請流程 | 20 分鐘 | 無（人工審核截圖） |
| 3-2 原子化提交與自動評分 | Atomic Commits、GitHub Actions、Autograding | 30 分鐘 | 有（`tests/lab.test.js`） |
| 3-3 Feedback PR 與 Code Review | Pull Request、Inline Comment、程式審查 | 20 分鐘 | 無（人工審核 PR 連結） |

---

## 導師評核重點與技巧

### ☁️ 任務 3-1：啟動 Codespaces 雲端環境

**常見卡點**：
- 學生點擊邀請連結後找不到「Create codespace」按鈕 → 確認學生已登入 GitHub 且接受組織邀請（前往 [GitHub Settings / Organizations](https://github.com/settings/organizations) 接受）。
- Codespace 初始化失敗 → 建議直接重新建立（Delete → New），通常一次就成功。

**評核標準**：
- 截圖需清楚顯示：① Repo 名稱（含學生 GitHub ID）② Codespaces Terminal 已成功載入（能看到提示符）。
- 若截圖只有 Repo 首頁而無 Codespaces 畫面，請退回要求補充。

**導師提示（L1-L3）**：
- **L1**：「你在 Repo 頁面看到 Code 按鈕了嗎？點擊後有 Codespaces 的 Tab 嗎？」
- **L2**：「若找不到 Codespaces Tab，請確認你是否已接受組織邀請。可以到 GitHub 右上角的鈴鐺確認是否有待處理通知。」
- **L3**：「請前往 https://github.com/settings/organizations，確認 vibe-coding-classroom 組織邀請狀態。」

---

### 🚦 任務 3-2：原子化提交與自動評分

**部署說明**：
- 範本程式庫中的 `src/buggy_code.js` 包含 **刻意設計的 Bug**（例如：陣列排序邏輯錯誤、邊界條件錯誤）。
- `tests/lab.test.js` 預設會因 Bug 而**失敗（紅燈）**，學生必須修正後才能過關。

**評核重點**：
1. **Autograding 過程**：Actions 歷史中**必須有至少一次失敗記錄**，才能證明學生真正理解了「紅燈→修正→綠燈」的循環。若第一次就成功，請詢問是否直接查看了答案。
2. **Atomic Commits**：查看 Commit 歷史，確認有 2 個以上獨立 Commit，且每個 Commit 訊息有意義（如 `fix: correct boundary check`）。單一大型 commit 視為未達標。
3. **評分同步**：Autograding 分數會自動回寫到 Vibe Coding Dashboard。

**常見錯誤**：
- 學生直接 `git commit -m "fix all"` 把所有修改放在一個 Commit → 提示：「請把每個修正分成獨立的 Commit，想像每個 Commit 是一個思考步驟。」
- 學生看不懂 Actions 的錯誤訊息 → 指引他在 Actions 頁面點開 Autograding Job，展開失敗的 Step，閱讀具體的測試錯誤。

**導師提示（L1-L3）**：
- **L1**：「你有看到 Actions 裡 Autograding 的結果嗎？點進去展開看看是哪個測試失敗了。」
- **L2**：「測試錯誤訊息顯示的是 `Expected: X, Received: Y`，表示你的函數回傳值不符合預期。請對照 `tests/lab.test.js` 的測試案例，逆推應該修改什麼。」
- **L3**：「在 `src/buggy_code.js` 第 12 行，`sort()` 預設會按字串排序而非數字。你需要傳入比較函數：`arr.sort((a, b) => a - b)`。」

---

### 💬 任務 3-3：Feedback PR 與 Code Review

**背景**：
- GitHub Classroom 會在學生接受作業後自動建立 **Feedback Pull Request**（從 `feedback` 分支合入 `main`）。這個 PR 是導師與學生進行程式碼對話的主要管道。

**評核重點**：
1. Comment 是否**有實質內容**（不是只寫「我看了」）：理想的評論應說明「這段程式碼做什麼」或「可以怎麼改進」。
2. 若學生沒有看到 Feedback PR → 引導他前往 Repo → Pull requests → 確認是否有 `Feedback` 標題的 PR。若無，可能是 Classroom 設定問題，請聯繫管理員。

**導師後續動作**：
- 收到學生提交後，在 Feedback PR 中**針對學生的最重要 Commit**留下導師自己的 Review Comment，肯定做得好的地方，並對可以改進的地方提供具體建議（而非直接給答案）。
- 對於 Commit 訊息品質差的學生（如 `fix bug`、`update`），在 PR Comment 中鼓勵他們參考 [Conventional Commits](https://www.conventionalcommits.org/) 規範。

**導師提示（L1-L3）**：
- **L1**：「你有找到 Repo 裡的 Pull requests 分頁嗎？裡面應該有一個叫 Feedback 的 PR。」
- **L2**：「進入 Feedback PR 後，切到 Files changed 頁籤，把滑鼠移到任何一行程式碼上，會出現 `+` 按鈕，點它就能新增 Inline Comment。」
- **L3**：「你可以在 Comment 中寫：『這段 `sort((a, b) => a - b)` 的作用是強制讓陣列按數值大小排序，因為 JS 預設的 sort 是字串排序，對數字會產生錯誤結果。』這樣的說明就很有價值！」

---

## 整體評分建議

- **3-1**（30分）：截圖清楚 → 30分；截圖不夠清楚或缺少必要資訊 → 15-20分。
- **3-2**（40分）：Autograding ✅ 且有 2+ atomic commits → 40分；✅ 但只有 1 個 commit → 25分；❌ 仍未通過 → 引導修正後補交。
- **3-3**（30分）：有實質性 Inline Comment → 30分；Comment 過於敷衍（少於 10 字）→ 15分；無 Comment → 0分。

## 重要提醒

本單元的核心不在於「程式寫得多難」，而在於讓學生**建立 Git Workflow 的肌肉記憶**。導師在評核時，應特別關注學生的 **Commit 節奏與訊息品質**，這是區分「有在認真實踐 Vibe Coding」與「只是交差了事」的關鍵指標。
