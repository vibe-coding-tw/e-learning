# Database Schema (Firestore)

本文檔記錄 Vibe Coding 平台 Firestore 結構，基於目前線上系統實作。

## 1. `users` 集合 (核心)
儲存所有使用者（學生 / 導師 / 管理員）的個人資料、權限與學習狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `uid` | string | Firebase Auth UID。 |
| `email` | string | 使用者 Email。 |
| `name` / `displayName` | string | 顯示名稱。 |
| `photoURL` | string | 頭像連結。 |
| `role` | string | 系統角色：僅 `admin` 或 `user`。 |
| `tutorConfigs` | map | Tutor 單元授權狀態。Key 為 unitId，常見欄位：`authorized`, `assignmentUrl`, `courseId`, `updatedAt`。`assignmentUrl` 現行代表作業派發連結；歷史舊作業邀請 URL 僅作相容。若要正式遷移欄位命名，請參考 [`docs/assignment-url-migration-plan.md`](assignment-url-migration-plan.md)。 |
| `tutorApplications` | array | 該使用者申請紀錄快照（部分流程使用）。 |
| `hasPendingApplication` | boolean | 是否有待審導師申請。 |
| `unitAssignments` | map | 學生單元指派導師。Key = unitId，Value = tutorEmail。 |
| `unitAssignmentMeta` | map | 學生單元綁定資訊。Key = unitId，常見欄位：`tutorUid`, `tutorEmail`, `promotionCode`, `linkedAt`。 |
| `promotionCode` | string | Tutor 專屬 Promotion code（全域唯一）。 |
| `locale` | string | 使用者語系（例：`zh-TW`）。 |
| `region` | string | 使用者地區（例：`TW`）。 |
| `courseProgress` | map | 學習進度聚合資料。 |
| `orders` | array | 主要為 Dashboard 聚合回傳欄位，非主要持久化來源（實際訂單以 `orders` 集合為準）。 |
| `payoutAccount` | string | 分潤收款帳號（可選；未填時分潤 credit 會累積但不會月結支付）。 |
| `updatedAt` | timestamp | 最後更新時間。 |
| `createdAt` / `joinedAt` | timestamp | 建立時間。 |

> 註：Tutor 不是 `role`，而是 `tutorConfigs[unitId].authorized === true` 的狀態。

---

## 2. `orders` 集合
儲存付款訂單與後續履約狀態。平台收款由系統統一處理，實體商品履約則由經銷商 / 履約夥伴負責。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `orderNumber` | string | 系統訂單編號（如 `VIBE...`）。 |
| `uid` | string | 購買者 UID。 |
| `amount` | number | 交易金額。 |
| `status` | string | 目前主流程實際寫入 `PENDING`, `SUCCESS`（`FAILED` 保留為擴充狀態）。 |
| `items` | map | 訂單項目。Key 為 itemId，value 可含 `name`, `price`, `quantity`, `isPhysical`。 |
| `gateway` | string | 付款閘道（例如 `ECPAY`）。 |
| `region` | string | 訂單地區（例：`TW`）。 |
| `channelType` | string | 訂單渠道類型（例：`direct`, `agent`）。 |
| `policyId` | string | 分潤政策識別碼（供月結計算讀取）。 |
| `pricingVersion` | string | 價格版本識別碼（供定價追蹤）。 |
| `paidAt` | timestamp | 付款完成時間。 |
| `paymentDate` | string | 金流回傳付款時間字串。 |
| `expiryDate` | timestamp | 課程權限到期時間。 |
| `activationValidated` | boolean | 付款成功後是否已完成課程開通驗證。 |
| `activationValidationStatus` | string | 開通驗證狀態：`passed`, `failed`, `error`。 |
| `activationValidationFailed` | boolean | 開通驗證是否失敗。 |
| `activationAlerts` | array | 開通驗證失敗時的可讀警示訊息。 |
| `activationCheckedItems` | array | 每個訂單項目的 mapping / 授權檢查結果。實體商品會標記但不要求 `courseUnits`。 |
| `activationValidatedAt` | timestamp | 最近一次開通驗證時間。 |
| `fulfillmentType` | string | 履約模式，建議固定為 `distributor`。 |
| `fulfillmentPartnerId` | string | 履約經銷商 / 合作夥伴識別碼。 |
| `fulfillmentPartnerName` | string | 履約夥伴名稱。 |
| `fulfillmentRegion` | string | 履約地區（如 `TW`, `SG`, `US-West`）。 |
| `fulfillmentStatus` | string | 履約狀態（如 `PENDING`, `ASSIGNED`, `ACCEPTED`, `SHIPPED`, `DELIVERED`）。 |
| `fulfillmentAssignedAt` | timestamp | 平台派單時間。 |
| `fulfillmentAcceptedAt` | timestamp | 經銷商接單時間。 |
| `fulfillmentShippedAt` | timestamp | 經銷商出貨時間。 |
| `trackingNumber` | string | 物流追蹤號碼。 |
| `carrier` | string | 承運商或配送方式。 |
| `shippingCost` | number | 實際履約成本。 |
| `handlingFee` | number | 經銷商處理費 / 履約費。 |
| `fulfillmentNotes` | array | 履約異常、缺貨、改派等備註。 |
| `logistics` | map | 物流資料（門市/收件資訊，支援 ECPay CVS 及國際直郵結構）。 |
| `logisticsMissing` | boolean | 實體商品訂單付款後物流資料不完整時的警示旗標。 |
| `ecpayTradeNo` | string | 綠界交易編號 (僅於 gateway 為 ECPAY 時存在)。 |
| `stripePaymentIntentId` | string | Stripe 交易之 Payment Intent ID (僅於 gateway 為 STRIPE 時存在)。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

