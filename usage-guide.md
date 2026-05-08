# 🛠️ Vibe Coding 操作使用說明 (Usage Guide)

本文件整理了 Vibe Coding 平台的完整操作流程，包含付款、導師指派、作業提交及常見問題說明。

---

## 0. 付款、老師指派、作業與推薦的正式流程

本節說明系統後端自動化處理的核心邏輯，確保學生在購買課程後能獲得正確的導師指導。

1. **推薦連結輸入**：學生在 `cart.html` 結帳前，可輸入老師提供的 GitHub Classroom 作業連結。
2. **連結驗證**：前端先呼叫 `verifyReferralLink` 驗證連結，成功後會將該連結綁定到對應的購物車項目，並記錄其 `referralLink` 與 `referredTutorEmail`。
3. **付款與自動指派**：綠界付款成功後，後端 `paymentNotify` 會執行：
   - 將訂單標記為 `SUCCESS`。
   - **自動連動指派 (Cascade Assignment)**：若推薦連結對應單元 A，且該項目為包含單元 A 的全套課程，則系統自動將該項目的 **所有單元** 指派給該位老師，確保學習路徑不中斷。
   - 自動寄送付款成功及老師指派成功的 Email 通知。
4. **作業權限檢查**：學生在課程頁或 Dashboard 點擊作業時，前端呼叫 `resolveAssignmentAccess`：
   - **未付款**：不開放作業入口。
   - **已付款但未指派老師**：跳出對話框要求輸入「老師提供的作業連結」。驗證後執行 `bindTutorToUnit` 完成綁定並開放入口。
   - **已付款且已指派老師**：回傳該老師對應的 GitHub Classroom 連結。
5. **作業提交限制**：只有在完成老師指派後，`submitAssignment` 才允許建立紀錄。
6. **評分與認證**：只有該單元的 `assignedTeacherEmail` 對應老師或 Admin 可以進行評分，並有權限推薦學生成為合格教師。
7. **師資申請**：老師推薦學生後，系統建立 `tutor_applications` 待審資料並通知 Admin；審核結果會透過 Email 通知學生。

---

## 🚀 完整課程使用指南 (五大步驟)

根據 [faq.html](file:///Users/roverchen/Documents/Apps/vibe-coding-tw/public/faq.html) 的說明，學生的基本使用路徑如下：

### 1. 註冊 / 登入會員
點擊右上角「登入」，支援 **Google 快速登入** 或 Email 註冊。
> ✨ **新手好禮**：首次註冊後，可獲得一個月的入門課程免費體驗期。

### 2. 瀏覽並挑選課程
前往 [入門課程](file:///Users/roverchen/Documents/Apps/vibe-coding-tw/public/started.html) 或 [基礎實作](file:///Users/roverchen/Documents/Apps/vibe-coding-tw/public/basic.html) 頁面挑選合適單元。

### 3. 加入購物車
點擊「🛒 加入購物車」按鈕。支援一次購買多堂課程並統一結帳。

### 4. 確認訂單與付款
在購物車點擊「前往付款」，系統跳轉至 **綠界科技 ECPay** 安全支付頁面，支援信用卡或 ATM 轉帳。

### 5. 立刻開始學習
付款成功後自動開通權限。課程頁按鈕會變更為「進入課程內容」，點擊即可開始上課。

---

## ❓ 常見問題 (FAQ) Summary

### Q: 完成購買後，該如何上課?
登入帳號後，前往課程頁面，點擊由「加入購物車」轉變成的 **「進入課程內容」** 按鈕即可。

### Q: 課程的使用期限？
完成付款後，擁有 **一年的課程使用權限**。系統會為您分配一位指導老師。

### Q: 老師會提供什麼協助？
- 線上問題解答與技術指導。
- 批改作業並提供優化反饋。
- 協助 GitHub Classroom 上的實作挑戰。

### Q: 如何購買硬體教材？
在 [課前準備](file:///Users/roverchen/Documents/Apps/vibe-coding-tw/public/prepare.html) 頁面可加購 ESP32 套件或實作車。支援超商取貨，通常於付款後 2 個工作天內出貨。

### Q: 如何追蹤學習進度？
在「課程儀表板 (Dashboard)」中可查看 **學習時數統計** 及 **作業批改狀態**。

---

## 📧 聯絡與支援
如有任何操作疑問或權限問題，請聯繫：
- **客服信箱**：[info@vibe-coding.tw](mailto:info@vibe-coding.tw)
- **課前準備事項**：[查看清單](file:///Users/roverchen/Documents/Apps/vibe-coding-tw/public/prepare.html)
