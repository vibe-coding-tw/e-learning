# 腳本退役候選清單

這份清單整理目前專案內的 `scripts/`、`functions/scripts/` 與相關維運工具，目標是區分：

- **仍建議保留**：目前還有明確用途、仍在 `firebase.json`、README 或日常維運流程中使用的腳本
- **可退役候選**：主要屬於舊 Classroom / bridge 遷移、批次回補或一次性整理用途；若後續不再需要，可搬到 `archive/` 或刪除

## 仍建議保留

### 專案級 / 站點工具
- `scripts/fingerprint-static-assets.js`
  - Firebase Hosting 會直接執行。
  - 用於靜態資產指紋化與快取更新。
- `scripts/audit-rover-tutor-configs.js`
  - 稽核 `rover.k.chen@gmail.com` 的 `tutorConfigs` 是否覆蓋所有單元。
- `scripts/audit_autograde_consistency.sh`
  - 檢查 autograde workflow、README、secrets 與 repo 設定是否一致。
- `scripts/toggle_actions.py`
  - 批次開/關 GitHub Actions。
- `scripts/toggle_bridge_actions.sh`
  - 批次開/關 bridge repo 的 Actions。

### 後端維運 / 資料修補
- `functions/scripts/*`
  - Firestore audit、資料回補、分潤修補、物流回補、自動評分匯出等。
  - 這一層已是後端維運主場，建議繼續保留在 `functions/scripts/`。

## 可退役候選

以下腳本多半與舊 Classroom / bridge 遷移、模板同步、README 自動整理、一次性回補有關；若後續不再需要相關作業，可考慮退役：

- `scripts/sync_classroom_repos.sh`
- `scripts/sync_classroom_bridge_repos.sh`
- `scripts/bootstrap_classroom_repo_autograde.sh`
- `scripts/generate_and_distribute_autograde_token.sh`
- `scripts/standardize_classroom_readme_autograde.sh`
- `scripts/sync_check_assignment_from_template.sh`
- `scripts/rewrite_template_org_in_csv.sh`
- `scripts/prune_bridge_repo_contents.sh`
- `scripts/remove_bridge_readme_title_prefix.sh`
- `scripts/remove_bridge_tutor_guide.sh`
- `scripts/merge_classroom_workflows.sh`
- `scripts/sync_bridge_readme_from_assignment_guide.py`
- `scripts/enrich_guides.py`
- `scripts/enrich_html5_basics.py`
- `scripts/migrate_tutor_guides.py`
- `scripts/normalize_bridge_readme_tone.sh`
- `scripts/revert_readme_autograde_section.sh`
- `scripts/setup_autograde_repo_mapping.sh`
- `scripts/check_classroom_solution_leak.sh`
- `scripts/translate_courses.py`

## 已移除

以下腳本已確認不再需要，並已從 repo 移除：

- `scripts/localized-public-sync.js`
- `scripts/sync_localized_public_pages.js`
- `scripts/delete_bridge_repos.py`
- `scripts/generate_all_graders.py`
- `scripts/merge_classroom_templates.py`
- `scripts/update_student_workflows.py`
- `functions/scripts/normalize_referral_links_unit_ids.js`
- `functions/scripts/audit_referral_links_canonical_state.js`
- `functions/scripts/migrate_lessons_classroom_urls.js`
- `functions/scripts/migrate_metadata_lessons_unit_filenames.js`
- `functions/scripts/normalize_runtime_canonical_fields.js`
- `functions/scripts/migrate_all_legacy_firestore_references.js`
- `functions/scripts/migrate_legacy_ids_firestore.js`
- `functions/scripts/rename_basic_advanced_metadata_lessons_doc_ids.js`
- `functions/scripts/rename_starter_metadata_lessons_doc_ids.js`

## 可先搬入 archive

以下腳本目前仍被文件提到，但已經不在主 runtime 或 active workflow 中，適合先搬到 `archive/`，之後再視情況決定是否刪除：

- `scripts/sync_classroom_repos.sh`
- `scripts/sync_classroom_bridge_repos.sh`
- `scripts/bootstrap_classroom_repo_autograde.sh`
- `scripts/generate_and_distribute_autograde_token.sh`
- `scripts/standardize_classroom_readme_autograde.sh`
- `scripts/sync_check_assignment_from_template.sh`
- `scripts/rewrite_template_org_in_csv.sh`
- `scripts/prune_bridge_repo_contents.sh`
- `scripts/remove_bridge_readme_title_prefix.sh`
- `scripts/remove_bridge_tutor_guide.sh`
- `scripts/merge_classroom_workflows.sh`
- `scripts/sync_bridge_readme_from_assignment_guide.py`
- `scripts/enrich_guides.py`
- `scripts/enrich_html5_basics.py`
- `scripts/migrate_tutor_guides.py`
- `scripts/normalize_bridge_readme_tone.sh`
- `scripts/revert_readme_autograde_section.sh`
- `scripts/setup_autograde_repo_mapping.sh`
- `scripts/translate_courses.py`

## 模板資產，非執行檔

以下兩個檔案不是可執行腳本，而是模板內容資產：

- `scripts/03-unit-github-classroom-README.md`
- `scripts/03-unit-github-classroom-tutor-guide.md`

## 建議處理方式

1. 先保留 `仍建議保留` 類腳本。
2. `可退役候選` 先不要直接刪，先搬到 `archive/` 或標註 deprecated。
3. 等確定目前沒有任何文件、workflow、手動操作流程再引用它們後，再正式移除。
