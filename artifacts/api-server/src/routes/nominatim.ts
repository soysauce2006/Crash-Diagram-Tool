import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Proxy Nominatim geocoding requests server-side to avoid CORS and OSM
// rate-limiting of Replit's shared egress IPs.
router.get("/nominatim", async (req, res) => {
  const q = req.query.q as string | undefined;
  if (!q) {
    res.status(400).json({ error: "Missing 'q' parameter" });
    return;
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent":       "CrashSceneDiagramTool/1.0 (accident reconstruction)",
        "Accept-Language":  "en-US,en",
        "Accept":           "application/json",
        "Referer":          "https://www.openstreetmap.org/",
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream: ${upstream.status}` });
      return;
    }

    const data = await upstream.json();
    res.set("Cache-Control", "public, max-age=3600").json(data);
  } catch (err) {
    res.status(502).json({ error: `Nominatim fetch failed: ${String(err)}` });
  }
});

export default router;
