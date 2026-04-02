const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🔒 Vibe Coding AI Helper (Cost-Efficient Implementation)
 * 遵循 rules.md 中的「Flash 優先」規則，致力於維持在免費層級之內。
 */

// 從環境變數讀取 API Key (建議在 GCP Secrets 或 .env 中設定)
const API_KEY = process.env.GEMINI_API_KEY; 

// 初始化 AI 管理器
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * ⚡ 智慧調用 AI 模型
 * @param {string} prompt - 您的輸入指令
 * @param {Object} options - 自定義選項 (預設為 flash)
 */
async function callVibeAI(prompt, options = {}) {
    if (!genAI) {
        throw new Error("⚠️ 未設定 GEMINI_API_KEY。請先在 GCP/Firebase 環境變數中設定 key 以啟動零元 AI。");
    }

    // 🚀 強制守則：除非特別指定 pro，否則一律使用 gemini-1.5-flash
    const modelName = options.priority === 'pro' ? "gemini-1.5-pro" : "gemini-1.5-flash";
    
    try {
        console.log(`[VibeAI] 正在呼叫模型: ${modelName} (省錢優先)`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error(`[VibeAI] 呼叫失敗 (${modelName}):`, error.message);
        
        // 🔄 自動降級: 如果 Pro 失敗且未嘗試過 Flash，可嘗試 Flash
        if (modelName === "gemini-1.5-pro") {
            console.warn("[VibeAI] Pro 失敗，嘗試切換回 Flash (免費額度較高)...");
            return callVibeAI(prompt, { ...options, priority: 'flash' });
        }
        
        throw error;
    }
}

module.exports = { callVibeAI };
