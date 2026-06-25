# Cloud Functions Helper Inventory
**Updated**: 2026-06-02  
**Scope**: `functions/index.js` 與 `functions/emailService.js` 中已抽出的共用 helper 清單。

> 這份文件只記錄目前已收斂成 helper 的實作層，外部行為、Firestore schema、email 通知矩陣與分潤/授權規格仍以各自的 domain spec 為準。

## 0. Quick List

最常改、最常查的 helper：

- `normalizeText`
- `normalizeEmail`
- `getUserTutorConfig`
- `buildTutorConfigEntry`
- `buildRevenueSharePolicySnapshot`
- `loadRevenueSharePolicy`
- `collectRevenueShareChainTargets`
- `buildRevenueShareCreditRecord`
- `buildRevenueSharePayoutRow`
- `buildRevenueShareBalanceRecord`
- `buildAssignmentSubmissionRecord`
- `buildGithubAutogradePayload`
- `resolveAutogradeAssignmentDocId`
- `syncAutoGradeInterventions`
- `addAssignmentHistoryEntry`
- `updateActiveAssignmentInterventions`
- `buildShippingContact`
- `buildShippingAddress`
- `renderReminderBlock`
- `renderCtaButton`

> 補充：`assignment / autograde` 與 `revenue sharing` 這兩組 helper 已拆到 `functions/lib/assignment-flow.js` 與 `functions/lib/revenue-sharing.js`，`functions/index.js` 主要負責 orchestration。

## 1. `functions/index.js` Helpers

### 1.1 Input / Normalization
- `normalizeEmail(value)` - Email 去空白與標準化。
- `normalizeText(value)` - 最底層純 trim helper。
- `normalizeGitHubUrl(url)` - GitHub URL 正規化。
- `normalizeLogisticsData(logisticsData)` - 物流欄位整理。
- `normalizeOrderItems(cartDetails, referralLink, referredTutorEmail, lessons)` - 訂單 items 組裝與正規化。
- `normalizeLookupValue(value)` - 一般 lookup key 標準化。
- `normalizeForFirestore(unitId)` - Firestore key 安全化。
- `normalizeCanonicalCourseKey(value)` - canonical course key 正規化。
- `normalizeLocale(locale)` - 課程語系標準化。
- `normalizeCourseFile(value)` - 課程檔名標準化。
- `normalizeCourseVariantKey(value)` - 課程 variant key 標準化。
- `normalizeTemplateRepoName(id)` - template repo 名稱正規化。
- `legacyTemplateRepoNameFromCanonical(id)` - canonical -> legacy template repo 轉換。

### 1.2 Dashboard / Students / Orders
這組 order / logistics helper 已拆到 `functions/lib/order-utils.js`，`functions/index.js` 只保留呼叫點與 orchestration。
`normalizeOrderItems`、`extractReferralAssignmentsFromOrder`、`collectPurchasedUnitIds`、`findMatchingOrderItemIdForReferral`、`itemContainsUnit` 與 `hasActiveOrderForCourse` 已移到 `functions/lib/order-utils.js`，並依 [`docs/order-normalization-plan.md`](order-normalization-plan.md) 的拆分方案完成解耦，將 lesson / canonical / lookup helpers 統一由呼叫點以 `resolvers` 依賴注入傳入。
- `getPhysicalUnitIdSet(lessons)` - 取得實體課程 unitId 集合。
- `isPhysicalOrderItem(itemId, itemData, physicalUnitIds)` - 判斷訂單項目是否為實體商品。
- `buildShippingContact(logistics)` - 組裝收件人聯絡資料。
- `buildShippingAddress(logistics)` - 組裝收件地址。
- `ensureStudentStatsEntry(studentStats, sid, userData, options)` - 初始化學生統計 entry。
- `ensureCourseProgressBucket(studentStatsEntry, cid, options)` - 初始化 course progress bucket。
- `resolveStudentEmailLabel(usersMap, uid, fallbackPrefix, record)` - 解析 dashboard 顯示用 email label。
- `appendCourseProgressActivity(studentStatsEntry, cid, log)` - 累加 course progress 活動。
- `buildDashboardReferenceEntry(usersMap, uid, baseData, fallbackPrefix)` - 組裝 dashboard 參考資料。
- `shouldIncludeDashboardUser(role, requesterRole)` - dashboard user 可見性判斷。
- `addDashboardUserEntry(usersMap, docId, userData, requesterRole)` - 寫入 dashboard user entry。
- `buildTutorList(usersMap)` - 組裝 tutor 清單。
- `buildDashboardSummary(students)` - 組裝 dashboard summary。
- `finalizeHardwareOrders(hardwareOrders)` - 整理硬體訂單資料。
- `buildOrderRecordSummary(...)` - 組裝訂單摘要。
- `buildStudentOrderRecord(order, docId)` - 組裝學生訂單 record。
- `buildPendingShipmentReminderEntry(...)` - 組裝待出貨提醒 entry。

