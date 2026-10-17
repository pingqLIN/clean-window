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
| `extension/page-ui.js` | Level-1 two-row lightweight browser toolbar + manager/bookmark menus; level-2 address-only toolbar | Requires `activeTab` and `scripting`; no always-on host or `management` permission, no Chrome security-origin spoofing |
| `extension/edge-ui.js` | On-demand draggable side tab, three stop rail and accessible hover/focus labels | Only top-frame managed popup messages may request a level change; no host permissions or page scraping |
| `extension/title-ui.js` | Per-document original-title capture, local Unicode Symbol + editable title, transient Shadow DOM editor, SPA title tracking and restoration | Only injected on user invocation; modifies `document.title`, never the real browser favicon or security indicator |

## Operation safety

The controller locks both tab and window IDs for an operation. It checks the tab's location before the operation and again after journaling but before a popup move. Grouped and split-view tabs are declined for popup conversion.

The background exposes an authenticated hub API to either the extension Popup or the top frame of a verified level-1 managed Popup. `listManaged` derives its set strictly from session journal records and validates that each recorded tab still belongs to its recorded popup window; it never enumerates all arbitrary browser tabs. `focusManaged` validates the exact target before changing focus, and mutations reuse `run` with its existing target locks. Only sanitized display labels (initial tab title or an edited Emoji title) are stored in session storage, not URLs. The bookmarks permission is optional, and the user must click again within the extension-owned `bookmarks.html` page for Chrome to present its permission request. Other functionality does not require that permission.

The panel stores a numeric **simplification level (1–3)** in `chrome.storage.local`; missing/invalid values default to 1. All three levels create a Popup with the original tab. Level 1 injects an 86px two-row lightweight browser toolbar and Clean Window-owned commands; level 2 injects only the 48px address bar; level 3 has no persistent drawn toolbar (but can inject the title-only script on eligible pages). The independent fullscreen shortcut remains. The Popup primary action sits above its slider. All levels attempt to expose an icon-only edge tab on eligible pages; `set-level` changes drawn bars in the same popup without moving the tab. `tabs.onUpdated` attempts same-origin reinjection, subject to `activeTab` restrictions. No access to the installed-extension list or third-party actions is requested. For a detached normal window, restoration moves the original tab directly back into its source window; if that source has closed, the detached normal window is kept as a safe fallback. Chrome's native tab strip and toolbar cannot be independently hidden while keeping the native omnibox.

Popup conversion uses `windows.create` with the existing `tabId`. Restoration first creates a normal window with that tab, then attempts to merge it back into the recorded origin. Failed merging leaves a usable normal window instead of closing the page.

Fullscreen state is recorded before `windows.update`. Restore applies previous bounds only when leaving recorded fullscreen, rather than overwriting a normal window with stale data after a native fullscreen exit.

The title editor is opened via an explicit `edit-title` command or page context-menu invocation. Popup conversion attempts title initialization in all three levels; level 3 keeps its pure Popup fallback when title injection is denied. The title override is document-scoped, is not persisted in storage, follows in-document SPA title mutations, and is reverted after safe restoration.

These behaviors are tested with [a deterministic Chrome API simulator](../tests/fake-chrome.mjs). Native rendering, real-site state retention, screen geometry, and OS interactions still require browser acceptance.

[Verification](verification.md) · [Chrome Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
