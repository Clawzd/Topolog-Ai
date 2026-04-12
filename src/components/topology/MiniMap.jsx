import { useMemo, useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TC } from '../../lib/topologySvgTheme';

const MM_W = 160;
/** v3 spec: mini-map 160×120 */
const MM_H = 120;
const NODE_W = 90;
const NODE_H = 50;

export default function MiniMap({ nodes, links, rooms, barriers = [], powerZones = [], zoom, pan, setPan, canvasSize }) {
  const [collapsed, setCollapsed] = useState(false);
  const [userForcedOpen, setUserForcedOpen] = useState(false);

  const bounds = useMemo(() => {
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + NODE_W);
      maxY = Math.max(maxY, n.y + NODE_H);
    });
    rooms.forEach(r => {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    });
    barriers.forEach(b => {
      const x1 = b.x1 ?? b.x;
      const y1 = b.y1 ?? b.y;
      const x2 = b.x2 ?? b.x + (b.dx || 0);
      const y2 = b.y2 ?? b.y + (b.dy || 0);
      minX = Math.min(minX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxX = Math.max(maxX, x1, x2);
      maxY = Math.max(maxY, y1, y2);
    });
    (powerZones || []).forEach(z => {
      minX = Math.min(minX, z.x);
      minY = Math.min(minY, z.y);
      maxX = Math.max(maxX, z.x + z.w);
      maxY = Math.max(maxY, z.y + z.h);
    });
    const pad = 40;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [nodes, rooms, barriers, powerZones]);

  const sceneW = bounds.maxX - bounds.minX;
  const sceneH = bounds.maxY - bounds.minY;
  const scaleX = MM_W / sceneW;
  const scaleY = MM_H / sceneH;
  const scale = Math.min(scaleX, scaleY, 1);

  const toMM = useCallback((x, y) => ({
    x: (x - bounds.minX) * scale,
    y: (y - bounds.minY) * scale,
  }), [bounds.minX, bounds.minY, scale]);

  const vpW = (canvasSize.w / zoom) * scale;
  const vpH = (canvasSize.h / zoom) * scale;
  const vpX = (-pan.x / zoom - bounds.minX) * scale;
  const vpY = (-pan.y / zoom - bounds.minY) * scale;

  const sceneFitsViewport = sceneW * zoom <= canvasSize.w + 4 && sceneH * zoom <= canvasSize.h + 4;
  const autoHide = sceneFitsViewport && !userForcedOpen && !collapsed;

  useEffect(() => {
    if (!sceneFitsViewport) setUserForcedOpen(false);
  }, [sceneFitsViewport]);

  const onVpPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    const move = (ev) => {
      const ddx = ev.clientX - start.x;
      const ddy = ev.clientY - start.y;
      setPan({
        x: start.panX - (ddx * zoom) / scale,
        y: start.panY - (ddy * zoom) / scale,
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [pan.x, pan.y, setPan, zoom, scale]);

  if (autoHide) {
    return (
      <button
        type="button"
        className="absolute bottom-3 right-3 z-20 rounded-lg border border-border bg-card/90 px-2 py-1 text-[9px] text-muted-foreground hover:text-foreground hover:bg-muted shadow-xl"
        title="Show minimap (canvas fits viewport)"
        onClick={() => setUserForcedOpen(true)}
      >
        Map
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg overflow-hidden shadow-xl z-20" style={{ width: MM_W + 16 }}>
      <div className="flex items-center justify-between px-2 py-1 border-b border-border gap-1">
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Overview</span>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={collapsed ? 'Expand minimap' : 'Collapse minimap'}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <svg width={MM_W} height={MM_H} style={{ display: 'block', background: TC.bg }} className="select-none">
          {rooms.map(r => {
            const p = toMM(r.x, r.y);
            return (
              <rect
                key={r.id}
                x={p.x} y={p.y}
                width={r.w * scale} height={r.h * scale}
                fill={r.color || 'rgba(59,130,246,0.1)'}
                stroke={TC.borderMuted}
                strokeWidth={0.5}
                rx={1}
              />
            );
          })}

          {(powerZones || []).map(z => {
            const p = toMM(z.x, z.y);
            return (
              <rect
                key={z.id}
                x={p.x} y={p.y}
                width={z.w * scale} height={z.h * scale}
                fill="rgba(234,179,8,0.2)"
                stroke="rgba(245,158,11,0.45)"
                strokeWidth={0.5}
                rx={1}
              />
            );
          })}

          {(barriers || []).map(b => {
            const x1 = b.x1 ?? b.x;
            const y1 = b.y1 ?? b.y;
            const x2 = b.x2 ?? b.x + (b.dx || 0);
            const y2 = b.y2 ?? b.y + (b.dy || 0);
            const p1 = toMM(x1, y1);
            const p2 = toMM(x2, y2);
            return (
              <line key={b.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth={1} />
            );
          })}

          {links.map(link => {
            const src = nodes.find(n => n.id === link.source);
            const tgt = nodes.find(n => n.id === link.target);
            if (!src || !tgt) return null;
            const p1 = toMM(src.x + NODE_W / 2, src.y + NODE_H / 2);
            const p2 = toMM(tgt.x + NODE_W / 2, tgt.y + NODE_H / 2);
            return (
              <line key={link.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth={0.8} />
            );
          })}

          {nodes.map(n => {
            const p = toMM(n.x, n.y);
            return (
              <rect key={n.id}
                x={p.x} y={p.y}
                width={NODE_W * scale} height={NODE_H * scale}
                fill={TC.primaryStr40}
                stroke={TC.primaryStr70}
                strokeWidth={0.5}
                rx={1}
              />
            );
          })}

          <rect
            x={vpX} y={vpY} width={vpW} height={vpH}
            fill={TC.primary05}
            stroke={TC.primaryStr60}
            strokeWidth={1}
            rx={2}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={onVpPointerDown}
          />
        </svg>
      )}
    </div>
  );
}