### 1.3 Guards / Validation
- `assertAuthenticated(auth, message)` - 登入檢查。
- `assertAdminRole(requesterRole, message)` - 管理員檢查。
- `assertRequiredValue(value, message)` - 必填欄位檢查。
- `assertAdminOrAssignedTutor(isRequesterAdmin, isAssignedTutor, message)` - 管理員或指派導師檢查。
- `assertTutorApplicationState(appData, { source, status })` - tutor application 狀態檢查。
- `isAssignmentAuthorized(...)` - 作業授權檢查。
- `hasQualifiedTutorStatus(userData, unitId)` - 是否具備單元授權 tutor 資格。
- `hasAnyQualifiedTutorStatus(userData)` - 是否具備任一單元的 tutor 授權（僅供彙總/清單用途）。
- `isTutorFullyQualifiedForCourse(userData, courseId, lessons)` - 是否具備課程層級 tutor 資格。

### 1.4 Tutor / Tutor Applications
這組 helper 的申請紀錄與名稱 / 推薦碼工具已拆到 `functions/lib/tutor-utils.js`，`functions/index.js` 主要負責 handler 與授權流程。
其中 `getEffectiveTutorConfig` / `getUserTutorConfig` / `buildTutorConfigEntry` / `upsertTutorConfigForUser` / `indexAuthorizedTutorConfigForDashboard` 也已移到 `functions/lib/tutor-utils.js`；下列清單保留為跨模組索引。
- `getEffectiveTutorConfig(unitId, tutorConfigs)` - 取得單元有效 tutor config。
- `getUserTutorConfig(userData, unitId)` - 讀取使用者的單元 tutor config。
- `buildTutorConfigEntry(...)` - 建立 tutor config entry。
- `getTutorAssignmentUrlFromConfig(cfg, course, canonicalUnitId, tutorEmail, lessons)` - 統一 tutor assignment URL 讀取與 fallback。
- `upsertTutorConfigForUser(...)` - 寫回 user 的 tutorConfigs。
- `indexAuthorizedTutorConfigForDashboard(...)` - dashboard 用 tutor config 彙整。
- `buildTutorApplicationLegacyEntry(...)` - legacy `users.tutorApplications` snapshot。
- `buildTutorApplicationRecord(...)` - `tutor_applications` 主紀錄。
- `upsertTutorApplicationLegacyEntry(...)` - legacy application snapshot 更新。
- `resolveNameFromUserData(userData, email, authDisplayName)` - 名稱回填。
- `generatePromotionCode(length)` - 推薦碼產生。

### 1.5 Assignment / Autograde
這組 helper 已移到 `functions/lib/assignment-flow.js`，`functions/index.js` 只是消費者。
- `buildAssignmentSubmissionRecord(...)` - 作業提交 record 組裝。
- `buildNativeRepositoryAssignmentRecord(...)` - native repo assignment 組裝。
- `buildGithubAutogradePayload(...)` - GitHub autograde payload 組裝。
- `inferAutogradeUnitIdFromRepo(repoFullName)` - 由 repo 推斷 unitId。
- `rankAutogradeAssignmentStatus(status)` - autograde 狀態排序權重。
- `toComparableTimeMs(value)` - 時間比較用數值化。
- `compareAutogradeAssignmentCandidates(a, b)` - autograde 候選排序。
- `resolveAutogradeAssignmentDocId(...)` - autograde assignment docId 決策。
- `queryActiveAssignmentInterventions(db, assignmentId, studentUid)` - active intervention 查詢。
- `syncAutoGradeInterventions(...)` - autograde 後的 intervention 同步。
- `addAssignmentHistoryEntry(...)` - assignment history 寫入。
- `updateActiveAssignmentInterventions(...)` - active interventions 批次更新。

