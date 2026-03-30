import re

def get_file_contents(filename):
    with open(filename, 'r') as f:
        return f.read()

def extract_body(html):
    # Extract everything inside the container after the header
    match = re.search(r'<div class="container mx-auto px-4 -mt-\d+ relative z-20 pb-20">(.*?)<!-- (Navigation Buttons|Completion Section|Call to Action) -->', html, re.DOTALL)
    if match:
        return match.group(1).strip()
    return ""

def extract_assignments(html):
    # Extract all .assignment-quest blocks
    matches = re.finditer(r'<div class="assignment-quest"[^>]*>.*?</div>\s*(?=<(?:div class="assignment-quest"|/section))', html, re.DOTALL)
    quests = []
    for m in matches:
        quests.append(m.group(0))
    return quests

f1 = 'private_courses/02-unit-vibe-coding-intro.html'
f2 = 'private_courses/02-unit-classroom-workflow.html'
f3 = 'private_courses/02-unit-teacher-matrix.html'

h1 = get_file_contents(f1)
h2 = get_file_contents(f2)
h3 = get_file_contents(f3)

b1 = extract_body(h1)
a1_blocks = extract_assignments(h1)

b2 = extract_body(h2)
a2_blocks = extract_assignments(h2)

b3 = extract_body(h3)
a3_blocks = extract_assignments(h3)

all_a1 = "\n".join(a1_blocks)
all_a2 = "\n".join(a2_blocks)
all_a3 = "\n".join(a3_blocks)

# Generate cards for Module 1
# 1-1: Defining the Vibe, 1-2: Hallucination Audit, 1-3: Vibe 願景
cards1 = """
            <h3 class="text-2xl font-bold text-cyan-700 mb-6 flex items-center gap-2 mt-8 border-b pb-2">
                 <span>🛠️</span> Module 1：定義與願景
            </h3>
            <div class="grid md:grid-cols-3 gap-6 mb-12">
                <div onclick="openSubmissionModal('vibe-01-vibe-definition', '【任務 1-1】定義你的「Vibe」')"
                    class="bg-white rounded-2xl shadow-lg border border-cyan-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-cyan-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">🎨</span>
                            <span class="bg-cyan-100 text-cyan-700 text-xs px-2 py-1 rounded font-bold uppercase">30 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-cyan-600 transition">【任務 1-1】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">定義你的「Vibe」</h4>
                        <p class="text-xs text-gray-600 space-y-1">撰寫一份包含視覺風格與核心組建佈局的 Vibe Prompt。</p>
                    </div>
                </div>
                <div onclick="openSubmissionModal('vibe-01-hallucination', '【任務 1-2】糾正 AI 的「幻覺」')"
                    class="bg-white rounded-2xl shadow-lg border border-cyan-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-blue-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">🩺</span>
                            <span class="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold uppercase">40 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-blue-600 transition">【任務 1-2】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">糾正 AI 的「幻覺」</h4>
                        <p class="text-xs text-gray-600 space-y-1">撰寫修正 Prompt，引導 AI 修復邊界案例與邏輯錯誤代碼。</p>
                    </div>
                </div>
                <div onclick="openSubmissionModal('vibe-01-vision', '【任務 1-3】建立第一個「Vibe 願景」')"
                    class="bg-white rounded-2xl shadow-lg border border-cyan-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-indigo-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">🌟</span>
                            <span class="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded font-bold uppercase">20 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-indigo-600 transition">【任務 1-3】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">第一個「Vibe 願景」</h4>
                        <p class="text-xs text-gray-600 space-y-1">使用 AI 快速生成原型，並練習「微粒子提交」策略。</p>
                    </div>
                </div>
            </div>
"""

cards2 = """
            <h3 class="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-2 mt-8 border-b pb-2">
                 <span>⚙️</span> Module 2：工作流實踐
            </h3>
            <div class="grid md:grid-cols-3 gap-6 mb-12">
                <div onclick="openSubmissionModal('vibe-02-lifecycle', '【任務 2-1】接受邀請與首次推送')"
                    class="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-indigo-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">🤝</span>
                            <span class="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded font-bold uppercase">15 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-indigo-600 transition">【任務 2-1】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">接受邀請與推送</h4>
                        <p class="text-xs text-gray-600 space-y-1">體驗 Classroom Lifecycle，從 Clone 到 Push 同步工作流。</p>
                    </div>
                </div>
                <div onclick="openSubmissionModal('vibe-02-microcommit', '【任務 2-2】微提交實踐')"
                    class="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-purple-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">🪡</span>
                            <span class="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded font-bold uppercase">30 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-purple-600 transition">【任務 2-2】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">微提交實踐</h4>
                        <p class="text-xs text-gray-600 space-y-1">培養精細化版本控制的習慣，以增強合作與追溯性。</p>
                    </div>
                </div>
                <div onclick="openSubmissionModal('vibe-02-autograding', '【任務 2-3】紅燈轉綠燈')"
                    class="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-teal-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">🚦</span>
                            <span class="bg-teal-100 text-teal-700 text-xs px-2 py-1 rounded font-bold uppercase">40 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-teal-600 transition">【任務 2-3】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">紅燈轉綠燈</h4>
                        <p class="text-xs text-gray-600 space-y-1">熟悉 CI/CD 測試日誌除錯，確保 Autograding 回覆綠燈。</p>
                    </div>
                </div>
            </div>
"""

