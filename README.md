[![Original jade window guardian removing toolbar clutter from one selected pane while two neighboring windows remain unchanged.](docs/assets/readme/clean-window-hero-v1.jpg)](docs/assets/readme/clean-window-hero-v1.jpg)

# Clean Window

> A cleaner Chrome window, without changing the others.

![Source preview 0.1.0](https://img.shields.io/badge/source_preview-0.1.0-176851) ![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-52636b) [![CI](https://github.com/pingqLIN/clean-window/actions/workflows/ci.yml/badge.svg)](https://github.com/pingqLIN/clean-window/actions/workflows/ci.yml)

[Quick Start](#quick-start) · [Modes](#modes) · [Shortcuts](#shortcuts) · [Limits](#limits) · [Development](#development) · [繁體中文](README.zh-TW.md)

Move the active tab into a resizable popup, or make its entire window fullscreen. Actions target a specific window and tab instead of changing Chrome's global appearance settings.

**Status: source preview.** Thirty automated API-simulation tests pass. Real Chrome window appearance, keyboard operation, and Windows browser acceptance remain **unverified**. The extension interface is currently in Traditional Chinese; documentation is available in English and Traditional Chinese. The hero is concept artwork, not a runtime screenshot.

## Quick Start

No Node.js, Python, server, or administrator privileges are needed to load the extension.

> **Before testing:** save important page work. Remember **`Alt + Shift + R`** to restore a clean window; its toolbar is hidden. The window's **X closes the tab**, rather than restoring it. Managed browsers may prohibit unpacked extensions; this project does not bypass policies.

1. Download the [v0.1.0 source-preview ZIP](https://github.com/pingqLIN/clean-window/releases/download/v0.1.0/clean-window-v0.1.0.zip) and extract it into a permanent folder. Alternatively, use **Code → Download ZIP** on this repository.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Select **Load unpacked**, then choose the **`extension/`** subfolder containing `manifest.json`—not the ZIP or repository root.
4. Pin **Clean Window｜乾淨視窗**, open it from your target window, and choose a mode. Keep a second test window open to confirm that its appearance and tabs do not change.

Keep the extracted extension folder in place. Full instructions: [Usage and recovery](docs/usage.md) · [繁體中文操作說明](docs/usage.zh-TW.md).

## Modes

| Mode | What changes | What stays intact |
| --- | --- | --- |
| **Clean popup** | Moves the active tab into a new resizable popup, without the normal address, tab, and bookmarks bars | Existing tab identity; native titlebar and Chrome safety UI remain. Other tabs stay in their source window. |
| **Window fullscreen** | Toggles fullscreen on the selected window | That window's tabs, groups, and identity; other windows are not resized or restyled. |
| **Restore** | Leaves fullscreen or returns a popup tab to its original window when available | Falls back to a new normal window when the origin is gone; never borrows an unrelated window. |

Switching can change keyboard focus. “Other windows unchanged” refers to their geometry, mode, appearance settings, and tab contents—not to a guarantee that focus never moves. See [the controller](extension/controller.js) and [its tests](tests/controller.test.mjs).

## Shortcuts

| Action | Default shortcut |
| --- | --- |
| Toggle active tab between clean and normal window | `Alt + Shift + W` |
| Toggle fullscreen for the target window | `Alt + Shift + F` |
| Restore the current window | **`Alt + Shift + R`** |

The page context menu also provides these actions. Assign conflicting shortcuts at `chrome://extensions/shortcuts`; the panel shows the combinations Chrome actually registered. Some pages suppress the normal context menu.

## Limits

| Boundary | What to expect |
| --- | --- |
| One tab versus a whole window | Popup mode moves only the active tab. Use fullscreen to retain the entire original window and its tabs. |
| Groups and Split View | Popup mode declines grouped or split-view tabs to avoid dismantling their structure. Use fullscreen instead. |
| Last tab and restoration | Moving the last tab can close its empty source window. A restarted browser or reloaded extension may lose session restoration metadata. |
| Page state | The extension moves the existing tab and does not intentionally navigate or reload it. Real-site forms, media, and resize behavior have not been acceptance-tested. |
| Browser UI | This is not a frameless native window. OS frames and browser-origin/security/permission UI are not hidden or spoofed. |
| Compatibility | The manifest declares Chrome **102+** and Manifest V3. This is an API floor, not a tested browser-version matrix. Other browsers and operating systems have not been accepted. |

The public Windows API supports creating a popup and updating window state, but does not expose changing an existing window's type in place. See [official Windows API documentation](https://developer.chrome.com/docs/extensions/reference/api/windows).

## Privacy and permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Session-only restoration records and operation feedback |
| `contextMenus` | Page and extension-action menu entries for switching and restoration |

No host permissions, content scripts, native host, analytics, or external network requests are implemented. The extension does not request the sensitive `tabs` permission; it uses tab IDs and window metadata, not page content. The README's remote badges are separate from extension runtime behavior. See [PRIVACY.md](PRIVACY.md) and the [manifest](extension/manifest.json).

## Development

Node.js **20+** is declared in `package.json`. There are no npm dependencies, and no install or build step is required.

```sh
# From the repository root
npm test
npm run check
```

`npm test` runs 30 tests against a deterministic Chrome API simulator. `npm run check` checks JavaScript syntax, MV3 metadata, version consistency, permissions, icons, and inline-handler restrictions. These checks do **not** prove actual browser behavior.

| Resource | Purpose |
| --- | --- |
| [Verification record](docs/verification.md) | Passed checks, blocked browser tests, and remaining acceptance work |
| [Architecture](docs/architecture.md) | Popup, worker, controller, and browser responsibility boundaries |
| [Contributing](CONTRIBUTING.md) | Local checks, scope, and safe bug reports |
| [Changelog](CHANGELOG.md) | Version history |
| [Issues](https://github.com/pingqLIN/clean-window/issues) | Reproducible bugs and feature requests; do not post sensitive browser data |

GitHub Actions runs the same tests and static checks on Linux and Windows. Its badge reports the actual workflow result. The optional [headed Chromium test](tests/browser-smoke.py) is Linux-oriented, uses an isolated temporary profile, and requires extra tools; see the verification record before running it. It is not part of extension installation.

## AI-assisted development

Implementation, tests, documentation, and visual assets were prepared with AI assistance. The publication and documentation pass used **GPT-6 Astra Pro**; the hero uses original AI-generated artwork rather than a third-party mascot or product screenshot.

> Automated tests and source review are not an independent security audit or a guarantee of correctness. Browser acceptance remains outstanding. Test with non-sensitive pages first.

## License

No license was supplied with the original package, and no open-source license has been selected for this publication. There is currently **no `LICENSE` file**. Public visibility does not establish an open-source license grant.
