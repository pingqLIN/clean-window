# Changelog

## Unreleased — 2026-10-26 (Recovery, URL bar and shortcut hardening)

- Made missing or unverifiable restoration journals explicit: Restore warns and creates a normal window without guessing an unrelated destination. Session restoration metadata remains non-persistent.
- Added bounded repair for websites that remove the drawn toolbar host. It observes only the document root's direct child list, retries twice, restores the original layout if removals persist, and can be reapplied explicitly without duplicate page padding.
- Clarified that the drawn URL field accepts complete HTTP(S) URLs only; plain search text and unsafe schemes are rejected locally rather than sent to a search provider.
- Replaced default `Alt+Shift+W`, `Alt+Shift+R` and `Alt+Shift+T` with `Alt+Shift+Y`, `Alt+Shift+U` and `Alt+Shift+J` after the isolated headed-browser test showed the prior defaults were not registered. Fullscreen remains `Alt+Shift+F`. Static checks enforce unique defaults; Chrome for Testing reports all four commands registered. Physical keyboard invocation and Chrome Stable native popup/titlebar rendering remain unverified.
- Expanded the headed-browser test to cover shortcut registration and to distinguish browser-command dispatch from renderer-level keyboard simulation. No browser policy was changed and no personal Chrome profile was used.

## Unreleased — 2026-10-22 (Final three-mode contract)

- MODE1 is a permanently expanded 86px two-row URL + extension toolbar. It reserves space on ordinary pages; AI chat workspaces keep their app-owned root layout.
- MODE2 is a 48px URL-only bar, collapsed behind a 76×6px top-center handle. Hover or keyboard focus reveals it without reserving page space or showing extension tools.
- MODE3 is a pure minimal Popup with no page-top URL bar or toolbar; the controller removes an existing bar without injecting page UI just to hide it.
- Updated the Popup's mode descriptions and preview artwork, controller mode mapping, and Chrome Headless regressions. YouTube now tracks the effective visible height of MODE2's URL bar and offsets MODE1 content below its persistent toolbar.

## Superseded — 2026-10-22 (Level 1 initial hover guard)

- Prevented level 1 from expanding merely because the pointer is already over the toolbar handle when the clean popup is created.
- Level 1 stays collapsed until real pointer movement reaches the handle, while deliberate keyboard focus and an open extension menu can still reveal the toolbar.
- Added a Chrome Headless regression that positions the pointer over the future handle before creating the toolbar; level 2 and level 3 behavior is unchanged.

## Superseded — 2026-10-22 (Level 3 hidden URL bar)

- Added a URL-only bar to level 3. It starts hidden behind a 76×6px top-center handle and expands on hover or keyboard focus; unlike level 2, it never reserves page layout space.
- Kept level 1's hidden two-row URL + extension dock and level 2's persistent URL-only bar as distinct behaviors.
- Reconciled the new `address-hidden` mode on startup, level changes, navigation recovery and YouTube mode preview; restricted pages still open level 3 with a clear fallback warning if injection is denied.
- Allowed level-3 URL submissions to use the same per-host cross-origin access prompt as levels 1 and 2.
- Added Chrome Headless CSS/interaction coverage and a controller navigation regression for level 3.

## Unreleased — 2026-10-22 (Level 1 UI reconciliation)

- Made selecting a level reapply the requested page UI even when the session journal already records that level, repairing stale or drifted toolbars instead of returning early.
- Made the edge-level control send the selected level on repeated clicks, so clicking level 1 again can restore its URL bar plus extension toolbar if the visible page UI has fallen back to level 2.
- Added regression coverage for journal/UI mismatch and repeated selection of the already-selected level.

## Superseded — 2026-10-22 (Level 1 collapsed toolbar)

- Made level 1's two-row drawn toolbar collapse by default to a small top-center handle; hover or keyboard focus expands it.
- Kept level 2's 48px drawn address bar persistently visible, including AI workspace pages, so levels 1 and 2 remain visibly distinct.
- Removed level 1's permanent document padding reservation to avoid an empty 86px gap. Keep the toolbar expanded while its extension menu is open.
- Added Chrome Headless DOM coverage for default collapse, hover expand, auto-collapse, menu persistence, and level-2 visibility/layout spacing.

