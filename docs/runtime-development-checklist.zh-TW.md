# Runtime 使用版／Development 開發版分離檢核表

## 決策

採用**單一原始碼、兩種用途的產物**，不維護兩份獨立擴充程式碼。複製出兩套程式會增加同步成本，也容易讓權限、還原流程與安全修正產生版本差異。

- **Runtime 原始碼唯一來源：** `extension/`
- **產生的 Runtime 資料夾：** `dist/runtime/`
- **產生的安裝 ZIP：** `dist/clean-window-v<manifest-version>.zip`
- **Development 開發工作區：** 專案根目錄，包含測試、腳本、文件、CI 與 Git 歷史。

`dist/runtime/` 是產物，不是第二份原始碼。修改功能一律改 `extension/`，再重新建置；不要手動修改產物。

## Runtime 與 Development 比較

| 檢核項目 | Runtime 使用版 | Development 開發版 |
| --- | --- | --- |
| 目的 | 載入 Chrome 擴充、交給測試者使用 | 開發、測試、文件維護、審查與發布準備 |
| 入口 | 資料夾／ZIP 根目錄直接放置 `manifest.json` | `package.json`、原始碼及開發指令 |
| 必要檔案 | 從 `extension/` 複製的 manifest、背景工作者、Popup、頁面 UI、書籤 UI、圖示 | Runtime 原始碼，加上測試、腳本、文件、CI 與版本控制資料 |
| 使用者功能 | 包含所有終端使用者功能，不帶開發專用控制項 | 使用同一份 Runtime 程式碼，另有測試、打包與 CI 工具 |
| 執行依賴 | 載入擴充不需要 Node.js 或 npm install | Node.js 20+ 用於測試、靜態檢查與打包；目前沒有 npm 相依套件 |
| 載入方式 | `chrome://extensions/` → 開發人員模式 → 載入未封裝項目 → 選 `dist/runtime/` | 不要載入專案根目錄；開發時可選 `extension/`，驗收打包則選 `dist/runtime/` |
| 測試 | 不包含 | `tests/`、`scripts/` |
| 文件與 CI | ZIP 不包含 | `README*`、`docs/`、`CONTRIBUTING.md`、`CHANGELOG.md`、`PRIVACY.md`、`.github/` |
| Git 與本機紀錄 | 不包含 | `.git/`、被忽略的本機輸出與開發紀錄留在 Runtime 之外 |
| 版本來源 | 以 `extension/manifest.json` 為執行版本，並與 `package.json` 比對 | 兩處版本必須一致；打包器遇到不一致即停止 |
| 發布狀態 | 完成實機驗收與發布決策前，只視為本機／原始碼預覽產物 | 開發中的工作區；公開可見不代表已授予程式碼授權 |

## 功能一致性檢核

Runtime **不是另一個縮減功能的產品版本**。打包後必須與 `extension/` 使用相同的執行程式碼；只能排除開發檔案，不可改變執行行為。

- [ ] 第 1 級輕量工具列、乾淨視窗清單及選用書籤入口正常存在。
- [ ] 第 1 級常駐雙列工具列、第 2 級預設收闔的網址欄、第 3 級無頂部工具列的純精簡模式皆可用。
- [ ] 還原、全螢幕、標題編輯與文件記載的快捷鍵仍有連接。
- [ ] 邊緣標籤拖曳、模式預覽／套用、減少動態效果與還原清理流程仍存在。
- [ ] Symbol／Emoji 標題編輯、原始標題還原及 SPA 標題追蹤仍存在。
- [ ] YouTube 第 1 級常駐工具列位移、第 2 級網址欄收闔／展開版面、第 3 級專注觀看及還原／導覽清理仍存在。
- [ ] 書籤權限仍由使用者明確授權；拒絕授權不影響其他功能。
- [ ] 打包流程沒有改變 manifest 權限與 Content Security Policy。

## 專案資料夾結構

```text
clean-window/
├── extension/                 # Runtime 唯一原始碼
├── scripts/
│   ├── check.mjs              # 靜態與 manifest 檢查
│   └── package-runtime.mjs    # 可跨平台產生資料夾與 ZIP
├── tests/                     # 僅開發使用
├── docs/                      # 開發、使用與驗收文件
├── .github/workflows/ci.yml   # Windows + Ubuntu 檢查及打包
├── package.json               # 開發指令與版本
└── dist/                      # 自動產生，Git 忽略
    ├── runtime/               # 可載入的資料夾；manifest.json 位於根目錄
    └── clean-window-v0.1.0.zip # 檔案位於 ZIP 根目錄，含 manifest.json
```

ZIP 檔名會依 manifest 版本自動變更；上例使用目前的 0.1.0。

## 建置與驗證指令

在專案根目錄執行：

```sh
npm test
npm run check
npm run smoke:dom
npm run build:runtime
```

`npm run build:runtime` 需要 Node.js 20+，不需要 `npm install`。指令會產生 `dist/runtime/` 與 `dist/clean-window-v<version>.zip`，並驗證：

- `package.json` 與 manifest 版本一致。
- 背景工作者、Popup、圖示等 manifest 參照檔案確實存在。
- Runtime 原始碼沒有符號連結或開發專用目錄。
- 產生的 Runtime 資料夾與 `extension/` 逐檔位元組一致。
- ZIP 根目錄直接包含 `manifest.json`，只包含 Runtime 檔案，且通過解壓與 CRC 完整性檢查。

ZIP 打包器使用 Node.js 內建模組，固定檔案排序與 ZIP 時間戳記，避免新增 npm 相依套件；可在 Windows 與 Linux 建置。`dist/` 與 ZIP 產物均由 Git 忽略。

## Runtime 產物驗收

- [ ] `npm run build:runtime` 在目標電腦成功。
- [ ] `dist/runtime/manifest.json` 位於 Runtime 資料夾根目錄。
- [ ] ZIP 可正常開啟，且 `manifest.json` 位於 ZIP 根目錄，而不是多包一層 `extension/`。
- [ ] ZIP 只包含 `extension/` 的執行檔案，不含 tests、docs、Git、package metadata 或本機證據。
- [ ] `package.json` 與 `extension/manifest.json` 版本一致。
- [ ] 透過 `chrome://extensions/` → 開發人員模式 → 載入未封裝項目，載入 `dist/runtime/`。
- [ ] 檢查擴充圖示、Popup、L1／L2／L3 切換及 `Alt + Shift + R` 還原路徑。
- [ ] 同時保留另一個一般 Chrome 視窗，確認它沒有被修改。
- [ ] 未完成實機驗收前，不宣稱已是 Chrome Web Store 正式版。

## Development 工作區驗收

- [ ] `npm test` 通過。
- [ ] `npm run check` 通過。
- [ ] `npm run smoke:dom` 通過，並準確記錄測試涵蓋範圍。
- [ ] CI 在 Windows 與 Ubuntu 均可產生 Runtime 產物。
- [ ] `dist/` 產物不進入 Git。
- [ ] 指令、限制或版本變動時，同步更新英文與繁體中文文件。

## 已知發布限制

- 自動化與 Headless DOM 測試不能取代 Windows Chrome 已安裝擴充的實機驗收。原生 Popup／標題列、實體快捷鍵、真實網站狀態保留與多螢幕／DPI 切換仍是獨立驗收項目。
- 專案目前沒有 `LICENSE`。不可將公開可見誤稱為開源，亦不可推定程式碼已授權重用。
- Runtime 打包成功只證明產物結構與檔案完整性，不代表瀏覽器行為已全面驗收、已完成安全稽核或已可上架。
