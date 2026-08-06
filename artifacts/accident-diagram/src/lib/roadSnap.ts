const TILE_PX = 256;

function lon2px(lon: number, zoom: number): number {
  return (lon + 180) / 360 * Math.pow(2, zoom) * TILE_PX;
}

function lat2px(lat: number, zoom: number): number {
  const rad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, zoom) * TILE_PX;
}

function px2lon(px: number, zoom: number): number {
  return px / (Math.pow(2, zoom) * TILE_PX) * 360 - 180;
}

function px2lat(py: number, zoom: number): number {
  const n = Math.PI - 2 * Math.PI * py / (Math.pow(2, zoom) * TILE_PX);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Fetch OSM highway geometry and convert to canvas pixel coordinates. */
export async function fetchRoadPolylines(
  centerLat: number,
  centerLng: number,
  zoom: number,
  canvasW: number,
  canvasH: number,
): Promise<[number, number][][]> {
  const centerPx = lon2px(centerLng, zoom);
  const centerPy = lat2px(centerLat, zoom);

  const west  = px2lon(centerPx - canvasW / 2, zoom);
  const east  = px2lon(centerPx + canvasW / 2, zoom);
  const north = px2lat(centerPy - canvasH / 2, zoom);
  const south = px2lat(centerPy + canvasH / 2, zoom);

  const query = `[out:json][timeout:15];way["highway"](${south},${west},${north},${east});out geom;`;
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!resp.ok) throw new Error(`Overpass error ${resp.status}`);
  const data = await resp.json();

  const topLeftPx = centerPx - canvasW / 2;
  const topLeftPy = centerPy - canvasH / 2;

  return (data.elements as { geometry?: { lat: number; lon: number }[] }[])
    .filter(el => (el.geometry?.length ?? 0) >= 2)
    .map(el =>
      el.geometry!.map(node => [
        lon2px(node.lon, zoom) - topLeftPx,
        lat2px(node.lat, zoom) - topLeftPy,
      ] as [number, number]),
    );
}

/**
 * Find the nearest point on any road segment within `thresholdScreenPx` screen
 * pixels (divided by zoom to get canvas-space distance). Returns null if nothing
 * is close enough.
 */
export function snapToRoads(
  x: number,
  y: number,
  polylines: [number, number][][],
  thresholdScreenPx: number,
  zoom: number,
): { x: number; y: number } | null {
  const threshold = thresholdScreenPx / zoom;
  let best: { x: number; y: number } | null = null;
  let bestDist = threshold;

  for (const polyline of polylines) {
    for (let i = 0; i < polyline.length - 1; i++) {
      const [ax, ay] = polyline[i];
      const [bx, by] = polyline[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      const nx = ax + t * dx;
      const ny = ay + t * dy;
      const dist = Math.hypot(x - nx, y - ny);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: nx, y: ny };
      }
    }
  }
  return best;
}
