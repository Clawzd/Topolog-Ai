/**
 * Link curve sampling and barrier intersection markers for canvas rendering.
 */
import { NODE_DIM, mergeBarrierDefaults } from './smartNetworkEngine';

const NODE_W = NODE_DIM.W;
const NODE_H = NODE_DIM.H;

function getEdgePoint(node, targetX, targetY) {
  const cx = node.x + NODE_W / 2;
  const cy = node.y + NODE_H / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  const angle = Math.atan2(dy, dx);
  const hw = NODE_W / 2 + 4;
  const hh = NODE_H / 2 + 4;
  const absCos = Math.abs(Math.cos(angle));
  const absSin = Math.abs(Math.sin(angle));
  let t;
  if (hw * absSin <= hh * absCos) {
    t = hw / (Math.abs(dx) || 1);
  } else {
    t = hh / (Math.abs(dy) || 1);
  }
  return { x: cx + dx * t, y: cy + dy * t };
}

function curveControl(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  const curve = Math.min(dist * 0.35, 80);
  const nx = -dy / dist;
  const ny = dx / dist;
  return { mx: (x1 + x2) / 2 + nx * curve * 0.3, my: (y1 + y2) / 2 + ny * curve * 0.3 };
}

function quadPoint(x1, y1, qx, qy, x2, y2, t) {
  const o = 1 - t;
  return { x: o * o * x1 + 2 * o * t * qx + t * t * x2, y: o * o * y1 + 2 * o * t * qy + t * t * y2 };
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  return o1 !== o2 && o3 !== o4;
}

function orient(ax, ay, bx, by, cx, cy) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : 2;
}

function segmentCrossesRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const edges = [
    [rx, ry, rx + rw, ry],
    [rx + rw, ry, rx + rw, ry + rh],
    [rx + rw, ry + rh, rx, ry + rh],
    [rx, ry + rh, rx, ry],
  ];
  return edges.some(([ex1, ey1, ex2, ey2]) => segmentsCross(x1, y1, x2, y2, ex1, ey1, ex2, ey2));
}

function barrierSegmentHits(barrier, ax, ay, bx, by) {
  const b = mergeBarrierDefaults(barrier);
  if (b.shape === 'rect') {
    return (
      segmentCrossesRect(ax, ay, bx, by, b.x, b.y, b.w, b.h) ||
      (ax >= b.x && ax <= b.x + b.w && ay >= b.y && ay <= b.y + b.h) ||
      (bx >= b.x && bx <= b.x + b.w && by >= b.y && by <= b.y + b.h)
    );
  }
  const lx1 = b.x1 ?? b.x;
  const ly1 = b.y1 ?? b.y;
  const lx2 = b.x2 ?? b.x + (b.dx || 0);
  const ly2 = b.y2 ?? b.y + (b.dy || 0);
  return segmentsCross(ax, ay, bx, by, lx1, ly1, lx2, ly2);
}

/** Wired links use cable-blocking barriers; WiFi uses RF-blocking barriers. */
export function barrierRelevantForLink(linkType, barrier) {
  const b = mergeBarrierDefaults(barrier);
  if (linkType === 'wifi') return b.blocksWifi;
  return b.blocksCablePath;
}

/**
 * Sample the link's quadratic bezier; return up to 3 marker positions where the curve crosses a barrier.
 */
export function getLinkBarrierCrossings(nodes, link, barriers) {
  const lt = link.type || 'ethernet';
  const src = nodes.find((n) => n.id === link.source);
  const tgt = nodes.find((n) => n.id === link.target);
  if (!src || !tgt || !barriers?.length) return [];

  const tcx = tgt.x + NODE_W / 2;
  const tcy = tgt.y + NODE_H / 2;
  const scx = src.x + NODE_W / 2;
  const scy = src.y + NODE_H / 2;
  const p1 = getEdgePoint(src, tcx, tcy);
  const p2 = getEdgePoint(tgt, scx, scy);
  const { mx, my } = curveControl(p1.x, p1.y, p2.x, p2.y);

  const markers = [];
  const seen = new Set();
  const steps = 24;
  let prev = { x: p1.x, y: p1.y };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cur = quadPoint(p1.x, p1.y, mx, my, p2.x, p2.y, t);
    for (const br of barriers) {
      if (!barrierRelevantForLink(lt, br)) continue;
      if (!barrierSegmentHits(br, prev.x, prev.y, cur.x, cur.y)) continue;
      const key = br.id;
      if (seen.has(key)) continue;
      seen.add(key);
      markers.push({
        x: (prev.x + cur.x) / 2,
        y: (prev.y + cur.y) / 2,
        barrierId: br.id,
      });
      if (markers.length >= 4) return markers;
    }
    prev = cur;
  }
  return markers;
}

export function linkEndpointsForRender(nodes, link, lateralPx = 0) {
  const src = nodes.find((n) => n.id === link.source);
  const tgt = nodes.find((n) => n.id === link.target);
  if (!src || !tgt) return null;
  const tcx = tgt.x + NODE_W / 2;
  const tcy = tgt.y + NODE_H / 2;
  const scx = src.x + NODE_W / 2;
  const scy = src.y + NODE_H / 2;
  const p1 = getEdgePoint(src, tcx, tcy);
  const p2 = getEdgePoint(tgt, scx, scy);
  const { mx, my } = curveControl(p1.x, p1.y, p2.x, p2.y);
  if (!lateralPx) return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, mx, my };
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const d = Math.hypot(dx, dy) || 1;
  const ox = (-dy / d) * lateralPx;
  const oy = (dx / d) * lateralPx;
  return { x1: p1.x + ox, y1: p1.y + oy, x2: p2.x + ox, y2: p2.y + oy, mx: mx + ox, my: my + oy };
}
