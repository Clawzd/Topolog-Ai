import { useRef, useEffect, useCallback, useState } from 'react';
import { DEVICE_TYPES, LINK_TYPES } from '../../lib/topologyData';

const NODE_W = 90;
const NODE_H = 56;

const DEVICE_ICONS = {
  router: (color) => (
    <g>
      <circle cx="45" cy="22" r="11" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="45" cy="22" r="5" fill={color} opacity="0.6"/>
      {[[34,22,28,22],[56,22,62,22],[45,11,45,5],[45,33,45,39],[37,14,33,10],[53,30,57,34],[53,14,57,10],[37,30,33,34]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5"/>
      ))}
    </g>
  ),
  switch: (color) => (
    <g>
      <rect x="26" y="16" width="38" height="14" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      {[31,37,43,49,55].map((x, i) => (
        <g key={i}>
          <rect x={x} y="21" width="4" height="4" rx="0.5" fill={color} opacity="0.7"/>
          <line x1={x+2} y1="30" x2={x+2} y2="36" stroke={color} strokeWidth="1" opacity="0.5"/>
        </g>
      ))}
    </g>
  ),
  ap: (color) => (
    <g>
      <path d="M 33 28 A 14 14 0 0 1 57 28" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4"/>
      <path d="M 37 28 A 9 9 0 0 1 53 28" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7"/>
      <path d="M 41 28 A 5 5 0 0 1 49 28" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="45" cy="28" r="2.5" fill={color}/>
      <line x1="45" y1="28" x2="45" y2="38" stroke={color} strokeWidth="1.5"/>
      <line x1="38" y1="38" x2="52" y2="38" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  server: (color) => (
    <g>
      {[10,21,32].map((y, i) => (
        <g key={i}>
          <rect x="28" y={y} width="34" height="8" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
          <circle cx="56" cy={y+4} r="2" fill={color} opacity={i===0?0.8:i===1?0.5:0.2}/>
          <rect x="31" y={y+2} width="14" height="4" rx="1" fill={color} opacity="0.12"/>
        </g>
      ))}
    </g>
  ),
  firewall: (color) => (
    <g>
      <path d="M 45 8 L 60 14 L 60 26 Q 60 38 45 44 Q 30 38 30 26 L 30 14 Z" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5"/>
      <path d="M 40 20 Q 45 16 50 20 Q 47 24 50 28 Q 45 32 40 28 Q 43 24 40 20Z" fill={color} opacity="0.5"/>
    </g>
  ),
  cloud: (color) => (
    <g>
      <path d="M 35 32 Q 30 32 30 26 Q 30 20 36 20 Q 37 14 44 14 Q 50 14 52 19 Q 58 19 58 25 Q 58 32 52 32 Z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  pc: (color) => (
    <g>
      <rect x="30" y="10" width="30" height="22" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="32" y="12" width="26" height="18" rx="1" fill={color} opacity="0.12"/>
      <line x1="40" y1="32" x2="38" y2="38" stroke={color} strokeWidth="1.5"/>
      <line x1="50" y1="32" x2="52" y2="38" stroke={color} strokeWidth="1.5"/>
      <line x1="35" y1="38" x2="55" y2="38" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  laptop: (color) => (
    <g>
      <rect x="32" y="13" width="26" height="18" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="34" y="15" width="22" height="14" rx="1" fill={color} opacity="0.12"/>
      <path d="M 27 31 Q 27 38 45 38 Q 63 38 63 31 Z" fill="none" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  printer: (color) => (
    <g>
      <rect x="31" y="18" width="28" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="35" y="12" width="20" height="8" rx="1" fill="none" stroke={color} strokeWidth="1"/>
      <rect x="35" y="34" width="20" height="10" rx="1" fill="none" stroke={color} strokeWidth="1"/>
      <circle cx="54" cy="24" r="2" fill={color} opacity="0.7"/>
    </g>
  ),
  camera: (color) => (
    <g>
      <rect x="28" y="18" width="24" height="16" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="40" cy="26" r="5" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="40" cy="26" r="2" fill={color} opacity="0.6"/>
      <path d="M 52 21 L 62 17 L 62 35 L 52 31 Z" fill="none" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  nas: (color) => (
    <g>
      <rect x="30" y="10" width="30" height="32" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      {[18,30].map((cy, i) => (
        <g key={i}>
          <circle cx="45" cy={cy} r="4" fill="none" stroke={color} strokeWidth="1"/>
          <circle cx="45" cy={cy} r="1.5" fill={color} opacity="0.6"/>
          <line x1="32" y1={cy+6} x2="38" y2={cy+6} stroke={color} strokeWidth="1" opacity="0.4"/>
        </g>
      ))}
    </g>
  ),
  phone: (color) => (
    <g>
      <rect x="35" y="8" width="20" height="36" rx="4" fill="none" stroke={color} strokeWidth="1.5"/>
      <line x1="38" y1="16" x2="52" y2="16" stroke={color} strokeWidth="1" opacity="0.4"/>
      <circle cx="45" cy="38" r="2.5" fill="none" stroke={color} strokeWidth="1"/>
      <rect x="37" y="18" width="16" height="16" rx="1" fill={color} opacity="0.1"/>
    </g>
  ),
  loadbalancer: (color) => (
    <g>
      <rect x="28" y="18" width="34" height="16" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M 45 18 L 35 10 M 45 18 L 55 10" fill="none" stroke={color} strokeWidth="1.2" opacity="0.7"/>
      <path d="M 45 34 L 35 42 M 45 34 L 55 42" fill="none" stroke={color} strokeWidth="1.2" opacity="0.7"/>
      <line x1="36" y1="26" x2="54" y2="26" stroke={color} strokeWidth="1" opacity="0.4" strokeDasharray="3 2"/>
      <text x="45" y="30" textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">LB</text>
    </g>
  ),
  tablet: (color) => (
    <g>
      <rect x="30" y="10" width="22" height="32" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="32" y="13" width="18" height="24" rx="1" fill={color} opacity="0.1"/>
      <circle cx="41" cy="39" r="1.5" fill={color} opacity="0.6"/>
      <line x1="50" y1="20" x2="58" y2="20" stroke={color} strokeWidth="1" opacity="0.3"/>
      <line x1="50" y1="26" x2="60" y2="26" stroke={color} strokeWidth="1" opacity="0.3"/>
    </g>
  ),
  iot: (color) => (
    <g>
      <polygon points="45,10 58,18 58,34 45,42 32,34 32,18" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="45" cy="26" r="5" fill="none" stroke={color} strokeWidth="1"/>
      <circle cx="45" cy="26" r="2" fill={color} opacity="0.7"/>
      {[[45,10],[58,18],[58,34],[45,42],[32,34],[32,18]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="2" fill={color} opacity="0.5"/>
      ))}
    </g>
  ),
  pdu: (color) => (
    <g>
      <rect x="30" y="14" width="30" height="24" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M 44 14 L 44 8 M 46 14 L 46 8" stroke={color} strokeWidth="1.5" opacity="0.6"/>
      <path d="M 43 22 L 45 18 L 47 22 L 45 22 L 45 30 L 43 26 L 47 26" fill={color} opacity="0.7" stroke="none"/>
      <circle cx="35" cy="32" r="2" fill={color} opacity="0.5"/>
      <circle cx="42" cy="32" r="2" fill={color} opacity="0.5"/>
      <circle cx="55" cy="32" r="2" fill={color} opacity="0.5"/>
    </g>
  ),
  patchpanel: (color) => (
    <g>
      <rect x="24" y="18" width="42" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      {[29,34,39,44,49,54,59].map((x,i) => (
        <g key={i}>
          <rect x={x} y="22" width="3" height="8" rx="0.5" fill={color} opacity="0.5"/>
          <circle cx={x+1.5} cy="21" r="1.5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.7"/>
        </g>
      ))}
    </g>
  ),
  smarttv: (color) => (
    <g>
      <rect x="22" y="12" width="46" height="28" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="25" y="15" width="40" height="22" rx="1" fill={color} opacity="0.1"/>
      <line x1="40" y1="40" x2="38" y2="44" stroke={color} strokeWidth="1.5"/>
      <line x1="50" y1="40" x2="52" y2="44" stroke={color} strokeWidth="1.5"/>
      <line x1="35" y1="44" x2="55" y2="44" stroke={color} strokeWidth="1.5"/>
      <circle cx="45" cy="26" r="5" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
      <polygon points="43,23 43,29 50,26" fill={color} opacity="0.6"/>
    </g>
  ),
};

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

export default function TopologyCanvas({
  nodes, links, rooms, vlans,
  selectedId, setSelectedId,
  selectedIds, onMultiSelect,
  mode, setMode,
  onNodeMove, onNodeAdd, onLinkAdd, onLinkUpdate, onLinkDelete, onRoomAdd, onRoomResize,
  onBeforeChange,
  zoom, pan, setZoom, setPan,
  connectingFrom, setConnectingFrom,
  highlightVlan,
  onContextMenuRequest,
}) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [resizingRoom, setResizingRoom] = useState(null); // {id, handle, origRoom, startX, startY}
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverLink, setHoverLink] = useState(null);
  const [drawingRoom, setDrawingRoom] = useState(null);
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
        // Check if clicking a room
        const clickedRoom = rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (clickedRoom && mode === 'select') {
          setSelectedId(clickedRoom.id);
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
    if (drawingRoom) { setDrawingRoom(r => ({ ...r, w: x - r.x, h: y - r.y })); }
  };

  const handleMouseUp = () => {
    if (resizingRoom) { setResizingRoom(null); return; }
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
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setZoom(z => {
      const nz = Math.min(3, Math.max(0.2, z * delta));
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
    return '';
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
          stroke={isSelected ? '#14b8a6' : lt.color}
          strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
          strokeDasharray={isSelected ? '10 8' : lt.dash ? '6 10' : '10 8'}
          opacity={isSelected ? 0.9 : isHovered ? 0.8 : 0.55}
          className={isSelected ? 'link-flow-fast' : 'link-flow'}
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
        <rect x={room.x} y={room.y} width={room.w} height={room.h}
          fill={room.color || 'rgba(59,130,246,0.06)'}
          stroke={isSelected ? 'rgba(20,184,166,0.7)' : 'rgba(75,87,80,0.25)'}
          strokeWidth={isSelected ? 1.5 : 1} strokeDasharray="8 5" rx={6}
          style={{ pointerEvents: 'none' }}
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
        style={{ background: 'transparent' }}
      >
        <defs>
          <pattern id="grid-dots" width={30*zoom} height={30*zoom} patternUnits="userSpaceOnUse"
            x={pan.x%(30*zoom)} y={pan.y%(30*zoom)}>
            <circle cx={0} cy={0} r={0.8} fill="rgba(75,87,80,0.25)" />
          </pattern>
          <pattern id="grid-major" width={120*zoom} height={120*zoom} patternUnits="userSpaceOnUse"
            x={pan.x%(120*zoom)} y={pan.y%(120*zoom)}>
            <path d={`M ${120*zoom} 0 L 0 0 0 ${120*zoom}`} fill="none" stroke="rgba(75,87,80,0.07)" strokeWidth="0.5" />
          </pattern>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="rgba(122,135,128,0.7)" />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-dots)" />
        <rect width="100%" height="100%" fill="url(#grid-major)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {rooms.map(renderRoom)}
          {links.map(renderLink)}

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
