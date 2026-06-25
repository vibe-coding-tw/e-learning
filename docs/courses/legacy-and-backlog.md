# 歷史與 Backlog
**Last updated**: 2026-06-12

這份文件把過去分散在舊的歷史與 backlog 內容，以及部分 `platform-expansion-plan.md` 的重疊內容收斂到單一入口。

## 1. What Is Historical

- 歷史遷移、canonical 化、legacy master 收斂、referral / order key 清理等內容，視為 migration history。
- 若描述的是「已完成的收斂」或「保留做相容的舊路徑」，應放在這一章或各 domain spec 的 implementation notes。

### 已完成的主要收斂
- `orders.items` canonical 清理已完成。
- `referral_links.unitId` canonical 清理已完成。
- `metadata_lessons` 的 canonical course identity 已改為 Firestore document ID（`id` / `docId`），`courseId` 僅保留歷史相容。
- `role` 與 tutor 身分判定已統一為 `admin` / `user` + `users.tutorConfigs[unitId].authorized`。
- **快取優化**：`serveCourse` 雙層快取（記憶體 Map + Firestore `content_cache` 共享快取）已完成部署，防止 GitHub API Rate Limit。
- **安全防護**：課程 Token 綁定學員登入 UID 與 Client IP 機制已完成，防堵付費 Token 外洩。
- **儀表板更新**：`dashboard.js` 串接 Firestore `onSnapshot` 實體長連接，作業狀態即時同步更新。

### 仍保留的相容層
- `mapLegacyMasterToCanonical()` 仍保留給舊網址 redirect 與明確的 legacy token scope。
- `*-master-*` 相關兼容只在歷史流量仍存在時維持。

### 課程頁 shell 恢復規則

> 這一節定義的是「前台應該長什麼樣子」，不是 runtime legacy fallback 的權宜寫法。
> 完整且正式的規格請以 `docs/course-ui-runtime-spec.md` 為準。

- 課程頁的標準外觀必須由課程 shell 直接產生，不能依賴隱藏的 fallback 才看起來正常。
- `top-nav`、語言選擇、FAB、TAB、麵包屑都屬於課程頁標準元件，缺一個就代表 shell 還沒恢復完整。
- `legacy fallback` 只能用在：
  - 舊檔名 / 舊路徑 / 舊內容參照的解析
  - 舊 token scope / 舊歷史資料的相容
  - migration 過渡期的 redirect 或資料補齊
- `legacy fallback` 不能用在：
  - 用來隱藏缺失的 UI 元件
  - 用來猜測 course shell 版型
  - 用來硬塞固定對照表去湊出現有頁面
- `public/learning-path.html` 的 distributor / pricing 解析應以 Firestore `users/{uid}.preferredDistributorId` 為主；未登入或缺資料時才回落到本機 localStorage 與 region 推導。
- `learning-path` 與 checkout 已開始以 `metadata_lessons.id` / `docId` 作為 canonical lesson id；`courseId` 只做顯示與相容。
- `learning-path.html` 的 H1 / `document.title` 與 `nav-component.js` 的 learning-path dropdown label 應共用 Firestore `metadata_settings.learning_paths.categoryLabels`，且不得再有本地 fallback、seed 或快取，避免中文 / 英文版顯示不一致。
- 課程頁若看起來和舊版不一致，優先處理順序是：
  1. 先補齊 content template 的必要節點
  2. 再補齊 `course-shared.js` / `nav-component.js` 的注入與規格化
  3. 最後才考慮是否保留極窄的相容分支
- 語言切換必須仍可從 top-nav 直接操作，且變更後應保留目前課程位置與 `lang` / `locale` 狀態。
- top-nav 的課程名稱必須來自 Firestore course metadata 的 `title` / `titleEn`，不得顯示 sidebar 的目前單元名稱。
- FAB 必須在課程頁可見，除非頁面屬於明確排除清單或正在進行 media mode。Mobile 上頁面滾至底部 150px 內時 FAB 自動隱藏（避免擋住下一頁按鍵），往上滾再出現。
- TAB 必須依 Firestore 與課程內容狀態顯示，不可因為 shell 缺節點就默默消失。
- 麵包屑必須顯示當前課程與目前頁面位置，且在 starter / basic / advanced / prepare 之間保持一致的結構。
- 上方 TAB 與左側 page menu 是不同層級：
  - TAB 顯示 Firestore `courseUnits` 的跨單元導覽。
  - 左側 page menu 顯示目前單元 HTML 的 `window.UNITS`。
- 平台層不得把 Firestore `courseUnits` 寫入 `window.UNITS`、`#sidebar-nav` 或 `#index-unit-list`；這會造成 TAB 與 page menu 重複。
- `serveCourse` 必須使用版本化 runtime script URL，避免 CDN 舊快取讓已部署的 UI 修復仍顯示舊行為。
- 課程卡片 CTA：免費課程未登入時要求登入；非免費課程未登入時仍可加入購物車。

### `referral_links` 退役條件

`referral_links` 目前仍是導師綁定與驗證流程的一部分。若未來要退役，建議先滿足以下條件，再做一次性 migration 與資料驗證：

1. `adminVerifyReferralLink` 不再依賴 `referral_links`，改為直接從可追溯的 tutor / assignment 關聯取得結果。
2. `adminFindClassroomInviteBinding` 與 `adminBindTutorToUnit` 不再需要 URL 索引查詢。
3. 歷史 `orders`、`tutor_applications`、`users.tutorConfigs` 都已完成 canonical 關聯補齊，可重建綁定關係。
4. 需要一份明確的 migration report，列出所有 `referral_links` 文件的去向，並確認沒有任何 active flow 仍在讀取該集合。
5. 若要刪除集合，必須先關閉對應的 webhook / callable 寫入路徑，避免退役後又重新寫回。

## 2. Current Backlog

### P0
- Cloud Functions 模組化重構（將 functions/index.js 拆分至 lib/ 或 controllers/，降低 cold start 延遲） (進行中，未完成)
- Firestore-first runtime cleanup
- Canonical course identity normalization
- Order activation validation
- Unit dashboard hard-rule enforcement

### P1
- Remove duplicate legacy course cards from Firestore
- Learning-path fully metadata-driven
- Course tabs fully metadata-driven
- Content-runtime separation
- Course shell parity audit and restoration

### P2
- 自動評分腳本 `public/graders/` 的 CI 靜態語法檢查與測試工具
- Documentation split: current spec vs migration history
- Master-page retirement plan finalization
- Activation and referral audit tooling

## 3. Primary Acceptance Themes

- Runtime decisions should prefer Firestore over hardcoded compatibility lists.
- Canonical course/unit identity should be consistent across payment, dashboard, referral, and tutor flows.
- Core joins should use Firestore document IDs as the primary key; legacy aliases exist only for migration and compatibility windows.
- Legacy compatibility should remain explicit, narrow, and well-documented.

## 4. Related Files

- `docs/database.md`
- `docs/recursive-sharing.md`
- `docs/tutor-management-mvp.md`
- `docs/platform-expansion-plan.md`
- `functions/index.js`
