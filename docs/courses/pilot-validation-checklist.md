# Pilot Validation Checklist
**Last updated**: 2026-06-14

這份清單用來在新課程正式公開前做 pilot 驗證。  
目標是確認：

- 新版本可用
- 舊版本不受影響
- 課程主線是連貫的
- 作業與授課節奏可以被學生跟上

---

## 1. General Checks

- [ ] 新課程 document 已建立
- [ ] 新課程先設為 `hiddenFromCatalog = true`
- [ ] 舊課程仍可正常進入與授課
- [ ] 新版本沒有覆寫舊版本內容
- [ ] 作業入口正常
- [ ] 語言切換正常
- [ ] 課程 shell 正常載入
- [ ] 相關 `metadata_lessons` 欄位已完整

---

## 2. Content Checks

- [ ] 課程主題與新課綱一致
- [ ] 單元順序符合規劃
- [ ] 作業敘事不會跳脫主題
- [ ] 每一關的中間成果都能接到下一關
- [ ] 不需要依賴舊版 fallback 才能上課

---

## 3. Starter Pilot Checks

- [ ] `HTML5 Basics` 能順利作為前置起點
- [ ] `Touch Basics` 可產出控制意圖資料
- [ ] `Data JSON` 可完成 payload 定義
- [ ] `Typed Arrays` 可完成 byte packet 練習
- [ ] `BLE Async` 可完成連線狀態機
- [ ] `BLE Security` 可說明安全與相容性限制

---

## 4. Basic Pilot Checks

- [ ] `PlatformIO Setup` 可穩定建立專案
- [ ] `PWM Basics` 可穩定輸出速度控制
- [ ] `H-Bridge` 可完成前進 / 後退 / 煞車
- [ ] `FSM` 可定義完整控制狀態
- [ ] `Millis` 可維持非阻塞控制
- [ ] `BLE Properties` 或相關通訊單元可完成實機資料流

---

## 5. Advanced Pilot Checks

- [ ] `Image DMA` 可穩定取得影像
- [ ] `Threshold Filter` / `Feature Extraction` 可產出可觀測中間結果
- [ ] `Centroid` / `Error` 單元可接到控制輸出
- [ ] `P Control` / `Closed Loop` 可形成最小可跑閉環
- [ ] `PID` 單元可完成調參與驗證
- [ ] `BLE Notify` / `BLE Async` 可用於監控或收尾部署

---

## 6. Pilot Exit Criteria

當以下條件都成立時，才建議進入正式公開：

1. 學生能跟上課程節奏，不需要大量臨時補救。
2. 老師授課時不會因內容跳躍而頻繁中斷。
3. 新舊版本並存時不會互相干擾。
4. 作業產物能接續下一關。
5. 紀錄的錯誤與回饋已經可被整理成正式版本。

---

## 7. Related Docs

- [`docs/curriculum-migration-plan.md`](./curriculum-migration-plan.md)
- [`docs/metadata-lessons-versioning-workflow.md`](./metadata-lessons-versioning-workflow.md)
- [`docs/metadata-lessons-creation-checklist.md`](./metadata-lessons-creation-checklist.md)
