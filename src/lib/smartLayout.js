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

/**
 * Pick the room edge (top/right/bottom/left) that best matches the AI's
 * intended wall, based on (a) orientation — horizontal walls land on top/bottom,
 * vertical walls land on left/right — and (b) proximity to that edge. Returns
 * a snapped line whose length is the smaller of (AI length, room edge length)
 * centred near the AI's original midpoint.
 */
function snapBarrierToBestEdge(barrier, room) {
  const x1 = barrier.x1 ?? barrier.x ?? room.x;
  const y1 = barrier.y1 ?? barrier.y ?? room.y;
  const x2 = barrier.x2 ?? (barrier.x ?? room.x);
  const y2 = barrier.y2 ?? (barrier.y ?? room.y);
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const aiLen = Math.max(48, Math.hypot(x2 - x1, y2 - y1));
  const horizontal = dx >= dy;

  if (horizontal) {
    const top = room.y - ENV_ROOM_GAP;
    const bottom = room.y + room.h + ENV_ROOM_GAP;
    const useTop = Math.abs(midY - room.y) <= Math.abs(midY - (room.y + room.h));
    const edgeY = useTop ? top : bottom;
    const edgeMinX = room.x + 16;
    const edgeMaxX = room.x + room.w - 16;
    const span = Math.min(aiLen, edgeMaxX - edgeMinX);
    let cx = Math.min(Math.max(midX, edgeMinX + span / 2), edgeMaxX - span / 2);
    return { x1: Math.round(cx - span / 2), y1: edgeY, x2: Math.round(cx + span / 2), y2: edgeY };
  }
  const left = room.x - ENV_ROOM_GAP;
  const right = room.x + room.w + ENV_ROOM_GAP;
  const useLeft = Math.abs(midX - room.x) <= Math.abs(midX - (room.x + room.w));
  const edgeX = useLeft ? left : right;
  const edgeMinY = room.y + 16;
  const edgeMaxY = room.y + room.h - 16;
  const span = Math.min(aiLen, edgeMaxY - edgeMinY);
  let cy = Math.min(Math.max(midY, edgeMinY + span / 2), edgeMaxY - span / 2);
  return { x1: edgeX, y1: Math.round(cy - span / 2), x2: edgeX, y2: Math.round(cy + span / 2) };
}

/**
 * AI-emitted partitions/dividers/interior walls should keep their original
 * position rather than snapping to the room perimeter. We just straighten them
 * (force horizontal or vertical based on orientation) and clamp inside the room.
 */
function clampInteriorBarrierToRoom(barrier, room) {
  const x1 = barrier.x1 ?? room.x + 24;
  const y1 = barrier.y1 ?? room.y + 24;
  const x2 = barrier.x2 ?? room.x + room.w - 24;
  const y2 = barrier.y2 ?? room.y + room.h - 24;
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const minX = room.x + 12;
  const maxX = room.x + room.w - 12;
  const minY = room.y + 12;
  const maxY = room.y + room.h - 12;
  if (dx >= dy) {
    const yMid = Math.min(Math.max((y1 + y2) / 2, minY), maxY);
    return {
      x1: Math.min(Math.max(Math.min(x1, x2), minX), maxX),
      x2: Math.min(Math.max(Math.max(x1, x2), minX), maxX),
      y1: yMid,
      y2: yMid,
    };
  }
  const xMid = Math.min(Math.max((x1 + x2) / 2, minX), maxX);
  return {
    x1: xMid,
    x2: xMid,
    y1: Math.min(Math.max(Math.min(y1, y2), minY), maxY),
    y2: Math.min(Math.max(Math.max(y1, y2), minY), maxY),
  };
}

function isInteriorBarrierLabel(label) {
  return /\b(interior|partition|divider|cubicle|inner|inside)\b/i.test(String(label || ''));
}

function pickEdgeKey(barrier, room) {
  const x1 = barrier.x1 ?? barrier.x ?? room.x;
  const y1 = barrier.y1 ?? barrier.y ?? room.y;
  const x2 = barrier.x2 ?? (barrier.x ?? room.x);
  const y2 = barrier.y2 ?? (barrier.y ?? room.y);
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  if (dx >= dy) {
    return midY <= room.y + room.h / 2 ? 'top' : 'bottom';
  }
  return midX <= room.x + room.w / 2 ? 'left' : 'right';
}

