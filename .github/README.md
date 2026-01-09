<p align="center"><img src="https://raw.githubusercontent.com/jeffshee/gnome-ext-hanabi/master/res/sparkler.svg" width="256"></p>

<p align="center">Live Wallpaper for GNOME</p>
<p align="center">Hanabi 花火【はなび】(n) fireworks</p>
<p align="center">( ・ω・)o─━・*:'・:・゜'・:※</p>

# Hanabi Live Wallpaper for GNOME

[![Extension CI](https://github.com/DarkPhilosophy/gnome-ext-hanabi/actions/workflows/ci.yml/badge.svg)](https://github.com/DarkPhilosophy/gnome-ext-hanabi/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GNOME 49](https://img.shields.io/badge/GNOME-49-blue.svg)](https://www.gnome.org/)
[![Version 1](https://img.shields.io/badge/Version-1-green.svg)](https://github.com/DarkPhilosophy/gnome-ext-hanabi)

**Hanabi** is a GNOME Shell extension that plays video wallpapers with performance and stability improvements.

**Status**: Active development in this fork.

<!-- EGO-VERSION-START -->
[![Upstream (original) last commit](https://img.shields.io/github/last-commit/jeffshee/gnome-ext-hanabi)](https://github.com/jeffshee/gnome-ext-hanabi)
<!-- EGO-VERSION-END -->

## Validation Status

<!-- LINT-RESULT-START -->
### Latest Linting Result
> **Status**: ✅ **Passing**  
> **Date**: 2026-01-09 17:25:43 UTC  
> **Summary**: 0 errors, 0 warnings

<details>
<summary>Click to view full lint output</summary>

```
> gnome-ext-hanabi@1.0.0 lint
> ./lint_check.sh

═══════════════════════════════════════════════════════════
GNOME Extension Linting 
═══════════════════════════════════════════════════════════

Running: eslintrc-extension
─────────────────────────────────────────────────────────
✓ PASS: eslintrc-extension

Running: eslintrc-shell
─────────────────────────────────────────────────────────
✓ PASS: eslintrc-shell

═══════════════════════════════════════════════════════════
✓ Linting passed successfully!
```

</details>
<!-- LINT-RESULT-END -->

<!-- LATEST-VERSION-START -->
### Latest Update (v1)
- `extension/performance.js` performance monitor and optimization helpers.
- `extension/snapshot.js` snapshot manager and DBus integration.
- `build.sh`, `build_date.txt`, and `test_optimizations.sh` helper scripts.
- `lint/` ESLint configs and `lint_check.sh` runner.
- `.github/CHANGELOG.md` and `.github/README.md` for repo metadata.
- Renderer frame pacing, logging, and snapshot flow in `extension/renderer/renderer.js`.
- Extension lifecycle, settings, and cleanup logic in `extension/extension.js`.
- Auto-pause modules, DBus wrappers, launcher flow, and logging improvements.
- Schema tweaks in `extension/schemas/io.github.jeffshee.hanabi-extension.gschema.xml`.
- Lint defaults tuned for extension code and console usage.
- `.gitignore` now excludes `*.backup-*`.
- Project layout uses `extension/` instead of `src/` for clarity.
- Root README moved into `.github/README.md`.
- Deprecated distro docs under `docs/`.
<!-- LATEST-VERSION-END -->

## Demo 📽️

Please click on the image to view (redirect to YouTube)

[![](https://i3.ytimg.com/vi/BWjXl4h9_BA/maxresdefault.jpg)](https://www.youtube.com/watch?v=BWjXl4h9_BA)
[Wallpaper used in demo](https://www.youtube.com/watch?v=2pBj0RKN3Y8)

## GNOME Shell Support

| Version | 49 |
| :-----: | :-: |
| Status  | ✅  |

## Install

- Clone the repo

  ```
  git clone https://github.com/DarkPhilosophy/gnome-ext-hanabi.git
  ```

- Local build:

  ```
  ./build.sh
  ```

## Advanced Customization

For more advanced customization, learn how to write scripts for the Hanabi extension.

## Project Docs

- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [License](../LICENSE)