> 購物車不再輸入 Promotion code / 推薦連結。  
> 導師綁定在作業頁進行，並寫入 `users.unitAssignments` 與 `users.unitAssignmentMeta`。
> 實體商品下單會在 `initiatePayment` 驗證物流必要欄位（收件人、電話、門市/地址）；若歷史資料或例外流程造成缺漏，`paymentNotify` 會標記 `logisticsMissing=true` 供後台追蹤。
> `fulfillmentStatus` 現在代表「經銷商 / 履約夥伴」的工作流狀態，不再單純等同於平台直送狀態。
> **重複購買限制**：`initiatePayment` 在建立新訂單前，會自動檢查學員已成功付款且未到期的線上課程訂單（`expiryDate > now`）。若偵測到購物車中有學員已擁有的未到期課程，後端會直接拒絕交易並回傳錯誤訊息，阻止重複付款。
> **付款後開通驗證**：`paymentNotify` 寫入 `SUCCESS` 後會立即檢查每個數位課程項目是否能解析到 canonical course、是否具備 `courseUnits`，並用共用授權邏輯確認學生可通過課程授權。失敗時會寫入 `activationAlerts` 並寄送 Admin 告警。實體商品不要求 `courseUnits`。

---

## 3. `metadata_lessons` 集合
儲存課程與單元元資料。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `courseId` | string | 課程唯一識別碼。 |
| `title` | string | 課程/單元標題。 |
| `courseUnits` | array | 該課程包含的單元 HTML 檔列表。 |
| `price` | number | 價格（0 代表免費）。 |
| `category` | string | 課程類別（如 `prepare`, `start`, `basic`, `advanced`）。 |
| `isPhysical` | boolean | 是否為實體商品。 |
| `orderWeight` | number | 排序權重。 |
| `metadataType` | string | 元資料類型：`course` / `product` / `legacy_product`。 |
| `productId` | string | 商品識別碼（商品型 metadata 使用）。 |
| `pricing` | map | 多地區定價主欄位。建議使用 `tw` / `en`，各值格式為 `{ amount, currency }`。 |
| `priceByLocale` | map | 語系定價別名。建議使用 `zh-TW` / `en`。 |
| `priceByRegion` | map | 區域定價別名。建議使用 `tw` / `en`。 |
| `priceMap` | map | 舊版/相容定價別名，前端與後端都會讀。 |
| `prices` | map | 簡化定價別名，通常對應 `tw` / `en` 的純金額。 |
| `price_twd` | number | 相容欄位，台幣金額。 |
| `price_usd` | number | 相容欄位，美金金額。 |
| `currency` | string | 預設幣別，通常保留 `TWD`。 |
| `hiddenFromCatalog` | boolean | 是否從課程/商品列表隱藏（保留歷史資料時使用）。 |
| `isDeprecated` | boolean | 是否為已廢止舊資料（保留對帳/歷史用途）。 |

> 重要：課程授權判斷（包含免費課程 `price=0`）以 `metadata_lessons` 為唯一來源（Source of Truth）。
> 不再依賴硬編碼單元白名單。
> 所有執行期資料比對（包含邀請連結、課程授權、單元歸屬）都必須直接查 Firestore，禁止使用程式碼內相容名單或 fallback 白名單。
> `metadata_lessons` 可同時承載課程與部分商品 metadata。判斷時請以 `metadataType`/`isPhysical` 區分用途，不可假設所有 `courseId` 都是課程頁檔名。
>
> 2026-06-03 價格規則更新：
> - 課程與硬體商品皆採用多地區定價欄位，前端與後端不做匯率換算。
> - 中文/TW 頁面讀取 `pricing.tw`，英文/US 頁面讀取 `pricing.en`。
> - 推薦寫法為同時保留 `pricing`、`priceByLocale`、`priceByRegion`、`priceMap` 與 `price_twd` / `price_usd`，以維持舊資料相容。
> - 目前課程標準價：入門 `TWD 1200 / USD 40`、基礎 `TWD 1500 / USD 50`、進階 `TWD 1800 / USD 60`。
>
> 2026-05-16 更新：
> - `ai-agents-vibe.courseUnits` 已切換為 `02-unit-agent-mode.html`, `02-unit-web-agents.html`, `02-unit-vibe-coding.html`
> - `github-classroom.courseUnits` 已整併為 `03-unit-github-classroom.html`

