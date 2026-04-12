import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { DEVICE_TYPES, LINK_TYPES } from '../../lib/topologyData';
import DEVICE_ICONS from '../../lib/deviceIcons';
import { NODE_DIM, heatmapSignalSamples, mergeRoomDefaults, getCoChannelApPairs } from '../../lib/smartNetworkEngine';
import { getLinkBarrierCrossings, linkEndpointsForRender } from '../../lib/linkGeometry';
import { TC } from '../../lib/topologySvgTheme';

function redundantLateralOffsetsByLinkId(links) {
  const offset = new Map();
  const groups = {};
  (links || []).forEach((l) => {
    if (!l.redundantGroup) return;
    if (!groups[l.redundantGroup]) groups[l.redundantGroup] = [];
    groups[l.redundantGroup].push(l);
  });
  Object.values(groups).forEach((arr) => {
    const n = arr.length;
    if (n < 2) return;
    arr.forEach((link, i) => {
      offset.set(link.id, (i - (n - 1) / 2) * 7);
    });
  });
  return offset;
}

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

const ALIGN_SNAP_PX = 8;

/** Magnetic snap moving box (top-left px,py) to peer node boxes; returns snapped position + optional guide lines in world space. */
function snapBoxToPeers(px, py, peerNodes, excludeIds, nodeW, nodeH) {
  const peers = peerNodes.filter((n) => !excludeIds.has(n.id));
  if (!peers.length) return { nx: px, ny: py, gx: null, gy: null };

  const xsMoving = [px, px + nodeW / 2, px + nodeW];
  const ysMoving = [py, py + nodeH / 2, py + nodeH];

  let bestDx = 0;
  let bestAdx = ALIGN_SNAP_PX + 1;
  let gx = null;
  for (const p of peers) {
    const xs = [p.x, p.x + nodeW / 2, p.x + nodeW];
    for (const mx of xsMoving) {
      for (const tx of xs) {
        const d = tx - mx;
        const ad = Math.abs(d);
        if (ad <= ALIGN_SNAP_PX && ad < bestAdx) {
          bestAdx = ad;
          bestDx = d;
          gx = tx;
        }
      }
    }
  }

  let bestDy = 0;
  let bestAdy = ALIGN_SNAP_PX + 1;
  let gy = null;
  for (const p of peers) {
    const ys = [p.y, p.y + nodeH / 2, p.y + nodeH];
    for (const my of ysMoving) {
      for (const ty of ys) {
        const d = ty - my;
        const ad = Math.abs(d);
        if (ad <= ALIGN_SNAP_PX && ad < bestAdy) {
          bestAdy = ad;
          bestDy = d;
          gy = ty;
        }
      }
    }
  }

  return {
    nx: px + (bestAdx <= ALIGN_SNAP_PX ? bestDx : 0),
    ny: py + (bestAdy <= ALIGN_SNAP_PX ? bestDy : 0),
    gx: bestAdx <= ALIGN_SNAP_PX ? gx : null,
    gy: bestAdy <= ALIGN_SNAP_PX ? gy : null,
  };
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
  powerZones = [],
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
  onPowerZoneAdd,
  onGhostApPlace,
  selectedId, setSelectedId,
  selectedIds, onMultiSelect,
  mode, setMode,
  placementType = null,
  placementPattern = null,
  onPatternAdd,
  onNodeMove, onNodeAdd, onLinkAdd, onLinkUpdate, onLinkDelete, onRoomAdd, onRoomResize, onRoomMove,
  onBeforeChange,
  zoom, pan, setZoom, setPan,
  connectingFrom, setConnectingFrom,
  highlightVlan,
  onContextMenuRequest,
  onNodeLabelDoubleClick,
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
  const [drawingPowerZone, setDrawingPowerZone] = useState(null);
  const [mouseCanvas, setMouseCanvas] = useState({ x: 0, y: 0 });
  const [selectionRect, setSelectionRect] = useState(null); // {startX, startY, x, y, w, h}
  const [tooltip, setTooltip] = useState(null); // {x, y, link}
  const [badgeTooltip, setBadgeTooltip] = useState(null); // {x, y, nodeId}
  const [alignmentGuides, setAlignmentGuides] = useState(null); // { gx, gy } world coords or null

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
    return heatmapSignalSamples(nodes, rooms, barriers, { minX, maxX, minY, maxY }, 32);
  }, [heatmapMode, nodes, rooms, barriers]);

  const linkBwRange = useMemo(() => {
    const mbs = links.map((l) => Number(l.bandwidthMbps)).filter((n) => Number.isFinite(n) && n > 0);
    if (!mbs.length) return { min: 100, max: 10000 };
    return { min: Math.min(...mbs), max: Math.max(...mbs) };
  }, [links]);

  const redundantLateralPx = useMemo(() => redundantLateralOffsetsByLinkId(links), [links]);

  const linkBarrierMarkers = useMemo(() => {
    const m = new Map();
    (links || []).forEach((link) => {
      m.set(link.id, getLinkBarrierCrossings(nodes, link, barriers));
    });
    return m;
  }, [nodes, links, barriers]);

  const coChannelOverlay = useMemo(
    () => (heatmapMode === 'signal' ? getCoChannelApPairs(nodes) : []),
    [heatmapMode, nodes]
  );

  const unprotectedWanLinkSet = useMemo(
    () => new Set(smartSnapshot?.unprotectedWanLinkIds || []),
    [smartSnapshot?.unprotectedWanLinkIds]
  );

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

  const handleMouseDown = (e) => {
    if (e.button === 1) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); return; }
    if (e.button !== 0) return;
    const { x, y } = svgToCanvas(e.clientX, e.clientY);
    if (mode === 'pan') { setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); return; }
    if (mode === 'place' && placementPattern) {
      onPatternAdd && onPatternAdd(placementPattern, x, y);
      setMode && setMode('select');
      return;
    }
    if (mode === 'place' && placementType) {
      onNodeAdd && onNodeAdd(placementType, x - NODE_W / 2, y - NODE_H / 2);
      setMode && setMode('select');
      return;
    }
    if (mode === 'room') { setDrawingRoom({ x, y, w: 0, h: 0 }); return; }
    if (mode === 'barrier' || mode === 'noise' || mode === 'conduit' || mode === 'door' || mode === 'window' || mode === 'obstacle') {
      setDrawingBarrier({ x1: x, y1: y, x2: x, y2: y });
      return;
    }
    if (mode === 'vlanzone') { setDrawingVlanZone({ x, y, w: 0, h: 0 }); return; }
    if (mode === 'powerzone') { setDrawingPowerZone({ x, y, w: 0, h: 0 }); return; }
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
        let dragIds = selectedIds?.includes(clicked.id) && selectedIds.length > 1
          ? [...selectedIds]
          : [clicked.id];
        const seedGroups = new Set(
          nodes.filter((n) => dragIds.includes(n.id)).map((n) => n.groupId).filter(Boolean)
        );
        if (seedGroups.size) {
          dragIds = [
            ...new Set([
              ...dragIds,
              ...nodes.filter((n) => n.groupId && seedGroups.has(n.groupId)).map((n) => n.id),
            ]),
          ];
        }
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
        if (mode === 'connect' && connectingFrom) {
          setConnectingFrom(null);
          return;
        }
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
        const hitPz = (powerZones || []).find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
        if (hitPz && mode === 'select') {
          setSelectedId(hitPz.id);
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
      const primaryId = dragging.ids[0];
      const originP = dragging.origins[primaryId];
      if (!originP) {
        dragging.ids.forEach((id) => {
          const origin = dragging.origins[id];
          if (origin) onNodeMove(id, origin.x + dx, origin.y + dy);
        });
        setAlignmentGuides(null);
        return;
      }
      const rawPx = originP.x + dx;
      const rawPy = originP.y + dy;
      const exclude = new Set(dragging.ids);
      const snap = snapBoxToPeers(rawPx, rawPy, nodes, exclude, NODE_W, NODE_H);
      const sx = snap.nx - (originP.x + dx);
      const sy = snap.ny - (originP.y + dy);
      setAlignmentGuides(snap.gx != null || snap.gy != null ? { gx: snap.gx, gy: snap.gy } : null);
      dragging.ids.forEach((id) => {
        const origin = dragging.origins[id];
        if (origin) onNodeMove(id, origin.x + dx + sx, origin.y + dy + sy);
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
    if (drawingVlanZone) { setDrawingVlanZone(r => ({ ...r, w: x - r.x, h: y - r.y })); return; }
    if (drawingPowerZone) { setDrawingPowerZone(r => ({ ...r, w: x - r.x, h: y - r.y })); }
  };

  const handleMouseUp = () => {
    if (resizingRoom) { setResizingRoom(null); return; }
    if (draggingRoom) {
      roomMoveHistoryPushedRef.current = false;
      setDraggingRoom(null);
      return;
    }
    if (dragging) {
      setDragging(null);
      setAlignmentGuides(null);
      return;
    }
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
    if (drawingBarrier && (mode === 'barrier' || mode === 'noise' || mode === 'conduit' || mode === 'door' || mode === 'window' || mode === 'obstacle')) {
      const { x1, y1, x2, y2 } = drawingBarrier;
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len > 15 && onBarrierAdd) {
        onBeforeChange && onBeforeChange();
        if (mode === 'noise') {
          onBarrierAdd({
            shape: 'line', x1, y1, x2, y2,
            barrierType: 'drywall',
            thickness: 'medium',
            blocksWifi: true,
            blocksCablePath: false,
            environmentKind: 'noise',
            attenuationDb: 4,
            label: 'Noise source',
          });
        } else if (mode === 'conduit') {
          onBarrierAdd({
            shape: 'line', x1, y1, x2, y2,
            barrierType: 'metal',
            thickness: 'thin',
            blocksWifi: false,
            blocksCablePath: false,
            environmentKind: 'conduit',
            label: 'Cable conduit',
          });
        } else if (mode === 'door') {
          onBarrierAdd({
            shape: 'line', x1, y1, x2, y2,
            barrierType: 'drywall',
            thickness: 'thin',
            blocksWifi: true,
            blocksCablePath: false,
            environmentKind: 'door',
            attenuationDb: 2,
            label: 'Door / opening',
          });
        } else if (mode === 'window') {
          onBarrierAdd({
            shape: 'line', x1, y1, x2, y2,
            barrierType: 'glass',
            thickness: 'medium',
            blocksWifi: true,
            blocksCablePath: false,
            environmentKind: 'window',
            label: 'Window / glass',
          });
        } else if (mode === 'obstacle') {
          onBarrierAdd({
            shape: 'line', x1, y1, x2, y2,
            barrierType: 'wood',
            thickness: 'medium',
            blocksWifi: true,
            blocksCablePath: true,
            environmentKind: 'obstacle',
            label: 'Obstacle',
          });
        } else {
          onBarrierAdd({
            shape: 'line',
            x1, y1, x2, y2,
            barrierType: 'concrete',
            thickness: 'medium',
            blocksWifi: true,
            blocksCablePath: false,
            environmentKind: 'wall',
            label: 'Barrier',
          });
        }
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
    if (drawingPowerZone && mode === 'powerzone') {
      const { x, y, w, h } = drawingPowerZone;
      if (Math.abs(w) > 20 && Math.abs(h) > 20 && onPowerZoneAdd) {
        onBeforeChange && onBeforeChange();
        const vx = w < 0 ? x + w : x;
        const vy = h < 0 ? y + h : y;
        onPowerZoneAdd({
          x: vx,
          y: vy,
          w: Math.abs(w),
          h: Math.abs(h),
          label: 'Power zone',
        });
      }
      setDrawingPowerZone(null);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setZoom(z => {
      const nz = Math.min(3, Math.max(0.5, z * delta));
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
      const pts = linkEndpointsForRender(nodes, link);
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
    const pz = (powerZones || []).find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    if (pz) { onContextMenuRequest && onContextMenuRequest(e.clientX, e.clientY, { type: 'powerZone', id: pz.id, item: pz }); return; }
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
    if (mode === 'place') return 'mode-place';
    if (mode === 'connect') return 'mode-connect';
    if (mode === 'room') return 'mode-room';
    if (mode === 'barrier' || mode === 'noise' || mode === 'conduit' || mode === 'door' || mode === 'window' || mode === 'obstacle') return 'mode-room';
    if (mode === 'vlanzone' || mode === 'powerzone') return 'mode-room';
    return '';
  };

  const renderBarrier = (b) => {
    const lx1 = b.x1 ?? b.x;
    const ly1 = b.y1 ?? b.y;
    const lx2 = b.x2 ?? b.x + (b.dx || 0);
    const ly2 = b.y2 ?? b.y + (b.dy || 0);
    const isSel = selectedId === b.id;
    const env = b.environmentKind;
    const stroke =
      env === 'noise' ? '#fb923c'
        : env === 'conduit' ? '#c084fc'
          : env === 'door' ? '#fcd34d'
            : env === 'window' ? '#38bdf8'
              : env === 'obstacle' ? '#b45309'
                : b.barrierType === 'concrete' ? '#64748b'
                  : b.barrierType === 'metal' ? '#94a3b8'
                    : b.barrierType === 'glass' ? '#7dd3fc'
                      : '#78716c';
    const dash =
      env === 'noise' ? '5 4'
        : env === 'conduit' ? '3 4'
          : env === 'door' ? '2 6'
            : env === 'window' ? '4 3'
              : env === 'obstacle' ? '6 2'
                : undefined;
    return (
      <g key={b.id}>
        {env === 'conduit' && (
          <line
            x1={lx1} y1={ly1 - 2} x2={lx2} y2={ly2 - 2}
            stroke={stroke}
            strokeWidth={(isSel ? 5 : 3) * 0.35}
            strokeLinecap="round"
            opacity={0.5}
            strokeDasharray="2 3"
            style={{ pointerEvents: 'none' }}
          />
        )}
        <line
          x1={lx1} y1={ly1} x2={lx2} y2={ly2}
          stroke={stroke}
          strokeWidth={isSel ? 5 : 3}
          strokeLinecap="round"
          strokeDasharray={dash}
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
          <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={TC.border} strokeWidth={1} strokeDasharray="4 3" opacity={0.55} pointerEvents="none" />
        )}
      </g>
    );
  };

  const renderPowerZone = (z) => {
    const isSel = selectedId === z.id;
    return (
      <rect
        key={z.id}
        x={z.x} y={z.y} width={z.w} height={z.h}
        fill={z.fill || 'rgba(234,179,8,0.12)'}
        stroke={isSel ? 'rgba(251,191,36,0.95)' : 'rgba(245,158,11,0.45)'}
        strokeWidth={isSel ? 2 : 1}
        strokeDasharray="5 4"
        rx={4}
        style={{ cursor: mode === 'select' ? 'pointer' : undefined }}
        onMouseDown={(e) => {
          if (mode !== 'select') return;
          e.stopPropagation();
          setSelectedId(z.id);
          onMultiSelect && onMultiSelect([]);
        }}
      >
        <title>{z.label || 'Power zone (UPS/PDU coverage)'}</title>
      </rect>
    );
  };

  const renderVlanZone = (z) => {
    const isSel = selectedId === z.id;
    return (
      <rect
        key={z.id}
        x={z.x} y={z.y} width={z.w} height={z.h}
        fill={z.color || 'rgba(59,130,246,0.1)'}
        stroke={isSel ? TC.primaryStr90 : 'rgba(99,102,241,0.45)'}
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
    const glowColor = isSelected || isConnecting ? TC.primary : dt.color;
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
          fill={isSelected || isConnecting ? TC.primary12 : isHovered ? TC.secondary : TC.card}
          stroke={isSelected || isConnecting ? TC.primary : isHovered ? `${dt.color}80` : TC.borderSoft}
          strokeWidth={isSelected || isConnecting ? 1.5 : 1}
          style={{ filter: isSelected ? `drop-shadow(0 0 12px ${glowColor}55)` : 'none', transition: 'all 0.15s' }}
        />
        {vlanColor && <rect x={0} y={0} width={NODE_W} height={2.5} rx={7} fill={vlanColor} opacity={0.9} />}
        {node.demoStatus && (
          <circle
            cx={12}
            cy={10}
            r={4}
            fill={
              node.demoStatus === 'online' ? '#10B981'
                : node.demoStatus === 'idle' ? '#64748B'
                  : node.demoStatus === 'warning' ? '#F59E0B'
                    : node.demoStatus === 'offline' ? '#EF4444'
                      : '#94A3B8'
            }
            stroke="hsl(var(--background) / 0.92)"
            strokeWidth={0.6}
            style={{ pointerEvents: 'none' }}
          />
        )}
        <svg x={0} y={2} width={NODE_W} height={NODE_H - 16} viewBox="0 0 90 50" overflow="visible">
          {IconEl(isSelected || isConnecting ? TC.primary : dt.color)}
        </svg>
        <text
          x={NODE_W/2}
          y={NODE_H-14}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight="500"
          fill={isSelected ? TC.fg : TC.mutedFg}
          fontFamily="Inter, sans-serif"
          style={{ cursor: mode === 'select' ? 'text' : undefined, pointerEvents: mode === 'select' ? 'auto' : 'none' }}
          onDoubleClick={(e) => {
            if (mode !== 'select') return;
            e.stopPropagation();
            e.preventDefault();
            onNodeLabelDoubleClick && onNodeLabelDoubleClick(node.id);
          }}
        >
          {node.label.length > 14 ? node.label.slice(0, 13) + '...' : node.label}
        </text>
        {node.ip && (
          <text x={NODE_W/2} y={NODE_H-4} textAnchor="middle" fontSize={6.5} fill={TC.mutedFg} opacity={0.9} fontFamily="JetBrains Mono, monospace">
            {node.ip}
          </text>
        )}
        {isConnecting && (
          <>
            <circle cx={NODE_W/2} cy={NODE_H/2} r={52} fill="none" stroke={TC.primary} strokeWidth={1.5} className="wave-ring-1" opacity={0.6} />
            <circle cx={NODE_W/2} cy={NODE_H/2} r={52} fill="none" stroke={TC.primary} strokeWidth={1} className="wave-ring-2" opacity={0.4} />
          </>
        )}
        {isSelected && !isConnecting && (
          <circle cx={NODE_W/2} cy={NODE_H/2} r={52} fill="none" stroke={TC.primary} strokeWidth={1} className="wave-ring-1" opacity={0.35} />
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
            <rect
              x={-36} y={0} width={36} height={12} rx={3} fill={badge.bg} stroke={badge.stroke ? '#fbbf24' : 'none'} strokeWidth={0.5}
              style={{ cursor: 'help', pointerEvents: 'auto' }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setBadgeTooltip({ x: e.clientX, y: e.clientY, nodeId: node.id });
              }}
              onMouseMove={(e) => {
                e.stopPropagation();
                setBadgeTooltip({ x: e.clientX, y: e.clientY, nodeId: node.id });
              }}
              onMouseLeave={() => setBadgeTooltip(null)}
            />
            <text x={-18} y={8.5} textAnchor="middle" fontSize={6.5} fontWeight="700" fill={badge.fg} fontFamily="JetBrains Mono, monospace" style={{ pointerEvents: 'none' }}>
              {ds.badgeLabel}
            </text>
          </g>
        )}
        {/* Connect-mode port dots on hover */}
        {mode === 'connect' && isHovered && (
          <circle cx={NODE_W/2} cy={NODE_H/2} r={NODE_W/2+2} fill={TC.primary06} stroke={TC.primaryStr50} strokeWidth={1.5} strokeDasharray="4 3"/>
        )}
      </g>
    );
  };

  const renderLink = (link) => {
    const lat = redundantLateralPx.get(link.id) || 0;
    const pts = linkEndpointsForRender(nodes, link, lat);
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
    const mb = Number(link.bandwidthMbps);
    const hasBw = Number.isFinite(mb) && mb > 0;
    const { min: bwMin, max: bwMax } = linkBwRange;
    const bwT = hasBw && bwMax > bwMin ? (mb - bwMin) / (bwMax - bwMin) : 0.45;
    const widthFromBw = (lt.widthBase ?? 1.35) + bwT * 2.6;
    let heatWidth = isSelected ? widthFromBw + 0.85 : isHovered ? widthFromBw + 0.45 : widthFromBw;
    if (heatmapMode === 'bandwidth') {
      heatWidth += Math.min(4, util / 25);
      if (util > 90) heatStroke = '#ef4444';
      else if (util > 70) heatStroke = '#f97316';
      else if (util > 50) heatStroke = '#eab308';
      else heatStroke = '#22c55e';
    }
    const strokeW = heatmapMode === 'bandwidth' ? heatWidth : (isSelected ? widthFromBw + 0.75 : isHovered ? widthFromBw + 0.35 : widthFromBw);
    const dashMain = lt.dash ? (link.type === 'vpn' ? '5 8' : '6 10') : (isSelected ? '10 8' : '10 8');
    const crossings = linkBarrierMarkers.get(link.id) || [];
    const isFiber = link.type === 'fiber';
    const wanEdgeRisk = unprotectedWanLinkSet.has(link.id);

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
          onMouseMove={(e) => {
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
        {isFiber && (
          <path d={path} fill="none" stroke={lt.color} strokeWidth={strokeW + 4} opacity={0.22} filter="url(#link-fiber-glow)" style={{ pointerEvents: 'none' }} />
        )}
        {/* Base line (static, slightly faded) */}
        <path d={path} fill="none"
          stroke={isSelected ? TC.primary : lt.color}
          strokeWidth={strokeW}
          opacity={0.15}
          style={{ pointerEvents: 'none' }}
        />
        {/* Animated flowing line */}
        <path d={path} fill="none"
          stroke={
            heatmapMode === 'bandwidth'
              ? heatStroke
              : wanEdgeRisk
                ? '#ef4444'
                : isSelected
                  ? TC.primary
                  : lt.color
          }
          strokeWidth={strokeW + (wanEdgeRisk ? 0.6 : 0)}
          strokeDasharray={heatmapMode === 'bandwidth' ? dashMain : dashMain}
          opacity={isSelected ? 0.9 : isHovered ? 0.8 : wanEdgeRisk ? 0.88 : 0.55}
          className={showTrafficFlow ? 'link-flow-fast' : isSelected ? 'link-flow-fast' : 'link-flow'}
          style={{ pointerEvents: 'none', transition: 'stroke-width 0.15s, opacity 0.15s' }}
        />

        {showTrafficFlow && (
          <circle r={2.8} fill={link.type === 'wifi' ? 'rgba(34,211,238,0.9)' : 'rgba(148,163,184,0.95)'} style={{ pointerEvents: 'none' }}>
            <animateMotion dur={link.type === 'fiber' ? '1.6s' : '2.4s'} repeatCount="indefinite" path={path} rotate="auto" />
          </circle>
        )}

        {crossings.map((c, i) => (
          <g key={`bc-${link.id}-${i}`} transform={`translate(${c.x},${c.y})`} style={{ pointerEvents: 'none' }}>
            <circle r={5} fill="#facc15" stroke="hsl(var(--background) / 0.88)" strokeWidth={0.6} />
            <text y={2.2} textAnchor="middle" fontSize={6.5} fontWeight="800" fill="#422006" fontFamily="Inter, sans-serif">!</text>
          </g>
        ))}

        {/* Midpoint label chip */}
        {(isHovered || isSelected) && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={mx-20} y={my-8} width={40} height={14} rx={5}
              fill={TC.popover92} stroke={isSelected ? TC.primary : lt.color} strokeWidth={0.8} />
            <text x={mx} y={my+0.5} textAnchor="middle" fontSize={7.5} fontFamily="Inter, sans-serif"
              fill={isSelected ? TC.primary : TC.mutedFg} dominantBaseline="middle">
              {link.label || lt.label}
            </text>
          </g>
        )}
        {link.poe && link.poe !== 'none' && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={mx - 10} cy={my + 10} r={4} fill="rgba(234,179,8,0.95)" stroke="#422006" strokeWidth={0.4} />
            <text x={mx - 10} y={my + 11.2} textAnchor="middle" fontSize={5} fontWeight="800" fill="#422006" fontFamily="JetBrains Mono, monospace">P</text>
            <title>PoE {link.poe}</title>
          </g>
        )}
        {link.redundantGroup && redundantLateralPx.has(link.id) && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={mx + 8} y={my - 14} width={44} height={11} rx={4} fill={TC.popover90} stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth={0.5} />
            <text x={mx + 30} y={my - 7.5} textAnchor="middle" fontSize={6} fill={TC.mutedFg} fontFamily="JetBrains Mono, monospace">redundant</text>
          </g>
        )}
        {/* Endpoint dots */}
        {(isSelected || isHovered) && (
          <>
            <circle cx={x1} cy={y1} r={3} fill={isSelected ? TC.primary : lt.color} opacity={0.8} style={{ pointerEvents: 'none' }} />
            <circle cx={x2} cy={y2} r={3} fill={isSelected ? TC.primary : lt.color} opacity={0.8} style={{ pointerEvents: 'none' }} />
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
          stroke={isSelected ? TC.primaryStr65 : TC.borderMuted}
          strokeWidth={isSelected ? 1.5 : 1} strokeDasharray="8 5" rx={6}
          style={{ pointerEvents: mode === 'select' ? 'visible' : 'none', cursor: mode === 'select' ? 'grab' : undefined }}
        />
        <rect x={room.x+6} y={room.y+5} width={room.label.length*5.5+12} height={14} rx={4} fill={TC.popover75} style={{ pointerEvents: 'none' }} />
        <text x={room.x+12} y={room.y+13} fontSize={9} fontWeight="500"
          fill={isSelected ? TC.primaryStr90 : TC.mutedFgSoft}
          fontFamily="Inter, sans-serif" dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}>{room.label}</text>
        {/* Resize handles - only when selected */}
        {isSelected && handles.map(h => (
          <rect key={h.id}
            x={h.x - HS/2} y={h.y - HS/2} width={HS} height={HS}
            fill={TC.primary} stroke="hsl(var(--background) / 0.9)" strokeWidth={1.2} rx={1.5}
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

  const badgeTipModel =
    badgeTooltip && smartSnapshot?.deviceStates?.[badgeTooltip.nodeId]
      ? {
          ds: smartSnapshot.deviceStates[badgeTooltip.nodeId],
          node: nodes.find((n) => n.id === badgeTooltip.nodeId),
          x: badgeTooltip.x,
          y: badgeTooltip.y,
        }
      : null;

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
        style={{ background: TC.bg }}
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
              stroke={TC.gridMinor}
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
              stroke={TC.gridMajor}
              strokeWidth={Math.max(0.35, 1.35 / zoom)}
            />
          </pattern>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="hsl(var(--muted-foreground) / 0.55)" />
          </marker>
          <filter id="link-fiber-glow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="cochannel-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
            <path d="M-1,0 l8,8" stroke="rgba(251,191,36,0.45)" strokeWidth="1.1" />
          </pattern>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <rect
            x={-GRID_EXTENT}
            y={-GRID_EXTENT}
            width={GRID_EXTENT * 2}
            height={GRID_EXTENT * 2}
            fill={TC.workspace}
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
          {heatmapMode === 'signal' && coChannelOverlay.map((p) => {
            const cx = (p.x1 + p.x2) / 2;
            const cy = (p.y1 + p.y2) / 2;
            const d = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) || 1;
            if (d >= p.r1 + p.r2 - 1) return null;
            const rx = Math.max(12, Math.min(p.r1, p.r2, d * 0.52));
            const ry = Math.max(8, Math.min(p.r1, p.r2) * 0.42);
            const ang = (Math.atan2(p.y2 - p.y1, p.x2 - p.x1) * 180) / Math.PI;
            return (
              <ellipse
                key={`cc-${p.id}`}
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                transform={`rotate(${ang} ${cx} ${cy})`}
                fill="url(#cochannel-hatch)"
                opacity={0.4}
                stroke="rgba(251,191,36,0.4)"
                strokeWidth={0.6}
                style={{ pointerEvents: 'none' }}
              >
                <title>{`Co-channel overlap (channel ${p.channel})`}</title>
              </ellipse>
            );
          })}
          {(powerZones || []).map(renderPowerZone)}
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
              stroke="hsl(var(--primary) / 0.88)"
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
              <text x={g.x} y={g.y - 44} textAnchor="middle" fontSize={8} fill={TC.mutedFg} fontFamily="JetBrains Mono, monospace">
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
                <path d={path} fill="none" stroke={TC.primary} strokeWidth={2} strokeDasharray="8 4" opacity={0.8} />
                <circle cx={mouseCanvas.x} cy={mouseCanvas.y} r={5}
                  fill={TC.primary03} stroke={TC.primary} strokeWidth={1.5} />
              </g>
            );
          })()}

          {/* Multi-select highlights */}
          {selectedIds && selectedIds.length > 1 && nodes.filter(n => selectedIds.includes(n.id)).map(n => (
            <rect key={`sel-${n.id}`} x={n.x-4} y={n.y-4} width={NODE_W+8} height={NODE_H+8} rx={10}
              fill={TC.primary07} stroke={TC.primaryStr50} strokeWidth={1.5} strokeDasharray="5 3"
              style={{ pointerEvents: 'none' }} />
          ))}

          {alignmentGuides && (alignmentGuides.gx != null || alignmentGuides.gy != null) && (
            <g style={{ pointerEvents: 'none' }} opacity={0.9}>
              {alignmentGuides.gx != null && (
                <line
                  x1={alignmentGuides.gx}
                  x2={alignmentGuides.gx}
                  y1={-GRID_EXTENT}
                  y2={GRID_EXTENT}
                  stroke={TC.ringLine}
                  strokeWidth={Math.max(0.35, 1 / zoom)}
                  strokeDasharray="4 4"
                />
              )}
              {alignmentGuides.gy != null && (
                <line
                  y1={alignmentGuides.gy}
                  y2={alignmentGuides.gy}
                  x1={-GRID_EXTENT}
                  x2={GRID_EXTENT}
                  stroke={TC.ringLine}
                  strokeWidth={Math.max(0.35, 1 / zoom)}
                  strokeDasharray="4 4"
                />
              )}
            </g>
          )}
          {nodes.map(renderNode)}

          {/* Selection rectangle */}
          {selectionRect && selectionRect.w > 4 && selectionRect.h > 4 && (
            <rect
              x={selectionRect.x} y={selectionRect.y}
              width={selectionRect.w} height={selectionRect.h}
              fill={TC.primary06} stroke={TC.primaryStr70}
              strokeWidth={1.5} strokeDasharray="6 3" rx={4}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {drawingRoom && (
            <rect
              x={drawingRoom.w<0 ? drawingRoom.x+drawingRoom.w : drawingRoom.x}
              y={drawingRoom.h<0 ? drawingRoom.y+drawingRoom.h : drawingRoom.y}
              width={Math.abs(drawingRoom.w)} height={Math.abs(drawingRoom.h)}
              fill={TC.primary05} stroke={TC.primaryStr50} strokeWidth={1.5} strokeDasharray="8 4" rx={6}
            />
          )}
          {drawingBarrier && (mode === 'barrier' || mode === 'noise' || mode === 'conduit' || mode === 'door' || mode === 'window' || mode === 'obstacle') && (
            <line
              x1={drawingBarrier.x1} y1={drawingBarrier.y1}
              x2={drawingBarrier.x2} y2={drawingBarrier.y2}
              stroke={
                mode === 'noise' ? '#fb923c'
                  : mode === 'conduit' ? '#c084fc'
                    : mode === 'door' ? '#fcd34d'
                      : mode === 'window' ? '#38bdf8'
                        : mode === 'obstacle' ? '#b45309'
                          : '#64748b'
              }
              strokeWidth={2}
              strokeDasharray={
                mode === 'noise' ? '5 4'
                  : mode === 'conduit' ? '3 4'
                    : mode === 'door' ? '2 6'
                      : mode === 'window' ? '4 3'
                        : mode === 'obstacle' ? '6 2'
                          : '6 4'
              }
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
          {drawingPowerZone && (
            <rect
              x={drawingPowerZone.w<0 ? drawingPowerZone.x+drawingPowerZone.w : drawingPowerZone.x}
              y={drawingPowerZone.h<0 ? drawingPowerZone.y+drawingPowerZone.h : drawingPowerZone.y}
              width={Math.abs(drawingPowerZone.w)} height={Math.abs(drawingPowerZone.h)}
              fill="rgba(234,179,8,0.1)" stroke="rgba(245,158,11,0.55)" strokeWidth={1.5} strokeDasharray="5 4" rx={4}
            />
          )}
        </g>
      </svg>

      {/* Link hover tooltip (outside SVG, in HTML) */}
      {heatmapMode === 'signal' && (
        <div className="fixed z-30 pointer-events-none bottom-14 left-4 max-w-[220px] rounded-lg border border-border bg-card/92 px-2.5 py-2 text-[10px] text-muted-foreground shadow-lg backdrop-blur-md">
          <div className="font-semibold text-foreground/90 mb-1.5">Signal heatmap</div>
          <p className="text-[9px] text-muted-foreground/85 mb-1.5 leading-snug">v3 spec legend (RF levels illustrative):</p>
          <div className="flex flex-wrap gap-x-2 gap-y-1 items-center text-[9px]">
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500/75" /> ~−30 dBm</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500/65" /> −45…−60</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500/65" /> −65…−78</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/65" /> −80…−90</span>
          </div>
          <p className="mt-1.5 text-[8px] text-muted-foreground/65 leading-snug">Canvas uses 0–100 score samples; colors track spec heatmap strong→dead.</p>
        </div>
      )}

      {badgeTipModel && (
        <div
          className="fixed z-50 pointer-events-none max-w-xs bg-card/95 border border-border rounded-lg px-3 py-2 shadow-2xl text-xs"
          style={{ left: badgeTipModel.x + 12, top: badgeTipModel.y - 8 }}
        >
          <div className="font-medium text-foreground mb-1">{badgeTipModel.node?.label || 'Device'}</div>
          {badgeTipModel.ds.quality != null && (
            <div className="text-[10px] text-muted-foreground mb-1 space-y-0.5">
              <div>Signal: <span className="font-mono text-foreground">{badgeTipModel.ds.quality}/100</span></div>
              <div className="text-[9px] opacity-90">
                ≈ RF map <span className="font-mono text-foreground/90">{Math.round(-30 - (100 - Number(badgeTipModel.ds.quality)) * 0.67)}</span> dBm (illustrative)
              </div>
            </div>
          )}
          {(badgeTipModel.ds.reasons || []).length > 0 && (
            <ul className="list-disc pl-3.5 space-y-0.5 text-muted-foreground text-[11px]">
              {(badgeTipModel.ds.reasons || []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {(badgeTipModel.ds.suggestions || []).length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-border text-[10px] text-primary/90">
              {(badgeTipModel.ds.suggestions || []).map((s, i) => <div key={i}>→ {s}</div>)}
            </div>
          )}
        </div>
      )}

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
