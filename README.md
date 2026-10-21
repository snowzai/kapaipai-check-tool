# 卡拍拍卡號查詢（書籤小工具）

在 trade.kapaipai.tw 上按一下書籤，跳出查詢面板：輸入卡號，只列出編號完全符合的卡，繁中、日文分兩欄顯示。

> 目前僅支援「寶可夢卡牌（PTCG）」查詢，其他卡牌遊戲的查詢後續再開發。

## 安裝
1. 用瀏覽器開啟 `dist/install.html`
2. 把「卡號查詢」連結拖曳到書籤列（拖曳不行就新增書籤，網址貼 `dist/bookmarklet.txt` 的內容）

## 使用
- 開啟 trade.kapaipai.tw 任一頁 → 按書籤 → 輸入卡號 → Enter
- 支援格式：`s10a 073`、`S10a-073`、`S-P 201`、`S-P-201`（大小寫、前導零都不影響）
- 每筆顯示：卡名、稀有度、最低價、均價；點卡片在新分頁開啟該卡頁面
- 再按一次書籤隱藏／顯示，`Esc` 關閉；會記住上次查詢的卡號

## 運作方式
- 呼叫卡拍拍自己的 API：`GET /api/card/getFilteredList?game=&name=<卡號>`（`game` 留空＝繁中＋日文一起回傳）
- 從每張卡的 `rareList` 過濾 `packId` + `packCardId` 符合輸入的項目
  - `packCardId` 有兩種格式：`073`、`S10a-073`，比對前會去掉擴充包前綴與前導零
- 卡片頁連結：`/cardredirect/<game>?cardkey=&rare=&pack=&packcard=`
- 卡圖：`https://static.kapaipai.tw/image/card/<game>/<cardGlobalKey>/<packId>/<packCardId>/<rare>.jpg`

## 為什麼不是獨立網頁
- API 沒有開放 CORS，其他網域的網頁無法呼叫
- 從本機用 Node / curl 直接連會被 TLS 拒絕（alert 49 access denied），本機代理伺服器也行不通
- 書籤在卡拍拍頁面內執行，屬於同網域請求，沒有上述限制

## 修改
- 原始碼：`src/kapaipai-lookup.js`（只能用 `/* */` 註解，build 時會移除）
- 改完執行 `node build.mjs`，重新產生 `dist/`，書籤要重新安裝
- 卡拍拍改版導致 API 或欄位名稱變動時，這個工具就會失效
