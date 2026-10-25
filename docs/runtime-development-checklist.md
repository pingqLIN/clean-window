# Runtime / Development separation checklist

## Decision

Keep one canonical source tree. Do **not** maintain separate copies of the extension code for Runtime and Development: duplicated implementations would drift and make permission/security review harder.

- **Runtime source of truth:** `extension/`
- **Generated Runtime folder:** `dist/runtime/`
- **Generated install archive:** `dist/clean-window-v<manifest-version>.zip`
- **Development workspace:** the repository root, including tests, scripts, documentation, CI and Git history.

The Runtime folder is generated output. Edit `extension/`, then rebuild; never hand-edit `dist/runtime/`.

## Architecture comparison

| Checkpoint | Runtime | Development |
| --- | --- | --- |
| Purpose | Load the Chrome extension or hand it to a tester | Implement, test, document and review changes |
| Entry point | `manifest.json` at the root of the folder/archive | `package.json`, source tree and developer commands |
| Required files | Files copied from `extension/`: manifest, worker, popup, content UI, bookmarks UI and icons | Runtime source plus tests, scripts, docs, workflow and repository metadata |
| User-facing functions | All end-user features; no developer-only controls | Same Runtime behavior from the same source, plus test fixtures and packaging tools |
| Dependencies | No npm install or Node.js required to load the extension | Node.js 20+ for tests, static checks and packaging; no npm dependencies |
| Installation | `chrome://extensions/` → Developer mode → Load unpacked → select `dist/runtime/` | Do not load the repository root; select `extension/` or the generated `dist/runtime/` folder |
| Test fixtures | Excluded | `tests/` and `scripts/` |
| Documentation / CI | Excluded from the ZIP | `README*`, `docs/`, `CONTRIBUTING.md`, `CHANGELOG.md`, `PRIVACY.md`, `.github/` |
| Git and local evidence | Excluded | `.git/`, local ignored output and development notes stay outside the Runtime package |
| Version | Read from `extension/manifest.json` and checked against `package.json` | Both version fields must match; the packager fails closed on mismatch |
| Distribution status | Local/source-preview package only until GUI acceptance and release decisions are complete | Working repository; public visibility is not a license grant |

## Functional parity checklist

Runtime is **not** a second or reduced-feature product variant. The generated package must contain the same runtime code as `extension/`; packaging may remove development files but must not change behavior.

- [ ] Level 1 lightweight toolbar, managed-window list and optional bookmarks entry are present.
- [ ] Level 1 persistent two-row toolbar, level 2 collapsed URL-only bar, and level 3 toolbar-free Popup remain available.
- [ ] Restore, fullscreen, title editing and documented keyboard commands remain wired.
- [ ] Edge handle drag, level preview/commit, reduced-motion handling and Restore cleanup remain present.
- [ ] Symbol/Emoji title editing, original-title restoration and SPA title tracking remain present.
- [ ] YouTube level-1 toolbar offset, level-2 collapsed/expanded URL-bar layout, level-3 focus view and cleanup on Restore/navigation remain present.
- [ ] Optional bookmarks permission remains explicit; declining it does not disable unrelated features.
- [ ] Manifest permissions and content-security policy are unchanged by packaging.

## Directory map

```text
clean-window/
├── extension/                 # canonical Runtime source
├── scripts/
│   ├── check.mjs              # static / manifest checks
│   └── package-runtime.mjs    # portable Runtime folder + ZIP builder
├── tests/                     # Development-only
├── docs/                      # Development and acceptance documentation
├── .github/workflows/ci.yml   # Windows + Ubuntu checks and package build
├── package.json               # developer commands and version
└── dist/                      # generated, ignored by Git
    ├── runtime/               # load-unpacked folder; manifest.json at root
    └── clean-window-v0.1.0.zip # files at archive root; version follows manifest
```

The exact archive filename follows the current manifest version; the example above uses version 0.1.0.

## Build and verification

Run from the repository root:

```sh
npm test
npm run check
npm run smoke:dom
npm run build:runtime
```

`npm run build:runtime` requires Node.js 20+ but no `npm install`. It creates `dist/runtime/` and `dist/clean-window-v<version>.zip`, then verifies that:

- the package and manifest versions match;
- all manifest-referenced worker, popup and icon files exist;
- no symlinks or development-only directories are present in the Runtime source;
- the generated Runtime folder matches `extension/` byte-for-byte;
- the ZIP puts `manifest.json` at its root, contains only Runtime source files, and passes decompression and CRC checks.

The ZIP writer uses Node.js built-ins and a stable file order / fixed ZIP timestamp so the archive can be built on Windows and Linux without an additional package dependency. `dist/` and ZIP artifacts are ignored by Git.

## Release acceptance checklist

### Runtime artifact

- [x] `npm run build:runtime` succeeds on the target machine (Windows).
- [x] `dist/runtime/manifest.json` exists at the Runtime folder root.
- [x] The ZIP opens successfully and contains `manifest.json` at the archive root, not under an extra `extension/` directory.
- [x] The ZIP contains only files originating from `extension/`; no tests, docs, Git metadata, package metadata or local evidence.
- [x] `package.json` and `extension/manifest.json` versions match.
- [x] Load `dist/runtime/` through `chrome://extensions/` → Developer mode → Load unpacked in isolated Chrome Stable.
- [ ] Check the extension icon, popup, L1/L2/L3 switching and the `Alt + Shift + U` recovery path.
- [ ] Keep a second ordinary Chrome window open and verify it is not changed.
- [ ] Do not describe a source-preview package as a Chrome Web Store release.

### Development workspace

- [x] `npm test` passes (95/95).
- [x] `npm run check` passes.
- [x] `npm run smoke:dom` passes, with its scope recorded accurately.
- [x] CI builds the Runtime artifact on both Windows and Ubuntu (GitHub Actions run #14).
- [x] Generated `dist/` output remains untracked.
- [x] Update English and Traditional Chinese documentation together when commands, limitations or versions change.

## Known release limits

- Automated and Headless DOM tests do not replace acceptance in an installed extension on Windows Chrome. Native popup/titlebar rendering and OS-level shortcut dispatch are verified in an isolated Chrome Stable profile; physical keyboard hardware, real-site state retention and multi-monitor/DPI transitions remain separate acceptance items.
- The project currently has no `LICENSE` file. Do not claim that public visibility makes it open source or implies permission to reuse the code.
- A successful Runtime build verifies packaging and file integrity, not full browser behavior, security audit status or store-release readiness.
