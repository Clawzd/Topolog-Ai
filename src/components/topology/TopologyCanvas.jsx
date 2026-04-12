import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { DEVICE_TYPES, LINK_TYPES } from '../../lib/topologyData';
import DEVICE_ICONS from '../../lib/deviceIcons';
import { NODE_DIM, heatmapSignalSamples, mergeRoomDefaults } from '../../lib/smartNetworkEngine';

const NODE_W = NODE_DIM.W;
const NODE_H = NODE_DIM.H;

/** Half-size of world background + grid in canvas units (effectively infinite workspace) */
const GRID_EXTENT = 250000;
const GRID_MINOR = 40;
const GRID_MAJOR = 200;

// Get nearest edge point from node center toward target
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

// Cubic bezier path between two points
function getCurvePath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const curve = Math.min(dist * 0.35, 80);
  // Perpendicular offset for slight curve
  const nx = -dy / dist;
  const ny = dx / dist;
  const mx = (x1 + x2) / 2 + nx * curve * 0.3;
  const my = (y1 + y2) / 2 + ny * curve * 0.3;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

export default function TopologyCanvas({
  nodes, links, rooms, vlans,
  barriers = [],
  vlanZones = [],
  smartSnapshot = null,
  heatmapMode = null,
  showTrafficFlow = false,
  showComplianceView = false,
  showPowerView = false,
  showApAdvisor = false,
  failureImpactIds = null,
  pathTracePath = null,
  pulseNodeId = null,
  onBarrierAdd,
  onVlanZoneAdd,
  onGhostApPlace,
  selectedId, setSelectedId,
  selectedIds, onMultiSelect,
  mode, setMode,
  onNodeMove, onNodeAdd, onLinkAdd, onLinkUpdate, onLinkDelete, onRoomAdd, onRoomResize, onRoomMove,
  onBeforeChange,
  zoom, pan, setZoom, setPan,
  connectingFrom, setConnectingFrom,
  highlightVlan,
  onContextMenuRequest,
}) {
  const svgRef = useRef(null);
  const roomMoveHistoryPushedRef = useRef(false);
  const [dragging, setDragging] = useState(null);
  const [resizingRoom, setResizingRoom] = useState(null); // {id, handle, origRoom, startX, startY}
  const [draggingRoom, setDraggingRoom] = useState(null); // {id, origX, origY, startClientX, startClientY}
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverLink, setHoverLink] = useState(null);
  const [drawingRoom, setDrawingRoom] = useState(null);
  const [drawingBarrier, setDrawingBarrier] = useState(null);
  const [drawingVlanZone, setDrawingVlanZone] = useState(null);
  const [mouseCanvas, setMouseCanvas] = useState({ x: 0, y: 0 });
  const [selectionRect, setSelectionRect] = useState(null); // {startX, startY, x, y, w, h}
  const [tooltip, setTooltip] = useState(null); // {x, y, link}

  const svgToCanvas = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  }, [zoom, pan]);

  const getVlanColor = (vlanName) => {
    if (!vlanName) return null;
    const v = vlans.find(v => v.name === vlanName);
    return v ? v.color : null;
  };

  const heatSamples = useMemo(() => {
    if (heatmapMode !== 'signal' || !nodes.length) return [];
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 160;
    const maxX = Math.max(...xs) + NODE_W + 160;
    const minY = Math.min(...ys) - 120;
    const maxY = Math.max(...ys) + NODE_H + 120;
    return heatmapSignalSamples(nodes, rooms, barriers, { minX, maxX, minY, maxY }, 48);
  }, [heatmapMode, nodes, rooms, barriers]);

  const badgeStyle = (tone) => {
    const map = {
      excellent: { bg: 'rgba(16,185,129,0.95)', fg: '#fff' },
      good: { bg: 'rgba(34,197,94,0.85)', fg: '#052e16' },
      weak: { bg: 'rgba(245,158,11,0.95)', fg: '#1a0f00' },
      slow: { bg: 'rgba(249,115,22,0.95)', fg: '#1a0f00' },
      critical: { bg: 'rgba(239,68,68,0.95)', fg: '#fff' },
      isolated: { bg: 'rgba(168,85,247,0.9)', fg: '#fff' },
      power: { bg: 'rgba(234,179,8,0.95)', fg: '#1a1400' },
      risk: { bg: 'rgba(245,158,11,0.35)', fg: '#fef3c7', stroke: true },
    };
    return map[tone] || map.good;
  };

  const getLinkPoints = useCallback((link) => {
    const src = nodes.find(n => n.id === link.source);
    const tgt = nodes.find(n => n.id === link.target);
    if (!src || !tgt) return null;
    const tcx = tgt.x + NODE_W / 2, tcy = tgt.y + NODE_H / 2;
    const scx = src.x + NODE_W / 2, scy = src.y + NODE_H / 2;
    const p1 = getEdgePoint(src, tcx, tcy);
    const p2 = getEdgePoint(tgt, scx, scy);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, mx: (p1.x+p2.x)/2, my: (p1.y+p2.y)/2 };
  }, [nodes]);

  const handleMouseDown = (e) => {
    if (e.button === 1) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); return; }
    if (e.button !== 0) return;
    const { x, y } = svgToCanvas(e.clientX, e.clientY);
    if (mode === 'pan') { setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); return; }
    if (mode === 'room') { setDrawingRoom({ x, y, w: 0, h: 0 }); return; }
    if (mode === 'barrier') { setDrawingBarrier({ x1: x, y1: y, x2: x, y2: y }); return; }
    if (mode === 'vlanzone') { setDrawingVlanZone({ x, y, w: 0, h: 0 }); return; }
    if (mode === 'select' || mode === 'connect') {
      const clicked = nodes.find(n => x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H);
      if (clicked) {
        if (mode === 'connect') {
          if (!connectingFrom) { setConnectingFrom(clicked.id); }
          else if (connectingFrom !== clicked.id) {
            onLinkAdd(connectingFrom, clicked.id);
            setConnectingFrom(null);
          }
          return;
        }
        const dragIds = selectedIds?.includes(clicked.id) && selectedIds.length > 1
          ? selectedIds
          : [clicked.id];
        const origins = Object.fromEntries(
          nodes
            .filter(node => dragIds.includes(node.id))
            .map(node => [node.id, { x: node.x, y: node.y }])
        );
        onBeforeChange && onBeforeChange();
        setSelectedId(dragIds.length === 1 ? clicked.id : null);
        if (dragIds.length === 1) onMultiSelect && onMultiSelect([]);
        setDragging({ ids: dragIds, startX: e.clientX, startY: e.clientY, origins });
      } else {
        // Check if clicking a room (drag to move; resize uses handle stopPropagation)
        const hitBarrier = (barriers || []).find((b) => {
          const lx1 = b.x1 ?? b.x;
          const ly1 = b.y1 ?? b.y;
          const lx2 = b.x2 ?? b.x + (b.dx || 0);
          const ly2 = b.y2 ?? b.y + (b.dy || 0);
          return pointToSegmentDist(x, y, lx1, ly1, lx2, ly2) < 14;
        });
        if (hitBarrier && mode === 'select') {
          setSelectedId(hitBarrier.id);
          onMultiSelect && onMultiSelect([]);
          return;
        }
        const hitVz = (vlanZones || []).find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
        if (hitVz && mode === 'select') {
          setSelectedId(hitVz.id);
          onMultiSelect && onMultiSelect([]);
          return;
        }
        const clickedRoom = rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (clickedRoom && mode === 'select') {
          setSelectedId(clickedRoom.id);
          onMultiSelect && onMultiSelect([]);
          roomMoveHistoryPushedRef.current = false;
          setDraggingRoom({
            id: clickedRoom.id,
            origX: clickedRoom.x,
            origY: clickedRoom.y,
            startClientX: e.clientX,
            startClientY: e.clientY,
          });
        } else {
          setSelectedId(null);
          if (mode === 'select') {
            setSelectionRect({ startX: x, startY: y, x, y, w: 0, h: 0 });
          }
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const { x, y } = svgToCanvas(e.clientX, e.clientY);
    setMouseCanvas({ x, y });
    if (resizingRoom) {
      const { id, handle, origRoom, startX, startY } = resizingRoom;
      const dx = x - startX;
      const dy = y - startY;
      let { x: rx, y: ry, w: rw, h: rh } = origRoom;
      if (handle.includes('w')) { rx = origRoom.x + dx; rw = origRoom.w - dx; }
      if (handle.includes('e')) { rw = origRoom.w + dx; }
      if (handle.includes('n')) { ry = origRoom.y + dy; rh = origRoom.h - dy; }
      if (handle.includes('s')) { rh = origRoom.h + dy; }
      if (rw > 30 && rh > 30) onRoomResize && onRoomResize(id, { x: rx, y: ry, w: rw, h: rh });
      return;
    }
    if (draggingRoom) {
      const dx = (e.clientX - draggingRoom.startClientX) / zoom;
      const dy = (e.clientY - draggingRoom.startClientY) / zoom;
      if (!roomMoveHistoryPushedRef.current && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        roomMoveHistoryPushedRef.current = true;
        onBeforeChange && onBeforeChange();
      }
      onRoomMove && onRoomMove(draggingRoom.id, draggingRoom.origX + dx, draggingRoom.origY + dy);
      return;
    }
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoom;
      const dy = (e.clientY - dragging.startY) / zoom;
      dragging.ids.forEach(id => {
        const origin = dragging.origins[id];
        if (origin) onNodeMove(id, origin.x + dx, origin.y + dy);
      });
      return;
    }
    if (isPanning) { setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); return; }
    if (selectionRect) {
      const rx = Math.min(selectionRect.startX, x);
      const ry = Math.min(selectionRect.startY, y);
      const rw = Math.abs(x - selectionRect.startX);
      const rh = Math.abs(y - selectionRect.startY);
      setSelectionRect(r => ({ ...r, x: rx, y: ry, w: rw, h: rh }));
      return;
    }
    if (drawingRoom) { setDrawingRoom(r => ({ ...r, w: x - r.x, h: y - r.y })); return; }
    if (drawingBarrier) { setDrawingBarrier(b => ({ ...b, x2: x, y2: y })); return; }
    if (drawingVlanZone) { setDrawingVlanZone(r => ({ ...r, w: x - r.x, h: y - r.y })); }
  };

  const handleMouseUp = () => {
    if (resizingRoom) { setResizingRoom(null); return; }
    if (draggingRoom) {
      roomMoveHistoryPushedRef.current = false;
      setDraggingRoom(null);
      return;
    }
    if (dragging) { setDragging(null); return; }
    if (isPanning) { setIsPanning(false); return; }
    if (selectionRect) {
      const { x, y, w, h } = selectionRect;
      if (w > 8 || h > 8) {
        const selected = nodes.filter(n =>
          n.x + NODE_W > x && n.x < x + w && n.y + NODE_H > y && n.y < y + h
        ).map(n => n.id);
        onMultiSelect && onMultiSelect(selected);
        if (selected.length === 1) setSelectedId(selected[0]);
      }
      setSelectionRect(null);
      return;
    }
    if (drawingRoom && mode === 'room') {
      const { x, y, w, h } = drawingRoom;
      if (Math.abs(w) > 20 && Math.abs(h) > 20)
        onRoomAdd({ x: w < 0 ? x + w : x, y: h < 0 ? y + h : y, w: Math.abs(w), h: Math.abs(h) });
      setDrawingRoom(null);
      return;
    }
    if (drawingBarrier && mode === 'barrier') {
      const { x1, y1, x2, y2 } = drawingBarrier;
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len > 15 && onBarrierAdd) {
        onBeforeChange && onBeforeChange();
        onBarrierAdd({
          shape: 'line',
          x1, y1, x2, y2,
          barrierType: 'concrete',
          thickness: 'medium',
          blocksWifi: true,
          blocksCablePath: false,
          label: 'Barrier',
        });
      }
      setDrawingBarrier(null);
      return;
    }
    if (drawingVlanZone && mode === 'vlanzone') {
      const { x, y, w, h } = drawingVlanZone;
      if (Math.abs(w) > 20 && Math.abs(h) > 20 && onVlanZoneAdd) {
        onBeforeChange && onBeforeChange();
        const vx = w < 0 ? x + w : x;
        const vy = h < 0 ? y + h : y;
        onVlanZoneAdd({
          x: vx,
          y: vy,
          w: Math.abs(w),
          h: Math.abs(h),
          vlanName: vlans[0]?.name || 'VLAN10',
          label: vlans[0] ? `${vlans[0].name} overlay` : 'VLAN overlay',
          color: (vlans[0]?.color || '#3b82f6') + '22',
        });
      }
      setDrawingVlanZone(null);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setZoom(z => {
      const nz = Math.min(3, Math.max(0.05, z * delta));
      setPan(p => ({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) }));
      return nz;
    });
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [zoom, pan]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    const { x, y } = svgToCanvas(e.clientX, e.clientY);
    const node = nodes.find(n => x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H);
    if (node) { onContextMenuRequest && onContextMenuRequest(e.clientX, e.clientY, { type: 'node', id: node.id, item: node }); return; }
    // Check links (approximate hit test on midpoint)
    for (const link of links) {
      const pts = getLinkPoints(link);
      if (!pts) continue;
      const { mx, my } = pts;
      if (Math.abs(x - mx) < 20 && Math.abs(y - my) < 20) {
        onContextMenuRequest && onContextMenuRequest(e.clientX, e.clientY, { type: 'link', id: link.id, item: link }); return;
      }
    }
    const room = rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (room) { onContextMenuRequest && onContextMenuRequest(e.clientX, e.clientY, { type: 'room', id: room.id, item: room }); return; }
    const vz = vlanZones.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    if (vz) { onContextMenuRequest && onContextMenuRequest(e.clientX, e.clientY, { type: 'vlanZone', id: vz.id, item: vz }); return; }
    for (const b of barriers) {
      const d = 8 / zoom;
      if (b.shape === 'line' || (!b.shape && b.x1 != null)) {
        const lx1 = b.x1 ?? b.x;
        const ly1 = b.y1 ?? b.y;
        const lx2 = b.x2 ?? b.x + (b.dx || 0);
        const ly2 = b.y2 ?? b.y + (b.dy || 0);
        const distSeg = pointToSegmentDist(x, y, lx1, ly1, lx2, ly2);
        if (distSeg < d * 4) {
          onContextMenuRequest && onContextMenuRequest(e.clientX, e.clientY, { type: 'barrier', id: b.id, item: b });
          return;
        }
      }
    }
    onContextMenuRequest && onContextMenuRequest(e.clientX, e.clientY, { type: 'canvas', item: null });
  };

  const handleDoubleClick = (e) => {
    if (mode !== 'select') return;
    const { x, y } = svgToCanvas(e.clientX, e.clientY);
    const clickedNode = nodes.find(n => x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H);
    const clickedRoom = rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (clickedNode || clickedRoom) return;
    onNodeAdd && onNodeAdd('switch', x - NODE_W / 2, y - NODE_H / 2);
  };

  const getModeClass = () => {
    if (mode === 'pan') return 'mode-pan';
    if (mode === 'connect') return 'mode-connect';
    if (mode === 'room') return 'mode-room';
    if (mode === 'barrier') return 'mode-room';
    if (mode === 'vlanzone') return 'mode-room';
    return '';
  };

  const renderBarrier = (b) => {
    const lx1 = b.x1 ?? b.x;
    const ly1 = b.y1 ?? b.y;
    const lx2 = b.x2 ?? b.x + (b.dx || 0);
    const ly2 = b.y2 ?? b.y + (b.dy || 0);
    const isSel = selectedId === b.id;
    const stroke =
      b.barrierType === 'concrete' ? '#64748b'
        : b.barrierType === 'metal' ? '#94a3b8'
          : b.barrierType === 'glass' ? '#7dd3fc'
            : '#78716c';
    return (
      <g key={b.id}>
        <line
          x1={lx1} y1={ly1} x2={lx2} y2={ly2}
          stroke={stroke}
          strokeWidth={isSel ? 5 : 3}
          strokeLinecap="round"
          opacity={0.9}
          style={{ cursor: mode === 'select' ? 'pointer' : undefined }}
          onMouseDown={(e) => {
            if (mode !== 'select') return;
            e.stopPropagation();
            setSelectedId(b.id);
            onMultiSelect && onMultiSelect([]);
          }}
        />
        {b.barrierType === 'concrete' && (
          <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="#0f172a" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} pointerEvents="none" />
        )}
      </g>
    );
  };

  const renderVlanZone = (z) => {
    const isSel = selectedId === z.id;
    return (
      <rect
        key={z.id}
        x={z.x} y={z.y} width={z.w} height={z.h}
        fill={z.color || 'rgba(59,130,246,0.1)'}
        stroke={isSel ? 'rgba(20,184,166,0.9)' : 'rgba(99,102,241,0.45)'}
        strokeWidth={isSel ? 2 : 1}
        strokeDasharray="6 4"
        rx={4}
        style={{ cursor: mode === 'select' ? 'pointer' : undefined }}
        onMouseDown={(e) => {
          if (mode !== 'select') return;
          e.stopPropagation();
          setSelectedId(z.id);
          onMultiSelect && onMultiSelect([]);
        }}
      />
    );
  };

  const renderNode = (node) => {
    const isSelected = selectedId === node.id;
    const isHovered = hoverNode === node.id;
    const isConnecting = connectingFrom === node.id;
    const dt = DEVICE_TYPES[node.type] || DEVICE_TYPES.pc;
    const vlanColor = getVlanColor(node.vlan);
    const dimmed = highlightVlan && node.vlan !== highlightVlan;
    const IconEl = DEVICE_ICONS[node.type] || DEVICE_ICONS.pc;
    const glowColor = isSelected || isConnecting ? '#14b8a6' : dt.color;
    const ds = smartSnapshot?.deviceStates?.[node.id];
    const badge = ds?.badgeLabel && ds.badgeTone ? badgeStyle(ds.badgeTone) : null;
    const failPulse = failureImpactIds?.has?.(node.id);

    return (
      <g key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onMouseEnter={() => setHoverNode(node.id)}
        onMouseLeave={() => setHoverNode(null)}
        style={{ opacity: dimmed ? 0.2 : 1, transition: 'opacity 0.2s', cursor: mode === 'connect' ? 'crosshair' : 'grab' }}
      >
        {(isSelected || isConnecting) && (
          <rect x={-4} y={-4} width={NODE_W+8} height={NODE_H+8} rx={10} fill="none"
            stroke={glowColor} strokeWidth={1.5} opacity={0.4}
            style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }} />
        )}
        <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={7}
          fill={isSelected || isConnecting ? 'rgba(20,184,166,0.12)' : isHovered ? 'rgba(27,35,31,0.98)' : 'rgba(15,21,19,0.95)'}
          stroke={isSelected || isConnecting ? '#14b8a6' : isHovered ? `${dt.color}80` : 'rgba(70,82,76,0.7)'}
          strokeWidth={isSelected || isConnecting ? 1.5 : 1}
          style={{ filter: isSelected ? `drop-shadow(0 0 12px ${glowColor}55)` : 'none', transition: 'all 0.15s' }}
        />
        {vlanColor && <rect x={0} y={0} width={NODE_W} height={2.5} rx={7} fill={vlanColor} opacity={0.9} />}
        <svg x={0} y={2} width={NODE_W} height={NODE_H - 16} viewBox="0 0 90 50" overflow="visible">
          {IconEl(isSelected || isConnecting ? '#14b8a6' : dt.color)}
        </svg>
        <text x={NODE_W/2} y={NODE_H-14} textAnchor="middle" fontSize={8.5} fontWeight="500"
          fill={isSelected ? '#e8f3ee' : '#9aaba3'} fontFamily="Inter, sans-serif">
          {node.label.length > 14 ? node.label.slice(0, 13) + '...' : node.label}
        </text>
        {node.ip && (
          <text x={NODE_W/2} y={NODE_H-4} textAnchor="middle" fontSize={6.5} fill="#68766f" fontFamily="JetBrains Mono, monospace">
            {node.ip}
          </text>
        )}
        {isConnecting && (
          <>
            <circle cx={NODE_W/2} cy={NODE_H/2} r={52} fill="none" stroke="#14b8a6" strokeWidth={1.5} className="wave-ring-1" opacity={0.6} />
            <circle cx={NODE_W/2} cy={NODE_H/2} r={52} fill="none" stroke="#14b8a6" strokeWidth={1} className="wave-ring-2" opacity={0.4} />
          </>
        )}
        {isSelected && !isConnecting && (
          <circle cx={NODE_W/2} cy={NODE_H/2} r={52} fill="none" stroke="#14b8a6" strokeWidth={1} className="wave-ring-1" opacity={0.35} />
        )}
        {failPulse && (
          <rect x={-2} y={-2} width={NODE_W + 4} height={NODE_H + 4} rx={9} fill="none" stroke="#ef4444" strokeWidth={2} opacity={0.85} className="wave-ring-1" />
        )}
        {pulseNodeId === node.id && (
          <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={11} fill="none" stroke="#facc15" strokeWidth={2} className="wave-ring-2" />
        )}
        {badge && (
          <g transform={`translate(${NODE_W - 2}, 2)`}>
            <title>{(ds?.reasons || []).concat(ds?.suggestions || []).join('\n')}</title>
            <rect x={-36} y={0} width={36} height={12} rx={3} fill={badge.bg} stroke={badge.stroke ? '#fbbf24' : 'none'} strokeWidth={0.5} />
            <text x={-18} y={8.5} textAnchor="middle" fontSize={6.5} fontWeight="700" fill={badge.fg} fontFamily="JetBrains Mono, monospace">
              {ds.badgeLabel}
            </text>
          </g>
        )}
        {/* Connect-mode port dots on hover */}
        {mode === 'connect' && isHovered && (
          <circle cx={NODE_W/2} cy={NODE_H/2} r={NODE_W/2+2} fill="rgba(20,184,166,0.06)" stroke="rgba(20,184,166,0.5)" strokeWidth={1.5} strokeDasharray="4 3"/>
        )}
      </g>
    );
  };

  const renderLink = (link) => {
    const pts = getLinkPoints(link);
    if (!pts) return null;
    const lt = LINK_TYPES[link.type] || LINK_TYPES.ethernet;
    const { x1, y1, x2, y2, mx, my } = pts;
    const isSelected = selectedId === link.id;
    const isHovered = hoverLink === link.id;
    const path = getCurvePath(x1, y1, x2, y2);

    const srcNode = nodes.find(n => n.id === link.source);
    const tgtNode = nodes.find(n => n.id === link.target);
    const dimmed = highlightVlan && srcNode?.vlan !== highlightVlan && tgtNode?.vlan !== highlightVlan;
    const util = link.utilizationPercent ?? smartSnapshot?.bottleneckLinks?.find(b => b.linkId === link.id)?.utilization ?? 0;
    let heatStroke = lt.color;
    let heatWidth = isSelected ? 2.5 : isHovered ? 2 : 1.5;
    if (heatmapMode === 'bandwidth') {
      heatWidth += Math.min(4, util / 25);
      if (util > 90) heatStroke = '#ef4444';
      else if (util > 70) heatStroke = '#f97316';
      else if (util > 50) heatStroke = '#eab308';
      else heatStroke = '#22c55e';
    }

    return (
      <g key={link.id} style={{ opacity: dimmed ? 0.1 : 1, transition: 'opacity 0.2s' }}>
        {/* Wide invisible click area */}
        <path d={path} fill="none" stroke="transparent" strokeWidth={16}
          onClick={() => setSelectedId(link.id)}
          onContextMenu={(e) => { e.preventDefault(); onContextMenuRequest && onContextMenuRequest(e.clientX, e.clientY, { type: 'link', id: link.id, item: link }); }}
          onMouseEnter={(e) => {
            setHoverLink(link.id);
            setTooltip({ x: e.clientX, y: e.clientY, link });
          }}
          onMouseLeave={() => { setHoverLink(null); setTooltip(null); }}
          style={{ cursor: 'pointer' }}
        />
        {/* Glow behind selected */}
        {isSelected && (
          <path d={path} fill="none" stroke={lt.color} strokeWidth={8} opacity={0.12} style={{ pointerEvents: 'none' }} />
        )}
        {/* Base line (static, slightly faded) */}
        <path d={path} fill="none"
          stroke={isSelected ? '#14b8a6' : lt.color}
          strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
          opacity={0.15}
          style={{ pointerEvents: 'none' }}
        />
        {/* Animated flowing line */}
        <path d={path} fill="none"
          stroke={heatmapMode === 'bandwidth' ? heatStroke : (isSelected ? '#14b8a6' : lt.color)}
          strokeWidth={heatmapMode === 'bandwidth' ? heatWidth : (isSelected ? 2.5 : isHovered ? 2 : 1.5)}
          strokeDasharray={isSelected ? '10 8' : lt.dash ? '6 10' : '10 8'}
          opacity={isSelected ? 0.9 : isHovered ? 0.8 : 0.55}
          className={showTrafficFlow ? 'link-flow-fast' : isSelected ? 'link-flow-fast' : 'link-flow'}
          style={{ pointerEvents: 'none', transition: 'stroke-width 0.15s, opacity 0.15s' }}
        />

        {/* Midpoint label chip */}
        {(isHovered || isSelected) && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={mx-20} y={my-8} width={40} height={14} rx={5}
              fill="rgba(14,20,18,0.92)" stroke={isSelected ? '#14b8a6' : lt.color} strokeWidth={0.8} />
            <text x={mx} y={my+0.5} textAnchor="middle" fontSize={7.5} fontFamily="Inter, sans-serif"
              fill={isSelected ? '#14b8a6' : '#9aaba3'} dominantBaseline="middle">
              {link.label || lt.label}
            </text>
          </g>
        )}
        {/* Endpoint dots */}
        {(isSelected || isHovered) && (
          <>
            <circle cx={x1} cy={y1} r={3} fill={isSelected ? '#14b8a6' : lt.color} opacity={0.8} style={{ pointerEvents: 'none' }} />
            <circle cx={x2} cy={y2} r={3} fill={isSelected ? '#14b8a6' : lt.color} opacity={0.8} style={{ pointerEvents: 'none' }} />
          </>
        )}
      </g>
    );
  };

  const renderRoom = (room) => {
    const isSelected = selectedId === room.id;
    const rm = mergeRoomDefaults(room);
    const complianceFill = showComplianceView && {
      public: 'rgba(34,197,94,0.07)',
      staff: 'rgba(59,130,246,0.09)',
      restricted: 'rgba(245,158,11,0.11)',
      critical: 'rgba(239,68,68,0.13)',
    }[rm.securityLevel];
    const HS = 7; // handle size
    const handles = [
      { id: 'nw', x: room.x,            y: room.y,            cursor: 'nw-resize' },
      { id: 'ne', x: room.x + room.w,   y: room.y,            cursor: 'ne-resize' },
      { id: 'sw', x: room.x,            y: room.y + room.h,   cursor: 'sw-resize' },
      { id: 'se', x: room.x + room.w,   y: room.y + room.h,   cursor: 'se-resize' },
      { id: 'n',  x: room.x + room.w/2, y: room.y,            cursor: 'n-resize' },
      { id: 's',  x: room.x + room.w/2, y: room.y + room.h,   cursor: 's-resize' },
      { id: 'e',  x: room.x + room.w,   y: room.y + room.h/2, cursor: 'e-resize' },
      { id: 'w',  x: room.x,            y: room.y + room.h/2, cursor: 'w-resize' },
    ];
    return (
      <g key={room.id}>
        {complianceFill && (
          <rect x={room.x} y={room.y} width={room.w} height={room.h} fill={complianceFill} rx={6} style={{ pointerEvents: 'none' }} />
        )}
        <rect x={room.x} y={room.y} width={room.w} height={room.h}
          fill={room.color || 'rgba(59,130,246,0.06)'}
          stroke={isSelected ? 'rgba(20,184,166,0.7)' : 'rgba(75,87,80,0.25)'}
          strokeWidth={isSelected ? 1.5 : 1} strokeDasharray="8 5" rx={6}
          style={{ pointerEvents: mode === 'select' ? 'visible' : 'none', cursor: mode === 'select' ? 'grab' : undefined }}
        />
        <rect x={room.x+6} y={room.y+5} width={room.label.length*5.5+12} height={14} rx={4} fill="rgba(14,20,18,0.72)" style={{ pointerEvents: 'none' }} />
        <text x={room.x+12} y={room.y+13} fontSize={9} fontWeight="500"
          fill={isSelected ? 'rgba(20,184,166,0.9)' : 'rgba(154,171,163,0.8)'}
          fontFamily="Inter, sans-serif" dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}>{room.label}</text>
        {/* Resize handles - only when selected */}
        {isSelected && handles.map(h => (
          <rect key={h.id}
            x={h.x - HS/2} y={h.y - HS/2} width={HS} height={HS}
            fill="#14b8a6" stroke="rgba(255,255,255,0.85)" strokeWidth={1.2} rx={1.5}
            style={{ cursor: h.cursor }}
            onMouseDown={(e) => {
              e.stopPropagation();
              const { x, y } = svgToCanvas(e.clientX, e.clientY);
              onBeforeChange && onBeforeChange();
              setResizingRoom({ id: room.id, handle: h.id, origRoom: { ...room }, startX: x, startY: y });
            }}
          />
        ))}
      </g>
    );
  };

  return (
    <>
      <svg
        ref={svgRef}
        className={`canvas-container w-full h-full ${getModeClass()}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ background: 'hsl(168, 9%, 8%)' }}
      >
        <defs>
          {/* World-space square grid (moves/scales with canvas content) */}
          <pattern
            id="topo-grid-minor"
            width={GRID_MINOR}
            height={GRID_MINOR}
            patternUnits="userSpaceOnUse"
            patternContentUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID_MINOR} 0 L 0 0 0 ${GRID_MINOR}`}
              fill="none"
              stroke="hsla(155, 12%, 52%, 0.42)"
              strokeWidth={Math.max(0.2, 0.85 / zoom)}
            />
          </pattern>
          <pattern
            id="topo-grid-major"
            width={GRID_MAJOR}
            height={GRID_MAJOR}
            patternUnits="userSpaceOnUse"
            patternContentUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID_MAJOR} 0 L 0 0 0 ${GRID_MAJOR}`}
              fill="none"
              stroke="hsla(165, 14%, 58%, 0.55)"
              strokeWidth={Math.max(0.35, 1.35 / zoom)}
            />
          </pattern>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="rgba(122,135,128,0.7)" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <rect
            x={-GRID_EXTENT}
            y={-GRID_EXTENT}
            width={GRID_EXTENT * 2}
            height={GRID_EXTENT * 2}
            fill="hsl(168, 10%, 11.5%)"
            style={{ pointerEvents: 'none' }}
          />
          <rect
            x={-GRID_EXTENT}
            y={-GRID_EXTENT}
            width={GRID_EXTENT * 2}
            height={GRID_EXTENT * 2}
            fill="url(#topo-grid-minor)"
            style={{ pointerEvents: 'none' }}
          />
          <rect
            x={-GRID_EXTENT}
            y={-GRID_EXTENT}
            width={GRID_EXTENT * 2}
            height={GRID_EXTENT * 2}
            fill="url(#topo-grid-major)"
            style={{ pointerEvents: 'none' }}
          />
          {heatmapMode === 'signal' && heatSamples.map((s, i) => (
            <circle
              key={`h-${i}`}
              cx={s.x} cy={s.y} r={22}
              fill={s.strength > 75 ? 'rgba(6,182,212,0.14)' : s.strength > 50 ? 'rgba(59,130,246,0.1)' : s.strength > 25 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.12)'}
              style={{ pointerEvents: 'none' }}
            />
          ))}
          {(vlanZones || []).map(renderVlanZone)}
          {rooms.map(renderRoom)}
          {(barriers || []).map(renderBarrier)}
          {links.map(renderLink)}
          {pathTracePath && pathTracePath.length > 1 && (
            <path
              d={pathTracePath.map((id, i) => {
                const n = nodes.find(nn => nn.id === id);
                if (!n) return '';
                const cx = n.x + NODE_W / 2;
                const cy = n.y + NODE_H / 2;
                return `${i === 0 ? 'M' : 'L'} ${cx} ${cy}`;
              }).join(' ')}
              fill="none"
              stroke="rgba(6,182,212,0.85)"
              strokeWidth={2}
              strokeDasharray="8 5"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {showPowerView && nodes.filter(n => n.type === 'pdu').map(pdu => {
            const pc = { x: pdu.x + NODE_W / 2, y: pdu.y + NODE_H / 2 };
            return nodes.filter(n => n.id !== pdu.id && Math.hypot(n.x - pdu.x, n.y - pdu.y) < 320).map(n => (
              <line
                key={`${pdu.id}-${n.id}`}
                x1={pc.x} y1={pc.y}
                x2={n.x + NODE_W / 2} y2={n.y + NODE_H / 2}
                stroke="rgba(234,179,8,0.35)"
                strokeWidth={1}
                strokeDasharray="4 3"
                style={{ pointerEvents: 'none' }}
              />
            ));
          })}
          {showApAdvisor && (smartSnapshot?.apSuggestions || []).map((g) => (
            <g
              key={g.id}
              style={{ cursor: 'pointer' }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onGhostApPlace && onGhostApPlace(g.x, g.y);
              }}
            >
              <circle cx={g.x} cy={g.y} r={36} fill="rgba(6,182,212,0.12)" stroke="rgba(6,182,212,0.55)" strokeWidth={1.5} strokeDasharray="6 4" />
              <text x={g.x} y={g.y - 44} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="JetBrains Mono, monospace">
                +{g.improvementPct}%
              </text>
            </g>
          ))}

          {/* Connection preview */}
          {connectingFrom && mode === 'connect' && (() => {
            const src = nodes.find(n => n.id === connectingFrom);
            if (!src) return null;
            const path = getCurvePath(src.x+NODE_W/2, src.y+NODE_H/2, mouseCanvas.x, mouseCanvas.y);
            return (
              <g style={{ pointerEvents: 'none' }}>
                <path d={path} fill="none" stroke="#14b8a6" strokeWidth={2} strokeDasharray="8 4" opacity={0.8} />
                <circle cx={mouseCanvas.x} cy={mouseCanvas.y} r={5}
                  fill="rgba(20,184,166,0.3)" stroke="#14b8a6" strokeWidth={1.5} />
              </g>
            );
          })()}

          {/* Multi-select highlights */}
          {selectedIds && selectedIds.length > 1 && nodes.filter(n => selectedIds.includes(n.id)).map(n => (
            <rect key={`sel-${n.id}`} x={n.x-4} y={n.y-4} width={NODE_W+8} height={NODE_H+8} rx={10}
              fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.5)" strokeWidth={1.5} strokeDasharray="5 3"
              style={{ pointerEvents: 'none' }} />
          ))}

          {nodes.map(renderNode)}

          {/* Selection rectangle */}
          {selectionRect && selectionRect.w > 4 && selectionRect.h > 4 && (
            <rect
              x={selectionRect.x} y={selectionRect.y}
              width={selectionRect.w} height={selectionRect.h}
              fill="rgba(20,184,166,0.06)" stroke="rgba(20,184,166,0.7)"
              strokeWidth={1.5} strokeDasharray="6 3" rx={4}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {drawingRoom && (
            <rect
              x={drawingRoom.w<0 ? drawingRoom.x+drawingRoom.w : drawingRoom.x}
              y={drawingRoom.h<0 ? drawingRoom.y+drawingRoom.h : drawingRoom.y}
              width={Math.abs(drawingRoom.w)} height={Math.abs(drawingRoom.h)}
              fill="rgba(20,184,166,0.05)" stroke="rgba(20,184,166,0.5)" strokeWidth={1.5} strokeDasharray="8 4" rx={6}
            />
          )}
          {drawingBarrier && (
            <line
              x1={drawingBarrier.x1} y1={drawingBarrier.y1}
              x2={drawingBarrier.x2} y2={drawingBarrier.y2}
              stroke="#64748b" strokeWidth={2} strokeDasharray="6 4"
            />
          )}
          {drawingVlanZone && (
            <rect
              x={drawingVlanZone.w<0 ? drawingVlanZone.x+drawingVlanZone.w : drawingVlanZone.x}
              y={drawingVlanZone.h<0 ? drawingVlanZone.y+drawingVlanZone.h : drawingVlanZone.y}
              width={Math.abs(drawingVlanZone.w)} height={Math.abs(drawingVlanZone.h)}
              fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.5)" strokeWidth={1.5} strokeDasharray="6 4" rx={4}
            />
          )}
        </g>
      </svg>

      {/* Link hover tooltip (outside SVG, in HTML) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-card/95 border border-border rounded-lg px-3 py-2 shadow-2xl text-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          {(() => {
            const lt = LINK_TYPES[tooltip.link.type] || LINK_TYPES.ethernet;
            const src = nodes.find(n => n.id === tooltip.link.source);
            const tgt = nodes.find(n => n.id === tooltip.link.target);
            return (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-px inline-block" style={{ background: lt.color }} />
                  <span className="font-medium text-foreground">{lt.label}</span>
                  <span className="text-muted-foreground font-mono">{lt.speed}</span>
                </div>
                <div className="text-muted-foreground">{src?.label} to {tgt?.label}</div>
                {tooltip.link.label && <div className="text-primary/80">{tooltip.link.label}</div>}
                <div className="text-[9px] text-muted-foreground/60 pt-0.5 border-t border-border">Right-click to delete</div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
