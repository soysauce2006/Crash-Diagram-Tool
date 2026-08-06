import type { CanvasElement } from './elements';

const TILE_PX = 256;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OsmNode { lat: number; lon: number; }
export interface OsmWay { geometry?: OsmNode[]; }

// ---------------------------------------------------------------------------
// Internal helper — converts a raw Overpass response to canvas-pixel polylines
// ---------------------------------------------------------------------------
function extractPolylines(
  data: { elements: OsmWay[] },
  topLeftPx: number,
  topLeftPy: number,
  zoom: number,
): [number, number][][] {
  return data.elements
    .filter(el => (el.geometry?.length ?? 0) >= 2)
    .map(el =>
      el.geometry!.map(node => [
        lon2px(node.lon, zoom) - topLeftPx,
        lat2px(node.lat, zoom) - topLeftPy,
      ] as [number, number]),
    );
}

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
  // Must match the integer zoom used in stitchMapTiles tile URLs
  zoom = Math.floor(zoom);
  const centerPx = lon2px(centerLng, zoom);
  const centerPy = lat2px(centerLat, zoom);

  const west  = px2lon(centerPx - canvasW / 2, zoom);
  const east  = px2lon(centerPx + canvasW / 2, zoom);
  const north = px2lat(centerPy - canvasH / 2, zoom);
  const south = px2lat(centerPy + canvasH / 2, zoom);

  // Limit to driveable road types — excludes footpaths, steps, etc. which add
  // bulk without being useful for snap; [timeout:25] gives Overpass enough time.
  const hwFilter = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|road';
  const query = `[out:json][timeout:25];way["highway"~"^(${hwFilter})$"](${south},${west},${north},${east});out geom;`;

  const topLeftPx = centerPx - canvasW / 2;
  const topLeftPy = centerPy - canvasH / 2;

  // In Electron the main process handles Overpass directly (no CORS).
  // In the browser we route through the Express proxy.
  const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI) as
    | { overpass: (q: string) => Promise<{ elements: OsmWay[] }> }
    | undefined;

  if (electronAPI) {
    const data = await electronAPI.overpass(query);
    return extractPolylines(data, topLeftPx, topLeftPy, zoom);
  }

  const proxyUrl = `${import.meta.env.BASE_URL}api/overpass?data=${encodeURIComponent(query)}`;
  const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(40_000) });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error ?? `Proxy error ${resp.status}`);
  }
  const data: { elements: OsmWay[] } = await resp.json();
  if (!Array.isArray(data.elements)) throw new Error('Unexpected response from road proxy');

  return extractPolylines(data, topLeftPx, topLeftPy, zoom);
}

/**
 * Convert OSM road polylines (already in canvas-pixel coordinates) into
 * `straight-road` canvas elements.  One element is produced per road way
 * (polyline), spanning start → end with curvature approximated from the
 * midpoint perpendicular deviation.
 *
 * @param makeId  ID factory (pass the app's `nextId()` function)
 */
export function generateRoadElements(
  polylines: [number, number][][],
  makeId: () => string,
): CanvasElement[] {
  const results: CanvasElement[] = [];

  for (const poly of polylines) {
    if (poly.length < 2) continue;

    const [x0, y0] = poly[0];
    const [x1, y1] = poly[poly.length - 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 20) continue; // too short to be worth drawing

    const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

    // Perpendicular deviation of the way's midpoint from the straight line
    const midIdx = Math.floor(poly.length / 2);
    const [mx, my] = poly[midIdx];
    const nx = -dy / len; // unit normal
    const ny =  dx / len;
    const d = (mx - (x0 + x1) / 2) * nx + (my - (y0 + y1) / 2) * ny;
    // Convert to our curvature parameter: midpoint offset = curvature * w * 0.5
    const curvature = Math.max(-0.8, Math.min(0.8, -2 * d / len));

    const w = len;
    const h = 60; // default 2-lane road height

    // Back-calculate top-left (x,y) so the rotated element's visual centre
    // sits at the midpoint of the start→end line.
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const θ = rotation * Math.PI / 180;
    const x = cx - (w / 2) * Math.cos(θ) + (h / 2) * Math.sin(θ);
    const y = cy - (w / 2) * Math.sin(θ) - (h / 2) * Math.cos(θ);

    results.push({
      id: makeId(),
      type: 'straight-road',
      x, y,
      width: w,
      height: h,
      rotation,
      curvature: Math.abs(curvature) < 0.04 ? 0 : curvature,
      fill: '#475569',
      opacity: 0.85,
      label: '',
      lanes: 2,
    });
  }

  return results;
}

/**
 * Find the nearest point on any road segment within `thresholdScreenPx` screen
 * pixels (divided by zoom to get canvas-space distance).
 * Returns position + rotation (degrees, matching the road direction) or null if
 * nothing is close enough.
 */
export function snapToRoads(
  x: number,
  y: number,
  polylines: [number, number][][],
  thresholdScreenPx: number,
  zoom: number,
): { x: number; y: number; rotation: number } | null {
  const threshold = thresholdScreenPx / zoom;
  let best: { x: number; y: number; rotation: number } | null = null;
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
        // Road angle in degrees — Konva rotation is clockwise from the positive x-axis
        const rotation = Math.atan2(dy, dx) * (180 / Math.PI);
        best = { x: nx, y: ny, rotation };
      }
    }
  }
  return best;
}
