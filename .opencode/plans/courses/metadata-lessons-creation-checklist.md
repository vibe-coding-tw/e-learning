# metadata_lessons Creation Checklist
**Last updated**: 2026-06-14

這份清單用來在建立新的 `metadata_lessons` document 時逐項核對，確保新課程**不會影響現有上課**。

---

## 1. Identity Check

- [ ] 已建立新的 Firestore document
- [ ] 使用新的 `docId` / document ID
- [ ] `id` 與 `docId` 保持一致
- [ ] 沒有直接覆寫舊課程 document
- [ ] 舊課程仍保留原本 `docId`

---

## 2. Course Structure Check

- [ ] `metadataType` 已設定正確，且與 `isPhysical` 一致（新文件只用 `course` / `product`）
- [ ] `level` 已設定正確
- [ ] `category` 已設定正確
- [ ] `orderWeight` 已設定正確
- [ ] `course_units` 已完整建立
- [ ] `course_units` 順序符合教學流程
- [ ] 沒有把舊課程的單元順序直接拿來硬套新主線

---

## 3. Multilingual Content Check

- [ ] `i18n.zh-TW.title` 已填
- [ ] `i18n.zh-TW.summary` 已填
- [ ] `i18n.zh-TW.description` 已填
- [ ] `i18n.zh-TW.coreContent` 已填
- [ ] `i18n.en.title` 已填
- [ ] `i18n.en.summary` 已填
- [ ] `i18n.en.description` 已填
- [ ] `i18n.en.coreContent` 已填
- [ ] 沒有只改舊欄位卻沒補新 `i18n`

---

## 4. Visibility and Release Check

- [ ] 新版本先設為 `hiddenFromCatalog = true`
- [ ] 只供內部或 pilot 使用
- [ ] 還沒正式公開前，不會出現在 catalog
- [ ] `isDeprecated` 目前仍為 `false`
- [ ] 舊版本尚未被停用前仍可正常授課

---

## 5. Safety and Compatibility Check

- [ ] 沒有修改舊課程的關鍵欄位去承載新課綱
- [ ] 沒有把新課程混進舊 document
- [ ] 沒有改壞現有授權、價格或作業關聯
- [ ] 沒有影響舊版本的顯示與連結
- [ ] 若有價格資料，已獨立確認不受版本切換影響
- [ ] `isPhysical` 若存在，已由 `metadataType` 正確推導，不會和主型別衝突

---

## 6. Content and Runtime Check

- [ ] 課程內容已確認與新主線一致
- [ ] 作業主軸已更新為新課綱
- [ ] 若需要，`assignment-guide` 與 `tutor-guide` 的規劃已完成
- [ ] 課程 shell / page menu / topnav 仍可正常使用
- [ ] pilot 驗證範圍已定義

---

## 7. Release Flow

建立完成後，請依下列順序操作：

1. 先建立新 document
2. 先設 `hiddenFromCatalog = true`
3. 先做 pilot
4. 驗證不影響舊課程
5. 再公開新版本
6. 最後才停用舊版本

---

## 8. Quick Review

如果以下任一項不成立，就不要公開：

- [ ] 新 `docId` 是唯一的
- [ ] 舊課程沒有被覆寫
- [ ] `i18n` 已完整
- [ ] `course_units` 已完整
- [ ] 新版本已 hidden
- [ ] pilot 已完成
- [ ] 舊版本仍可正常運作

---

## 9. Related Docs

- [`docs/metadata-lessons-versioning-workflow.md`](./metadata-lessons-versioning-workflow.md)
- [`docs/metadata-lessons-new-course-template.md`](./metadata-lessons-new-course-template.md)
- [`docs/course-management-runbook.md`](../course-management-runbook.md)
