# Platform Safe Improvement Roadmap
**Last updated**: 2026-06-27

這份文件只列出**不影響 production** 的改善項目。範圍限定為：

- 文件整理
- 本地 / emulator 驗證
- 測試補強
- 重構前置工作

不包含：

- production deploy
- production Firestore 寫入
- production webhook / Actions 變更
- 任何會改變正式使用者路徑的 runtime fallback

---

## 1. 優先順序

### P0

1. **補本地 smoke tests**
   - `serveCourse`
   - `course-shared.js`
   - `nav-component.js`
   - `dashboard.js`
   - `public/graders/*`
2. **補語法與載入檢查**
   - `node --check` for serverless entrypoints
   - browser-side module load sanity check
   - fingerprint 後的 asset path check
3. **把高風險 legacy 路徑標記清楚**
   - 舊 token / 舊 URL / 舊資料欄位
   - 只保留文件與 migration notes，不新增新的 runtime 依賴

### P1

1. **前端 source / artifact 邊界再收斂**
   - 釐清 `src/js` 與 `public/js` 的單一編輯來源
   - 保持 fingerprint 流程，但減少手工維護雙份檔案的機會
2. **後端模組切分前置**
   - 先把共用 helper 繼續往 `functions/lib/` 拆
   - 保持對外 export 不變
   - 先補 wrapper，不直接改行為
3. **文件分層**
   - 現行規格
   - migration history
   - backlog / archive

### P2

1. **CI 補齊 grader 靜態檢查**
   - 專注在語法、檔案存在性、路徑穩定性
2. **整理過時的相容說明**
   - 把已完成的相容路徑明確標為歷史
   - 讓新開發者知道哪些是正式路徑、哪些只是過渡期說明

---

## 2. 建議的安全執行順序

1. 先更新文件索引與 backlog 分類。
2. 再補本地 smoke tests 和語法檢查。
3. 接著做只改內部結構、不改 export 的重構前置。
4. 最後才評估是否要拆更多 domain modules。

---

## 3. 風險控制

- 任何改動都先以本地 / emulator 驗證。
- 不碰 production project、production Firestore、production GitHub Actions。
- 不新增 production fallback 來掩蓋缺失。
- 若某項改善可能影響正式路徑，先停在文件與測試階段。

---

## 4. 可直接對照的現有入口

- [`docs/courses/legacy-and-backlog.md`](./courses/legacy-and-backlog.md)
- [`docs/functions-module-overview.md`](./functions-module-overview.md)
- [`docs/script-retirement-candidates.md`](./script-retirement-candidates.md)
- [`docs/platform-expansion-plan.md`](./platform-expansion-plan.md)
- [`README.md`](../README.md)

