# Changelog

## Unreleased — 2026-10-18 (Level-1 lightweight browser and managed windows)

- Repositioned level 1 as an 86px two-row browser-style toolbar: URL controls, bookmark toggle/list, managed-window list, Chrome history/downloads and extension-management shortcuts, and Restore.
- Added a collapsible managed-window list in the extension popup; entries are verified against session journals and actual tab/window IDs, with focus, level change and Restore.
- Added an explicitly optional `bookmarks` permission, approved only through an extension-owned user-gesture permission window. No `tabs`, `management` or broad host permissions added.
- Cache only session-scoped managed-window title/Emoji labels, not arbitrary browsing URLs or page bodies.
- Left level 2 as a 48px URL-only bar and level 3 as a bare popup.


## Unreleased — 2026-10-18 (Emoji icon and edge-controller fixes)

- Added single-grapheme Emoji icon input, presets and validation to the title editor.
- Added one-click edit on the page-edge control handle, while retaining pointer drag to reposition.
- Fixed edge placement styles and hover rail hit-testing; pre-installs edge controller before the popup tab move and reuses content scripts when possible.
- Did not alter the native Chrome titlebar, extension permissions or website host access.

## Unreleased — 2026-10-17 (Popup and edge-level controls)

- Moved the primary Apply button above the Popup level selector.
- Added draggable left/right page-edge tab and hover/focus-only three-level vertical rail, with locally saved positioning.
- Added in-place switching without tab relocation, plus best-effort same-origin reattachment and no extra permissions.
- Added regression and isolated Chrome Headless DOM tests; real extension GUI acceptance remains pending.

## Unreleased — 2026-10-17

- Added editable clean-mode page titles from the original `document.title` with a built-in Unicode Symbol prefix (`◈` by default).
- Added `Alt+Shift+T` and a page context-menu entry for a transient Symbol + text editor, with original-title reset and restoration.
- Kept edited title state document-local; no new permissions, host access, dependencies or title database.
- Headless DOM and API-simulation checks cover title editing; native Windows popup titlebar GUI remains unverified.

## Unreleased — 2026-10-12

- Replaced the six-level slider with three popup levels: drawn address + extension dock, drawn address only, bare popup.
- Added a lightweight Clean Window extension dock with Restore and extensions-management actions; does not access other extension action popups.
- Kept on-demand activeTab and scripting; no extra management or broad website permissions.
- Removed the obsolete DOM dimming experiment and levels 4–6 from the selector, leaving independent fullscreen shortcut compatibility.
- Native Chrome GUI and window operations acceptance remains pending.

## 0.1.0 — 2026-09-23

Initial public source preview.

- Active-tab popup conversion with explicit restoration.
- Fullscreen toggle scoped to the selected window.
- Keyboard and context-menu recovery paths.
- Explicit target checks, minimal permissions, session journals and recovery fallback.
- Thirty simulated-API regression tests and static checks.
- English and Traditional Chinese documentation, original hero artwork and CI.

Real Chrome/Windows GUI acceptance remains outstanding. No Chrome Web Store release or project license is claimed.
