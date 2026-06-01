(function () {
    // 1. 語系偵測邏輯
    function detectUiLocale() {
        try {
            const params = new URLSearchParams(window.location.search);
            const path = params.get('path');
            if (path) {
                const cleanPath = String(path).trim().toLowerCase();
                if (cleanPath.startsWith('en-')) return 'en';
                if (cleanPath.startsWith('tw-')) return 'zh-TW';
            }
        } catch (_) {}

        try {
            const stored = localStorage.getItem('vibe_user_locale');
            if (stored) {
                const clean = String(stored).trim().toLowerCase();
                if (clean.startsWith('zh')) return 'zh-TW';
                if (clean.startsWith('en')) return 'en';
            }
        } catch (_) {}

        try {
            const params = new URLSearchParams(window.location.search);
            const queryLang = params.get('lang') || params.get('locale');
            if (queryLang) {
                const clean = String(queryLang).trim().toLowerCase();
                if (clean.startsWith('zh')) return 'zh-TW';
                if (clean.startsWith('en')) return 'en';
            }
        } catch (_) {}

        const htmlLang = String(document.documentElement?.lang || "").toLowerCase();
        const navLang = String(navigator.language || "").toLowerCase();
        const raw = htmlLang || navLang;
        if (raw.startsWith("zh")) return "zh-TW";
        return "en";
    }

    const currentLocale = detectUiLocale();

    // 2. 統一中英對照字典
    const DICTIONARY = {
        "zh-TW": {
            // Document title fallback
            "doc_title_index": "Vibe Coding 教學網站",
            "doc_title_login": "Google 登入 - Vibe Coding",
            "doc_title_cart": "Vibe Coding 待結帳項目",
            "doc_title_payment_return": "付款結果 - Vibe Coding",
            "doc_title_dashboard": "學習儀表板 - Vibe Coding",

            // index.html
            "hero_title": "Vibe Coding",
            "hero_subtitle": "瞄準 AI 教育市場的藍海策略",
            "exec_summary_label": "執行摘要：我們正在彌合程式教育與實際應用的鴻溝。",
            "hero_desc": "本方案專注於提供創新且具體可見的 <b>Physical AI</b> 教育。透過實作、AI 輔助程式與業界標準的技術，我們不僅教授程式，更培養 AI 時代不可或缺的<b>邏輯思維與創造力</b>。",
            "learn_more_btn": "深入了解核心策略",
            "core_values_title": "Vibe Coding 核心價值主張",
            "value1_title": "實作與專案導向",
            "value1_desc": "彌合抽象程式概念與具體應用鴻溝，每堂課都有看得見、摸得著的成果。",
            "value2_title": "AI 輔助程式生成",
            "value2_desc": "運用 AI 輔助工具降低學習門檻，讓學員專注於邏輯與設計，而非語法細節。",
            "value3_title": "培養 AI 關鍵能力",
            "value3_desc": "著重於邏輯思維、問題解決與<b>創造力</b>，為未來職場打下堅實基礎。",
            "value4_title": "Physical AI 精神",
            "value4_desc": "強調 Physical AI 獨特的「實作」精神，讓學員在實作中體驗開發樂趣。",
            "ta_title": "Vibe Coding 的目標客群 (TA)",
            "ta_desc": "本方案主要鎖定<b>注重 Physical AI 實作</b>的相關教育，強調培養他們在 AI 時代的<b>實作</b>與<b>程式邏輯</b>核心能力。",
            "highlights_title": "✅ 產品亮點",
            "highlight1": "教學方法符合現代教育最佳實踐 (Project-Based Learning)。",
            "highlight2": "課程成果具體可見，提高學員成就感與學習興趣。",
            "highlight3": "導入 Vibe coding 技術，與市場上其他基礎課程形成差異。",
            "highlight_link": "BLE 搖桿實例",
            "competitor_title": "❌ 我們不只是 (排除市場競爭者)",
            "competitor1": "不只是單純的拖拉式程式積木教學，避免缺乏深度。",
            "competitor2": "不只停留在抽象理論，確保有實際硬體操作。",
            "competitor3": "不是無法提供師資培訓與系統化教材支持的單一產品。",
            "course_links_title": "課程連結",
            "prepare_title": "準備課程",
            "prepare_desc": "工欲善其事，必先利其器。協助您完成開發環境建置、硬體檢測與必要工具安裝，為學習之旅做好萬全準備。",
            "prepare_btn": "前往準備 &rarr;",
            "starter_title": "入門課程",
            "starter_desc": "從零開始掌握 UI/UX 設計原則與 API 整合技巧。透過簡單的模組化練習，輕鬆打造您的第一個互動式應用程式。",
            "starter_btn": "開始學習 &rarr;",
            "basic_title": "基礎課程",
            "basic_desc": "深入核心硬體控制，實作馬達精準驅動、藍牙通訊協定與 OTA 遠端更新，真正體驗軟硬體整合的開發魅力。",
            "basic_btn": "進入實作 &rarr;",
            "advanced_title": "進階課程",
            "advanced_desc": "挑戰 Physical AI 的極限！結合影像處理、物體辨識與邊緣運算，賦予您的 Vibe Racer 自動決策與智慧視覺能力。",
            "advanced_btn": "挑戰進階 &rarr;",

            // Google login
            "login_card_title": "使用 Google 帳號登入",
            "login_card_desc": "系統授權與課程存取統一使用 Google 帳號。",
            "login_card_desc_emulator": "本地模擬器模式：請點擊下方按鈕，在彈出視窗完成 Google 登入。",
            "login_google_btn": "使用 Google 登入",
            "login_redirect_text": "正在前往 Google...",
            "login_redirect_error": "無法自動跳轉 Google，請點擊下方按鈕登入。",
            "login_failed_text": "Google 登入失敗：",
            "login_interrupt_text": "Google 登入流程中斷，請再試一次。",
            "login_back_home": "← 返回首頁 (Back to Home)",

            // cart.html
            "cart_header_title": "待結帳項目",
            "login_fail_title": "登入失敗通知",
            "login_fail_desc": "您的登入嘗試失敗，原因可能為瀏覽器阻擋。我們已切換到「頁面重新導向」方式，請重新點擊登入。",
            "empty_cart_msg": "購物車是空的！請回到課程頁面選購。",
            "cart_total_label": "總金額 (TWD):",
            "shipping_info_title": "📦 收件與物流資訊 (實體商品必填)",
            "receiver_name_label": "收件人姓名",
            "receiver_name_placeholder": "請輸入真實姓名 (需核對證件)",
            "receiver_phone_label": "收件人手機",
            "receiver_phone_placeholder": "09xxxxxxxx",
            "pickup_store_label": "取貨門市",
            "store_display_placeholder": "尚未選擇門市",
            "btn_select_711": "選擇 7-11",
            "btn_select_fami": "選擇 全家",
            "btn_select_hilife": "選擇 萊爾富",
            "btn_select_ok": "選擇 OK",
            "checkout_btn_ecpay": "🔒 正在連接綠界金流...",
            "checkout_btn_redirect": "🚀 前往付款頁面...",
            "checkout_btn_pay": "💳 前往付款",
            "user_hello": "您好, {user}",
            "user_guest": "訪客模式",
            "nav_login": "登入 / 註冊",
            "nav_logout": "登出",
            "cart_item_code": "產品代號: {id}",
            "cart_item_remove": "移除",
            "currency_unit": "元",
            "alert_cart_empty": "購物車為空，無法結帳。",
            "alert_login_required": "請先登入才能進行付款！請點擊右上角按鈕登入。",
            "alert_shipping_required": "請完整填寫收件人姓名、手機並選擇取貨門市！",
            "alert_checkout_failed": "結帳失敗：",
            "alert_map_failed": "開啟電子地圖失敗，請稍後再試。",
            "prefill_invite_missing": "推薦連結缺少課程資訊，無法自動加入購物車。",
            "prefill_invite_added": "已將「{name}」加入購物車，您可以直接前往結帳。",
            "prefill_invite_exists": "「{name}」原本已在購物車中，已保留現有品項。",
            "prefill_invite_referral_ignored": "（已忽略推薦碼/連結參數，綁定導師請在作業頁輸入 Promotion code）",
            "referral_verification_loading": "驗證中...",
            "referral_btn_apply": "套用連結",
            "referral_unchanged": "未變更綁定：可先留白，或輸入有效 GitHub 專屬作業連結再套用。",
            "referral_url_invalid": "連結格式錯誤，請使用 GitHub 專屬作業連結：https://classroom.github.com/a/xxxxx",
            "referral_item_not_in_cart": "此老師作業連結對應的課程/單元不在目前購物車中",
            "referral_item_mismatch": "此老師作業連結不屬於目前這個課程項目",
            "referral_applied_success": "✅ 已套用老師作業連結：{name}",

            // payment-return.html
            "pay_success_header": "付款成功！",
            "pay_success_desc": "感謝您的購買，您的課程權限已開通。",
            "pay_order_status_label": "訂單狀態：",
            "pay_order_status_paid": "已付款",
            "pay_next_step_label": "下一步：",
            "pay_next_step_desc": "您現在可以前往課程頁面開始學習。",
            "pay_note_label": "注意：",
            "pay_note_desc": "若您剛完成付款，權限開通可能需要 1-2 分鐘的系統處理時間。",
            "pay_btn_start": "🎓 立即開始上課",
            "pay_btn_home": "回首頁",
            "pay_failed_header": "付款處理異常",
            "pay_failed_desc": "錯誤代碼: {msg}，請聯絡客服。",
            "pay_clearing_cart_log": "付款完成，正在清空本地購物車...",

            // dashboard.html / dashboard.js static navigation
            "dash_sidebar_learn": "學習專區",
            "dash_sidebar_settings": "帳號設定",
            "dash_sidebar_tutor": "導師專區",
            "dash_sidebar_earnings": "分潤提領",
            "dash_header_title": "學習儀表板",
            "dash_loading": "載入儀表板中...",
            "dash_logout": "登出系統",
            "dash_back_home": "回首頁",

            // dashboard.js dynamic labels
            "dash_tab_assignments": "我的作業",
            "dash_tab_orders": "訂單紀錄",
            "dash_tab_tutor_students": "學員管理",
            "dash_tab_tutor_shipments": "履約管理",
            "dash_tab_tutor_earnings": "收益提領",
            "dash_order_id": "訂單編號",
            "dash_order_amount": "金額",
            "dash_order_status": "狀態",
            "dash_order_date": "付款時間",
            "dash_order_status_success": "已付款",
            "dash_order_status_pending": "待付款",
            "dash_order_status_failed": "付款失敗",
            "dash_no_orders": "尚無付款訂單紀錄。",
            "dash_no_assignments": "目前沒有已指派的作業。請先到「學習路徑」加入並開啟您的第一堂課程！",
            "dash_tutor_invite_binding_title": "🔗 導師與學員 Promotion code 綁定工具",
            "dash_tutor_invite_binding_desc": "在下方欄位輸入導師提供的專屬 Promotion code（或 GitHub 作業邀請連結），即可完成師生綁定。之後每次 PUSH 作業時，導師將可提供精準的線上 Code Review 指引。",
            "dash_tutor_invite_btn_bind": "進行綁定",
            "dash_tutor_invite_btn_binding": "驗證中...",
            "dash_tutor_invite_input_placeholder": "輸入導師 Promotion code 或 GitHub 作業連結...",
            "dash_tutor_invite_status_empty": "未變更綁定。如需綁定，請輸入代碼後點擊綁定。",

            // Extra Dashboard Labels (Student/Tutor View)
            "dash_tab_overview": "概覽 (Overview)",
            "dash_tab_tutors": "導師管理 (Tutor)",
            "dash_tab_shipments": "履約管理 (Fulfillment)",
            "dash_tab_settings": "課程設定 (Settings)",
            "dash_shipments_title": "履約管理 (Fulfillment Management)",
            "dash_denied_title": "⛔ 權限不足",
            "dash_denied_title_admin_only": "⛔ 僅限管理員",
            "dash_denied_msg": "只有管理員、該單元合格導師，或該單元已付款學生可以存取此頁面。",
            "dash_denied_msg_admin_only": "未指定課程單元時，只有管理員可以存取 Dashboard。",
            "dash_hello_guest": "👋 您好！閣下尚未登入",
            "dash_guest_msg": "本頁面為個人學習儀表板，請登入以查看您的數據。",
            "dash_login_btn": "🚀 立即登入 (Login)",
            "dash_my_learning_profile": "我的學習概況",
            "dash_view_all_courses": "← 查看所有課程",
            "dash_unit_learning_hours": "本單元學習時數",
            "dash_learning_hours": "學習時數",
            "dash_hours_unit": "小時",
            "dash_assignments_submitted": "作業繳交",
            "dash_submitted_unit": "份",
            "dash_account_status": "帳號狀態",
            "dash_account_active": "啟用 (Active)",
            "dash_kit_shipment": "實體教材履約",
            "dash_shipped": "已履約完成",
            "dash_preparing": "準備中",
            "dash_my_shipments": "我的履約狀態 (My Fulfillment)",
            "dash_shipment_order": "訂單",
            "dash_shipment_receiver": "收件人",
            "dash_shipment_phone": "電話",
            "dash_shipment_address": "履約地址",
            "dash_th_shipping_info": "收件資訊",
            "dash_th_address_amount": "履約地址 / 金額",
            "dash_status": "狀態",
            "dash_to_ship": "待履約",
            "dash_my_assignments": "我的作業 (My Assignments)",
            "dash_assignment_name": "作業名稱",
            "dash_submitted_time": "提交時間",
            "dash_score": "分數",
            "dash_feedback": "評語",
            "dash_graded": "已評分",
            "dash_no_assignments_submitted": "此課程尚無繳交作業",
            "not_provided": "未提供",
            "dash_loading_readme": "正在抓取 GitHub 任務說明 (README.md)...",
            "dash_learning_distribution": "學習分佈",
            "dash_course_progress_details": "課程進度詳情",
            "dash_no_learning_records": "尚無學習紀錄",
            "status_in_progress": "進行中",
            "status_submitted": "待評分",
            "status_graded": "已評分",
            "status_blocked": "🔴 遭遇卡點",
            "status_coaching": "🟡 導師引導中",
            "status_resolved": "🟢 已解決"
        },
        "en": {
            // Document title fallback
            "doc_title_index": "Vibe Coding Learning Platform",
            "doc_title_login": "Google Login - Vibe Coding",
            "doc_title_cart": "Vibe Coding Shopping Cart",
            "doc_title_payment_return": "Payment Result - Vibe Coding",
            "doc_title_dashboard": "Learning Dashboard - Vibe Coding",

            // index.html
            "hero_title": "Vibe Coding",
            "hero_subtitle": "A Blue Ocean Strategy Targeting the AI Education Market",
            "exec_summary_label": "Executive Summary: We bridge the gap between programming education and practical application.",
            "hero_desc": "This program focuses on providing innovative and tangible <b>Physical AI</b> education. Through hands-on practice, AI-assisted programming, and industry-standard technologies, we do not just teach coding; we nurture the <b>logical thinking and creativity</b> essential in the AI era.",
            "learn_more_btn": "Understand Core Strategy",
            "core_values_title": "Vibe Coding Core Value Propositions",
            "value1_title": "Hands-on & Project-Oriented",
            "value1_desc": "Bridge the gap between abstract programming concepts and concrete applications. Every lesson yields a visible, touchable result.",
            "value2_title": "AI-Assisted Code Generation",
            "value2_desc": "Leverage AI assistance to lower learning barriers, allowing students to focus on logic and design rather than syntax details.",
            "value3_title": "Nurture Key AI Capabilities",
            "value3_desc": "Focus on logical thinking, problem-solving, and <b>creativity</b> to build a solid foundation for future careers.",
            "value4_title": "Physical AI Spirit",
            "value4_desc": "Emphasize the unique \"hands-on\" spirit of Physical AI, enabling students to experience the joy of development in practice.",
            "ta_title": "Vibe Coding Target Audience (TA)",
            "ta_desc": "This program primarily targets education that emphasizes <b>Physical AI implementation</b>, cultivating their hands-on and programming logic capabilities in the AI era.",
            "highlights_title": "✅ Product Highlights",
            "highlight1": "Teaching methods align with modern education best practices (Project-Based Learning).",
            "highlight2": "Unit milestones are visible and tangible, boosting students' sense of achievement and interest.",
            "highlight3": "Integrates Vibe Coding techniques, distinguishing it from other basic units in the market.",
            "highlight_link": "BLE Joystick Example",
            "competitor_title": "❌ We Are Not Just (Excluding Competitors)",
            "competitor1": "Not just simple drag-and-drop block coding, avoiding lack of depth.",
            "competitor2": "Not just abstract theory, ensuring hands-on hardware operation.",
            "competitor3": "Not a standalone product unable to provide tutor training and systematic material support.",
            "course_links_title": "Unit Tracks",
            "prepare_title": "Preparation Unit",
            "prepare_desc": "A craftsman must sharpen his tools. We help you set up your development environment, check hardware, and install necessary tools to fully prepare for your learning journey.",
            "prepare_btn": "Go Prepare &raquo;",
            "starter_title": "Starter Unit",
            "starter_desc": "Master UI/UX design principles and API integration from scratch. Build your first interactive application through simple modular exercises.",
            "starter_btn": "Start Learning &raquo;",
            "basic_title": "Basic Unit",
            "basic_desc": "Dive into core hardware control. Implement precise motor drives, BLE communication protocols, and OTA remote updates to experience true hardware-software integration.",
            "basic_btn": "Enter Practice &raquo;",
            "advanced_title": "Advanced Unit",
            "advanced_desc": "Challenge the limits of Physical AI! Combine image processing, object recognition, and edge computing to give your Vibe Racer autonomous decision-making and smart vision.",
            "advanced_btn": "Challenge Advanced &raquo;",

            // Google login
            "login_card_title": "Sign in with Google Account",
            "login_card_desc": "System authorization and unit access are unified under Google Account.",
            "login_card_desc_emulator": "Local Emulator Mode: Please click the button below to complete Google sign-in in a popup window.",
            "login_google_btn": "Sign in with Google",
            "login_redirect_text": "Redirecting to Google...",
            "login_redirect_error": "Unable to redirect to Google automatically. Click the button below to sign in.",
            "login_failed_text": "Google sign-in failed: ",
            "login_interrupt_text": "Google login flow was interrupted. Please try again.",
            "login_back_home": "← Back to Home",

            // cart.html
            "cart_header_title": "Shopping Cart",
            "login_fail_title": "Login Failure",
            "login_fail_desc": "Your login attempt failed, possibly due to browser blocking. We have switched to 'page redirect' mode, please click login again.",
            "empty_cart_msg": "Your shopping cart is empty! Go to the unit listing page to add units.",
            "cart_total_label": "Total (USD):",
            "shipping_info_title": "📦 Shipping & Logistics Info (Required for Physical Goods)",
            "receiver_name_label": "Receiver Name",
            "receiver_name_placeholder": "Enter real name (matching ID for pickup verification)",
            "receiver_phone_label": "Receiver Phone",
            "receiver_phone_placeholder": "09xxxxxxxx",
            "pickup_store_label": "Pickup Store",
            "store_display_placeholder": "No store selected yet",
            "btn_select_711": "Select 7-11",
            "btn_select_fami": "Select FamilyMart",
            "btn_select_hilife": "Select Hi-Life",
            "btn_select_ok": "Select OK Mart",
            "checkout_btn_ecpay": "🔒 Connecting to ECPay Gate...",
            "checkout_btn_redirect": "🚀 Redirecting to Gateway...",
            "checkout_btn_pay": "💳 Proceed to Payment",
            "user_hello": "Hello, {user}",
            "user_guest": "Guest Mode",
            "nav_login": "Login / Register",
            "nav_logout": "Logout",
            "cart_item_code": "Product Code: {id}",
            "cart_item_remove": "Remove",
            "currency_unit": "USD",
            "alert_cart_empty": "Your cart is empty. Cannot checkout.",
            "alert_login_required": "Please log in first to make payment! Click the top-right button to log in.",
            "alert_shipping_required": "Please complete recipient name, phone, and select a pickup store!",
            "alert_checkout_failed": "Checkout failed: ",
            "alert_map_failed": "Failed to open map. Please try again later.",
            "prefill_invite_missing": "The invite link is missing unit parameters. Cannot add to cart.",
            "prefill_invite_added": "Added \"{name}\" to your cart. You can proceed to checkout.",
            "prefill_invite_exists": "\"{name}\" was already in your cart. Preserved existing item.",
            "prefill_invite_referral_ignored": "（Ignored referral code parameters. Enter Promotion code on the assignment page to bind a tutor.）",
            "referral_verification_loading": "Verifying...",
            "referral_btn_apply": "Apply Link",
            "referral_unchanged": "Unchanged. Leave blank, or enter a valid GitHub classroom invite link to apply.",
            "referral_url_invalid": "Invalid format. Please use a GitHub classroom invite link: https://classroom.github.com/a/xxxxx",
            "referral_item_not_in_cart": "The unit associated with this tutor invite link is not in your cart.",
            "referral_item_mismatch": "This tutor invite link does not match the current unit item.",
            "referral_applied_success": "✅ Applied tutor invite link: {name}",

            // payment-return.html
            "pay_success_header": "Payment Successful!",
            "pay_success_desc": "Thank you for your purchase! Your unit access has been activated.",
            "pay_order_status_label": "Order Status: ",
            "pay_order_status_paid": "Paid",
            "pay_next_step_label": "Next Step: ",
            "pay_next_step_desc": "You can now proceed to your units to start learning.",
            "pay_note_label": "Note: ",
            "pay_note_desc": "If you just finished payment, it may take 1-2 minutes for the system to process and activate your authorization.",
            "pay_btn_start": "🎓 Start Learning Now",
            "pay_btn_home": "Back to Home",
            "pay_failed_header": "Payment Exception",
            "pay_failed_desc": "Error code: {msg}, please contact customer support.",
            "pay_clearing_cart_log": "Payment completed, clearing local cart...",

            // dashboard.html / dashboard.js static navigation
            "dash_sidebar_learn": "Learning Zone",
            "dash_sidebar_settings": "Account Settings",
            "dash_sidebar_tutor": "Tutor Zone",
            "dash_sidebar_earnings": "Earnings",
            "dash_header_title": "Learning Dashboard",
            "dash_loading": "Loading dashboard...",
            "dash_logout": "Logout",
            "dash_back_home": "Home",

            // dashboard.js dynamic labels
            "dash_tab_assignments": "Assignments",
            "dash_tab_orders": "Orders",
            "dash_tab_tutor_students": "Student Management",
            "dash_tab_tutor_shipments": "Fulfillment Management",
            "dash_tab_tutor_earnings": "Earnings Settlement",
            "dash_order_id": "Order ID",
            "dash_order_amount": "Amount",
            "dash_order_status": "Status",
            "dash_order_date": "Paid Date",
            "dash_order_status_success": "Paid",
            "dash_order_status_pending": "Pending",
            "dash_order_status_failed": "Failed",
            "dash_no_orders": "No orders found.",
            "dash_no_assignments": "No assigned tasks yet. Go to the \"Learning Path\" to enroll and start your first unit!",
            "dash_tutor_invite_binding_title": "🔗 Tutor & Student Promotion Code Binder",
            "dash_tutor_invite_binding_desc": "Enter the Promotion code (or GitHub Classroom invite link) provided by your tutor below to complete binding. Once bound, your tutor will be able to review your code and write comments on GitHub for every push.",
            "dash_tutor_invite_btn_bind": "Bind Code",
            "dash_tutor_invite_btn_binding": "Binding...",
            "dash_tutor_invite_input_placeholder": "Enter tutor code or classroom invite link...",
            "dash_tutor_invite_status_empty": "Unbound. Enter a code and click bind to proceed.",
            
            // Extra Dashboard Labels (Student/Tutor View)
            "dash_tab_overview": "Overview",
            "dash_tab_tutors": "Tutor Management",
            "dash_tab_shipments": "Fulfillment Management",
            "dash_tab_settings": "Settings",
            "dash_shipments_title": "Fulfillment Management",
            "dash_denied_title": "⛔ Access Denied",
            "dash_denied_title_admin_only": "⛔ Admin Only",
            "dash_denied_msg": "Only administrators, qualified tutors, or paid students for this unit can access this page.",
            "dash_denied_msg_admin_only": "Only administrators can access the Dashboard when no unit is specified.",
            "dash_hello_guest": "👋 Hello! You are not logged in",
            "dash_guest_msg": "This page is your personal learning dashboard. Please log in to view your data.",
            "dash_login_btn": "🚀 Login Now",
            "dash_my_learning_profile": "My Learning Profile",
            "dash_view_all_courses": "← View All Units",
            "dash_unit_learning_hours": "Unit Learning Hours",
            "dash_learning_hours": "Learning Hours",
            "dash_hours_unit": "hours",
            "dash_assignments_submitted": "Assignments Submitted",
            "dash_submitted_unit": "submitted",
            "dash_account_status": "Account Status",
            "dash_account_active": "Active",
            "dash_kit_shipment": "Physical Kit Fulfillment",
            "dash_shipped": "Fulfilled",
            "dash_preparing": "Preparing",
            "dash_my_shipments": "My Fulfillment",
            "dash_shipment_order": "Order",
            "dash_shipment_receiver": "Receiver",
            "dash_shipment_phone": "Phone",
            "dash_shipment_address": "Fulfillment Address",
            "dash_th_shipping_info": "Receiver Info",
            "dash_th_address_amount": "Fulfillment Address / Amount",
            "dash_status": "Status",
            "dash_to_ship": "To Fulfill",
            "dash_my_assignments": "My Assignments",
            "dash_assignment_name": "Assignment Name",
            "dash_submitted_time": "Submitted Time",
            "dash_score": "Score",
            "dash_feedback": "Feedback",
            "dash_graded": "Graded",
            "dash_no_assignments_submitted": "No assignments submitted for this unit.",
            "not_provided": "Not provided",
            "dash_loading_readme": "Fetching GitHub instructions (README.md)...",
            "dash_learning_distribution": "Learning Distribution",
            "dash_course_progress_details": "Unit Progress Details",
            "dash_no_learning_records": "No learning records found.",
            "status_in_progress": "In Progress",
            "status_submitted": "Pending Grade",
            "status_graded": "Graded",
            "status_blocked": "🔴 Blocked",
            "status_coaching": "🟡 Guided",
            "status_resolved": "🟢 Resolved"
        }
    };

    // 3. 全局字串翻譯函數
    window.t = function (key, fallback) {
        const localeDict = DICTIONARY[currentLocale];
        if (localeDict && localeDict[key] !== undefined) {
            return localeDict[key];
        }
        return fallback !== undefined ? fallback : key;
    };

    // 4. 動態翻譯 DOM 元素
    window.applyI18n = function () {
        const localeDict = DICTIONARY[currentLocale];
        if (!localeDict) return;

        // 設定 html 屬性 lang
        document.documentElement.lang = currentLocale === "zh-TW" ? "zh-Hant" : "en";

        // 翻譯網頁 document.title
        const bodyTag = document.body;
        if (bodyTag) {
            const pageDocTitleKey = bodyTag.dataset.i18nDocTitle;
            if (pageDocTitleKey && localeDict[pageDocTitleKey]) {
                document.title = localeDict[pageDocTitleKey];
            }
        }

        // 翻譯 textContent / innerHTML
        const transElements = document.querySelectorAll("[data-i18n]");
        transElements.forEach((el) => {
            const key = el.dataset.i18n;
            const trans = localeDict[key];
            if (trans !== undefined) {
                if (el.dataset.i18nHtml === "true") {
                    el.innerHTML = trans;
                } else {
                    el.textContent = trans;
                }
            }
        });

        // 翻譯 placeholder 屬性
        const placeholderElements = document.querySelectorAll("[data-i18n-placeholder]");
        placeholderElements.forEach((el) => {
            const key = el.dataset.i18nPlaceholder;
            const trans = localeDict[key];
            if (trans !== undefined) {
                el.placeholder = trans;
            }
        });

        // 翻譯 title 屬性
        const titleElements = document.querySelectorAll("[data-i18n-title]");
        titleElements.forEach((el) => {
            const key = el.dataset.i18nTitle;
            const trans = localeDict[key];
            if (trans !== undefined) {
                el.title = trans;
            }
        });

        // 翻譯 alt 屬性
        const altElements = document.querySelectorAll("[data-i18n-alt]");
        altElements.forEach((el) => {
            const key = el.dataset.i18nAlt;
            const trans = localeDict[key];
            if (trans !== undefined) {
                el.alt = trans;
            }
        });
    };

    // 5. 自動在 DOMContentLoaded 觸發
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", window.applyI18n);
    } else {
        window.applyI18n();
    }
})();
