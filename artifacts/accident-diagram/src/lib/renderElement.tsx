import { Rect, Circle, Line, Group, Text, RegularPolygon, Arrow, Arc } from 'react-konva';
import type Konva from 'konva';
import { CanvasElement } from './elements';

export type { CanvasElement };

interface RenderProps {
  el: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<CanvasElement>) => void;
}

function makeGroupProps(el: CanvasElement, onSelect: () => void, onChange: (n: Partial<CanvasElement>) => void) {
  return {
    key: el.id,
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    draggable: true,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onSelect(); },
    onTap: (e: Konva.KonvaEventObject<Event>) => { e.cancelBubble = true; onSelect(); },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange({ x: e.target.x(), y: e.target.y() });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(5, el.width * scaleX),
        height: Math.max(5, el.height * scaleY),
      });
    },
  };
}

export function renderElement({ el, onSelect, onChange }: RenderProps) {
  const gp = makeGroupProps(el, onSelect, onChange);
  const w = el.width;
  const h = el.height;
  const f = el.fill;

  const labelEl = el.label
    ? <Text text={el.label} y={-16} fontSize={11} fill="#000" fontFamily="system-ui" />
    : null;

  switch (el.type) {
    case 'car':
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill={f} cornerRadius={5} stroke="#1e293b" strokeWidth={1.5} />
          <Rect x={w * 0.1} y={h * 0.1} width={w * 0.35} height={h * 0.8} fill="rgba(255,255,255,0.25)" cornerRadius={2} />
          <Rect x={w * 0.55} y={h * 0.1} width={w * 0.35} height={h * 0.8} fill="rgba(255,255,255,0.25)" cornerRadius={2} />
          <Rect x={w * 0.08} y={-3} width={w * 0.22} height={5} fill="#1e293b" cornerRadius={1} />
          <Rect x={w * 0.68} y={-3} width={w * 0.22} height={5} fill="#1e293b" cornerRadius={1} />
          <Rect x={w * 0.08} y={h - 2} width={w * 0.22} height={5} fill="#1e293b" cornerRadius={1} />
          <Rect x={w * 0.68} y={h - 2} width={w * 0.22} height={5} fill="#1e293b" cornerRadius={1} />
          {labelEl}
        </Group>
      );

    case 'truck':
      return (
        <Group {...gp}>
          <Rect x={w * 0.25} y={0} width={w * 0.75} height={h} fill={f} stroke="#1e293b" strokeWidth={1.5} />
          <Rect x={0} y={0} width={w * 0.28} height={h} fill="#475569" stroke="#1e293b" strokeWidth={1.5} cornerRadius={[3,0,0,3]} />
          <Rect x={3} y={3} width={w * 0.2} height={h * 0.55} fill="rgba(255,255,255,0.3)" cornerRadius={2} />
          <Rect x={w * 0.08} y={-3} width={10} height={5} fill="#1e293b" cornerRadius={1} />
          <Rect x={w * 0.08} y={h - 2} width={10} height={5} fill="#1e293b" cornerRadius={1} />
          <Rect x={w - 14} y={-3} width={10} height={5} fill="#1e293b" cornerRadius={1} />
          <Rect x={w - 14} y={h - 2} width={10} height={5} fill="#1e293b" cornerRadius={1} />
          {labelEl}
        </Group>
      );

    case 'motorcycle':
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill={f} cornerRadius={3} stroke="#1e293b" strokeWidth={1.5} />
          <Circle x={5} y={h / 2} radius={h * 0.7} stroke="#1e293b" strokeWidth={2} fill="transparent" />
          <Circle x={w - 5} y={h / 2} radius={h * 0.7} stroke="#1e293b" strokeWidth={2} fill="transparent" />
          {labelEl}
        </Group>
      );

    case 'bicycle':
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill={f} cornerRadius={2} stroke="#1e293b" strokeWidth={1.5} />
          <Circle x={4} y={h / 2} radius={h * 0.8} stroke="#1e293b" strokeWidth={1.5} fill="transparent" />
          <Circle x={w - 4} y={h / 2} radius={h * 0.8} stroke="#1e293b" strokeWidth={1.5} fill="transparent" />
          {labelEl}
        </Group>
      );

    case 'pedestrian':
      return (
        <Group {...gp}>
          <Circle x={w / 2} y={h * 0.3} radius={w * 0.28} fill={f} stroke="#1e293b" strokeWidth={1.5} />
          <Line points={[w / 2, h * 0.55, w / 2, h * 0.82]} stroke="#1e293b" strokeWidth={2.5} lineCap="round" />
          <Line points={[w * 0.25, h * 0.65, w * 0.75, h * 0.65]} stroke="#1e293b" strokeWidth={2} lineCap="round" />
          <Line points={[w / 2, h * 0.82, w * 0.28, h]} stroke="#1e293b" strokeWidth={2.5} lineCap="round" />
          <Line points={[w / 2, h * 0.82, w * 0.72, h]} stroke="#1e293b" strokeWidth={2.5} lineCap="round" />
          {labelEl}
        </Group>
      );

    case 'straight-road': {
      const curve = el.curvature ?? 0;
      if (Math.abs(curve) < 0.01) {
        return (
          <Group {...gp}>
            <Rect width={w} height={h} fill="#475569" />
            <Line points={[0, h / 2, w, h / 2]} stroke="#ffffff" strokeWidth={2} dash={[20, 15]} opacity={0.7} />
            <Line points={[0, 0, w, 0]} stroke="#94a3b8" strokeWidth={1} />
            <Line points={[0, h, w, h]} stroke="#94a3b8" strokeWidth={1} />
            {labelEl}
          </Group>
        );
      }
      const midY = h / 2 - curve * w * 0.5;
      return (
        <Group {...gp}>
          <Line points={[0, h / 2, w / 2, midY, w, h / 2]} stroke="#475569" strokeWidth={h} tension={0.5} lineCap="round" />
          <Line points={[0, h / 2, w / 2, midY, w, h / 2]} stroke="#ffffff" strokeWidth={1.5} tension={0.5} dash={[20, 15]} opacity={0.7} />
          {labelEl}
        </Group>
      );
    }

    case 'intersection': {
      const roadW = w * 0.35;
      return (
        <Group {...gp}>
          <Rect x={(w - roadW) / 2} y={0} width={roadW} height={h} fill="#475569" />
          <Rect x={0} y={(h - roadW) / 2} width={w} height={roadW} fill="#475569" />
          <Line points={[w / 2, 0, w / 2, (h - roadW) / 2]} stroke="#fff" strokeWidth={1.5} dash={[10, 8]} opacity={0.6} />
          <Line points={[w / 2, h, w / 2, (h + roadW) / 2]} stroke="#fff" strokeWidth={1.5} dash={[10, 8]} opacity={0.6} />
          <Line points={[0, h / 2, (w - roadW) / 2, h / 2]} stroke="#fff" strokeWidth={1.5} dash={[10, 8]} opacity={0.6} />
          <Line points={[w, h / 2, (w + roadW) / 2, h / 2]} stroke="#fff" strokeWidth={1.5} dash={[10, 8]} opacity={0.6} />
          {labelEl}
        </Group>
      );
    }

    case 'crosswalk': {
      const stripes = 6;
      const stripeH = h / (stripes * 2 - 1);
      return (
        <Group {...gp}>
          {Array.from({ length: stripes }).map((_, i) => (
            <Rect key={i} x={0} y={i * stripeH * 2} width={w} height={stripeH} fill="#ffffff" stroke="#cbd5e1" strokeWidth={0.5} />
          ))}
          {labelEl}
        </Group>
      );
    }

    case 'lane-divider':
      return (
        <Group {...gp}>
          <Line points={[0, h / 2, w, h / 2]} stroke={f} strokeWidth={Math.max(3, h)} dash={[24, 16]} lineCap="round" />
          {labelEl}
        </Group>
      );

    case 'median':
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill={f} />
          <Line points={[0, 0, w, 0, w, h, 0, h, 0, 0]} stroke="#92400e" strokeWidth={1.5} closed />
          {labelEl}
        </Group>
      );

    case 'point-of-impact':
      return (
        <Group {...gp}>
          <Circle x={w / 2} y={h / 2} radius={w / 2} fill="#fef2f2" stroke="#ef4444" strokeWidth={2} />
          <Line points={[w * 0.15, h * 0.15, w * 0.85, h * 0.85]} stroke="#ef4444" strokeWidth={3} lineCap="round" />
          <Line points={[w * 0.85, h * 0.15, w * 0.15, h * 0.85]} stroke="#ef4444" strokeWidth={3} lineCap="round" />
          <Circle x={w / 2} y={h / 2} radius={3} fill="#ef4444" />
          {labelEl}
        </Group>
      );

    case 'skid-mark':
      return (
        <Group {...gp}>
          <Line points={[0, h / 2, w * 0.3, h * 0.35, w * 0.6, h * 0.6, w, h / 2]} stroke={f} strokeWidth={h} lineCap="round" lineJoin="round" tension={0.3} opacity={0.85} />
          <Line points={[0, h / 2, w * 0.3, h * 0.35, w * 0.6, h * 0.6, w, h / 2]} stroke="rgba(0,0,0,0.3)" strokeWidth={h * 0.5} lineCap="round" lineJoin="round" tension={0.3} dash={[3, 4]} />
          {labelEl}
        </Group>
      );

    case 'debris-field':
      return (
        <Group {...gp}>
          {[
            [0.2, 0.2, 4], [0.5, 0.15, 3], [0.75, 0.3, 5], [0.1, 0.55, 3],
            [0.4, 0.6, 4], [0.7, 0.7, 3], [0.25, 0.8, 5], [0.6, 0.45, 4],
            [0.85, 0.5, 3], [0.45, 0.35, 3],
          ].map(([rx, ry, r], i) => (
            <Circle key={i} x={(rx as number) * w} y={(ry as number) * h} radius={r as number} fill="#475569" opacity={0.8} />
          ))}
          {labelEl}
        </Group>
      );

    case 'rest-position':
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill="transparent" stroke="#64748b" strokeWidth={2} dash={[8, 5]} cornerRadius={4} />
          {labelEl}
        </Group>
      );

    case 'fluid-stain':
      return (
        <Group {...gp}>
          <Circle x={w / 2} y={h / 2} radius={Math.min(w, h) / 2} fill={f} opacity={0.75} />
          <Circle x={w * 0.3} y={h * 0.3} radius={Math.min(w, h) * 0.25} fill={f} opacity={0.6} />
          <Circle x={w * 0.7} y={h * 0.65} radius={Math.min(w, h) * 0.2} fill={f} opacity={0.6} />
          {labelEl}
        </Group>
      );

    case 'stop-sign':
      return (
        <Group {...gp}>
          <RegularPolygon x={w / 2} y={h / 2} sides={8} radius={Math.min(w, h) / 2} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
          <Text text="STOP" x={0} y={h / 2 - 5} width={w} align="center" fontSize={Math.min(w, h) * 0.22} fill="#fff" fontStyle="bold" fontFamily="system-ui" />
          {labelEl}
        </Group>
      );

    case 'traffic-light':
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill="#1e293b" cornerRadius={3} stroke="#0f172a" strokeWidth={1.5} />
          <Circle x={w / 2} y={h * 0.15} radius={w * 0.32} fill="#dc2626" />
          <Circle x={w / 2} y={h * 0.5} radius={w * 0.32} fill="#ca8a04" />
          <Circle x={w / 2} y={h * 0.82} radius={w * 0.32} fill="#16a34a" />
          {labelEl}
        </Group>
      );

    case 'yield-sign':
      return (
        <Group {...gp}>
          <Line points={[w / 2, 0, w, h, 0, h]} closed fill="#facc15" stroke="#ca8a04" strokeWidth={1.5} />
          <Line points={[w / 2, h * 0.15, w * 0.85, h * 0.88, w * 0.15, h * 0.88]} closed fill="transparent" stroke="#ca8a04" strokeWidth={1} />
          {labelEl}
        </Group>
      );

    case 'speed-limit':
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill="#fff" stroke="#1e293b" strokeWidth={2} cornerRadius={2} />
          <Text text="SPEED" x={0} y={6} width={w} align="center" fontSize={6} fill="#1e293b" fontStyle="bold" fontFamily="system-ui" />
          <Text text="LIMIT" x={0} y={13} width={w} align="center" fontSize={6} fill="#1e293b" fontStyle="bold" fontFamily="system-ui" />
          <Text text="35" x={0} y={19} width={w} align="center" fontSize={h * 0.38} fill="#1e293b" fontStyle="bold" fontFamily="system-ui" />
          {labelEl}
        </Group>
      );

    case 'arrow-sign': {
      const curve = el.curvature ?? 0;
      const arrowColor = f === '#ffffff' ? '#1e293b' : f;
      const midY = h / 2 - curve * w * 0.6;
      const pts = Math.abs(curve) < 0.01
        ? [0, h / 2, w, h / 2]
        : [0, h / 2, w / 2, midY, w, h / 2];
      return (
        <Group {...gp}>
          <Arrow points={pts} fill={arrowColor} stroke={arrowColor} strokeWidth={3} tension={Math.abs(curve) > 0.01 ? 0.5 : 0} pointerLength={10} pointerWidth={10} />
          {labelEl}
        </Group>
      );
    }

    case 'measurement-line': {
      const distFt = Math.round(w * 0.3);
      const measureLabel = el.label || `${distFt} ft`;
      return (
        <Group {...gp}>
          <Arrow points={[0, h / 2, w, h / 2]} fill={f} stroke={f} strokeWidth={2} pointerLength={8} pointerWidth={8} />
          <Arrow points={[w, h / 2, 0, h / 2]} fill={f} stroke={f} strokeWidth={2} pointerLength={8} pointerWidth={8} />
          <Line points={[0, h / 2 - 8, 0, h / 2 + 8]} stroke={f} strokeWidth={1.5} />
          <Line points={[w, h / 2 - 8, w, h / 2 + 8]} stroke={f} strokeWidth={1.5} />
          <Rect x={w / 2 - 22} y={h / 2 - 11} width={44} height={18} fill="#fff" stroke={f} strokeWidth={1} cornerRadius={2} />
          <Text text={measureLabel} x={w / 2 - 22} y={h / 2 - 8} width={44} align="center" fontSize={10} fill="#0f172a" fontStyle="bold" fontFamily="system-ui" />
        </Group>
      );
    }

    case 'tree':
      return (
        <Group {...gp}>
          <Circle x={w / 2} y={h * 0.45} radius={w * 0.46} fill={f} stroke="#15803d" strokeWidth={1.5} />
          <Rect x={w * 0.42} y={h * 0.72} width={w * 0.16} height={h * 0.28} fill="#92400e" cornerRadius={1} />
          {labelEl}
        </Group>
      );

    case 'building':
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill={f} stroke="#64748b" strokeWidth={1.5} />
          {Array.from({ length: 3 }).map((_, row) =>
            Array.from({ length: 4 }).map((__, col) => (
              <Rect key={`${row}-${col}`}
                x={w * 0.1 + col * (w * 0.22)} y={h * 0.12 + row * (h * 0.25)}
                width={w * 0.15} height={h * 0.16}
                fill="#e2e8f0" opacity={0.7} />
            ))
          )}
          {labelEl}
        </Group>
      );

    case 'fire-hydrant':
      return (
        <Group {...gp}>
          <Rect x={w * 0.2} y={h * 0.3} width={w * 0.6} height={h * 0.7} fill="#dc2626" cornerRadius={2} />
          <Rect x={0} y={h * 0.45} width={w} height={h * 0.2} fill="#b91c1c" cornerRadius={2} />
          <Circle x={w / 2} y={h * 0.2} radius={w * 0.3} fill="#dc2626" stroke="#b91c1c" strokeWidth={1} />
          {labelEl}
        </Group>
      );

    case 'north-arrow': {
      const r = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      const tip = cy - r * 0.72;
      const base = cy + r * 0.12;
      const spread = r * 0.26;
      return (
        <Group {...gp}>
          <Circle x={cx} y={cy} radius={r * 0.9} fill="#ffffff" stroke="#1e293b" strokeWidth={1.5} />
          <Line points={[cx, tip, cx - spread, base, cx, cy]} closed fill="#1e293b" stroke="none" />
          <Line points={[cx, tip, cx + spread, base, cx, cy]} closed fill="#94a3b8" stroke="none" />
          <Line points={[cx, tip, cx - spread, base, cx, cy, cx + spread, base]} closed fill="transparent" stroke="#1e293b" strokeWidth={1} />
          <Circle x={cx} y={cy} radius={3.5} fill="#1e293b" />
          <Text text="N" x={cx - 7} y={tip - 2} fontSize={13} fill="#1e293b" fontStyle="bold" fontFamily="system-ui" />
          {el.label && el.label !== 'North Arrow 1' && el.label !== 'North Arrow' ? <Text text={el.label} y={-16} fontSize={11} fill="#000" fontFamily="system-ui" /> : null}
        </Group>
      );
    }

    case 'street-light':
      return (
        <Group {...gp}>
          <Rect x={w * 0.35} y={h * 0.15} width={w * 0.3} height={h * 0.85} fill="#94a3b8" cornerRadius={2} />
          <Line points={[w * 0.5, h * 0.15, w, h * 0.05]} stroke="#94a3b8" strokeWidth={w * 0.2} lineCap="round" />
          <Circle x={w} y={h * 0.05} radius={w * 0.4} fill={f} />
          {labelEl}
        </Group>
      );

    case 'text-label':
      return (
        <Group {...gp}>
          <Text
            text={el.label || 'Label'}
            width={w}
            height={h}
            fontSize={14}
            fill={f}
            fontFamily="system-ui"
            fontStyle="bold"
            onClick={(e) => { e.cancelBubble = true; onSelect(); }}
          />
        </Group>
      );

    default:
      return (
        <Group {...gp}>
          <Rect width={w} height={h} fill={f} stroke="#1e293b" strokeWidth={1.5} cornerRadius={3} />
          {labelEl}
        </Group>
      );
  }
}