### `metadata_lessons` 新增與整合欄位（已實作）

下列欄位已於 2026-05-27 系統升級中正式實作與啟用，用以取代傳統的 `*-master-*.html` 頁面：

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `courseKey` | string | 課程的 locale-neutral 穩定主鍵，例如 `common-vscode-setup`、`car-starter-web-app`；取代對 HTML 檔名與語系前綴的直接依賴。 |
| `track` | string | 課程主軸，例如 `common`、`car`。 |
| `level` | string | 課程層級，例如 `common`、`starter`、`basic`、`advanced`。 |
| `entryUnitId` | string | 課程入口單元 ID，用於取代 `*-master-*` 頁面的進入責任（2026-05-30 起統一修正並指向課程的第一個單元，即 `courseUnits[0]`）。 |
| `contentRef` | string | 對應外部內容倉的內容路徑，例如 `courses/zh-TW/car-starter-html5-basics.html`。 |
| `i18n` | map | 可選的多語內容設定，例如各語系內容路徑或語系可用性資訊。 |
| `learningPathLabel*` / `categoryLabel*` / `navLabel*` | string | 學習路徑分類顯示名稱。前端會優先讀取 Firestore / lesson metadata，而不是在程式碼中寫死。 |

### `metadata_lessons` 英文多語系欄位（i18n Content Fields）

下列欄位於 2026-05-30 新增，供英文使用者在課程目錄頁看到對應的英文課程資訊。
**命名約定**：延續 `learningPathLabelEn` / `navLabelEn` 已有慣例，一律以 `*En` 後綴表示英文版欄位。

| 欄位名稱 | 類型 | 中文對應欄位 | 說明 |
| :--- | :--- | :--- | :--- |
| `titleEn` | string | `title` | 課程英文標題（必填，優先級最高）。 |
| `summaryEn` | string | `summary` | 課程英文摘要（一句話簡介）。 |
| `descriptionEn` | string | `description` | 課程英文詳細說明（較長）。 |
| `coreContentEn` | array | `coreContent` | 核心學習內容英文列表（對應中文 bullet list）。 |
| `lessonLabelEn` | string | `lessonLabel` / `tagText` | 課程分類標籤英文（藍色 badge 顯示）。 |

**使用規則**：
- 前端（`learning-path.html`）在英文模式（`uiLocale === 'en'`）下優先讀取 `*En` 欄位，若欄位不存在則 fallback 到中文欄位。
- `getLessonsMetadata` Cloud Function 直接傳回 Firestore 文件所有欄位，**不需要後端修改**即可生效。
- 欄位維護透過 `admin-i18n.html` 管理頁面，呼叫 `updateLessonI18n` Cloud Function 寫入。

執行期 canonical identity 規則：
- 課程型 metadata：優先使用 locale-neutral `courseKey`
- 商品型 metadata（`metadataType=product|legacy_product` 或 `isPhysical=true`）：優先使用 `productId`
- `courseId` 保留作為頁面入口 / 歷史相容欄位，不再作為所有執行期判斷的唯一主鍵
- `contentRef` / 頁面路由仍可保留 `tw-*` 檔名；`courseKey` 與頁面檔名是分離的兩個概念

參考模板：
- `docs/examples/metadata-lessons-migration-template.csv`
- `docs/examples/metadata-lessons-pricing-template.csv`

---

## 4. `assignments` 集合
儲存學生作業提交與評分狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `userId` / `uid` | string | 學生 UID。 |
| `userEmail` / `studentEmail` | string | 學生 Email。 |
| `courseId` | string | 課程識別碼。 |
| `unitId` | string | 單元 ID。 |
| `assignmentTitle` | string | 作業標題。 |
| `assignmentId` | string | 作業識別碼（常與 `userId` 組合成文件 id）。 |
| `assignmentUrl` | string | 學生提交 / 作業派發連結（GitHub / Demo；歷史舊作業邀請 URL 僅作相容）。若未來要將舊欄位正式遷移，請依 `assignment-url-migration-plan.md` 先做 dual read/write。 |
| `repositoryUrl` | string | 自建作業 GitHub 倉庫連結（API 創庫）。 |
| `repositoryName` | string | 自建作業 GitHub 倉庫名稱。 |
| `feedbackPullRequestUrl` | string | 學生作業 Feedback Pull Request 連結。 |
| `createdVia` | string | 建立來源種類：`native-api` 或 `legacy-classroom`（舊作業邀請流程）。 |
| `studentNote` | string | 學生備註。 |
| `assignedTutorEmail` | string | 該作業對應導師。 |
| `currentStatus` | string | `started` / `submitted` / `graded`。 |
| `grade` | number | 分數。 |
| `tutorFeedback` | string | 導師評語。 |
| `autoGrade` | map | GitHub 自動評分結果（常見欄位：`score`, `maxScore`, `status`, `source`, `runUrl`, `workflow`, `commitSha`, `repository`, `actor`, `summary`, `updatedAt`）。 |
| `autoGradeSource` | string | 自動評分來源（MVP 為 `github_actions`）。 |
| `autoGradeUpdatedAt` | timestamp | 最近一次自動評分更新時間。 |
| `autoGradeRaw` | map | 原始分數/狀態回寫快照（便於追蹤 webhook payload）。 |
| `submissionHistory` | array | 作業歷程（START / SUBMIT / GRADE / AUTO_GRADE）。 |
| `submittedAt` / `updatedAt` | timestamp | 提交/更新時間。 |

