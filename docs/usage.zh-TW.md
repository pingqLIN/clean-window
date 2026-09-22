# 操作與還原

[專案首頁](../README.zh-TW.md) · [English](usage.md)

只處理你指定的 Chrome 視窗或分頁，不更動 Chrome 全域外觀設定。

**狀態：程式與 30 項自動化測試完成；尚未通過 Chrome GUI／使用者 Windows 實機驗收。**
本次雲端測試環境限制擴充載入與全螢幕，未修改或繞過其政策。

## 先選適合的模式

| 模式 | 作用範圍 | 視窗可拖曳／縮放 | 還原方式 |
| --- | --- | --- | --- |
| 目前分頁 → 精簡視窗 | 把目前分頁移至獨立 popup；原視窗其他分頁留下 | 可以；保留系統標題列 | 再按 Alt+Shift+W，或 Alt+Shift+R |
| 整個視窗 → 全螢幕 | 此視窗與全部分頁／群組，不移出任何分頁 | 全螢幕時不是一般可縮放小視窗 | 再按 Alt+Shift+F，或 Alt+Shift+R；也可用 Chrome 原生 F11 |

精簡模式使用 Chrome 原生 popup 視窗，目標是不顯示一般網址列、分頁列、書籤列。Chrome 的來源／安全提示、權限提示、系統標題列與邊框不會被攔截或偽裝；實際外觀需要在你的 Chrome 版本確認。

**需要「整個原視窗、所有分頁原封不動」時，請用全螢幕模式。**
一般擴充沒有把現有 normal 視窗直接改成 popup 的公開 API，因此精簡模式會產生新的 windowId，而不是原地隱藏原視窗所有介面。

## 安裝（不需要 Node、Python、伺服器或管理員權限）

1. 解壓縮 ZIP 到固定資料夾。請保留解壓縮後的資料夾，不要移動或刪除。
2. 在 Chrome 開啟 `chrome://extensions/`，開啟「開發人員模式」。
3. 按「載入未封裝項目」，選擇解壓後的 **`clean-window\extension`** 資料夾；此層必須看得到 `manifest.json`。不要選 ZIP，也不要選上層專案根目錄。
4. 在右上角擴充功能選單，把「Clean Window｜乾淨視窗」釘選。切到要處理的視窗，點圖示選擇模式。

安裝完成後請保留 extension 資料夾，不要移動／刪除。企業管理的 Chrome 可能不允許開發人員模式或未封裝擴充；本套件不繞過管理政策。

## 操作與還原

| 操作 | 預設快捷鍵 |
| --- | --- |
| 目前分頁切換精簡／普通視窗 | `Alt + Shift + W` |
| 整個目標視窗切換全螢幕 | `Alt + Shift + F` |
| 還原目前視窗 | `Alt + Shift + R` |

精簡後沒有工具列，**先記住 `Alt + Shift + R`**。也能在一般網頁空白處按右鍵，選 `Clean Window · 還原目前視窗`。網站禁止右鍵、自訂選單或 Chrome 內部頁面可能使右鍵入口無法使用，這時使用快捷鍵。

快捷鍵沒有反應時，開啟 `chrome://extensions/shortcuts` 指定未占用的組合。Chrome／作業系統與其他擴充可能占用快捷鍵，Windows 的 Alt+Shift 語言切換設定也可能衝突。面板會顯示實際註冊的組合；未註冊時顯示「未指定快捷鍵」。

從精簡視窗還原：原視窗仍存在時嘗試放回原視窗與原分頁位置；不存在時建立新的普通視窗，不擅自塞進其他 Chrome 視窗。Chrome 重啟／重新載入擴充可能清除原視窗對應，這時仍可把精簡視窗還原為新的普通視窗。

按系統的「X」是正常關閉該分頁，**不是還原**。請用還原入口。

## 不影響其他視窗的設計