### 1.6 Revenue Sharing
這組 helper 已移到 `functions/lib/revenue-sharing.js`，`functions/index.js` 只是消費者。
- `round2Amount(n)` - 金額小數點兩位處理。
- `buildRevenueShareCreditRecord(...)` - credit 記錄組裝。
- `buildRevenueSharePayoutRow(...)` - payout row 組裝。
- `buildRevenueShareBalanceRecord(...)` - balance row 組裝。
- `buildRevenueSharePolicySnapshot(policy)` - policy snapshot 組裝。
- `collectRevenueShareChainTargets(...)` - 分潤鏈展開。
- `DEFAULT_REVENUE_SHARE_POLICY` - 分潤預設策略常數。
- `resolveRevenueShareRoleEmails(...)` - 分潤角色 email 解析。
- `loadRevenueSharePolicy(...)` - 分潤策略載入。

### 1.7 Referral / Lesson / Canonicalization
其中 `buildReferralLinkDocId(url)` 與 `normalizeGitHubUrl(url)` 已拆到 `functions/lib/order-utils.js`，此處只作為跨模組引用索引。
其中與訂單 / referral 綁定相關的 `normalizeOrderItems`、`extractReferralAssignmentsFromOrder`、`collectPurchasedUnitIds`、`findMatchingOrderItemIdForReferral`、`itemContainsUnit` 已拆到 `functions/lib/order-utils.js`，下列清單作為跨模組索引。
其中 `hasActiveOrderForCourse` 也已拆到 `functions/lib/order-utils.js`。
- `cleanUnitId(unitId)` - unitId 清理。
- `mapLegacyMasterToCanonical(value)` - legacy master -> canonical 映射。
- `isLegacyMasterPage(value)` - legacy master page 判斷。
- `resolveCanonicalUnitId(unitId, lessons, options)` - canonical unitId 決策。
- `getCanonicalLessonIdentity(lesson)` - canonical lesson identity。
- `findParentCourseIdByUnit(unitId, lessons)` - 由 unit 找 parent course。
- `findCourseByPageOrUnit(pageId, fileName, lessons)` - course 反查。
- `findCourseByUnitId(unitId, lessons)` - 由 unitId 找 course。
- `getLessonLookupKeys(lesson)` - lesson lookup keys。⚠️ 必須加入 `module.exports` 才能被跨 codebase 使用（dashboard-utils-core.js 的 export 遺漏曾導致崩潰）。
- `findLessonByCourseRef(courseRef, lessons)` - courseRef 反查 lesson。
- `resolveLessonForOrderItem(itemKey, lessons)` - 訂單項目對應 lesson。
- `collectPurchasedUnitIds(items, lessons)` - 已購買 unitId 收集。
- `findMatchingOrderItemIdForReferral(items, referralTargetId, lessons)` - referral 對應 order item。
- `extractReferralAssignmentsFromOrder(orderItems, lessons)` - 訂單 referral assignment 抽取。
- `itemContainsUnit(itemKey, lessons, targetUnitId)` - item 是否包含單元。
- `buildReferralLinkDocId(url)` - referral link doc id 組裝。

### 1.8 Time / CORS / Misc
- `toIsoTimestamp(value, fallback)` - ISO timestamp 轉換。
- `formatTaipeiDateTime(value, fallback)` - 台北時間格式化。
- `nowIsoTimestamp()` - 當前 ISO 時間字串。
- `fallbackNameFromEmail(email, defaultName)` - 由 email 推回名稱。

## 2. `functions/emailService.js` Helpers
- `normalizeUnitId(unitId)` - email 內部用 unitId 正規化。
- `buildDashboardUrlForUnit(unitId, tab, tutorMode)` - 單元 dashboard deep link。
- `escapeHtml(value)` - HTML escape。
- `renderInfoCard(rows, options)` - 資訊卡框架。
- `getEmailHtmlWrapper(title, content, footer)` - email 外層 wrapper。
- `renderNextSteps(title, steps)` - 下一步步驟區塊。
- `renderPanel(contentHtml, options)` - 通用 panel wrapper。
- `renderCtaButton(...)` - CTA button。
- `renderActionButton(buttonHtml, marginTop)` - CTA 外層包裝。
- `renderCalloutPanel(...)` - 提示框 / 建議框。
- `buildAutogradeInfoRows(...)` - 自動評分資訊列。
- `buildCourseUnitInfoRows(...)` - 課程 / 單元 / 作業資訊列。
- `buildSingleInfoRow(label, value, { html })` - 單欄資訊列。
- `buildApplicationInfoRows(...)` - 申請資訊列。
- `renderReminderBlock(...)` - 提醒信骨架。

## 3. Maintenance Notes
- 如果新增或重命名 helper，請同步更新：
  - 這份 inventory
  - 對應 domain spec（例如分潤、導師管理、email 通知）
- 如果 helper 只是內部重構，不改對外契約，通常只需更新本文件與相關 domain spec 的 implementation notes。