作業 docId 規則與回寫關聯：
- 建議固定使用 `assignments/{userId_assignmentId}`。
- `submitAssignment` 第一次寫入時即建立該 docId（至少 `currentStatus=started`）。
- `ingestGithubAutograde` 採 `unitId-first`：以 `userId + unitId` 解析同單元最新作業並回寫分數。
- Admin TutorMode 測試入口不會自動建立 `started` 紀錄，避免觸發學生付款授權檢查。
- 若某單元尚未有任何學生建立 assignment 紀錄，該單元在 bootstrap 匯出時會顯示 `missing_mapping`（屬預期），待首次 assignment 建立後即可由補漏流程自動補齊。

---

## 5. `tutor_applications` 集合
儲存導師資格申請審核資料。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `userId` | string | 申請者 UID。 |
| `userEmail` | string | 申請者 Email。 |
| `unitId` | string | 申請單元。 |
| `status` | string | `awaiting_candidate_link`, `pending`, `approved`, `rejected`。 |
| `source` | string | 來源（如 `tutor_recommendation`）。 |
| `recommendedByUid` | string | 推薦者 UID（推薦流程）。 |
| `recommendedByEmail` | string | 推薦老師 Email。 |
| `recommendedFromAssignmentId` | string | 由哪筆 assignment 推薦而來。 |
| `recommendedAt` | timestamp | 推薦建立時間（推薦流程）。 |
| `candidateClassroomInviteUrl` | string | 候選學生提交的作業綁定資訊（歷史欄位，僅供舊流程相容）。若後續改名，建議遷移為 `candidateAssignmentUrl`。 |
| `candidateLinkSubmittedAt` | timestamp | 候選學生完成連結提交時間。 |
| `appliedAt` | timestamp | 申請時間。 |
| `adminMessage` | string | 管理員審核回覆。 |
| `resolvedAt` | timestamp | 審核完成時間。 |
| `resolvedByUid` | string | 審核管理員 UID。 |

---

## 6. `profit_ledger` 集合
儲存分潤月結支付明細（每月攤提後的支付列）。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `role` | string | 分潤角色：`tutor` / `agent` / `courseDev`。 |
| `tutorEmail` | string | 分潤歸屬導師。 |
| `recipientEmail` | string | 分潤收款人 Email（與 `tutorEmail` 同步保留，供新角色欄位使用）。 |
| `studentUid` | string | 訂單對應學生 UID。 |
| `orderId` | string | 關聯訂單 ID。 |
| `orderItemId` | string | 關聯訂單項目 key。 |
| `orderAmount` | number | 該項目金額（單價 x 數量）。 |
| `shareAmount` | number | 分潤金額。 |
| `plannedShareAmount` | number | 該期預計支付金額。 |
| `blockedShareAmount` | number | 因缺少收款帳號而暫緩支付金額。 |
| `level` | number | 分潤層級。 |
| `referralLink` | string | 對應推薦連結（若有）。 |
| `period` | string | 計算月份（YYYY-MM）。 |
| `policyId` | string | 套用的分潤策略 ID。 |
| `policySnapshot` | map | 當下分潤比例快照（tutor/agent/courseDev）。 |
| `creditId` | string | 對應 `revenue_share_credits` credit。 |
| `payoutStatus` | string | `scheduled` / `missing_payout_account`。 |
| `payoutAccountPresent` | boolean | 是否已提供收款帳號。 |
| `calculatedAt` | timestamp | 本次計算寫入時間。 |
| `idempotencyKey` | string | 冪等鍵（`period+orderId+orderItemId+role+level+recipientEmail` 雜湊），避免重跑重複入帳。 |

> 分潤公式、上線鏈條與月結規則詳見 `docs/recursive-sharing.md`。

---

