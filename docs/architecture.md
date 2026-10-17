# Architecture

The browser owns native window chrome. Clean Window requests supported tab/window operations; it does not patch Chrome, inject CSS into browser controls, or install a native host.

| Component | Responsibility | Boundary |
| --- | --- | --- |
| `extension/popup.html`, `popup.css`, `popup.js` | Show actions, resolve the initial target, display actual shortcuts and feedback | Captures explicit tab/window IDs before sending a message |
| `extension/background.js` | Trusted panel and top-frame dock commands, keyboard shortcuts, recovery | Rejects messages from other extensions and unauthorized dock senders |
| `extension/controller.js` | Validate the target, journal and serialize operations, create/restore popup, toggle fullscreen | Only operates on the explicit target and its recorded original window |
| Chrome `windows` / `tabs` APIs | Own actual window creation, tab movement, focus and browser restrictions | Can reject operations; the extension does not override policy |
| `chrome.storage.session` | Preserve recovery metadata across worker restarts in a browser session | No persistent content or sync database |
| `chrome.storage.local` | Save one integer representing the active three-level preset | No URL data or global Chrome configuration changes |
| `extension/page-ui.js` | On-demand Shadow DOM URL navigation UI and optional Clean Window extension dock | Requires `activeTab` and `scripting`; no always-on host or `management` permission, no Chrome security-origin spoofing |

## Operation safety

The controller locks both tab and window IDs for an operation. It checks the tab's location before the operation and again after journaling but before a popup move. Grouped and split-view tabs are declined for popup conversion.

The panel stores a numeric **simplification level (1–3)** in `chrome.storage.local`; missing/invalid values default to 1. All three levels create a Popup with the original tab. Level 1 injects a drawn address bar and Clean Window-owned extension dock; level 2 injects only the address bar; level 3 does not inject page UI. The independent fullscreen shortcut remains. No access to the installed-extension list or third-party actions is requested. For a detached normal window, restoration moves the original tab directly back into its source window; if that source has closed, the detached normal window is kept as a safe fallback. Chrome's native tab strip and toolbar cannot be independently hidden while keeping the native omnibox.

Popup conversion uses `windows.create` with the existing `tabId`. Restoration first creates a normal window with that tab, then attempts to merge it back into the recorded origin. Failed merging leaves a usable normal window instead of closing the page.

Fullscreen state is recorded before `windows.update`. Restore applies previous bounds only when leaving recorded fullscreen, rather than overwriting a normal window with stale data after a native fullscreen exit.

These behaviors are tested with [a deterministic Chrome API simulator](../tests/fake-chrome.mjs). Native rendering, real-site state retention, screen geometry, and OS interactions still require browser acceptance.

[Verification](verification.md) · [Chrome Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
