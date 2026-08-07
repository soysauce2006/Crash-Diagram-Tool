---
name: Version bump convention
description: Every push to GitHub must include a version bump in artifacts/accident-diagram/package.json
---

Before every push to GitHub, bump the version in `artifacts/accident-diagram/package.json`.

**Rule:** increment the patch number (e.g. 1.0.0 → 1.0.1) for fixes/small changes, the minor number (1.0.0 → 1.1.0) for new features, and the major number for breaking changes.

**Why:** The user explicitly asked that the version always be updated when pushing to Git (session on 2026-08-07). The electron-updater also relies on the version to decide whether to prompt for an update.

**How to apply:** Every time you prepare a commit that will be pushed to GitHub:
1. Edit `artifacts/accident-diagram/package.json` — bump `"version"` appropriately.
2. Also update the version badge in `README.md` (`![Version](https://img.shields.io/badge/version-X.X.X-blue)`).
3. Include the version bump in the same commit (not a separate one).
