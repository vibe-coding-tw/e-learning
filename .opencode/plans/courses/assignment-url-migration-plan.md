# 作業連結欄位遷移計畫
**Updated**: 2026-06-02

> 本文件只描述舊作業邀請欄位的遷移方向與步驟，不改現行對外契約。  
> 目前平台前端已改用 `作業連結` / `作業入口` 等中性文案，但 Firestore schema 仍保留舊欄位以確保相容性。

## 1. 背景

平台已從舊的作業邀請流程切換到原生 GitHub API / 作業倉流程。  
過去以作業邀請流程為語意的欄位名稱仍廣泛存在於：

- `users.tutorConfigs[unitId].githubClassroomUrl`
- `metadata_lessons.githubClassroomUrls`
- `assignments.createdVia` 的 legacy 值
- `tutor_applications.candidateClassroomInviteUrl`

這些欄位目前仍可讀寫，但名稱已經不再符合實際業務語意。

## 2. 目標命名

建議遷移後使用以下更中性的欄位語意：

| 現行欄位 | 建議目標欄位 | 用途 |
| :--- | :--- | :--- |
| `githubClassroomUrl` | `assignmentUrl` | 單一單元的作業派發 / 入口連結 |
| `githubClassroomUrls` | `assignmentUrlMap` | course / unit 對 tutor 的作業連結映射 |
| `candidateClassroomInviteUrl` | `candidateAssignmentUrl` | 候選導師 / 學生提交的作業綁定連結 |
| `classroomUrl`（顯示層 / 內部暫存） | `assignmentUrl` / `repositoryUrl` | 依實際流程分成作業入口或 Native Repo URL |

> 補充：若某筆資料已經是 Native GitHub Repo，應優先使用 `repositoryUrl`；若仍是導師綁定 / 作業入口型連結，則使用 `assignmentUrl`。

## 3. 遷移策略

### 3.1 Phase 1 - Dual Read
- 新程式碼優先讀取新欄位名稱。
- 若新欄位不存在，再 fallback 到舊欄位。
- UI 文案全面改成中性字眼，例如「作業連結」「作業入口」「作業倉」。

### 3.2 Phase 2 - Dual Write
- 新寫入同時寫入新欄位與舊欄位，確保舊流程可讀。
- 新增/更新 API 只面向新欄位，舊欄位僅作兼容同步。

### 3.3 Phase 3 - Backfill
- 透過批次腳本或一次性 Cloud Function：
  - 將 `githubClassroomUrl` 複製到 `assignmentUrl`
  - 將 `githubClassroomUrls` 複製到 `assignmentUrlMap`
  - 將 `candidateClassroomInviteUrl` 複製到 `candidateAssignmentUrl`
- 針對 `classroom.github.com` 與 `github.com/...` 的不同型態，保留原始 URL，不在 backfill 階段改寫語意。
- 目前已先落地最小 backfill 腳本：[`functions/scripts/backfill_tutor_assignment_urls.js`](../../functions/scripts/backfill_tutor_assignment_urls.js)，只處理 `users.tutorConfigs[unitId].githubClassroomUrl -> assignmentUrl`。
- `metadata_lessons` 的第二階段 backfill 已落地：[`functions/scripts/backfill_metadata_lessons_assignment_urls.js`](../../functions/scripts/backfill_metadata_lessons_assignment_urls.js)，會把舊的 `githubClassroomUrls` 補成 `assignmentUrlMap`，並優先保留既有新欄位。

### 3.4 Phase 4 - Cutover
- 切換所有讀取點到新欄位。
- 舊欄位只在 migration fallback 中保留一段過渡期。
- 後台 UI 與文件不再使用舊作業邀請命名。

### 3.5 Phase 5 - Cleanup
- 移除舊欄位的寫入。
- 移除舊欄位的 fallback。
- 將舊欄位標記為 deprecated，保留歷史資料即可。

## 4. 安全邊界

