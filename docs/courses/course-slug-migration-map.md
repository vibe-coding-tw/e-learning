# 課程 Slug 遷移圖

這份文件用來描述 `tw-` / `en-` 前綴是否要從 `content-repo` 的課程檔名中移除，以及如果要移除，應該怎麼分階段進行。

## 結論

目前**不建議直接移除**所有 `tw-` / `en-` 前綴。

原因是整個系統目前仍把這些前綴當成執行期相容欄位，包含：

- Firestore `courseId` / `entryUnitId`
- 課程導覽與權限判斷
- 作業綁定、授權、推薦流程
- grader 與歷史資料回填腳本

直接刪除前綴會讓路由、授權與歷史資料對照一起斷裂。

## 現況

現在的命名其實是雙層語系設計：

- `courses/zh-TW/` 與 `courses/en/` 負責語系目錄層
- `tw-` / `en-` 前綴則還保留在檔名與資料欄位中，當作 canonical 相容鍵

這代表語系責任已經部分分離，但命名還沒有完全中立化。

## 建議目標

建議未來把課程檔名切成「語系目錄 + 語系中立 slug」：

- `courses/zh-TW/common-developer-identity.html`
- `courses/en/common-developer-identity.html`

搭配資料層保留語系別名，做到：

- 內容檔名不再依賴 `tw-` / `en-`
- 舊資料仍可用 alias 對回原課程
- frontend / backend / grader 仍能讀到同一個 canonical lesson id

## 建議遷移順序

1. 先保留現有 `tw-` / `en-` 檔名，不動正式路由。
2. 先在 Firestore 補語系價格與語系別名欄位。
3. 在 `content-repo` 先加新 slug 檔案，保留舊檔案當 alias。
4. 把函式與前端改成優先讀 canonical 中立 slug，再 fallback 舊前綴。
5. 確認 grader、同步腳本、授權流程都完成新 slug 對照後，再移除舊檔名。

## 必須一起改的區塊

如果真的要把前綴移除，至少要一起處理：

- `functions/scripts/sync_firestore_to_emulator.js`
- `functions/scripts/update_prepare_lessons.js`
- `functions/scripts/audit_*` 類腳本
- `functions/lib/assignment-flow.js`
- `public/graders/run.sh`
- `public/learning-path.html`
- `functions/index.js`

原先的一次性 legacy migration 腳本已退役並刪除，這份文件只保留遷移策略與歷史脈絡。

## 風險

這個 migration 最大的風險不是頁面顯示，而是：

- 舊課程連結失效
- tutor / assignment 綁定錯頁
- 一次買課後授權到錯單元
- grader 找不到對應課程 slug
- 歷史訂單與權限無法回填

## 推薦做法

如果目前的目標是「讓多國語言設計風格一致」，最安全的做法不是立刻刪前綴，而是：

- 對外 UI 改成語系中立
- 資料層逐步補 canonical alias
- 檔名改動留到最後一階段

也就是先完成「對外一致」，再完成「底層命名一致」。
