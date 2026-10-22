# Usage and recovery

[README](../README.md) · [繁體中文](usage.zh-TW.md)

**Featured demo — YouTube Focus View:** level 2 keeps titles, comments and recommendations visible while fitting the player below the drawn address bar; level 3 fills the content viewport with the player and hides other site content without cropping the video. The edge rail previews the layout before committing, and Restore returns the page to its normal layout.

## Install and first check

To test the source checkout directly, load its `extension/` folder through `chrome://extensions/` → Developer mode → Load unpacked. For a generated Runtime build, run `npm run build:runtime` and load `dist/runtime/`, or extract `dist/clean-window-v<version>.zip` and load the extracted folder whose root contains `manifest.json`. Do not load the repository root. The extension itself needs no build or Node.js at runtime; Node.js 20+ is needed only to generate the package. Keep the selected folder in place. Save important work before trying window operations.

1. Open test windows A and B, with two tabs in A. Record B's appearance, size, position, and tab contents.
2. In A, select level 1 and use `Alt + Shift + W`. Confirm the two-row toolbar and managed-window list appear. Restore and select level 2 to confirm the URL bar remains but the dock is gone.
3. Select level 3 and confirm no custom toolbars appear. Use `Alt + Shift + T` to edit the title symbol/text, then restore with `Alt + Shift + R` and verify the site's original title returns. Test fullscreen separately with `Alt + Shift + F`.
4. Grouped/Split View tabs should use the independent fullscreen shortcut rather than moving into popup mode. Resolve missing shortcuts at `chrome://extensions/shortcuts`.

**These are acceptance steps, not claims that they have already passed on your computer.**

## Three-level operation

