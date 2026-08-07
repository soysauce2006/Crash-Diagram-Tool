import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Proxy OSM tile requests server-side so the browser never hits tile.openstreetmap.org
// directly. Avoids rate-limiting and Referer/CORS issues from shared Replit IPs.
router.get("/tiles/:z/:x/:y", async (req, res) => {
  const { z, x } = req.params;
  // ":y" captures the full filename including ".png" — strip the extension.
  const y = req.params.y.replace(/\.png$/i, "");

  // Basic input validation — prevent path traversal or bogus requests.
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    res.status(400).send("Invalid tile coordinates");
    return;
  }

  const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const upstream = await fetch(tileUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": "CrashSceneDiagramTool/1.0 (accident reconstruction)",
        "Referer":    "https://www.openstreetmap.org/",
        "Accept":     "image/png,image/*",
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res
      .set("Content-Type", "image/png")
      .set("Cache-Control", "public, max-age=86400") // tiles are stable; cache 24 h
      .send(buf);
  } catch (err) {
    res.status(502).send(`Tile fetch failed: ${String(err)}`);
  }
});

export default router;