- 不變更既有 Firestore document id。
- 不改 `orders` / `assignments` / `tutor_applications` 的核心契約欄位型別。
- 遷移期間不得刪除舊欄位，直到所有 consumer 已完全切換。
- 若資料流已改成 Native Repo，應以 `repositoryUrl` 為主，不再把它誤稱為舊作業邀請連結。

## 5. 建議實作順序

1. 先完成 UI / 文件的語意統一。
2. 再在 `functions/index.js` 與前端中引入新欄位的 dual read/write。
3. 做一次 backfill。
4. 完成切換後，再移除舊欄位 fallback。

## 6. Related Specs

- `docs/database.md`
- `docs/tutor-management-mvp.md`
- `docs/admin-invite-binding-tool.md`（歷史備查）
- `docs/index-helper-inventory.md`

## 7. Consumer Audit (2026-06-02)

### 7.1 已可直接吃 `assignmentUrl`
這些流程已經優先使用 `assignmentUrl`（部分仍保留 fallback），所以對 `users.tutorConfigs[unitId].githubClassroomUrl -> assignmentUrl` 的 backfill 最敏感：

- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `getLessonsMetadata` 回傳資料已補上 `assignmentUrlMap`，前端可優先讀新欄位，舊的 `githubClassroomUrls` 仍保留相容性。
- [`functions/scripts/backfill_metadata_lessons_assignment_urls.js`](../../functions/scripts/backfill_metadata_lessons_assignment_urls.js) 可把 Firestore 文件本體補上 `assignmentUrlMap`，讓前端不必完全依賴 runtime alias。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `sendTutorAuthorizationEmail` 流程，直接讀 `getUserTutorConfig(tutorData, courseId)?.assignmentUrl`
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `getTutorConfigs` 已改成只輸出 `assignmentUrlMap`，不再回傳 `githubClassroomUrls`。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `getTutorAssignmentUrlFromConfig` 已優先讀 `assignmentUrlMap`。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `resolveAssignmentAccess` 已改成優先讀 `assignmentUrl`，課程層 fallback 也改由共用 helper 取得，避免直接碰舊欄位。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `saveTutorConfigs` 新寫入已優先只寫 `assignmentUrl`，不再把 `githubClassroomUrl` 當成新資料的輸出欄位。
- [`functions/lib/tutor-utils.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/lib/tutor-utils.js) 的 `resolveAssignmentUrlMaps(...)` 集中處理 `saveTutorConfigs` 的舊欄位 fallback，並優先挑選第一個非空的 assignment map，避免主流程散落 legacy 判斷。
- [`functions/lib/tutor-utils.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/lib/tutor-utils.js) 的 `getPreferredAssignmentUrl(...)` 集中處理 `saveTutorConfigs` custom config 的 URL 優先序，避免主流程重複寫 `assignmentUrl || githubClassroomUrl`。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `getTutorConfigs` 目前也直接用 `getPreferredAssignmentUrl(...)`，避免重複組字串時散落相同 fallback。
- [`functions/lib/tutor-utils.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/lib/tutor-utils.js) 的 dashboard synthesis 已移除 `githubClassroomUrls` 的輸出殘影，改只保留 `assignmentUrlMap`。
- [`public/js/dashboard.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/js/dashboard.js) 的 tutor 設定 UI 已優先顯示 `assignmentUrl`，讀取側已移除 `githubClassroomUrls` fallback，儲存側改為雙寫新欄位與兼容 payload。
- [`public/cart.html`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/cart.html) 與 [`public/js/course-shared.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/js/course-shared.js) 已優先讀 `assignmentUrlMap`，並移除對舊的 `githubClassroomUrls` 的 fallback。
- [`functions/emailService.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/emailService.js) 的導師授權 / 推薦候選通知文案已改成中性 `作業連結`，不再在通知內容中稱呼為舊作業邀請流程。

### 7.2 仍需要雙讀 / 舊欄位 fallback
這些流程目前還會讀 `githubClassroomUrl` / `githubClassroomUrls`，所以 backfill 只能解決其中一部分資料缺口，不能單靠 backfill 讓它們完全退場：

- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `saveTutorConfigs` 兼容輸入仍接受舊的 `githubClassroomUrls`，但只在新欄位缺失時 fallback。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `submitTutorRecommendationInviteLink` 已改用 `assignmentLink` 作為主參數名，並保留 `classroomInviteUrl` 舊 key fallback，方便舊前端逐步退場。

### 7.3 結論
- 如果目標是「讓現有新流程拿得到資料」，**需要**做 `users.tutorConfigs[unitId].githubClassroomUrl -> assignmentUrl` backfill。
- 如果目標是「完全移除舊欄位」，**只做 backfill 不夠**，還需要把上面這些 fallback consumers 逐步切成只讀 `assignmentUrl`。

## 8. Naming Cleanup Summary

這一輪除了資料欄位遷移外，也把可安全更名的內部語意一起收斂到 `assignment`：

- `resolveClassroomUrlForTutor(...)` 已改名為 `resolveAssignmentUrlForTutor(...)`。
- `resolveTutorAssignmentUrlMaps(...)` 已改名為 `resolveAssignmentUrlMaps(...)`。
- `getPreferredTutorAssignmentUrl(...)` 已改名為 `getPreferredAssignmentUrl(...)`。
- `submitTutorRecommendationInviteLink` 的主參數已改為 `assignmentLink`，舊的 `classroomInviteUrl` 僅作相容 fallback。
- `public/js/dashboard.js` 的 UI mode/local state 已改成 `assignment` / `legacyAssignmentUrl`，只有送到後端時才保留相容欄位名。
- `functions/lib/tutor-utils.js` 的 dashboard synthesis 已移除 `githubClassroomUrls` 的輸出殘影，只保留 `assignmentUrlMap`。

目前仍保留的 `githubClassroom*` 多半只屬於：

- Firestore 舊欄位名
- migration / backfill / compatibility 入口
- 文件歷史說明

若要真正清掉這些殘影，下一步應優先盤點：

1. 是否還有任何 consumer 需要讀 `githubClassroomUrl(s)`。
2. `saveTutorConfigs` / `submitTutorRecommendationInviteLink` 的舊 key fallback 是否可以再縮到更小範圍。
3. 是否能對舊資料做最後一次 backfill 與 cutover，之後再移除 legacy key。

## 9. Legacy Keep / Remove Checklist

### 9.1 目前建議保留
這些位置還在扮演相容層、契約回傳、或歷史資料讀取角色，暫時不建議直接移除：

- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `resolveAssignmentAccess` 回傳欄位 `classroomUrl`，屬於既有 API 契約。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `submitTutorRecommendationInviteLink` 舊 key `classroomInviteUrl` fallback，屬於舊前端過渡期相容。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `saveTutorConfigs` 舊輸入相容，仍需要接受歷史 payload。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) / [`functions/lib/tutor-utils.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/lib/tutor-utils.js) 內的 `classroomUrl` / `githubClassroomUrl` / `githubClassroomUrls` 兼容讀取，用於舊資料與 backfill 過渡。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `getLessons()`、`getTutorConfigs()`、dashboard synthesis 內部對舊資料的補值與 alias，避免既有 UI / API 直接壞掉。
- [`public/js/dashboard.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/js/dashboard.js) 送出到後端的相容 payload 欄位，用來維持舊資料寫入時的過渡兼容。
- [`public/cart.html`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/cart.html) / [`public/js/course-shared.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/js/course-shared.js) 內部對 `classroomUrl` 的 legacy lesson lookup，仍有部分歷史資料依賴。
- [`functions/scripts/backfill_tutor_assignment_urls.js`](../../functions/scripts/backfill_tutor_assignment_urls.js) 與 [`functions/scripts/backfill_metadata_lessons_assignment_urls.js`](../../functions/scripts/backfill_metadata_lessons_assignment_urls.js)，它們是遷移工具，不是 runtime。
- 文件中的歷史說明與遷移步驟：本文件、[`docs/admin-invite-binding-tool.md`](/Users/roverchen/Documents/Apps/vibe-coding-tw/docs/admin-invite-binding-tool.md)、[`docs/index-helper-inventory.md`](/Users/roverchen/Documents/Apps/vibe-coding-tw/docs/index-helper-inventory.md)。

### 9.2 目前可視為準備移除
這些位置要嘛已沒有實際必要、要嘛只剩殘影，後續可以優先清理：

- [`functions/lib/tutor-utils.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/lib/tutor-utils.js) 與 [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 裡若再出現新的 `classroom` local 變數名，優先改成 `assignment` / `legacyAssignmentUrl`，不要再新增舊命名。
- [`public/js/dashboard.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/js/dashboard.js) 裡若還有任何只存在於 UI state 的 `classroom` 命名，應優先改成中性命名後再保留相容欄位輸出。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `submitTutorRecommendationInviteLink` / `saveTutorConfigs` 舊 key fallback，等前端與歷史資料完全切完後即可收窄。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `resolveAssignmentAccess` 回傳欄位 `classroomUrl`，若外部 consumer 都已切完，後續可考慮加新欄位別名再做完整 cutover。

### 9.3 實務判斷
- **可保留** = 牽涉到 API 契約、歷史資料、backfill、或還有 consumer 讀取。
- **可移除** = 只剩內部命名殘影、已沒有 runtime 依賴、或只是文件歷史說明。
- 在真正移除前，先確認所有 consumer 都已能只讀 `assignmentUrl` / `assignmentUrlMap`。

### 9.4 可排程移除的優先順序

#### 現在就能改
這些多半只是內部命名殘影，且已經有更中性的名稱可以直接替換：

- [`functions/lib/tutor-utils.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/lib/tutor-utils.js) 與 [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 裡新出現的 `classroom` local 變數名，優先改成 `assignment` / `legacyAssignmentUrl`。
- [`public/js/dashboard.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/js/dashboard.js) 裡只存在於 UI state 的 `classroom` 命名，優先改成中性命名後再保留必要的相容欄位。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 裡 `submitTutorRecommendationInviteLink` 的 `classroomInviteUrl` 舊參數名，可在前端全部切完後先改成只留 `assignmentLink`，再另行評估是否還需要 fallback。

#### 等 consumer 全切完再改
這些牽涉到現行 API 契約或既有歷史資料相容，必須等所有 consumer 都不再依賴舊欄位後才可收：

- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `resolveAssignmentAccess` 回傳欄位 `classroomUrl`。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `saveTutorConfigs` 舊輸入相容 fallback。
- [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) / [`functions/lib/tutor-utils.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/lib/tutor-utils.js) 內的舊欄位兼容讀取。

## 10. Execution Checklist

以下順序建議由上往下處理，先收內部命名，再收相容層，最後才動 API 契約：

1. [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 與 [`functions/lib/tutor-utils.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/lib/tutor-utils.js) 的內部 `classroom` local 變數名，全部維持為 `assignment` / `legacyAssignmentUrl`。
2. [`public/js/dashboard.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/js/dashboard.js) 的 UI state / local variable 只保留 `assignment` 命名，避免再新增舊語意殘影。
3. [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `submitTutorRecommendationInviteLink` 舊 key `classroomInviteUrl` fallback，等舊前端完全切完後再移除。
4. [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `saveTutorConfigs` 舊輸入相容 fallback，等歷史 payload 都過渡完成後再收。
5. [`functions/index.js`](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/index.js) 的 `resolveAssignmentAccess` 回傳欄位 `classroomUrl`，最後再評估是否要新增新欄位別名後 cutover。

## 11. Three-Step Todo

如果要用最短路徑收尾，建議只記這三步：

1. 先把內部命名維持成 `assignment` / `legacyAssignmentUrl`，不要再新增任何新的 `classroom` local 變數。
2. 等前端與舊 payload 都過渡完，再移除 `submitTutorRecommendationInviteLink` 與 `saveTutorConfigs` 的 legacy fallback。
3. 最後才評估 `resolveAssignmentAccess` 的 `classroomUrl` API 回傳欄位要不要正式 cutover。
