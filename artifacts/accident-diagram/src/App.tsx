import { useState, useRef, useEffect, useCallback, cloneElement } from 'react';
import { Stage, Layer, Rect, Line, Transformer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Shield, Undo2, Redo2, ZoomIn, ZoomOut, Grid3X3, Trash2, FileDown, ImageDown, ChevronDown, ChevronRight, Map, X } from 'lucide-react';
import jsPDF from 'jspdf';
import { CanvasElement, CaseInfo, ELEMENT_DEFAULTS, PALETTE_CATEGORIES } from './lib/elements';
import { renderElement } from './lib/renderElement';
import { MapBackgroundModal } from './components/MapBackgroundModal';
import { fetchRoadPolylines, snapToRoads } from './lib/roadSnap';

const STAGE_W = 1100;
const STAGE_H = 800;
const GRID_SIZE = 30;

let counter = 0;
function nextId() { return `el-${++counter}`; }

function makeElement(type: string, x: number, y: number, labelCount: number): CanvasElement {
  const defaults = ELEMENT_DEFAULTS[type] ?? {};
  return {
    id: nextId(),
    type,
    x,
    y,
    width: defaults.width ?? 60,
    height: defaults.height ?? 40,
    rotation: 0,
    fill: defaults.fill ?? '#64748b',
    opacity: 1,
    label: type === 'text-label' ? 'Label' : `${type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ${labelCount}`,
  };
}

function GridLines({ w, h }: { w: number; h: number }) {
  const lines: JSX.Element[] = [];
  for (let x = 0; x <= w; x += GRID_SIZE) {
    lines.push(<Line key={`v${x}`} points={[x, 0, x, h]} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.4} />);
  }
  for (let y = 0; y <= h; y += GRID_SIZE) {
    lines.push(<Line key={`h${y}`} points={[0, y, w, y]} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.4} />);
  }
  return <>{lines}</>;
}

