#  mission: 打造你的駕駛艙 (Build Your Cockpit)

這是一個專為 FPV 無人車開發的 Web App 啟始專案。你將在這裡完成 HTML5 與 CSS3 的基礎建置。

## 任務清單 (Milestones)

- [ ] **作業 1-1: 實機部署成功**
    - 在手機上看到此頁面。
    - **回報：** 請將手機連線後的截圖貼在下方。
- [ ] **作業 1-2: 觸控友善性優化**
    - 在 `style.css` 中加入 `touch-action` 與 `user-select`。
- [ ] **作業 1-3: FPV 影像容器佈局**
    - 實作滿版影像，並使用 `object-fit: cover`。

---

## 1-1 任務回饋 (Screenshot Reward)

> 請在此貼上你的手機預覽截圖：
> ![手機截圖](path/to/your/screenshot.png)

---

## 疑難排解 (Troubleshooting)

| 狀況 | 可能原因 | 對策 |
| :--- | :--- | :--- |
| 手機打不開網頁 | 不同網段 | 確認手機與電腦連在同一個 WiFi 基地台 |
| 連線超時 | 防火牆 | 暫時關閉電腦防火牆或新增例外規則 |
| 畫面比例不對 | Viewport | 確認 index.html 中有 `<meta name="viewport">` |

---

## 基地台通訊 (Git Workflow)

完成任務後，請將資料回傳至基地台：

```bash
git add .
git commit -m "mission complete: cockpit layout refined"
git push
```
