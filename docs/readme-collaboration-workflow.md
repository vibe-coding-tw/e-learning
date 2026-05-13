# GitHub Classroom README 協作改善流程

## 目標
讓每個課程單元的 `README.md` 成為單一、可持續改善的作業說明來源。  
目前系統已調整為：`Dashboard > Assignments` 只顯示 GitHub README。

## 角色
- `Student (user)`: 提出閱讀卡點、提交需求不清、驗收標準模糊等問題。
- `Tutor`: 提供教學可用性建議，確保指引可執行。
- `Admin`: 維護規範一致性，審核與合併。

## 建議工作流
1. 開 Issue（使用 `README 改進提案` 模板）
2. 在對應課程 repository 建立 PR 修改 README（建議小步提交）
3. 依 PR template 完成一致性檢查
4. 至少 1 位 Tutor + 1 位 Admin Review 後 merge
5. merge 後在課堂公告或群組同步「本次 README 改動重點」

## 內容改版原則
- 聚焦可執行：看完 README 後，學生應明確知道「現在要做什麼」。
- 明確提交物：列出必交檔案、命名規則、關鍵驗收字串。
- 明確評分標準：自動評分條件、通過門檻、常見失敗原因。
- 降低歧義：避免模糊詞，時間、檔案、步驟盡量具體。
- 小步改版：一次只改一個主題，降低審查與回滾成本。

## 推薦節奏
- 每週固定 1 次 README 維護時段（30-60 分鐘）
- 每次最多處理 3-5 個高影響提案
- 優先順序：
  1. 影響提交正確性的問題
  2. 影響自動評分通過率的問題
  3. 影響新手理解成本的問題

## 完成定義 (Definition of Done)
- README 更新已合併到 `main`
- PR checklist 全部勾選完成
- 至少一位 Tutor 驗證「新手可依 README 完成提交」
- 公告已同步（課堂或社群）

## 變更治理
若改動涉及下列高風險範圍，不應只改 README，需同步開系統變更議題：
- Firestore 欄位/結構
- Dashboard 作業流程
- Autograde payload 與 webhook 規格
- 權限模型（admin/user、tutor status）
