import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Overpass API mirrors — raced in parallel; first successful response wins
const ENDPOINTS = [
  "https://z.overpass-api.de/api/interpreter",   // CDN-fronted, usually fastest
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Server-side proxy for Overpass API — avoids browser CORS restrictions.
// Uses Promise.any so a slow endpoint doesn't block a fast one.
router.get("/overpass", async (req, res) => {
  const query = req.query.data as string | undefined;
  if (!query) {
    res.status(400).json({ error: "Missing 'data' query parameter" });
    return;
  }

  const fetchEndpoint = async (base: string): Promise<unknown> => {
    const url = `${base}?data=${encodeURIComponent(query)}`;
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "*/*",
        "User-Agent": "AccidentDiagramTool/1.0",
      },
    });
    if (!upstream.ok) {
      throw new Error(`HTTP ${upstream.status} from ${base}`);
    }
    const data = await upstream.json() as { elements?: unknown[] };
    // Some Overpass servers return 200 with a runtime-error payload
    if (!Array.isArray((data as any).elements)) {
      throw new Error(`Unexpected payload from ${base}`);
    }
    return data;
  };

  try {
    // Promise.any resolves as soon as any endpoint succeeds;
    // only rejects if every endpoint fails (AggregateError).
    const data = await Promise.any(ENDPOINTS.map(fetchEndpoint));
    res.json(data);
  } catch (err) {
    const msg = err instanceof AggregateError
      ? err.errors.map(String).join("; ")
      : String(err);
    res.status(502).json({ error: `All Overpass endpoints failed: ${msg}` });
  }
});

export default router;
