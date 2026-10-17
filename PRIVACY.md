# Privacy and permissions

Clean Window 0.1.0 is an unpacked, local Chrome extension. This statement describes the inspected source, not an independent security audit.

## Extension runtime

The manifest requests `storage`, `contextMenus`, `activeTab`, and `scripting` as required permissions. It lists `bookmarks` only under `optional_permissions`; the user must explicitly approve it in an extension-owned permission window before bookmaking or reading recent bookmarks. Access to bookmarks uses Chrome's local bookmarks store and is not exported. No broad host permissions, sensitive `tabs` permission, always-on content scripts, native messaging, remotely hosted code, analytics, or external requests are implemented. The extension-page CSP sets `connect-src 'none'`.

`chrome.tabs` can still be used for non-sensitive identifiers and tab operations without requesting the sensitive `tabs` permission. Clean Window uses those identifiers to manipulate the explicitly selected tab and window; it does not scrape page body content. The optional title tool reads the selected page's `document.title` locally, without uploading or persisting that string.

## Session data

| Data | Why it exists | Where it lives |
| --- | --- | --- |
| Tab/window IDs, original index, pinned state, incognito flag | Return a tab to an appropriate original window | `chrome.storage.session` |
| Previous window state and bounds | Leave fullscreen without intentionally changing unrelated windows | `chrome.storage.session` |
| Operation feedback and recovery warnings | Explain failed or partially completed actions | `chrome.storage.session` |
| Managed-window label (native title captured when enabling; edited Emoji title when changed) | Show the active clean-window list without requesting `tabs` permission | `chrome.storage.session` |
| Simplification level (integer 1–3) | Select plain Popup, drawn URL toolbar, or drawn URL plus extension dock | `chrome.storage.local` |
| Edge tab side and normalized height | Remember the user's preferred attachment point | `chrome.storage.local` |

The title customizer keeps its chosen Symbol, original title, and edited title in the current document's runtime memory; an up-to-160-character display label is also cached in volatile session storage for the managed-window list, not in persistent storage; the title is restored when leaving clean mode. A modified title can be visible to the website while the mode is active and could affect site behavior. The on-demand edge tab sends only the requested numeric level and saves left/right plus relative height locally; no URL, page text or absolute screen location is saved for it. The extension may attempt to re-attach the interface on same-origin page navigations, subject to Chrome's activeTab restrictions. With user-granted bookmark permission, the first-level toolbar may look up, add, remove or display Chrome's recent bookmarks. It does not store those URLs in Clean Window's session/local storage. The page's own top-frame URL is used for bookmark toggles, not an arbitrary URL supplied by a web page. The toolbar's downloads/history shortcuts open Chrome's existing management pages, not raw download/history datasets. The on-demand toolbar uses the current page URL for its local display and provides extension-owned navigation and recovery controls. It does not inspect page content or other installed extensions and does not upload or persist visited URLs. The custom URL bar is explicitly marked as extension-drawn and is not a Chrome security identity indicator. There is no application backend, sync-storage use, account login, or cookie collection. The preset level is stored locally across browser sessions; the older boolean address-bar preference may remain for compatibility. Neither contains a URL or page content. Browser restart or extension reload may clear session metadata. The source includes event-specific cleanup when tabs and windows close.

## Documentation versus runtime

The GitHub README uses remote badges served by GitHub and Shields.io. Viewing those badges is separate from using the extension. The banner is stored in this repository. The optional development browser test uses a loopback test-page server and a temporary profile; it is not part of the installed extension.

## Safe issue reports

Use a synthetic test page and disclose only relevant browser/OS versions, action steps, and observed window behavior. Do not upload browser profiles, cookies, credentials, private URLs, page content, or unredacted desktop screenshots.

[Manifest](extension/manifest.json) · [Controller](extension/controller.js) · [README](README.md)
