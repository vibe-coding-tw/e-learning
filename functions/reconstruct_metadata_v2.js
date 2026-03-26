const fs = require('fs');
const path = require('path');

const privateCoursesDir = path.join(__dirname, 'private_courses');

// Hardcoded data for 00- prefix courses (from prepare.html)
const legacyMetadata = {
    "72uyaadl": {
        title: "開發環境安裝與設定",
        category: "started",
        price: 0,
        lessonLabel: "入門指引",
        duration: "約 60 分鐘",
        icon: "🖥️",
        tagText: "Setup Guide",
        coreContent: ["VS Code 安裝與中文化", "GitHub 帳號與 Copilot 授權"]
    },
    "github-classroom-free": {
        title: "GitHub Classroom 實務",
        category: "started",
        price: 0,
        lessonLabel: "流程教學",
        duration: "約 45 分鐘",
        icon: "🎓",
        tagText: "Modern Workflow",
        coreContent: ["學生端：輕鬆領取與繳交", "老師端：自動化批改與管理", "Vibe Coding：全新的開發視野"]
    },
    "ai-agents-vibe": {
        title: "AI 代理人與 Vibe Coding",
        category: "adv",
        price: 0,
        lessonLabel: "特別專案",
        duration: "約 90 分鐘",
        icon: "🤖",
        tagText: "Bonus Case",
        coreContent: ["Copilot Agent Mode", "Copilot Workspace (Web)", "Vibe Coding 工具集"],
        classroomUrl: "/courses/04-master-ai-agents.html",
        courseUnits: ["04-unit-agent-mode.html", "04-unit-web-agents.html", "04-unit-vibe-coding.html"]
    },
    "cvhofqxc": {
        title: "WiFi 與馬達組態設定",
        category: "started",
        price: 0,
        lessonLabel: "硬體校正",
        duration: "約 30 分鐘",
        icon: "📡",
        tagText: "Setup Guide",
        coreContent: ["設定 SSID 與密碼", "獲取 IP 位置", "馬達參數調校"]
    },
    "esp32-c3": {
        title: "基本款開發平台",
        category: "basic",
        price: 1600,
        lessonLabel: "硬體套件",
        duration: "永久使用",
        icon: "🔌",
        tagText: "Entry Level",
        coreContent: ["Single Core (RISC-V)", "400 KB SRAM", "4 MB Flash"]
    },
    "esp32-s3": {
        title: "進階款開發平台",
        category: "adv",
        price: 3600,
        lessonLabel: "硬體套件",
        duration: "永久使用",
        icon: "⚡",
        tagText: "Pro Level",
        coreContent: ["Dual Core (Xtensa®)", "512 KB + 8MB PSRAM", "16 MB Flash"]
    }
};

function extractMetadataFromFiles(masterFile) {
    const masterPath = path.join(privateCoursesDir, masterFile);
    if (!fs.existsSync(masterPath)) return null;

    const content = fs.readFileSync(masterPath, 'utf8');
    
    // Extract Title
    let title = "";
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    if (titleMatch) title = titleMatch[1].replace(" - Vibe Coding", "").trim();
    
    // Extract Units (from tabs)
    const units = [];
    const unitMatches = content.matchAll(/<span>[1-9]️⃣<\/span>\s*([^<]*?)\s*<\/button>/g);
    for (const match of unitMatches) {
        units.push(match[1].trim());
    }

    // Try to find the first unit file to extract videoId and duration
    // The link is usually in tabs object or hardcoded switchTab
    let videoId = "";
    let duration = "約 120 分鐘"; // Default
    
    const firstUnitMatch = content.match(/url:\s*['"](.*?-unit-.*?)['"]/);
    if (firstUnitMatch) {
        const unitPath = path.join(privateCoursesDir, firstUnitMatch[1]);
        if (fs.existsSync(unitPath)) {
            const unitContent = fs.readFileSync(unitPath, 'utf8');
            const videoMatch = unitContent.match(/youtube:\s*['"](?:https:\/\/www\.youtube\.com\/embed\/)?(.*?)(?:\?.*)?['"]/);
            if (videoMatch) videoId = videoMatch[1];
            
            // Extract duration from unit header if possible
            const durMatch = unitContent.match(/約\s*(\d+)\s*分鐘/);
            if (durMatch) duration = `約 ${durMatch[1]} 分鐘`;
        }
    }

    return { title, videoId, duration, coreContent: units };
}

async function reconstruct() {
    const files = fs.readdirSync(privateCoursesDir);
    const masters = files.filter(f => f.includes("-master-") && f.endsWith(".html"));
    
    const finalLessons = [];
    const groups = {};

    // Grouping
    masters.forEach(master => {
        const prefix = master.split('-')[1]; // start-01-master...
        if (!groups[prefix]) groups[prefix] = { master: master, units: [] };
        
        // Find units for this master
        const units = files.filter(f => f.startsWith(`start-${prefix}-unit-`) && f.endsWith(".html"));
        groups[prefix].units = units;
    });

    for (const prefix in groups) {
        const group = groups[prefix];
        const master = group.master;
        
        let courseId = prefix;
        if (prefix === "00") {
             // Skip 00 master as it's handled by legacyMetadata
             continue;
        }

        const meta = extractMetadataFromFiles(master);
        if (!meta) continue;

        // Category & Price Logic
        let category = "basic";
        let price = 0;
        let icon = "🚀";
        let tagText = "核心課程";
        let lessonLabel = `Track ${prefix}`;

        if (prefix === "01" || prefix === "02") {
            category = "started";
            icon = "📱";
            tagText = "入門基礎";
        } else if (prefix === "03" || prefix === "04") {
            category = "basic";
            icon = "⚙️";
            tagText = "中階實作";
        } else if (prefix === "05") {
            category = "adv";
            icon = "👁️";
            tagText = "進階應用";
        }

        finalLessons.push({
            courseId: courseId,
            title: meta.title,
            category: category,
            price: price,
            lessonLabel: lessonLabel,
            duration: meta.duration,
            icon: icon,
            tagText: tagText,
            coreContent: meta.coreContent,
            videoId: meta.videoId,
            classroomUrl: `/courses/${master}`,
            courseUnits: group.units,
            githubClassroomUrls: {} 
        });
    }

    // Add Legacy / Static Metadata
    for (const cid in legacyMetadata) {
        const legacy = legacyMetadata[cid];
        const masterFile = masters.find(m => m.includes(cid.replace("-free", ""))); // fuzzy match
        
        finalLessons.push({
            courseId: cid,
            ...legacy,
            classroomUrl: legacyMetadata[cid].classroomUrl || (masterFile ? `/courses/${masterFile}` : ""),
            courseUnits: legacy.courseUnits || [] // Will be filled manually if needed, or left empty
        });
    }

    fs.writeFileSync(path.join(__dirname, 'reconstructed_lessons.json'), JSON.stringify(finalLessons, null, 2));
    console.log(`Successfully reconstructed ${finalLessons.length} lessons with full metadata.`);
}

reconstruct();
