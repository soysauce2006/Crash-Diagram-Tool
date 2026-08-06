# Crash Scene Diagram Tool — Web Server Setup

## Requirements

- **Node.js 18 or newer** — https://nodejs.org  
- No database. No cloud account. Just Node.

---

## Quick start (any OS)

```bash
# 1. Unzip the package
unzip crash-diagram-webapp.zip
cd crash-diagram-webapp

# 2. Install the one dependency (Express)
npm install

# 3. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

---

## Running on a different port

```bash
PORT=8080 npm start        # Linux / macOS
set PORT=8080 && npm start # Windows Command Prompt
$env:PORT=8080; npm start  # Windows PowerShell
```

---

## Putting it behind Nginx (optional)

If you want to serve it at `https://yourdomain.com/diagrams`, add this block
to your Nginx config:

```nginx
location /diagrams/ {
    proxy_pass         http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection keep-alive;
    proxy_set_header   Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Then restart Nginx and visit `https://yourdomain.com/diagrams/`.

---

## Keeping it running (Linux systemd)

Create `/etc/systemd/system/crash-diagram.service`:

```ini
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

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Port already in use" | Change the port: `PORT=8081 npm start` |
| Map roads say "could not load" | The server needs outbound HTTPS to `overpass-api.de`. Check your firewall. |
| Page not found after Nginx setup | Make sure the `proxy_pass` URL ends with `/` |
