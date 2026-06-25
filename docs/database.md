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
| `promotionCode` | string | Tutor 專屬 Promotion code（已棄用，由 Tutor email 取代，保留作歷史相容）。 |
| `locale` | string | 使用者語系（例：`zh-TW`）。 |
| `region` | string | 使用者地區（例：`TW`）。 |
| `preferredRegion` | string | 預設 routing 地區；可與 `region` 不同。 |
| `preferredDistributorId` | string | 預設經銷商；登入後的 `learning-path` / checkout 會優先讀這個欄位，首次綁定後由系統維護。 |
| `bindingSource` | string | 綁定來源，例如 `explicit`, `tutor`, `promotionCode` (或 `promotionCodeBinding`), `regionDefault`, `manual`。 |
| `bindingConfidence` | number | 系統對目前經銷商綁定結果的內部信心分數。 |
| `bindingUpdatedAt` | timestamp | 經銷商綁定最後更新時間。 |
| `courseProgress` | map | 學習進度聚合資料。 |
| `orders` | array | 主要為 Dashboard 聚合回傳欄位，非主要持久化來源（實際訂單以 `orders` 集合為準）。 |
| `paid` | boolean | 付款快取旗標；通常由成功訂單同步寫入，非主授權來源。 |
| `hasStarterAccess` | boolean | starter 課程快取旗標；通常由成功 starter 訂單同步寫入，非主授權來源。 |
| `lastPaidOrderId` | string | 最近一次成功付款訂單編號，屬於快取欄位。 |
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
| `amount` | number | 交易金額，與 `totalAmount` 保持相同值作相容欄位。 |
| `subtotalAmount` | number | 商品小計，不含運費與稅額。 |
| `taxAmount` | number | 稅額快照；目前 consumer price 以含稅總價顯示。 |
| `shippingAmount` | number | 運費快照。 |
| `totalAmount` | number | 實付總額，使用者看到的含稅含運總價。 |
| `taxIncluded` | boolean | 是否採用含稅售價。 |
| `shippingIncluded` | boolean | 是否採用含運售價。 |
| `status` | string | 目前主流程實際寫入 `PENDING`, `SUCCESS`（`FAILED` 保留為擴充狀態）。 |
| `items` | map | 訂單項目。Key 為 itemId，value 可含 `name`, `price`, `quantity`, `isPhysical`。 |
| `gateway` | string | 付款閘道（例如 `ECPAY`）。 |
| `paymentGateway` | string | 付款供應商快照；與 `gateway` 保持一致。 |
| `logisticsProvider` | string | 物流 / 履約整合供應商（例如 `ECPAY`、`MANUAL`、`NONE`）。 |
| `fulfillmentOwnerType` | string | 履約責任歸屬型別，通常為 `distributor`。 |
| `fulfillmentOwnerId` | string | 履約責任歸屬 ID。 |
| `region` | string | 訂單地區（例：`TW`）。 |
| `contentLocale` | string | 訂單內容語系（例：`zh-TW`）。 |
| `distributorId` | string | 凍結後的經銷商識別碼。 |
| `priceBookId` | string | 凍結後的 price book 識別碼。 |
| `currency` | string | 凍結後的結帳幣別。 |
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
> 前台 consumer price 以「含稅含運」總價顯示，後端仍會保存 `subtotalAmount` / `taxAmount` / `shippingAmount` 供對帳與拆帳。
> `fulfillmentStatus` 現在代表「經銷商 / 履約夥伴」的工作流狀態，不再單純等同於平台直送狀態。
> **重複購買限制**：`initiatePayment` 在建立新訂單前，會自動檢查學員已成功付款且未到期的線上課程訂單（`expiryDate > now`）。若偵測到購物車中有學員已擁有的未到期課程，後端會直接拒絕交易並回傳錯誤訊息，阻止重複付款。
> **付款後開通驗證**：`paymentNotify` 寫入 `SUCCESS` 後會立即檢查每個數位課程項目是否能解析到 canonical course、是否具備 `courseUnits`，並用共用授權邏輯確認學生可通過課程授權。失敗時會寫入 `activationAlerts` 並寄送 Admin 告警。實體商品不要求 `courseUnits`。

---

