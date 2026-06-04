# Investor FAQ

Last updated: 2026-06-04

## 1. Authorized shares 和 issued shares 有什麼差別？

- `authorized shares` 是公司法定允許的上限
- `issued shares` 是實際已發出去、目前在股東手上的股數
- 前者通常要走正式公司程序才會改
- 後者會隨增資、買回、註銷、轉讓而變動

## 2. 估值快照是什麼？

估值快照是一個「鎖住的定價版本」。

它用來支援某一次發股或服務換股當下的定價，不是每天浮動的市場報價。
- 之後若出現新的估值，不會回頭改寫舊的發股紀錄
- 每次發股都應該對應一個明確的 snapshot

## 3. 估值是不是市場牌價？

不一定。

對私人公司來說，通常沒有真正公開市場牌價。
- 估值比較像融資定價基準
- 實際交易價格通常由估值、談判條件、優先權、稀釋條件等共同決定
- 只有在有公開市場時，價格才比較接近「市場價」

## 4. 為什麼不直接把股份做成一般加密貨幣？

因為股份不是一般代幣。

股份牽涉到：
- 公司法
- 股東名冊
- 董事會 / 股東決議
- 稅務與會計
- 轉讓限制與合規

就算未來上鏈，它也仍然是 security，不會因為用了區塊鏈就變成普通 crypto。

## 5. 服務換股怎麼算？

如果員工、顧問、合作方是用服務折抵換股：
- 先建立一個 valuation snapshot
- 再把對價金額或服務估值換算成持股
- 發股紀錄要寫清楚 `participantType`、`considerationType`、`sharePrice`、`issuedShares`
- 如果有 vesting，也要另外記錄

## 6. 股利怎麼處理？

股利不是重新算股份。

流程是：
- 每筆收入 / 支出先形成 investor event
- 再依份額拆成 credit
- 年底結算時才計算股利
- 結算後保留 ending balance，作為下一年度起點

## 7. crypto 在這裡可以扮演什麼角色？

可以當輔助工具，但不建議取代股權主檔。

可行用途包括：
- 收款
- treasury 管理
- 結算輔助
- 未來作為 ownership record 的鏡像層

不建議用途：
- 直接把 crypto wallet 當成股數主檔
- 把代幣當成不受證券法約束的一般商品

## 8. 我們目前系統已經做到哪裡？

目前系統已經支援：
- investor profiles
- valuation snapshots
- equity issuances
- investor positions
- finance events
- credit allocation
- balances
- annual settlements

## 9. 我現在應該先看哪一份文件？

建議順序：
1. [Cap Table & Tokenization Overview](./cap-table-investor-overview.md)
2. [Cap Table & Tokenization Strategy](./cap-table-and-tokenization-strategy.md)
3. [Cap Table Implementation Spec](./cap-table-implementation-spec.md)
4. [Investor Ledger System](./investor-ledger-system.md)

## 10. 股份一定要有實際交易，才算有價值嗎？

不一定。

可以先有估值，再有交易。
- 估值可以先透過融資討論、可比公司、現金流、或協議條件建立
- 實際交易價格是最強的市場驗證
- 但交易不是價值存在的前提

更精準地說：
- 股份價值不以交易存在為前提，但交易是最重要的市場驗證。
- 估值可以先被定義，實際成交價格會讓它更落地、更容易被市場接受。
