/**
 * Autograding Script: CSS Property Checker
 * 檢查學生是否正確使用了關鍵的 CSS 屬性
 */
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../style.css');

if (!fs.existsSync(cssPath)) {
    console.error("❌ 找不到 style.css 檔案");
    process.exit(1);
}

const content = fs.readFileSync(cssPath, 'utf8');

const requirements = [
    { name: 'touch-action: manipulation', regex: /touch-action\s*:\s*manipulation/ },
    { name: 'user-select: none', regex: /user-select\s*:\s*none/ },
    { name: 'object-fit: cover', regex: /object-fit\s*:\s*cover/ }
];

let failed = false;

console.log("--- 🕵️ 駕駛艙 CSS 自動化巡檢 ---");

requirements.forEach(req => {
    if (req.regex.test(content)) {
        console.log(`✅ 通過: 偵測到 ${req.name}`);
    } else {
        console.log(`❌ 失敗: 未偵測到 ${req.name}`);
        failed = true;
    }
});

if (failed) {
    console.log("\n⚠️ 有些系統組態尚未完成，請檢查你的 style.css！");
    process.exit(1);
} else {
    console.log("\n🚀 恭喜！你的駕駛艙系統組態已正確設定。");
    process.exit(0);
}
