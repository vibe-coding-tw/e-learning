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

## 3. Technical Standards
- **Global Catalog**: Managed in `public/lessons.json` (synced to `functions/lessons.json`).
- **Lesson Indexing**:
    - `setup`: Free onboarding tracks.
    - `started`: Entry-level courses (renumbered Lesson 1-5).
    - `bonus`: Special topics like AI Agents.
- **Asset Management**: Avoid raw placeholders; use premium images or generated assets that match the tech theme.
- **SEO**: Every page must have a descriptive `<title>` and semantic HTML structure.

## 4. DevOps & Deployment
- **GitHub Sync**: Always perform a `git push` to synchronize the local repository with GitHub after each successful Firebase deployment (`firebase deploy`). This ensures the code status on GitHub is always consistent with the production environment.