所有操作都綁定觸發當下的 `windowId`、`tabId`。分頁已移走或關閉時回報錯誤，不改操作另一個當下取得焦點的視窗。只更新目標視窗；不改全域書籤列偏好、不改 Profile、不重啟 Chrome、不批次關閉視窗。

切換時焦點自然會移到目標或還原視窗；「不影響其他視窗」指不更動其外觀設定、大小、模式與分頁內容，不代表焦點完全不會改變。

## 使用前知道的限制

- 精簡模式只移動一個目前分頁，不是把同一視窗全部分頁收進一個無分頁列視窗。
- 此版不把群組或 Split View 分頁移出，避免破壞結構；可改用全螢幕模式。
- 搬走原視窗最後一個分頁時，Chrome 會自然關閉空視窗。還原時可能是新的 windowId；依賴原 windowId 的其他自動化應使用全螢幕模式。
- 程式使用既有 tabId，不依 URL 重新開頁，不主動 reload；但是視窗大小改變可能觸發網站自己的 resize 邏輯，未儲存資料仍須先保存。此點尚未經本機實際網站驗收。
- 保留系統標題列／關閉按鈕。這不是任意尺寸、完全無框的原生視窗工具，也不使用已棄用的 Chrome Apps API。
- Chrome 自身安全提示、下載／權限提示不會被移除。特殊 Chrome 頁面、已安裝 PWA、Isolated Web App 或其他擴充頁面的移動可能受 Chrome 限制；遇到 API 拒絕會回報錯誤。
- 要在無痕模式使用，需自行於擴充詳細資料允許無痕；程式採 split 模式並保留目標的 incognito 屬性，不跨一般／無痕視窗還原。

## 建議的首次驗收

先用一般測試頁面，不要直接拿尚未儲存的重要表單測試。

1. 開兩個 Chrome 視窗 A、B，讓 A 有兩個分頁，B 保持一般模式。
2. 在 A 的目前分頁啟動精簡模式，確認精簡視窗外觀與可縮放性；B 的網址列、分頁列與書籤列不變。
3. 按 `Alt+Shift+R`，確認分頁回到 A。再對 A 測試一次全螢幕與還原。
4. 若 A 使用群組／Split View，改以全螢幕測試；若快捷鍵未註冊，先在 shortcuts 頁面設定。

## 權限與資料

只有 `storage`、`contextMenus` 兩項權限。沒有 `tabs` 敏感資料權限、`activeTab`、網站權限、content script、網路請求、遙測或 Native Messaging。只在 `chrome.storage.session` 存視窗識別碼、原位置／模式、分頁索引與操作訊息；不存頁面內容或瀏覽網址。

## 開發與測試

安裝擴充不需執行下列指令。只有修改程式時需要 Node.js 20+；沒有 npm 依賴，不需要 `npm install`。

```sh
npm test
npm run check
```

`tests/browser-smoke.py` 是開發用實機測試腳本，不是擴充執行的一部分，需 Playwright、Pillow 與可載入擴充的 Chromium。Linux 須另有 Xvfb、Openbox；腳本使用暫存 Profile、僅 loopback 測試頁，遇到已知管理政策限制就以 BLOCKED 停止，不修改政策。

完整結果見[驗證紀錄](verification.md)。本機測試輸出位於被 Git 忽略的 `evidence/`，不納入公開原始碼。

## 官方技術依據

- Chrome Windows API（create 的 type/tabId；update 的 state 與 bounds）：https://developer.chrome.com/docs/extensions/reference/api/windows
- Chrome Tabs API（敏感權限、移動限制）：https://developer.chrome.com/docs/extensions/reference/api/tabs
- Chrome Commands API（快捷鍵與衝突）：https://developer.chrome.com/docs/extensions/reference/api/commands
- 載入未封裝擴充：https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world
- Chromium windows.create 實作（popup／tab 移動）：https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/extensions/api/tabs/tabs_api.cc

查核日期：2026-09-23（Asia/Taipei）。