## 6.1 `revenue_share_policies` 集合
儲存單一分潤策略，目前系統只使用 `default-v1`。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `policyId` | string | 固定為 `default-v1`。 |
| `policyName` | string | 策略名稱。 |
| `tutorRate` | number | Tutor 直推分潤比例。 |
| `tutorUplineRate` | number | Tutor 上線遞迴比例。 |
| `agentRate` | number | Agent 直推分潤比例。 |
| `agentUplineRate` | number | Agent 上線遞迴比例。 |
| `courseDevRate` | number | 課程開發分潤比例。 |
| `courseDevUplineRate` | number | 課程開發上線遞迴比例。 |
| `enabled` | boolean | 是否啟用。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

補充說明：
- `functions/index.js` 的 `calculateMonthlySharing` 會先以共用 loader 讀取 `default-v1`，再產生 `policySnapshot`；文件中的欄位定義與資料契約不變。
- 舊的 `policyId` 若非 `default-v1`，前端與後端都會回落到 `default-v1`。

---

## 6.2 `revenue_share_credits` 集合
儲存訂單產生的分潤 credit（付款後建立，按月攤提）。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `creditId` | string | credit 識別碼（order/item/role/level/recipient 雜湊）。 |
| `orderId` / `orderItemId` | string | 對應訂單與項目。 |
| `studentUid` | string | 購買學生 UID。 |
| `role` | string | `tutor` / `agent` / `courseDev`。 |
| `recipientEmail` | string | 分潤受益者 Email。 |
| `totalCredit` | number | 總分潤 credit。 |
| `paidCredit` | number | 累計已支付。 |
| `remainingCredit` | number | 剩餘待支付餘額。 |
| `validityMonths` | number | 攤提月數。 |
| `monthlyInstallment` | number | 每期平均支付金額。 |
| `startPeriod` | string | 開始月（YYYY-MM）。 |
| `nextPayoutPeriod` | string | 下次月結支付月。 |
| `status` | string | `active` / `pending_account` / `completed`。 |
| `policyId` / `policySnapshot` | string / map | 分潤策略與比例快照。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

---

## 6.3 `revenue_share_balances` 集合
儲存每位受益者分潤餘額快照。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `recipientEmail` | string | 受益者 Email。 |
| `totalCredit` | number | 累計產生 credit。 |
| `totalPaid` | number | 累計已支付。 |
| `remainingBalance` | number | 目前待支付餘額。 |
| `activeCredits` | number | 進行中 credit 數量。 |
| `pendingAccountCredits` | number | 因缺少收款帳號而暫緩數量。 |
| `payoutAccountPresent` | boolean | 是否已有收款帳號。 |
| `lastCalculatedPeriod` | string | 最後計算月份（YYYY-MM）。 |
| `updatedAt` | timestamp | 更新時間。 |

---

## 7. `activity_logs` 集合
儲存毫秒級的學習行為追蹤數據（由 `logActivity` API 寫入）。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `uid` | string | 執行行為的使用者 UID。 |
| `courseId` | string | 課程識別碼。 |
| `action` | string | 行為類型（如 `VIDEO`, `DOC`, `PAGE_VIEW`；目前 `PAGE_VIEW` 寫入已停用）。 |
| `duration` | number | 持續時間（秒）。 |
| `metadata` | map | 額外參數（如 `videoId`, `percentComplete`）。 |
| `timestamp` | timestamp | 記錄時間。 |

---

## 8. `referral_links` 集合
儲存導師推薦/綁定用連結索引（含歷史舊作業邀請相容資料）。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `tutorEmail` | string | 該推薦連結所屬導師 Email。 |
| `tutorName` | string | 導師名稱。 |
| `unitId` | string | 連結對應單元 ID。 |
| `normalizedUrl` | string | 正規化後的 GitHub URL。 |
| `createdAt` | timestamp | 建立時間。 |

補充說明：
- `unitId` 現行規格應為 canonical unit page URL，例如 `common-developer-identity.html`。
- 2026-05-28 已完成歷史 `referral_links.unitId` 清理；8 筆 legacy unit 已轉為 canonical unit，另 1 筆 malformed referral index（`url = "authorized"`）已刪除。
- `functions/index.js` 目前透過共用 helper 產生 referral link doc id 與 normalised URL；這是內部實作細節，不影響集合 schema。

---

## 9. `metadata_settings` 集合
系統全域設定（目前已使用：`tutor_terms`, `revenue_share_config`）。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `content` | string | 設定內容（例：合格教師條款）。 |
| `updatedAt` | timestamp | 設定更新時間。 |

`revenue_share_config` 常見欄位：
- `defaultValidityMonths`：預設攤提月數（建議 12）。
- `defaultPayoutEmail`：缺省受益者（預設 `info@vibe-coding.tw`）。

`investor_config` 常見欄位：
- `settlementMonth`：年度結算月份，預設 12。
- `settlementDay`：年度結算日期，預設 31。
- `defaultPayoutAccount`：缺省投資人收款帳號（若個別投資人未填時可作為 fallback）。

---

## 9.1 股權主檔與投資人資料總覽

以下集合共同構成目前的股權主檔與投資人資料層：

