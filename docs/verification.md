# Verification record

Publication baseline: **2026-09-23 (Asia/Taipei)**. Version: **0.1.0 source preview**.

## Three-level update — developed 2026-10-12, committed 2026-10-17

The three selectable popup modes are drawn address+extension dock, address only and bare popup. The extension dock offers only Clean Window Restore and Chrome extension-management shortcuts. Previous DOM focus-masking experiment is retired. Verified on the local Windows device: 46/46 simulated-API and popup interaction tests PASS; JavaScript/MV3 static checks PASS; 3/3 isolated Chrome Dev Headless DOM checks PASS; Git diff whitespace checks PASS. Live Chrome extension installation, native popup visual appearance, and extension-dock actions remain NOT YET GUI-VERIFIED.

## Editable title update — 2026-10-17 (feature branch)

A document-scoped title controller initializes the original webpage title with a Unicode Symbol prefix and supports a transient editor (shortcut and page context menu), a custom title and glyph, SPA title updates, reset and restore. Its title text is neither uploaded nor persisted. Level 3 still works when injection is blocked, but title editing is then unavailable. The native OS popup titlebar and favicon rendering are **not** verified by Headless DOM tests.

Local verification: **52/52** Node API/popup tests, **7/7** isolated Chrome Dev Headless DOM checks, MV3 static checks and Git whitespace checks PASS.

## Popup layout and edge-control update — 2026-10-17 (feature branch)

The primary Apply action moved above the level picker. A draggable icon-only edge tab supplies three in-page levels without recreating the popup. Isolated Chrome Dev Headless DOM tests cover hover visibility, level selection, drag and local position persistence. Native Chrome popup rendering, real extension installation and cross-origin reattachment remain unverified.

Windows local checks: **62/62** simulated API/popup tests PASS; `npm run check`, `npm run smoke:dom` and Git whitespace checks PASS before commit.

## Emoji title and missing edge-control fix — 2026-10-18

Fixed edge host positioning where `all:initial!important` took precedence over non-important `top/left/right`. Fixed hover rail pointer hit-testing, and prepared edge content script before moving the tab into a Popup. Reuses existing content scripts when possible to avoid a second post-move `activeTab` injection request. Single-click edge handle sends an authenticated title-edit action; drags do not open it. Emoji validation uses grapheme segmentation to support ZWJ, skin-tone and flag Emoji while rejecting multiple independent icons.

Isolated Chrome Headless DOM checks cover pointer clicks, right/left viewport alignment, drag and click separation, and Emoji editing. These are not acceptance of a live MV3 extension on the user's active Chrome profile.

## Level-1 lightweight toolbar and managed-window list — 2026-10-18

Implementation adds an 86px two-row toolbar for level 1, while level 2 remains a 48px address bar and level 3 remains a bare popup. The level-1 toolbar provides authenticated session-scoped window management, Restore, bookmark permission entry, local recent bookmarks, and Chrome history/download/extension-management shortcuts. The extension popup has a collapsible managed-window list. Bookmark access is optional, explicitly granted on a separate extension page. No broad host, `tabs`, `management`, or downloads/history permissions were introduced. Session storage caches a display title only for managed popups and revalidates tab-window relationships.

Current local checks: **68/67** simulated API/popup tests PASS; **15/15** isolated Chrome Dev Headless DOM checks PASS; `npm run check` PASS. Actual installed MV3 extension interaction, permission prompt, Chrome native popup appearance, and source-window recovery still require GUI acceptance.

## Evidence levels

| Check | Result | Scope |
| --- | --- | --- |
| `npm test` | PASS, 30/30 | Re-run on Linux / Node.js 22.16.0 and Windows / Node.js 24.14.1 during publication preparation; simulated Chrome APIs |
| `npm run check` | PASS | JavaScript syntax, MV3 metadata, matching versions, minimal permissions, icons and inline-handler check |
| GitHub CI | BLOCKED before runner startup | [First run](https://github.com/pingqLIN/clean-window/actions/runs/35786947119): zero hosted checks executed. Local Linux/Windows results are separate. |
| Headed Chromium acceptance | BLOCKED in the original development environment | Browser startup handshake and existing extension/fullscreen management restrictions; policies were not changed |
| Windows Chrome GUI acceptance | NOT RUN | No claim about successful extension installation, native toolbar appearance or physical keyboard behavior |
| Hero image | Concept art only | Not evidence of Chrome rendering or successful installation |

The original extension runtime files were preserved for publication. Public documentation was reorganized, private-path-bearing development logs and internal delivery plans were excluded, and CI plus original banner artwork were added.

## Automated coverage

The 68 current tests cover target-only effects, same-tab moves, origin restoration, missing origin and last-tab fallback, maximized/fullscreen round trips, stale and changing targets, operation locking, grouped/Split View guards, storage/API failures, usable fallback windows, worker reconstruction, interrupted journaling, incognito separation, message-source validation, and cleanup isolation.

## Re-run the accepted checks

```sh
npm test
npm run check
npm run smoke:dom
```

No npm installation is required. Tests use Node's built-in test runner. Raw local logs belong in ignored `evidence/` or `local/` directories rather than public Git history.

## Optional headed browser test

`tests/browser-smoke.py` is a Linux-oriented developer tool requiring Python, Playwright, Pillow, a compatible Chromium executable, Xvfb, and Openbox. Read the script and use an isolated disposable test environment. Its startup flags include `--no-sandbox`; do not use it to browse untrusted sites or with a personal profile. It serves only synthetic loopback fixtures and must not be used to bypass managed-browser policy.

The script is not included in required CI and has not passed its full browser run in the available environment. An absence of a completed PASS report is not acceptance.

## Remaining acceptance

Verify two-window isolation, popup chrome, actual shortcuts, clean/fullscreen restoration, real-site forms/media, incognito boundaries, multiple monitors, DPI, Windows Snap, and special browser/PWA pages. Follow [the safe first-check procedure](usage.md#install-and-first-check).

No independent second-person security review has been completed. Automated coverage does not establish security, UI appearance, or real-site state preservation.