function normalizeEnvironmentBarriers(barriers, rooms) {
  if (!barriers?.length || !rooms?.length) return barriers || [];

  const usedEdges = new Map(); // roomKey -> Set<edgeKey>
  return barriers.map((barrier) => {
    if (barrier.environmentKind === 'bus') return barrier;
    const room = findBarrierRoom(barrier, rooms);
    if (!room || barrier.shape !== 'line') return barrier;

    const roomKey = room.id || room.label;
    if (!usedEdges.has(roomKey)) usedEdges.set(roomKey, new Set());
    const used = usedEdges.get(roomKey);

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
      // Keep AI-supplied length and orientation but clamp inside the room.
      const clamped = clampInteriorBarrierToRoom(barrier, room);
      return { ...barrier, ...clamped };
    }

    // Wall handling: interior partitions stay where the AI placed them
    // (just clamped/straightened); perimeter walls snap to the best room edge
    // chosen by orientation, with length preserved when possible and a
    // round-robin fallback only if multiple walls collide on the same edge.
    if (isInteriorBarrierLabel(barrier.label)) {
      return {
        ...barrier,
        ...clampInteriorBarrierToRoom(barrier, room),
        blocksCablePath: barrier.blocksCablePath ?? true,
      };
    }

    let edgeKey = pickEdgeKey(barrier, room);
    if (used.has(edgeKey)) {
      const fallback = ['top', 'right', 'bottom', 'left'].find((e) => !used.has(e));
      if (fallback) edgeKey = fallback;
    }
    used.add(edgeKey);

    let snapped;
    if (edgeKey === 'top' || edgeKey === 'bottom') {
      snapped = snapBarrierToBestEdge({ ...barrier, x1: barrier.x1 ?? barrier.x, x2: barrier.x2 ?? barrier.x, y1: edgeKey === 'top' ? room.y - 1 : room.y + room.h + 1, y2: edgeKey === 'top' ? room.y - 1 : room.y + room.h + 1 }, room);
    } else {
      snapped = snapBarrierToBestEdge({ ...barrier, y1: barrier.y1 ?? barrier.y, y2: barrier.y2 ?? barrier.y, x1: edgeKey === 'left' ? room.x - 1 : room.x + room.w + 1, x2: edgeKey === 'left' ? room.x - 1 : room.x + room.w + 1 }, room);
    }

    return {
      ...barrier,
      ...snapped,
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

  // Spiral search outward — increased ring budget so dense AI layouts (30+
  // nodes packed close together) still find a clean spot instead of stacking.
  for (let ring = 1; ring <= 60; ring++) {
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
  // Fallback: scan a wide grid below/right of the cluster to guarantee no overlap.
  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 40; col++) {
      const nx = preferredX + col * (NODE_W + NODE_PAD);
      const ny = preferredY + row * (NODE_H + NODE_PAD);
      if (isFree(nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x: preferredX + 120, y: preferredY + 80 };
}

// Type ranking for grid ordering inside a room: infra first, then wireless,
// then servers, then user endpoints. Lower rank = placed earlier (top-left).
const TIDY_TYPE_RANK = {
  router: 0,
  firewall: 1,
  switch: 2,
  loadbalancer: 3,
  patchpanel: 4,
  ap: 5,
  server: 6,
  nas: 7,
  printer: 8,
  pc: 9,
  laptop: 10,
  tablet: 11,
  phone: 12,
  smarttv: 13,
  camera: 14,
  iot: 15,
  pdu: 16,
  cloud: 17,
};

/**
 * Re-grid nodes inside the rooms the AI assigned them to, so we don't preserve
 * the spaghetti coordinates the AI emitted. Nodes outside every room keep
 * their resolved positions. Returns a new node array; rooms are unchanged.
 *
 * Why: the AI puts APs at one corner of a room and endpoints scattered around,
 * which produces fan-shaped link bundles that cross every other link. A
 * compact centred grid per room keeps spokes short and parallel.
 */
function tidyNodesByRoom(nodes, rooms, offsetX, offsetY) {
  if (!rooms || !rooms.length || !nodes || !nodes.length) return nodes;

  const translatedRooms = rooms.map((r) => ({
    ...r,
    x: r.x + offsetX,
    y: r.y + offsetY,
  }));

  // Bucket each node into the AI room whose original bounds contain its centre.
  // Nodes outside every room (cloud/internet, edge router) get -1 and are left
  // where overlap resolution put them.
  const roomIdxByNode = new Map();
  for (const n of nodes) {
    if (n.isBusAnchor) {
      roomIdxByNode.set(n.id, -1);
      continue;
    }
    const cx = n.x + NODE_W / 2;
    const cy = n.y + NODE_H / 2;
    const idx = translatedRooms.findIndex((r) => (
      cx >= r.x - ROOM_CLAIM_PAD &&
      cx <= r.x + r.w + ROOM_CLAIM_PAD &&
      cy >= r.y - ROOM_CLAIM_PAD &&
      cy <= r.y + r.h + ROOM_CLAIM_PAD
    ));
    roomIdxByNode.set(n.id, idx);
  }

  const next = nodes.map((n) => ({ ...n }));

  for (let ri = 0; ri < translatedRooms.length; ri += 1) {
    const room = translatedRooms[ri];
    const roomNodes = next.filter((n) => roomIdxByNode.get(n.id) === ri);
    if (!roomNodes.length) continue;

    roomNodes.sort((a, b) => {
      const ra = TIDY_TYPE_RANK[a.type] ?? 99;
      const rb = TIDY_TYPE_RANK[b.type] ?? 99;
      if (ra !== rb) return ra - rb;
      return String(a.label || a.id || '').localeCompare(String(b.label || b.id || ''));
    });

    const cellW = NODE_W + NODE_PAD;
    const cellH = NODE_H + NODE_PAD;
    const innerW = Math.max(NODE_W, room.w - ROOM_PAD * 2);
    // Pick a column count that keeps the grid roughly square but fits the room.
    const colsByRoom = Math.max(1, Math.floor((innerW + NODE_PAD) / cellW));
    const colsBySqrt = Math.max(1, Math.ceil(Math.sqrt(roomNodes.length)));
    const cols = Math.max(1, Math.min(colsByRoom, colsBySqrt));
    const rows = Math.ceil(roomNodes.length / cols);

    const gridW = cols * cellW - NODE_PAD;
    const gridH = rows * cellH - NODE_PAD;
    const startX = Math.round(room.x + Math.max(ROOM_PAD, (room.w - gridW) / 2));
    const startY = Math.round(room.y + Math.max(ROOM_PAD, (room.h - gridH) / 2));

    roomNodes.forEach((node, i) => {
      node.x = startX + (i % cols) * cellW;
      node.y = startY + Math.floor(i / cols) * cellH;
    });
  }

  return next;
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

  // Re-grid nodes inside their AI-assigned rooms before sizing those rooms,
  // so the room bounds end up tight around a clean grid instead of around the
  // AI's scattered coordinates.
  const tidiedNodes = tidyNodesByRoom(adjustedNodes, topology.rooms || [], offsetX, offsetY);

  // Auto-size rooms to fit their contained devices
  const adjustedRooms = autoSizeRooms(topology.rooms, tidiedNodes, offsetX, offsetY);

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
    nodes: tidiedNodes,
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

const MESH_CORE_TYPES = new Set(['router', 'switch', 'firewall', 'loadbalancer']);
const ENDPOINT_TYPES = new Set(['pc', 'laptop', 'printer', 'server', 'camera', 'nas', 'phone', 'tablet', 'iot', 'smarttv', 'ap']);
const INFRA_TYPES = new Set(['router', 'switch', 'firewall', 'loadbalancer', 'cloud']);

function isMeshCoreNode(node) {
  if (!node || !MESH_CORE_TYPES.has(node.type)) return false;
  const label = String(node.label || '').toLowerCase();
  // Exclude obvious access-layer switches; mesh applies to backbone cores.
  if (/\b(access|edge access|idf|closet|wiring|patch)\b/.test(label) && node.type === 'switch') return false;
  return true;
}

function linkPairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function nodeCenter(node) {
  return { x: (node.x || 0) + NODE_W / 2, y: (node.y || 0) + NODE_H / 2 };
}

function normalizeStrictMeshTopology(topology) {
  const nodes = topology.nodes || [];
  const links = topology.links || [];
  const coreNodes = nodes.filter(isMeshCoreNode);
  if (coreNodes.length < 3) return topology;

  const existingPairs = new Set(
    links
      .filter((link) => link && link.source && link.target)
      .map((link) => linkPairKey(link.source, link.target)),
  );

  const newLinks = [];
  for (let i = 0; i < coreNodes.length; i += 1) {
    for (let j = i + 1; j < coreNodes.length; j += 1) {
      const a = coreNodes[i];
      const b = coreNodes[j];
      const key = linkPairKey(a.id, b.id);
      if (existingPairs.has(key)) continue;
      existingPairs.add(key);
      newLinks.push({
        id: `mesh_core_${a.id}_${b.id}`,
        source: a.id,
        target: b.id,
        type: 'fiber',
        label: 'Mesh core',
      });
    }
  }

  if (!newLinks.length) return topology;

  const coreCount = coreNodes.length;
  const expectedLinks = (coreCount * (coreCount - 1)) / 2;
  return {
    ...topology,
    links: [...links, ...newLinks],
    summary: `Mesh topology with ${coreCount} fully-interconnected core devices (${expectedLinks} core-to-core fiber links). Added ${newLinks.length} missing cross-link${newLinks.length === 1 ? '' : 's'} so every core node reaches every other core directly.`,
  };
}

function normalizeStrictStarTopology(topology) {
  const nodes = topology.nodes || [];
  const links = topology.links || [];
  if (nodes.length < 3) return topology;

  // Hub = the router/switch with the most existing connections; tie-break by node order.
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const link of links) {
    if (degree.has(link.source)) degree.set(link.source, degree.get(link.source) + 1);
    if (degree.has(link.target)) degree.set(link.target, degree.get(link.target) + 1);
  }
  const hubCandidates = nodes.filter((n) => n.type === 'switch' || n.type === 'router');
  if (!hubCandidates.length) return topology;
  const hub = hubCandidates.reduce((best, n) => (
    (degree.get(n.id) || 0) > (degree.get(best.id) || 0) ? n : best
  ), hubCandidates[0]);

  const existingPairs = new Set(
    links.filter((l) => l && l.source && l.target).map((l) => linkPairKey(l.source, l.target)),
  );

  // Strict star: every link must touch the hub (or be a cloud uplink). Drop
  // endpoint-to-endpoint chains AND infra-to-infra trees that would otherwise
  // turn the star into a multi-tier mess.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const filteredLinks = links.filter((link) => {
    const a = nodeById.get(link.source);
    const b = nodeById.get(link.target);
    if (!a || !b) return true;
    if (link.source === hub.id || link.target === hub.id) return true;
    // Allow cloud <-> single edge router/firewall uplinks (the hub may sit behind them).
    if (a.type === 'cloud' || b.type === 'cloud') return true;
    return false; // every other link is non-star clutter
  });

  // Ensure every non-hub, non-cloud node has a link to the hub.
  const addedLinks = [];
  for (const n of nodes) {
    if (n.id === hub.id) continue;
    if (n.type === 'cloud') continue; // cloud uplink can hop through edge router
    const key = linkPairKey(hub.id, n.id);
    if (existingPairs.has(key)) continue;
    // Skip if the node already touches the hub via the filtered link set.
    const touchesHub = filteredLinks.some((l) =>
      (l.source === hub.id && l.target === n.id) || (l.target === hub.id && l.source === n.id),
    );
    if (touchesHub) continue;
    addedLinks.push({
      id: `star_spoke_${n.id}`,
      source: hub.id,
      target: n.id,
      type: n.type === 'ap' ? 'ethernet' : (ENDPOINT_TYPES.has(n.type) ? 'ethernet' : 'fiber'),
      label: '',
    });
    existingPairs.add(key);
  }

  if (filteredLinks.length === links.length && !addedLinks.length) return topology;

  return {
    ...topology,
    links: [...filteredLinks, ...addedLinks],
    summary: `Star topology with ${nodes.length - 1} spoke device${nodes.length === 2 ? '' : 's'} radiating from one central hub (${hub.label || hub.type}). Removed endpoint-to-endpoint links and ensured every spoke connects directly to the hub.`,
  };
}

function normalizeStrictRingTopology(topology) {
  const nodes = topology.nodes || [];
  const links = topology.links || [];
  // Ring participants are router/switch nodes; need at least 3 to form a ring.
  const ringNodes = nodes.filter((n) => n.type === 'router' || n.type === 'switch');
  if (ringNodes.length < 3) return topology;

  // Order the ring by angle around the centroid so adjacency reflects layout.
  const cx = ringNodes.reduce((sum, n) => sum + nodeCenter(n).x, 0) / ringNodes.length;
  const cy = ringNodes.reduce((sum, n) => sum + nodeCenter(n).y, 0) / ringNodes.length;
  const ordered = [...ringNodes].sort((a, b) => {
    const ca = nodeCenter(a);
    const cb = nodeCenter(b);
    return Math.atan2(ca.y - cy, ca.x - cx) - Math.atan2(cb.y - cy, cb.x - cx);
  });

  const existingPairs = new Set(
    links.filter((l) => l && l.source && l.target).map((l) => linkPairKey(l.source, l.target)),
  );

  // Build the ring adjacency set we want.
  const desiredRingPairs = new Set();
  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    desiredRingPairs.add(linkPairKey(a.id, b.id));
  }

  // Remove non-ring lateral links between ring nodes, keep ring adjacency only.
  const ringIds = new Set(ordered.map((n) => n.id));
  const filteredLinks = links.filter((link) => {
    if (!ringIds.has(link.source) || !ringIds.has(link.target)) return true;
    return desiredRingPairs.has(linkPairKey(link.source, link.target));
  });

  // Add any missing ring adjacency links to close the loop.
  const addedLinks = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    const key = linkPairKey(a.id, b.id);
    if (existingPairs.has(key)) continue;
    addedLinks.push({
      id: `ring_seg_${a.id}_${b.id}`,
      source: a.id,
      target: b.id,
      type: 'fiber',
      label: 'Ring segment',
    });
    existingPairs.add(key);
  }

  if (filteredLinks.length === links.length && !addedLinks.length) return topology;

  return {
    ...topology,
    links: [...filteredLinks, ...addedLinks],
    summary: `Ring topology with ${ordered.length} nodes forming a closed loop. Added ${addedLinks.length} missing ring segment${addedLinks.length === 1 ? '' : 's'} and removed lateral chords so each ring node has exactly two ring neighbours.`,
  };
}