- `investor_profiles`: 名單與份額設定
- `valuation_snapshots`: 估值快照與發股定價基準
- `equity_issuances`: 每次實際發股或服務換股
- `investor_equity_positions`: 每位投資人的最新持股位置
- `investor_finance_events`: 收入 / 支出 / 手動調整事件
- `investor_credits`: 依份額拆分後的 credit 明細
- `investor_balances`: 即時餘額
- `investor_annual_settlements`: 年度股利結算結果

資料語意原則：
- 股權主檔是 ownership 的主來源，不應和 revenue share 混用。
- `valuation_snapshots` 只用來鎖定發股價格，不回寫舊發行紀錄。
- `investor_finance_events` 與 `investor_credits` 只處理收入 / 支出或其他可結算事件。
- `investor_equity_positions` 是讀取用的持股快照，來源應可追溯到 `equity_issuances`。

### 9.2 `balance_sheet_snapshots` 集合
儲存公司資產負債快照，供 NAV 與每股淨值計算使用。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `snapshotId` | string | 財務快照識別碼。 |
| `snapshotDate` | timestamp | 快照日期。 |
| `currency` | string | 幣別，預設 `TWD`。 |
| `cash` | number | 現金。 |
| `accountsReceivable` | number | 應收帳款。 |
| `otherAssets` | number | 其他資產。 |
| `fixedAssets` | number | 固定資產。 |
| `intangibleAssets` | number | 無形資產。 |
| `prepaidExpenses` | number | 預付費用。 |
| `accountsPayable` | number | 應付帳款。 |
| `shortTermDebt` | number | 短期借款。 |
| `longTermDebt` | number | 長期借款。 |
| `otherLiabilities` | number | 其他負債。 |
| `totalAssets` | number | 總資產。 |
| `totalLiabilities` | number | 總負債。 |
| `netAssetValue` | number | 淨值 / NAV。 |
| `issuedShares` | number | 當期已發行股數。 |
| `navPerIssuedShare` | number | 每股淨值。 |
| `notes` | string | 備註。 |
| `locked` | boolean | 是否鎖定。 |
| `autoManaged` | boolean | 是否為系統自動追蹤的 current snapshot。 |
| `lastEventId` / `lastEventType` | string | 造成這筆快照變動的最新事件。 |
| `lastEventSourceType` / `lastEventSourceId` / `lastEventSourceLabel` | string | 最新事件來源摘要。 |
| `lastEventNote` | string | 最新事件備註。 |
| `lastEventAt` | timestamp | 最新事件時間。 |
| `createdByUid` / `updatedByUid` | string | 維護者 UID。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

---

## 10. `valuation_snapshots` 集合
儲存每一輪鎖定的估值快照，發股時必須引用既有 snapshot，不直接依即時估值重算。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `valuationId` | string | 估值快照識別碼。 |
| `roundName` | string | 輪次名稱。 |
| `valuationType` | string | `pre-money` / `post-money`。 |
| `currency` | string | 幣別，通常為 `TWD`。 |
| `preMoneyValuation` | number | 前估值。 |
| `postMoneyValuation` | number | 後估值。 |
| `shareBasis` | number | 換算基準股數。 |
| `sharePrice` | number | 每股價格。 |
| `effectiveFrom` / `effectiveTo` | timestamp / null | 適用期間。 |
| `notes` | string | 說明。 |
| `locked` | boolean | 是否鎖定不可隨意修改。 |
| `createdByUid` / `updatedByUid` | string | 維護者 UID。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

---

## 11. `equity_issuances` 集合
儲存每一次實際換股結果，包含外部投資、員工折抵與顧問折抵。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `issuanceId` | string | 發股識別碼（冪等鍵）。 |
| `valuationId` | string | 所引用的估值快照。 |
| `investorId` | string | 對應投資人 / 員工 / 顧問。 |
| `investorName` | string | 名稱。 |
| `investorEmail` | string | Email。 |
| `participantType` | string | `investor` / `employee` / `consultant` / `advisor`。 |
| `sourceType` | string | 來源類型（如 `manual` / `payroll` / `contract`）。 |
| `sourceId` | string | 來源編號。 |
| `sourceLabel` | string | 來源說明。 |
| `considerationType` | string | 對價類型（如 `cash` / `service` / `offset`）。 |
| `considerationAmount` | number | 對價金額。 |
| `sharePrice` | number | 換算時使用的單價。 |
| `issuedShares` | number | 本次發行股數。 |
| `shareBasis` | number | 估值基準股數。 |
| `ownershipPct` | number | 本次或累計持股比例。 |
| `vestingMonths` / `cliffMonths` | number | 歸屬條件。 |
| `startDate` | timestamp | 起算日。 |
| `status` | string | `active` / `cancelled` / `fully_vested` 等。 |
| `note` | string | 備註。 |
| `createdByUid` / `updatedByUid` | string | 維護者 UID。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

