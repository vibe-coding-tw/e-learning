# Vibe Coding - 學習管理與分潤系統 (E-Learning & Profit Sharing System)

本專案是一個基於 Firebase 的現代化程式教學平台，結合了互動式課程、作業自動化、綠界金流 (ECPay) 以及多層級分潤架構。

## 🏗️ 系統架構 (System Architecture)

### 前端 (Frontend)
- **技術棧**: 原生 HTML5 / CSS3 (Vanilla CSS) / JavaScript (ES6+), TailwindCSS (部分組件)。
- **渲染與導航**: 使用自定義的 `nav-component.js` 與 `course-shared.js` 實現跨頁面統一導引與進度追蹤。
- **數據通訊**: 透過 Firebase JS SDK 直接與 Firestore 與 Cloud Functions 交互。

### 後端 (Backend)
- **平台**: Firebase (Google Cloud Platform)。
- **Cloud Functions (Node.js 22)**:
    - **`asia-east1` 區域**: 提供高性能、低延遲的亞太地區服務。
    - **API 服務**: 包含 `initiatePayment` (綠界支付)、`verifyPromoCode` (代碼驗證)、`getDashboardData` (各項數據導出) 等。
    - **定時任務 (Scheduled Functions)**:
        - `calculateMonthlySharing`: 每月 1 號自動計算並分配推薦利潤。
        - `remindAdminPendingAssignments`: 定期提醒未批改作業。
- **數據庫 (Firestore)**:
    - `users`: 使用者角色、UID 與權限映射。
    - `activity_logs`: 毫秒級追蹤學生觀看影片、閱讀文件的學習時數。
    - `orders`: 支付訂單、推薦代碼 (promoCode) 與導師 (referralMentor) 綁定。
    - `profit_ledger`: 自動化產出的月度分潤清單。

## ✨ 核心特色 (Key Features)

### 1. 互動式學習追蹤 (Learning Tracker)
- **影片時數**: 紀錄 YouTube/Video 播放秒數，確保學生確實觀看。
- **文檔閱讀**: 追蹤文件閱讀時間，防止跳過基礎知識。
- **學習儀表板**: 學生與老師可即時查看每日、每週的學習累積。

### 2. GitHub Classroom 作業系統
- **深度整合**: 每個單元可設定專屬 Github Classroom 邀請連結。
- **批改與反饋**: 老師可直接在 Dashboard 預覽作業進度、給予 0-100 評分並撰寫文字建議。

### 3. 多層級分潤與推薦 (Profit Sharing)
- **推薦代碼 (Promotion Code)**: 學生結帳時輸入導師代碼。
- **遞迴計算 (Recursive Sharing)**: 
    - 直接推廣者獲得 20% 分潤。
    - 其上級導師可獲得後者分潤金額的 20%，直到根結點 (Admin)。
- **為期一年**: 對於每位學生，分潤追蹤在初始訂閱後一年內有效。

### 4. 程式載體車子平台 (Hardware Platform)
- **實體商品銷售**: 整合課程與硬體 (入門款/進階款)。
- **物流整合**: 支援 7-11 門市電子地圖選取與收件人資訊蒐集。

## 🛠️ 操作使用說明 (Usage Guide)

### 對於導師與管理員 (Admin/Teacher)
1. **進入 Dashboard**: 登入後點擊右上角「儀表板」。
2. **作業批改**:
    - 在「作業 (Assignments)」標籤中查看所有學生提交。
    - 點擊「✍️ 評分」按鈕輸入分數與評語。
3. **分潤管理**:
    - 在「分潤 (Earnings)」標籤中查看您的月度累積佣金與當前使用的推薦代碼。
4. **權限授予**: 管理員可在 `view-admin` 控制台授權特定 Email 成為教師。

### 對於學生 (Student)
1. **選購課程**: 在 `cart.html` 加入課程或硬體。
2. **代碼驗證**: 結帳前輸入 Promotion Code 享受導師專業指導 (如有)。
3. **提交作業**:
    - 點擊單元下方的「作業連結/作業指引」進入 Github 完成程式開發。
    - 按下「提交作業」通知老師批改。

## 🚀 開發與部署 (DevOps)

### 環境變數
`functions/.env` 包含：
- `MAIL_USER` / `MAIL_PASS`: 告警與通知郵件發送。
- `ECPAY_MERCHANT_ID` / `HASH_KEY` / `HASH_IV`: 綠界金流密鑰。

### 部署命令
```bash
# 全域部署
firebase deploy --project e-learning-942f7

# 僅部署函數
firebase deploy --only functions --project e-learning-942f7
```

---
Vibe Coding &copy; 2026 | info@vibe-coding.tw
