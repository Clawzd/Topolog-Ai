import { useMemo } from 'react';

const MM_W = 160;
const MM_H = 100;
const NODE_W = 90;
const NODE_H = 50;

export default function MiniMap({ nodes, links, rooms, zoom, pan, canvasSize }) {
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
    const pad = 40;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [nodes, rooms]);

  const sceneW = bounds.maxX - bounds.minX;
  const sceneH = bounds.maxY - bounds.minY;
  const scaleX = MM_W / sceneW;
  const scaleY = MM_H / sceneH;
  const scale = Math.min(scaleX, scaleY, 1);

  const toMM = (x, y) => ({
    x: (x - bounds.minX) * scale,
    y: (y - bounds.minY) * scale,
  });

  // Viewport rectangle in minimap coords
  const vpW = (canvasSize.w / zoom) * scale;
  const vpH = (canvasSize.h / zoom) * scale;
  const vpX = (-pan.x / zoom - bounds.minX) * scale;
  const vpY = (-pan.y / zoom - bounds.minY) * scale;

  return (
    <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg overflow-hidden shadow-xl">
      <div className="px-2 py-1 border-b border-border">
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Overview</span>
      </div>
      <svg width={MM_W} height={MM_H} style={{ display: 'block' }}>
        {/* Rooms */}
        {rooms.map(r => {
          const p = toMM(r.x, r.y);
          return (
            <rect
              key={r.id}
              x={p.x} y={p.y}
              width={r.w * scale} height={r.h * scale}
              fill={r.color || 'rgba(59,130,246,0.1)'}
              stroke="rgba(75,87,80,0.3)"
              strokeWidth={0.5}
              rx={1}
            />
          );
        })}

        {/* Links */}
        {links.map(link => {
          const src = nodes.find(n => n.id === link.source);
          const tgt = nodes.find(n => n.id === link.target);
          if (!src || !tgt) return null;
          const p1 = toMM(src.x + NODE_W / 2, src.y + NODE_H / 2);
          const p2 = toMM(tgt.x + NODE_W / 2, tgt.y + NODE_H / 2);
          return (
            <line key={link.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="rgba(122,135,128,0.5)" strokeWidth={0.8} />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const p = toMM(n.x, n.y);
          return (
            <rect key={n.id}
              x={p.x} y={p.y}
              width={NODE_W * scale} height={NODE_H * scale}
              fill="rgba(20,184,166,0.4)"
              stroke="rgba(20,184,166,0.7)"
              strokeWidth={0.5}
              rx={1}
            />
          );
        })}

        {/* Viewport indicator */}
        <rect
          x={vpX} y={vpY} width={vpW} height={vpH}
          fill="rgba(20,184,166,0.05)"
          stroke="rgba(20,184,166,0.6)"
          strokeWidth={1}
          rx={2}
        />
      </svg>
    </div>
  );
}
