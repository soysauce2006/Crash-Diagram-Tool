# Crash Scene Diagram Tool

A desktop and browser-based accident reconstruction diagram tool for law enforcement, investigators, and insurance professionals. Draw crash scenes with roads, vehicles, measurements, and annotations — then export to PNG or PDF.

![Crash Scene Diagram Tool](https://img.shields.io/badge/platform-Windows%20%7C%20Web-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Drag-and-drop canvas** — place vehicles, road elements, skid marks, pedestrians, and more
- **Map backgrounds** — search any address and stitch live OpenStreetMap tiles onto the canvas
- **Auto road generation** — roads are automatically drawn from OSM data when a map is applied
- **Measurements** — add dimension lines with real-world units
- **Undo / redo** — full history stack
- **Export** — save diagrams as PNG or PDF
- **Two deployment modes** — Windows `.exe` desktop app or self-hosted web server

---

## Downloads

Pre-built releases are produced by GitHub Actions on every push to `main`.

| Package | How to get it |
|---------|---------------|
| **Windows installer** (`.exe`) | Actions → `Build Electron (Windows)` → Artifacts |
| **Web server zip** | Actions → `Build Web App` → Artifacts |

> Stable releases will appear under [Releases](../../releases) once tagged.

---

## Running the Windows App

1. Download `Crash Scene Diagram Tool Setup x.x.x.exe` from the Actions artifacts.
2. Run the installer — Windows may show a SmartScreen warning for unsigned builds; click **More info → Run anyway**.
3. The app opens directly. No internet account required; map tiles load over HTTPS.

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
      lib/                # Road generation, rendering, utilities
  api-server/             # Express proxy for Overpass API (browser mode)
```

**Map tiles** are fetched directly from `tile.openstreetmap.org`. In the Electron app, a `webRequest` interceptor injects a valid `Referer` header to satisfy OSM's tile policy.

**Road data** comes from the [Overpass API](https://overpass-api.de/). Three mirrors are raced in parallel (`z.overpass-api.de`, `overpass-api.de`, `overpass.kumi.systems`) and the first successful response wins. In Electron this runs in the main process (no CORS); in the browser it goes through the bundled Express proxy.

---

## CI / GitHub Actions

| Workflow | Trigger | Runner | Output |
|----------|---------|--------|--------|
| `build-electron.yml` | push to `main` | Ubuntu (Vite) → Windows (electron-builder) | `Crash Scene Diagram Tool Setup x.x.x.exe` |
| `build-webapp.yml` | push to `main` | Ubuntu | `crash-diagram-webapp.zip` |

The Electron workflow uses a two-job structure: Vite builds on Ubuntu (where Rollup native binaries are available), uploads the artifact, then the Windows job downloads it and runs electron-builder.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Map shows 403 / tiles don't load (desktop) | Rebuild with the latest release — the Electron `webRequest` header fix is required |
| "Could not load road data" | The app needs outbound HTTPS to `overpass-api.de`. Check firewall / VPN |
| Port already in use (web server) | `PORT=8081 npm start` |
| SmartScreen blocks installer | Click **More info → Run anyway** (build is unsigned) |
| Page not found after Nginx setup | Ensure `proxy_pass` URL ends with `/` |

---

## License

MIT — see [LICENSE](LICENSE) for details.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [ODbL](https://opendatacommons.org/licenses/odbl/).
