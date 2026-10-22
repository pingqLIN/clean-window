# Privacy and permissions

Clean Window 0.1.0 is an unpacked, local Chrome extension. This statement describes the inspected source, not an independent security audit.

## Extension runtime

The manifest requests `storage`, `contextMenus`, `activeTab`, and `scripting` as required permissions. It lists `bookmarks` under `optional_permissions` and HTTP(S) host patterns under `optional_host_permissions`; neither is granted at installation. The user must explicitly approve bookmarks in an extension-owned permission window before reading or changing bookmarks. For a cross-origin URL submitted through the drawn address bar, Clean Window opens an extension-owned page and asks Chrome for only the destination hostname. HTTPS targets request HTTPS access; HTTP targets request both HTTP and HTTPS for that hostname to support common automatic upgrades. It does not automatically grant all websites. A site permission remains until the user revokes it in Chrome's extension/site-access settings. No required broad host permissions, sensitive `tabs` permission, always-on content scripts, native messaging, remotely hosted code, analytics, or external requests are implemented. The extension-page CSP sets `connect-src 'none'`.

`chrome.tabs` can still be used for non-sensitive identifiers and tab operations without requesting the sensitive `tabs` permission. Clean Window uses those identifiers to manipulate the explicitly selected tab and window; it does not scrape page body content. The optional title tool reads the selected page's `document.title` locally, without uploading or persisting that string.

The on-demand YouTube layout checks only the selected document's hostname/path, player element availability and fullscreen state. It applies local CSS in levels 2 and 3 and observes local DOM changes for player replacement. It does not extract video, comment or recommendation content, change playback, transmit data or persist the page URL. Level 1 and Restore remove its styles and observers.

Mode previews keep the committed level, temporary target and original scroll position/page URL only in the current document's memory, for cancellation and restoration. Hovering does not save the mode or send a mode-change command to the background worker. The same live player is animated; no screenshot, copied video or network request is used. Clicking commits through the existing managed-window validation.

## Session data

| Data | Why it exists | Where it lives |
| --- | --- | --- |
| Tab/window IDs, original index, pinned state, incognito flag | Return a tab to an appropriate original window | `chrome.storage.session` |
| Previous window state and bounds | Leave fullscreen without intentionally changing unrelated windows | `chrome.storage.session` |
| Operation feedback and recovery warnings | Explain failed or partially completed actions | `chrome.storage.session` |
| Managed-window label (native title captured when enabling; edited Emoji title when changed) | Show the active clean-window list without requesting `tabs` permission | `chrome.storage.session` |
| Simplification level (integer 1–3) | Select plain Popup, drawn URL toolbar, or drawn URL plus extension dock | `chrome.storage.local` |
| Edge tab side and normalized height | Remember the user's preferred attachment point | `chrome.storage.local` |
| Pending cross-origin destination URL | Resume the explicit navigation after the user grants access or chooses to continue without it | `chrome.storage.session` only while the site-access prompt is pending; removed after resolution, cancellation, target/prompt window closure, or on next access after expiry |

The title customizer keeps its chosen Symbol, original title, and edited title in the current document's runtime memory; an up-to-160-character display label is also cached in volatile session storage for the managed-window list, not in persistent storage; the title is restored when leaving clean mode. A modified title can be visible to the website while the mode is active and could affect site behavior. The on-demand edge tab sends only the requested numeric level and saves left/right plus relative height locally; no URL, page text or absolute screen location is saved for it. The extension may attempt to re-attach the interface on same-origin page navigations, subject to Chrome's activeTab restrictions. With user-granted bookmark permission, the first-level toolbar may look up, add, remove or display Chrome's recent bookmarks. It does not store those URLs in Clean Window's session/local storage. The page's own top-frame URL is used for bookmark toggles, not an arbitrary URL supplied by a web page. The toolbar's downloads/history shortcuts open Chrome's existing management pages, not raw download/history datasets. The on-demand toolbar uses the current page URL for its local display and provides extension-owned navigation and recovery controls. It does not inspect page content or other installed extensions, upload URLs, or maintain a browsing-history database. The custom URL bar is explicitly marked as extension-drawn and is not a Chrome security identity indicator. There is no application backend, sync-storage use, account login, or cookie collection. The preset level is stored locally across browser sessions; the older boolean address-bar preference may remain for compatibility. Neither contains a URL or page content. A destination URL is temporarily held in session storage only while the user is deciding whether to grant access for a cross-origin address-bar navigation; it is removed after the decision, cancellation, relevant window closure, or when an expired record is next accessed after ten minutes. It is never written to local/sync storage or sent externally. Browser restart or extension reload may clear session metadata. The source includes event-specific cleanup when tabs and windows close.

## Documentation versus runtime

The GitHub README uses remote badges served by GitHub and Shields.io. Viewing those badges is separate from using the extension. The banner is stored in this repository. The optional development browser test uses a loopback test-page server and a temporary profile; it is not part of the installed extension.

## Safe issue reports

Use a synthetic test page and disclose only relevant browser/OS versions, action steps, and observed window behavior. Do not upload browser profiles, cookies, credentials, private URLs, page content, or unredacted desktop screenshots.

[Manifest](extension/manifest.json) · [Controller](extension/controller.js) · [README](README.md)