## Unreleased — 2026-10-22 (Cross-origin navigation and YouTube positioning)

- Added optional HTTP(S) host permission patterns; they are not granted at installation and are requested only for the destination hostname after an explicit cross-origin URL-bar submission. HTTPS targets request HTTPS; HTTP targets request both schemes for that hostname to support common automatic upgrades.
- Added an extension-owned site-access prompt with three explicit choices: grant this site and continue, continue without persistent site access, or cancel. Pending destination URLs are held in session storage only while the choice is pending and are cleaned up after resolution, cancellation, relevant window closure, or expiry on next access.
- Added a context-menu action to re-enable Clean Window on the current site after a cross-origin link or redirect, using temporary `activeTab` access rather than persistent host access.
- Added a visible no-permission fallback if the site-access prompt cannot be opened; navigation only proceeds after the user explicitly chooses to continue.
- Elevated YouTube Focus View in the README as the featured demonstration: level 2 preserves surrounding page content; level 3 fills the content viewport with the uncropped player. The current final mode contract also offsets level-1 content below its persistent toolbar and tracks level-2 bar visibility.
- Validation: 92/92 Node tests pass; Chrome Dev Headless DOM smoke covers same-origin/cross-origin navigation choices, site-access allow/deny/cancel, and existing YouTube layout regressions. Full installed-MV3 GUI and native Chrome permission prompt acceptance remain outstanding.

## Unreleased — 2026-10-21 (Edge mode previews)

- Hover or keyboard-focus a real edge mode stop for 150ms to preview without saving the mode. Click commits; leaving the rail or Escape restores the committed mode and original scroll position.
- Animate the live player geometry and returning page content over 200ms, with no video cloning or screenshot transitions. Reduced-motion preferences disable the transition.
- Cancel previews on drag, viewport resize, navigation, focus loss and fullscreen changes. Keep the mode rail and feedback stable as scrollbars and toolbars change; failed commits restore the original layout.

## Unreleased — 2026-10-20 (YouTube player layouts)

- Detect YouTube watch pages within the explicitly managed document. Level 1 keeps the native layout; level 2 fills the area below the drawn URL bar while retaining scrollable page content/colors; level 3 fills the viewport with a black player background.
- Keep video proportions without cropping; remove the theater height cap while allowing manual window resizing.
- Keep the outer theater stage height aligned with the player so metadata/recommendations remain below it; place the YouTube app below the level-2 URL bar.
- Measure the rendered toolbar rather than deducting a fixed 48px; update on viewport/toolbar size changes and use CSS coordinates across device pixel ratios. Dynamic viewport units have a `vh` fallback.
- Distinguish the YouTube modes: level 2 uses aspect-based player height so surrounding page content stays accessible; level 3 explicitly hides non-player website content to prevent sibling layers from overlapping the video.
- Remove styles on Restore, level 1 and non-watch routes; suspend them for native video fullscreen. Reuse the existing injection permission and lifecycle without adding manifest permissions.

## Unreleased — 2026-10-18 (UI micro-motion and tooltip placement)

- Added measured, reduced-motion-aware fade/feedback transitions to the self-drawn address bar, edge controller, title editor and extension popup.
- Repositioned the edge-handle help tooltip above or below the handle rather than over the level selector.
- Kept the edge levels stationary during transitions to preserve reliable pointer targets; validated with real CDP pointer events.
- Started a separate, unapproved public naming and original mascot direction document at `docs/brand-popup-vnext.zh-TW.md` without replacing published identity.


## Unreleased — 2026-10-18 (Theme switch, neutral edge handle, Emoji presets)

- Added requested Emoji title presets, including keycap `1️⃣2️⃣3️⃣`, with single-grapheme validation.
- Added persisted light/dark theme toggle to the drawn level-1 and level-2 address bars; this does not modify Chrome's native theme or web page.
- Removed `Clean Window · 自繪` text from the address bar.
- Made the draggable edge handle neutral gray and text/icon-free, with an accessible mouseover/focus instruction tooltip.
- Expanded isolated Chrome Headless DOM smoke coverage for these behaviors.


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
