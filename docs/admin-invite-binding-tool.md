# 歷史綁定查核工具

> 舊作業邀請流程已停用。這份文件僅保留舊綁定查核流程的歷史紀錄，不代表現行系統仍有可用的 admin 查詢工具。
>
> 現行要追蹤欄位遷移與相容策略，請先看 [`docs/assignment-url-migration-plan.md`](assignment-url-migration-plan.md)。

## 1. Why This Exists
過去平台曾提供一個 admin 查核工具，用來快速查詢某一條歷史作業綁定連結在 Firestore 中對應到哪些課程單元，方便排查「歷史連結有效但綁定狀態不一致」的問題。

這個工具已經不在現行流程中使用。

## 2. Historical Entry Points
- Cloud Functions callable: `findClassroomInviteBinding`（已停用）
- Cloud Functions HTTP (CORS-safe): `findClassroomInviteBindingHttp`（已停用）
- Dashboard helper (admin): `adminFindInviteBinding()`（已停用）

## 3. Historical Permission Model
- 過去僅 `role === admin` 可查詢。
- HTTP 版本過去需帶 Firebase ID token（Bearer）。

## 4. Historical Query Input
- `inviteCodeOrUrl`
  - 可輸入完整歷史作業連結：`https://classroom.github.com/a/xxxxx`
  - 或只輸入 invite code：`xxxxx`

## 5. Historical Output Fields
- `normalizedInvite`
- `totalMatches`
- `matches[]`:
  - `lessonDocId`
  - `courseId`
  - `title`
  - `unitKey`
  - `courseUnits`

## 6. Historical Operational Notes
1. 若 `totalMatches = 0`，代表該歷史作業連結未能在舊資料中對應到 `metadata_lessons.githubClassroomUrls`，或後續已被清理。
2. 若你現在在排查作業入口問題，請不要再回頭依賴這個工具；請改查：
   - `users.tutorConfigs[unitId].authorized`
   - `assignmentUrl` / `assignmentRepoUrl`
   - 學生是否具備該單元付款授權
3. 若你正在做欄位遷移，請以 [`docs/assignment-url-migration-plan.md`](assignment-url-migration-plan.md) 為主。
