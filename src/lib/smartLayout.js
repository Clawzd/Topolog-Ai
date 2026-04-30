/**
 * Smart layout engine for AI-generated topologies.
 * Prevents overlapping, respects walls/rooms, and auto-sizes rooms to fit devices.
 */

const NODE_W = 90;
const NODE_H = 56;
const NODE_PAD = 24; // minimum gap between nodes
const ROOM_PAD = 72; // generous padding inside room edges for readable floorplans
const ROOM_CLAIM_PAD = 8; // small tolerance for imperfect AI room coordinates
const ENV_ROOM_GAP = 12;
const MIN_ROOM_W = 360;
const MIN_ROOM_H = 240;
const ROOM_GAP = 32;
const BUS_ENDPOINT_GAP = 132;
const BUS_ROOM_PAD_X = 96;
const BUS_ROOM_PAD_Y = 82;
const BUS_TOP_ROW_GAP = 150;
const BUS_BOTTOM_ROW_GAP = 92;

/**
 * Check if two rectangles overlap (with padding).
 */
function rectsOverlap(a, b, pad = NODE_PAD) {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

/**
 * Check if a point is inside a barrier (wall).
 */
function pointInBarrier(x, y, w, h, barriers) {
  for (const b of barriers) {
    if (b.shape === 'rect') {
      if (rectsOverlap({ x, y, w, h }, { x: b.x, y: b.y, w: b.w, h: b.h }, 10)) {
        return true;
      }
    } else if (b.shape === 'line') {
      // Check if node rect intersects the line (simplified: check distance to line segment)
      const cx = x + w / 2;
      const cy = y + h / 2;
      const dist = distToSegment(cx, cy, b.x1, b.y1, b.x2, b.y2);
      if (dist < w / 2 + 15) return true;
    }
  }
  return false;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function barrierCenter(barrier) {
  if (barrier.shape === 'rect') {
    return { x: (barrier.x || 0) + (barrier.w || 0) / 2, y: (barrier.y || 0) + (barrier.h || 0) / 2 };
  }
  return {
    x: ((barrier.x1 ?? barrier.x ?? 0) + (barrier.x2 ?? barrier.x ?? 0)) / 2,
    y: ((barrier.y1 ?? barrier.y ?? 0) + (barrier.y2 ?? barrier.y ?? 0)) / 2,
  };
}

function labelWords(label) {
  return String(label || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !['wall', 'room', 'zone', 'door', 'glass', 'concrete', 'partition'].includes(word));
}

function findBarrierRoom(barrier, rooms) {
  if (!rooms.length) return null;
  const barrierWords = labelWords(barrier.label);
  const labelMatch = rooms
    .map((room) => ({
      room,
      score: labelWords(room.label).filter((word) => barrierWords.includes(word)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.room;
  if (labelMatch) return labelMatch;

  const center = barrierCenter(barrier);
  return rooms
    .map((room) => ({
      room,
      dist: Math.hypot(center.x - (room.x + room.w / 2), center.y - (room.y + room.h / 2)),
    }))
    .sort((a, b) => a.dist - b.dist)[0]?.room || rooms[0];
}

function roomEdgeLine(room, edgeIndex = 0) {
  const edge = edgeIndex % 4;
  if (edge === 0) {
    return { x1: room.x - ENV_ROOM_GAP, y1: room.y + 16, x2: room.x - ENV_ROOM_GAP, y2: room.y + room.h - 16 };
  }
  if (edge === 1) {
    return { x1: room.x + 16, y1: room.y - ENV_ROOM_GAP, x2: room.x + room.w - 16, y2: room.y - ENV_ROOM_GAP };
  }
  if (edge === 2) {
    return { x1: room.x + room.w + ENV_ROOM_GAP, y1: room.y + 16, x2: room.x + room.w + ENV_ROOM_GAP, y2: room.y + room.h - 16 };
  }
  return { x1: room.x + 16, y1: room.y + room.h + ENV_ROOM_GAP, x2: room.x + room.w - 16, y2: room.y + room.h + ENV_ROOM_GAP };
}

function normalizeEnvironmentBarriers(barriers, rooms) {
  if (!barriers?.length || !rooms?.length) return barriers || [];

  const roomUseCount = new Map();
  return barriers.map((barrier) => {
    if (barrier.environmentKind === 'bus') return barrier;
    const room = findBarrierRoom(barrier, rooms);
    if (!room || barrier.shape !== 'line') return barrier;

    const roomKey = room.id || room.label;
    const useIndex = roomUseCount.get(roomKey) || 0;
    roomUseCount.set(roomKey, useIndex + 1);

    const centerX = room.x + room.w / 2;
    const centerY = room.y + room.h / 2;
    const kind = barrier.environmentKind || 'wall';

    if (kind === 'door') {
      return {
        ...barrier,
        x1: centerX - 24,
        y1: room.y + room.h + ENV_ROOM_GAP,
        x2: centerX + 24,
        y2: room.y + room.h + ENV_ROOM_GAP,
        blocksCablePath: false,
      };
    }

    if (kind === 'window') {
      return {
        ...barrier,
        x1: centerX - 36,
        y1: room.y - ENV_ROOM_GAP,
        x2: centerX + 36,
        y2: room.y - ENV_ROOM_GAP,
        blocksCablePath: false,
      };
    }

    if (kind === 'noise') {
      return {
        ...barrier,
        x1: Math.max(room.x + 18, centerX - 45),
        y1: Math.max(room.y + 24, centerY - 12),
        x2: Math.min(room.x + room.w - 18, centerX + 45),
        y2: Math.max(room.y + 24, centerY - 12),
      };
    }

    if (kind === 'conduit') {
      return {
        ...barrier,
        x1: room.x + 24,
        y1: room.y - ENV_ROOM_GAP * 2,
        x2: room.x + room.w - 24,
        y2: room.y - ENV_ROOM_GAP * 2,
        blocksWifi: false,
        blocksCablePath: false,
      };
    }

    if (kind === 'obstacle') {
      return {
        ...barrier,
        x1: room.x + room.w - 48,
        y1: room.y + 36,
        x2: room.x + room.w - 48,
        y2: room.y + Math.min(room.h - 28, 120),
      };
    }

    return {
      ...barrier,
      ...roomEdgeLine(room, useIndex),
      blocksCablePath: barrier.blocksCablePath ?? true,
    };
  });
}

/**
 * Find a free position for a node that doesn't overlap existing nodes or barriers.
 * Tries the preferred position first, then spirals outward.
 */
function findFreePosition(preferredX, preferredY, occupiedRects, barriers = []) {
  const candidate = { x: preferredX, y: preferredY, w: NODE_W, h: NODE_H };

  const isFree = (x, y) => {
    const rect = { x, y, w: NODE_W, h: NODE_H };
    for (const occ of occupiedRects) {
      if (rectsOverlap(rect, occ)) return false;
    }
    if (pointInBarrier(x, y, NODE_W, NODE_H, barriers)) return false;
    return true;
  };

  if (isFree(preferredX, preferredY)) return { x: preferredX, y: preferredY };

  // Spiral search outward
  for (let ring = 1; ring <= 20; ring++) {
    const step = (NODE_W + NODE_PAD) * ring;
    const offsets = [
      [step, 0], [-step, 0], [0, step], [0, -step],
      [step, step], [-step, step], [step, -step], [-step, -step],
      [step, step / 2], [-step, step / 2], [step / 2, step], [step / 2, -step],
    ];
    for (const [dx, dy] of offsets) {
      const nx = preferredX + dx;
      const ny = preferredY + dy;
      if (isFree(nx, ny)) return { x: nx, y: ny };
    }
  }
  // Fallback: offset from preferred
  return { x: preferredX + 120, y: preferredY + 80 };
}

/**
 * Apply smart layout to a generated topology, resolving overlaps and respecting existing map state.
 * @param {object} topology - The generated topology { nodes, links, rooms, vlans }
 * @param {object} mapState - Current map state { nodes, rooms, barriers }
 * @returns {object} - The topology with adjusted positions and auto-sized rooms
 */
export function applySmartLayout(topology, mapState = {}) {
  const existingNodes = mapState.nodes || [];
  const existingBarriers = mapState.barriers || [];
  const existingRooms = mapState.rooms || [];

  // Build occupied rectangles from existing nodes
  const occupiedRects = existingNodes.map(n => ({
    x: n.x, y: n.y, w: NODE_W, h: NODE_H,
  }));

  // If there are existing items, find an open area to place new topology
  let offsetX = 0;
  let offsetY = 0;
  if (existingNodes.length > 0) {
    // Find the bounding box of existing items
    let maxX = -Infinity;
    let maxY = -Infinity;
    let minY = Infinity;
    for (const n of existingNodes) {
      if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
      if (n.y > maxY) maxY = n.y;
      if (n.y < minY) minY = n.y;
    }
    // Place new topology to the right with gap
    offsetX = maxX + 120;
    offsetY = 0;
  }

  // Resolve overlaps for each new node
  const adjustedNodes = [];
  for (const node of topology.nodes) {
    const preferredX = node.x + offsetX;
    const preferredY = node.y + offsetY;
    const freePos = findFreePosition(preferredX, preferredY, occupiedRects, existingBarriers);
    adjustedNodes.push({ ...node, x: freePos.x, y: freePos.y });
    occupiedRects.push({ x: freePos.x, y: freePos.y, w: NODE_W, h: NODE_H });
  }

  // Auto-size rooms to fit their contained devices
  const adjustedRooms = autoSizeRooms(topology.rooms, adjustedNodes, offsetX, offsetY);

  // Shift any AI-emitted barriers (e.g. bus backbones) by the same offset,
  // so they stay attached to the devices that reference them.
  const shiftedBarriers = (topology.barriers || []).map((b) => {
    if (offsetX === 0 && offsetY === 0) return b;
    const shifted = { ...b };
    if (typeof b.x1 === 'number') shifted.x1 = b.x1 + offsetX;
    if (typeof b.y1 === 'number') shifted.y1 = b.y1 + offsetY;
    if (typeof b.x2 === 'number') shifted.x2 = b.x2 + offsetX;
    if (typeof b.y2 === 'number') shifted.y2 = b.y2 + offsetY;
    if (typeof b.x === 'number') shifted.x = b.x + offsetX;
    if (typeof b.y === 'number') shifted.y = b.y + offsetY;
    return shifted;
  });
  const adjustedBarriers = normalizeEnvironmentBarriers(shiftedBarriers, adjustedRooms);

  return {
    ...topology,
    nodes: adjustedNodes,
    rooms: adjustedRooms,
    barriers: adjustedBarriers,
  };
}

/**
 * Auto-size rooms so they contain all devices that belong to them.
 * Each node is assigned exclusively to a room only when its center is inside
 * that room's original bounds, so unrelated core gear does not get absorbed.
 * After sizing, a separation pass pushes any still-overlapping rooms apart.
 */
function autoSizeRooms(rooms, adjustedNodes, offsetX, offsetY) {
  if (!rooms || rooms.length === 0) return [];

  // Translate room origins to canvas coordinates.
  const rects = rooms.map(room => ({
    ...room,
    x: room.x + offsetX,
    y: room.y + offsetY,
  }));

  // Build a centre point for each room (used for proximity assignment).
  const centers = rects.map(r => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2 }));

  // Exclusively assign each node to a room only when the original room bounds
  // claim it. LLMs can emit broad or uneven rooms, so nearest-room fallback
  // makes labels like "Student Lab" accidentally absorb unrelated core gear.
  const buckets = rects.map(() => []);
  for (const n of adjustedNodes) {
    if (n.isBusAnchor) continue; // bus anchors are invisible; don't pull rooms
    const cx = n.x + NODE_W / 2;
    const cy = n.y + NODE_H / 2;

    // Rooms that actually contain the node centre
    const containing = rects
      .map((r, i) => ({ i, inside: cx >= r.x - ROOM_CLAIM_PAD && cx <= r.x + r.w + ROOM_CLAIM_PAD && cy >= r.y - ROOM_CLAIM_PAD && cy <= r.y + r.h + ROOM_CLAIM_PAD }))
      .filter(e => e.inside);

    let chosen;
    if (containing.length === 1) {
      chosen = containing[0].i;
    } else if (containing.length > 1) {
      // Multiple rooms claim this node — give it to the nearest centre.
      chosen = containing.reduce((best, e) => {
        const d = Math.hypot(cx - centers[e.i].cx, cy - centers[e.i].cy);
        return d < best.d ? { i: e.i, d } : best;
      }, { i: containing[0].i, d: Infinity }).i;
    } else {
      // Node is outside every room, so leave room sizing unchanged.
      continue;
    }
    buckets[chosen].push(n);
  }

  // Size each room to its exclusive set of nodes.
  let sized = rects.map((room, i) => {
    const nodes = buckets[i];
    if (nodes.length === 0) return room;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
      if (n.y + NODE_H > maxY) maxY = n.y + NODE_H;
    }

    return {
      ...room,
      x: minX - ROOM_PAD,
      y: minY - ROOM_PAD,
      w: Math.max(MIN_ROOM_W, maxX - minX + ROOM_PAD * 2),
      h: Math.max(MIN_ROOM_H, maxY - minY + ROOM_PAD * 2),
    };
  });

  // Separation pass: push overlapping rooms apart (up to 10 iterations).
  const GAP = ROOM_GAP; // minimum gap between room edges
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (let a = 0; a < sized.length; a++) {
      for (let b = a + 1; b < sized.length; b++) {
        const ra = sized[a];
        const rb = sized[b];
        const overlapX = (ra.x + ra.w + GAP) - rb.x;
        const overlapY = (ra.y + ra.h + GAP) - rb.y;
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (rb.x + rb.w + GAP <= ra.x) continue;
        if (rb.y + rb.h + GAP <= ra.y) continue;

        // Push along the axis of smaller overlap, splitting evenly.
        if (overlapX < overlapY) {
          const half = overlapX / 2;
          sized[a] = { ...ra, x: ra.x - half };
          sized[b] = { ...rb, x: rb.x + half };
        } else {
          const half = overlapY / 2;
          sized[a] = { ...ra, y: ra.y - half };
          sized[b] = { ...rb, y: rb.y + half };
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return sized;
}

function isBusBarrier(barrier) {
  return barrier?.environmentKind === 'bus';
}

function linkTouchesBus(link, busId) {
  return link?.busId === busId || link?.source === busId || link?.target === busId;
}

function otherBusEndpointId(link, busId) {
  if (!linkTouchesBus(link, busId)) return null;
  if (link.source === busId) return link.target;
  if (link.target === busId) return link.source;
  return link.source || link.target || null;
}

function promptExplicitlyAllowsBusInfrastructure(prompt, node) {
  const text = String(prompt || '').toLowerCase();
  const label = String(node?.label || '').toLowerCase();
  const type = String(node?.type || '').toLowerCase();

  if (type === 'cloud') return /\b(internet|isp|wan|cloud)\b/.test(text);
  if (type === 'router') return /\b(router|gateway|wan|internet|edge)\b/.test(text);
  if (type === 'firewall') return /\b(firewall|security|secure|dmz)\b/.test(text);
  if (type === 'switch') return /\b(switch|hub|concentrator)\b/.test(text) && /\b(bus|shared cable|legacy lan)\b/.test(text);
  if (/\b(core|distribution|access switch|edge router|firewall|internet)\b/.test(label)) {
    return /\b(enterprise|hybrid|wan|internet|firewall|router|switch)\b/.test(text);
  }
  return false;
}

function promptAllowsBusEndpointType(prompt, type) {
  const text = String(prompt || '').toLowerCase();
  const hasAnyDeviceRequest = /\b(computers?|pcs?|workstations?|desktops?|clients?|students?|staff|laptops?|printers?|servers?|file server|training server|nas|storage|backup|cameras?|phones?|voip|tablets?|iot|sensors?|smart\s?tv|display|wifi|wi-fi|wireless|access points?|aps?)\b/.test(text);
  const asksForComputers = /\b(computers?|pcs?|workstations?|desktops?|clients?|students?|staff|laptops?|terminals?)\b/.test(text);

  if (type === 'pc' || type === 'laptop') return asksForComputers || !hasAnyDeviceRequest;
  if (type === 'server') return /\b(servers?|file server|training server|web server|app server|database|db|service host|services?)\b/.test(text);
  if (type === 'printer') return /\b(printers?|print|printing)\b/.test(text);
  if (type === 'camera') return /\b(cameras?|security|surveillance|cctv)\b/.test(text);
  if (type === 'nas') return /\b(nas|storage|backup)\b/.test(text);
  if (type === 'phone') return /\b(phones?|voip|voice)\b/.test(text);
  if (type === 'tablet') return /\b(tablets?)\b/.test(text);
  if (type === 'iot') return /\b(iot|sensors?|gateway)\b/.test(text);
  if (type === 'smarttv') return /\b(smart\s?tv|tv|display|screen)\b/.test(text);
  if (type === 'ap') return /\b(wifi|wi-fi|wireless|access points?|aps?)\b/.test(text);
  return false;
}

function busEndpointCandidates(topology, bus) {
  const nodes = (topology.nodes || []).filter((node) => !node.isBusAnchor);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const linkedIds = new Set(
    (topology.links || [])
      .map((link) => otherBusEndpointId(link, bus.id))
      .filter((id) => id && nodeById.has(id)),
  );

  const endpointTypes = new Set(['pc', 'laptop', 'printer', 'server', 'camera', 'nas', 'phone', 'tablet', 'iot', 'smarttv', 'ap']);
  const strictEndpoints = nodes.filter((node) => {
    if (linkedIds.has(node.id) && endpointTypes.has(node.type)) return promptAllowsBusEndpointType(topology._prompt, node.type);
    if (linkedIds.has(node.id) && promptExplicitlyAllowsBusInfrastructure(topology._prompt, node)) return true;
    return !linkedIds.size && endpointTypes.has(node.type) && promptAllowsBusEndpointType(topology._prompt, node.type);
  });

  if (strictEndpoints.length >= 2) return strictEndpoints;
  return nodes.filter((node) => {
    if (!linkedIds.has(node.id) && !endpointTypes.has(node.type)) return false;
    return endpointTypes.has(node.type) && promptAllowsBusEndpointType(topology._prompt, node.type);
  });
}

function summarizeNodeTypes(nodes) {
  const typeLabels = {
    pc: 'workstation',
    laptop: 'laptop',
    printer: 'printer',
    server: 'server',
    camera: 'camera',
    nas: 'NAS',
    phone: 'phone',
    tablet: 'tablet',
    iot: 'IoT device',
    smarttv: 'smart TV',
    ap: 'access point',
  };
  const counts = new Map();
  nodes.forEach((node) => {
    const label = typeLabels[node.type] || node.type || 'device';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => `${count} ${label}${count === 1 || label === 'NAS' ? '' : 's'}`)
    .join(', ');
}

function normalizeStrictBusTopology(topology, prompt = '') {
  const barriers = topology.barriers || [];
  const bus = barriers.find(isBusBarrier);
  if (!bus) return topology;

  const topologyWithPrompt = { ...topology, _prompt: prompt };
  const endpoints = busEndpointCandidates(topologyWithPrompt, bus)
    .filter((node) => !['switch', 'router', 'firewall', 'cloud', 'loadbalancer', 'pdu', 'patchpanel'].includes(node.type) || promptExplicitlyAllowsBusInfrastructure(prompt, node));

  if (endpoints.length < 2) return topology;

  const orderedEndpoints = [...endpoints].sort((a, b) => {
    const ai = (topology.links || []).find((link) => linkTouchesBus(link, bus.id) && otherBusEndpointId(link, bus.id) === a.id)?.busPortIndex;
    const bi = (topology.links || []).find((link) => linkTouchesBus(link, bus.id) && otherBusEndpointId(link, bus.id) === b.id)?.busPortIndex;
    if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
    return (a.x - b.x) || (a.y - b.y) || String(a.id).localeCompare(String(b.id));
  });

  const portCount = orderedEndpoints.length;
  const busLength = Math.max(760, (portCount - 1) * BUS_ENDPOINT_GAP + 180);
  const currentCenterX = typeof bus.x1 === 'number' && typeof bus.x2 === 'number'
    ? (bus.x1 + bus.x2) / 2
    : orderedEndpoints.reduce((sum, node) => sum + node.x + NODE_W / 2, 0) / orderedEndpoints.length;
  const currentY = typeof bus.y1 === 'number' && typeof bus.y2 === 'number'
    ? (bus.y1 + bus.y2) / 2
    : orderedEndpoints.reduce((sum, node) => sum + node.y + NODE_H / 2, 0) / orderedEndpoints.length;
  let x1 = Math.round(currentCenterX - busLength / 2);
  let x2 = Math.round(currentCenterX + busLength / 2);
  let y = Math.round(currentY);
  const minBusX = BUS_ROOM_PAD_X + NODE_W / 2 + 24;
  if (x1 < minBusX) {
    const shift = minBusX - x1;
    x1 += shift;
    x2 += shift;
  }
  if (y - BUS_TOP_ROW_GAP - BUS_ROOM_PAD_Y < 24) {
    y = BUS_TOP_ROW_GAP + BUS_ROOM_PAD_Y + 24;
  }
  const portStep = portCount > 1 ? busLength / (portCount - 1) : busLength;

  const normalizedNodes = orderedEndpoints.map((node, index) => {
    const portX = x1 + portStep * index;
    const above = index % 2 === 0;
    return {
      ...node,
      x: Math.round(portX - NODE_W / 2),
      y: Math.round(above ? y - BUS_TOP_ROW_GAP : y + BUS_BOTTOM_ROW_GAP),
    };
  });

  const normalizedBus = {
    ...bus,
    shape: 'line',
    environmentKind: 'bus',
    x1,
    y1: y,
    x2,
    y2: y,
    portCount,
    label: bus.label || 'Bus Backbone',
  };

  const normalizedLinks = normalizedNodes.map((node, index) => {
    const existing = (topology.links || []).find((link) => linkTouchesBus(link, bus.id) && otherBusEndpointId(link, bus.id) === node.id);
    return {
      ...(existing || {}),
      id: existing?.id || `bus_tap_${node.id}`,
      source: node.id,
      target: normalizedBus.id,
      busId: normalizedBus.id,
      busPortIndex: index,
      type: existing?.type === 'fiber' ? 'fiber' : 'ethernet',
      label: existing?.label || 'Bus tap',
    };
  });

  const nodeBounds = normalizedNodes.reduce((bounds, node) => ({
    minX: Math.min(bounds.minX, node.x),
    minY: Math.min(bounds.minY, node.y),
    maxX: Math.max(bounds.maxX, node.x + NODE_W),
    maxY: Math.max(bounds.maxY, node.y + NODE_H),
  }), { minX: x1, minY: y, maxX: x2, maxY: y });

  const busBounds = {
    minX: Math.min(nodeBounds.minX, x1),
    minY: Math.min(nodeBounds.minY, y),
    maxX: Math.max(nodeBounds.maxX, x2),
    maxY: Math.max(nodeBounds.maxY, y),
  };

  const normalizedRooms = (topology.rooms || []).length === 1
    ? [{
      ...topology.rooms[0],
      x: busBounds.minX - BUS_ROOM_PAD_X,
      y: busBounds.minY - BUS_ROOM_PAD_Y,
      w: Math.max(MIN_ROOM_W, busBounds.maxX - busBounds.minX + BUS_ROOM_PAD_X * 2),
      h: Math.max(MIN_ROOM_H, busBounds.maxY - busBounds.minY + BUS_ROOM_PAD_Y * 2),
    }]
    : autoSizeRooms(topology.rooms || [], normalizedNodes, 0, 0);

  return {
    ...topology,
    summary: `Bus topology with ${normalizedNodes.length} endpoint device${normalizedNodes.length === 1 ? '' : 's'} (${summarizeNodeTypes(normalizedNodes)}) tapping directly into one shared backbone. Removed unrequested switch/router branches and extra device types from the strict bus layout.`,
    nodes: normalizedNodes,
    links: normalizedLinks,
    rooms: normalizedRooms,
    barriers: [
      normalizedBus,
      ...barriers.filter((barrier) => barrier.id !== bus.id && !isBusBarrier(barrier)),
    ],
  };
}

export function normalizeTopologyForInferredShape(topology, topologyType, prompt = '') {
  if (topologyType === 'bus') return normalizeStrictBusTopology(topology, prompt);
  return topology;
}

/**
 * Determine the best topology type for a given prompt.
 * Returns a recommendation with reasoning.
 */
export function recommendTopology(prompt) {
  const t = (prompt || '').toLowerCase();
  const numbers = [...t.matchAll(/\b(\d+)\b/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  const largestCount = numbers.length ? Math.max(...numbers) : null;

  // High availability / active-active designs -> mesh.
  if (/\b(redundan|high.?avail|failover|ha\b|active.?active|no.?single.?point|mission.?critical|zero.?downtime|always.?on|dual.?core)/i.test(t)) {
    return { topology: 'mesh', reason: 'High availability and zero-downtime wording calls for redundant interconnection between core devices.' };
  }

  // Carrier, MAN, and site-loop scenarios -> ring.
  if (/\b(isp|carrier|metro|provider|wan|city|municipal|fiber.?path|fiber.?route|branches around|sites around|perimeter|looped path|regional offices)/i.test(t)) {
    return { topology: 'ring', reason: 'Carrier, metro, and multi-site route wording implies a resilient loop between network sites.' };
  }

  // Linear physical placement -> bus.
  if (/\b(linear|sequential|daisy|chain|assembly|production.?line|conveyor|bench row|lab bench|classroom bench|training lab|long corridor|shared cable|legacy lan|tap points?)/i.test(t)) {
    return { topology: 'bus', reason: 'Devices arranged along a line, bench row, corridor, or shared medium fit a bus backbone.' };
  }

  // Small/local networks -> star.
  if (/\b(small|simple|home|soho|basic|minimal|single.?room|front desk|tiny|clinic room|coffee shop|single office|one office|one room|reception)/i.test(t) || (largestCount != null && largestCount <= 12)) {
    return { topology: 'star', reason: 'Small single-area networks are best represented by endpoints around one central switch or router.' };
  }

  // Mixed departments/buildings/security zones -> hybrid.
  if (/\b(campus|multi.?build|enterprise|large|complex|mixed|department|departments|student|faculty|admin|warehouse|iot|guest|security|operations|multiple zones|separate zones|network segments|segmented)/i.test(t)) {
    return { topology: 'hybrid', reason: 'Multiple zones, departments, or mixed wired/wireless/security needs fit a hybrid design.' };
  }

  // Data center / structured multi-tier buildings -> tree.
  if (/\b(data.?cent|spine.?leaf|rack|server.?farm|colo|multi.?floor|multi.?story|3.?story|three.?story|building core|distribution closet|floor switches)/i.test(t)) {
    return { topology: 'tree', reason: 'Data centers and multi-floor buildings benefit from a structured core/distribution/access hierarchy.' };
  }

  if (largestCount != null && largestCount >= 24) {
    return { topology: 'tree', reason: 'Larger endpoint counts need a scalable hierarchy unless another scenario strongly implies a different topology.' };
  }

  return { topology: 'star', reason: 'A general small-to-medium network defaults to a central hub-and-spoke design unless the prompt implies a larger structure.' };
}