## 3. `metadata_lessons` 集合
儲存課程與單元元資料。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | string | Firestore document ID；`metadata_lessons` 的 canonical lesson ID。 |
| `docId` | string | `id` 的明確別名，僅供回傳資料與 migration 檢查使用。 |
| `courseId` | string | 課程歷史/顯示識別碼，相容欄位，執行期不得作為單元路由或授權來源。 |
| `title` | string | 課程/單元標題。 |
| `courseUnits` | array | 該課程包含的單元 HTML 檔列表，為跨單元 TAB、授權與課程結構的唯一執行期來源；不得用來覆寫單元內 page menu。 |
| `dealerPrice` | number | runtime join 後的經銷商課程價格；主來源為 `dealer_price_books`。 |
| `category` | string | 課程分類 canonical key；課程線建議使用 `common`、`car-starter`、`car-basic`、`car-advanced`。 |
| `isPhysical` | boolean | 是否為實體商品；相容欄位，實務上由 `metadataType` 推導。 |
| `orderWeight` | number | 排序權重。 |
| `metadataType` | string | 元資料類型：`course` / `product`；主型別欄位，`legacy_product` 僅作相容。 |
| `docId` | string | 商品型 metadata 的 canonical document ID。 |
| `pricing` | map | 多地區定價主欄位。建議使用 `tw` / `en`，各值格式為 `{ amount, currency }`。 |
| `priceByLocale` | map | 語系定價相容別名。僅供歷史資料或 migration 使用，不應作為新的定價依據。 |
| `priceByRegion` | map | 區域定價相容別名。僅供歷史資料或 migration 使用，不應作為新的定價依據。 |
| `priceMap` | map | 舊版/相容定價別名，前端與後端仍可讀取，但新流程應以 distributor price book 為準。 |
| `prices` | map | 舊版簡化定價別名，僅作歷史相容與資料遷移用途。 |
| `price_twd` | number | 相容欄位，台幣金額。 |
| `price_usd` | number | 相容欄位，美金金額。 |
| `currency` | string | 預設幣別，通常保留 `TWD`。 |
| `hiddenFromCatalog` | boolean | 是否從課程/商品列表隱藏（保留歷史資料時使用）。 |
| `isDeprecated` | boolean | 是否為已廢止舊資料（保留對帳/歷史用途）。 |

#### 主鍵規則

- `metadata_lessons`、`dealer_price_books`、`orders` 與其他核心集合都必須以 Firestore document ID 作為唯一主鍵與主要關聯依據。
- `metadata_lessons.id` / `metadata_lessons.docId` 必須對應 Firestore document ID，並視為 canonical lesson id；建立後不建議直接修改，若要換 ID 請複製成新課程再停用舊資料。
- `courseId`、`entryUnitId`、`contentRef`、`legacy product ID`、`sku` 等欄位只作為顯示、查詢輔助或 migration 相容資訊，不得再作為新的主關聯鍵。
- 任何跨集合 join 都應先嘗試以 document ID 關聯；只有在遷移期間才允許讀取歷史 alias 欄位，且必須是明確、窄化的 migration path。
- 後續新增的 price book、授權、內容路由、作業綁定資料，都應先設計成可直接用 document ID 追蹤與對照。

> 重要：課程價格與授權判斷以 `dealer_price_books` 為主，`metadata_lessons` 僅保留內容與結構 metadata。
> 不再依賴硬編碼單元白名單。
> 所有執行期資料比對（包含邀請連結、課程授權、單元歸屬）都必須直接查 Firestore，禁止使用程式碼內相容名單或 fallback 白名單。
> `metadata_lessons` 可同時承載課程與部分商品 metadata，但價格欄位只應視為相容/過渡資訊，正式價格來源是 `dealer_price_books`。
> 課程 UI 邊界：`metadata_lessons.course_units` 是跨單元結構；左側 page menu 必須由目前單元 HTML 的 `window.UNITS` / `#sidebar-nav` 定義。完整規格見 `docs/course-ui-runtime-spec.md`。
> 課程開通設定與判定順序，請另參考 [`docs/courses/course-activation-settings.md`](courses/course-activation-settings.md)。
> 新課程的新增 / 修改 / 停用流程，請參考 [`docs/course-management-runbook.md`](course-management-runbook.md)。

