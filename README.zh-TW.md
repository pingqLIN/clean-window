[![原創翡翠綠視窗角色移除一個目標視窗的工具列雜訊，旁邊兩個視窗維持不變。](docs/assets/readme/clean-window-hero-v1.jpg)](docs/assets/readme/clean-window-hero-v1.jpg)

# Clean Window｜乾淨視窗

> 讓指定的 Chrome 視窗更乾淨，不更動其他視窗。

![原始碼預覽版 0.1.0](https://img.shields.io/badge/source_preview-0.1.0-176851) ![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-52636b) [![CI](https://github.com/pingqLIN/clean-window/actions/workflows/ci.yml/badge.svg)](https://github.com/pingqLIN/clean-window/actions/workflows/ci.yml)

[快速開始](#快速開始) · [操作模式](#操作模式) · [快捷鍵](#快捷鍵) · [使用限制](#使用限制) · [開發](#開發) · [English](README.md)

把目前分頁移到可縮放的精簡 popup，或讓整個目標視窗進入全螢幕。操作綁定指定視窗與分頁，不修改 Chrome 全域外觀設定。

**狀態：原始碼預覽版。** 30 項模擬 Chrome API 的自動化測試通過；真實 Chrome 視窗外觀、快捷鍵及 Windows 瀏覽器操作仍**尚未驗收**。擴充介面目前使用繁體中文，文件提供英文與繁體中文。頁首圖片是概念插畫，不是實機截圖。

## 快速開始

載入擴充不需要 Node.js、Python、伺服器或系統管理員權限。

> **測試前：**先儲存重要頁面資料，並記住 **`Alt + Shift + R`**。精簡視窗沒有工具列；按視窗的 **X 是關閉分頁，不是還原**。受管理的 Chrome 可能禁止未封裝擴充，本專案不繞過管理政策。

1. 下載 [v0.1.0 原始碼預覽版 ZIP](https://github.com/pingqLIN/clean-window/releases/download/v0.1.0/clean-window-v0.1.0.zip)，解壓縮到固定資料夾；也可以在本專案選 **Code → Download ZIP**。
2. 開啟 `chrome://extensions/`，啟用「開發人員模式」。
3. 按「載入未封裝項目」，選擇含有 `manifest.json` 的 **`extension/` 子資料夾**，不要選 ZIP 或專案根目錄。
4. 釘選「Clean Window｜乾淨視窗」，從目標視窗開啟面板並選擇模式。同時保留另一個測試視窗，確認其外觀與分頁不變。

請保留解壓縮後的擴充資料夾，不要搬移或刪除。完整說明：[操作與還原](docs/usage.zh-TW.md) · [English usage guide](docs/usage.md)。

## 操作模式

| 模式 | 改變什麼 | 保留什麼 |
| --- | --- | --- |
| **精簡 popup** | 將目前分頁移到新的可縮放 popup，不顯示一般網址列、分頁列與書籤列 | 使用原本的分頁識別碼；保留系統標題列及 Chrome 安全提示。其他分頁留在來源視窗。 |
| **整個視窗全螢幕** | 只切換目標視窗的全螢幕狀態 | 保留該視窗的分頁、群組及識別碼，不縮放或改變其他視窗外觀。 |
| **還原** | 退出全螢幕，或將 popup 分頁放回仍存在的原視窗 | 原視窗已關閉時建立新的普通視窗，不擅自使用其他無關視窗。 |

切換時鍵盤焦點可能改變。「其他視窗不變」指視窗位置與大小、模式、外觀設定及分頁內容，不保證焦點完全不移動。實作與測試見 [controller](extension/controller.js) 及[測試程式](tests/controller.test.mjs)。

## 快捷鍵

| 操作 | 預設快捷鍵 |
| --- | --- |
| 目前分頁切換精簡／普通視窗 | `Alt + Shift + W` |
| 切換目標視窗全螢幕 | `Alt + Shift + F` |
| 還原目前視窗 | **`Alt + Shift + R`** |

網頁右鍵選單也提供相同操作。快捷鍵衝突時，到 `chrome://extensions/shortcuts` 重新設定；面板會顯示 Chrome 實際註冊的組合。有些頁面會禁止一般右鍵選單。

## 使用限制

| 邊界 | 實際行為 |
| --- | --- |
| 單分頁與整個視窗 | 精簡模式只移動目前分頁。要保留原視窗全部分頁，使用全螢幕模式。 |
| 群組與 Split View | 為避免破壞結構，精簡模式不移出群組或分割檢視分頁，請改用全螢幕。 |
| 最後一個分頁與還原 | 搬走最後一個分頁可能讓空的來源視窗關閉。重啟瀏覽器或重載擴充可能清除工作階段中的還原對應。 |
| 頁面狀態 | 程式搬移原本分頁，不主動導覽或重新載入。真實網站表單、媒體播放及 resize 行為仍未驗收。 |
| 瀏覽器介面 | 不是完全無框的原生視窗工具，不移除或偽裝系統外框及瀏覽器來源、安全、權限提示。 |
| 相容性 | Manifest 宣告 Chrome **102+**、Manifest V3。這是 API 版本下限，不是經實測的版本清單；其他瀏覽器與作業系統尚未驗收。 |

公開 Windows API 可建立 popup、修改視窗狀態，但不提供把既有視窗原地切換為另一種 type 的介面。參考 [Chrome 官方 Windows API 文件](https://developer.chrome.com/docs/extensions/reference/api/windows)。

## 隱私與權限

| 權限 | 用途 |
| --- | --- |
| `storage` | 暫存工作階段中的還原紀錄與操作訊息 |
| `contextMenus` | 新增網頁及擴充圖示的切換／還原選單 |

沒有網站存取權限、content script、原生主機、分析追蹤或對外網路請求。擴充未要求可讀取敏感分頁資料的 `tabs` 權限；只用分頁 ID 與視窗資訊，不讀取網頁內容。README 的遠端徽章不屬於擴充執行時的網路行為。詳見 [PRIVACY.md](PRIVACY.md) 與 [manifest](extension/manifest.json)。

## 開發

`package.json` 宣告 Node.js **20+**。沒有 npm 相依套件，不需要安裝或建置步驟。

```sh
# From the repository root
npm test
npm run check
```

`npm test` 透過可重現的 Chrome API 模擬器執行 30 項測試；`npm run check` 檢查 JavaScript 語法、MV3 結構、版本一致性、權限、圖示及 inline handler 限制。這些結果**不能取代實際瀏覽器驗收**。

| 文件 | 用途 |
| --- | --- |
| [驗證紀錄](docs/verification.md) | 已通過項目、瀏覽器測試阻塞與剩餘驗收 |
| [架構](docs/architecture.md) | 面板、背景工作者、控制器與瀏覽器的責任邊界 |
| [貢獻說明](CONTRIBUTING.md) | 本機檢查、修改範圍及安全回報方式 |
| [版本紀錄](CHANGELOG.md) | 版本變更 |
| [Issues](https://github.com/pingqLIN/clean-window/issues) | 可重現的錯誤及功能需求；請勿張貼敏感瀏覽資料 |

GitHub Actions 在 Linux 與 Windows 執行相同測試與靜態檢查，徽章反映實際 workflow 結果。選用的 [Chromium GUI 測試](tests/browser-smoke.py) 以 Linux 為目標，使用隔離的暫存 Profile 且需要額外工具；執行前請先讀驗證紀錄。它不是安裝擴充的必要步驟。

## AI 輔助開發

程式、測試、文件與視覺素材使用 AI 協助製作。本次公開發布與文件整理使用 **GPT-6 Astra Pro**；Hero 使用原創 AI 生成插畫，不是第三方吉祥物或產品實機截圖。

> 自動化測試及原始碼檢視不等於獨立安全稽核，也不保證程式正確。瀏覽器驗收仍待完成，請先以不含敏感資料的頁面測試。

## 授權

原始套件未提供授權，本次公開發布未另選開源授權；目前**沒有 `LICENSE` 檔案**。公開可見不應解讀為已授予開源授權。
