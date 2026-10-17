# Usage and recovery

[README](../README.md) · [繁體中文](usage.zh-TW.md)

## Install and first check

Load the repository's `extension/` folder through `chrome://extensions/` → Developer mode → Load unpacked. Do not load the repository root. No build is needed. Keep that folder in place. Save important work before trying window operations.

1. Open test windows A and B, with two tabs in A. Record B's appearance, size, position, and tab contents.
2. In A, select level 1 and use `Alt + Shift + W`. Confirm the URL bar and dock appear. Restore and select level 2 to confirm the URL bar remains but the dock is gone.
3. Select level 3 and confirm no custom toolbars appear. Use `Alt + Shift + T` to edit the title symbol/text, then restore with `Alt + Shift + R` and verify the site's original title returns. Test fullscreen separately with `Alt + Shift + F`.
4. Grouped/Split View tabs should use the independent fullscreen shortcut rather than moving into popup mode. Resolve missing shortcuts at `chrome://extensions/shortcuts`.

**These are acceptance steps, not claims that they have already passed on your computer.**

## Three-level operation

Level 1 draws an address bar plus the Clean Window extension dock, whose actions are Restore and opening the Chrome extensions-management page. Level 2 draws only an address bar. Level 3 opens a bare popup without an address or extension dock, but can still show the edge-level controller and title-only injection on eligible HTTP(S) pages. All retain the OS titlebar.

The drawn address field is not Chrome's trusted native omnibox. The dock cannot activate third-party extension actions. It needs no extension-management permission. Levels 1 and 2 inject only when the user activates the extension on an eligible HTTP(S) page, and the bar may vanish on navigation. The Popup Apply button is positioned above its slider. On eligible sites an icon-only edge tab expands into a vertical three-stop rail on hover or keyboard focus; labels show only when a stop is hovered or focused. Drag to snap it to either edge and set its height (saved locally). Level changes keep the existing popup and tab; restricted and cross-origin pages may lose the control. `Alt + Shift + R` remains available.

Legacy DOM dimming is retired from the selector.

## Emoji icon and quick editor

Single-click the page-edge `◈` handle to open the title editor; drag the handle instead to reposition it. The icon field accepts one Unicode grapheme, including Emoji sequences and country flags, alongside Symbol icons. Native Chrome popup titlebar clicks are outside the extension API; shortcut `Alt + Shift + T` remains available. The side control requires an eligible HTTP(S) document and may be unavailable on restricted pages.

## Editable Symbol and title

When a clean popup is created on an eligible HTTP(S) page, its document title initially becomes `◈ Original Page Title`. Press `Alt + Shift + T`, or use **Clean Window · 編輯乾淨模式標題** on the page context menu, to pick a built-in Unicode Symbol and edit the text. The editor has Cancel, Apply and Reset-to-original actions. Exiting clean mode restores the most recent native website title. Single-page apps that change their own title are tracked. The override exists only in page memory; it is not saved or transmitted.

This changes the webpage's `document.title`, not its native favicon or Chrome identity/security UI. Native Windows popup titlebar rendering is not yet GUI-verified. On restricted pages or after cross-origin navigation, the feature may be unavailable; bare popup mode still works.

## Recovering without the toolbar

Use `Alt + Shift + R`, or the page context-menu entry **Clean Window · 還原目前視窗**. A site can suppress the ordinary context menu; internal browser pages may not offer it. Closing the popup with **X closes its tab**; it is not a restore action.

The extension first restores a popup tab into a normal window, then tries to merge it into its original normal window and position. If the original is closed or a move is rejected, the tab remains in a usable new normal window. It never chooses an unrelated window as a fallback.

Session restoration records may disappear after a browser restart or extension reload. A popup can still be restored into a new normal window without those records. If the original had only one tab, Chrome may have closed the empty source window during the move.

Chrome's native fullscreen exit can also leave fullscreen. A later restore command avoids applying stale fullscreen bounds when fullscreen has already ended.

## Keyboard and privacy boundaries

The default commands are `Alt + Shift + W`, `Alt + Shift + F`, `Alt + Shift + R`, and `Alt + Shift + T`. OS language-switch shortcuts or other extensions may conflict; the popup displays what Chrome registered rather than promising that defaults are available.

Incognito operation requires Chrome's per-extension **Allow in incognito** setting. The manifest uses split mode, and restoration does not merge incognito and normal windows. This behavior is covered by simulated tests, not by an accepted Windows incognito browser run.

## Remove or update

To update an unpacked installation, replace its files in the same folder and use Reload on its extension card. This may clear restoration metadata; restore important popup windows first. No automatic update service is included.

To remove it, first restore any clean windows, then remove the extension at `chrome://extensions/`. Deleting the source folder is not a substitute for removing the installed extension entry.

## Official references

[Unpacked installation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) · [Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows) · [Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands)