cards3 = """
            <h3 class="text-2xl font-bold text-blue-700 mb-6 flex items-center gap-2 mt-8 border-b pb-2">
                 <span>👨‍🏫</span> Module 3：自動化與矩陣
            </h3>
            <div class="grid md:grid-cols-3 gap-6 mb-12">
                <div onclick="openSubmissionModal('vibe-03-spec', '【任務 3-1】規格說明書撰寫實踐')"
                    class="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-blue-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">📝</span>
                            <span class="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold uppercase">30 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-blue-600 transition">【任務 3-1】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">規格說明書實踐</h4>
                        <p class="text-xs text-gray-600 space-y-1">撰寫結構化的 Markdown 文件進行需求定義與通訊協議規劃。</p>
                    </div>
                </div>
                <div onclick="openSubmissionModal('vibe-03-security', '【任務 3-2】安全性與漏洞審計')"
                    class="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-red-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">🛡️</span>
                            <span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold uppercase">45 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-red-600 transition">【任務 3-2】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">安全性與漏洞審計</h4>
                        <p class="text-xs text-gray-600 space-y-1">進行代碼資安掃描，修補常見弱點並確保平台通訊安全。</p>
                    </div>
                </div>
                <div onclick="openSubmissionModal('vibe-03-cicd', '【任務 3-3】自動化工作流提案')"
                    class="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden flex flex-col group cursor-pointer relative hover:shadow-2xl transition-all hover:-translate-y-2">
                    <div class="bg-emerald-500 h-2"></div>
                    <div class="p-6 flex-grow">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-3xl">🚀</span>
                            <span class="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded font-bold uppercase">20 min</span>
                        </div>
                        <h3 class="font-bold text-lg text-gray-800 mb-1 group-hover:text-emerald-600 transition">【任務 3-3】</h3>
                        <h4 class="font-medium text-gray-500 mb-3 text-sm">自動化工作流提案</h4>
                        <p class="text-xs text-gray-600 space-y-1">構思並撰寫自動化腳本概念，提升教師考核的效率與可靠度。</p>
                    </div>
                </div>
            </div>
"""

# Build the merged file
merged_html = f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>綜合單元：Vibe Coding 與 Classroom 實務 - Vibe Coding</title>
    <link rel="stylesheet" href="/style.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/js/all.min.js"></script>
</head>
<body id="unit-vibe-classroom-merged" class="bg-gray-50 flex flex-col min-h-screen text-gray-800 font-[Inter]">
    <!-- Hero Section -->
    <header class="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-cyan-900 text-white pt-20 pb-28 overflow-hidden">
        <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-gray-50 to-transparent bottom-0 h-16"></div>
        <div class="container mx-auto px-4 relative z-10 text-center">
            <h1 class="text-4xl md:text-5xl font-extrabold mb-6 leading-tight tracking-tight font-[Outfit]">
                綜合單元：Vibe Coding 與 Classroom 實務
            </h1>
            <p class="text-lg md:text-xl text-cyan-100 max-w-2xl mx-auto font-light leading-relaxed">
                結合 Vibe Coding 哲學、 Classroom 高效工作流與導師能力矩陣，<br>打造 2026 年最具競爭力的全方位開發與教學素養。
            </p>
        </div>
    </header>

    <main class="container mx-auto px-4 -mt-16 relative z-20 pb-20">
        
        <!-- Main Core Contents -->
        <section class="module-section mb-16">
            {b1}
        </section>

        <section class="module-section mb-16">
            {b2}
        </section>

        <section class="module-section mb-16">
            {b3}
        </section>
        
        <!-- Assignments Cards Section (Visible in body) -->
        <section class="module-section mt-16">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-4 font-[Outfit]">核心實作：Vibe 第一步</h2>
            <p class="text-center text-gray-500 mb-12">循序漸進解鎖自動化 Classroom 流程與 AI 開發思維。</p>

            {cards1}
            {cards2}
            {cards3}
        </section>
        
    </main>
    
    <!-- Original Assignments Guide Reference (Hidden) -->
    <section id="assignment-guide" style="display: none;">
        <h2>Vibe Classroom 隨堂任務詳解</h2>
        
        <!-- Module 1 Assignments -->
        {all_a1}
        
        <!-- Module 2 Assignments -->
        {all_a2}
        
        <!-- Module 3 Assignments -->
        {all_a3}
    </section>
    
    <section id="instructor-guide" style="display: none;">
        <h2>綜合單元操作指南</h2>
        <div class="classroom-guide">
            <p>本單元結合了 Vibe Coding 哲學、工作流操作與導師指南。請著重訓練學生的提問與工程拆解能力，而非過度專注於底層語法錯誤修補。</p>
        </div>
    </section>
    
    <script src="/js/course-shared-v4.js"></script>
    <style>
        .assignment-quest {{
            background: white !important;
            padding: 2rem !important;
            border-radius: 1rem !important;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
            margin-bottom: 2rem !important;
        }}
    </style>
</body>
</html>
"""

# Apply exact tags the script had issue extracting cleanly
with open('private_courses/03-unit-vibe-classroom-intro.html', 'w') as f:
    f.write(merged_html)

print("Redesigned and extracted assignments correctly to 03-unit-vibe-classroom-intro.html")
