# Changelog

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
