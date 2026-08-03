export type CanvasElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  opacity: number;
  label: string;
  curvature?: number;
};

export type CaseInfo = {
  caseNumber: string;
  date: string;
  time: string;
  location: string;
  officer: string;
  badge: string;
  weather: string;
  roadCondition: string;
  notes: string;
};

export const ELEMENT_DEFAULTS: Record<string, Partial<CanvasElement>> = {
  car:             { width: 56, height: 28, fill: '#3b82f6' },
  truck:           { width: 100, height: 34, fill: '#64748b' },
  motorcycle:      { width: 38, height: 14, fill: '#10b981' },
  bicycle:         { width: 32, height: 10, fill: '#f59e0b' },
  pedestrian:      { width: 18, height: 18, fill: '#ef4444' },
  overturn:        { width: 72, height: 72, fill: '#3b82f6' },

  'straight-road': { width: 300, height: 80, fill: '#475569' },
  'four-lane-highway': { width: 300, height: 180, fill: '#475569' },
  'four-lane-median':  { width: 300, height: 200, fill: '#475569' },
  intersection:    { width: 160, height: 160, fill: '#475569' },
  crosswalk:       { width: 40, height: 100, fill: '#ffffff' },
  'lane-divider':  { width: 200, height: 6, fill: '#ffffff' },
  median:          { width: 200, height: 20, fill: '#854d0e' },

  'point-of-impact': { width: 32, height: 32, fill: '#ef4444' },
  'skid-mark':       { width: 120, height: 10, fill: '#0f172a' },
  'debris-field':    { width: 60, height: 50, fill: '#64748b' },
  'rest-position':   { width: 56, height: 28, fill: 'transparent' },
  'fluid-stain':     { width: 50, height: 40, fill: '#7f1d1d' },

  'stop-sign':    { width: 28, height: 28, fill: '#dc2626' },
  'traffic-light':{ width: 18, height: 46, fill: '#1e293b' },
  'yield-sign':   { width: 30, height: 26, fill: '#facc15' },
  'speed-limit':  { width: 28, height: 36, fill: '#ffffff' },
  'arrow-sign':   { width: 40, height: 20, fill: '#ffffff' },

  'measurement-line': { width: 120, height: 20, fill: '#0ea5e9' },
  'north-arrow':  { width: 52, height: 52, fill: '#1e293b' },

  tree:           { width: 36, height: 36, fill: '#16a34a' },
  building:       { width: 100, height: 80, fill: '#94a3b8' },
  'fire-hydrant': { width: 14, height: 16, fill: '#dc2626' },
  'street-light': { width: 10, height: 50, fill: '#fbbf24' },
  'text-label':   { width: 120, height: 24, fill: '#000000' },
};

export const PALETTE_CATEGORIES = [
  {
    label: 'Vehicles',
    color: '#3b82f6',
    items: [
      { type: 'car', label: 'Car', color: '#3b82f6' },
      { type: 'truck', label: 'Truck / Semi', color: '#64748b' },
      { type: 'motorcycle', label: 'Motorcycle', color: '#10b981' },
      { type: 'bicycle', label: 'Bicycle', color: '#f59e0b' },
      { type: 'pedestrian', label: 'Pedestrian', color: '#ef4444' },
      { type: 'overturn', label: 'Over-Turn', color: '#ef4444' },
    ],
  },
  {
    label: 'Road Elements',
    color: '#475569',
    items: [
      { type: 'straight-road', label: 'Straight Road', color: '#475569' },
      { type: 'four-lane-highway', label: 'Four-Lane Highway', color: '#475569' },
      { type: 'four-lane-median', label: 'Four-Lane w/ Median', color: '#4d7c0f' },
      { type: 'intersection', label: 'Intersection', color: '#64748b' },
      { type: 'crosswalk', label: 'Crosswalk', color: '#cbd5e1' },
      { type: 'lane-divider', label: 'Lane Divider', color: '#fbbf24' },
      { type: 'median', label: 'Median', color: '#854d0e' },
    ],
  },
  {
    label: 'Accident Markers',
    color: '#ef4444',
    items: [
      { type: 'point-of-impact', label: 'Point of Impact', color: '#ef4444' },
      { type: 'skid-mark', label: 'Skid Mark', color: '#1e293b' },
      { type: 'debris-field', label: 'Debris Field', color: '#78716c' },
      { type: 'rest-position', label: 'Rest Position', color: '#94a3b8' },
      { type: 'fluid-stain', label: 'Fluid Stain', color: '#7f1d1d' },
    ],
  },
  {
    label: 'Traffic Control',
    color: '#dc2626',
    items: [
      { type: 'stop-sign', label: 'Stop Sign', color: '#dc2626' },
      { type: 'traffic-light', label: 'Traffic Light', color: '#1e293b' },
      { type: 'yield-sign', label: 'Yield Sign', color: '#facc15' },
      { type: 'speed-limit', label: 'Speed Limit', color: '#94a3b8' },
      { type: 'arrow-sign', label: 'Direction Arrow', color: '#ffffff' },
    ],
  },
  {
    label: 'Measurements',
    color: '#0ea5e9',
    items: [
      { type: 'measurement-line', label: 'Measurement Line', color: '#0ea5e9' },
    ],
  },
  {
    label: 'Other',
    color: '#16a34a',
    items: [
      { type: 'north-arrow', label: 'North Arrow', color: '#1e293b' },
      { type: 'tree', label: 'Tree', color: '#16a34a' },
      { type: 'building', label: 'Building', color: '#94a3b8' },
      { type: 'fire-hydrant', label: 'Fire Hydrant', color: '#dc2626' },
      { type: 'street-light', label: 'Street Light', color: '#fbbf24' },
      { type: 'text-label', label: 'Text Label', color: '#000000' },
    ],
  },
];
