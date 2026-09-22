# Verification record

Publication baseline: **2026-09-23 (Asia/Taipei)**. Version: **0.1.0 source preview**.

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

The 30 tests cover target-only effects, same-tab moves, origin restoration, missing origin and last-tab fallback, maximized/fullscreen round trips, stale and changing targets, operation locking, grouped/Split View guards, storage/API failures, usable fallback windows, worker reconstruction, interrupted journaling, incognito separation, message-source validation, and cleanup isolation.

## Re-run the accepted checks

```sh
npm test
npm run check
```

No npm installation is required. Tests use Node's built-in test runner. Raw local logs belong in ignored `evidence/` or `local/` directories rather than public Git history.

## Optional headed browser test

`tests/browser-smoke.py` is a Linux-oriented developer tool requiring Python, Playwright, Pillow, a compatible Chromium executable, Xvfb, and Openbox. Read the script and use an isolated disposable test environment. Its startup flags include `--no-sandbox`; do not use it to browse untrusted sites or with a personal profile. It serves only synthetic loopback fixtures and must not be used to bypass managed-browser policy.

The script is not included in required CI and has not passed its full browser run in the available environment. An absence of a completed PASS report is not acceptance.

## Remaining acceptance

Verify two-window isolation, popup chrome, actual shortcuts, clean/fullscreen restoration, real-site forms/media, incognito boundaries, multiple monitors, DPI, Windows Snap, and special browser/PWA pages. Follow [the safe first-check procedure](usage.md#install-and-first-check).

No independent second-person security review has been completed. Automated coverage does not establish security, UI appearance, or real-site state preservation.
