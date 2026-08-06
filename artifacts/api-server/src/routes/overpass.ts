import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Server-side proxy for Overpass API — avoids browser CORS/CSP restrictions
router.get("/overpass", async (req, res) => {
  const query = req.query.data as string | undefined;
  if (!query) {
    res.status(400).json({ error: "Missing 'data' query parameter" });
    return;
  }

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
  ];

  let lastError = "unknown";
  for (const base of endpoints) {
    try {
      const url = `${base}?data=${encodeURIComponent(query)}`;
      const upstream = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: {
          "Accept": "*/*",
          "User-Agent": "AccidentDiagramTool/1.0",
        },
      });
      if (!upstream.ok) {
        lastError = `HTTP ${upstream.status} from ${base}`;
        continue;
      }
      const data = await upstream.json();
      res.json(data);
      return;
    } catch (e) {
      lastError = String(e);
    }
  }

  res.status(502).json({ error: `All Overpass endpoints failed. Last: ${lastError}` });
});

export default router;
