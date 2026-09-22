# Usage and recovery

[README](../README.md) · [繁體中文](usage.zh-TW.md)

## Install and first check

Load the repository's `extension/` folder through `chrome://extensions/` → Developer mode → Load unpacked. Do not load the repository root. No build is needed. Keep that folder in place. Save important work before trying window operations.

1. Open test windows A and B, with two tabs in A. Record B's appearance, size, position, and tab contents.
2. From A's active tab, use `Alt + Shift + W`. Confirm that the new popup is resizable and that B is unchanged.
3. Use `Alt + Shift + R`. Confirm that the tab returns to A. Test fullscreen with `Alt + Shift + F`, then restore again.
4. Test grouped or Split View tabs using fullscreen rather than popup mode. Resolve missing shortcuts at `chrome://extensions/shortcuts` before relying on keyboard recovery.

**These are acceptance steps, not claims that they have already passed on your computer.**

## Choosing a mode

Popup mode moves only the active tab into a newly created window. It keeps the existing tab ID; it does not open a URL copy. Other tabs remain in the source window. Its goal is a clean, resizable view without the usual browser toolbar rows. Native OS frames and Chrome security UI remain browser-controlled.

Fullscreen changes the target window's state without moving its tabs. Prefer it when you need every tab, group, and the original window ID to remain intact.

## Recovering without the toolbar

Use `Alt + Shift + R`, or the page context-menu entry **Clean Window · 還原目前視窗**. A site can suppress the ordinary context menu; internal browser pages may not offer it. Closing the popup with **X closes its tab**; it is not a restore action.

The extension first restores a popup tab into a normal window, then tries to merge it into its original normal window and position. If the original is closed or a move is rejected, the tab remains in a usable new normal window. It never chooses an unrelated window as a fallback.

Session restoration records may disappear after a browser restart or extension reload. A popup can still be restored into a new normal window without those records. If the original had only one tab, Chrome may have closed the empty source window during the move.

Chrome's native fullscreen exit can also leave fullscreen. A later restore command avoids applying stale fullscreen bounds when fullscreen has already ended.

## Keyboard and privacy boundaries

The default commands are `Alt + Shift + W`, `Alt + Shift + F`, and `Alt + Shift + R`. OS language-switch shortcuts or other extensions may conflict; the popup displays what Chrome registered rather than promising that defaults are available.

Incognito operation requires Chrome's per-extension **Allow in incognito** setting. The manifest uses split mode, and restoration does not merge incognito and normal windows. This behavior is covered by simulated tests, not by an accepted Windows incognito browser run.

## Remove or update

To update an unpacked installation, replace its files in the same folder and use Reload on its extension card. This may clear restoration metadata; restore important popup windows first. No automatic update service is included.

To remove it, first restore any clean windows, then remove the extension at `chrome://extensions/`. Deleting the source folder is not a substitute for removing the installed extension entry.

## Official references

[Unpacked installation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) · [Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows) · [Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands)
