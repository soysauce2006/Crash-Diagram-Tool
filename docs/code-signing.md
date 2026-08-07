# Windows Code-Signing Certificate — Setup Guide

This guide walks through purchasing a Windows code-signing certificate, converting it to the format electron-builder expects, and storing it so GitHub Actions can sign every release automatically.

---

## Why this matters

Without a signed installer, Windows SmartScreen blocks the `.exe` with a "Windows protected your PC" warning. Users must click **More info → Run anyway** to proceed. A signed installer from a trusted CA removes this friction entirely.

---

## 1. Choose a certificate type

| Type | SmartScreen behaviour | Identity check | Typical price |
|------|----------------------|----------------|---------------|
| **OV (Organisation Validation)** | Warning disappears after the binary accumulates enough download reputation | Verifies your company name | ~$100–$300 / yr |
| **EV (Extended Validation)** | Warning disappears **immediately** on first run | Stricter identity check + hardware token required | ~$300–$600 / yr |

**Recommendation:** EV for the best user experience; OV is fine for internal/limited-distribution tools while you build reputation.

---

## 2. Purchase the certificate

Recommended certificate authorities:

- **Sectigo** — https://sectigo.com/ssl-certificates-tls/code-signing
- **DigiCert** — https://www.digicert.com/signing/code-signing-certificates
- **GlobalSign** — https://www.globalsign.com/en/code-signing-certificate

During purchase you will need to:

1. Prove company identity (articles of incorporation, DUNS number, or equivalent — varies by CA and certificate type).
2. For **EV certificates**: the CA ships a USB hardware security token (HSM). The private key lives on the token and cannot be exported. Skip to the [EV token workflow](#ev-certificate-hardware-token) section below.
3. For **OV certificates**: the CA issues a `.pfx` / `.p12` file protected by a password you choose.

---

## 3. Export the certificate as a Base64-encoded PFX (OV)

> **EV token holders:** skip this section — see [EV certificate (hardware token)](#ev-certificate-hardware-token) below.

### On Windows (via Certificate Manager)

1. Press **Win + R**, type `certmgr.msc`, press Enter.
2. Expand **Personal → Certificates**.
3. Right-click the code-signing certificate → **All Tasks → Export…**
4. Select **Yes, export the private key**.
5. Choose **Personal Information Exchange (.PFX)**, check **Include all certificates in the certification path**.
6. Set a strong password — you will store this as `WIN_CSC_KEY_PASSWORD`.
7. Save the file, e.g. `codesign.pfx`.

### On macOS / Linux (via openssl)

If your CA issued a `.p12` file, you can re-export it as a password-protected PFX directly:

```bash
# Replace YOUR_PASSWORD with the password you want to use for WIN_CSC_KEY_PASSWORD
openssl pkcs12 -in codesign.p12 -out codesign-protected.pfx \
  -export -passout pass:YOUR_PASSWORD
```

If you have a certificate (`.crt`) and private key (`.key`) as separate files:

```bash
openssl pkcs12 -export \
  -in codesign.crt -inkey codesign.key \
  -out codesign-protected.pfx \
  -passout pass:YOUR_PASSWORD
```

### Encode the PFX as Base64

**Linux:**

```bash
base64 codesign-protected.pfx | tr -d '\n' > codesign.pfx.b64
cat codesign.pfx.b64
```

**macOS:**

```bash
base64 -i codesign-protected.pfx | tr -d '\n' > codesign.pfx.b64
cat codesign.pfx.b64
```

**Windows PowerShell:**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("codesign-protected.pfx")) | Out-File codesign.pfx.b64 -Encoding ascii
```

The entire output is a single long string with no line breaks — copy it in full.

---

## 4. Store the secrets in GitHub Actions

1. In your GitHub repository, go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** for each of the two secrets below:

| Secret name | Value |
|-------------|-------|
| `WIN_CSC_LINK` | The Base64 string from the previous step (the entire encoded PFX) |
| `WIN_CSC_KEY_PASSWORD` | The password you set when exporting the PFX |

> **Important:** `WIN_CSC_LINK` must be the raw Base64 string — not a file path, not a URL. electron-builder detects the `data:` prefix automatically when the value starts with the Base64 content.

After both secrets are saved, the next push to `main` (or a manual workflow dispatch) will produce a signed installer.

---

## 5. Verify the signature

After the workflow completes:

1. Download the `.exe` from the Actions artifacts.
2. Right-click → **Properties → Digital Signatures** tab.
3. You should see your company name listed as the signer.
4. On first launch, SmartScreen should no longer block the installer (EV) or should clear after a small number of installs (OV).

You can also verify from the command line:

```powershell
# PowerShell
Get-AuthenticodeSignature "Crash Scene Diagram Tool Setup 1.0.0.exe"
```

Expected output:

```
SignerCertificate : [Subject: CN=Your Company Name, ...]
Status            : Valid
```

---

## EV certificate (hardware token)

EV certificates store the private key on a physical USB token (e.g. SafeNet eToken, YubiKey). The key cannot be exported, so the Base64 PFX approach above does not apply.

For EV signing in CI you have two options:

### Option A — Use a cloud HSM / signing service (recommended for CI)

Services like **DigiCert ONE** (formerly KeyLocker), **SSL.com eSigner**, or **Sectigo Remote Signing** let you sign binaries from GitHub Actions without a physical token.

- DigiCert ONE: https://www.digicert.com/signing/one — uses `electron-builder`'s `signtoolPath` or a custom `sign` hook
- SSL.com eSigner: https://www.ssl.com/esigner/ — provides a CLI that wraps `signtool.exe`

Follow the provider's GitHub Actions integration guide and store the credentials they issue as GitHub Actions secrets.

### Option B — Sign locally, upload the signed binary

1. Build the unsigned installer in CI (omit `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`).
2. Download the artifact to the machine where the EV token is plugged in.
3. Sign with `signtool.exe`:

```powershell
signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a "Crash Scene Diagram Tool Setup 1.0.0.exe"
```

4. Upload the signed `.exe` to the GitHub Release manually.

---

## Automated signature verification in CI

Both workflows run a PowerShell step immediately after `electron:build` that calls `Get-AuthenticodeSignature` on the produced `.exe` and fails the job if the result is not `Valid`:

```powershell
$exe = Get-ChildItem -Path "artifacts/accident-diagram/dist/electron-dist/*.exe" | Select-Object -First 1
$sig = Get-AuthenticodeSignature $exe.FullName
Write-Host "Status: $($sig.Status)"
if ($sig.Status -ne "Valid") {
    Write-Error "Installer is NOT signed (Status: $($sig.Status))."
    exit 1
}
Write-Host "✅ Signature verified: $($sig.SignerCertificate.Subject)"
```

`Get-AuthenticodeSignature` returns one of the following `Status` values:

| Status | Meaning |
|--------|---------|
| `Valid` | Signature present and trusted — build proceeds |
| `NotSigned` | `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` were absent or empty; electron-builder skipped signing silently |
| `UnknownError` | Certificate chain could not be validated (e.g. self-signed or expired cert) |
| `HashMismatch` | File was modified after signing |

Any status other than `Valid` fails the workflow before the artifact is uploaded, blocking unsigned installers from reaching the GitHub Release.

---

## How the workflows use these secrets

Both CI workflows pass the secrets to `electron-builder` as environment variables:

| Workflow | Trigger | Signs? |
|----------|---------|--------|
| `.github/workflows/build-electron.yml` | push to `main` | ✅ yes |
| `.github/workflows/release.yml` | push of a `v*` tag | ✅ yes |

```yaml
env:
  WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
  WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
  CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

In electron-builder 26.x the Windows signing path reads `WIN_CSC_KEY_PASSWORD` first, falling back to the generic `CSC_KEY_PASSWORD`. Both are set from the same GitHub Actions secret so either lookup succeeds regardless of which code path runs.

No additional configuration is needed in `package.json`. The `win.signingHashAlgorithms: ["sha256"]` already set in `artifacts/accident-diagram/package.json` ensures SHA-256 is used, which is required by Microsoft's Authenticode policy.

If either secret is absent or empty, electron-builder skips signing and produces an unsigned installer without failing the build.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build still unsigned after adding secrets | Secret value has line breaks or whitespace | Re-encode the PFX ensuring no newlines (`tr -d '\n'` on Linux/macOS; `Out-File -Encoding ascii` on Windows) |
| `Error: Certificate file not found` | `WIN_CSC_LINK` is a file path, not Base64 | Encode the file and store the Base64 string |
| `Error: Invalid password` | `WIN_CSC_KEY_PASSWORD` does not match the PFX | Re-export the PFX with a known password and update both secrets |
| SmartScreen still shows after signing (OV) | OV needs download reputation — it clears automatically | Wait for installs to accumulate, or upgrade to an EV certificate |
| `signtool` error during local EV signing | Token driver not installed | Install the SafeNet/Entrust driver that shipped with the token |
