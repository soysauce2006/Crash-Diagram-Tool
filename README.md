# Crash Scene Diagram Tool

A desktop and browser-based accident reconstruction diagram tool for law enforcement, investigators, and insurance professionals. Draw crash scenes with roads, vehicles, measurements, and annotations — then export to JPEG or PDF.

![Version](https://img.shields.io/badge/version-1.1.0-blue) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Drag-and-drop canvas** — place vehicles, road elements, skid marks, pedestrians, and more
- **Road elements** — straight roads, highways, curves, intersections, crosswalks, lane dividers, and medians
- **Accident markers** — point of impact, skid marks, debris, measurements, and text labels
- **Element properties** — adjust size, rotation, fill color, opacity, and lane count per element
- **Undo / redo** — full history stack (Ctrl+Z / Ctrl+Shift+Z)
- **Keyboard shortcuts** — Delete to remove, Ctrl+D to duplicate, Escape to cancel
- **Case information** — attach case number, date/time, officer, weather, road conditions, and notes
- **Export** — save diagrams as JPEG or PDF with case header baked in
- **Two deployment modes** — Windows `.exe` desktop app or self-hosted web server

---

## Downloads

| Package | How to get it |
|---------|---------------|
| **Windows installer** (`.exe`) | [Releases](../../releases) → latest release → Assets |
| **Web server zip** | [Releases](../../releases) → latest release → Assets |

Releases are published automatically when a `v*` tag is pushed (e.g. `v1.0.0`). Each release contains both the Windows installer and the self-hosted web server package.

---

## Running the Windows App

1. Download `Crash Scene Diagram Tool Setup x.x.x.exe` from the latest release.
2. Run the installer — Windows may show a SmartScreen warning for unsigned builds; click **More info → Run anyway**.
3. The app opens directly. No internet connection or account required.

---

## Running the Web Server

Requires **Node.js 18+** — https://nodejs.org

```bash
# 1. Unzip the package
unzip crash-diagram-webapp.zip
cd crash-diagram-webapp

# 2. Install the one dependency (Express)
npm install

# 3. Start
npm start
```

Open **http://localhost:3000** in any modern browser.

### Change the port

```bash
PORT=8080 npm start          # Linux / macOS
set PORT=8080 && npm start   # Windows CMD
$env:PORT=8080; npm start    # Windows PowerShell
```

### Nginx reverse proxy (optional)

```nginx
location /diagrams/ {
    proxy_pass         http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header   Host $host;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection keep-alive;
    proxy_cache_bypass $http_upgrade;
}
```

### Keep it running with systemd (Linux)

```ini
# /etc/systemd/system/crash-diagram.service
[Unit]
Description=Crash Scene Diagram Tool
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/crash-diagram/server.js
WorkingDirectory=/opt/crash-diagram
Restart=always
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now crash-diagram
```

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 9+

### Install

```bash
pnpm install
```

### Run in browser (dev server)

```bash
pnpm --filter @workspace/accident-diagram run dev
```

### Run as Electron desktop app (dev)

```bash
pnpm --filter @workspace/accident-diagram run electron:dev
```

### Build

| Command | Output |
|---------|--------|
| `pnpm --filter @workspace/accident-diagram run build` | Vite web build → `dist/` |
| `pnpm --filter @workspace/accident-diagram run build:electron` | Vite build for Electron → `dist/electron-app/` |
| `pnpm --filter @workspace/accident-diagram run electron:build` | Packages Windows `.exe` via electron-builder |

---

## Architecture

```
artifacts/
  accident-diagram/       # React + Vite + Konva frontend
    electron/             # Electron main process + preload
    src/
      components/         # UI components (toolbar, panels, modals)
      lib/                # Element definitions, rendering, utilities
  api-server/             # Express API server (health check)
```

The frontend is a single-page React app using [Konva](https://konvajs.org/) for the canvas. Elements are plain data objects — no external services are required at runtime.

---

## CI / GitHub Actions

| Workflow | Trigger | Runner | Output |
|----------|---------|--------|--------|
| `build-electron.yml` | push to `main` | Ubuntu (Vite) → Windows (electron-builder) | `Crash Scene Diagram Tool Setup x.x.x.exe` |
| `release.yml` | push of `v*` tag | Ubuntu + Windows | GitHub Release with installer + webapp zip |

The Electron workflow uses a two-job structure: Vite builds on Ubuntu (where Rollup native binaries are available), uploads the artifact, then the Windows job downloads it and runs electron-builder.

The Windows job reads `WIN_CSC_LINK` (Base64-encoded PFX) and `WIN_CSC_KEY_PASSWORD` from GitHub Actions secrets to sign the installer. If the secrets are absent the build still succeeds but the installer is unsigned.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| SmartScreen blocks installer | Click **More info → Run anyway** (build is unsigned) |
| Port already in use (web server) | `PORT=8081 npm start` |
| Page not found after Nginx setup | Ensure `proxy_pass` URL ends with `/` |
| Auto-updater prompt doesn't appear | Push a new `v*` tag — the updater only fires when a newer GitHub Release exists |

---

## License

MIT — see [LICENSE](LICENSE) for details.
