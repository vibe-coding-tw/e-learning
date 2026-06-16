# Starter Repo 安全檢查（防解答外洩）

> GitHub Classroom 已停用。本文件適用於所有會對學生可見的 starter / template repo 發佈前檢查。

## 目的
在發佈或更新學生可見 starter / template repo 前，先檢查是否把教師答案或解答檔一起放進學生可見 repo。

## 工具
- 腳本：`scripts/check_classroom_solution_leak.sh`
- 預設掃描路徑：`/Users/roverchen/Documents/Classrooms`（舊資料夾名；也可改為你的 starter / template repo 路徑）

## 使用方式
```bash
# 使用預設路徑
scripts/check_classroom_solution_leak.sh

# 指定其他路徑
scripts/check_classroom_solution_leak.sh /path/to/starter-repos
```

## 判讀結果
- `PASS`：未發現高風險檔名。
- `FAIL`：找到疑似解答檔（會列出完整檔案路徑，並以 exit code 1 結束）。

## 目前檢查規則
檔名/路徑若包含以下模式會被標記：
- `verify_solution`
- `solution / solutions`
- `answer / answers`
- `teacher-only / tutor-only`
- `sample-answer / official-solution`
- 中文關鍵字：`解答 / 答案 / 教師版 / 助教版`

## 建議處理
1. 將命中檔案移到 tutor-only 或 private repo。
2. 學生 starter repo 僅保留：題目、骨架、測試、README。
3. 每次發佈前先跑一次此腳本，再發 invite link。
