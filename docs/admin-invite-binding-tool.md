# Admin Invite Binding Lookup Tool

## Purpose
快速查詢某一條歷史作業綁定連結目前在 Firestore 綁定到哪些課程單元，避免「歷史連結有效但綁定狀態不一致」這類問題難以排查。

> GitHub Classroom 已停用；此工具僅保留歷史綁定資料與相容查核用途。

## Entry Points
- Cloud Functions callable: `findClassroomInviteBinding`
- Cloud Functions HTTP (CORS-safe): `findClassroomInviteBindingHttp`
- Dashboard helper (admin): `adminFindInviteBinding()`

## Permission Model
- 僅 `role === admin` 可查詢。
- HTTP 版本需帶 Firebase ID token（Bearer）。

## Query Input
- `inviteCodeOrUrl`
  - 可輸入完整歷史 URL：`https://classroom.github.com/a/xxxxx`
  - 或只輸入 invite code：`xxxxx`

## Output Fields
- `normalizedInvite`
- `totalMatches`
- `matches[]`:
  - `lessonDocId`
  - `courseId`
  - `title`
  - `unitKey`
  - `courseUnits`

## Operational Notes
1. 若 `totalMatches = 0`，表示該綁定連結尚未寫入 `metadata_lessons.githubClassroomUrls` 或已被清理。
2. 若查到單元但作業頁仍報錯，請檢查：
   - 該 Tutor 在 `users.tutorConfigs[unitId].authorized` 是否為 `true`
   - 該單元是否已設定 `assignmentUrl` / `assignmentRepoUrl`
   - 學生是否具備該單元付款授權
