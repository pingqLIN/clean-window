# Contributing

This repository is a source preview, not a browser-store release. Read [the verification record](docs/verification.md) before reporting compatibility or changing status claims. No project license has been selected; do not assume open-source reuse or contribution terms.

## Local checks

Use Node.js 20+ from the repository root. No dependency installation or build is required.

```sh
npm test
npm run check
```

For changes to window behavior, add a regression test in `tests/controller.test.mjs` or `tests/background.test.mjs`, verify that it fails before the fix and passes after it, then run the complete suite. Keep the manifest permission set minimal.

Preserve explicit-target handling, normal/incognito separation, usable restoration fallback, and browser-policy boundaries. Do not introduce global Chrome settings, content injection, or new permissions as an incidental change.

## Documentation and visuals

`README.md` is the English landing page; `README.zh-TW.md` is its Traditional Chinese companion. Keep commands, shortcuts, versions, caveats, and license meaning aligned. Place detailed how-to material under `docs/` and use repository-relative links.

Generated visuals must be original, have useful alt text, and be marked as concept artwork when they are not actual runtime captures. Never substitute a render or mock for browser-acceptance evidence.

## Report a bug

Use [Issues](https://github.com/pingqLIN/clean-window/issues) with browser/OS versions, synthetic reproduction steps, mode/shortcut, expected and observed behavior, and whether another window changed. Do not post cookies, credentials, private URLs, browser profiles, or unredacted desktop screenshots.

Keep private AI notes, handoffs, credentials, caches, and diagnostics in ignored `ai-private/`, `ai-discussion/`, `local/`, or `evidence/` directories. They are not publication inputs.
