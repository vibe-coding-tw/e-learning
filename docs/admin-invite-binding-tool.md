# Admin Invite Binding Lookup Tool

## Purpose
快速查詢某一條 GitHub Classroom 邀請連結目前在 Firestore 綁定到哪些課程單元，避免「連結有效但作業頁綁定導師失敗」這類問題難以排查。

## Entry Points
- Cloud Functions callable: `findClassroomInviteBinding`
- Cloud Functions HTTP (CORS-safe): `findClassroomInviteBindingHttp`
- Dashboard helper (admin): `adminFindInviteBinding()`

## Permission Model
- 僅 `role === admin` 可查詢。
- HTTP 版本需帶 Firebase ID token（Bearer）。

## Query Input
- `inviteCodeOrUrl`
  - 可輸入完整 URL：`https://classroom.github.com/a/xxxxx`
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
1. 若 `totalMatches = 0`，表示該邀請連結尚未寫入 `metadata_lessons.githubClassroomUrls`。
2. 若查到單元但作業頁仍報錯，請檢查：
   - 該 Tutor 在 `users.tutorConfigs[unitId].authorized` 是否為 `true`
   - 該單元是否已設定 `assignmentUrl/githubClassroomUrl`
   - 學生是否具備該單元付款授權