#### 價格遷移備註

- `metadata_lessons.price` 已不再是主價格來源。
- 前端與後端在需要課程價格時，應先查 `dealer_price_books`，再由 runtime join 把 `dealerPrice` / `dealerCurrency` 帶回 lesson。
- `dealer_price_books` 必須保存對應 lesson 的 Firestore document ID，欄位建議為 `docId`，舊資料若暫時缺失可用 `sourceDocId` 過渡。
- `dealer_price_books` 的價格規則為：
  - 先看是否在 `promoEffectiveFrom` / `promoEffectiveTo` 促銷期間內
  - 若在促銷期間，使用 `promoPrice`
  - 若不在促銷期間，使用 `salePrice`
  - `salePrice` / `promoPrice` 任一未填，視為 `0`
- 沒有對應 `dealer_price_books` 的課程或產品，視為「未定價 / 不可販售」，不得因 `0` 而當作免費商品放行。
- 歷史資料若尚未補齊 `docId` / `sourceDocId`，請以離線 migration 腳本 [`functions/scripts/backfill_dealer_pricebook_legacy_keys.js`](../functions/scripts/backfill_dealer_pricebook_legacy_keys.js) 補齊，不得在 runtime 再新增對照表。
- 舊有 `price` / `price_twd` / `price_usd` 欄位只保留過渡相容用途，等資料遷移完成後可逐步清除。
- 免費課程的判定也應以 dealer price 結果為準，而不是把 `metadata_lessons.price` 視為授權依據。
>
> 2026-06-03 價格規則更新：
> - 課程與硬體商品皆採用多地區定價欄位，前端與後端不做匯率換算。
> - `pricing.tw` / `pricing.en` 與 `priceByLocale` / `priceByRegion` 都屬於歷史相容表達，新的定價依據應以 distributor price book / checkout quote 為準。
> - 推薦寫法為同時保留 `pricing`、`priceMap`、`price_twd` / `price_usd`，以維持舊資料相容。
> - 目前課程標準價：入門 `TWD 1200 / USD 40`、基礎 `TWD 1500 / USD 50`、進階 `TWD 1800 / USD 60`。
> - 語言只影響內容與介面文字，不得作為價格選擇依據；checkout 的幣別以 `dealer_price_books` / order quote 為準。
>
> 2026-05-16 更新：
> - `ai-agents-vibe.courseUnits` 已切換為 `02-unit-agent-mode.html`, `02-unit-web-agents.html`, `02-unit-vibe-coding.html`
> - `github-classroom.courseUnits` 已整併為 `03-unit-github-classroom.html`

### `metadata_lessons` canonical 欄位

