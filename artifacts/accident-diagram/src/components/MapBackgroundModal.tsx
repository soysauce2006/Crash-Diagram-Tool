import { useState, useCallback, useEffect, useRef } from 'react';
import { MapPin, Search, X, Check, Loader } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_SIZE = 256;

function lon2tileFrac(lon: number, zoom: number): number {
  return (lon + 180) / 360 * Math.pow(2, zoom);
}

function lat2tileFrac(lat: number, zoom: number): number {
  const rad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, zoom);
}

async function stitchMapTiles(
  lat: number, lon: number, zoom: number,
  width: number, height: number,
): Promise<string> {
  const centerX = lon2tileFrac(lon, zoom);
  const centerY = lat2tileFrac(lat, zoom);

  const centerPixelX = centerX * TILE_SIZE;
  const centerPixelY = centerY * TILE_SIZE;

  const topLeftPixelX = centerPixelX - width / 2;
  const topLeftPixelY = centerPixelY - height / 2;

  const startTileX = Math.floor(topLeftPixelX / TILE_SIZE);
  const startTileY = Math.floor(topLeftPixelY / TILE_SIZE);
  const endTileX = Math.floor((topLeftPixelX + width - 1) / TILE_SIZE);
  const endTileY = Math.floor((topLeftPixelY + height - 1) / TILE_SIZE);

  const offsetX = -(topLeftPixelX - startTileX * TILE_SIZE);
  const offsetY = -(topLeftPixelY - startTileY * TILE_SIZE);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e8e0d8';
  ctx.fillRect(0, 0, width, height);

  const maxTiles = Math.pow(2, zoom);
  const promises: Promise<void>[] = [];

  for (let tx = startTileX; tx <= endTileX; tx++) {
    for (let ty = startTileY; ty <= endTileY; ty++) {
      const px = offsetX + (tx - startTileX) * TILE_SIZE;
      const py = offsetY + (ty - startTileY) * TILE_SIZE;
      const wrappedTx = ((tx % maxTiles) + maxTiles) % maxTiles;
      const tileUrl = `https://tile.openstreetmap.org/${zoom}/${wrappedTx}/${ty}.png`;

      const promise = fetch(tileUrl)
        .then(r => r.blob())
        .then(blob => {
          const objUrl = URL.createObjectURL(blob);
          return new Promise<void>(resolve => {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
              URL.revokeObjectURL(objUrl);
              resolve();
            };
            img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(); };
            img.src = objUrl;
          });
        })
        .catch(() => Promise.resolve());

      promises.push(promise);
    }
  }

  await Promise.all(promises);
  return canvas.toDataURL('image/jpeg', 0.92);
}

interface Props {
  onClose: () => void;
  onApply: (dataUrl: string) => void;
  canvasWidth: number;
  canvasHeight: number;
}

export function MapBackgroundModal({ onClose, onApply, canvasWidth, canvasHeight }: Props) {
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [zoom, setZoom] = useState(17);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [39.5, -98.35],
      zoom: 4,
      zoomControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    map.setView([location.lat, location.lon], zoom);
    L.marker([location.lat, location.lon]).addTo(map);
  }, [location, zoom]);

  const search = useCallback(async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setError('');
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en-US,en' } }
      );
      const data = await resp.json();
      if (!data.length) { setError('Address not found. Try a more specific address.'); return; }
      const { lat, lon, display_name } = data[0];
      setLocation({ lat: parseFloat(lat), lon: parseFloat(lon), name: display_name });
    } catch {
      setError('Network error. Check your internet connection.');
    } finally {
      setGeocoding(false);
    }
  }, [address]);

  const apply = useCallback(async () => {
    if (!mapRef.current) return;
    setLoading(true);
    setError('');
    try {
      const center = mapRef.current.getCenter();
      const mapZoom = mapRef.current.getZoom();
      const dataUrl = await stitchMapTiles(center.lat, center.lng, mapZoom, canvasWidth, canvasHeight);
      onApply(dataUrl);
    } catch {
      setError('Failed to load map tiles. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [canvasWidth, canvasHeight, onApply]);

  const zoomLabel = zoom <= 14 ? 'Wide area' : zoom <= 15 ? 'Neighborhood' : zoom <= 17 ? 'Street level' : 'Intersection / close-up';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'hsl(215,28%,10%)', border: '1px solid hsl(215,25%,22%)', borderRadius: 8, width: 660, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid hsl(215,25%,18%)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: 'hsl(213,31%,91%)' }}>
            <MapPin size={16} color="#3b82f6" />
            Set Map Background
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex' }} data-testid="map-modal-close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
            Search for the accident location. The real road map from OpenStreetMap will be loaded as the canvas background. Pan and zoom the map below to frame the exact area, then click Apply.
          </p>

          {/* Search row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="prop-input"
              placeholder="e.g. 123 Main St & Oak Ave, Springfield, IL"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !geocoding && search()}
              style={{ flex: 1 }}
              data-testid="map-address-input"
            />
            <button className="toolbar-btn primary" onClick={search} disabled={geocoding || !address.trim()} data-testid="map-search-btn" style={{ minWidth: 88, gap: 5 }}>
              {geocoding ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
              {geocoding ? 'Searching' : 'Search'}
            </button>
          </div>

          {error && <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{error}</p>}

          {location && (
            <div style={{ fontSize: 12, color: '#94a3b8', background: 'hsl(215,28%,14%)', borderRadius: 4, padding: '7px 10px', lineHeight: 1.5 }}>
              <strong style={{ color: '#e2e8f0' }}>Found:</strong> {location.name}<br />
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{location.lat.toFixed(6)}, {location.lon.toFixed(6)}</span>
            </div>
          )}

          {/* Leaflet map */}
          <div
            ref={mapContainerRef}
            style={{ height: 320, borderRadius: 4, border: '1px solid hsl(215,25%,22%)', overflow: 'hidden', flexShrink: 0 }}
            data-testid="map-preview"
          />

          {/* Zoom hint */}
          <div style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Use the map above to pan/zoom to the exact scene.</span>
            <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{zoomLabel}</span>
          </div>

          {/* OSM credit */}
          <p style={{ margin: 0, fontSize: 10, color: '#475569', lineHeight: 1.4 }}>
            Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>OpenStreetMap contributors</a>. Free to use for public safety purposes.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid hsl(215,25%,18%)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button className="toolbar-btn" onClick={onClose}>Cancel</button>
          <button
            className="toolbar-btn primary"
            onClick={apply}
            disabled={loading}
            style={{ minWidth: 170 }}
            data-testid="map-apply-btn"
          >
            {loading
              ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading tiles...</>
              : <><Check size={13} /> Apply as Background</>}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