---

## 12. `investor_equity_positions` 集合
儲存每位投資人目前的持股位置與最新估值參考。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `investorId` | string | 投資人識別碼。 |
| `investorName` | string | 名稱。 |
| `investorEmail` | string | Email。 |
| `participantType` | string | 身份類型。 |
| `totalIssuedShares` | number | 累計已發股數。 |
| `shareBasis` | number | 估值基準股數。 |
| `ownershipPct` | number | 累計持股比例。 |
| `valuationId` | string | 最新套用的估值 ID。 |
| `sharePrice` | number | 最新套用的單價。 |
| `latestIssuanceId` | string | 最近一次發股識別碼。 |
| `vestingMonths` / `cliffMonths` | number | 最新歸屬條件。 |
| `updatedAt` | timestamp | 更新時間。 |

---

## 13. `investor_profiles` 集合
儲存投資人與持股份額設定。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `investorId` | string | 投資人識別碼。 |
| `investorName` | string | 投資人名稱。 |
| `investorEmail` | string | 聯絡 Email。 |
| `shareUnits` | number | 持有份額單位，所有投資人份額加總後用來分配每筆 credit。 |
| `payoutAccount` | string | 股利發放帳號。 |
| `notes` | string | 備註。 |
| `enabled` | boolean | 是否啟用。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

---

## 14. `investor_finance_events` 集合
儲存每一筆收入/支出事件的原始流水。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `eventId` | string | 事件識別碼（具冪等性）。 |
| `eventType` | string | `income` / `expense`。 |
| `sourceType` | string | 來源類型，例如 `order` / `manual`。 |
| `sourceId` | string | 來源編號。 |
| `sourceLabel` | string | 來源說明。 |
| `grossAmount` | number | 原始金額。 |
| `signedAmount` | number | 正負金額，支出為負。 |
| `note` | string | 備註。 |
| `eventYear` / `eventMonth` | number / string | 事件年度與月份。 |
| `occurredAt` | timestamp | 發生時間。 |
| `createdAt` | timestamp | 建立時間。 |

---

## 15. `investor_credits` 集合
儲存依份額拆分後的投資人 credit。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `creditId` | string | credit 識別碼（event/investor 雜湊）。 |
| `eventId` | string | 對應事件 ID。 |
| `investorId` | string | 對應投資人。 |
| `shareUnits` | number | 該投資人份額。 |
| `totalShareUnits` | number | 全體份額總和。 |
| `shareRatio` | number | 份額比例。 |
| `eventType` | string | `income` / `expense`。 |
| `grossAmount` | number | 事件原始金額。 |
| `allocatedAmount` | number | 分配金額，支出為負。 |
| `year` / `month` | number / string | 分配年度與月份。 |
| `occurredAt` | timestamp | 發生時間。 |
| `createdAt` | timestamp | 建立時間。 |

---

## 16. `investor_balances` 集合
儲存每位投資人的即時餘額與最近結算狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `investorId` | string | 投資人識別碼。 |
| `currentBalance` | number | 當前累積餘額。 |
| `shareUnits` | number | 最新份額快照。 |
| `lastCreditEventId` | string | 最近一次 credit 事件。 |
| `lastSettlementYear` | number | 最近一次年度結算年份。 |
| `lastSettlementAt` | timestamp | 最近一次年度結算時間。 |
| `settlementMonth` / `settlementDay` | number | 年度結算排程。 |
| `updatedAt` | timestamp | 更新時間。 |

---

## 17. `investor_annual_settlements` 集合
儲存年度股利結算結果與最後餘額。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `settlementId` | string | 結算識別碼（`year-investorId`）。 |
| `investorId` | string | 投資人識別碼。 |
| `year` | number | 結算年度。 |
| `openingBalance` | number | 期初餘額。 |
| `incomeTotal` | number | 當年度收入 credit 合計。 |
| `expenseTotal` | number | 當年度支出 credit 合計。 |
| `netAmount` | number | 當年度淨額。 |
| `dividendPayable` | number | 應發股利。 |
| `dividendPaid` | number | 實際已發股利。 |
| `endingBalance` | number | 結算後最後餘額。 |
| `payoutAccountPresent` | boolean | 是否有收款帳號。 |
| `payoutStatus` | string | `paid` / `missing_payout_account` / `no_dividend`。 |
| `creditCount` | number | 當年 credit 數量。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

---

## 18. 規格定義與遷移備註 (Specs & Migration Notes)

> [!NOTE]
> 本章節區分現行生產規格、歷史相容機制與過去之遷移備註，以便維護者能快速釐清何者為「當前運作規範」，何者為「相容性歷史痕跡」。

### 18.1 Live Production Specification (現行生產規格)

