# Privacy and permissions

Clean Window 0.1.0 is an unpacked, local Chrome extension. This statement describes the inspected source, not an independent security audit.

## Extension runtime

The manifest requests only `storage` and `contextMenus`. No host permissions, `activeTab`, sensitive `tabs` permission, content scripts, native messaging, remotely hosted code, analytics, or external requests are implemented. The extension-page CSP sets `connect-src 'none'`.

`chrome.tabs` can still be used for non-sensitive identifiers and tab operations without requesting the sensitive `tabs` permission. Clean Window uses those identifiers to manipulate the explicitly selected tab and window; it does not scrape page content.

## Session data

| Data | Why it exists | Where it lives |
| --- | --- | --- |
| Tab/window IDs, original index, pinned state, incognito flag | Return a tab to an appropriate original window | `chrome.storage.session` |
| Previous window state and bounds | Leave fullscreen without intentionally changing unrelated windows | `chrome.storage.session` |
| Operation feedback and recovery warnings | Explain failed or partially completed actions | `chrome.storage.session` |

There is no application backend, sync-storage use, account login, or cookie collection. Browser restart or extension reload may clear session metadata. The source includes event-specific cleanup when tabs and windows close.

## Documentation versus runtime

The GitHub README uses remote badges served by GitHub and Shields.io. Viewing those badges is separate from using the extension. The banner is stored in this repository. The optional development browser test uses a loopback test-page server and a temporary profile; it is not part of the installed extension.

## Safe issue reports

Use a synthetic test page and disclose only relevant browser/OS versions, action steps, and observed window behavior. Do not upload browser profiles, cookies, credentials, private URLs, page content, or unredacted desktop screenshots.

[Manifest](extension/manifest.json) · [Controller](extension/controller.js) · [README](README.md)
