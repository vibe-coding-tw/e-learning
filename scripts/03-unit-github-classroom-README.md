# 03-unit-github-classroom：GitHub Classroom 實戰工作流

歡迎來到 GitHub Classroom 實戰單元！本作業旨在讓你親自動手體驗 GitHub Classroom 的核心機制，從啟動雲端 IDE、觸發自動評分，到在 Feedback Pull Request 中進行 Code Review，建立真實的 Vibe Coding 工作流直覺。

## 🚀 快速開始

1. **接受作業邀請**：點擊老師提供的 GitHub Classroom 邀請連結，系統會自動為你建立專屬 Repository。
2. **啟動 Codespaces**：進入你的 Repo 頁面，點擊 `Code` → `Codespaces` → `Create codespace on main`，在瀏覽器中開啟雲端 IDE。
3. **確認環境**：在 Codespaces Terminal 執行以下指令，確認 Node.js 環境正常：
   ```bash
   node --version
   npm install
   npm test
   ```
   > 此時測試預期是「失敗」的（紅燈），這是正常現象。

---

## 📋 任務說明

本作業共三個任務，請依序完成：

### ☁️ 任務 3-1：啟動 Codespaces 雲端環境（20 分鐘）

**目標**：體驗「一鍵啟動雲端開發環境」的 Vibe Coding 基礎設施。

**步驟**：
1. 點擊老師提供的 GitHub Classroom 邀請連結，建立你的專屬 Repository。
2. 進入 Repo，點擊 `Code` → `Codespaces` → `Create codespace on main`。
3. 等待 Codespace 初始化完成（約 1-2 分鐘）。
4. 在 Codespaces 的 Terminal 中執行 `node --version` 與 `npm install`，確認環境正常。

**提交內容**：
- 你的 Codespace 畫面截圖（顯示 Repo 名稱與 Terminal 畫面）。
- 你的 Repo 網址。

---

### 🚦 任務 3-2：原子化提交與自動評分（30 分鐘）

**目標**：體驗「Push → 自動評分 → 紅燈 → 修正 → 綠燈」的完整 Autograding 循環。

**步驟**：
1. 在 Codespaces 中查看 `src/buggy_code.js`，找出並修正程式中的 Bug。
2. 使用**原子化提交 (Atomic Commits)**：每修正一個邏輯點，就執行一次獨立 commit：
   ```bash
   git add src/buggy_code.js
   git commit -m "fix: correct array sorting logic"
   git push
   ```
3. 前往你的 Repo → **Actions** 分頁，觀察 Autograding 工作流的執行結果。
4. 重複「修正 → Push → 查看 Actions」流程，直到 Autograding 出現 ✅ 綠燈。

**提交內容**：
- GitHub Actions 頁面的截圖，顯示 Autograding 測試由 ❌ 轉為 ✅ 的過程。
- 至少包含 **2 個以上**獨立 commit 的 Git 歷史截圖（`git log --oneline`）。

---

### 💬 任務 3-3：Feedback PR 與 Code Review（20 分鐘）

**目標**：練習使用 GitHub 的 Pull Request 功能進行程式碼審查（Code Review）。

**背景**：GitHub Classroom 會在你的 Repo 中自動建立一個名為 **Feedback** 的 Pull Request，這是老師與你的程式碼對話的主要管道。

**步驟**：
1. 進入你的 Repo → **Pull requests** 分頁，找到 **Feedback PR**。
2. 切換到 **Files changed** 頁籤，瀏覽程式碼差異。
3. 對程式碼的**至少一行**進行 Inline Comment（點擊行號旁的 `+` 按鈕新增評論），說明：
   - 這段程式碼的作用是什麼？
   - 你認為有沒有更好的寫法？
4. 提交你的 Review（選擇 `Comment` 即可，不需要 Approve 或 Request changes）。

**提交內容**：
- 你在 Feedback PR 中留下的 Inline Comment 連結（複製 Comment 的永久連結）。

---

## 📤 提交方式

完成以上三個任務後，在 Vibe Coding 平台的本作業頁面點擊「提交作業」，並填寫：
1. 你的 GitHub Repository 網址。
2. 三個任務的截圖或連結（依各任務要求）。

---

## ⚖️ 評核標準

| 任務 | 評核項目 | 配分 |
|------|---------|------|
| 3-1 啟動 Codespaces | Codespace 截圖包含 Repo 名稱與正常 Terminal | 30 分 |
| 3-2 Autograding | Actions 歷史顯示 ❌→✅ 轉換過程；有 2+ 個 atomic commits | 40 分 |
| 3-3 Code Review | Feedback PR 中有至少一條有意義的 Inline Comment | 30 分 |

祝你 Coding 愉快，體驗 GitHub Classroom 的完整工作流！🚀
