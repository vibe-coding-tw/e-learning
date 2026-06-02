# 歷史與 Backlog
**Last updated**: 2026-06-01

這份文件把過去分散在 `docs/migration-history.md`、`docs/system-improvement-backlog.md` 與部分 `platform-expansion-plan.md` 的重疊內容收斂到單一入口。

## 1. What Is Historical

- 歷史遷移、canonical 化、legacy master 收斂、referral / order key 清理等內容，視為 migration history。
- 若描述的是「已完成的收斂」或「保留做相容的舊路徑」，應放在這一章或各 domain spec 的 implementation notes。

### 已完成的主要收斂
- `orders.items` canonical 清理已完成。
- `referral_links.unitId` canonical 清理已完成。
- `metadata_lessons` 的 canonical course identity 已成為 runtime 依據。
- `role` 與 tutor 身分判定已統一為 `admin` / `user` + `users.tutorConfigs[unitId].authorized`。

### 仍保留的相容層
- `mapLegacyMasterToCanonical()` 仍保留給舊網址 redirect 與明確的 legacy token scope。
- `*-master-*` 相關兼容只在歷史流量仍存在時維持。

## 2. Current Backlog

### P0
- Firestore-first runtime cleanup
- Canonical course identity normalization
- Order activation validation
- Unit dashboard hard-rule enforcement

### P1
- Remove duplicate legacy course cards from Firestore
- Learning-path fully metadata-driven
- Course tabs fully metadata-driven
- Content-runtime separation

### P2
- Documentation split: current spec vs migration history
- Master-page retirement plan finalization
- Activation and referral audit tooling

## 3. Primary Acceptance Themes

- Runtime decisions should prefer Firestore over hardcoded compatibility lists.
- Canonical course/unit identity should be consistent across payment, dashboard, referral, and tutor flows.
- Legacy compatibility should remain explicit, narrow, and well-documented.

## 4. Related Files

- `docs/database.md`
- `docs/recursive-sharing.md`
- `docs/tutor-management-mvp.md`
- `docs/platform-expansion-plan.md`
- `functions/index.js`