Level 1 draws a two-row (86px) browser-like toolbar with navigation, a bookmark star, recent bookmarks, a current-session managed-window list, Chrome history and downloads shortcuts, extension management, and Restore. It starts collapsed to a small top-center handle; hover or keyboard focus expands it, and an open extension menu keeps it expanded. Level 1 does not reserve a permanent blank gap in the page layout; while expanded, its toolbar overlays the page's top edge. Level 2 draws a persistent 48px address bar without the secondary dock. Both levels include a `☾`/`☀` switch for the self-drawn interface's light/dark colors (saved locally; Chrome's native theme and the website are unchanged). The URL bar brand text has been removed. Level 3 opens a bare popup without an address or extension dock, but can still show the edge-level controller and title-only injection on eligible HTTP(S) pages. All retain the OS titlebar.

The drawn address field is not Chrome's trusted native omnibox. The toolbar cannot activate third-party extension actions. It needs no extension-management permission. Bookmarks need optional user approval via the extension's separate permission page, never automatically. Levels 1 and 2 inject only on eligible HTTP(S) pages. When a user submits a cross-origin URL in the drawn address bar, Clean Window opens a per-site access choice; granting access to that hostname lets the toolbar reattach after navigation. HTTPS targets request HTTPS access; HTTP targets request both HTTP and HTTPS for that hostname to survive common automatic upgrades. Declining still allows navigation, but the toolbar may disappear. Links and redirects that cross origins without prior access can also remove the controls; use the page context menu's **Clean Window · 重新啟用目前網站的精簡介面** action to reinject on demand with temporary `activeTab` access. No all-sites permission is granted automatically. The Popup Apply button is positioned above its slider. On eligible sites a blank, neutral-gray edge tab shows instructions and expands into a vertical three-stop rail on hover or keyboard focus; labels show only when a stop is hovered or focused. Drag to snap it to either edge and set its height (saved locally). Level changes keep the existing popup and tab; restricted pages may lose the control. `Alt + Shift + R` remains available.

The level-1 window manager and expandable list inside the normal extension popup identify only still-open Clean Window managed popups, with focus, L1–L3 change, and individual Restore. Titles/Emoji are cached in session storage for this list, not synchronized or uploaded. Permission for bookmarks can be declined without affecting other controls.

Legacy DOM dimming is retired from the selector.

## Edge mode preview

Hover or keyboard-focus a stop on the actual page-edge rail for about 150ms to preview. A dashed outline marks the preview while the committed selection stays unchanged. Only clicking/activating the stop saves the mode. Leaving the entire rail, moving focus outside, or pressing Escape restores the committed layout and the scroll position from before the preview. The decorative popup example does not preview the active page.

The live player changes position/scale over about 200ms, returning page content fades in, and the URL bar retains its entrance/exit fades. No video is cloned and no old-frame screenshot is used. Reduced-motion preferences disable the transition. Rapid movement cancels obsolete previews and keeps the latest target.

Dragging the handle, viewport resizing, navigation start, video fullscreen changes and window focus loss cancel previews. Preview does not move tabs, resize the outer window or save the level. Failed commits restore the committed layout. Re-enable existing clean windows after an extension update to load the preview scripts.

## YouTube watch pages

On desktop YouTube `/watch` pages, the existing three levels also select the player layout:

| Level | YouTube layout |
| --- | --- |
| 1 | Preserve the native layout; remove any special player styles. |
| 2 | Remove the site header and original player height cap. Size the player using the video aspect ratio, capped by the visible height below the measured URL bar; retain scrollable titles, comments, recommendations and their colors. |
| 3 | Fix the player to the content viewport, hiding other website content while keeping video, player controls and the extension edge control visible. Use a black background and no page scrolling. |

Video preserves its aspect ratio without cropping. The player follows manual window resizing; this feature does not automatically resize the outer window. Match the content area to the video aspect ratio for edge-to-edge video, allowing for the actual toolbar height in level 2. Native title bars and window borders remain.

Sizing uses the current viewport and the toolbar's rendered height in CSS pixels, rather than a saved monitor resolution or fixed 48px deduction. Viewport/toolbar resize events update the layout; dynamic viewport units are used when supported, with a `vh` fallback. This allows layout to respond to browser zoom and display scaling without mixing physical pixels with CSS coordinates. Tests emulate several viewport sizes and device pixel ratios; physical multi-monitor/DPI transitions still require manual acceptance.

Same-document video navigation retains the effect. Search/home routes suspend it; returning to a watch page resumes it. Native video fullscreen temporarily suspends the styles. Level 1 and Restore remove styles and observers. Shorts, embeds, YouTube Music and other websites are outside scope; mobile pages without the desktop player structure remain unchanged. Full document reloads retain the existing Chrome injection-permission limitations.

When updating, restore existing clean windows, reload the extension in `chrome://extensions/`, then enable it on the target page. Reload pages containing the earlier DevTools demonstration styles before using these modes.

## Emoji icon and quick editor

Single-click the unmarked gray page-edge handle to open the title editor; drag the handle instead to reposition it. The icon field accepts one Unicode grapheme, including Emoji sequences, keycap `1️⃣2️⃣3️⃣` and country flags, alongside Symbol icons and the additional presets `🖋️🌍🚩🔥🔍💡🛠️🔏`. Native Chrome popup titlebar clicks are outside the extension API; shortcut `Alt + Shift + T` remains available. The side control requires an eligible HTTP(S) document and may be unavailable on restricted pages.

## Editable Symbol and title

When a clean popup is created on an eligible HTTP(S) page, its document title initially becomes `◈ Original Page Title`. Press `Alt + Shift + T`, or use **Clean Window · 編輯乾淨模式標題** on the page context menu, to pick a built-in Unicode Symbol and edit the text. The editor has Cancel, Apply and Reset-to-original actions. Exiting clean mode restores the most recent native website title. Single-page apps that change their own title are tracked. The override exists only in page memory; it is not saved or transmitted.

This changes the webpage's `document.title`, not its native favicon or Chrome identity/security UI. Native Windows popup titlebar rendering is not yet GUI-verified. On restricted pages or after cross-origin navigation, the feature may be unavailable; bare popup mode still works.

## Cross-origin navigation and re-enabling

- **Same-origin navigation:** changing paths on the same origin does not trigger a site-access prompt.
- **Submitting a different origin in the drawn URL bar:** a small Clean Window window explains the destination. Choose **Allow this site and continue** to request only that destination hostname. An HTTPS target requests HTTPS access; an HTTP target requests both HTTP and HTTPS for that same hostname to survive common automatic HTTPS upgrades. The grant is optional and is not made for all sites at installation. Chrome host patterns do not separately scope paths or ports.
- **Continue without access:** the target page still opens, but the drawn toolbar may disappear. **Cancel** keeps the current page open.
- **Cross-origin links, login redirects or website redirects:** without a previous grant, Chrome revokes the source page's `activeTab` access and the toolbar may disappear. Right-click the page and select **Clean Window · 重新啟用目前網站的精簡介面** to reinject on demand using temporary `activeTab` access, without a persistent site grant. You can also restore with `Alt + Shift + R`.
- **Restricted Chrome pages:** `chrome://`, the Chrome Web Store and other restricted pages cannot use ordinary page injection; use a normal window or Restore.

## Recovering without the toolbar

Use `Alt + Shift + R`, or the page context-menu entry **Clean Window · 還原目前視窗**. A site can suppress the ordinary context menu; internal browser pages may not offer it. Closing the popup with **X closes its tab**; it is not a restore action.

The extension first restores a popup tab into a normal window, then tries to merge it into its original normal window and position. If the original is closed or a move is rejected, the tab remains in a usable new normal window. It never chooses an unrelated window as a fallback.

Session restoration records may disappear after a browser restart or extension reload. A popup can still be restored into a new normal window without those records. If the original had only one tab, Chrome may have closed the empty source window during the move.

Chrome's native fullscreen exit can also leave fullscreen. A later restore command avoids applying stale fullscreen bounds when fullscreen has already ended.

## Keyboard and privacy boundaries

Required permissions are `storage`, `contextMenus`, `activeTab` and `scripting`. `bookmarks` and HTTP(S) host access are optional. Host patterns are declared as optional and only requested for the target hostname after the user explicitly submits a cross-origin URL in the drawn address bar. The pending destination URL is kept in `chrome.storage.session` only while the access choice is open, then removed after navigation, cancellation or relevant window closure; an expired record is removed the next time it is accessed. No URL is written to `storage.local` or sync storage, and no browsing data is sent externally.

The default commands are `Alt + Shift + W`, `Alt + Shift + F`, `Alt + Shift + R`, and `Alt + Shift + T`. OS language-switch shortcuts or other extensions may conflict; the popup displays what Chrome registered rather than promising that defaults are available.

Incognito operation requires Chrome's per-extension **Allow in incognito** setting. The manifest uses split mode, and restoration does not merge incognito and normal windows. This behavior is covered by simulated tests, not by an accepted Windows incognito browser run.

## Remove or update

To update an unpacked installation, replace its files in the same folder and use Reload on its extension card. This may clear restoration metadata; restore important popup windows first. No automatic update service is included.

To remove it, first restore any clean windows, then remove the extension at `chrome://extensions/`. Deleting the source folder is not a substitute for removing the installed extension entry.

## Official references

[Unpacked installation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) · [Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows) · [Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands)