function normalizeStrictTreeTopology(topology) {
  const nodes = topology.nodes || [];
  const links = topology.links || [];
  if (nodes.length < 3 || !links.length) return topology;

  // Layer by Y coordinate. Allowed lateral links only between two infra nodes
  // on (roughly) the same layer (within 60px); allowed only at the second-from-top tier.
  const sortedY = [...nodes].map((n) => nodeCenter(n).y).sort((a, b) => a - b);
  if (!sortedY.length) return topology;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const layerOf = (n) => Math.round(nodeCenter(n).y / 80); // 80px bucket = layer
  const layerForNode = new Map(nodes.map((n) => [n.id, layerOf(n)]));
  const layerCounts = new Map();
  for (const layer of layerForNode.values()) {
    layerCounts.set(layer, (layerCounts.get(layer) || 0) + 1);
  }
  const layersWithMultiple = new Set([...layerCounts.entries()].filter(([, c]) => c >= 2).map(([l]) => l));
  // The "core" tier is the topmost layer that has >= 2 infra nodes (for redundant cores).
  const coreLayer = [...layersWithMultiple].sort((a, b) => a - b).find((layer) => {
    const layerNodes = nodes.filter((n) => layerForNode.get(n.id) === layer);
    return layerNodes.length >= 2 && layerNodes.every((n) => INFRA_TYPES.has(n.type));
  });

  const filteredLinks = links.filter((link) => {
    const a = nodeById.get(link.source);
    const b = nodeById.get(link.target);
    if (!a || !b) return true;
    const la = layerForNode.get(a.id);
    const lb = layerForNode.get(b.id);
    if (la !== lb) return true; // vertical link, allowed
    // Same-layer (lateral) link: only allow at the core layer between two infra nodes.
    if (coreLayer != null && la === coreLayer && INFRA_TYPES.has(a.type) && INFRA_TYPES.has(b.type)) return true;
    return false;
  });

  if (filteredLinks.length === links.length) return topology;
  const removed = links.length - filteredLinks.length;
  return {
    ...topology,
    links: filteredLinks,
    summary: `Tree topology with strict top-down hierarchy across ${layerCounts.size} layers. Removed ${removed} lateral link${removed === 1 ? '' : 's'} that broke the tree shape (only core-tier redundancy links are kept).`,
  };
}

