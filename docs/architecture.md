# Architecture

The browser owns native window chrome. Clean Window requests supported tab/window operations; it does not patch Chrome, inject CSS into browser controls, or install a native host.

| Component | Responsibility | Boundary |
| --- | --- | --- |
| `extension/popup.html`, `popup.css`, `popup.js` | Show actions, resolve the initial target, display actual shortcuts and feedback | Captures explicit tab/window IDs before sending a message |
| `extension/background.js` | Trusted panel and top-frame dock commands, keyboard shortcuts, recovery | Rejects messages from other extensions and unauthorized dock senders |
| `extension/controller.js` | Validate the target, journal and serialize operations, create/restore popup, toggle fullscreen | Only operates on the explicit target and its recorded original window |
| Chrome `windows` / `tabs` APIs | Own actual window creation, tab movement, focus and browser restrictions | Can reject operations; the extension does not override policy |
| `chrome.storage.session` | Preserve recovery metadata across worker restarts in a browser session | No persistent content or sync database |
| `chrome.storage.local` | Save the numeric preset plus edge side and normalized vertical position | No URL data or global Chrome configuration changes |
| Optional `chrome.bookmarks` | Add/remove the authenticated top-frame URL and show recently saved HTTP(S) bookmarks | Requires explicit `bookmarks` grant on an extension-owned page; no sitewide `tabs` permission |
| `extension/site-access.html`, `site-access.js`, `site-access.css` | Explain a cross-origin destination and offer allow / continue without access / cancel | Opens only after an explicit address-bar submission; `permissions.request()` runs from the extension-owned page's user-click handler |
| Optional HTTP(S) host permissions | Keep page UI attached after a cross-origin address-bar navigation when the user grants the target host | Declared only as optional; HTTPS targets request HTTPS for that hostname, HTTP targets request both schemes for that hostname to survive common upgrades; never grant all hosts at install |
| `extension/page-ui.js` | Level-1 collapsed two-row toolbar + manager/bookmark menus; level-2 persistent address-only bar; level-3 collapsed URL-only bar | Requires `activeTab` and `scripting`; no required host permission, no `management` permission, no Chrome security-origin spoofing |
| `extension/edge-ui.js` | On-demand draggable side tab, three stop rail and accessible hover/focus labels | Only top-frame managed popup messages may request a level change; no host permissions or page scraping |
| `extension/title-ui.js` | Per-document original-title capture, local Unicode Symbol + editable title, transient Shadow DOM editor, SPA title tracking and restoration | Only injected on user invocation; modifies `document.title`, never the real browser favicon or security indicator |

## Operation safety

The controller locks both tab and window IDs for an operation. It checks the tab's location before the operation and again after journaling but before a popup move. Grouped and split-view tabs are declined for popup conversion.

The background exposes an authenticated hub API to either the extension Popup or the top frame of a verified level-1 managed Popup. `listManaged` derives its set strictly from session journal records and validates that each recorded tab still belongs to its recorded popup window; it never enumerates all arbitrary browser tabs. `focusManaged` validates the exact target before changing focus, and mutations reuse `run` with its existing target locks. Managed-list cache stores only sanitized display labels (initial tab title or an edited Emoji title), not browsing URLs. The sole URL exception is a short-lived pending destination while the explicit cross-origin site-access prompt is open, described below. The bookmarks permission is optional, and the user must click again within the extension-owned `bookmarks.html` page for Chrome to present its permission request. Other functionality does not require that permission.

The panel stores a numeric **simplification level (1–3)** in `chrome.storage.local`; missing/invalid values default to 1. All three levels create a Popup with the original tab. Level 1 injects an 86px two-row lightweight browser toolbar and Clean Window-owned commands, collapsed by default; level 2 injects a persistent 48px address bar; level 3 injects only the 48px address bar, collapsed behind a top-center handle and revealed on hover/focus. Levels 1 and 3 overlay the page without reserving layout space. Level 3 still opens if injection is denied, but its drawn URL bar is then unavailable. The independent fullscreen shortcut remains. The Popup primary action sits above its slider. All levels attempt to expose an icon-only edge tab on eligible pages; `set-level` changes drawn bars in the same popup without moving the tab. Same-origin navigations are reattached while `activeTab` permits it; a previously granted optional host permission also allows automatic reattachment after cross-origin navigation. If an external link or redirect crosses origins without prior access, the page UI can disappear; the context-menu action `reapply-clean` uses the user's current-page gesture and temporary `activeTab` access to reattach without persistent permission. No access to the installed-extension list or third-party actions is requested. For a detached normal window, restoration moves the original tab directly back into its source window; if that source has closed, the detached normal window is kept as a safe fallback. Chrome's native tab strip and toolbar cannot be independently hidden while keeping the native omnibox.

Popup conversion uses `windows.create` with the existing `tabId`. Restoration first creates a normal window with that tab, then attempts to merge it back into the recorded origin. Failed merging leaves a usable normal window instead of closing the page.

Fullscreen state is recorded before `windows.update`. Restore applies previous bounds only when leaving recorded fullscreen, rather than overwriting a normal window with stale data after a native fullscreen exit.

The title editor is opened via an explicit `edit-title` command or page context-menu invocation. Popup conversion attempts title initialization in all three levels; level 3 keeps its minimal Popup fallback, without the drawn URL bar, when page injection is denied. The title override is document-scoped, is not persisted in storage, follows in-document SPA title mutations, and is reverted after safe restoration.

When a user submits a cross-origin destination through the drawn address bar, the background validates that the sender is the top frame of a managed L1/L2/L3 popup. If the target host is not already granted, it stores a short-lived pending destination in `chrome.storage.session` and opens `site-access.html` in the same normal/incognito context as the managed tab. That extension page requests only the destination hostname after an explicit click; HTTPS targets request HTTPS access, while HTTP targets request both HTTP and HTTPS for that hostname to survive common scheme upgrades. Approval navigates the recorded tab and allows `tabs.onUpdated` to reattach the UI. Continue-without-permission navigates only after a second explicit choice; Cancel, tab/window closure and expiry remove the pending record. The destination URL is never written to `storage.local`, synced or sent over the network.

These behaviors are tested with [a deterministic Chrome API simulator](../tests/fake-chrome.mjs). Native rendering, real-site state retention, screen geometry, and OS interactions still require browser acceptance.

## Runtime and Development packaging

`extension/` is the canonical Runtime source. The Development workspace remains the repository root; `npm run build:runtime` creates an unpacked Runtime folder and a minimal ZIP under ignored `dist/`. Do not maintain or edit a second copy of the extension source. See the [Runtime / Development separation checklist](runtime-development-checklist.md) and [繁體中文檢核表](runtime-development-checklist.zh-TW.md).

[Verification](verification.md) · [Chrome Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