`metadata_lessons` 已收斂為「最小 canonical schema + 少量 compat alias」，其中 `category` 是優先分類鍵，`track` 不再是 canonical 主欄位。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` / `docId` | string | Firestore document ID，作為 canonical lesson key。若需要 key，應直接整合進 document ID，而不是再維護獨立的 `courseKey`。 |
| `i18n` | map | 多語內容主結構。Key 為 locale，例如 `en`、`zh-TW`、`ja`、`fr`；每個 locale 內只維護 `title`、`summary`、`description`、`coreContent`。 |
| `course_units` | array | 外部課程單元檔案名稱清單，用於跨單元 TAB 與授權，不再用來描述單元標題。 |
| `level` | string | 課程層級，例如 `starter`、`basic`、`advanced`。 |
| `category` | string | 課程分類 canonical key，作為主分類與學習路徑對應鍵。 |
| `orderWeight` | number | 課程排序權重，作為主檔排列與 catalog 順序依據。 |
| `metadataType` | string | `course` / `product`；`legacy_product` 僅作相容。 |
| `hiddenFromCatalog` | boolean | 是否從前台列表隱藏。 |
| `isDeprecated` | boolean | 是否為已廢止舊資料（保留對帳/歷史用途）。 |

### `metadata_lessons` compat / derived 欄位

下列欄位保留給 migration、舊 runtime 或外部系統相容使用，但不建議再作為新資料的主寫入來源：

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `courseUnits` | array | `course_units` 的舊 camelCase 別名。 |
| `courseUnitTitles` | array | 單元顯示標題清單，僅供管理介面或舊版 TAB 顯示相容。 |
| `entryUnitId` | string | 入口單元相容欄位；原則上可由 `course_units[0]` 推導。 |
| `contentRef` | string | 外部內容倉路徑相容欄位；若路徑規則完全標準化，未來可改為推導欄位。 |
| `title` / `summary` / `description` | string | 舊有頂層內容欄位，已由 `i18n` 取代；新資料只建議寫 `title`。 |
| `titleEn` / `summaryEn` / `descriptionEn` / `coreContentEn` | string / array | 歷史相容欄位；新表單不再寫入。 |
| `learningPathLabel*` / `categoryLabel*` / `navLabel*` | string | 學習路徑分類顯示名稱的相容欄位。 |

### `metadata_lessons` 多語與相容欄位（i18n Content Fields）

英文現在已經移入 `i18n.en`，舊的 `*En` 與中文頂層欄位只保留給 migration / compatibility。
**命名約定**：若仍需相容欄位，一律以 `*En` 後綴表示英文版欄位。

| 欄位名稱 | 類型 | 中文對應欄位 | 說明 |
| :--- | :--- | :--- | :--- |
| `titleEn` | string | `title` | 課程英文標題（legacy / compatibility，僅讀不寫）。 |
| `summaryEn` | string | `summary` | 課程英文摘要（一句話簡介，legacy / compatibility）。 |
| `descriptionEn` | string | `description` | 課程英文詳細說明（legacy / compatibility）。 |
| `coreContentEn` | array | `coreContent` | 核心學習內容英文列表（legacy / compatibility）。 |
| `lessonLabelEn` | string | `lessonLabel` / `tagText` | 舊版英文相容欄位。新資料應改寫入 `i18n.en.lessonLabel`。 |

**使用規則**：
- 前端在需要文字時，優先讀取 `i18n.{locale}`，舊 `*En` 欄位只作歷史相容。
- `lessonLabel` 也應併入 `i18n` 管理，建議使用 `i18n.zh-TW.lessonLabel`、`i18n.en.lessonLabel`。
- 若要保留相容層，頂層 `lessonLabel` 可視為中文 fallback，`lessonLabelEn` 視為英文 fallback。
- `getLessonsMetadata` Cloud Function 直接傳回 Firestore 文件所有欄位，**不需要後端修改**即可生效。
- 欄位維護以 `courses-management.html` 的 `i18n` 編輯器為主。
- 建議以 `i18n.en`、`i18n.zh-TW` 這類 locale key 管理全部文字，不再依賴頂層 `title` / `summary` / `description`。

### `lessonLabel` 收斂建議

`lessonLabel` 的用途是「課程 badge / 分類顯示字串」，通常不屬於核心內容本體，因此建議：

| 欄位名稱 | 建議定位 | 說明 |
| :--- | :--- | :--- |
| `lessonLabel` | 相容 fallback | 中文顯示文字，僅在 `i18n.zh-TW.lessonLabel` 缺席時使用。 |
| `lessonLabelEn` | 相容 fallback | 英文顯示文字，僅在 `i18n.en.lessonLabel` 缺席時使用。 |
| `i18n.zh-TW.lessonLabel` | canonical | 中文 badge / 標籤顯示。 |
| `i18n.en.lessonLabel` | canonical | 英文 badge / 標籤顯示。 |

如果該字串可由 `level`、`sequence` 或 `labelKey` 組合推導，優先使用推導，減少重複存放。

執行期 canonical identity 規則：
- 課程型 metadata：優先使用 Firestore document ID（`id` / `docId`）
- 商品型 metadata（`metadataType=product`，相容讀取時可接受 `legacy_product` / `isPhysical=true`）：優先使用 `docId` / document ID
- `courseId` 僅保留作為頁面入口 / 歷史相容欄位，不得再作為任何課程單元路由或授權的執行期主鍵；執行期唯一來源為 `courseUnits`
- `category` 是課程分類的優先鍵；若缺席才 fallback 到舊資料的相容讀取邏輯
- `contentRef` / 頁面路由仍可保留 `tw-*` 檔名；若後續檔名規則完全標準化，才考慮改由 docId 推導並移除 `contentRef`

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
- 2026-05-28 已完成歷史 `referral_links.unitId` 清理；8 筆 historical unit 已轉為 canonical unit，另 1 筆 malformed referral index（`url = "authorized"`）已刪除。
- `functions/index.js` 目前透過共用 helper 產生 referral link doc id 與 normalised URL；這是內部實作細節，不影響集合 schema。
- `referral_links` 目前仍在導師綁定與驗證流程中使用，包含 `adminVerifyReferralLink`、`adminFindClassroomInviteBinding` 與 `adminBindTutorToUnit`；在這些流程尚未完全退役前，不建議移除集合。

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

若要規劃全站共用的 locale 設定，建議收斂到 `metadata_settings`，例如：
- `defaultLocale`
- `supportedLocales`
- `localeLabels`
- `localeFallbackMap`

這類設定屬於平台層設定，適合集中管理，不建議散落在前端常數或各頁面硬編碼。

#### `metadata_settings/learning_paths`

`learning_paths` 是「課程分類與導覽顯示字典」的唯一來源，集中管理像 `common`、`car-starter`、`car-basic`、`car-advanced` 這類 path key 對應的顯示文字，top-nav 與 learning-path 頁面都只讀這裡，不再使用本地 fallback、seed 或快取。

目前前端實作會把這份字典同時用在：
- `nav-component.js` 的 learning-path dropdown label
- `learning-path.html` 的 H1 與 `document.title`

因此這份文件所定義的 `categoryLabels` 必須視為單一 truth source，不可再由頁面各自做不同的 locale fallback、檔名推導或本地快取。

Canonical schema：

```json
{
  "schemaVersion": 1,
  "categoryLabels": {
    "common": { "zh-TW": "課前準備", "en": "Preparation" },
    "car-starter": { "zh-TW": "入門課程", "en": "Starter Unit" },
    "car-basic": { "zh-TW": "基礎課程", "en": "Basic Unit" },
    "car-advanced": { "zh-TW": "進階課程", "en": "Advanced Unit" }
  },
  "updatedAt": "timestamp"
}
```

使用規則：
- `categoryLabels` 是全站共用 taxonomy 顯示字典，不是單一 lesson 的內容欄位。
- key 必須使用 canonical path key，不要長期保存 `tw-...` / `en-...` 這類 legacy 前綴；前端與後端需要時再做 locale 對照。
- `metadata_lessons.i18n` 負責 lesson 本體文字，`metadata_settings.learning_paths.categoryLabels` 負責分類 / badge / 導覽文字，top-nav 與 learning-path 標題都只可從這裡取值。
- `nav-component.js` 與 `learning-path.html` 必須共用相同的 category label resolver 與 locale 判斷，且不得加入本地 fallback、seed 或快取。
- 舊資料若仍保存成 `zh-TW` / `en` 置頂 bucket 或 `tw-*` / `en-*` key，應透過 migration 一次性轉成 canonical schema，不再新增新的 legacy 寫入路徑。

---

## 9.0 `ledger_events` / `ledger_postings` / `ledger_accounts` / `ledger_snapshots` / `ledger_reports` 集合
建議新增的全域記帳層，用來把所有業務事件統一轉成可稽核、可重算、可報表化的會計資料。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `ledger_events.eventId` | string | Canonical event id，具冪等性。 |
| `ledger_events.eventType` | string | 事件類型，例如 `order.paid`、`order.refunded`、`expense.paid`。 |
| `ledger_events.sourceType` | string | 來源類型，例如 `order`、`refund`、`manual`。 |
| `ledger_events.sourceId` | string | 來源編號。 |
| `ledger_events.sourceLabel` | string | 來源說明。 |
| `ledger_events.entityType` | string | 事件主體類型，例如 `order`、`user`、`unit`。 |
| `ledger_events.entityId` | string | 主體識別碼。 |
| `ledger_events.currency` | string | 幣別。 |
| `ledger_events.grossAmount` | number | 原始金額。 |
| `ledger_events.occurredAt` | timestamp | 發生時間。 |
| `ledger_events.metadata` | map | 額外上下文，例如 `unitId`、`tutorEmail`、`policyId`。 |
| `ledger_postings.postingId` | string | 分錄識別碼。 |
| `ledger_postings.eventId` | string | 對應事件 ID。 |
| `ledger_postings.accountCode` | string | 會計科目代碼。 |
| `ledger_postings.debit` / `credit` | number | 借方 / 貸方金額。 |
| `ledger_postings.periodYear` / `periodMonth` | number / string | 入帳期間。 |
| `ledger_postings.unitId` | string | 對應單元或事業體。 |
| `ledger_accounts.accountCode` | string | 科目代碼。 |
| `ledger_accounts.accountName` | string | 科目名稱。 |
| `ledger_accounts.accountType` | string | `asset` / `liability` / `equity` / `revenue` / `expense`。 |
| `ledger_accounts.parentCode` | string | 上層科目。 |
| `ledger_snapshots.period` | string | 結帳期間，例如 `2026-06`。 |
| `ledger_snapshots.accountCode` | string | 科目代碼。 |
| `ledger_snapshots.openingBalance` | number | 期初餘額。 |
| `ledger_snapshots.debitTotal` / `creditTotal` | number | 本期借貸總額。 |
| `ledger_snapshots.closingBalance` | number | 期末餘額。 |
| `ledger_reports.reportType` | string | 報表類型，例如 `trial_balance`、`p_and_l`、`balance_sheet`。 |
| `ledger_reports.reportPayload` | map | 報表內容。 |

補充說明：
- 這一層是 **全域記帳與報表基礎層**，不取代既有的 domain projection。
- `investor_*`、`revenue_share_*`、`profit_ledger`、`balance_sheet_snapshots` 都可視為投影或專用視圖。
- 報表應優先讀 `ledger_snapshots` / `ledger_reports`，再按需要回查 `ledger_postings` 與 `ledger_events`。

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
- 若未來導入全域記帳層，`investor_finance_events` 可作為 `ledger_events` 的投影之一，而不是唯一的業務事實來源。

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

### 18.2 Historical Master Pages Retirement Spec (主頁面退役與相容規格)

1. **退役計畫狀態**：`*-master-*.html` 頁面在架構上已退役，新生產網頁不再使用此命名。現行 runtime 不再讀取或維護歷史 mapping 相容層。
2. **舊網址處理**：歷史連結若仍指向 master 頁面，需仰賴內容倉 alias 或外部內容同步結果；Cloud Functions 不再維護獨立的 redirect 表。
3. **歷史訂單授權相容性**：遷移前成立之歷史訂單 `items` 曾使用 master 鍵值（例如 `start-01-master-web-app.html`），目前已完成 canonical 清理；現行後端只保留 canonical 比對邏輯，不再透過執行期 mapping 轉換。
4. **2026-05-28 收斂狀態**：歷史 `orders.items` 已完成 canonical 清理；一般訂單授權、購買單元收集、分潤 referral 抽取不再依賴 historical master item key。歷史 `referral_links.unitId` 也已完成 canonical 清理，另 1 筆 malformed referral index 已刪除。`metadata_lessons` 現已收斂為 `id` / `docId` + `category` + `orderWeight` 的 canonical schema，而頁面路由與 `contentRef` 仍保留 `tw-*` 檔名以維持內容倉與舊網址相容。原先的一次性遷移腳本已退役並刪除，相關清理改由現行維運工具接手。
5. **完全移除相容層之門檻**：若未來還需要重新引入任何 mapping 讀取，只能作為離線 migration 工具使用，不能回到 runtime。任何新流程都必須直接以 canonical `docId` / document ID 為準。
   - 歷史訂單全部完成資料遷移：課程項目統一更新為 canonical `docId`，商品項目維持 `docId` / document ID。
   - 經過至少一次完整生產環境 pilot validation，確認無任何歷史用戶存取異常。

### 18.3 Historical Migration Notes (歷史遷移備註)

- **2026-05-27 系統升級**：
  - 角色統一：歷史 `student` 角色已全部遷移為 `user`。
  - 單元對照：將舊版 `03-unit-github-classroom.html` 等重複課程卡片移除，並確認後端只在歷史網址 / 歷史訂單相容路徑保留最小對照。
  - 相關一次性遷移腳本已退役並刪除，後續如需重跑請改用現行維運工具。

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
