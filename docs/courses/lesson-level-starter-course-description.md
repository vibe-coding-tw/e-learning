# Starter Lesson-Level Course Description
**Last updated**: 2026-06-14

這份說明稿對應 starter 線的新 lesson-level 規劃。  
主軸是把「手機 BLE 遙控無人車」拆成 5 個可以逐步上線的 lesson。

---

## 1. Course Positioning

- 課程層級：`starter`
- 主題：手機 BLE 遙控無人車
- 對象：已經會基本手機操作，想從 UI 互動進入 BLE 控制的人
- 目標：先把控制意圖與互動體驗做好，再接到 BLE 傳輸與安全

---

## 2. Learning Outcomes

完成後，學員應該能：

1. 了解手機端控制介面的基本結構。
2. 設計可傳輸的控制資料格式。
3. 把操作流程整理成穩定的互動模型。
4. 為 BLE 遙控做好封包與安全前置。
5. 用 lesson-level 的方式逐步完成整門課。

---

## 3. Lesson Map

| 課次 | lessonKey | 主題 | units |
|---|---|---|---|
| 01 | `mobile-control-foundation` | 手機控制基礎 | `html5-basics`, `touch-vs-mouse`, `touch-basics` |
| 02 | `interaction-polish` | 互動細節調整 | `prevent-default`, `long-press`, `flexbox-layout` |
| 03 | `control-ui-state` | 控制介面與狀態 | `ui-ux-standards`, `control-panel`, `canvas-joystick` |
| 04 | `control-data-modeling` | 控制資料建模 | `joystick-math`, `flow-logic`, `data-json` |
| 05 | `ble-readiness` | BLE 上線準備 | `typed-arrays`, `ble-async`, `ble-security` |

---

## 4. Writing Strategy

- 先寫可學的互動與資料模型。
- 再讓學員知道 BLE 為什麼要這樣接。
- 每個 lesson 都可以先獨立 pilot。
- 課程不直接動舊版 starter。

---

## 5. Pilot Notes

- 建議先用 `hiddenFromCatalog = true` 發佈。
- 先讓內部或少數班級驗證 lesson 節奏。
- 確定 lesson 順序穩定後，再切公開。

