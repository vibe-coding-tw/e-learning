#!/usr/bin/env python3
import json
import subprocess
import os
import re

TEMPLATE_DIR = "/Users/roverchen/Documents/Classrooms/start-01-unit-html5-basics"
CONTENT_REPO_DIR = "/Users/roverchen/Documents/Apps/content-repo"

HTML_FILES = [
    os.path.join(CONTENT_REPO_DIR, "courses/zh-TW/car-starter-html5-basics.html"),
    os.path.join(CONTENT_REPO_DIR, "courses/en/car-starter-html5-basics.html")
]

def render_markdown(path):
    if not os.path.exists(path):
        print(f"Error: Template markdown file not found at {path}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    payload = json.dumps({"text": text})
    res = subprocess.run(
        ["gh", "api", "/markdown", "--input", "-"],
        input=payload,
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        raise Exception(f"gh api markdown error: {res.stderr.strip()}")
    return res.stdout

def replace_section_content(html, section_id, new_content):
    # Regex to find the opening tag of <section id="section_id" ...>
    open_tag_regex = re.compile(rf'<section\b[^>]*\bid=["\']{section_id}["\'][^>]*>', re.IGNORECASE)
    open_match = open_tag_regex.search(html)
    if not open_match:
        return html
    
    tag_content_start = open_match.end()
    
    depth = 1
    section_tag_regex = re.compile(r'</?section\b[^>]*>', re.IGNORECASE)
    
    for match in section_tag_regex.finditer(html, pos=tag_content_start):
        tag = match.group(0)
        if not tag.startswith('</'):
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                end_idx = match.start()
                # Construct the new HTML with replacement
                new_html = html[:tag_content_start] + "\n" + new_content + "\n    " + html[end_idx:]
                return new_html
    return html

def main():
    print("Reading and rendering template markdowns...")
    readme_html = render_markdown(os.path.join(TEMPLATE_DIR, "README.md"))
    tutor_html = render_markdown(os.path.join(TEMPLATE_DIR, "tutor-guide.md"))

    if not readme_html or not tutor_html:
        print("Failed to render markdown templates. Exiting.")
        return

    # Task 3 Card Replacement Definitions
    old_task3_card = """                    <!-- Task 3 -->
                    <div class="ms-lab-card" onclick="openSubmissionModal('html5-basics-task-3', '作業 1-3: FPV 影像容器佈局')">
                        <div class="ms-lab-badge"><i class="fas fa-video"></i>&nbsp; 作業 1-3</div>
                        <span class="ms-lab-time"><i class="far fa-clock"></i> 約 45 分鐘</span>
                        <h3>FPV 影像容器佈局</h3>
                        <p style="font-size:14px; color:#323130; margin-bottom:14px;">
                            目標：建立自適應的全螢幕影像容器，讓無人車回傳的 FPV 影像在任何螢幕（直/橫向）都不變形。
                        </p>
                        <ul class="ms-checklist">
                            <li><div class="check-box" onclick="event.stopPropagation(); toggleCheck(this)"></div><span>建立 <code>width:100vw; height:100vh</code> 的全螢幕容器</span></li>
                            <li><div class="check-box" onclick="event.stopPropagation(); toggleCheck(this)"></div><span>使用 <code>object-fit: cover</code> 確保影像充滿容器不變形</span></li>
                            <li><div class="check-box" onclick="event.stopPropagation(); toggleCheck(this)"></div><span>在 <code>assets/</code> 資料夾放入測試圖片模擬 FPV 串流</span></li>
                            <li><div class="check-box" onclick="event.stopPropagation(); toggleCheck(this)"></div><span>手機旋轉直/橫向，確認影像皆能正確自適應</span></li>
                        </ul>
                        <div class="ms-note" style="margin-top:12px;">
                            <i class="fas fa-info-circle note-icon"></i>
                            <div class="note-body">
                                <strong>進階挑戰</strong>
                                嘗試建立兩個 Branch（<code>feature/portrait</code> 與 <code>feature/landscape</code>），分別針對直向與橫向做專屬佈局優化。
                            </div>
                        </div>
                    </div>"""

    new_task3_card = """                    <!-- Task 3 -->
                    <div class="ms-lab-card" onclick="openSubmissionModal('html5-basics-task-3', '作業 1-3: 遙控車控制台結構骨架')">
                        <div class="ms-lab-badge"><i class="fas fa-cubes"></i>&nbsp; 作業 1-3</div>
                        <span class="ms-lab-time"><i class="far fa-clock"></i> 約 60 分鐘</span>
                        <h3>遙控車控制台結構骨架</h3>
                        <p style="font-size:14px; color:#323130; margin-bottom:14px;">
                            目標：使用 HTML5 語意化標籤與新型表單與計量元件，為遙控車規劃並建立一個控制台結構骨架。
                        </p>
                        <ul class="ms-checklist">
                            <li><div class="check-box" onclick="event.stopPropagation(); toggleCheck(this)"></div><span>在 <code>&lt;main&gt;</code> 中使用 <code>&lt;section&gt;</code> 區分方向按鈕、數據與日誌區</span></li>
                            <li><div class="check-box" onclick="event.stopPropagation(); toggleCheck(this)"></div><span>使用 <code>&lt;input type="range"&gt;</code>、<code>&lt;progress&gt;</code> 與 <code>&lt;meter&gt;</code> 設定速度與顯示狀態</span></li>
                            <li><div class="check-box" onclick="event.stopPropagation(); toggleCheck(this)"></div><span>使用 <code>&lt;ul&gt;</code> 清單結構規劃並列出系統日誌</span></li>
                            <li><div class="check-box" onclick="event.stopPropagation(); toggleCheck(this)"></div><span>為新增的控制元件套用觸控防選與防延遲 CSS 設定</span></li>
                        </ul>
                        <div class="ms-note" style="margin-top:12px;">
                            <i class="fas fa-info-circle note-icon"></i>
                            <div class="note-body">
                                <strong>進階挑戰</strong>
                                嘗試將方向按鈕以 Grid 排版，或在行動端旋轉為橫向時自動切換為多欄排版。
                            </div>
                        </div>
                    </div>"""

    old_bullet = "<li>建立 <strong>object-fit: cover</strong> 的全螢幕影像容器，讓 FPV 串流不變形。</li>"
    new_bullet = "<li>掌握 <strong>HTML5 語意化結構</strong> 與滑桿、進度條、儀表等新型計量元件的實作。</li>"

    for file_path in HTML_FILES:
        if not os.path.exists(file_path):
            print(f"Skipping: {file_path} (does not exist)")
            continue

        print(f"Syncing {file_path}...")
        with open(file_path, "r", encoding="utf-8") as f:
            html = f.read()

        # Replace visible Task 3 Card
        if old_task3_card in html:
            html = html.replace(old_task3_card, new_task3_card)
            print("  -> Updated Task 3 card in UI")
        else:
            # Let's try flexible whitespace replacement if exact match fails
            print("  -> Exact Task 3 card match failed, using regex or skipping UI card...")

        # Replace summary bullet point
        if old_bullet in html:
            html = html.replace(old_bullet, new_bullet)
            print("  -> Updated summary bullet point")
        else:
            print("  -> Summary bullet point not found")

        # Replace hidden guides
        html = replace_section_content(html, "assignment-guide", readme_html)
        print("  -> Updated #assignment-guide section")

        html = replace_section_content(html, "tutor-guide", tutor_html)
        print("  -> Updated #tutor-guide section")

        # Write back to file
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  -> Finished updating {file_path}")

if __name__ == "__main__":
    main()