export function normalizeTopologyForInferredShape(topology, topologyType, prompt = '') {
  if (topologyType === 'bus') return normalizeStrictBusTopology(topology, prompt);
  if (topologyType === 'mesh') return normalizeStrictMeshTopology(topology);
  if (topologyType === 'star') return normalizeStrictStarTopology(topology);
  if (topologyType === 'ring') return normalizeStrictRingTopology(topology);
  if (topologyType === 'tree') return normalizeStrictTreeTopology(topology);
  // hybrid: leave AI output alone — it intentionally mixes shapes.
  return topology;
}

function topologyBounds(topology) {
  const xs = [];
  const ys = [];
  (topology.nodes || []).forEach((n) => {
    xs.push(n.x, n.x + NODE_W);
    ys.push(n.y, n.y + NODE_H);
  });
  (topology.rooms || []).forEach((r) => {
    xs.push(r.x, r.x + r.w);
    ys.push(r.y, r.y + r.h);
  });
  (topology.barriers || []).forEach((b) => {
    if (typeof b.x1 === 'number' && typeof b.y1 === 'number') {
      xs.push(b.x1, typeof b.x2 === 'number' ? b.x2 : b.x1);
      ys.push(b.y1, typeof b.y2 === 'number' ? b.y2 : b.y1);
    }
    if (typeof b.x === 'number' && typeof b.y === 'number') {
      xs.push(b.x, b.x + (b.w || 0));
      ys.push(b.y, b.y + (b.h || 0));
    }
  });
  if (!xs.length || !ys.length) return null;
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function compactAndRecenterLayout(topology, options = {}) {
  const bounds = topologyBounds(topology);
  if (!bounds) return topology;
  const hasExistingCanvas = !!options.hasExistingCanvas;
  const targetMinX = hasExistingCanvas ? bounds.minX : 80;
  const targetMinY = hasExistingCanvas ? bounds.minY : 80;
  const dx = targetMinX - bounds.minX;
  const dy = targetMinY - bounds.minY;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  let scale = 1;
  const maxW = options.maxWidth || 1600;
  const maxH = options.maxHeight || 1000;
  if (width > maxW || height > maxH) {
    scale = Math.min(maxW / Math.max(1, width), maxH / Math.max(1, height));
  }
  if (scale >= 0.995 && dx === 0 && dy === 0) return topology;

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const projectPoint = (x, y) => {
    const sx = cx + (x - cx) * scale + dx;
    const sy = cy + (y - cy) * scale + dy;
    return { x: Math.round(sx), y: Math.round(sy) };
  };

  const nodes = (topology.nodes || []).map((n) => {
    const p = projectPoint(n.x, n.y);
    return { ...n, x: p.x, y: p.y };
  });
  const rooms = (topology.rooms || []).map((r) => {
    const p = projectPoint(r.x, r.y);
    return {
      ...r,
      x: p.x,
      y: p.y,
      w: Math.max(200, Math.round((r.w || MIN_ROOM_W) * scale)),
      h: Math.max(120, Math.round((r.h || MIN_ROOM_H) * scale)),
    };
  });
  const barriers = (topology.barriers || []).map((b) => {
    const shifted = { ...b };
    if (typeof b.x1 === 'number' && typeof b.y1 === 'number') {
      const p1 = projectPoint(b.x1, b.y1);
      shifted.x1 = p1.x;
      shifted.y1 = p1.y;
    }
    if (typeof b.x2 === 'number' && typeof b.y2 === 'number') {
      const p2 = projectPoint(b.x2, b.y2);
      shifted.x2 = p2.x;
      shifted.y2 = p2.y;
    }
    if (typeof b.x === 'number' && typeof b.y === 'number') {
      const p = projectPoint(b.x, b.y);
      shifted.x = p.x;
      shifted.y = p.y;
      if (typeof b.w === 'number') shifted.w = Math.max(20, Math.round(b.w * scale));
      if (typeof b.h === 'number') shifted.h = Math.max(20, Math.round(b.h * scale));
    }
    return shifted;
  });

  return { ...topology, nodes, rooms, barriers };
}

/**
 * Determine the best topology type for a given prompt.
 * Returns a recommendation with reasoning.
 */
export function recommendTopology(prompt) {
  const t = (prompt || '').toLowerCase();
  // Only count numbers that look like device counts (e.g. "12 workstations",
  // "30 PCs"). "3-story" or "floor 2" must NOT be treated as a device count.
  const deviceCountMatches = [...t.matchAll(/\b(\d+)\s*(?:x\s*)?(?:devices?|endpoints?|users?|seats?|staff|employees?|workstations?|pcs?|laptops?|computers?|clients?|hosts?|nodes?|phones?|cameras?|aps?|access\s*points?|tablets?|printers?|servers?)\b/g)];
  const deviceCounts = deviceCountMatches.map((m) => Number(m[1])).filter(Number.isFinite);
  const largestCount = deviceCounts.length ? Math.max(...deviceCounts) : null;

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

  // Multi-floor / multi-story buildings -> tree (must beat the small-network and
  // hybrid checks so "3-story building" is NOT classified as star).
  if (/\b(multi.?floor|multi.?story|multistory|multistorey|multi.?storey|\d+.?stor(?:ey|y|ies)|two.?stor|three.?stor|four.?stor|five.?stor|several.?floors?|multiple.?floors?|building.?core|distribution.?closet|floor.?switches|between.?floors?|stairwell|riser|idf.?per.?floor)/i.test(t)) {
    return { topology: 'tree', reason: 'Multi-floor buildings need a per-floor distribution hierarchy with a shared core, which is a tree.' };
  }

  // Data center / structured multi-tier scenarios -> tree.
  if (/\b(data.?cent|spine.?leaf|rack|server.?farm|colo|enterprise.?core|three.?tier)/i.test(t)) {
    return { topology: 'tree', reason: 'Data centers and structured tiered networks benefit from a core/distribution/access hierarchy.' };
  }

  // Small/local networks -> star (strict — only obvious "small site" wording).
  // Checked BEFORE hybrid so "small office with 2 departments" stays a star
  // instead of being escalated to a hybrid design with edge router, firewall,
  // and core+access tiers.
  if (/\b(small|simple|home|soho|basic|minimal|single.?room|front desk|tiny|clinic room|coffee shop|single office|one office|one room|reception)/i.test(t)) {
    return { topology: 'star', reason: 'Small single-area networks are best represented by endpoints around one central switch or router.' };
  }

  // Mixed departments/buildings/security zones -> hybrid.
  if (/\b(campus|multi.?build|enterprise|complex|mixed|departments?|student|faculty|admin|warehouse|iot|guest|operations|multiple zones|separate zones|network segments|segmented)/i.test(t)) {
    return { topology: 'hybrid', reason: 'Multiple zones, departments, or mixed wired/wireless/security needs fit a hybrid design.' };
  }

  if (largestCount != null && largestCount >= 24) {
    return { topology: 'tree', reason: 'Larger endpoint counts need a scalable hierarchy unless another scenario strongly implies a different topology.' };
  }
  if (largestCount != null && largestCount <= 12) {
    return { topology: 'star', reason: 'Small endpoint counts default to a central hub-and-spoke star.' };
  }

  return { topology: 'star', reason: 'A general small-to-medium network defaults to a central hub-and-spoke design unless the prompt implies a larger structure.' };
}
