# 操作與還原

[專案首頁](../README.zh-TW.md) · [English](usage.md)

只處理你指定的 Chrome 視窗或分頁，不更動 Chrome 全域外觀設定。

**狀態：程式與 59 項自動化測試完成；尚未通過 Chrome GUI／使用者 Windows 實機驗收。**
本次雲端測試環境限制擴充載入與全螢幕，未修改或繞過其政策。

## 三級精簡操作

設定滑桿：1 為自繪網址欄＋自繪擴充欄；2 只有自繪網址欄；3 純精簡 Popup。三種皆只搬移目前分頁，保留可拖曳縮放的視窗標題列。預設第 1 級。

第 1 級的自繪擴充欄有兩個有效操作：還原此視窗、開啟 Chrome 擴充功能管理頁。這不是其他擴充的原生工具列，不能代替第三方操作。自繪網址欄不提供可信任網站來源／安全標誌；第一、二級需有使用者觸發的暫時性注入權限，跨頁導覽後可能消失。第三級沒有網址或擴充工具列，但一般 HTTP(S) 頁面若允許注入，仍可使用頁面邊緣的三級控制標籤及標題處理腳本。

**頁面邊緣控制：** 左右邊緣的 `◈` 標籤預設不顯示文字；滑鼠移入或鍵盤聚焦後展開上中下三級，僅在檔位 Hover／聚焦時浮現說明。點選會直接切換目前 Popup 內的自繪欄位，不重新移動分頁；可拖曳標籤吸附左右兩側並調整高度，位置存在本機。特殊頁面或跨來源導覽可能導致注入失效，屆時用還原快捷鍵。

Alt + Shift + R 可還原；Alt + Shift + F 仍是獨立的全螢幕快捷鍵，不在三級滑桿中。

**標題快速入口：** 在已啟用乾淨模式、可注入的一般網頁上，單擊側邊 `◈` 圖示即可開啟標題編輯器；拖曳則移動邊緣工具。編輯器支援一個 Unicode Emoji 字素（含國旗、組合表情及膚色）、常用 Emoji 按鈕與既有 Symbol。Chrome 原生標題列的點擊無法由擴充接管。

**標題：** 乾淨 Popup 的頁面標題預設是 `◈ 原始網頁標題`；`Alt + Shift + T` 或在頁面按右鍵選「Clean Window · 編輯乾淨模式標題」可開啟 Symbol＋文字編輯器。可選擇標準 Unicode Symbol、編輯文字、取消或重設為原始標題。離開乾淨模式時恢復最近的網頁原始標題。只有可注入的 HTTP(S) 網頁支援編輯，SPA 網站自行更新標題時會追蹤更新；不變更真正的 favicon、Chrome 安全圖示或其他分頁。

## 安裝（不需要 Node、Python、伺服器或管理員權限）

1. 解壓縮 ZIP 到固定資料夾。請保留解壓縮後的資料夾，不要移動或刪除。
2. 在 Chrome 開啟 `chrome://extensions/`，開啟「開發人員模式」。
3. 按「載入未封裝項目」，選擇解壓後的 **`clean-window\extension`** 資料夾；此層必須看得到 `manifest.json`。不要選 ZIP，也不要選上層專案根目錄。
4. 在右上角擴充功能選單，把「Clean Window｜乾淨視窗」釘選。切到要處理的視窗，點圖示選擇模式。

安裝完成後請保留 extension 資料夾，不要移動／刪除。企業管理的 Chrome 可能不允許開發人員模式或未封裝擴充；本套件不繞過管理政策。

## 操作與還原

| 操作 | 預設快捷鍵 |
| --- | --- |
| 依照滑桿等級套用簡化模式／還原 | `Alt + Shift + W` |
| 整個目標視窗切換全螢幕 | `Alt + Shift + F` |
| 還原目前視窗 | `Alt + Shift + R` |
| 編輯乾淨模式的 Symbol＋標題 | `Alt + Shift + T` |

精簡後沒有 Chrome 原生工具列，**先記住 `Alt + Shift + R`**。也能在一般網頁空白處按右鍵，選 `Clean Window · 還原目前視窗`。網站禁止右鍵、自訂選單或 Chrome 內部頁面可能使右鍵入口無法使用，這時使用快捷鍵。

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
- 第 1–3 級保留系統標題列／關閉按鈕並可縮放；獨立全螢幕快捷鍵可另行切換視窗狀態。不使用已棄用的 Chrome Apps API。
- Chrome 自身安全提示、下載／權限提示不會被移除。特殊 Chrome 頁面、已安裝 PWA、Isolated Web App 或其他擴充頁面的移動可能受 Chrome 限制；遇到 API 拒絕會回報錯誤。
- 要在無痕模式使用，需自行於擴充詳細資料允許無痕；程式採 split 模式並保留目標的 incognito 屬性，不跨一般／無痕視窗還原。

## 建議的首次驗收

先用一般測試頁面，不要直接拿尚未儲存的重要表單測試。

1. 開兩個 Chrome 視窗 A、B，讓 A 有兩個分頁，B 保持一般模式。
2. 測試第 1 級，確認同時顯示自繪網址欄與 CW／擴充管理按鈕；還原後測第 2 級，確認仍有網址欄但沒有擴充欄。
3. 測試第 3 級，確認沒有任何自繪工具列。使用 `Alt+Shift+T` 編輯 Symbol 與文字，確認標題會更改；再按 `Alt+Shift+R` 還原並確認原網頁標題恢復。全螢幕另由 `Alt+Shift+F` 測試。
4. 若 A 使用群組／Split View，改以全螢幕測試；若快捷鍵未註冊，先在 shortcuts 頁面設定。

## 權限與資料

權限為 `storage`、`contextMenus`、`activeTab` 與 `scripting`。所選等級與標籤位置存於 `chrome.storage.local`，還原資訊維持 `chrome.storage.session`；沒有常駐 content script、全站 host permissions、`tabs` 敏感資料權限、網路請求、遙測或 Native Messaging。只在 `chrome.storage.session` 存視窗識別碼、原位置／模式、分頁索引與操作訊息；不存頁面內容或瀏覽網址。標題自訂只存在目前頁面的執行記憶體，不上傳、不存入持久儲存。

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
