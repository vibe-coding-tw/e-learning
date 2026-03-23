# Vibe Coding: Design & Technical Rules

This document outlines the core principles and standards for the Vibe Coding platform, ensuring consistency across courses, UI, and teacher tools.

## 1. Visual Language & UX
- **Modern Tech Aesthetics**: Use deep gradients (Slate-900 to Indigo-900), glassmorphism, and high-quality shadows (`shadow-xl`) to create a premium feel.
- **Color Palette**:
    - **Primary**: Indigo/Blue (General/Navigation)
    - **Secondary**: Purple (Bonus/Special Cases)
    - **Status**: Emerald (Success/Missions), Amber (Warnings/Notes), Blue (Information).
- **Typography**: Use Google Fonts "Inter" for UI and "Outfit" for headings.
- **Atomic Components**:
    - `glass-card`: Semi-transparent background with backdrop blur.
    - `action-btn`: Rounded-full buttons with subtle scale-on-hover effects.
    - `info-card`: Structured course cards with gradient top borders.

## 2. Course Architecture
- **Navigation Hierarchy**: Use `js/nav-component.js` for global navigation.
- **Unit Structure**: Every unit file (`01-unit-*.html`) must include:
    - **Hero Section**: With a high-impact background and clear title.
    - **Interactive Lab**: Visual simulations (OAuth, BLE, etc.) to explain complex concepts.
    - **Practical Mission**: Actionable "角色扮演" (Role-playing) tasks with clear scoring benchmarks.
    - **Reflections (🧠)**: "思考一下" sections for cognitive reinforcement.
- **Dashboard Hooks**: Units must contain hidden sections (`#assignment-guide` and `#instructor-guide`) for dynamic extraction by the teacher dashboard.

## 3. Tutor: 合格教師運作模式
- **核心定位**：Tutor 不是被 AI 取代，而是具備「AI 超能力」的資深導師。
- **工作流 (Workflow)**：
    1. **同步 (Sync)**：系統自動提取各單元的 `assignment-guide`。
    2. **輔助 (Augment)**：老師利用 AI Agent (如 Copilot Agent Mode) 對 PR 進行初步掃描與對標。
    3. **點評 (Mentor)**：Tutor 根據 AI 摘要，進行深入的邏輯點評與 Vibe 調校。
- **規模化能力**：1 位 Tutor 可透過此機制同時導引 50+ 名學生，維持高品質且一致的反饋標準。

## 4. Technical Standards
- **Global Catalog**: Managed in `public/lessons.json` (synced to `functions/lessons.json`).
- **Lesson Indexing**:
    - `setup`: Free onboarding tracks.
    - `started`: Entry-level courses (renumbered Lesson 1-5).
    - `bonus`: Special topics like AI Agents.
- **Asset Management**: Avoid raw placeholders; use premium images or generated assets that match the tech theme.
- **SEO**: Every page must have a descriptive `<title>` and semantic HTML structure.

## 5. DevOps & Deployment
- **GitHub Sync**: Always perform a `git push` to synchronize the local repository with GitHub after each successful Firebase deployment (`firebase deploy`). This ensures the code status on GitHub is always consistent with the production environment.
