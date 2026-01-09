# Changelog

## Unreleased
### Added
- `src/performance.js` performance monitor and optimization helpers.
- `src/snapshot.js` snapshot manager and DBus integration.
- `build.sh`, `build_date.txt`, and `test_optimizations.sh` helper scripts.
- `lint/` ESLint configs and `lint_check.sh` runner.
- `.github/CHANGELOG.md` and `.github/README.md` for repo metadata.

### Changed
- Renderer frame pacing, logging, and snapshot flow in `src/renderer/renderer.js`.
- Extension lifecycle, settings, and cleanup logic in `src/extension.js`.
- Auto-pause modules, DBus wrappers, launcher flow, and logging improvements.
- Schema tweaks in `src/schemas/io.github.jeffshee.hanabi-extension.gschema.xml`.
- Lint defaults tuned for extension code and console usage.
- `.gitignore` now excludes `*.backup-*`.

### Removed
- Root README moved into `.github/README.md`.
- Deprecated distro docs under `docs/`.
