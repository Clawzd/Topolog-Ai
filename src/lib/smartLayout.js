/**
 * Smart layout engine for AI-generated topologies.
 * Prevents overlapping, respects walls/rooms, and auto-sizes rooms to fit devices.
 */

const NODE_W = 90;
const NODE_H = 56;
const NODE_PAD = 24; // minimum gap between nodes
const ROOM_PAD = 30; // padding inside room edges

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

  return {
    ...topology,
    nodes: adjustedNodes,
    rooms: adjustedRooms,
  };
}

/**
 * Auto-size rooms so they contain all devices that belong to them.
 * Matches devices to rooms by checking if their original position was within the room bounds,
 * or by VLAN matching.
 */
function autoSizeRooms(rooms, adjustedNodes, offsetX, offsetY) {
  if (!rooms || rooms.length === 0) return [];

  return rooms.map(room => {
    const roomRect = {
      x: room.x + offsetX,
      y: room.y + offsetY,
      w: room.w,
      h: room.h,
    };

    // Find nodes that should be inside this room
    const containedNodes = adjustedNodes.filter(n => {
      // Check by position: node center is within the room bounds (with some tolerance)
      const cx = n.x + NODE_W / 2;
      const cy = n.y + NODE_H / 2;
      return (
        cx >= roomRect.x - ROOM_PAD &&
        cx <= roomRect.x + roomRect.w + ROOM_PAD &&
        cy >= roomRect.y - ROOM_PAD &&
        cy <= roomRect.y + roomRect.h + ROOM_PAD
      );
    });

    if (containedNodes.length === 0) {
      return { ...room, x: roomRect.x, y: roomRect.y };
    }

    // Compute bounding box of contained nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of containedNodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
      if (n.y + NODE_H > maxY) maxY = n.y + NODE_H;
    }

    return {
      ...room,
      x: minX - ROOM_PAD,
      y: minY - ROOM_PAD,
      w: Math.max(room.w, maxX - minX + ROOM_PAD * 2),
      h: Math.max(room.h, maxY - minY + ROOM_PAD * 2),
    };
  });
}

/**
 * Determine the best topology type for a given prompt.
 * Returns a recommendation with reasoning.
 */
export function recommendTopology(prompt) {
  const t = (prompt || '').toLowerCase();

  // High availability / redundancy -> mesh or ring
  if (/\b(redundan|high.?avail|failover|ha\b|no.?single.?point)/i.test(t)) {
    return { topology: 'mesh', reason: 'High availability requires redundant paths — mesh provides full interconnection.' };
  }
  // Data center / server farm -> tree (spine-leaf)
  if (/\b(data.?cent|spine.?leaf|rack|server.?farm|colo)/i.test(t)) {
    return { topology: 'tree', reason: 'Data centers use hierarchical spine-leaf (tree) architecture for scalable east-west traffic.' };
  }
  // Simple / small / home -> star
  if (/\b(small|simple|home|soho|basic|minimal|single.?room)/i.test(t)) {
    return { topology: 'star', reason: 'Small networks benefit from a simple star topology with a central switch.' };
  }
  // Campus / multi-building -> hybrid
  if (/\b(campus|multi.?build|enterprise|large|complex|mixed)/i.test(t)) {
    return { topology: 'hybrid', reason: 'Large multi-site networks use hybrid topology combining star cores with bus/ring backbones.' };
  }
  // ISP / backbone / WAN -> ring
  if (/\b(isp|backbone|wan|carrier|metro|provider)/i.test(t)) {
    return { topology: 'ring', reason: 'Provider/WAN networks use ring topology for redundant backbone paths.' };
  }
  // Linear / sequential / daisy chain -> bus
  if (/\b(linear|sequential|daisy|chain|assembly|production.?line)/i.test(t)) {
    return { topology: 'bus', reason: 'Sequential environments benefit from bus topology with shared backbone.' };
  }
  // Default: tree for most office/general scenarios
  return { topology: 'tree', reason: 'Hierarchical tree topology provides scalable, manageable network architecture for most scenarios.' };
}
