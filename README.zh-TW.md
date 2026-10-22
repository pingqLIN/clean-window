[![原創翡翠綠視窗角色移除一個目標視窗的工具列雜訊，旁邊兩個視窗維持不變。](docs/assets/readme/clean-window-hero-v1.jpg)](docs/assets/readme/clean-window-hero-v1.jpg)

# Clean Window｜乾淨視窗

> 讓指定的 Chrome 視窗更乾淨，不更動其他視窗。

![原始碼預覽版 0.1.0](https://img.shields.io/badge/source_preview-0.1.0-176851) ![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-52636b) [![CI](https://github.com/pingqLIN/clean-window/actions/workflows/ci.yml/badge.svg)](https://github.com/pingqLIN/clean-window/actions/workflows/ci.yml)

[快速開始](#快速開始) · [三級精簡模式](#三級精簡模式) · [快捷鍵](#快捷鍵) · [使用限制](#使用限制) · [開發](#開發) · [English](README.md)

以單一三級滑桿選擇「輕量瀏覽器工具列」、「自繪網址欄」或「純精簡 Popup」；全螢幕為獨立操作。不變更其他視窗的介面設定。操作綁定指定視窗與分頁，不修改 Chrome 全域外觀設定。

**主打示範｜YouTube 專注觀看：**第 2 級保留標題、留言與推薦內容，依可視高度調整播放器；第 3 級讓播放器填滿內容區並隱藏其他網站內容，影片維持原比例、不裁切。可透過側邊控制器預覽切換，再一鍵還原。

**狀態：原始碼預覽版。** 92 項模擬 Chrome API 與 Popup 互動的自動化測試通過；Chrome Dev Headless DOM 測試涵蓋同來源導覽、跨來源單站授權選擇、拒絕／取消回復、YouTube 版面及 Popup 互動。完整 MV3 實機安裝、原生 Popup 外觀、快捷鍵及 Windows 瀏覽器操作仍**尚未驗收**。擴充介面目前使用繁體中文，文件提供英文與繁體中文。頁首圖片是概念插畫，不是實機截圖。

## 快速開始

載入擴充不需要 Node.js、Python、伺服器或系統管理員權限。

> **測試前：**先儲存重要頁面資料，並記住 **`Alt + Shift + R`**。精簡視窗沒有工具列；按視窗的 **X 是關閉分頁，不是還原**。受管理的 Chrome 可能禁止未封裝擴充，本專案不繞過管理政策。

1. 下載 [v0.1.0 原始碼預覽版 ZIP](https://github.com/pingqLIN/clean-window/releases/download/v0.1.0/clean-window-v0.1.0.zip)，解壓縮到固定資料夾；也可以在本專案選 **Code → Download ZIP**。
2. 開啟 `chrome://extensions/`，啟用「開發人員模式」。
3. 按「載入未封裝項目」，選擇含有 `manifest.json` 的 **`extension/` 子資料夾**，不要選 ZIP 或專案根目錄。
4. 釘選「Clean Window｜乾淨視窗」，從目標視窗開啟面板並選擇模式。同時保留另一個測試視窗，確認其外觀與分頁不變。

請保留解壓縮後的擴充資料夾，不要搬移或刪除。完整說明：[操作與還原](docs/usage.zh-TW.md) · [English usage guide](docs/usage.md)。

## 三級精簡模式

本專案使用單一三級滑桿，預設第 1 級，三種模式都保留原生視窗標題列與縮放功能。

| 等級 | 工具列 | 行為 |
| --- | --- | --- |
| 1 | **輕量瀏覽器雙列工具列** | 86px 自繪網址欄＋擴充快捷工具列；預設收闔，滑鼠移至頂部中央或鍵盤聚焦即可展開；展開時暫時覆蓋頁面頂端，不會永久保留空白頁面間距 |
| 2 | 自繪網址欄 | 持續顯示 48px 網址欄，提供上一頁／下一頁／重新整理與明暗主題切換，不顯示擴充欄 |
| 3 | 全無 | 純精簡 Popup，不注入網站工具列 |

自繪網址欄不是 Chrome 原生網址列，不能替代網站身分與安全指示。第 1 級是擴充自行繪製的常用瀏覽器快捷工具列，不是 Chrome 原生工具列；無法執行其他擴充的圖示按鈕，也不會要求 `management` 權限。書籤讀寫只有在使用者於獨立授權頁按下允許後才會啟用。前兩級只對允許注入的 HTTP(S) 網頁有效。透過自繪網址欄前往另一來源時，會先開啟單站授權選擇；允許後 Clean Window 可在該網域繼續注入，不授權仍可直接前往，但工具列可能消失。若是網站連結或重新導向造成跨來源，未曾授權時可在頁面按右鍵選「Clean Window · 重新啟用目前網站的精簡介面」，以 `activeTab` 暫時啟用，不必授權所有網站。第三級不要求成功注入，仍可開啟純精簡 Popup；可注入的頁面會保留邊緣等級控制。

**管理清單：**一般 Chrome 視窗中的擴充 Popup 下方可展開「已啟用乾淨視窗」，逐筆聚焦、選擇 L1/L2/L3 或還原。第一級工具列的「☷」亦可直接開啟相同清單。紀錄以本次瀏覽器工作階段的 Clean Window 視窗為準，關閉或還原後不再列出；標題編輯後同步快取清單名稱。

**工具列主題：**第 1、2 級的自繪網址欄右側提供 `☾`／`☀` 按鈕，即時切換明亮／黑暗外觀。選擇儲存於 `chrome.storage.local`，後續開啟時沿用；初次使用依系統偏好。只改變 Clean Window 自繪介面，不會修改 Chrome 原生主題或網頁配色。網址欄已移除 Clean Window 品牌文字。

**頁內三級切換：** Popup 的「套用此簡化等級」移到上方。啟動後，一般網頁側邊出現中性灰且沒有圖案或文字的標籤，滑鼠停留或鍵盤聚焦會顯示操作提示並展開上中下三級檔位。標籤可拖移到左右側並調整高度，位置儲存在本機；切換等級不重新搬移分頁。跨網站導覽或受限制頁面可能無法保留控制器，請以 `Alt + Shift + R` 還原。

原主 DOM 遮蔽實驗和第 4–6 級均已從選單移除；獨立全螢幕快捷鍵保留。

**標題快速編輯與 Emoji：** 直接單擊側邊灰色標籤可開啟編輯器；拖曳仍可調整標籤位置。Icon 可輸入單一 Emoji（包含國旗、膚色、組合 Emoji 與 `1️⃣2️⃣3️⃣` keycap），也可點選常用圖示，包括 `🖋️🌍🚩🔥🔍💡🛠️🔏`。Chrome 原生視窗標題列無法提供擴充點擊事件，因此不攔截原生標題列。

**乾淨模式標題**：進入精簡 Popup 後，預設顯示「◈ ＋原始網頁標題」。可用 `Alt + Shift + T` 或頁面右鍵選單開啟輕量編輯面板，從內建 Unicode Symbol 字元選擇圖示並修改文字，或一鍵恢復原始網頁標題；切回普通視窗時也會還原。僅作用於可注入的 HTTP(S) 頁面，第 3 級雖無自繪工具列，仍會在可行時按需注入標題處理腳本。標題字元不是網站 favicon 或 Chrome 安全標誌，且原生 Windows 標題列外觀尚未經 GUI 驗收。

**YouTube 播放頁：**第 1 級保持網站版面；第 2 級依影片比例安排播放器高度，以網址欄下方的可視高度為上限，保留標題、留言、推薦內容與原有配色，可往下捲動；第 3 級讓播放器占滿內容區，隱藏其餘網站內容，以黑色背景呈現並停止頁面捲動。影片維持原比例、完整顯示；視窗比例不同時會留黑邊。切回第 1 級或還原即移除專用樣式。詳見[使用說明](docs/usage.zh-TW.md#youtube-播放頁)。

**側邊模式預覽：**移入模式檔位約 150ms 可預覽，播放器以約 200ms 平順變化；點擊才儲存，移出整個模式列或按 Esc 還原。遵循「減少動態效果」設定。詳見[預覽說明](docs/usage.zh-TW.md#側邊模式列預覽)。

## 快捷鍵

| 操作 | 預設快捷鍵 |
| --- | --- |
| 目前分頁切換精簡／普通視窗 | `Alt + Shift + W` |
| 切換目標視窗全螢幕 | `Alt + Shift + F` |
| 還原目前視窗 | **`Alt + Shift + R`** |
| 編輯乾淨模式標題 | `Alt + Shift + T` |

網頁右鍵選單也提供相同操作。快捷鍵衝突時，到 `chrome://extensions/shortcuts` 重新設定；面板會顯示 Chrome 實際註冊的組合。有些頁面會禁止一般右鍵選單。

## 使用限制

| 邊界 | 實際行為 |
| --- | --- |
| 單分頁與整個視窗 | 第 1–3 級都只移動目前分頁；全螢幕可另用快捷鍵，不受滑桿控制。 |
| 群組與 Split View | 為避免破壞結構，精簡模式不移出群組或分割檢視分頁，請改用全螢幕。 |
| 最後一個分頁與還原 | 搬走最後一個分頁可能讓空的來源視窗關閉。重啟瀏覽器或重載擴充可能清除工作階段中的還原對應。 |
| 頁面狀態 | 程式搬移原本分頁，不主動導覽或重新載入。真實網站表單、媒體播放及 resize 行為仍未驗收。 |
| 瀏覽器介面 | 不是完全無框的原生視窗工具，不移除或偽裝系統外框及瀏覽器來源、安全、權限提示。 |
| 相容性 | Manifest 宣告 Chrome **102+**、Manifest V3。這是 API 版本下限，不是經實測的版本清單；其他瀏覽器與作業系統尚未驗收。 |

公開 Windows API 可建立 popup、修改視窗狀態，但不提供把既有視窗原地切換為另一種 type 的介面。參考 [Chrome 官方 Windows API 文件](https://developer.chrome.com/docs/extensions/reference/api/windows)。

## 隱私與權限

| 權限 | 用途 |
| --- | --- |
| `storage` | 暫存還原資訊並在本機保存簡化等級（1–3）及邊緣工具位置 |
| `activeTab`／`scripting` | 使用者主動操作時，按需注入自繪網址欄、Clean Window 專屬操作欄或標題編輯器，不要求全網站權限 |
| `contextMenus` | 新增網頁及擴充圖示的切換／還原選單 |
| 選用 `bookmarks` | 第 1 級自願授權後才能顯示、加入或移除 Chrome 書籤；沒有自動授權 |
| 選用 HTTP(S) 網站權限 | 只有使用者從自繪網址欄主動跨來源導覽時，才詢問該目標網域；不會自動授予所有網站 |

沒有必要的全站 host permission、常駐 content script、原生主機、分析追蹤或對外網路請求。`http://*/*` 與 `https://*/*` 只宣告為選用網站權限，不會在安裝時授予；只有使用者透過自繪網址欄主動前往其他來源時，才會提供該網域的授權選擇。擴充未要求可讀取敏感分頁資料的 `tabs` 權限；YouTube 專用版面只在已啟用的分頁內檢查網域、路徑與播放器元素，不擷取影片、留言或推薦內容。README 的遠端徽章不屬於擴充執行時的網路行為。詳見 [PRIVACY.md](PRIVACY.md) 與 [manifest](extension/manifest.json)。

## 開發

`package.json` 宣告 Node.js **20+**。沒有 npm 相依套件，也不需要安裝相依套件。`extension/` 是 Runtime 唯一原始碼；不要手動修改自動產生的產物。

```sh
# From the repository root
npm test
npm run check
npm run smoke:dom
npm run build:runtime
```

`npm test` 執行 92 項可重現的 Chrome API 模擬與 Popup 互動測試。`npm run build:runtime` 會產生可載入的 `dist/runtime/`，以及檔案直接位於 ZIP 根目錄的 `dist/clean-window-v<version>.zip`。`dist/` 由 Git 忽略。自動化結果**不能取代實際瀏覽器驗收**。詳見[Runtime／Development 分離檢核表](docs/runtime-development-checklist.zh-TW.md)。

| 文件 | 用途 |
| --- | --- |
| [驗證紀錄](docs/verification.md) | 已通過項目、瀏覽器測試阻塞與剩餘驗收 |
| [架構](docs/architecture.md) | 面板、背景工作者、控制器與瀏覽器的責任邊界 |
| [Runtime／Development 檢核表](docs/runtime-development-checklist.zh-TW.md) | 產物打包、檔案分層與發布驗收 |
| [貢獻說明](CONTRIBUTING.md) | 本機檢查、修改範圍及安全回報方式 |
| [版本紀錄](CHANGELOG.md) | 版本變更 |
| [Issues](https://github.com/pingqLIN/clean-window/issues) | 可重現的錯誤及功能需求；請勿張貼敏感瀏覽資料 |

GitHub Actions 設定為在 Linux 與 Windows 執行相同測試與靜態檢查。**託管 CI 尚未執行：**首次嘗試在 runner 啟動前受阻，徽章反映 workflow 狀態，不是本機測試結果。選用的 [Chromium GUI 測試](tests/browser-smoke.py) 以 Linux 為目標，使用隔離的暫存 Profile 且需要額外工具；執行前請先讀驗證紀錄。它不是安裝擴充的必要步驟。

## AI 輔助開發

程式、測試、文件與視覺素材使用 AI 協助製作。本次公開發布與文件整理使用 **GPT-6 Astra Pro**；Hero 使用原創 AI 生成插畫，不是第三方吉祥物或產品實機截圖。

> 自動化測試及原始碼檢視不等於獨立安全稽核，也不保證程式正確。瀏覽器驗收仍待完成，請先以不含敏感資料的頁面測試。

## 授權

原始套件未提供授權，本次公開發布未另選開源授權；目前**沒有 `LICENSE` 檔案**。公開可見不應解讀為已授予開源授權。