1. **唯一真實來源 (Firestore-first)**：所有單元、課程、推薦碼、付款授權、導師身分判定均以 Firestore 為 runtime 唯一真實來源。
2. **角色與權限模型**：系統只區分全域 `role: admin` 與 `role: user`，導師資格由 `users.tutorConfigs[unitId].authorized` 判定。
3. **頁面路由與導覽**：前台學習路徑、課程卡片及所有導覽，一律使用 canonical page URL（可直接開課之首個單元，例如 `/courses/common-developer-identity.html`）。
4. **ID 命名歸一化**：比對 `unitId` 或 `courseId` 時，一律做歸一化（如移除 `.html` 後綴）。

### 18.2 Legacy Master Pages Retirement Spec (主頁面退役與相容規格)

1. **退役計畫狀態**：`*-master-*.html` 頁面在架構上已退役，新生產網頁不再使用此命名。然而，**代碼與資料庫中的相容層仍處於啟用（ACTIVE）狀態**，不可直接移除。
2. **舊網址重導向**：已在 Cloud Functions 的 `serveCourse` 實作 301 轉址，將歷史書籤重導向至 canonical courseId。
3. **歷史訂單授權相容性**：因遷移前成立之歷史訂單中 `items` 仍使用 legacy master 鍵值（例如 `start-01-master-web-app.html`），後端目前只在歷史訂單 / 歷史網址相容路徑中透過 `mapLegacyMasterToCanonical()` 進行轉換，確保舊學員權益，同時避免該相容表滲入一般 runtime 判斷。
4. **2026-05-28 收斂狀態**：歷史 `orders.items` 已完成 canonical 清理；一般訂單授權、購買單元收集、分潤 referral 抽取不再依賴 legacy master item key。歷史 `referral_links.unitId` 也已完成 canonical 清理，另 1 筆 malformed referral index 已刪除。`mapLegacyMasterToCanonical()` 目前只保留在舊網址 redirect 與舊 token scope 驗證用途，且 token-scope fallback 只在請求或 token 仍明確帶有 `*-master-*` page id 時啟用。`metadata_lessons.courseKey` 已收斂為 locale-neutral key（例如 `common-vscode-setup`、`car-starter-web-app`），而頁面路由與 `contentRef` 仍保留 `tw-*` 檔名以維持內容倉與舊網址相容。
5. **完全移除相容層之門檻**：相容代碼（如 `functions/index.js` 中的 `LEGACY_MASTER_TO_CANONICAL`）只有在以下條件皆滿足後，方可刪除：
   - 歷史訂單全部完成資料遷移：課程項目統一更新為 canonical `courseKey`，商品項目維持 `productId`。
   - 經過至少一次完整生產環境 pilot validation，確認無任何歷史用戶存取異常。

### 18.3 Historical Migration Notes (歷史遷移備註)

- **2026-05-27 系統升級**：
  - 角色統一：歷史 `student` 角色已全部遷移為 `user`。
  - 單元對照：將舊版 `03-unit-github-classroom.html` 等重複課程卡片移除，並確認後端只在歷史網址 / 歷史訂單相容路徑保留最小對照。
  - 一次性遷移腳本為 `functions/scripts/migrate_lessons_classroom_urls.js`。

---

## 11. 師生互動與卡點支援欄位 (Active)
以下為 Tutor x Student 互動層 MVP 實際啟用之資料欄位。

### `assignments` 擴充欄位
| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `learningState` | string | 學習狀態：`new`, `in_progress`, `blocked`, `coaching`, `resolved`。 |
| `latestBlocker` | map | 最近卡點（例：`type`, `note`, `createdAt`）。 |
| `hintLevelUsed` | number | 最近提示層級（`0~3`）。 |
| `attemptSummary` | string | 學生嘗試摘要。 |
| `nextAction` | string | Tutor 指定下一步。 |

### `assignment_coaching_logs` 集合 (歷史指導紀錄)
| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `assignmentId` | string | 關聯作業。 |
| `studentUid` | string | 學生 UID。 |
| `tutorEmail` | string | 指導導師。 |
| `hintLevel` | number | 提示層級（`1/2/3`）。 |
| `blockerType` | string | 卡點類型（`concept/debug/environment`）。 |
| `coachNote` | string | 結構化教學回饋。 |
| `createdAt` | timestamp | 建立時間。 |

### `assignment_interventions` 集合 (系統自動監控警示)
| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `assignmentId` | string | 關聯作業。 |
| `studentUid` | string | 學生 UID。 |
| `studentEmail` | string | 學生 Email。 |
| `triggerScore` | number | 觸發介入時分數。 |
| `threshold` | number | 觸發門檻。 |
| `status` | string | `open`, `in_progress`, `resolved`。 |
| `ownerTutorEmail` | string | 負責導師。 |
| `createdAt` / `resolvedAt` | timestamp | 建立與完成時間。 |

補充說明：
- `functions/index.js` 目前把 `assignment_interventions` 的 active 查詢與批次更新收斂到共用 helper；集合欄位與狀態定義維持不變。
