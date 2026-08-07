# Contributing

## Code-signing setup

Before the Windows installer can be distributed without a SmartScreen warning, a code-signing certificate must be purchased and its credentials stored as GitHub Actions secrets. See **[docs/code-signing.md](docs/code-signing.md)** for the full walkthrough:

- Choosing between OV and EV certificates
- Exporting the PFX and encoding it as Base64
- Storing `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` in the repository's Actions secrets
- Verifying the signature after a build

---

## Release process

Releases are automated via GitHub Actions. Pushing a `v*` tag (or triggering the workflow manually) builds the Windows installer and the self-hosted webapp zip, then publishes a GitHub Release.

### One-step release checklist

> **Goal:** a single `git tag … && git push …` is all that triggers a release.  
> Follow these steps in order and you will never need to delete and re-push a tag.

#### 1. Decide the new version

Use [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH` — no `v` prefix in files, only on the git tag.

#### 2. Update `artifacts/accident-diagram/package.json`

```json
"version": "1.2.0"
```

#### 3. Validate locally (catches mismatches before they hit CI)

```bash
pnpm --filter @workspace/accident-diagram run validate-release 1.2.0
```

Expected output:

```
✅  package.json version matches: 1.2.0

Ready to tag:
  git tag v1.2.0
  git push origin v1.2.0
```

If you see a mismatch error, fix `package.json` and re-run before continuing.

#### 4. Commit the version bump

```bash
git add artifacts/accident-diagram/package.json
git commit -m "chore: bump version to 1.2.0"
git push
```

#### 5. Tag and push — this starts the release

```bash
git tag v1.2.0
git push origin v1.2.0
```

The Actions workflow starts automatically. Monitor it in the **Actions** tab.

---

### Triggering a release manually (without a tag)

The workflow also supports `workflow_dispatch`. Go to **Actions → Publish GitHub Release → Run workflow**, enter the version (e.g. `1.2.0`), and click **Run workflow**. The `check-version` job still verifies `package.json` matches, so complete steps 1–4 above first.

This is useful for re-publishing a release after a failed run without touching the tag.

---

### What the workflow does with the version

- **`check-version`** resolves the target version from the pushed tag or the manual `version` input, then verifies it matches `artifacts/accident-diagram/package.json`. The build will not start if they differ.
- **electron-builder** receives the version so the installer filename and the app's About screen both reflect the release version.
- The GitHub Release title is set to `Crash Scene Diagram Tool v<version>`.

### If something goes wrong

If a build fails mid-run (not a version mismatch) and you need to re-run:

1. Fix the underlying problem and push the fix to `main`.
2. Use **Actions → Publish GitHub Release → Run workflow** with the same version to re-trigger without touching the tag.

Only delete and re-push a tag if the tag itself points to the wrong commit.
