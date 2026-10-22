# Clean Window｜公開名稱、吉祥物與 Popup vNext 設計方向

> 狀態：**設計提案 / 尚未核准品牌變更 / 尚未產生新圖像**。日期：2026-10-18。
> 本文件不修改現行 Manifest 名稱、GitHub repo、README 主視覺或已發布圖示。

## 產品事實與邊界

- 實際能力：將現有分頁移到保留原生標題列的可調整大小 Popup；L1 收闔式自繪網址欄＋輕量功能列、L2 持續顯示自繪網址欄、L3 收闔式自繪網址欄；可以還原、管理工作階段內受管理視窗。
- 技術現況：Chrome Manifest V3、依使用者動作按需注入，書籤獨立授權；非 Chrome 原生網址列，不能表示可信任網址來源或安全狀態。
- 品牌原則：少即是多、工作不中斷、可快速回到原樣。介面是「工具」，吉祥物只在品牌與教育性場合出現，不侵入使用者的內容區。
- 當前專案標題與發行識別仍為 **Clean Window｜乾淨視窗**。

## 公開命名候選（不是商標查核結果）

| 優先 | 英文候選 | 中文建議 | 優點 | 注意事項 |
| --- | --- | --- | --- | --- |
| 1 | **NookPane** | **隅窗** | Nook（安靜一角）＋ Pane（視窗），易與窗框吉祥物及工作空間敘事連結 | 初步字面搜尋未顯示明顯同名主流軟體，**非**權利清查或商店可用性保證 |
| 2 | **BarePane** | **素窗** | 直指減去工具列、回歸頁面；語意簡潔清楚 | Bare 容易被理解為功能全無，需要副標說明三級模式 |
| 3 | **Clean Window** | **乾淨視窗** | 現有辨識度、連結與 repo 不必轉移 | 名稱描述性較強，已有近似商品名稱「Clean Window Toggle」 |

- 避開已搜尋到公開產品名稱：HushPane、QuietFrame、StillPane、TuckPane、Panelet、PocketPane；不可視為完整商標檢索。
- 品牌候選確定前，僅做 GitHub／Chrome Web Store／網域／商標庫的正式第二輪可用性查核；不要改動既有公開發行識別。
- 初步來源：<https://hushpane.com/>、<https://quietframeapp.com/>、<https://github.com/ch998244353/TuckPane>、<https://panelet.app/releases/>、<https://pocketpane.app/>、<https://chromewebstore.google.com/detail/clean-window-toggle/pgncbobheoimhlfdhgajilneaejhfnjk>。

## 吉祥物方向（README mascot-banner 工作流程）

### 建議方案 A：Nookling／小隅（原創窗框精靈）

- 原型：一個柔和圓角的單片中空窗框精靈；一角微微掀起，像替畫面留出呼吸空間。
- 輪廓：中空圓角方框＋單角折線；在 16–32 px 維持清楚辨識。眼睛只在 128 px 或 README HERO 版本出現。
- 個性：安靜、可靠、不打斷；不用誇張表情或大幅度跳動。
- 色彩：中性石墨灰、冷白、保留少量現有深綠作識別點綴；深色版以同一輪廓反轉，不依賴高飽和陰影。
- 動作語彙：窗框輕合／輕展，對應 L1 → L3 去除冗餘、還原頁面。
- README HERO：主角靠畫面一側，另一側留白供標題文字以 HTML/Markdown 疊加；圖片內不放小字，也不模仿 Chrome 安全圖示。
- 原創設計、不借用既有角色或第三方商標；正式圖像/ICON/README 替換須經概念核准。

### 備選方案 B：小窗寄居蟹

把單一網頁裝在輕巧「窗殼」裡，對應分頁搬移／還原的故事；辨識度較強但 16 px 圖示容易過於複雜，適合 HERO 不宜作唯一產品主圖。

### 備選方案 C：一片輕翼

由一片薄薄的窗角折頁演化成原創微型角色；適合精簡 App Icon，但人格辨識度偏弱，可能更適合當圖形語言而非吉祥物。

**暫定建議**：名稱 NookPane（隅窗）＋方案 A Nookling；**待品牌決策後才可當作正式識別**。

## 下一階段 Popup 資訊架構（不在本輪直接重建）

1. **Identity / Status**：精簡名稱及小型符號；現行分頁狀態與作用範圍一眼可見；避免長英文眉標與冗餘版本裝飾。
2. **Primary Action**：單一明確主動作「開啟乾淨視窗」／「還原此視窗」，對應目前目標，而不是一般性套用指令。
3. **Level Picker**：保留三級單一控制概念，但呈現三個易辨識層級及小型視覺示意，預設第 1 級；避免大片說明文字佔滿 366px。
4. **Managed Windows**：收摺式清單，顯示已管理的乾淨視窗與快速跳轉/等級切換；空狀態清楚但不佔空間。
5. **Recovery / Secondary**：快捷鍵、回復及安全限制在恰當位置，Chrome 原生安全資訊不可由自繪介面假冒。

設計基準：優先精準資訊階層、少量微動態與鍵盤可操作性；降低初次使用的閱讀負擔，不能犧牲復原操作。以 320–380 px 彈出視窗寬度做窄版驗收，深/淺主題及 125–200% 縮放均須測試。

## Skill 工作流程與驗收閘門

- 本機 `readme-quality`：`mascot-banner` 模式，參考 `references/mascot-banner-workflow.md`。
- 預定四個工件：`mascot-request.json`、`mascot-concept.json`、`mascot-approval.json`、`mascot-render.json`；先收斂概念，使用者核准後才生成。
- 產出 README Banner 與實際擴充 Icon 時應分開驗證：大圖構圖、16/32/48/128 px 可辨識性、淺/深色底測試、Chrome Store 內容政策、素材權利與 README 圖片連結。
- UI 完成條件：常用按鈕不變更作用目標、三級操作與還原都可用、淺/深色及動態偏好生效、焦點與螢幕閱讀器標記合理；隔離式 DOM 測試與實際 Chrome 擴充 GUI 驗收分開報告。

## 決策事項

**選定公開名稱與吉祥物概念**。在未核准前不進行識別修改、GitHub repo 更名、Chrome Store 改名或舊主視覺覆蓋。