export default function App() {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);
  const [histIdx, setHistIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [labelCounts, setLabelCounts] = useState<Record<string, number>>({});
  const [caseInfo, setCaseInfo] = useState<CaseInfo>({
    caseNumber: '', date: '', time: '', location: '', officer: '', badge: '',
    weather: 'Clear', roadCondition: 'Dry', notes: '',
  });

  const [mapDataUrl, setMapDataUrl] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [mapOpacity, setMapOpacity] = useState(0.55);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState<number | null>(null);
  const [roadPolylines, setRoadPolylines] = useState<[number, number][][][]>([]);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [roadsLoading, setRoadsLoading] = useState(false);
  const [roadsError, setRoadsError] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load map data URL into a DOM Image for Konva
  useEffect(() => {
    if (!mapDataUrl) { setMapImage(null); return; }
    const img = new window.Image();
    img.onload = () => setMapImage(img);
    img.src = mapDataUrl;
  }, [mapDataUrl]);

  // Sync transformer to selected node
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (selectedId) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, elements]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        deleteSelected();
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
        if (e.key === 'd') { e.preventDefault(); duplicateSelected(); }
      }
      if (e.key === 'Escape') { setActiveTool(null); setSelectedId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const pushHistory = useCallback((els: CanvasElement[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, histIdx + 1);
      return [...trimmed, els];
    });
    setHistIdx(prev => prev + 1);
  }, [histIdx]);

  const undo = useCallback(() => {
    if (histIdx <= 0) return;
    const newIdx = histIdx - 1;
    setHistIdx(newIdx);
    setElements(history[newIdx]);
    setSelectedId(null);
  }, [histIdx, history]);

  const redo = useCallback(() => {
    if (histIdx >= history.length - 1) return;
    const newIdx = histIdx + 1;
    setHistIdx(newIdx);
    setElements(history[newIdx]);
    setSelectedId(null);
  }, [histIdx, history]);

  const updateElement = useCallback((id: string, changes: Partial<CanvasElement>) => {
    setElements(prev => {
      const next = prev.map(el => el.id === id ? { ...el, ...changes } : el);
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    setElements(prev => {
      const src = prev.find(el => el.id === selectedId);
      if (!src) return prev;
      const copy: CanvasElement = { ...src, id: nextId(), x: src.x + 20, y: src.y + 20 };
      const next = [...prev, copy];
      pushHistory(next);
      setSelectedId(copy.id);
      return next;
    });
  }, [selectedId, pushHistory]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements(prev => {
      const next = prev.filter(el => el.id !== selectedId);
      pushHistory(next);
      return next;
    });
    setSelectedId(null);
  }, [selectedId, pushHistory]);

  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const target = e.target;
    const isStageOrBg = target === e.currentTarget || target.name() === 'stage-bg';
    if (!activeTool) {
      if (isStageOrBg) setSelectedId(null);
      return;
    }
    // When a tool is active, place on click regardless of what was hit
    e.cancelBubble = true;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const x = (pos.x - stagePos.x) / zoom;
    const y = (pos.y - stagePos.y) / zoom;
    const count = (labelCounts[activeTool] ?? 0) + 1;
    const el = makeElement(activeTool, x, y, count);
    const next = [...elements, el];
    setElements(next);
    pushHistory(next);
    setLabelCounts(prev => ({ ...prev, [activeTool]: count }));
    setSelectedId(el.id);
    setActiveTool(null);
  }, [activeTool, elements, stagePos, zoom, pushHistory, labelCounts]);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.07;
    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clamped = Math.max(0.2, Math.min(4, newScale));
    setZoom(clamped);
    setStagePos({
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    });
  }, [zoom, stagePos]);

  const handleStageDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (e.target !== stageRef.current) return;
    setStagePos({ x: e.target.x(), y: e.target.y() });
  }, []);

  const clearCanvas = () => {
    if (!window.confirm('Clear all elements from the canvas?')) return;
    setElements([]);
    setSelectedId(null);
    pushHistory([]);
  };

  const zoomTo = (factor: number) => {
    setZoom(prev => Math.max(0.2, Math.min(4, prev * factor)));
  };

  const resetZoom = () => {
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
  };

  const bringToFront = () => {
    if (!selectedId) return;
    setElements(prev => {
      const el = prev.find(e => e.id === selectedId);
      if (!el) return prev;
      const next = [...prev.filter(e => e.id !== selectedId), el];
      pushHistory(next);
      return next;
    });
  };

  const sendToBack = () => {
    if (!selectedId) return;
    setElements(prev => {
      const el = prev.find(e => e.id === selectedId);
      if (!el) return prev;
      const next = [el, ...prev.filter(e => e.id !== selectedId)];
      pushHistory(next);
      return next;
    });
  };

  const exportJpeg = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataURL = stage.toDataURL({ mimeType: 'image/jpeg', quality: 0.95 });
    const link = document.createElement('a');
    link.download = `${caseInfo.caseNumber || 'diagram'}.jpg`;
    link.href = dataURL;
    link.click();
  };

  const exportPdf = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataURL = stage.toDataURL({ mimeType: 'image/jpeg', quality: 0.95, pixelRatio: 2 });
    const pageW = STAGE_W + 40;
    const pageH = STAGE_H + 90;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [pageW, pageH] });

    doc.setFillColor(15, 25, 35);
    doc.rect(0, 0, pageW, 75, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('CRASH SCENE DIAGRAM', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 200, 220);
    const headerItems = [
      `Case #: ${caseInfo.caseNumber || 'N/A'}`,
      `Date: ${caseInfo.date || 'N/A'}`,
      `Time: ${caseInfo.time || 'N/A'}`,
      `Location: ${caseInfo.location || 'N/A'}`,
      `Officer: ${caseInfo.officer || 'N/A'}`,
      `Badge: ${caseInfo.badge || 'N/A'}`,
      `Weather: ${caseInfo.weather}`,
      `Road: ${caseInfo.roadCondition}`,
    ];
    const col1 = headerItems.slice(0, 4);
    const col2 = headerItems.slice(4);
    col1.forEach((t, i) => doc.text(t, 20, 32 + i * 10));
    col2.forEach((t, i) => doc.text(t, pageW / 2, 32 + i * 10));
    doc.addImage(dataURL, 'JPEG', 20, 80, STAGE_W, STAGE_H);
    if (caseInfo.notes) {
      doc.setFontSize(8);
      doc.setTextColor(100, 120, 140);
      doc.text(`Notes: ${caseInfo.notes}`, 20, pageH - 6, { maxWidth: pageW - 40 });
    }
    doc.save(`${caseInfo.caseNumber || 'diagram'}.pdf`);
  };

  const selectedEl = elements.find(e => e.id === selectedId) ?? null;

  const canUndo = histIdx > 0;
  const canRedo = histIdx < history.length - 1;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'hsl(215,28%,8%)', color: 'hsl(213,31%,91%)' }}>
      {/* TOOLBAR */}
      <header style={{ background: 'hsl(215,28%,9%)', borderBottom: '1px solid hsl(215,25%,18%)' }}
        className="h-12 flex items-center px-3 gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 mr-4">
          <Shield size={18} className="text-blue-400" />
          <span className="font-bold text-sm tracking-wide" style={{ fontFamily: 'system-ui' }}>
            CRASH SCENE DIAGRAM TOOL
          </span>
        </div>
        <div className="w-px h-6 mx-1" style={{ background: 'hsl(215,25%,22%)' }} />
        <button className="toolbar-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" data-testid="btn-undo">
          <Undo2 size={13} /> Undo
        </button>
        <button className="toolbar-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" data-testid="btn-redo">
          <Redo2 size={13} /> Redo
        </button>
        <div className="w-px h-6 mx-1" style={{ background: 'hsl(215,25%,22%)' }} />
        <button className="toolbar-btn" onClick={() => zoomTo(1.25)} title="Zoom In" data-testid="btn-zoom-in"><ZoomIn size={13} /></button>
        <button className="toolbar-btn" onClick={resetZoom} title="Reset zoom" data-testid="btn-zoom-reset"
          style={{ minWidth: 46, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="toolbar-btn" onClick={() => zoomTo(0.8)} title="Zoom Out" data-testid="btn-zoom-out"><ZoomOut size={13} /></button>
        <div className="w-px h-6 mx-1" style={{ background: 'hsl(215,25%,22%)' }} />
        <button className={`toolbar-btn ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(v => !v)}
          title="Toggle grid" data-testid="btn-toggle-grid"
          style={showGrid ? { color: 'hsl(217,91%,70%)', borderColor: 'hsl(217,91%,40%)' } : {}}>
          <Grid3X3 size={13} /> Grid
        </button>
        <button className="toolbar-btn danger" onClick={clearCanvas} title="Clear canvas" data-testid="btn-clear">
          <Trash2 size={13} /> Clear
        </button>
        <div className="w-px h-6 mx-1" style={{ background: 'hsl(215,25%,22%)' }} />
        <button
          className="toolbar-btn"
          onClick={() => setShowMapModal(true)}
          title="Set map background from address"
          data-testid="btn-map-background"
          style={mapDataUrl ? { color: 'hsl(142,76%,55%)', borderColor: 'hsl(142,76%,36%)' } : {}}
        >
          <Map size={13} /> Map BG
        </button>
        {mapDataUrl && (<>
          <button
            className={`toolbar-btn ${snapEnabled ? 'active' : ''}`}
            onClick={() => setSnapEnabled(v => !v)}
            title={
              roadsLoading ? 'Loading road data…' :
              roadsError ? roadsError :
              roadPolylines.length === 0 ? 'No road data loaded' :
              `Snap to roads (${roadPolylines.length} segments loaded)`
            }
            disabled={roadsLoading || roadPolylines.length === 0}
            data-testid="btn-snap-roads"
            style={
              roadsError ? { color: '#ef4444', borderColor: '#ef4444' } :
              snapEnabled ? { color: 'hsl(142,76%,55%)', borderColor: 'hsl(142,76%,36%)' } :
              {}
            }
          >
            {roadsLoading
              ? <span style={{ fontSize: 10 }}>…</span>
              : roadsError
                ? <span style={{ fontSize: 11 }}>⚠</span>
                : <span style={{ fontSize: 11 }}>⌖</span>
            } Snap
          </button>
          <button className="toolbar-btn" onClick={() => { setMapDataUrl(null); setMapCoords(null); setMapZoom(null); setRoadPolylines([]); setSnapEnabled(false); }} title="Remove map background" data-testid="btn-remove-map" style={{ color: '#ef4444', padding: '5px 7px' }}>
            <X size={13} />
          </button>
        </>)}
        <div className="flex-1" />
        <button className="toolbar-btn" onClick={exportJpeg} data-testid="btn-export-jpeg">
          <ImageDown size={13} /> Export JPEG
        </button>
        <button className="toolbar-btn primary" onClick={exportPdf} data-testid="btn-export-pdf">
          <FileDown size={13} /> Export PDF
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PALETTE */}
        <aside style={{ width: 220, background: 'hsl(215,28%,9%)', borderRight: '1px solid hsl(215,25%,18%)' }}
          className="flex flex-col overflow-y-auto flex-shrink-0">
          <div className="px-3 py-2" style={{ borderBottom: '1px solid hsl(215,25%,15%)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'hsl(215,20%,45%)' }}>
            Element Palette
          </div>
          {PALETTE_CATEGORIES.map(cat => (
            <div key={cat.label}>
              <button
                className="category-header w-full text-left"
                onClick={() => setCollapsed(prev => ({ ...prev, [cat.label]: !prev[cat.label] }))}
                data-testid={`category-${cat.label}`}
              >
                {collapsed[cat.label] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span style={{ color: cat.color }}>{cat.label}</span>
              </button>
              {!collapsed[cat.label] && (
                <div className="pb-1">
                  {cat.items.map(item => (
                    <button
                      key={item.type}
                      className={`palette-item w-full text-left ${activeTool === item.type ? 'active' : ''}`}
                      onClick={() => setActiveTool(prev => prev === item.type ? null : item.type)}
                      data-testid={`palette-${item.type}`}
                    >
                      <div className="palette-swatch" style={{ background: item.color }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex-1" />
          <div className="px-3 py-3" style={{ borderTop: '1px solid hsl(215,25%,15%)', fontSize: 11, color: 'hsl(215,20%,45%)', lineHeight: 1.5 }}>
            {activeTool
              ? <span style={{ color: 'hsl(217,91%,70%)' }}>Click canvas to place<br /><strong>{activeTool}</strong><br />Esc to cancel</span>
              : <span>Select a tool then<br />click on the canvas<br />to place elements.</span>
            }
          </div>
        </aside>

        {/* CANVAS AREA */}
        <main
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          style={{
            background: '#e2e8f0',
            cursor: activeTool ? 'crosshair' : 'default',
          }}
        >
          <Stage
            ref={stageRef}
            width={containerRef.current?.offsetWidth ?? 800}
            height={containerRef.current?.offsetHeight ?? 600}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={zoom}
            scaleY={zoom}
            onClick={handleStageClick}
            onContextMenu={(e) => { e.evt.preventDefault(); setSelectedId(null); setActiveTool(null); }}
            onWheel={handleWheel}
            draggable={!activeTool}
            onDragEnd={handleStageDragEnd}
          >
            <Layer>
              {/* White canvas background */}
              <Rect
                name="stage-bg"
                x={0} y={0}
                width={STAGE_W} height={STAGE_H}
                fill="#ffffff"
                shadowColor="rgba(0,0,0,0.18)"
                shadowBlur={20}
                shadowOffsetX={2}
                shadowOffsetY={2}
              />
              {/* Map background image */}
              {mapImage && (
                <KonvaImage image={mapImage} x={0} y={0} width={STAGE_W} height={STAGE_H} opacity={mapOpacity} />
              )}
              {/* Road overlay — shown when snap is enabled to confirm alignment */}
              {snapEnabled && roadPolylines.map((poly, pi) =>
                poly.length >= 2 && (
                  <Line
                    key={`road-${pi}`}
                    points={poly.flat()}
                    stroke="rgba(59,130,246,0.55)"
                    strokeWidth={3}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                  />
                )
              )}
              {/* Grid */}
              {showGrid && <GridLines w={STAGE_W} h={STAGE_H} />}
              {/* Subtle border */}
              <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="transparent" stroke="#94a3b8" strokeWidth={1} />
              {/* Elements */}
              {elements.map(el => {
                const node = renderElement({
                  el,
                  isSelected: el.id === selectedId,
                  onSelect: () => setSelectedId(el.id),
                  onChange: (changes) => {
                    // Snap dragged position to nearest road centerline
                    if (
                      snapEnabled &&
                      roadPolylines.length > 0 &&
                      (changes.x !== undefined || changes.y !== undefined)
                    ) {
                      const cx = (changes.x ?? el.x) + (changes.width ?? el.width) / 2;
                      const cy = (changes.y ?? el.y) + (changes.height ?? el.height) / 2;
                      const snapped = snapToRoads(cx, cy, roadPolylines, 48, zoom);
                      if (snapped) {
                        // Konva rotates a Group around its (x,y) origin (top-left), NOT its
                        // visual center. If we naively place x=snap.x-w/2, y=snap.y-h/2 and
                        // then apply a rotation θ, the visual center drifts away from the road.
                        //
                        // Correct formula: solve for (x,y) such that the local center
                        // (w/2, h/2), after rotation θ around the group origin, lands at
                        // (snapped.x, snapped.y) in parent space:
                        //   snapped.x = x + (w/2)·cos θ − (h/2)·sin θ
                        //   snapped.y = y + (w/2)·sin θ + (h/2)·cos θ
                        const w = changes.width ?? el.width;
                        const h = changes.height ?? el.height;
                        const θ = snapped.rotation * (Math.PI / 180);
                        changes = {
                          ...changes,
                          x: snapped.x - (w / 2) * Math.cos(θ) + (h / 2) * Math.sin(θ),
                          y: snapped.y - (w / 2) * Math.sin(θ) - (h / 2) * Math.cos(θ),
                          rotation: snapped.rotation,
                        };
                      }
                    }
                    updateElement(el.id, changes);
                  },
                });
                return node ? cloneElement(node, { key: el.id }) : null;
              })}
              {/* Transformer */}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={false}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 8 || newBox.height < 8) return oldBox;
                  return newBox;
                }}
                anchorStroke="#1e5eff"
                anchorFill="#fff"
                anchorSize={8}
                borderStroke="#1e5eff"
                borderDash={[4, 3]}
              />
            </Layer>
          </Stage>
        </main>

        {/* RIGHT PANEL */}
        <aside style={{ width: 280, background: 'hsl(215,28%,9%)', borderLeft: '1px solid hsl(215,25%,18%)' }}
          className="flex flex-col overflow-y-auto flex-shrink-0">

          {/* Map Background Controls */}
          {mapDataUrl && (
            <div style={{ borderBottom: '1px solid hsl(215,25%,16%)' }}>
              <div className="px-3 py-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'hsl(142,76%,45%)', borderBottom: '1px solid hsl(215,25%,15%)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Map size={11} /> Map Background
              </div>
              <div className="p-3 flex flex-col gap-2">
                <label className="prop-label">Opacity ({Math.round(mapOpacity * 100)}%)</label>
                <input type="range" min={0.1} max={1} step={0.05} value={mapOpacity}
                  onChange={e => setMapOpacity(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'hsl(142,76%,36%)' }}
                  data-testid="map-opacity-slider" />
                <div className="flex gap-2">
                  <button className="toolbar-btn flex-1" style={{ fontSize: 11 }} onClick={() => setShowMapModal(true)} data-testid="btn-change-map">
                    Change Location
                  </button>
                  <button className="toolbar-btn danger flex-1" style={{ fontSize: 11 }} onClick={() => { setMapDataUrl(null); setMapCoords(null); setMapZoom(null); setRoadPolylines([]); setSnapEnabled(false); setRoadsError(null); }} data-testid="btn-remove-map-panel">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Properties Panel */}
          <div style={{ borderBottom: '1px solid hsl(215,25%,16%)' }}>
            <div className="px-3 py-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'hsl(215,20%,45%)', borderBottom: '1px solid hsl(215,25%,15%)' }}>
              Properties
            </div>
            {selectedEl ? (
              <div className="p-3 flex flex-col gap-3">
                <div>
                  <label className="prop-label">Label</label>
                  <input
                    type="text"
                    className="prop-input"
                    value={selectedEl.label}
                    onChange={e => updateElement(selectedEl.id, { label: e.target.value })}
                    data-testid="prop-label"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="prop-label">Width</label>
                    <input type="number" className="prop-input" value={Math.round(selectedEl.width)}
                      onChange={e => updateElement(selectedEl.id, { width: Math.max(5, Number(e.target.value)) })}
                      data-testid="prop-width" />
                  </div>
                  <div className="flex-1">
                    <label className="prop-label">Height</label>
                    <input type="number" className="prop-input" value={Math.round(selectedEl.height)}
                      onChange={e => updateElement(selectedEl.id, { height: Math.max(5, Number(e.target.value)) })}
                      data-testid="prop-height" />
                  </div>
                </div>
                <div>
                  <label className="prop-label">Rotation ({Math.round(selectedEl.rotation)}°)</label>
                  <input type="range" min={0} max={360} value={selectedEl.rotation}
                    onChange={e => updateElement(selectedEl.id, { rotation: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'hsl(217,91%,60%)' }}
                    data-testid="prop-rotation" />
                </div>
                {(selectedEl.type === 'arrow-sign' || selectedEl.type === 'straight-road' || selectedEl.type === 'four-lane-highway-curve') && (
                  <div>
                    <label className="prop-label">
                      Curvature ({Math.round((selectedEl.curvature ?? 0) * 100)}%)
                    </label>
                    <input type="range" min={-1} max={1} step={0.05} value={selectedEl.curvature ?? 0}
                      onChange={e => updateElement(selectedEl.id, { curvature: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: 'hsl(217,91%,60%)' }}
                      data-testid="prop-curvature" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div>
                    <label className="prop-label">Fill</label>
                    <input type="color" value={selectedEl.fill === 'transparent' ? '#ffffff' : selectedEl.fill}
                      onChange={e => updateElement(selectedEl.id, { fill: e.target.value })}
                      data-testid="prop-fill" />
                  </div>
                  <div className="flex-1">
                    <label className="prop-label">Opacity ({Math.round(selectedEl.opacity * 100)}%)</label>
                    <input type="range" min={0} max={1} step={0.05} value={selectedEl.opacity}
                      onChange={e => updateElement(selectedEl.id, { opacity: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: 'hsl(217,91%,60%)' }}
                      data-testid="prop-opacity" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="toolbar-btn flex-1" onClick={bringToFront} style={{ fontSize: 11 }} data-testid="btn-bring-front">
                    Bring Front
                  </button>
                  <button className="toolbar-btn flex-1" onClick={sendToBack} style={{ fontSize: 11 }} data-testid="btn-send-back">
                    Send Back
                  </button>
                </div>
                <button className="toolbar-btn w-full" onClick={duplicateSelected} data-testid="btn-duplicate-element"
                  style={{ color: 'hsl(217,91%,70%)', borderColor: 'hsl(217,91%,35%)' }}>
                  Duplicate  (Ctrl+D)
                </button>
                <button className="toolbar-btn danger w-full" onClick={deleteSelected} data-testid="btn-delete-element">
                  <Trash2 size={13} /> Delete Element
                </button>
              </div>
            ) : (
              <div className="px-3 py-4" style={{ fontSize: 12, color: 'hsl(215,20%,45%)', lineHeight: 1.6 }}>
                Select an element on the canvas to edit its properties.
              </div>
            )}
          </div>

          {/* Case Information */}
          <div className="flex-1">
            <div className="px-3 py-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'hsl(215,20%,45%)', borderBottom: '1px solid hsl(215,25%,15%)' }}>
              Case Information
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div>
                <label className="prop-label">Case Number</label>
                <input type="text" className="prop-input" placeholder="2026-CR-0042"
                  value={caseInfo.caseNumber}
                  onChange={e => setCaseInfo(p => ({ ...p, caseNumber: e.target.value }))}
                  data-testid="case-number" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="prop-label">Date</label>
                  <input type="date" className="prop-input"
                    value={caseInfo.date}
                    onChange={e => setCaseInfo(p => ({ ...p, date: e.target.value }))}
                    data-testid="case-date" />
                </div>
                <div style={{ width: 90 }}>
                  <label className="prop-label">Time</label>
                  <input type="time" className="prop-input"
                    value={caseInfo.time}
                    onChange={e => setCaseInfo(p => ({ ...p, time: e.target.value }))}
                    data-testid="case-time" />
                </div>
              </div>
              <div>
                <label className="prop-label">Location / Address</label>
                <input type="text" className="prop-input" placeholder="123 Main St & Oak Ave"
                  value={caseInfo.location}
                  onChange={e => setCaseInfo(p => ({ ...p, location: e.target.value }))}
                  data-testid="case-location" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="prop-label">Officer Name</label>
                  <input type="text" className="prop-input" placeholder="J. Smith"
                    value={caseInfo.officer}
                    onChange={e => setCaseInfo(p => ({ ...p, officer: e.target.value }))}
                    data-testid="case-officer" />
                </div>
                <div style={{ width: 80 }}>
                  <label className="prop-label">Badge #</label>
                  <input type="text" className="prop-input" placeholder="4721"
                    value={caseInfo.badge}
                    onChange={e => setCaseInfo(p => ({ ...p, badge: e.target.value }))}
                    data-testid="case-badge" />
                </div>
              </div>
              <div>
                <label className="prop-label">Weather</label>
                <select className="prop-input" value={caseInfo.weather}
                  onChange={e => setCaseInfo(p => ({ ...p, weather: e.target.value }))}
                  data-testid="case-weather">
                  {['Clear', 'Cloudy', 'Rain', 'Heavy Rain', 'Fog', 'Snow', 'Sleet', 'Other'].map(w =>
                    <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="prop-label">Road Conditions</label>
                <select className="prop-input" value={caseInfo.roadCondition}
                  onChange={e => setCaseInfo(p => ({ ...p, roadCondition: e.target.value }))}
                  data-testid="case-road-condition">
                  {['Dry', 'Wet', 'Icy', 'Snow-covered', 'Muddy', 'Gravel', 'Other'].map(r =>
                    <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="prop-label">Notes</label>
                <textarea className="prop-input" placeholder="Additional notes..."
                  rows={3}
                  value={caseInfo.notes}
                  onChange={e => setCaseInfo(p => ({ ...p, notes: e.target.value }))}
                  data-testid="case-notes" />
              </div>
            </div>
          </div>

          {/* Collision Coordinates – shown only when a map background is active */}
          {mapCoords && (
            <div>
              <div className="px-3 py-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'hsl(215,20%,45%)', borderBottom: '1px solid hsl(215,25%,15%)', borderTop: '1px solid hsl(215,25%,15%)' }}>
                Collision Coordinates
              </div>
              <div className="p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="prop-label">Latitude</label>
                    <input
                      type="text"
                      className="prop-input"
                      readOnly
                      value={mapCoords.lat.toFixed(6)}
                      style={{ fontFamily: 'monospace', cursor: 'default' }}
                      data-testid="coord-lat"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="prop-label">Longitude</label>
                    <input
                      type="text"
                      className="prop-input"
                      readOnly
                      value={mapCoords.lng.toFixed(6)}
                      style={{ fontFamily: 'monospace', cursor: 'default' }}
                      data-testid="coord-lng"
                    />
                  </div>
                </div>
                <p style={{ fontSize: 10, color: 'hsl(215,20%,50%)', margin: 0, lineHeight: 1.4 }}>
                  Center of the applied map background. Re-apply the map after panning to update.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {showMapModal && (
        <MapBackgroundModal
          onClose={() => setShowMapModal(false)}
          onApply={(dataUrl, lat, lng, zoom: number) => {
            setMapDataUrl(dataUrl);
            setMapCoords({ lat, lng });
            setMapZoom(zoom);
            setShowMapModal(false);
            // Fetch road geometry for snap-to-road
            setRoadsLoading(true);
            setRoadPolylines([]);
            setRoadsError(null);
            fetchRoadPolylines(lat, lng, zoom, STAGE_W, STAGE_H)
              .then(polys => { setRoadPolylines(polys); if (polys.length === 0) setRoadsError('No roads found in this area'); })
              .catch((err) => { console.error('[road-snap]', err); setRoadsError('Could not load road data'); })
              .finally(() => setRoadsLoading(false));
          }}
          canvasWidth={STAGE_W}
          canvasHeight={STAGE_H}
        />
      )}
    </div>
  );
}
