(function () {
    // 1. 語系偵測邏輯
    function normalizeLocaleCode(value = "") {
        return String(value || "").trim().replace(/_/g, "-");
    }

    function getContentRuntimeConfig() {
        const defaults = {
            defaultLocale: "en",
            supportedLocales: ["zh-TW", "en"],
            localeLabels: { "zh-TW": "繁體中文", "en": "English" },
            localeFallbackMap: { "zh-TW": "zh-TW", "en": "en" }
        };
        const runtime = window.__vibeContentRuntimeConfig && typeof window.__vibeContentRuntimeConfig === "object"
            ? window.__vibeContentRuntimeConfig
            : {};
        return {
            ...defaults,
            ...runtime,
            supportedLocales: Array.isArray(runtime.supportedLocales) && runtime.supportedLocales.length
                ? runtime.supportedLocales.map((locale) => normalizeLocaleCode(locale)).filter(Boolean)
                : defaults.supportedLocales,
            localeLabels: {
                ...defaults.localeLabels,
                ...(runtime.localeLabels && typeof runtime.localeLabels === "object" ? runtime.localeLabels : {})
            },
            localeFallbackMap: {
                ...defaults.localeFallbackMap,
                ...(runtime.localeFallbackMap && typeof runtime.localeFallbackMap === "object" ? runtime.localeFallbackMap : {})
            }
        };
    }

    function resolveLocaleCandidates(locale = "") {
        const normalized = normalizeLocaleCode(locale);
        const runtime = getContentRuntimeConfig();
        const candidates = [];
        const push = (value) => {
            const clean = normalizeLocaleCode(value);
            if (clean && !candidates.includes(clean)) candidates.push(clean);
        };

        push(normalized);
        push(runtime.localeFallbackMap?.[normalized]);
        if (normalized.startsWith("zh")) {
            push("zh-TW");
            push("zh");
            push("zh-Hant");
        }
        if (normalized.startsWith("en")) {
            push("en");
        }
        push(runtime.defaultLocale);
        push("zh-TW");
        push("en");
        return candidates;
    }

    function resolveDictionaryLocale(locale = "") {
        const runtime = getContentRuntimeConfig();
        const candidates = resolveLocaleCandidates(locale);
        for (const candidate of candidates) {
            if (Object.prototype.hasOwnProperty.call(DICTIONARY, candidate)) return candidate;
        }
        const fallback = normalizeLocaleCode(runtime.localeFallbackMap?.[normalizeLocaleCode(locale)] || "");
        if (fallback && Object.prototype.hasOwnProperty.call(DICTIONARY, fallback)) return fallback;
        if (String(locale || "").toLowerCase().startsWith("zh")) return "zh-TW";
        return "en";
    }

    function resolveLocalizedFieldValue(source = {}, field = "", locale = currentLocale, fallback = "") {
        const rawSource = source && typeof source === "object" ? source : {};
        const i18n = rawSource.i18n && typeof rawSource.i18n === "object" && !Array.isArray(rawSource.i18n)
            ? rawSource.i18n
            : {};
        const candidates = resolveLocaleCandidates(locale);
        const normalizedField = String(field || "").trim();
        const isEn = String(locale || "").toLowerCase().startsWith("en");
        const legacyFields = {
            title: isEn ? ["titleEn", "title"] : ["title", "titleEn"],
            summary: isEn
                ? ["summaryEn", "descriptionEn", "summary", "description", "tagText"]
                : ["summary", "description", "tagText", "summaryEn", "descriptionEn"],
            description: isEn ? ["descriptionEn", "description"] : ["description", "descriptionEn"],
            lessonLabel: isEn ? ["lessonLabelEn", "lessonLabel", "tagText"] : ["lessonLabel", "tagText", "lessonLabelEn"],
            coreContent: isEn ? ["coreContentEn", "coreContent"] : ["coreContent", "coreContentEn"]
        }[normalizedField] || [normalizedField];

        for (const candidate of candidates) {
            const bucket = i18n[candidate];
            if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) continue;
            const value = bucket[normalizedField];
            if (Array.isArray(value) && value.length) return value;
            if (typeof value === "string" && value.trim()) return value.trim();
        }

        for (const legacyField of legacyFields) {
            const value = rawSource[legacyField];
            if (Array.isArray(value) && value.length) return value;
            if (typeof value === "string" && value.trim()) return value.trim();
        }

        return fallback;
    }

    function detectUiLocale() {
        try {
            const pathname = window.location.pathname;
            if (pathname.includes('/en/')) return 'en';
            if (pathname.includes('/tw/') || pathname.includes('/zh-TW/')) return 'zh-TW';
            const filename = pathname.split('/').pop() || '';
            if (filename.startsWith('en-')) return 'en';
            if (filename.startsWith('tw-')) return 'zh-TW';
        } catch (_) {}

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
                const clean = normalizeLocaleCode(stored);
                if (clean) return clean;
            }
        } catch (_) {}

        try {
            const params = new URLSearchParams(window.location.search);
            const queryLang = params.get('lang') || params.get('locale');
            if (queryLang) {
                const clean = normalizeLocaleCode(queryLang);
                if (clean) return clean;
            }
        } catch (_) {}

        const htmlLang = String(document.documentElement?.lang || "").toLowerCase();
        const navLang = String(navigator.language || "").toLowerCase();
        const raw = htmlLang || navLang;
        if (raw.startsWith("zh")) return "zh-TW";
        if (raw) return normalizeLocaleCode(raw);
        return normalizeLocaleCode(getContentRuntimeConfig().defaultLocale || "en");
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
            "nav_students_label": "學員指南",
            "nav_tutors_label": "導師合作",
            "footer_home": "首頁",
            "footer_learning_path": "學習路徑",
            "footer_student_guide": "學員指南",
            "footer_tutor_guide": "導師合作",
            "footer_business_entity": "營業人",
            "footer_company_name": "腳丫健康科技有限公司",
            "footer_tax_id": "統編",
            "footer_contact_us": "聯絡我們",

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
            "prepare_title": "課前準備",
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
            "cart_total_label": "總金額:",
            "cart_total_with_currency": "總金額 ({currency}，含稅含運):",
            "cart_total_no_currency": "總金額（含稅含運）:",
            "cart_subtotal_label": "商品小計:",
            "cart_shipping_label": "運費:",
            "cart_tax_label": "稅額:",
            "routing_title": "地區與經銷商偏好",
            "routing_desc": "選擇你的地區後，系統會推薦最適合的經銷商；你可以手動切換，並把偏好保存到帳號。",
            "routing_summary_title": "目前選擇",
            "routing_region_label": "地區 Region",
            "routing_distributor_label": "經銷商 Distributor",
            "routing_step_region_label": "1. 地區 Region",
            "routing_step_distributor_label": "2. 經銷商 Distributor",
            "routing_current_region_label": "目前地區",
            "routing_current_distributor_label": "目前經銷商",
            "routing_source_label": "來源",
            "routing_reason_label": "推薦原因",
            "routing_quick_guide": "先選地區，再選經銷商。系統會自動帶入建議值。",
            "routing_save_btn": "儲存偏好",
            "routing_status_init": "先選地區，再選經銷商。",
            "routing_select_region_placeholder": "-- 請選擇地區 --",
            "routing_select_distributor_placeholder": "-- 請先選擇地區 --",
            "routing_recommended": "推薦",
            "routing_manual_select": "請手動選擇",
            "routing_no_distributor": "無可用經銷商",
            "routing_sys_recommend": "系統推薦：{name}",
            "routing_prompt_select": "請先選擇地區與經銷商。",
            "routing_load_failed_fallback": "無法載入推薦清單，已載入預設地區設定。",
            "routing_save_empty": "請至少選擇地區或經銷商。",
            "routing_save_success": "偏好已儲存。",
            "routing_save_local_success": "偏好已儲存（僅限本機）。",
            "routing_guest_loaded": "訪客模式：已載入預設地區設定。",
            "routing_save_failed": "儲存偏好失敗。",
            "routing_selected_unsaved": "已選擇經銷商，尚未儲存到帳號。",
            "routing_select_distributor_prompt": "請選擇經銷商。",
            "routing_source_manual": "手動選擇",
            "routing_source_auto": "系統自動帶入",
            "routing_source_checkout": "結帳後記錄",
            "routing_source_local": "本機預設",
            "routing_source_region_default": "地區預設",
            "routing_source_last_success": "上次成功付款",
            "routing_source_guest_local": "訪客預設",
            "routing_source_shipping": "依收件地帶入",
            "routing_source_unknown": "系統預設",
            "routing_reason_region_default": "依地區預設",
            "routing_reason_region_backup": "依地區備援",
            "routing_reason_single_match": "地區唯一經銷商",
            "routing_reason_multiple_matches": "同地區多經銷商，請手動選擇",
            "routing_reason_user_binding": "依你的已儲存偏好",
            "routing_reason_promotion": "依 Promotion code",
            "routing_reason_explicit": "依你手動選擇",
            "routing_reason_guest_local": "訪客預設",
            "routing_reason_checkout": "結帳時自動帶入",
            "routing_reason_shipping": "依收件地預設",
            "routing_reason_unknown": "系統預設",
            "routing_shipping_prefilled": "系統已依收件地預設為 {region}。",
            "routing_manual_locked_shipping": "目前地區已由你手動鎖定；若要依收件地調整，請重新選擇地區。",
            "shipping_country_label": "國家 / 地區",
            "shipping_country_placeholder": "-- 選擇國家 --",
            "shipping_country_us": "美國 (United States)",
            "shipping_country_ca": "加拿大 (Canada)",
            "shipping_country_jp": "日本 (Japan)",
            "shipping_country_sg": "新加坡 (Singapore)",
            "shipping_country_hk": "香港 (Hong Kong)",
            "shipping_country_my": "馬來西亞 (Malaysia)",
            "shipping_state_label": "州 / 省",
            "shipping_state_placeholder": "例如：台灣或 CA",
            "shipping_city_label": "城市",
            "shipping_city_placeholder": "例如：台北市",
            "shipping_line1_label": "詳細地址 1",
            "shipping_line1_placeholder": "街道名稱、門牌號碼",
            "shipping_zip_label": "郵遞區號",
            "shipping_zip_placeholder": "例如：100",
            "shipping_line2_label": "詳細地址 2 (選填)",
            "shipping_line2_placeholder": "大樓名稱、樓層、室等",
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
            "prefill_invite_referral_ignored": "（已忽略推薦碼/連結參數，綁定導師請在作業頁輸入授課老師 Email）",
            "referral_verification_loading": "驗證中...",
            "referral_btn_apply": "套用連結",
            "referral_unchanged": "未變更綁定：可先留白，或輸入老師提供的作業連結再套用。",
            "referral_url_invalid": "連結格式錯誤，請使用老師提供的作業連結。",
            "referral_item_not_in_cart": "此作業連結對應的課程/單元不在目前購物車中",
            "referral_item_mismatch": "此作業連結不屬於目前這個課程項目",
            "referral_applied_success": "✅ 已套用作業連結：{name}",

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
            "dash_header_title": "儀表板 (Dashboard)",
            "dash_close_btn": "關閉",
            "dash_loading": "載入儀表板中...",
            "dash_logout": "登出系統",
            "dash_back_home": "回首頁",
            "dash_assignments_title": "作業批改 (Assignments)",
            "dash_th_student_name": "學生",
            "dash_th_assignment_unit": "作業/單元",
            "dash_th_time": "時間",
            "dash_th_action": "操作",

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
            "dash_tutor_invite_binding_title": "🔗 導師與學員 Email 綁定工具",
            "dash_tutor_invite_binding_desc": "在下方欄位輸入導師的 Email 帳號（或作業邀請連結），即可完成師生綁定。之後每次 PUSH 作業時，導師將可提供精準的線上 Code Review 指引。",
            "dash_tutor_invite_btn_bind": "進行綁定",
            "dash_tutor_invite_btn_binding": "驗證中...",
            "dash_tutor_invite_input_placeholder": "輸入導師 Email 或作業邀請連結...",
            "dash_tutor_invite_status_empty": "未變更綁定。如需綁定，請輸入代碼後點擊綁定。",

            // Extra Dashboard Labels (Student/Tutor View)
            "dash_tab_overview": "概覽 (Overview)",
            "dash_tab_tutors": "導師管理 (Tutor)",
            "dash_tab_shipments": "履約管理 (Fulfillment)",
            "dash_tab_settings": "系統設定",
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
            "dash_assignment_no_link": "此作業無連結",
            "not_provided": "未提供",
            "dash_loading_readme": "正在讀取課程頁內容...",
            "dash_learning_distribution": "學習分佈",
            "dash_course_progress_details": "課程進度詳情",
            "dash_no_learning_records": "尚無學習紀錄",
            "dash_tutor_info_title": "導師專屬作業資訊 (Tutor Information)",
            "dash_tutor_name_label": "導師姓名",
            "dash_tutor_email_label": "電子信箱",
            "dash_tutor_promo_code_label": "專屬 Promo Code",
            "dash_not_generated": "尚未生成",
            "dash_registration_tools_title": "招生工具包",
            "dash_registration_tools_desc": "學生掃描 QR Code 或點擊專屬連結後，系統會自動將課程加入購物車並連結您的教學作業權限。",
            "dash_copy_referral_link": "複製專屬連結",
            "dash_no_auto_monitoring": "目前沒有自動監控警示紀錄",
            "dash_no_student_blockers": "目前沒有學生回報卡點",
            "dash_unit_label": "單元",
            "dash_block_reason_label": "原因",
            "dash_block_reason_default": "評分低於門檻",
            "dash_student_blockers_title": "學生主動回報卡點 (Student Blockers)",
            "dash_intervention_dashboard_title": "師生互動與即時卡點支援看板 (Intervention Dashboard)",
            "dash_auto_interventions_title": "系統自動監控警示 (Auto-Interventions)",
            "status_in_progress": "進行中",
            "status_submitted": "待評分",
            "status_graded": "已評分",
            "status_blocked": "🔴 遭遇卡點",
            "status_coaching": "🟡 導師引導中",
            "status_resolved": "🟢 已解決",

            // learning-path.html
            "lp_title": "學習路徑",
            "lp_hardwareHeader": "硬體設備",
            "lp_specsHeader": "電腦規格推薦",
            "lp_coreContentLabel": "核心內容：",
            "lp_previewBtn": "▶ 課程預覽",
            "lp_loadingText": "載入中...",
            "lp_loginFreeBtn": "👤 請先登入 (免費)",
            "lp_loginBtn": "👤 請先登入",
            "lp_addToCartBtn": "🛒 加入購物車",
            "lp_enterCourseBtn": "✅ 進入課程內容",
            "lp_freeLabel": "免費",
            "lp_emptyCategory": "目前此分類尚無課程。",
            "lp_addToCartPhysical": "🛒 加入購物車",
            "lp_alreadyInCart": "⚠️ 「{name}」已在購物車中！",
            "lp_coursesConfigMissing": "⚠️ 課程連結尚未備妥，請聯繫客服。",

            // dashboard.js / distributor-portal.js Alerts & Dialogs
            "alert_invalid_unit_url": "此單元設定的作業連結格式不正確，請到課程設定修正。",
            "alert_missing_unit_url": "此單元尚未設定作業連結，請管理員/老師至「課程設定」中設定。",
            "alert_assignment_not_assigned": "此單元尚未完成老師指派，作業入口會在老師指派完成後開放。",
            "alert_invalid_tutor_url": "此單元設定的作業連結格式不正確，請通知管理員/老師修正。",
            "alert_fetch_portal_failed": "暫時無法取得作業入口，請稍後再試。",
            "confirm_mark_shipped": "確定要將訂單 {orderId} 標記為「履約完成」嗎？\n這將會同步更新學員的查看狀態。",
            "notify_order_status_updated": "訂單狀態已更新！",
            "alert_update_failed": "更新失敗：{msg}",
            "alert_enter_email": "請輸入 Email",
            "status_updating_auth": "正在新增單元授權...",
            "status_removing_auth": "正在移除單元授權...",
            "alert_auth_failed": "授權失敗: {msg}",
            "status_updating_tutor": "正在更新導師指派...",
            "alert_assign_failed": "指派失敗: {msg}",
            "alert_score_required": "請輸入分數",
            "alert_feedback_required": "請輸入指導回饋指引！",
            "alert_next_goal_required": "請指派下一步目標！",
            "alert_grade_success": "評分成功！",
            "alert_grade_failed": "評分失敗：{msg}",
            "alert_tutor_record_success": "指導紀錄提交成功！",
            "alert_tutor_record_failed": "提交指導紀錄失敗：{msg}",
            "prompt_enter_url": "請貼上此單元的作業連結：",
            "alert_url_format_error": "連結格式錯誤。請使用有效的作業連結（http/https）。",
            "notify_url_submitted": "已送出作業連結，管理員已收到審核通知。",
            "alert_submit_failed": "送出失敗：{msg}",
            "confirm_unsaved_changes": "您有尚未儲存的價格變更，切換篩選將會遺失變更，是否繼續？",
            "notify_price_updated": "價格已更新！",
            "alert_update_price_failed": "更新價格失敗：{msg}",
            "alert_input_distributor_product_id": "請先輸入經銷商 ID 與產品 ID。",
            "alert_price_non_negative": "售價必須是非負數字。",
            "alert_promo_price_invalid": "活動價必須是非負數字，且不可大於售價。",
            "notify_distributor_price_saved": "已儲存經銷商價格表：{msg}",
            "alert_save_distributor_price_failed": "儲存經銷商價格表失敗：{msg}",

            // distributor-portal.js
            "alert_load_distributor_first": "請先載入經銷商 ID。",
            "status_applying": "套用中...",
            "alert_apply_failed": "套用失敗",
            "toast_apply_success": "已套用現有商品：建立 {created} 筆、更新 {updated} 筆、略過 {skipped} 筆",
            "toast_apply_failed": "套用現有商品失敗：{msg}",
            "toast_no_pricebook_found": "找不到這筆價格表，請重新載入後再試。",
            "status_loaded_pricebook": "已載入：{msg}",
            "toast_order_not_found": "找不到該筆訂單資訊。",
            "toast_select_order_first": "請選擇要維護的訂單。",
            "toast_update_shipment_success": "出貨狀態更新成功！",
            "toast_update_shipment_failed": "更新出貨狀態失敗",
            "alert_login_distributor_first": "請先登入後再使用 Distributor Portal。",
            "alert_load_portal_failed": "無法載入經銷商入口：{msg}",
            "alert_distributor_not_assigned": "這個帳號沒有可管理的經銷商歸屬，無法進入經銷商入口。",

            // nav-component.js
            "alert_login_failed": "Google 登入失敗，請再試一次。",
            "alert_login_failed_blocked": "Google 登入失敗，請稍後再試。\n若瀏覽器阻擋彈窗或重新導向，請直接按右上角登入按鈕再試一次。"
        },
        "en": {
            // Document title fallback
            "doc_title_index": "Vibe Coding Learning Platform",
            "doc_title_login": "Google Login - Vibe Coding",
            "doc_title_cart": "Vibe Coding Shopping Cart",
            "doc_title_payment_return": "Payment Result - Vibe Coding",
            "doc_title_dashboard": "Learning Dashboard - Vibe Coding",
            "nav_students_label": "Student Guide",
            "nav_tutors_label": "Tutor Collaboration",
            "footer_home": "Home",
            "footer_learning_path": "Learning Path",
            "footer_student_guide": "Student Guide",
            "footer_tutor_guide": "Tutor Collaboration",
            "footer_business_entity": "Business Entity",
            "footer_company_name": "Joy Foot Health Technology Co., Ltd.",
            "footer_tax_id": "Tax ID",
            "footer_contact_us": "Contact Us",

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
            "cart_total_label": "Total:",
            "cart_total_with_currency": "Total ({currency}, tax & shipping included):",
            "cart_total_no_currency": "Total (tax & shipping included):",
            "cart_subtotal_label": "Subtotal:",
            "cart_shipping_label": "Shipping Fee:",
            "cart_tax_label": "Tax:",
            "routing_title": "Region & Distributor Preference",
            "routing_desc": "Select your region to get recommended distributors. You can switch manually and save preferences to your account.",
            "routing_summary_title": "Current Selection",
            "routing_region_label": "Region",
            "routing_distributor_label": "Distributor",
            "routing_step_region_label": "1. Region",
            "routing_step_distributor_label": "2. Distributor",
            "routing_current_region_label": "Current Region",
            "routing_current_distributor_label": "Current Distributor",
            "routing_source_label": "Source",
            "routing_reason_label": "Reason",
            "routing_quick_guide": "First choose a region, then a distributor. The system will prefill a recommended value.",
            "routing_save_btn": "Save Preference",
            "routing_status_init": "Choose a region first, then a distributor.",
            "routing_select_region_placeholder": "-- Select Region --",
            "routing_select_distributor_placeholder": "-- Select Distributor --",
            "routing_recommended": "Recommended",
            "routing_manual_select": "Select Manually",
            "routing_no_distributor": "No distributor available",
            "routing_sys_recommend": "Recommended: {name}",
            "routing_prompt_select": "Please select region & distributor.",
            "routing_load_failed_fallback": "Failed to load options. Local defaults applied.",
            "routing_save_empty": "Please select at least region or distributor.",
            "routing_save_success": "Preferences saved successfully.",
            "routing_save_local_success": "Preferences saved (locally).",
            "routing_guest_loaded": "Guest mode: default settings loaded.",
            "routing_save_failed": "Failed to save preferences.",
            "routing_selected_unsaved": "Distributor selected (unsaved).",
            "routing_select_distributor_prompt": "Please select a distributor.",
            "routing_source_manual": "Manual selection",
            "routing_source_auto": "Auto-filled by system",
            "routing_source_checkout": "Recorded at checkout",
            "routing_source_local": "Local default",
            "routing_source_region_default": "Region default",
            "routing_source_last_success": "Last successful checkout",
            "routing_source_guest_local": "Guest default",
            "routing_source_shipping": "Derived from shipping country",
            "routing_source_unknown": "System default",
            "routing_reason_region_default": "Region default",
            "routing_reason_region_backup": "Region backup",
            "routing_reason_single_match": "Only distributor in region",
            "routing_reason_multiple_matches": "Multiple distributors in region, please choose manually",
            "routing_reason_user_binding": "Using your saved preference",
            "routing_reason_promotion": "Based on promotion code",
            "routing_reason_explicit": "Based on your manual choice",
            "routing_reason_guest_local": "Guest default",
            "routing_reason_checkout": "Recorded during checkout",
            "routing_reason_shipping": "Derived from shipping country",
            "routing_reason_unknown": "System default",
            "routing_shipping_prefilled": "The system has prefilled {region} based on your shipping country.",
            "routing_manual_locked_shipping": "The region is locked by your manual choice. To adjust it from shipping country, please re-select the region.",
            "shipping_country_label": "Country / Region",
            "shipping_country_placeholder": "-- Select Country --",
            "shipping_country_us": "United States",
            "shipping_country_ca": "Canada",
            "shipping_country_jp": "Japan",
            "shipping_country_sg": "Singapore",
            "shipping_country_hk": "Hong Kong",
            "shipping_country_my": "Malaysia",
            "shipping_state_label": "State / Province",
            "shipping_city_label": "City",
            "shipping_line1_label": "Address Line 1",
            "shipping_zip_label": "ZIP / Postal Code",
            "shipping_line2_label": "Address Line 2 (Optional)",
            "shipping_state_placeholder": "e.g. CA",
            "shipping_city_placeholder": "e.g. San Jose",
            "shipping_line1_placeholder": "Street address, P.O. box",
            "shipping_zip_placeholder": "e.g. 95125",
            "shipping_line2_placeholder": "Apartment, suite, unit, building, floor, etc.",
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
            "prefill_invite_referral_ignored": "（Ignored referral code parameters. Enter Tutor Email on the assignment page to bind a tutor.）",
            "referral_verification_loading": "Verifying...",
            "referral_btn_apply": "Apply Link",
            "referral_unchanged": "Unchanged. Leave blank, or enter a tutor-provided assignment link to apply.",
            "referral_url_invalid": "Invalid format. Please use a tutor-provided assignment link.",
            "referral_item_not_in_cart": "The unit associated with this assignment link is not in your cart.",
            "referral_item_mismatch": "This assignment link does not match the current unit item.",
            "referral_applied_success": "✅ Applied assignment link: {name}",

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
            "dash_header_title": "儀表板 (Dashboard)",
            "dash_close_btn": "Close",
            "dash_loading": "Loading dashboard...",
            "dash_logout": "Logout",
            "dash_back_home": "Home",
            "dash_assignments_title": "Assignments",
            "dash_th_student_name": "Student",
            "dash_th_assignment_unit": "Assignment / Unit",
            "dash_th_time": "Time",
            "dash_th_action": "Action",

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
            "dash_tutor_invite_binding_title": "🔗 Tutor & Student Binder",
            "dash_tutor_invite_binding_desc": "Enter the tutor's Email address (or assignment link) below to complete binding. Once bound, your tutor will be able to review your code and write comments on GitHub for every push.",
            "dash_tutor_invite_btn_bind": "Bind Code",
            "dash_tutor_invite_btn_binding": "Binding...",
            "dash_tutor_invite_input_placeholder": "Enter tutor Email or assignment link...",
            "dash_tutor_invite_status_empty": "Unbound. Enter a code and click bind to proceed.",
            
            // Extra Dashboard Labels (Student/Tutor View)
            "dash_tab_overview": "Overview",
            "dash_tab_tutors": "Tutor Management",
            "dash_tab_shipments": "Fulfillment Management",
            "dash_tab_settings": "System Settings",
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
            "dash_assignment_no_link": "This assignment has no link.",
            "not_provided": "Not provided",
            "dash_loading_readme": "Loading unit page content...",
            "dash_learning_distribution": "Learning Distribution",
            "dash_course_progress_details": "Unit Progress Details",
            "dash_no_learning_records": "No learning records found.",
            "dash_tutor_info_title": "Tutor Information",
            "dash_tutor_name_label": "Tutor Name",
            "dash_tutor_email_label": "Email",
            "dash_tutor_promo_code_label": "Promo Code",
            "dash_not_generated": "Not generated",
            "dash_registration_tools_title": "Registration Tools",
            "dash_registration_tools_desc": "Once students scan the QR code or open the link, the course is added to their cart and linked to your teaching assignment permissions.",
            "dash_copy_referral_link": "Copy Referral Link",
            "dash_no_auto_monitoring": "No auto-monitoring alerts",
            "dash_no_student_blockers": "No student blocker reports yet",
            "dash_unit_label": "Unit",
            "dash_block_reason_label": "Reason",
            "dash_block_reason_default": "Below threshold",
            "dash_student_blockers_title": "Student Blockers",
            "dash_intervention_dashboard_title": "Intervention Dashboard",
            "dash_auto_interventions_title": "Auto-Interventions",
            "status_in_progress": "In Progress",
            "status_submitted": "Pending Grade",
            "status_graded": "Graded",
            "status_blocked": "🔴 Blocked",
            "status_coaching": "🟡 Guided",
            "status_resolved": "🟢 Resolved",

            // learning-path.html
            "lp_title": "Learning Path",
            "lp_hardwareHeader": "Hardware Kits",
            "lp_specsHeader": "Computer Spec Recommendations",
            "lp_coreContentLabel": "Core Content:",
            "lp_previewBtn": "▶ Course Preview",
            "lp_loadingText": "Loading...",
            "lp_loginFreeBtn": "👤 Login (Free)",
            "lp_loginBtn": "👤 Login",
            "lp_addToCartBtn": "🛒 Add to Cart",
            "lp_enterCourseBtn": "✅ Enter Course",
            "lp_freeLabel": "Free",
            "lp_emptyCategory": "No courses available in this category yet.",
            "lp_addToCartPhysical": "🛒 Add to Cart",
            "lp_alreadyInCart": "⚠️ \"{name}\" is already in your cart!",
            "lp_coursesConfigMissing": "⚠️ Course link not ready, please contact customer support.",

            // dashboard.js / distributor-portal.js Alerts & Dialogs
            "alert_invalid_unit_url": "The assignment link format for this unit is incorrect. Please correct it in course settings.",
            "alert_missing_unit_url": "The assignment link for this unit is not set. Please contact an admin/tutor to set it.",
            "alert_assignment_not_assigned": "This unit has not been assigned by a tutor yet. The assignment portal will open once assigned.",
            "alert_invalid_tutor_url": "The assignment link format is incorrect. Please notify your admin/tutor to correct it.",
            "alert_fetch_portal_failed": "Unable to fetch the assignment portal. Please try again later.",
            "confirm_mark_shipped": "Are you sure you want to mark order {orderId} as 'Fulfilled'? This will update the student's status.",
            "notify_order_status_updated": "Order status updated!",
            "alert_update_failed": "Update failed: {msg}",
            "alert_enter_email": "Please enter Email",
            "status_updating_auth": "Adding unit authorization...",
            "status_removing_auth": "Removing unit authorization...",
            "alert_auth_failed": "Authorization failed: {msg}",
            "status_updating_tutor": "Updating tutor assignment...",
            "alert_assign_failed": "Assignment failed: {msg}",
            "alert_score_required": "Please enter a score",
            "alert_feedback_required": "Please enter tutor feedback!",
            "alert_next_goal_required": "Please assign the next goal!",
            "alert_grade_success": "Graded successfully!",
            "alert_grade_failed": "Grading failed: {msg}",
            "alert_tutor_record_success": "Tutor record submitted successfully!",
            "alert_tutor_record_failed": "Failed to submit tutor record: {msg}",
            "prompt_enter_url": "Please paste the assignment link for this unit:",
            "alert_url_format_error": "Invalid URL format. Please use a valid assignment link (http/https).",
            "notify_url_submitted": "Assignment link submitted. Admin has been notified for review.",
            "alert_submit_failed": "Submission failed: {msg}",
            "confirm_unsaved_changes": "You have unsaved price changes. Switching filters will discard them. Do you want to continue?",
            "notify_price_updated": "Prices updated!",
            "alert_update_price_failed": "Failed to update prices: {msg}",
            "alert_input_distributor_product_id": "Please enter distributor ID and product ID first.",
            "alert_price_non_negative": "Price must be a non-negative number.",
            "alert_promo_price_invalid": "Promo price must be a non-negative number and cannot be greater than the selling price.",
            "notify_distributor_price_saved": "Distributor price book saved: {msg}",
            "alert_save_distributor_price_failed": "Failed to save distributor price book: {msg}",

            // distributor-portal.js
            "alert_load_distributor_first": "Please load distributor ID first.",
            "status_applying": "Applying...",
            "alert_apply_failed": "Apply failed",
            "toast_apply_success": "Applied existing products: created {created}, updated {updated}, skipped {skipped}",
            "toast_apply_failed": "Failed to apply existing products: {msg}",
            "toast_no_pricebook_found": "Price book not found. Please reload and try again.",
            "status_loaded_pricebook": "Loaded: {msg}",
            "toast_order_not_found": "Order details not found.",
            "toast_select_order_first": "Please select an order to update.",
            "toast_update_shipment_success": "Shipment status updated successfully!",
            "toast_update_shipment_failed": "Failed to update shipment status",
            "alert_login_distributor_first": "Please log in first to use the Distributor Portal.",
            "alert_load_portal_failed": "Failed to load Distributor Portal: {msg}",
            "alert_distributor_not_assigned": "This account is not assigned to any distributor and cannot access the portal.",

            // nav-component.js
            "alert_login_failed": "Google login failed. Please try again.",
            "alert_login_failed_blocked": "Google login failed. Please try again later.\nIf popups are blocked, try clicking the login button again."
        }
    };

    // 3. 全局字串翻譯函數
    window.detectUiLocale = detectUiLocale;
    window.currentLocale = currentLocale;
    window.t = function (key, fallback) {
        const localeDict = DICTIONARY[resolveDictionaryLocale(currentLocale)];
        if (localeDict && localeDict[key] !== undefined) {
            return localeDict[key];
        }
        return fallback !== undefined ? fallback : key;
    };

    // 4. 動態翻譯 DOM 元素
    window.applyI18n = function () {
        const localeDict = DICTIONARY[resolveDictionaryLocale(currentLocale)];
        if (!localeDict) return;

        // 設定 html 屬性 lang
        document.documentElement.lang = resolveDictionaryLocale(currentLocale) === "zh-TW" ? "zh-Hant" : resolveDictionaryLocale(currentLocale);

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

    window.__vibeNormalizeLocaleCode = normalizeLocaleCode;
    window.__vibeGetContentRuntimeConfig = getContentRuntimeConfig;
    window.__vibeResolveLocaleCandidates = resolveLocaleCandidates;
    window.__vibeResolveDictionaryLocale = resolveDictionaryLocale;
    window.__vibeResolveLocalizedFieldValue = resolveLocalizedFieldValue;

    // 5. 自動在 DOMContentLoaded 觸發
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", window.applyI18n);
    } else {
        window.applyI18n();
    }
})();
