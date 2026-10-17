[![Original jade window guardian removing toolbar clutter from one selected pane while two neighboring windows remain unchanged.](docs/assets/readme/clean-window-hero-v1.jpg)](docs/assets/readme/clean-window-hero-v1.jpg)

# Clean Window

> A cleaner Chrome window, without changing the others.

![Source preview 0.1.0](https://img.shields.io/badge/source_preview-0.1.0-176851) ![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-52636b) [![CI](https://github.com/pingqLIN/clean-window/actions/workflows/ci.yml/badge.svg)](https://github.com/pingqLIN/clean-window/actions/workflows/ci.yml)

[Quick Start](#quick-start) · [Three clean-window levels](#three-clean-window-levels) · [Shortcuts](#shortcuts) · [Limits](#limits) · [Development](#development) · [繁體中文](README.zh-TW.md)

Choose one of three simplification levels: a lightweight two-row browser toolbar, a drawn address bar only, or a bare popup. Fullscreen remains a separate action; other windows are not changed. Actions target a specific window and tab instead of changing Chrome's global appearance settings.

**Status: source preview.** 68 automated API-simulation and popup-interaction tests pass. Real Chrome window appearance, keyboard operation, and Windows browser acceptance remain **unverified**. The extension interface is currently in Traditional Chinese; documentation is available in English and Traditional Chinese. The hero is concept artwork, not a runtime screenshot.

## Quick Start

No Node.js, Python, server, or administrator privileges are needed to load the extension.

> **Before testing:** save important page work. Remember **`Alt + Shift + R`** to restore a clean window; its toolbar is hidden. The window's **X closes the tab**, rather than restoring it. Managed browsers may prohibit unpacked extensions; this project does not bypass policies.

1. Download the [v0.1.0 source-preview ZIP](https://github.com/pingqLIN/clean-window/releases/download/v0.1.0/clean-window-v0.1.0.zip) and extract it into a permanent folder. Alternatively, use **Code → Download ZIP** on this repository.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Select **Load unpacked**, then choose the **`extension/`** subfolder containing `manifest.json`—not the ZIP or repository root.
4. Pin **Clean Window｜乾淨視窗**, open it from your target window, and choose a mode. Keep a second test window open to confirm that its appearance and tabs do not change.

Keep the extracted extension folder in place. Full instructions: [Usage and recovery](docs/usage.md) · [繁體中文操作說明](docs/usage.zh-TW.md).

## Three clean-window levels

The single slider offers three modes, all implemented as a resizable Chrome popup that retains the native titlebar.

| Level | Drawn toolbar | Behavior |
| --- | --- | --- |
| 1 (default) | **Lightweight browser toolbar** | Two rows (86px): URL/navigation, bookmark shortcut and star, managed-window list, history, downloads, extensions management and Restore |
| 2 | Address only | URL input and navigation, without the extension dock |
| 3 | None | Bare popup with no injected toolbar |

The drawn bar is NOT Chrome's native omnibox or a trustworthy origin/security indicator. The drawn toolbar cannot invoke other extensions' action buttons. No `management` or broad host permission was introduced. Bookmarks use an **optional** `bookmarks` permission, requested only from a separate extension page after an explicit user click; they do not require a sensitive `tabs` permission. Levels 1–2 only inject after the user activates the extension on an eligible HTTP(S) site, and the bar can disappear after cross-document navigation. Level 3 does not require injection to open, but keeps the edge control when eligible.

**Managed windows:** Open the expandable managed-window list in the extension popup (or the level-1 toolbar). Only live Clean Window popups from the current session are listed; focus, change L1/L2/L3, or restore individual windows. Edited Emoji titles are reflected in the session-scoped list.

**In-page control:** The primary Apply button now appears above the level picker. An icon-only `◈` tab attaches to the screen edge on eligible pages. Hover or keyboard focus expands the vertical three-stop rail, with labels shown only when a stop is hovered/focused. Dragging the tab snaps it left/right and changes height, saved locally. Switching levels updates the existing popup without moving the tab. Restricted or cross-origin pages may lose the control; use `Alt + Shift + R` to restore.

The former DOM masking experiment and levels 4–6 are removed from the selector. Separate fullscreen and restore shortcuts remain for compatibility.

**Emoji icon and quick edit:** Single-click the page-edge `◈` tab to open the editor; drag the same tab to move it. The editor accepts a single Unicode grapheme, including composed Emoji or flags. The native Chrome titlebar is not interceptable by an extension.

**Editable clean-mode title:** A clean popup initially displays the standard Unicode symbol `◈` followed by the original webpage title. Press `Alt + Shift + T`, or use the page context menu, to select another built-in Symbol glyph, edit the text, or reset it. Normal-window restoration restores the native webpage title. This adjusts `document.title`, **not** Chrome's native favicon/security identity. It is limited to eligible HTTP(S) pages; the headless DOM behavior has passed, but actual Windows popup titlebar rendering needs GUI acceptance.

## Shortcuts

| Action | Default shortcut |
| --- | --- |
| Toggle active tab between clean and normal window | `Alt + Shift + W` |
| Toggle fullscreen for the target window | `Alt + Shift + F` |
| Restore the current window | **`Alt + Shift + R`** |
| Edit clean-mode Symbol and title | `Alt + Shift + T` |

The page context menu also provides these actions. Assign conflicting shortcuts at `chrome://extensions/shortcuts`; the panel shows the combinations Chrome actually registered. Some pages suppress the normal context menu.

## Limits

| Boundary | What to expect |
| --- | --- |
| One tab versus a whole window | All three levels move only the active tab into a popup; an independent fullscreen shortcut keeps all tabs in place. |
| Groups and Split View | Popup mode declines grouped or split-view tabs to avoid dismantling their structure. Use fullscreen instead. |
| Last tab and restoration | Moving the last tab can close its empty source window. A restarted browser or reloaded extension may lose session restoration metadata. |
| Page state | The extension moves the existing tab and does not intentionally navigate or reload it. Real-site forms, media, and resize behavior have not been acceptance-tested. |
| Browser UI | All three levels use Chrome Popup frames, with a native OS titlebar. Drawn bars do not claim Chrome origin/security verification. |
| Compatibility | The manifest declares Chrome **102+** and Manifest V3. This is an API floor, not a tested browser-version matrix. Other browsers and operating systems have not been accepted. |

The public Windows API supports creating a popup and updating window state, but does not expose changing an existing window's type in place. See [official Windows API documentation](https://developer.chrome.com/docs/extensions/reference/api/windows).

## Privacy and permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Session restoration records plus a persistent level preset and edge position |
| `activeTab` and `scripting` | On-demand injection for self-drawn URL navigation and optional extension-owned dock |
| `contextMenus` | Page and extension-action menu entries for switching and restoration |

No broad host permissions, persistent content scripts, native host, analytics, or external network requests are implemented. The extension does not request the sensitive `tabs` permission; it uses tab IDs and window metadata, not page content. The README's remote badges are separate from extension runtime behavior. See [PRIVACY.md](PRIVACY.md) and the [manifest](extension/manifest.json).

## Development

Node.js **20+** is declared in `package.json`. There are no npm dependencies, and no install or build step is required.

```sh
# From the repository root
npm test
npm run check
```

`npm test` runs 67 tests against deterministic Chrome API simulations and popup interactions. `npm run check` checks JavaScript syntax, MV3 metadata, version consistency, permissions, icons, and inline-handler restrictions. These checks do **not** prove actual browser behavior.

| Resource | Purpose |
| --- | --- |
| [Verification record](docs/verification.md) | Passed checks, blocked browser tests, and remaining acceptance work |
| [Architecture](docs/architecture.md) | Popup, worker, controller, and browser responsibility boundaries |
| [Contributing](CONTRIBUTING.md) | Local checks, scope, and safe bug reports |
| [Changelog](CHANGELOG.md) | Version history |
| [Issues](https://github.com/pingqLIN/clean-window/issues) | Reproducible bugs and feature requests; do not post sensitive browser data |

The GitHub Actions workflow is configured to run the same tests and static checks on Linux and Windows. **Hosted CI has not executed:** the first attempt was blocked before runner startup. Its badge reports workflow status, not the local-test results. The optional [headed Chromium test](tests/browser-smoke.py) is Linux-oriented, uses an isolated temporary profile, and requires extra tools; see the verification record before running it. It is not part of extension installation.

## AI-assisted development

Implementation, tests, documentation, and visual assets were prepared with AI assistance. The publication and documentation pass used **GPT-6 Astra Pro**; the hero uses original AI-generated artwork rather than a third-party mascot or product screenshot.

> Automated tests and source review are not an independent security audit or a guarantee of correctness. Browser acceptance remains outstanding. Test with non-sensitive pages first.

## License

No license was supplied with the original package, and no open-source license has been selected for this publication. There is currently **no `LICENSE` file**. Public visibility does not establish an open-source license grant.
