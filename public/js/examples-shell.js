(() => {
    const pageKey = String(window.location.pathname.split("/").pop() || "").toLowerCase();
    if (pageKey === "index.html" || pageKey === "") return;

    const META = {
        "hello-world.html": {
            eyebrow: "示範頁",
            title: "AI Hello World",
            description: "以 Gemini TTS 示範語音輸出流程，方便比較其他控制頁的介面骨架。"
        },
        "joystick.html": {
            eyebrow: "BLE 無人車控制",
            title: "BLE 搖桿",
            description: "連到同一組 ESP32 無人車 BLE 服務，輸出 T / S 速度與轉向指令。"
        },
        "d-pad.html": {
            eyebrow: "BLE 無人車控制",
            title: "D-Pad 控制",
            description: "以四向按鍵送出同一組無人車控制封包。"
        },
        "wifi-config.html": {
            eyebrow: "BLE 無人車設定",
            title: "Wi-Fi 組態設定",
            description: "透過 BLE 寫入 SSID / 密碼，讓無人車在配網後自動重啟連線。"
        },
        "motor-config.html": {
            eyebrow: "BLE 無人車設定",
            title: "馬達參數校準",
            description: "讀寫無人車馬達 ramping 參數，讓操控與實體車一致。"
        },
        "voice-control.html": {
            eyebrow: "BLE 無人車控制",
            title: "BLE 語音控制",
            description: "用語音辨識控制同一組無人車 BLE 指令。"
        }
    };

    const meta = META[pageKey];
    if (!meta) return;

    const style = document.createElement("style");
    style.id = "examples-shell-styles";
    style.textContent = `
        body.example-shell-page {
            min-height: 100vh;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 1rem;
            padding: 1rem !important;
            background:
                radial-gradient(circle at top, rgba(34, 211, 238, 0.16), transparent 35%),
                radial-gradient(circle at bottom right, rgba(79, 70, 229, 0.14), transparent 32%),
                linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%) !important;
            color: #e5e7eb;
        }
        .example-shell-banner {
            width: min(100%, 960px);
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 1rem 1.25rem;
            border-radius: 1.5rem;
            background: rgba(15, 23, 42, 0.72);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(148, 163, 184, 0.18);
            box-shadow: 0 20px 45px rgba(2, 6, 23, 0.35);
        }
        .example-shell-copy {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            min-width: 0;
        }
        .example-shell-eyebrow {
            font-size: 0.72rem;
            font-weight: 800;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #67e8f9;
        }
        .example-shell-title {
            font-size: 1.25rem;
            font-weight: 900;
            color: #f8fafc;
            line-height: 1.2;
        }
        .example-shell-desc {
            font-size: 0.9rem;
            color: #cbd5e1;
            line-height: 1.6;
        }
        .example-shell-back {
            flex: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.85rem 1rem;
            border-radius: 999px;
            background: linear-gradient(135deg, #06b6d4 0%, #4f46e5 100%);
            color: white;
            font-weight: 800;
            text-decoration: none;
            box-shadow: 0 12px 24px rgba(14, 165, 233, 0.24);
        }
        .example-shell-back:hover {
            filter: brightness(1.05);
        }
        .example-shell-container {
            width: min(100%, 960px) !important;
            margin: 0 auto !important;
        }
        @media (max-width: 640px) {
            .example-shell-banner {
                align-items: flex-start;
                flex-direction: column;
            }
            .example-shell-back {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
    document.body.classList.add("example-shell-page");

    const banner = document.createElement("header");
    banner.className = "example-shell-banner";
    banner.setAttribute("data-example-shell", "1");
    banner.innerHTML = `
        <div class="example-shell-copy">
            <div class="example-shell-eyebrow">${meta.eyebrow}</div>
            <div class="example-shell-title">${meta.title}</div>
            <div class="example-shell-desc">${meta.description}</div>
        </div>
        <a class="example-shell-back" href="index.html">回範例首頁</a>
    `;

    document.body.prepend(banner);

    const container = document.querySelector(".container-wrap");
    if (container) {
        container.classList.add("example-shell-container");
    }
})();
