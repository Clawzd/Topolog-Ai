/**
 * Deterministic smart network engine (TopologAi v3).
 * Pure functions — no React. Call on topology changes (debounce in UI).
 */

export const NODE_DIM = { W: 90, H: 56 };

const WIFI_CLIENT_TYPES = new Set(['laptop', 'tablet', 'phone', 'printer', 'smarttv', 'iot', 'camera']);
const COVERAGE_SOURCE_TYPES = new Set(['ap', 'router']);
const GATEWAY_TYPES = new Set(['router', 'firewall', 'loadbalancer', 'cloud']);
const POE_NEED_TYPES = new Set(['camera', 'phone']);
/** Endpoints unlikely to have native SFP ports (SC-40). */
const FIBER_MEDIA_MISMATCH_TYPES = new Set(['pc', 'laptop', 'printer', 'tablet', 'phone', 'smarttv', 'iot']);

const MATERIAL_DB = {
  drywall: { thin: 3, medium: 5, thick: 8 },
  glass: { thin: 4, medium: 7, thick: 10 },
  brick: { thin: 8, medium: 12, thick: 18 },
  concrete: { thin: 12, medium: 20, thick: 30 },
  metal: { thin: 20, medium: 35, thick: 50 },
};

const BARRIER_BASE_DB = {
  drywall: 4,
  glass: 6,
  wood: 6,
  brick: 12,
  concrete: 20,
  metal: 28,
  water: 28,
  rf_shield: 120,
  custom: 8,
};

const THICKNESS_MUL = { thin: 0.85, medium: 1, thick: 1.35, custom: 1 };

function nodeCenter(n) {
  return { x: n.x + NODE_DIM.W / 2, y: n.y + NODE_DIM.H / 2 };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mergeNodeDefaults(node) {
  const t = node.type;
  const isAp = t === 'ap';
  const isRouter = t === 'router';
  return {
    ...node,
    connectionMode: node.connectionMode ?? (WIFI_CLIENT_TYPES.has(t) ? 'wifi' : t === 'pc' ? 'wired' : 'wifi'),
    preferredSsid: node.preferredSsid ?? '',
    requiredBandwidthMbps: node.requiredBandwidthMbps ?? (t === 'camera' ? 8 : t === 'smarttv' ? 25 : 5),
    mobility: node.mobility ?? 'fixed',
    criticality: node.criticality ?? 'normal',
    wifiEnabled: (isAp || isRouter) ? node.wifiEnabled !== false : node.wifiEnabled,
    coverageRadius: node.coverageRadius ?? (isAp ? 180 : 140),
    maxRadius: node.maxRadius ?? (isAp ? 240 : 200),
    wifiBand: node.wifiBand ?? 'dual',
    txPower: node.txPower ?? 'medium',
    channel: node.channel ?? 'auto',
    capacityClients: node.capacityClients ?? (isAp ? 30 : 24),
    backhaulType: node.backhaulType ?? 'ethernet',
    ssid: node.ssid ?? (isAp ? 'Corporate' : ''),
    supportedVlans: node.supportedVlans ?? '',
    poeCapable: node.poeCapable ?? (t === 'switch'),
    portCount: t === 'switch' ? (node.portCount ?? 24) : node.portCount,
    /** Modeled PoE budget on switches (watts). */
    poeBudgetWatts: t === 'switch' ? (node.poeBudgetWatts ?? 150) : node.poeBudgetWatts,
    /** Per-device PoE draw for budget math (watts); defaults by type if unset. */
    poeDrawWatts: node.poeDrawWatts,
    /** When true, AP is modeled as needing PoE (SC-47). Default off until enabled in properties. */
    poeRequired: isAp ? node.poeRequired === true : node.poeRequired,
  };
}

export function mergeLinkDefaults(link) {
  const type = link.type || 'ethernet';
  const defaultBw =
    type === 'fiber' ? 10000 : type === 'wifi' ? 300 : type === 'wan' ? 100 : 1000;
  return {
    ...link,
    bandwidthMbps: link.bandwidthMbps ?? defaultBw,
    cableLengthM: link.cableLengthM,
    poe: link.poe ?? 'none',
    utilizationPercent: link.utilizationPercent ?? 0,
    trunkVlans: link.trunkVlans ?? '',
    mediaType: link.mediaType ?? (type === 'fiber' ? 'fiber_sm' : 'cat6'),
    redundantGroup: link.redundantGroup ?? '',
  };
}

export function mergeRoomDefaults(room) {
  return {
    ...room,
    zoneType: room.zoneType ?? 'office',
    floor: room.floor ?? 1,
    environment: room.environment ?? 'open',
    maxUsers: room.maxUsers ?? 25,
    requiredVlan: room.requiredVlan ?? '',
    allowedDeviceTypes: room.allowedDeviceTypes ?? '',
    securityLevel: room.securityLevel ?? 'staff',
    defaultWallMaterial: room.defaultWallMaterial ?? 'drywall',
    wallThickness: room.wallThickness ?? 'medium',
    noiseLevel: room.noiseLevel ?? 'low',
  };
}

export function mergeBarrierDefaults(b) {
  return {
    ...b,
    shape: b.shape ?? 'line',
    barrierType: b.barrierType ?? 'drywall',
    thickness: b.thickness ?? 'medium',
    attenuationDb: b.attenuationDb,
    blocksWifi: b.blocksWifi !== false,
    blocksCablePath: b.blocksCablePath ?? false,
    label: b.label ?? '',
  };
}

function roomAtPoint(rooms, x, y) {
  return rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
}

function parseCommaTypes(s) {
  return String(s || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** When non-empty, device `type` must appear in the comma list (case-insensitive). */
function deviceAllowedInZone(deviceType, allowedCsv) {
  const tokens = parseCommaTypes(allowedCsv);
  if (!tokens.length) return true;
  return tokens.includes(String(deviceType || '').toLowerCase());
}

function isGuestishVlanTag(vlanName, vlans) {
  const v = String(vlanName || '').trim().toLowerCase();
  if (!v) return false;
  if (v.includes('guest')) return true;
  const row = (vlans || []).find((x) => x.name === vlanName);
  if (!row) return false;
  return String(row.label || '').toLowerCase().includes('guest');
}

function firstGuestVlanName(vlans) {
  const row = (vlans || []).find(
    (x) =>
      String(x.name || '').toLowerCase().includes('guest') ||
      String(x.label || '').toLowerCase().includes('guest'),
  );
  return row?.name || null;
}

function isLikelyIotSegmentVlan(vlanName) {
  const v = normVlanTag(vlanName);
  if (!v) return false;
  if (v.includes('iot')) return true;
  if (v.includes('zigbee')) return true;
  return false;
}

function isLikelyCameraSecurityVlan(vlanName) {
  const v = String(vlanName || '').toLowerCase();
  if (!v.trim()) return false;
  return v.includes('cam') || v.includes('cctv') || v.includes('security') || v.includes('surveil');
}

function estimatePoeDrawW(node) {
  const m = mergeNodeDefaults(node);
  if (Number.isFinite(Number(m.poeDrawWatts))) return Math.max(0, Number(m.poeDrawWatts));
  if (node.type === 'camera') return 15.4;
  if (node.type === 'ap') return 12;
  if (node.type === 'phone') return 7;
  return 0;
}

function isActiveNetworkNodeType(t) {
  return t === 'switch' || t === 'router' || t === 'firewall' || t === 'loadbalancer';
}

/** From a patch panel, can we reach any active L2/L3 device through the graph? */
function patchPanelReachesActive(ppId, nodes, links, nodeById, excludeNodeId, excludeLinkId) {
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const stack = [ppId];
  const seen = new Set();
  while (stack.length) {
    const u = stack.pop();
    if (seen.has(u)) continue;
    seen.add(u);
    if (u !== ppId && isActiveNetworkNodeType(nodeById[u]?.type)) return true;
    for (const v of adj.get(u) || []) {
      if (!seen.has(v)) stack.push(v);
    }
  }
  return false;
}

function rfShieldContainingPoint(barriers, x, y) {
  for (const raw of barriers || []) {
    const b = mergeBarrierDefaults(raw);
    if (b.barrierType !== 'rf_shield' || !b.blocksWifi) continue;
    if (b.shape === 'rect' && pointInRect(x, y, b.x, b.y, b.w, b.h)) return b;
  }
  return null;
}

function sumCameraMbpsBehind(switchId, excludeNeighborId, nodes, links, excludeNodeId, excludeLinkId) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const seen = new Set([switchId]);
  const stack = [switchId];
  let camMbps = 0;
  while (stack.length) {
    const u = stack.pop();
    if (u !== switchId && byId[u]?.type === 'camera') {
      camMbps += Number(mergeNodeDefaults(byId[u]).requiredBandwidthMbps) || 8;
    }
    for (const v of adj.get(u) || []) {
      if (v === excludeNeighborId) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      stack.push(v);
    }
  }
  return camMbps;
}

/** Undirected reachability from fromId to any node of targetType (BFS). */
function canReachDeviceType(fromId, targetType, nodes, links, excludeNodeId, excludeLinkId) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const seen = new Set();
  const q = [fromId];
  while (q.length) {
    const id = q.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    if (id !== fromId && byId[id]?.type === targetType) return true;
    for (const nid of adj.get(id) || []) {
      if (!seen.has(nid)) q.push(nid);
    }
  }
  return false;
}

function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

/** Segment intersection (p1-p2) with (p3-p4). Returns true if crossing (not just touching at endpoint loosely). */
function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  return false;
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

function barrierAttenuationDb(barrier) {
  const b = mergeBarrierDefaults(barrier);
  if (b.attenuationDb != null) return Number(b.attenuationDb);
  const base = BARRIER_BASE_DB[b.barrierType] ?? 6;
  const mul = THICKNESS_MUL[b.thickness] ?? 1;
  return base * mul;
}

function pointInsideBarrier(barrier, x, y) {
  const b = mergeBarrierDefaults(barrier);
  if (b.shape === 'rect') {
    return pointInRect(x, y, b.x, b.y, b.w, b.h);
  }
  return false;
}

function lineCrossesBarrier(barrier, x1, y1, x2, y2) {
  const b = mergeBarrierDefaults(barrier);
  if (b.shape === 'rect') {
    return segmentCrossesRect(x1, y1, x2, y2, b.x, b.y, b.w, b.h) ||
      pointInRect(x1, y1, b.x, b.y, b.w, b.h) ||
      pointInRect(x2, y2, b.x, b.y, b.w, b.h);
  }
  const lx1 = b.x1 ?? b.x;
  const ly1 = b.y1 ?? b.y;
  const lx2 = b.x2 ?? b.x + (b.dx || 0);
  const ly2 = b.y2 ?? b.y + (b.dy || 0);
  return segmentsCross(x1, y1, x2, y2, lx1, ly1, lx2, ly2);
}

/** First cable-blocking barrier intersecting segment (SC-41 copy). */
function firstCableBlockingBarrier(barriers, x1, y1, x2, y2) {
  for (const raw of barriers || []) {
    const b = mergeBarrierDefaults(raw);
    if (!b.blocksCablePath) continue;
    if (lineCrossesBarrier(b, x1, y1, x2, y2)) return b;
  }
  return null;
}

function collectBarrierLoss(barriers, x1, y1, x2, y2) {
  let db = 0;
  let rfBlock = false;
  for (const raw of barriers || []) {
    const br = mergeBarrierDefaults(raw);
    if (br.environmentKind === 'conduit') continue;
    if (!br.blocksWifi) continue;
    if (!lineCrossesBarrier(br, x1, y1, x2, y2)) continue;
    if (br.barrierType === 'rf_shield') {
      const apInside = pointInsideBarrier(br, x1, y1) || pointInsideBarrier(br, x2, y2);
      if (!apInside) rfBlock = true;
      else db += 8;
    } else {
      db += barrierAttenuationDb(br);
    }
  }
  return { db, rfBlock };
}

/** Per-barrier WiFi path detail for SC-13 (stacked attenuation). */
function listWifiBarrierCrossings(barriers, x1, y1, x2, y2) {
  const out = [];
  for (const raw of barriers || []) {
    const br = mergeBarrierDefaults(raw);
    if (br.environmentKind === 'conduit') continue;
    if (!br.blocksWifi) continue;
    if (!lineCrossesBarrier(br, x1, y1, x2, y2)) continue;
    const label = String(br.label || '').trim() || br.barrierType || 'barrier';
    if (br.barrierType === 'rf_shield') {
      const apInside = pointInsideBarrier(br, x1, y1) || pointInsideBarrier(br, x2, y2);
      if (!apInside) out.push({ label, db: null, kind: 'block' });
      else out.push({ label, db: 8, kind: 'atten' });
    } else {
      out.push({ label, db: barrierAttenuationDb(br), kind: 'atten' });
    }
  }
  return out;
}

function nodeCenterInPowerZone(cx, cy, powerZones) {
  for (const z of powerZones || []) {
    if (!z || z.w == null || z.h == null) continue;
    if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) return true;
  }
  return false;
}

/** Sum requiredBandwidthMbps reachable from startId without crossing excludeNeighborId (uplink cut). */
function sumDemandBeyondUplink(startId, excludeNeighborId, nodes, links, excludeNodeId, excludeLinkId) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const seen = new Set([startId]);
  const stack = [startId];
  let sum = 0;
  while (stack.length) {
    const u = stack.pop();
    if (u !== startId) {
      const n = byId[u];
      if (n && !['switch', 'patchpanel'].includes(n.type)) {
        sum += Number(mergeNodeDefaults(n).requiredBandwidthMbps) || 0;
      }
    }
    for (const v of adj.get(u) || []) {
      if (v === excludeNeighborId) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      stack.push(v);
    }
  }
  return sum;
}

/**
 * Switch-only subgraph: flag potential L2 loops when E > V-1 (SC-04).
 * Skips when every link in the component shares the same non-empty redundantGroup (LAG/STP hint).
 */
function findSwitchLoopIssues(nodes, links, excludeNodeId, excludeLinkId) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const swList = nodes.filter((n) => n.id !== excludeNodeId && n.type === 'switch');
  if (swList.length < 3) return [];
  const idSet = new Set(swList.map((s) => s.id));
  const visited = new Set();
  const issues = [];
  for (const start of swList) {
    if (visited.has(start.id)) continue;
    const compNodes = [];
    const linkIdSet = new Set();
    const q = [start.id];
    visited.add(start.id);
    while (q.length) {
      const u = q.shift();
      compNodes.push(u);
      for (const l of links) {
        if (l.id === excludeLinkId) continue;
        const lk = mergeLinkDefaults(l);
        if (lk.type !== 'ethernet' && lk.type !== 'fiber') continue;
        const other = l.source === u ? l.target : l.target === u ? l.source : null;
        if (!other || !idSet.has(other)) continue;
        linkIdSet.add(l.id);
        if (!visited.has(other)) {
          visited.add(other);
          q.push(other);
        }
      }
    }
    const V = compNodes.length;
    const E = linkIdSet.size;
    if (V < 3 || E <= V - 1) continue;
    const compLinks = links.filter((l) => linkIdSet.has(l.id));
    const rgVals = compLinks.map((l) => String(mergeLinkDefaults(l).redundantGroup || '').trim());
    const allTagged = rgVals.length > 0 && rgVals.every(Boolean);
    const oneGroup = new Set(rgVals.filter(Boolean)).size === 1;
    if (allTagged && oneGroup) continue;
    const labels = compNodes.slice(0, 6).map((id) => byId[id]?.label || id).join(' ↔ ');
    issues.push({
      nodeIds: compNodes.slice(0, 16),
      linkIds: [...linkIdSet].slice(0, 16),
      labels,
    });
  }
  return issues;
}

function roomBorderLossDb(roomA, roomB) {
  if (!roomA || !roomB || roomA.id === roomB.id) return 0;
  const mat = roomA.defaultWallMaterial || 'drywall';
  const thick = roomA.wallThickness || 'medium';
  const row = MATERIAL_DB[mat] || MATERIAL_DB.drywall;
  return row[thick] ?? row.medium;
}

function noiseDbFromRoom(room) {
  if (!room) return 0;
  const rm = mergeRoomDefaults(room);
  let db = 0;
  if (rm.environment === 'dense') db += 4;
  else if (rm.environment === 'industrial') db += 6;
  if (rm.noiseLevel === 'high') db += 8;
  else if (rm.noiseLevel === 'medium') db += 4;
  return Math.min(28, db);
}

/** Extra loss when AP and client sit in zones with different `floor` (both must be inside rooms). */
const INTER_FLOOR_DB_PER_LEVEL = 9;
const INTER_FLOOR_DB_MAX = 40;

function interFloorLossDb(roomAp, roomClient) {
  if (!roomAp || !roomClient) return 0;
  const fa = Number(mergeRoomDefaults(roomAp).floor);
  const fb = Number(mergeRoomDefaults(roomClient).floor);
  const flA = Number.isFinite(fa) ? fa : 1;
  const flB = Number.isFinite(fb) ? fb : 1;
  const diff = Math.abs(flA - flB);
  if (diff < 1e-6) return 0;
  return Math.min(INTER_FLOOR_DB_MAX, diff * INTER_FLOOR_DB_PER_LEVEL);
}

function txPowerRadiusMul(tx) {
  if (tx === 'low') return 0.75;
  if (tx === 'high') return 1.2;
  return 1;
}

function buildGraph(nodes, links, excludeNodeId, excludeLinkId) {
  const adj = new Map(nodes.map(n => [n.id, []]));
  const activeNodes = new Set(nodes.filter(n => n.id !== excludeNodeId).map(n => n.id));
  links.forEach(l => {
    if (l.id === excludeLinkId) return;
    if (!activeNodes.has(l.source) || !activeNodes.has(l.target)) return;
    adj.get(l.source).push(l.target);
    adj.get(l.target).push(l.source);
  });
  return adj;
}

function reachableFrom(startIds, adj, allowed = null) {
  const seen = new Set();
  const stack = [...startIds];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of adj.get(id) || []) {
      if (allowed && !allowed(id, n)) continue;
      if (!seen.has(n)) stack.push(n);
    }
  }
  return seen;
}

/** LAN / core graph: reachability from any gateway-class node (router, firewall, LB, cloud). */
function nodesReachLan(nodes, links, excludeNodeId, excludeLinkId) {
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const seeds = nodes.filter((n) => GATEWAY_TYPES.has(n.type)).map((n) => n.id);
  if (!seeds.length) return new Set(nodes.map((n) => n.id));
  return reachableFrom(seeds, adj);
}

/** Outbound Internet modeled only from Cloud/ISP nodes. */
function nodesReachWan(nodes, links, excludeNodeId, excludeLinkId) {
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const seeds = nodes.filter((n) => n.type === 'cloud').map((n) => n.id);
  if (!seeds.length) return new Set();
  return reachableFrom(seeds, adj);
}

function hasEthernetPathToGateway(nodeId, nodes, links, lanReach, excludeNodeId, excludeLinkId) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const stack = [nodeId];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    if (GATEWAY_TYPES.has(byId[id]?.type) && lanReach.has(id)) return true;
    for (const nid of adj.get(id) || []) {
      const link = links.find(l =>
        l.id !== excludeLinkId &&
        ((l.source === id && l.target === nid) || (l.target === id && l.source === nid))
      );
      if (!link) continue;
      const lt = link.type;
      if (lt !== 'ethernet' && lt !== 'fiber') continue;
      if (!seen.has(nid)) stack.push(nid);
    }
  }
  return false;
}

function coverageSources(nodes) {
  return nodes
    .filter(n => COVERAGE_SOURCE_TYPES.has(n.type) && mergeNodeDefaults(n).wifiEnabled)
    .map(n => mergeNodeDefaults(n));
}

function isWirelessClient(node) {
  const n = mergeNodeDefaults(node);
  if (WIFI_CLIENT_TYPES.has(n.type)) {
    return n.connectionMode !== 'wired';
  }
  if (n.type === 'pc') {
    return n.connectionMode === 'wifi' || n.connectionMode === 'auto';
  }
  return false;
}

function apChannelKey(ap) {
  const ch = ap.channel;
  if (ch === 'auto' || ch == null) return `auto-${ap.id}`;
  return String(ch);
}

function coChannelPairs(aps) {
  const pairs = [];
  const list = aps.map(a => mergeNodeDefaults(a));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (apChannelKey(list[i]) === apChannelKey(list[j]) && list[i].channel !== 'auto') {
        pairs.push([list[i], list[j]]);
      }
    }
  }
  return pairs;
}

/** For canvas co-channel hatched overlay (AP coverage overlap approximation). */
export function getCoChannelApPairs(rawNodes) {
  const aps = (rawNodes || []).filter((n) => n.type === 'ap').map(mergeNodeDefaults);
  return coChannelPairs(aps).map(([a, b]) => {
    const r1 = Number(a.coverageRadius) || 180;
    const r2 = Number(b.coverageRadius) || 180;
    return {
      id: `${a.id}_${b.id}`,
      x1: a.x + NODE_DIM.W / 2,
      y1: a.y + NODE_DIM.H / 2,
      x2: b.x + NODE_DIM.W / 2,
      y2: b.y + NODE_DIM.H / 2,
      r1: r1 * 0.72,
      r2: r2 * 0.72,
      channel: a.channel,
    };
  });
}

function cableLengthFromPixels(link, nodes) {
  const a = nodes.find(n => n.id === link.source);
  const b = nodes.find(n => n.id === link.target);
  if (!a || !b) return 0;
  const d = dist(nodeCenter(a), nodeCenter(b));
  return link.cableLengthM ?? d * 0.1524;
}

function normVlanTag(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function parseVlanCsv(s) {
  return String(s || '')
    .split(',')
    .map((t) => normVlanTag(t))
    .filter(Boolean);
}

/** Empty CSV means "not specified" → allow any VLAN for validation. */
function vlanMentionedInCsv(csv, vlanRaw) {
  const v = normVlanTag(vlanRaw);
  if (!v) return true;
  const tokens = parseVlanCsv(csv);
  if (!tokens.length) return true;
  return tokens.includes(v);
}

function findLinkBetween(links, a, b, excludeLinkId) {
  return links.find(
    (l) =>
      l.id !== excludeLinkId &&
      ((l.source === a && l.target === b) || (l.source === b && l.target === a)),
  );
}

function linksAlongNodePath(links, path, excludeLinkId) {
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const lk = findLinkBetween(links, path[i], path[i + 1], excludeLinkId);
    if (lk) out.push(lk);
  }
  return out;
}

/** Shortest path using only Ethernet/fiber edges to a WAN/core-type node in lanReach. */
function wiredShortestPathToCore(nodes, links, lanReach, fromId, excludeNodeId, excludeLinkId) {
  const gatewayIds = new Set(
    nodes
      .filter((n) => n.id !== fromId && GATEWAY_TYPES.has(n.type) && lanReach.has(n.id))
      .map((n) => n.id),
  );
  if (!gatewayIds.size || !lanReach.has(fromId)) return null;

  const adj = new Map(nodes.map((n) => [n.id, []]));
  const active = new Set(nodes.filter((n) => n.id !== excludeNodeId).map((n) => n.id));
  links.forEach((l) => {
    if (l.id === excludeLinkId) return;
    const lk = mergeLinkDefaults(l);
    if (lk.type !== 'ethernet' && lk.type !== 'fiber') return;
    if (!active.has(l.source) || !active.has(l.target)) return;
    adj.get(l.source).push(l.target);
    adj.get(l.target).push(l.source);
  });

  const prev = new Map();
  const q = [fromId];
  const seen = new Set([fromId]);
  let end = null;
  while (q.length) {
    const id = q.shift();
    if (gatewayIds.has(id) && id !== fromId) {
      end = id;
      break;
    }
    for (const nid of adj.get(id) || []) {
      if (seen.has(nid)) continue;
      seen.add(nid);
      prev.set(nid, id);
      q.push(nid);
    }
  }
  if (end == null) return null;
  const path = [end];
  let cur = end;
  while (cur !== fromId) {
    cur = prev.get(cur);
    if (cur == null) return null;
    path.unshift(cur);
  }
  return path;
}

/** @param {object} params */
export function computeSmartTopology({
  nodes: rawNodes,
  links: rawLinks,
  rooms: rawRooms,
  vlans = [],
  barriers: rawBarriers = [],
  vlanZones = [],
  powerZones: rawPowerZones = [],
  excludeNodeId = null,
  excludeLinkId = null,
}) {
  const nodes = rawNodes.map(mergeNodeDefaults);
  const links = rawLinks.map(mergeLinkDefaults);
  const rooms = rawRooms.map(mergeRoomDefaults);
  const barriers = (rawBarriers || []).map(mergeBarrierDefaults);
  const powerZones = rawPowerZones || [];
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
  const findings = [];
  const deviceStates = {};

  const lanReach = nodesReachLan(nodes, links, excludeNodeId, excludeLinkId);
  const wanReach = nodesReachWan(nodes, links, excludeNodeId, excludeLinkId);
  const hasCloud = nodes.some((n) => n.type === 'cloud');
  const hasFw = nodes.some((n) => n.type === 'firewall');
  const unprotectedWanLinkIds = [];
  if (hasCloud && !hasFw && nodes.length > 2) {
    links.forEach((l) => {
      const a = nodeById[l.source];
      const b = nodeById[l.target];
      if (!a || !b) return;
      if (a.type === 'cloud' && b.type !== 'firewall') unprotectedWanLinkIds.push(l.id);
      else if (b.type === 'cloud' && a.type !== 'firewall') unprotectedWanLinkIds.push(l.id);
    });
  }

  // SC-08: two routers in the same routed component (double NAT risk).
  const routersLan = nodes.filter((r) => r.type === 'router' && lanReach.has(r.id));
  if (routersLan.length >= 2 && nodes.length > 4) {
    let pairConnected = false;
    for (let i = 0; i < routersLan.length && !pairConnected; i++) {
      for (let j = i + 1; j < routersLan.length; j++) {
        const p = shortestPath(nodes, links, routersLan[i].id, routersLan[j].id, excludeNodeId, excludeLinkId);
        if (p && p.length >= 2) {
          pairConnected = true;
          break;
        }
      }
    }
    if (pairConnected) {
      findings.push({
        id: 'double_nat',
        severity: 'medium',
        title: 'Possible double NAT',
        detail:
          'Two routers appear in the same connected fabric — devices behind a second router may hit NAT twice (port forwarding / VoIP / VPN issues).',
        nodeIds: routersLan.map((r) => r.id),
        linkIds: [],
        whyLines: [],
        suggestions: ['Set the inner router to bridge / AP mode', 'Replace the inner router with a switch where routing is not needed'],
        autoFix: null,
      });
    }
  }

  const aps = coverageSources(nodes);

  const apClients = Object.fromEntries(aps.map(a => [a.id, []]));

  const coChanPairs = coChannelPairs(aps);
  const coChannelApIds = new Set();
  coChanPairs.forEach(([a, b]) => {
    coChannelApIds.add(a.id);
    coChannelApIds.add(b.id);
  });

  // SC-04: switch-only cycles without full redundancy tagging
  findSwitchLoopIssues(nodes, links, excludeNodeId, excludeLinkId).forEach((issue, idx) => {
    findings.push({
      id: `stp_loop_${idx}`,
      severity: 'medium',
      title: 'Potential switching loop',
      detail: `Switch fabric may contain a layer-2 loop (${issue.labels || 'multiple switches'}) — enable STP or align redundancy groups on parallel links.`,
      nodeIds: issue.nodeIds,
      linkIds: issue.linkIds,
      whyLines: ['Switch-only subgraph has more links than a tree (E > V−1).'],
      suggestions: ['Configure Spanning Tree Protocol (STP)', 'Mark parallel links with the same redundancyGroup for LAG', 'Remove unintended parallel switch paths'],
      autoFix: null,
    });
  });

  // Assign wireless clients to APs
  nodes.forEach(client => {
    if (!isWirelessClient(client)) return;
    const cc = nodeCenter(client);
    const roomC = roomAtPoint(rooms, cc.x, cc.y);

    if (hasEthernetPathToGateway(client.id, nodes, links, lanReach, excludeNodeId, excludeLinkId)) {
      const gwPath = wiredShortestPathToCore(nodes, links, lanReach, client.id, excludeNodeId, excludeLinkId);
      const hops = gwPath && gwPath.length > 1 ? gwPath.length - 1 : null;
      const hopLine =
        hops != null ? `${hops} wired hop${hops === 1 ? '' : 's'} to gateway.` : null;
      deviceStates[client.id] = {
        smartState: 'healthy',
        quality: hops != null && hops <= 2 ? 90 : hops != null && hops >= 6 ? 78 : 88,
        reasons: ['Connected via wired Ethernet path to gateway.', hopLine].filter(Boolean),
        suggestions: [],
        badgeLabel: hops != null && hops <= 2 ? 'Excellent' : 'Good',
        badgeTone: hops != null && hops <= 2 ? 'excellent' : 'good',
        apId: null,
        tracePathNodeIds: gwPath || null,
        gatewayHops: hops,
      };
      return;
    }

    /** @type {null | { ap: any, score: number, d: number, totalDb: number, rfBlock: boolean, floorDb: number, barrierList: any[] }} */
    let best = null;
    let bestScore = -1;
    let secondPassRan = false;
    const clientPref = String(client.preferredSsid || '').trim();

    const runApScoring = (ssidStrict) => {
      aps.forEach((ap) => {
        if (!lanReach.has(ap.id)) return;
        const apn = mergeNodeDefaults(ap);
        if (ssidStrict && clientPref) {
          const apSsid = String(apn.ssid || '').trim();
          if (apSsid && clientPref !== apSsid) return;
        }
        const ac = nodeCenter(ap);
        const d = dist(cc, ac);
        const maxR = (apn.maxRadius || 240) * txPowerRadiusMul(apn.txPower);
        const roomAp = roomAtPoint(rooms, ac.x, ac.y);
        const { db: barrierDb, rfBlock } = collectBarrierLoss(barriers, ac.x, ac.y, cc.x, cc.y);
        const borderDb = roomBorderLossDb(roomAp, roomC);
        const floorDb = interFloorLossDb(roomAp, roomC);
        const noiseDb = noiseDbFromRoom(roomC) + noiseDbFromRoom(roomAp);
        const totalDb = barrierDb + borderDb + noiseDb + floorDb + (apn.environment === 'dense' ? 3 : 0);
        if (rfBlock) {
          if (bestScore < 0) best = { ap, score: 0, d, totalDb, rfBlock: true, floorDb: 0, barrierList: [] };
          return;
        }
        let score = 100 - (d / maxR) * 100 - totalDb * 0.45;
        if (coChannelApIds.has(ap.id)) score -= 12;
        score = Math.max(0, Math.min(100, score));
        if (score > bestScore) {
          bestScore = score;
          best = {
            ap,
            score,
            d,
            totalDb,
            rfBlock: false,
            floorDb,
            barrierList: listWifiBarrierCrossings(barriers, ac.x, ac.y, cc.x, cc.y),
          };
        }
      });
    };

    runApScoring(true);
    if (!best || best.rfBlock || bestScore < 1) {
      best = null;
      bestScore = -1;
      runApScoring(false);
      secondPassRan = !!clientPref;
    }

    if (!best || best.rfBlock || bestScore < 1) {
      const reasons = [];
      if (best?.rfBlock) reasons.push('RF shield or blocking barrier between device and access point.');
      else if (!aps.length) reasons.push('No access point or WiFi router with coverage in the design.');
      else reasons.push('Outside WiFi coverage or signal blocked.');
      deviceStates[client.id] = {
        smartState: 'no_network',
        quality: 0,
        reasons,
        suggestions: aps.length ? ['Move closer to an access point', 'Add cabling to a switch', 'Relocate AP'] : ['Add an access point', 'Use wired Ethernet'],
        badgeLabel: 'No Net',
        badgeTone: 'critical',
        apId: best?.ap?.id || null,
      };
      return;
    }

    apClients[best.ap.id].push(client.id);
    const apn = mergeNodeDefaults(best.ap);
    const cap = apn.capacityClients || 30;
    const load = apClients[best.ap.id].length;
    let congested = load > cap;
    let score = bestScore;
    if (congested) {
      const over = load - cap;
      score -= Math.min(40, over * 8);
    }

    let smartState = 'healthy';
    let badgeLabel = 'Excellent';
    let badgeTone = 'excellent';
    if (score >= 80) { smartState = 'healthy'; badgeLabel = 'Excellent'; badgeTone = 'excellent'; }
    else if (score >= 60) { smartState = 'healthy'; badgeLabel = 'Good'; badgeTone = 'good'; }
    else if (score >= 40) { smartState = 'weak_signal'; badgeLabel = 'Weak'; badgeTone = 'weak'; }
    else if (score >= 20) { smartState = 'slow_network'; badgeLabel = 'Slow'; badgeTone = 'slow'; }
    else { smartState = 'no_network'; badgeLabel = 'No Net'; badgeTone = 'critical'; }

    if (congested && score >= 40) {
      smartState = 'slow_network';
      badgeLabel = 'Congested';
      badgeTone = 'slow';
    }

    const brCross = best.barrierList || [];
    const attenBars = brCross.filter((b) => b.kind === 'atten' && b.db != null && b.db > 0.5);
    const stackLine =
      attenBars.length >= 2
        ? `Signal crosses: ${attenBars.map((b) => `${b.label} (−${Math.round(b.db)} dB)`).join(', ')}.`
        : '';
    const reasons = [
      `${Math.round(best.d)} canvas units from ${apn.label || apn.id}.`,
      best.totalDb > 0.5 && !stackLine ? `Estimated obstruction/noise penalty ~${Math.round(best.totalDb)} dB.` : '',
      stackLine,
      best.floorDb > 0.5 ? `AP and client zones use different floors (~${Math.round(best.floorDb)} dB inter-floor loss).` : '',
    ].filter(Boolean);
    if (congested) reasons.push(`AP serves ${load} clients (capacity ${cap}).`);
    if (attenBars.length >= 2 && best.totalDb > 12) {
      findings.push({
        id: `wifi_stack_${client.id}`,
        severity: 'medium',
        title: 'Multiple RF barriers on WiFi path',
        detail: `${client.label || client.id} path to ${apn.label || apn.id} crosses ${attenBars.length} attenuating barriers (~${Math.round(best.totalDb)} dB combined).`,
        nodeIds: [client.id, apn.id],
        linkIds: [],
        whyLines: attenBars.map((b) => `${b.label}: ~${Math.round(b.db)} dB`),
        suggestions: ['Add an AP on the near side of the wall', 'Use wired Ethernet for this client'],
        autoFix: null,
      });
    }

    const apSsidChosen = String(apn.ssid || '').trim();
    if (
      secondPassRan &&
      clientPref &&
      apSsidChosen &&
      clientPref !== apSsidChosen
    ) {
      reasons.push(`Preferred SSID "${clientPref}" not available — associated with ${apSsidChosen || apn.label || apn.id} instead.`);
    }

    const suggestions = [];
    if (score < 60) suggestions.push(`Move ${client.label || client.id} closer to ${apn.label || apn.id}.`);
    if (congested) suggestions.push('Add another AP or reduce client load.');
    if (best.totalDb > 8) suggestions.push('Remove barriers or add AP on the near side of the wall.');
    if (best.floorDb > 9) suggestions.push('Add an AP on this floor or align room floor numbers with the physical stack.');
    if (secondPassRan && clientPref && apSsidChosen && clientPref !== apSsidChosen) {
      suggestions.push(`Add an AP with SSID "${clientPref}" or clear preferred SSID on this device.`);
    }

    // SC-19: weak but usable — informational finding (not an error state).
    const qRound = Math.round(score);
    if (smartState === 'weak_signal' && qRound >= 35 && qRound < 60) {
      findings.push({
        id: `wifi_ok_${client.id}`,
        severity: 'low',
        title: 'Weak WiFi but usable',
        detail: `${client.label || client.id} has moderate WiFi quality (${qRound}/100) — may see occasional drops.`,
        nodeIds: [client.id, apn.id],
        linkIds: [],
        whyLines: [],
        suggestions: ['Move closer to the AP or add capacity if this is a primary workspace'],
        autoFix: null,
      });
    }

    // SC-21: 5 GHz-only AP and client at the edge of usable range.
    const bandStr = String(apn.wifiBand || '').toLowerCase();
    const fiveOnly =
      (bandStr === '5ghz' || bandStr === '5' || bandStr.includes('5ghz')) && !bandStr.includes('dual');
    if (fiveOnly && qRound >= 22 && qRound <= 58) {
      findings.push({
        id: `wifi5_edge_${client.id}`,
        severity: 'low',
        title: 'Near edge of 5 GHz coverage',
        detail: `${client.label || client.id} is at the edge of ${apn.label || apn.id} (5 GHz–biased) — dual-band often improves mid-range coverage.`,
        nodeIds: [client.id, apn.id],
        linkIds: [],
        whyLines: [`wifiBand=${apn.wifiBand}`],
        suggestions: ['Enable dual-band on the AP', 'Add a 2.4 GHz–capable AP nearby'],
        autoFix: null,
      });
    }

    deviceStates[client.id] = {
      smartState: congested && smartState === 'healthy' ? 'slow_network' : smartState,
      quality: Math.round(score),
      reasons,
      suggestions,
      badgeLabel,
      badgeTone,
      apId: best.ap.id,
    };
  });

  // SC-17: client inside RF-shielded zone without usable WiFi.
  nodes.forEach((client) => {
    if (!isWirelessClient(client)) return;
    const cc = nodeCenter(client);
    const shield = rfShieldContainingPoint(barriers, cc.x, cc.y);
    if (!shield) return;
    const st = deviceStates[client.id];
    if (!st || (st.smartState !== 'no_network' && (st.quality ?? 100) > 12)) return;
    findings.push({
      id: `rf_shield_${client.id}`,
      severity: 'high',
      title: 'RF shield blocks WiFi',
      detail: `${client.label || client.id} sits inside "${shield.label || 'RF shield'}" with no in-zone AP — shielded rooms need local Ethernet or an AP inside the enclosure.`,
      nodeIds: [client.id],
      linkIds: [],
      whyLines: [],
      suggestions: ['Place an AP inside the shielded space', 'Use wired Ethernet for devices in the shielded room'],
      autoFix: null,
    });
  });

  // SC-15: co-channel findings after client counts are known
  coChanPairs.forEach(([a, b]) => {
    const ca = (apClients[a.id] || []).length;
    const cb = (apClients[b.id] || []).length;
    findings.push({
      id: `cc_${a.id}_${b.id}`,
      severity: 'medium',
      title: 'Co-channel interference',
      detail: `${a.label || a.id} and ${b.label || b.id} use the same WiFi channel — overlap may reduce performance for up to ${ca + cb} wireless devices in range.`,
      nodeIds: [a.id, b.id],
      linkIds: [],
      whyLines: [`Both on channel ${a.channel}`, `Distance ${Math.round(dist(nodeCenter(a), nodeCenter(b)))} canvas units`],
      suggestions: [`Change channel on ${b.label || b.id}`, 'Use 5 GHz where possible'],
      autoFix: null,
    });
  });

  // SC-10: device only cabled through patch panels with no path to active gear.
  nodes.forEach((n) => {
    if (n.type === 'patchpanel' || n.type === 'cloud') return;
    const nbrs = links
      .filter((l) => l.id !== excludeLinkId && (l.source === n.id || l.target === n.id))
      .map((l) => (l.source === n.id ? l.target : l.source));
    if (!nbrs.length) return;
    const onlyPatch = nbrs.every((id) => nodeById[id]?.type === 'patchpanel');
    if (!onlyPatch) return;
    const anyUplink = nbrs.some((pp) =>
      patchPanelReachesActive(pp, nodes, links, nodeById, excludeNodeId, excludeLinkId),
    );
    if (anyUplink) return;
    findings.push({
      id: `patch_dead_${n.id}`,
      severity: 'high',
      title: 'Passive patch path only',
      detail: `${n.label || n.id} is connected only through patch panel(s) with no uplink to a live switch or router — patch panels cannot forward traffic.`,
      nodeIds: [n.id, ...nbrs],
      linkIds: [],
      whyLines: [],
      suggestions: ['Connect the patch panel to a switch', 'Home-run cables to an active switch port'],
      autoFix: null,
    });
    const cur = deviceStates[n.id];
    if (!cur || cur.smartState === 'isolated') {
      deviceStates[n.id] = {
        smartState: 'no_network',
        quality: 0,
        reasons: ['Only passive patch panel connections with no path to active switching.'],
        suggestions: ['Connect patch panel to a switch or router'],
        badgeLabel: 'No Net',
        badgeTone: 'critical',
        apId: null,
      };
    }
  });

  // Non-wireless-capable devices: gateway path
  nodes.forEach(n => {
    if (deviceStates[n.id]) return;
    if (n.type === 'ap' || n.type === 'patchpanel') return;
    if (lanReach.has(n.id)) {
      const gwPath = wiredShortestPathToCore(nodes, links, lanReach, n.id, excludeNodeId, excludeLinkId);
      const hops = gwPath && gwPath.length > 1 ? gwPath.length - 1 : null;
      const hopReason =
        hops != null
          ? `${hops} wired hop${hops === 1 ? '' : 's'} to the nearest gateway-class node.`
          : 'Reachable on the LAN from a router, firewall, load balancer, or core hop.';
      const excellent = hops != null && hops <= 2;
      deviceStates[n.id] = {
        smartState: 'healthy',
        quality: excellent ? 94 : hops != null && hops >= 6 ? 84 : 92,
        reasons: ['Reachable on the LAN from a router, firewall, load balancer, or core hop.', hopReason],
        suggestions: [],
        badgeLabel: excellent ? 'Excellent' : 'Online',
        badgeTone: excellent ? 'excellent' : 'good',
        apId: null,
        tracePathNodeIds: gwPath || null,
        gatewayHops: hops,
      };
    } else {
      deviceStates[n.id] = {
        smartState: 'isolated',
        quality: 0,
        reasons: ['No path to Internet / core from this device in the current link graph.'],
        suggestions: ['Connect to router, firewall, or existing network path'],
        badgeLabel: 'Isolated',
        badgeTone: 'isolated',
      };
      findings.push({
        id: `iso_${n.id}`,
        severity: 'high',
        title: n.type === 'switch' ? 'Switch without upstream path' : 'Isolated device',
        detail:
          n.type === 'switch'
            ? `${n.label || n.id} has no upstream path to any router or gateway-class device — downstream devices cannot reach the core.`
            : `${n.label || n.id} has no connection path to the WAN/core.`,
        nodeIds: [n.id],
        linkIds: [],
        whyLines: ['Graph reachability from LAN/core gateway seeds did not include this node.'],
        suggestions:
          n.type === 'switch'
            ? [`Connect ${n.label || n.id} to a router or upstream switch`]
            : ['Connect to the rest of the network'],
        autoFix: null,
      });
    }
  });

  // APs themselves
  aps.forEach(ap => {
    const gr = lanReach.has(ap.id);
    const apGwPath = gr ? wiredShortestPathToCore(nodes, links, lanReach, ap.id, excludeNodeId, excludeLinkId) : null;
    const apHops = apGwPath && apGwPath.length > 1 ? apGwPath.length - 1 : null;
    deviceStates[ap.id] = {
      smartState: gr ? 'healthy' : 'isolated',
      quality: gr ? 95 : 0,
      reasons: gr
        ? ['Access point has uplink path to core.', apHops != null ? `${apHops} wired hop${apHops === 1 ? '' : 's'} to gateway.` : ''].filter(Boolean)
        : ['AP has no uplink to gateway.'],
      suggestions: gr ? [] : ['Wire AP to switch or router'],
      badgeLabel: gr ? 'AP' : 'Isolated',
      badgeTone: gr ? 'good' : 'isolated',
      apId: null,
      tracePathNodeIds: apGwPath || null,
      gatewayHops: apHops,
    };
    if (!gr) {
      findings.push({
        id: `ap_uplink_${ap.id}`,
        severity: 'high',
        title: 'AP without gateway path',
        detail: `${ap.label || ap.id} cannot reach the core network.`,
        nodeIds: [ap.id],
        linkIds: [],
        whyLines: [],
        suggestions: ['Add Ethernet uplink from AP to switch'],
        autoFix: null,
      });
    }
  });

  // SC-18: AP on LAN graph but no Ethernet/fiber walk to a core-class gateway (Wi‑Fi uplink only).
  aps.forEach((ap) => {
    const apn = mergeNodeDefaults(ap);
    const bh = apn.backhaulType || 'ethernet';
    if (!lanReach.has(ap.id)) return;
    if (bh === 'wifi_mesh' || bh === 'powerline') return;
    if (hasEthernetPathToGateway(ap.id, nodes, links, lanReach, excludeNodeId, excludeLinkId)) return;
    const st = deviceStates[ap.id];
    if (!st || st.smartState === 'isolated') return;
    findings.push({
      id: `ap_no_eth_bh_${ap.id}`,
      severity: 'medium',
      title: 'AP without wired backhaul',
      detail: `${ap.label || ap.id} reaches the core without an Ethernet/fiber path — uplink may be wireless only.`,
      nodeIds: [ap.id],
      linkIds: [],
      whyLines: ['No Ethernet/fiber path to a WAN/core-class node before WiFi edges.'],
      suggestions: ['Run Ethernet to the AP from a PoE switch or router', 'Or set backhaulType to wifi_mesh if mesh is intentional'],
      autoFix: null,
    });
    deviceStates[ap.id] = {
      ...st,
      smartState: 'weak_signal',
      badgeLabel: 'No BH',
      badgeTone: 'slow',
      reasons: [
        ...(st.reasons || []).filter((r) => !String(r).includes('uplink path to core')),
        'No wired Ethernet/fiber backhaul toward core — performance may suffer.',
      ],
      suggestions: [...(st.suggestions || []), 'Use a wired uplink to the switch or router'],
    };
  });

  // SC-14: client count over AP capacity — badge + finding on the AP.
  aps.forEach((ap) => {
    const load = (apClients[ap.id] || []).length;
    const cap = mergeNodeDefaults(ap).capacityClients ?? 30;
    if (load <= cap) return;
    const st = deviceStates[ap.id];
    if (!st || st.smartState === 'isolated') return;
    findings.push({
      id: `ap_over_${ap.id}`,
      severity: 'medium',
      title: 'Access point overloaded',
      detail: `${ap.label || ap.id} carries ${load} wireless clients vs stated capacity ${cap}.`,
      nodeIds: [ap.id, ...(apClients[ap.id] || []).slice(0, 8)],
      linkIds: [],
      whyLines: [`wirelessClients=${load}`, `capacityClients=${cap}`],
      suggestions: ['Add another AP or split traffic', 'Raise capacityClients if the hardware supports it'],
      autoFix: null,
    });
    deviceStates[ap.id] = {
      ...st,
      smartState: 'slow_network',
      badgeLabel: 'Overloaded',
      badgeTone: 'slow',
      reasons: [...(st.reasons || []), `Serves ${load} wireless clients (capacity ${cap}).`],
      suggestions: [...(st.suggestions || []), 'Offload clients to another AP'],
    };
  });

  aps.forEach((ap) => {
    const apn = mergeNodeDefaults(ap);
    const bh = apn.backhaulType || 'ethernet';
    if (bh !== 'wifi_mesh' && bh !== 'powerline') return;
    const load = (apClients[ap.id] || []).length;
    if (load < 10) return;
    findings.push({
      id: `bh_${ap.id}`,
      severity: 'low',
      title: 'Heavy client load on mesh/PLC backhaul',
      detail: `${ap.label || ap.id} uses ${bh} uplink with ${load} wireless clients — throughput may suffer.`,
      nodeIds: [ap.id],
      linkIds: [],
      whyLines: [`backhaulType=${bh}`, `wirelessClients=${load}`],
      suggestions: ['Use Ethernet for AP uplink where possible', 'Add APs to split client load'],
      autoFix: null,
    });
  });

  // SC-20: mesh/PLC backhaul slower than aggregate wireless client demand.
  aps.forEach((ap) => {
    const apn = mergeNodeDefaults(ap);
    const bh = apn.backhaulType || 'ethernet';
    if (bh !== 'wifi_mesh' && bh !== 'powerline') return;
    const clients = apClients[ap.id] || [];
    const demand = clients.reduce(
      (s, cid) => s + (Number(mergeNodeDefaults(nodeById[cid]).requiredBandwidthMbps) || 5),
      0,
    );
    let uplinkMbps = 0;
    links.forEach((l) => {
      if (l.id === excludeLinkId) return;
      if (l.source !== ap.id && l.target !== ap.id) return;
      const lk = mergeLinkDefaults(l);
      uplinkMbps = Math.max(uplinkMbps, Number(lk.bandwidthMbps) || 0);
    });
    if (demand > 60 && uplinkMbps > 0 && demand > uplinkMbps * 1.05) {
      findings.push({
        id: `mesh_bw_${ap.id}`,
        severity: 'medium',
        title: 'Mesh / PLC backhaul bottleneck',
        detail: `${ap.label || ap.id} uses ${bh} uplink (~${Math.round(uplinkMbps)} Mbps) but wireless clients declare ~${Math.round(demand)} Mbps — airtime will congest.`,
        nodeIds: [ap.id, ...clients.slice(0, 8)],
        linkIds: [],
        whyLines: [`declaredDemandMbps≈${Math.round(demand)}`, `uplinkMbps≈${Math.round(uplinkMbps)}`],
        suggestions: ['Use Ethernet for AP uplink', 'Split clients across additional APs', 'Lower per-device requiredBandwidthMbps if overstated'],
        autoFix: null,
      });
    }
  });

  // SC-35: wired AP uplink much slower than typical Wi-Fi PHY (heuristic).
  aps.forEach((ap) => {
    const apn = mergeNodeDefaults(ap);
    if (apn.backhaulType === 'wifi_mesh' || apn.backhaulType === 'powerline') return;
    let ethBw = 0;
    links.forEach((l) => {
      if (l.id === excludeLinkId) return;
      if (l.source !== ap.id && l.target !== ap.id) return;
      const lk = mergeLinkDefaults(l);
      if (lk.type !== 'ethernet' && lk.type !== 'fiber') return;
      ethBw = Math.max(ethBw, Number(lk.bandwidthMbps) || 0);
    });
    const load = (apClients[ap.id] || []).length;
    if (!ethBw || ethBw >= 900) return;
    if (load < 2 && ethBw >= 500) return;
    if (ethBw < 300) {
      findings.push({
        id: `ap_bh_slow_${ap.id}`,
        severity: 'medium',
        title: 'AP wired uplink may limit WiFi throughput',
        detail: `${ap.label || ap.id} uplink is only ~${Math.round(ethBw)} Mbps Ethernet — many WiFi designs expect ≥1 Gbps to the AP.`,
        nodeIds: [ap.id],
        linkIds: [],
        whyLines: [],
        suggestions: ['Upgrade AP uplink to Gigabit or fiber', 'Shorten cable plant loss or remove speed mismatches'],
        autoFix: null,
      });
    }
  });

  // SC-51: every AP uplinks through the same switch (wireless SPOF).
  {
    const apNodes = nodes.filter((n) => n.type === 'ap');
    if (apNodes.length >= 2) {
      const switchUplinkForAp = (apId) => {
        for (const l of links) {
          if (l.id === excludeLinkId) continue;
          const lk = mergeLinkDefaults(l);
          if (lk.type !== 'ethernet' && lk.type !== 'fiber') continue;
          const other = l.source === apId ? l.target : l.target === apId ? l.source : null;
          if (!other) continue;
          if (nodeById[other]?.type === 'switch') return other;
        }
        return null;
      };
      const bySw = new Map();
      apNodes.forEach((ap) => {
        const sw = switchUplinkForAp(ap.id);
        if (!sw) return;
        if (!bySw.has(sw)) bySw.set(sw, []);
        bySw.get(sw).push(ap.id);
      });
      bySw.forEach((apIds, swId) => {
        if (apIds.length !== apNodes.length) return;
        const sw = nodeById[swId];
        findings.push({
          id: `ap_sw_spof_${swId}`,
          severity: 'medium',
          title: 'Wireless access concentrated on one switch',
          detail: `All ${apIds.length} APs uplink through ${sw?.label || swId} — that switch becomes a single point of failure for WiFi.`,
          nodeIds: [swId, ...apIds],
          linkIds: [],
          whyLines: [],
          suggestions: ['Distribute APs across multiple switches', 'Add redundant paths from AP VLANs toward the core'],
          autoFix: null,
        });
      });
    }
  }

  // Phase C: AP supported VLANs + wired trunk carry toward core
  const apVlanViolations = new Map();
  const trunkVlanViolations = new Map();

  nodes.forEach((n) => {
    const vlan = n.vlan;
    if (!vlan || !normVlanTag(vlan)) return;
    if (!lanReach.has(n.id)) return;
    const st = deviceStates[n.id];
    if (!st) return;

    const wifiAirborne =
      isWirelessClient(n) &&
      !hasEthernetPathToGateway(n.id, nodes, links, lanReach, excludeNodeId, excludeLinkId);

    if (wifiAirborne && st.apId) {
      const apNode = mergeNodeDefaults(nodeById[st.apId]);
      const sup = apNode?.supportedVlans;
      if (sup && String(sup).trim() && !vlanMentionedInCsv(sup, vlan)) {
        const key = `${st.apId}::${normVlanTag(vlan)}`;
        if (!apVlanViolations.has(key)) apVlanViolations.set(key, { apId: st.apId, vlan, clients: [] });
        const ev = apVlanViolations.get(key);
        if (!ev.clients.includes(n.id)) ev.clients.push(n.id);
        st.reasons = [...(st.reasons || []), `${apNode.label || st.apId} may not carry VLAN ${vlan} (check supported VLANs).`];
        st.suggestions = [...(st.suggestions || []), `Add ${vlan} to supported VLANs on the AP/router`];
      }
    }

    const uplinkStart =
      wifiAirborne && st.apId ? st.apId : n.id;
    const path = wiredShortestPathToCore(nodes, links, lanReach, uplinkStart, excludeNodeId, excludeLinkId);
    if (!path || path.length < 2) return;

    const pathLinks = linksAlongNodePath(links, path, excludeLinkId);
    pathLinks.forEach((link) => {
      const lk = mergeLinkDefaults(link);
      if (lk.type !== 'ethernet' && lk.type !== 'fiber') return;
      const trunk = lk.trunkVlans;
      if (!trunk || !String(trunk).trim()) return;
      if (vlanMentionedInCsv(trunk, vlan)) return;
      const key = `${link.id}::${normVlanTag(vlan)}`;
      if (!trunkVlanViolations.has(key)) trunkVlanViolations.set(key, { link, vlan, nodeIds: [] });
      const bucket = trunkVlanViolations.get(key);
      if (!bucket.nodeIds.includes(n.id)) bucket.nodeIds.push(n.id);
    });
  });

  apVlanViolations.forEach((rec, key) => {
    const apNode = nodeById[rec.apId];
    findings.push({
      id: `ap_vlan_${key.replace(/[^a-z0-9]+/gi, '_')}`,
      severity: 'medium',
      title: 'AP VLAN support mismatch',
      detail: `${apNode?.label || rec.apId} does not list ${rec.vlan} in supported VLANs while wireless clients use it (${rec.clients.length} device(s)).`,
      nodeIds: [...new Set([...rec.clients, rec.apId])],
      linkIds: [],
      whyLines: [`supportedVlans=${apNode?.supportedVlans || ''}`],
      suggestions: [`Add ${rec.vlan} to supported VLANs on ${apNode?.label || 'the AP/router'}`],
      autoFix: { type: 'append_ap_supported_vlan', apId: rec.apId, vlan: String(rec.vlan).trim() },
    });
  });

  trunkVlanViolations.forEach((rec) => {
    const { link, vlan, nodeIds } = rec;
    const srcL = nodeById[link.source]?.label || link.source;
    const tgtL = nodeById[link.target]?.label || link.target;
    const trunkStr = mergeLinkDefaults(link).trunkVlans;
    findings.push({
      id: `trunk_${link.id}_${normVlanTag(vlan)}`,
      severity: 'medium',
      title: 'VLAN missing on trunk',
      detail: `Link ${srcL} → ${tgtL} restricts allowed VLANs but ${vlan} is not included.`,
      nodeIds: [...new Set(nodeIds)],
      linkIds: [link.id],
      whyLines: [`trunkVlans=${trunkStr}`],
      suggestions: [`Add ${vlan} to trunk VLANs on ${srcL}↔${tgtL}`],
      autoFix: { type: 'append_link_trunk_vlan', linkId: link.id, vlan: String(vlan).trim() },
    });
  });

  // PoE check (SC-44 / SC-47)
  nodes.forEach(n => {
    const nm = mergeNodeDefaults(n);
    const needPoe = POE_NEED_TYPES.has(n.type) || (n.type === 'ap' && nm.poeRequired === true);
    if (!needPoe) return;
    const uplinks = links.filter(l => l.source === n.id || l.target === n.id);
    const wired = uplinks.find(l => {
      const other = l.source === n.id ? l.target : l.source;
      const sw = nodeById[other];
      if (!sw || sw.type !== 'switch') return false;
      const lk = mergeLinkDefaults(l);
      return lk.poe && lk.poe !== 'none';
    });
    if (!wired) {
      deviceStates[n.id] = {
        ...(deviceStates[n.id] || {}),
        smartState: 'power_missing',
        quality: deviceStates[n.id]?.quality ?? 40,
        reasons: ['Device expects PoE but no PoE-capable uplink was found on a switch connection.'],
        suggestions: ['Enable PoE on the switch port', 'Use a PoE injector'],
        badgeLabel: 'PoE!',
        badgeTone: 'power',
        apId: deviceStates[n.id]?.apId,
      };
      findings.push({
        id: `poe_${n.id}`,
        severity: 'medium',
        title: 'PoE may be missing',
        detail: `${n.label || n.id} is not clearly connected to a PoE switch port.`,
        nodeIds: [n.id],
        linkIds: [],
        whyLines: [
          n.type === 'ap'
            ? 'AP has poeRequired=true but no PoE-capable switch port was found on the graph.'
            : 'Camera/phone devices are assumed to need PoE unless a power uplink is set.',
        ],
        suggestions: ['Set link PoE to PoE/PoE+ on the switch uplink'],
        autoFix: { type: 'set_link_poe', nodeId: n.id },
      });
    }
  });

  // SC-45: switch PoE budget vs modeled draw on PoE-enabled ports.
  nodes.forEach((sw) => {
    if (sw.type !== 'switch') return;
    if (!lanReach.has(sw.id)) return;
    const swm = mergeNodeDefaults(sw);
    const budget = Number(swm.poeBudgetWatts);
    if (!Number.isFinite(budget) || budget <= 0) return;
    let draw = 0;
    const powered = [];
    links.forEach((l) => {
      if (l.id === excludeLinkId) return;
      if (l.source !== sw.id && l.target !== sw.id) return;
      const lk = mergeLinkDefaults(l);
      if (!lk.poe || lk.poe === 'none') return;
      const otherId = l.source === sw.id ? l.target : l.source;
      const on = nodeById[otherId];
      if (!on) return;
      const w = estimatePoeDrawW(on);
      if (w <= 0) return;
      draw += w;
      powered.push(otherId);
    });
    if (draw <= budget * 1.02) return;
    findings.push({
      id: `poe_budget_${sw.id}`,
      severity: 'medium',
      title: 'PoE budget may be exceeded',
      detail: `${sw.label || sw.id} budgets ~${Math.round(budget)} W but modeled powered devices sum ~${Math.round(draw)} W — some ports may shut down under load.`,
      nodeIds: [sw.id, ...powered.slice(0, 16)],
      linkIds: [],
      whyLines: [`budgetW≈${Math.round(budget)}`, `drawW≈${Math.round(draw)}`],
      suggestions: ['Raise poeBudgetWatts on the switch', 'Remove PoE loads or add injectors / secondary PoE switch'],
      autoFix: null,
    });
  });

  // SC-37: modeled switch port count vs physical connections
  nodes.forEach((sw) => {
    if (sw.type !== 'switch') return;
    const swm = mergeNodeDefaults(sw);
    const ports = swm.portCount ?? 24;
    const deg = links.filter((l) => l.source === sw.id || l.target === sw.id).length;
    if (deg <= ports) return;
    findings.push({
      id: `ports_${sw.id}`,
      severity: 'medium',
      title: 'Switch port count exceeded',
      detail: `${sw.label || sw.id} has ${deg} connections but only ${ports} modeled ports — not all links can be physically installed.`,
      nodeIds: [sw.id],
      linkIds: [],
      whyLines: [`portCount=${ports}`, `connections=${deg}`],
      suggestions: ['Add a second switch or increase portCount in properties', 'Use a higher-density switch model'],
      autoFix: null,
    });
    const st = deviceStates[sw.id];
    if (st && st.smartState !== 'isolated') {
      deviceStates[sw.id] = {
        ...st,
        smartState: 'at_risk',
        badgeLabel: 'Ports',
        badgeTone: 'risk',
        reasons: [...(st.reasons || []), `Port budget exceeded (${deg}/${ports}).`],
        suggestions: [...(st.suggestions || []), 'Split access across additional switches'],
      };
    }
  });

  // Cable length / blocking barriers / physical (SC-39–43)
  links.forEach(link => {
    if (link.id === excludeLinkId) return;
    const len = cableLengthFromPixels(link, nodes);
    const src = nodeById[link.source];
    const tgt = nodeById[link.target];
    if (!src || !tgt) return;
    const p1 = nodeCenter(src);
    const p2 = nodeCenter(tgt);
    const merged = mergeLinkDefaults(link);

    if (merged.type === 'fiber' && len > 40000) {
      findings.push({
        id: `fiber_long_${link.id}`,
        severity: 'medium',
        title: 'Long single-mode fiber span',
        detail: `Fiber ${src.label} → ${tgt.label} is modeled at ~${Math.round(len / 1000)} km — beyond typical unamplified SM reach (~40 km); validate optical budget.`,
        nodeIds: [src.id, tgt.id],
        linkIds: [link.id],
        whyLines: [`cableLengthM≈${Math.round(len)}`],
        suggestions: ['Add in-line amplification or regen', 'Confirm measured loss and transceiver class'],
        autoFix: null,
      });
    }

    if (
      merged.type === 'fiber' &&
      (FIBER_MEDIA_MISMATCH_TYPES.has(src.type) || FIBER_MEDIA_MISMATCH_TYPES.has(tgt.type))
    ) {
      findings.push({
        id: `fiber_media_${link.id}`,
        severity: 'medium',
        title: 'Fiber media mismatch',
        detail: `Fiber link ${src.label} → ${tgt.label} terminates on a device type that typically expects copper (RJ-45) unless a media converter is modeled.`,
        nodeIds: [src.id, tgt.id],
        linkIds: [link.id],
        whyLines: [`sourceType=${src.type}`, `targetType=${tgt.type}`],
        suggestions: ['Use Ethernet to the endpoint', 'Insert an SFP / media converter in the path'],
        autoFix: null,
      });
    }

    if (merged.type === 'ethernet' && len > 100) {
      findings.push({
        id: `cable_${link.id}`,
        severity: 'medium',
        title: 'Ethernet length warning',
        detail: `Link ${src.label} → ${tgt.label} estimates ${Math.round(len)}m (>100m copper limit).`,
        nodeIds: [src.id, tgt.id],
        linkIds: [link.id],
        whyLines: [`Pixel distance × 0.1524 ≈ ${Math.round(len)}m`],
        suggestions: ['Use fiber for long runs', 'Add a repeater/switch mid-span'],
        autoFix: null,
      });
    }

    if (merged.type !== 'wifi' && (merged.type === 'ethernet' || merged.type === 'fiber')) {
      const rS = roomAtPoint(rooms, p1.x, p1.y);
      const rT = roomAtPoint(rooms, p2.x, p2.y);
      const oS = rS && mergeRoomDefaults(rS).zoneType === 'outdoor';
      const oT = rT && mergeRoomDefaults(rT).zoneType === 'outdoor';
      if (oS !== oT) {
        findings.push({
          id: `outdoor_run_${link.id}`,
          severity: 'low',
          title: 'Indoor / outdoor cable run',
          detail: `${merged.type === 'fiber' ? 'Fiber' : 'Ethernet'} ${src.label} → ${tgt.label} crosses an indoor/outdoor zone boundary — use outdoor-rated cable and conduit.`,
          nodeIds: [src.id, tgt.id],
          linkIds: [link.id],
          whyLines: [],
          suggestions: ['Specify outdoor-rated shielded copper or armored fiber', 'Add surge/lightning protection at building exit'],
          autoFix: null,
        });
      }
    }

    const blockBr = firstCableBlockingBarrier(rawBarriers, p1.x, p1.y, p2.x, p2.y);
    if (blockBr && merged.type !== 'wifi') {
      const b0 = mergeBarrierDefaults(blockBr);
      const bl = String(b0.label || '').trim() || b0.barrierType || 'cable-blocking barrier';
      findings.push({
        id: `route_${link.id}`,
        severity: 'medium',
        title: 'Cable blocked by obstacle',
        detail: `${merged.type === 'ethernet' ? 'Ethernet' : merged.type === 'fiber' ? 'Fiber' : 'Cable'} ${src.label} → ${tgt.label} crosses "${bl}" which blocks cable routing.`,
        nodeIds: [src.id, tgt.id],
        linkIds: [link.id],
        whyLines: [`barrier=${bl}`],
        suggestions: ['Reroute around the obstacle', 'Use an approved penetration or conduit'],
        autoFix: null,
      });
    }
  });

  // Zone / VLAN
  rooms.forEach(room => {
    const inside = nodes.filter(n => {
      const c = nodeCenter(n);
      return c.x >= room.x && c.x <= room.x + room.w && c.y >= room.y && c.y <= room.y + room.h;
    });
    const wifiInRoom = inside.filter(isWirelessClient);
    const rmzEarly = mergeRoomDefaults(room);
    if (
      rmzEarly.environment === 'dense' &&
      rmzEarly.noiseLevel === 'high' &&
      inside.some((n) => n.type === 'ap')
    ) {
      findings.push({
        id: `dense_rf_${room.id}`,
        severity: 'low',
        title: 'High RF congestion zone',
        detail: `${room.label} is marked dense with high ambient noise and contains an AP — expect lower WiFi SNR for all wireless clients in this zone.`,
        nodeIds: inside.filter((n) => isWirelessClient(n) || n.type === 'ap').map((n) => n.id).slice(0, 24),
        linkIds: [],
        whyLines: ['environment=dense', 'noiseLevel=high'],
        suggestions: ['Use wired connections for critical devices', 'Prefer WiFi 6E / wider channels where spectrum allows'],
        autoFix: null,
      });
    }
    if (wifiInRoom.length > (room.maxUsers || 25)) {
      findings.push({
        id: `room_cap_${room.id}`,
        severity: 'medium',
        title: 'Zone overcrowded',
        detail: `${room.label} has ${wifiInRoom.length} wireless clients vs max ${room.maxUsers}.`,
        nodeIds: wifiInRoom.map(n => n.id),
        linkIds: [],
        whyLines: [],
        suggestions: ['Add AP capacity', 'Split VLANs / physical zones'],
        autoFix: null,
      });
    }
    if (room.requiredVlan) {
      inside.forEach(n => {
        if (n.vlan && n.vlan !== room.requiredVlan) {
          findings.push({
            id: `vlan_${room.id}_${n.id}`,
            severity: 'medium',
            title: 'VLAN / zone mismatch',
            detail: `${n.label} in ${room.label} uses ${n.vlan} but zone expects ${room.requiredVlan}.`,
            nodeIds: [n.id],
            linkIds: [],
            whyLines: [],
            suggestions: [`Set device VLAN to ${room.requiredVlan}`],
            autoFix: { type: 'set_node_vlan', nodeId: n.id, vlan: room.requiredVlan },
          });
        }
        // SC-09: preferred guest SSID while zone expects a staff/corporate VLAN
        if (isWirelessClient(n)) {
          const pref = String(n.preferredSsid || '').trim().toLowerCase();
          if (
            pref &&
            pref.includes('guest') &&
            !isGuestishVlanTag(room.requiredVlan, vlans)
          ) {
            findings.push({
              id: `ssid_zone_${room.id}_${n.id}`,
              severity: 'medium',
              title: 'WiFi SSID preference vs zone VLAN',
              detail: `${n.label || n.id} prefers "${n.preferredSsid}" but ${room.label} expects ${room.requiredVlan} — may lack access to staff resources.`,
              nodeIds: [n.id],
              linkIds: [],
              whyLines: [`preferredSsid=${n.preferredSsid}`, `requiredVlan=${room.requiredVlan}`],
              suggestions: [
                `Align SSID/VLAN with ${room.requiredVlan}`,
                'Move device to a guest zone if Guest access is intended',
              ],
              autoFix: null,
            });
          }
        }
      });
    }
    if (room.securityLevel === 'public' && inside.some(n => n.type === 'server' || n.type === 'nas')) {
      findings.push({
        id: `sec_${room.id}`,
        severity: 'high',
        title: 'Server in public zone',
        detail: `Critical assets overlap ${room.label} marked public.`,
        nodeIds: inside.filter(n => n.type === 'server' || n.type === 'nas').map(n => n.id),
        linkIds: [],
        whyLines: [],
        suggestions: ['Move servers to a restricted zone', 'Tighten zone security level'],
        autoFix: null,
      });
    }
    const hasAp = inside.some(n => n.type === 'ap') || inside.some(n => n.type === 'router' && mergeNodeDefaults(n).wifiEnabled);
    if (wifiInRoom.length > 2 && !hasAp) {
      const hasWiredClient = wifiInRoom.some(c => hasEthernetPathToGateway(c.id, nodes, links, lanReach, excludeNodeId, excludeLinkId));
      if (!hasWiredClient) {
        const qs = wifiInRoom
          .map((n) => deviceStates[n.id]?.quality)
          .filter((q) => q != null && Number.isFinite(q));
        const avgQ = qs.length ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : null;
        findings.push({
          id: `covgap_${room.id}`,
          severity: 'low',
          title: 'Coverage gap',
          detail: avgQ != null
            ? `${room.label} has ${wifiInRoom.length} wireless devices but no AP — average WiFi score ~${avgQ}.`
            : `${room.label} has WiFi clients but no AP/router inside the zone.`,
          nodeIds: wifiInRoom.map(n => n.id),
          linkIds: [],
          whyLines: avgQ != null ? [`avgWifiQuality=${avgQ}`] : [],
          suggestions: ['Place an AP in this zone'],
          autoFix: null,
        });
      }
    }

    const rmz = mergeRoomDefaults(room);

    if (rmz.allowedDeviceTypes) {
      inside.forEach((n) => {
        if (deviceAllowedInZone(n.type, rmz.allowedDeviceTypes)) return;
        findings.push({
          id: `zone_allow_${room.id}_${n.id}`,
          severity: 'medium',
          title: 'Device type not allowed in zone',
          detail: `${n.label || n.id} (${n.type}) is in ${room.label} but allowed types are: ${rmz.allowedDeviceTypes}.`,
          nodeIds: [n.id],
          linkIds: [],
          whyLines: [],
          suggestions: ['Move device out of zone', 'Edit allowed device types', 'Loosen zone rules'],
          autoFix: null,
        });
      });
    }

    if (rmz.zoneType === 'guest_area') {
      const badGuest = inside.filter(
        (n) =>
          ['laptop', 'tablet', 'phone', 'pc', 'printer', 'iot', 'camera'].includes(n.type) &&
          !isGuestishVlanTag(n.vlan, vlans),
      );
      if (badGuest.length) {
        const hint = firstGuestVlanName(vlans);
        findings.push({
          id: `guest_zone_${room.id}`,
          severity: 'low',
          title: 'Guest zone VLAN',
          detail: `${room.label}: ${badGuest.length} device(s) are not tagged with an obvious guest VLAN (name or label should reference "guest").`,
          nodeIds: badGuest.map((n) => n.id),
          linkIds: [],
          whyLines: [],
          suggestions: hint
            ? [`Assign VLAN ${hint} to guest clients`, 'Or rename a VLAN to include "guest" in the name or label']
            : ['Create a guest VLAN and assign it to these devices'],
          autoFix: null,
        });
      }
      const nasInGuest = inside.filter((n) => n.type === 'nas' || n.type === 'server');
      if (nasInGuest.length) {
        findings.push({
          id: `guest_nas_${room.id}`,
          severity: 'high',
          title: 'NAS or server in guest area',
          detail: `${nasInGuest.length} internal asset(s) in ${room.label} — storage and servers usually belong in a restricted or server zone.`,
          nodeIds: nasInGuest.map((n) => n.id),
          linkIds: [],
          whyLines: [],
          suggestions: ['Move NAS/servers to a server_room or staff zone', 'Tighten guest_area boundaries if this overlap is accidental'],
          autoFix: null,
        });
      }
    }

    const allowTokens = parseCommaTypes(rmz.allowedDeviceTypes);
    inside.forEach((n) => {
      if (n.type !== 'printer') return;
      const sens =
        rmz.zoneType === 'server_room' ||
        rmz.securityLevel === 'restricted' ||
        rmz.securityLevel === 'critical';
      if (!sens) return;
      if (allowTokens.length && !allowTokens.includes('printer')) return;
      if (allowTokens.includes('printer')) return;
      findings.push({
        id: `printer_zone_${room.id}_${n.id}`,
        severity: 'medium',
        title: 'Printer in sensitive zone',
        detail: `${n.label || n.id} is a shared printer in ${room.label} (${rmz.zoneType}, security ${rmz.securityLevel}).`,
        nodeIds: [n.id],
        linkIds: [],
        whyLines: [],
        suggestions: ['Move printer to a staff or office zone', 'Add printer to allowed device types if intentional'],
        autoFix: null,
      });
    });
  });

  nodes.forEach((cam) => {
    if (cam.type !== 'camera') return;
    if (!lanReach.has(cam.id)) return;
    if (canReachDeviceType(cam.id, 'nas', nodes, links, excludeNodeId, excludeLinkId)) return;
    findings.push({
      id: `cam_nas_${cam.id}`,
      severity: 'low',
      title: 'Camera recording path unclear',
      detail: `${cam.label || cam.id} has no graph path to any NAS (heuristic for recording / storage reachability).`,
      nodeIds: [cam.id],
      linkIds: [],
      whyLines: [],
      suggestions: ['Route camera traffic toward a NAS or NVR on the canvas', 'Add a NAS and connect it through the switch fabric'],
      autoFix: null,
    });
  });

  // SC-25 / SC-26 / SC-27 / SC-30 — VLAN & segmentation heuristics
  const guestClients = nodes.filter(
    (n) =>
      lanReach.has(n.id) &&
      n.vlan &&
      isGuestishVlanTag(n.vlan, vlans) &&
      ['laptop', 'tablet', 'phone', 'pc', 'printer'].includes(n.type),
  );
  const serverLike = nodes.filter(
    (n) =>
      lanReach.has(n.id) &&
      n.vlan &&
      (n.type === 'server' || n.type === 'nas') &&
      !isGuestishVlanTag(n.vlan, vlans),
  );
  if (!hasFw && guestClients.length && serverLike.length && nodes.length > 3) {
    findings.push({
      id: 'guest_server_segment',
      severity: 'high',
      title: 'Guest and server VLANs without firewall boundary',
      detail:
        'Guest-tagged clients and internal servers share the same routed fabric with no firewall modeled — inter-VLAN policy should be explicit.',
      nodeIds: [...new Set([...guestClients, ...serverLike].map((n) => n.id))].slice(0, 24),
      linkIds: [],
      whyLines: [],
      suggestions: ['Add a firewall between segments', 'Configure router ACLs for guest-to-server traffic'],
      autoFix: null,
    });
  }

  // SC-28: printer on guest VLAN — guests may gain unintended print access.
  guestClients.forEach((p) => {
    if (p.type !== 'printer') return;
    findings.push({
      id: `guest_printer_${p.id}`,
      severity: 'medium',
      title: 'Printer on guest VLAN',
      detail: `${p.label || p.id} is tagged with a guest-style VLAN — visitors may be able to print unless ACLs block it.`,
      nodeIds: [p.id],
      linkIds: [],
      whyLines: [`vlan=${p.vlan || ''}`],
      suggestions: ['Move the printer to a staff VLAN', 'Lock down print queues and driver deployment via ACLs'],
      autoFix: null,
    });
  });

  nodes.forEach((n) => {
    if (n.type !== 'iot' || !lanReach.has(n.id)) return;
    const v = n.vlan;
    if (!v || !normVlanTag(v)) return;
    if (isGuestishVlanTag(v, vlans) || isLikelyIotSegmentVlan(v)) return;
    findings.push({
      id: `iot_vlan_${n.id}`,
      severity: 'medium',
      title: 'IoT device on corporate-style VLAN',
      detail: `${n.label || n.id} is tagged ${v} — IoT endpoints are safer on a dedicated IoT segment.`,
      nodeIds: [n.id],
      linkIds: [],
      whyLines: [],
      suggestions: ['Create an IoT VLAN and move this device', 'Apply ACLs between IoT and user subnets'],
      autoFix: null,
    });
  });

  nodes.forEach((n) => {
    if (n.type !== 'camera' || !lanReach.has(n.id)) return;
    const v = n.vlan;
    if (!v || !normVlanTag(v)) return;
    if (isLikelyCameraSecurityVlan(v)) return;
    findings.push({
      id: `cam_vlan_${n.id}`,
      severity: 'medium',
      title: 'Camera not on a security-style VLAN',
      detail: `${n.label || n.id} uses ${v} — cameras are usually isolated on a dedicated security/surveillance VLAN.`,
      nodeIds: [n.id],
      linkIds: [],
      whyLines: [],
      suggestions: ['Assign a VLAN whose name references security or CCTV', 'Keep cameras off general user VLANs'],
      autoFix: null,
    });
  });

  const vlanTagged = nodes.filter(
    (n) => n.type !== 'patchpanel' && String(n.vlan || '').trim() && normVlanTag(n.vlan),
  );
  if (nodes.length >= 6 && !vlanTagged.length) {
    findings.push({
      id: 'flat_l2',
      severity: 'medium',
      title: 'No VLAN segmentation detected',
      detail: 'No device VLAN assignments are set — everything behaves like a single flat broadcast domain.',
      nodeIds: nodes.filter((n) => !['patchpanel', 'cloud'].includes(n.type)).slice(0, 16).map((n) => n.id),
      linkIds: [],
      whyLines: [],
      suggestions: ['Define VLANs for staff, guest, servers, IoT, and security', 'Tag trunks and AP uplinks accordingly'],
      autoFix: null,
    });
  }

  // Cloud without firewall (SC-07)
  if (hasCloud && !hasFw && nodes.length > 2) {
    findings.push({
      id: 'wan_fw',
      severity: 'high',
      title: 'Unprotected WAN edge',
      detail: 'Cloud/ISP exists without a firewall in the topology.',
      nodeIds: nodes.filter(n => n.type === 'cloud').map(n => n.id),
      linkIds: [],
      whyLines: [],
      suggestions: ['Add a firewall between ISP and internal network'],
      autoFix: null,
    });
  }

  // SC-01 / WAN reachability findings
  if (!hasCloud && nodes.length > 0 && lanReach.size > 0) {
    const routersOnLan = nodes.filter((r) => r.type === 'router' && lanReach.has(r.id));
    const nodeIds = routersOnLan.length
      ? routersOnLan.map((r) => r.id)
      : [...nodes].filter((n) => lanReach.has(n.id) && n.type !== 'patchpanel').slice(0, 8).map((n) => n.id);
    if (nodeIds.length) {
      findings.push({
        id: 'no_wan_modeled',
        severity: 'medium',
        title: 'No WAN / ISP modeled',
        detail: 'There is no Cloud/ISP node — outbound Internet reachability is not modeled even when the LAN is connected.',
        nodeIds,
        linkIds: [],
        whyLines: [],
        suggestions: ['Add a Cloud/ISP device and link it to the edge router or firewall'],
        autoFix: null,
      });
    }
  }
  const routersOffWan = nodes.filter((r) => r.type === 'router' && lanReach.has(r.id) && !wanReach.has(r.id));
  if (hasCloud && routersOffWan.length) {
    findings.push({
      id: 'branch_no_wan',
      severity: 'high',
      title: 'Router segment without WAN path',
      detail: 'One or more routers are not in the same graph component as Cloud/ISP.',
      nodeIds: routersOffWan.map((r) => r.id),
      linkIds: [],
      whyLines: [],
      suggestions: ['Connect the router uplink toward the Cloud/ISP or firewall WAN port'],
      autoFix: null,
    });
  }

  const firewallNodes = nodes.filter((n) => n.type === 'firewall');
  const cloudEdgeLinks = links.filter(
    (l) =>
      l.id !== excludeLinkId &&
      (nodeById[l.source]?.type === 'cloud' || nodeById[l.target]?.type === 'cloud'),
  );
  if (hasCloud && firewallNodes.length === 1 && nodes.length >= 8) {
    findings.push({
      id: 'fw_single_ha',
      severity: 'medium',
      title: 'Single firewall (no HA pair)',
      detail: `${firewallNodes[0].label || firewallNodes[0].id} is the only modeled firewall — add an active/standby pair for enterprise edge resilience.`,
      nodeIds: [firewallNodes[0].id],
      linkIds: [],
      whyLines: [],
      suggestions: ['Add a second firewall in HA', 'Document failover and state sync expectations'],
      autoFix: null,
    });
  }
  if (hasCloud && cloudEdgeLinks.length === 1 && nodes.length > 5) {
    findings.push({
      id: 'wan_single_link',
      severity: 'low',
      title: 'Single WAN link',
      detail: 'Only one Cloud/ISP attachment is modeled — Internet outage has no automatic failover path.',
      nodeIds: nodes.filter((n) => n.type === 'cloud').map((n) => n.id),
      linkIds: [cloudEdgeLinks[0].id],
      whyLines: [],
      suggestions: ['Add a secondary WAN from a different ISP', 'Use SD-WAN or policy-based failover'],
      autoFix: null,
    });
  }
  {
    const taggedRedundant = links.filter(
      (l) => l.id !== excludeLinkId && String(mergeLinkDefaults(l).redundantGroup || '').trim(),
    ).length;
    const swCount = nodes.filter((n) => n.type === 'switch').length;
    if (
      hasCloud &&
      nodes.length >= 12 &&
      swCount >= 2 &&
      taggedRedundant === 0 &&
      firewallNodes.length <= 1 &&
      cloudEdgeLinks.length <= 1
    ) {
      findings.push({
        id: 'res_no_redundancy',
        severity: 'medium',
        title: 'No redundancy modeled on core path',
        detail:
          'WAN, firewall, and switch fabric appear linear with no LAG/redundancy groups — a single link or node loss may isolate large segments.',
        nodeIds: nodes
          .filter((n) => ['cloud', 'firewall', 'router', 'switch'].includes(n.type))
          .map((n) => n.id)
          .slice(0, 20),
        linkIds: [],
        whyLines: ['No links use redundantGroup for paired uplinks.'],
        suggestions: ['Add redundant uplinks and mark them with the same redundancyGroup', 'Dual-home critical switches toward the core'],
        autoFix: null,
      });
    }
  }

  let wanCapacityMbps = 0;
  links.forEach((l) => {
    if (l.id === excludeLinkId) return;
    if (nodeById[l.source]?.type === 'cloud' || nodeById[l.target]?.type === 'cloud') {
      wanCapacityMbps += Number(mergeLinkDefaults(l).bandwidthMbps) || 0;
    }
  });
  const criticalDemandMbps = nodes
    .filter((n) => lanReach.has(n.id) && (mergeNodeDefaults(n).criticality === 'critical' || n.type === 'camera'))
    .reduce((s, n) => s + (Number(mergeNodeDefaults(n).requiredBandwidthMbps) || 0), 0);
  if (hasCloud && wanCapacityMbps > 0 && criticalDemandMbps > wanCapacityMbps * 1.08) {
    findings.push({
      id: 'wan_bw_crit',
      severity: 'medium',
      title: 'WAN bandwidth vs critical demand',
      detail: `Cloud/WAN links total ~${Math.round(wanCapacityMbps)} Mbps but critical devices declare ~${Math.round(criticalDemandMbps)} Mbps — internet access may be congested.`,
      nodeIds: nodes.filter((n) => mergeNodeDefaults(n).criticality === 'critical' || n.type === 'camera').map((n) => n.id).slice(0, 16),
      linkIds: links.filter((l) => nodeById[l.source]?.type === 'cloud' || nodeById[l.target]?.type === 'cloud').map((l) => l.id),
      whyLines: [`wanCapacityMbps≈${Math.round(wanCapacityMbps)}`, `criticalDemandMbps≈${Math.round(criticalDemandMbps)}`],
      suggestions: ['Upgrade ISP/WAN speed', 'Apply QoS and traffic shaping', 'Reduce declared requiredBandwidthMbps where overstated'],
      autoFix: null,
    });
  }

  // SPOF — reuse idea: high-degree articulation simplified as nodes with degree 1 that are switches? Skip heavy articulation; flag single uplink for critical servers
  nodes.forEach(n => {
    if (n.criticality !== 'critical' && n.type !== 'server') return;
    const deg = links.filter(l => l.source === n.id || l.target === n.id).length;
    if (n.type === 'server' && deg < 2) {
      const isCrit = mergeNodeDefaults(n).criticality === 'critical';
      findings.push({
        id: `spof_${n.id}`,
        severity: 'medium',
        title: isCrit ? 'Critical server with single uplink' : 'Single point of failure risk',
        detail: isCrit
          ? `${n.label || n.id} is marked critical but has only one network uplink — link failure causes immediate outage.`
          : `${n.label || n.id} has only one connection — no redundancy.`,
        nodeIds: [n.id],
        linkIds: [],
        whyLines: [],
        suggestions: ['Add redundant NIC / path', 'Mark as non-critical if acceptable'],
        autoFix: null,
      });
      deviceStates[n.id] = {
        ...(deviceStates[n.id] || { quality: 70 }),
        smartState: 'at_risk',
        badgeLabel: 'At Risk',
        badgeTone: 'risk',
        reasons: [...(deviceStates[n.id]?.reasons || []), 'Single uplink — no failover.'],
        suggestions: [...(deviceStates[n.id]?.suggestions || []), 'Add redundant links'],
      };
    }
  });

  // SC-46: critical server/NAS without modeled UPS/PDU coverage
  nodes.forEach((n) => {
    if (!['server', 'nas'].includes(n.type)) return;
    if (mergeNodeDefaults(n).criticality !== 'critical') return;
    if (!lanReach.has(n.id)) return;
    const c = nodeCenter(n);
    const inPowerZone = nodeCenterInPowerZone(c.x, c.y, powerZones);
    const pduNeighbor = links.some((l) => {
      const o = l.source === n.id ? l.target : l.target === n.id ? l.source : null;
      return o && nodeById[o]?.type === 'pdu';
    });
    if (inPowerZone || pduNeighbor) return;
    findings.push({
      id: `crit_ups_${n.id}`,
      severity: 'medium',
      title: 'Critical device without UPS/PDU coverage',
      detail: `${n.label || n.id} is marked critical but has no PDU neighbor and is not inside a power zone — outages will drop it immediately.`,
      nodeIds: [n.id],
      linkIds: [],
      whyLines: [],
      suggestions: ['Connect to a UPS/PDU device on the canvas', 'Draw a UPS power zone covering this rack'],
      autoFix: null,
    });
    const st = deviceStates[n.id];
    if (st && st.smartState !== 'power_missing') {
      deviceStates[n.id] = {
        ...st,
        reasons: [...(st.reasons || []), 'No UPS/PDU backup modeled for this critical asset.'],
        suggestions: [...(st.suggestions || []), 'Add PDU/UPS coverage in the design'],
      };
    }
  });

  // SC-33: access switch uplink vs downstream bandwidth demand (heuristic)
  links.forEach((l) => {
    if (l.id === excludeLinkId) return;
    const a = nodeById[l.source];
    const b = nodeById[l.target];
    if (!a || !b) return;
    const lk = mergeLinkDefaults(l);
    if (lk.type !== 'ethernet' && lk.type !== 'fiber') return;
    let sw = null;
    let gw = null;
    if (a.type === 'switch' && ['router', 'firewall', 'loadbalancer'].includes(b.type)) {
      sw = a;
      gw = b;
    } else if (b.type === 'switch' && ['router', 'firewall', 'loadbalancer'].includes(a.type)) {
      sw = b;
      gw = a;
    } else {
      return;
    }
    const demand = sumDemandBeyondUplink(sw.id, gw.id, nodes, links, excludeNodeId, excludeLinkId);
    const cap = Number(lk.bandwidthMbps) || 1000;
    if (demand > cap * 1.05) {
      findings.push({
        id: `uplink_cap_${l.id}`,
        severity: 'medium',
        title: 'Access uplink may be undersized',
        detail: `${sw.label || sw.id} → ${gw.label || gw.id} carries ~${Math.round(demand)} Mbps of declared downstream demand on a ${Math.round(cap)} Mbps link.`,
        nodeIds: [sw.id, gw.id],
        linkIds: [l.id],
        whyLines: [`demandMbps≈${Math.round(demand)}`, `linkMbps=${Math.round(cap)}`],
        suggestions: ['Upgrade uplink to 10 Gbps', 'Add LAG / second uplink', 'Split high-demand devices across switches'],
        autoFix: null,
      });
    }
    // SC-38: cameras on same access uplink as general traffic (informational).
    const camMbps = sumCameraMbpsBehind(sw.id, gw.id, nodes, links, excludeNodeId, excludeLinkId);
    const combined = demand + camMbps;
    if (camMbps >= 16 && cap <= 1000 && camMbps / Math.max(cap, 1) >= 0.12 && combined > cap * 0.62) {
      findings.push({
        id: `cam_share_${l.id}`,
        severity: 'low',
        title: 'Camera streams on shared uplink',
        detail: `Cameras behind ${sw.label || sw.id} declare ~${Math.round(camMbps)} Mbps while the ${Math.round(cap)} Mbps uplink toward ${gw.label || gw.id} also carries ~${Math.round(demand)} Mbps of other demand — monitor headroom for bursts/encoding spikes.`,
        nodeIds: [sw.id, gw.id],
        linkIds: [l.id],
        whyLines: [`cameraDemandMbps≈${Math.round(camMbps)}`, `otherDemandMbps≈${Math.round(demand)}`],
        suggestions: ['Dedicated surveillance switch or VLAN', 'Raise uplink speed if recorders are centralized'],
        autoFix: null,
      });
    }
  });

  // SC-36: high/critical servers or NAS on links slower than declared load.
  nodes.forEach((n) => {
    if ((n.type !== 'server' && n.type !== 'nas') || !lanReach.has(n.id)) return;
    const m = mergeNodeDefaults(n);
    if (m.criticality !== 'critical' && m.criticality !== 'high') return;
    const req = Number(m.requiredBandwidthMbps) || 0;
    if (req < 50) return;
    links.forEach((l) => {
      if (l.id === excludeLinkId) return;
      if (l.source !== n.id && l.target !== n.id) return;
      const lk = mergeLinkDefaults(l);
      if (lk.type !== 'ethernet' && lk.type !== 'fiber') return;
      const bw = Number(lk.bandwidthMbps) || 1000;
      if (bw + 8 >= req * 0.9) return;
      findings.push({
        id: `server_link_${n.id}_${l.id}`,
        severity: 'medium',
        title: 'Server/NAS uplink vs expected load',
        detail: `${n.label || n.id} (${m.criticality}) expects ~${Math.round(req)} Mbps but link "${lk.type}" is only ~${Math.round(bw)} Mbps — throughput may bottleneck storage and apps.`,
        nodeIds: [n.id, l.source === n.id ? l.target : l.source],
        linkIds: [l.id],
        whyLines: [`requiredBandwidthMbps≈${Math.round(req)}`, `linkMbps≈${Math.round(bw)}`],
        suggestions: ['Upgrade to 1 Gbps / 10 Gbps on the server path', 'Spread storage traffic across additional NICs'],
        autoFix: null,
      });
    });
  });

  // Utilization / bottlenecks (simple)
  const bottleneckLinks = [];
  links.forEach(link => {
    const lk = mergeLinkDefaults(link);
    let u = lk.utilizationPercent;
    if (!u) {
      const clients = nodes.filter(isWirelessClient).length;
      u = Math.min(95, 15 + clients * 2);
    }
    if (u > 70) {
      bottleneckLinks.push({ linkId: link.id, utilization: u, label: `${nodeById[link.source]?.label}→${nodeById[link.target]?.label}` });
      if (u > 90) {
        findings.push({
          id: `bottleneck_${link.id}`,
          severity: 'medium',
          title: 'Link utilization high',
          detail: `Utilization ~${Math.round(u)}% on ${nodeById[link.source]?.label} → ${nodeById[link.target]?.label}.`,
          nodeIds: [link.source, link.target],
          linkIds: [link.id],
          whyLines: [`utilizationPercent=${Math.round(u)}`],
          suggestions: ['Add capacity', 'Split traffic'],
          autoFix: null,
        });
      }
    }
  });
  bottleneckLinks.sort((a, b) => b.utilization - a.utilization);

  // Scores 0–100
  const wifiClients = nodes.filter(isWirelessClient);
  const avgQ = wifiClients.length
    ? wifiClients.reduce((s, n) => s + (deviceStates[n.id]?.quality ?? 50), 0) / wifiClients.length
    : 85;
  const coverage = Math.round(avgQ);
  const capacity = Math.max(0, 100 - bottleneckLinks.filter(b => b.utilization > 80).length * 12 - coChanPairs.length * 8);
  const security = Math.max(0, 100 - findings.filter(f => f.title.includes('firewall') || f.title.includes('public') || f.title.includes('VLAN')).length * 15);
  const resilience = Math.max(
    0,
    100 -
      findings.filter(
        (f) =>
          f.title.includes('Single point') ||
          f.title.includes('Isolated') ||
          f.title.includes('single point of failure') ||
          f.title.includes('without WAN path'),
      ).length *
        12,
  );
  const pduCount = nodes.filter(n => n.type === 'pdu').length;
  const power = Math.min(100, 55 + pduCount * 15);

  const overallScores = {
    coverage: Math.min(100, coverage),
    capacity: Math.min(100, capacity),
    security: Math.min(100, security),
    resilience: Math.min(100, resilience),
    power: Math.min(100, power),
  };
  const overall = Math.round(
    overallScores.coverage * 0.28 +
    overallScores.capacity * 0.22 +
    overallScores.security * 0.2 +
    overallScores.resilience * 0.18 +
    overallScores.power * 0.12
  );

  const apSuggestions = computeApGhostSuggestions(nodes, rooms, barriers, deviceStates, aps);

  // SC-01: LAN without modeled WAN — mark devices that are on-net but not in wanReach.
  const wanHint =
    'No path to ISP/Cloud — outbound Internet is not modeled as reachable from this device.';
  nodes.forEach((n) => {
    const st = deviceStates[n.id];
    if (!st) return;
    if (n.type === 'cloud' || n.type === 'patchpanel') return;
    if (!lanReach.has(n.id)) return;
    if (wanReach.has(n.id)) return;
    if (st.smartState === 'isolated' || st.smartState === 'no_network') return;
    if (st.smartState === 'power_missing') return;
    if ((st.reasons || []).some((x) => String(x).includes('outbound Internet'))) return;
    const sug = hasCloud
      ? 'Route this branch toward the Cloud/ISP through the edge router or firewall.'
      : 'Add a Cloud/ISP node and connect it through the edge router or firewall.';
    deviceStates[n.id] = {
      ...st,
      smartState: 'no_internet',
      badgeLabel: 'No Internet',
      badgeTone: 'slow',
      quality: Math.min(st.quality ?? 70, 55),
      reasons: [...(st.reasons || []), wanHint],
      suggestions: [...(st.suggestions || []), sug],
    };
  });

  // PDU fault: flag neighbors / cable reach as power-stressed (demo cascade)
  if (excludeNodeId) {
    const failedPdu = nodes.find((n) => n.id === excludeNodeId && n.type === 'pdu');
    if (failedPdu) {
      const affected = new Set();
      links.forEach((l) => {
        if (l.source === excludeNodeId) affected.add(l.target);
        if (l.target === excludeNodeId) affected.add(l.source);
      });
      const fc = nodeCenter(failedPdu);
      nodes.forEach((n) => {
        if (n.id === excludeNodeId) return;
        if (dist(nodeCenter(n), fc) < 320) affected.add(n.id);
      });
      affected.forEach((id) => {
        const cur = deviceStates[id];
        if (!cur) return;
        deviceStates[id] = {
          ...cur,
          smartState: 'power_missing',
          reasons: [...(cur.reasons || []), 'PDU offline — assumed loss of branch/rack power.'].slice(0, 8),
          badgeLabel: 'PWR',
          badgeTone: 'power',
          suggestions: [...(cur.suggestions || []), 'Verify alternate feed or UPS path'].slice(0, 8),
        };
      });
      if (affected.size) {
        findings.push({
          id: `pdu_cascade_${excludeNodeId}`,
          severity: 'high',
          title: 'PDU fault cascade',
          detail: `${affected.size} nearby or directly linked devices flagged for power risk.`,
          nodeIds: [...affected],
          linkIds: [],
          whyLines: ['Heuristic: links to failed PDU or within ~320 canvas units.'],
          suggestions: ['Transfer load', 'Restore PDU'],
          autoFix: null,
        });
      }
    }
  }

  // SC-48: high fan-out access switch with exactly one WAN/core-class uplink (heuristic).
  nodes.forEach((n) => {
    if (n.type !== 'switch' || !lanReach.has(n.id)) return;
    const incident = links.filter((l) => l.source === n.id || l.target === n.id);
    const deg = incident.length;
    if (deg < 8) return;
    let uplinksToCore = 0;
    incident.forEach((l) => {
      const other = l.source === n.id ? l.target : l.source;
      const ob = nodeById[other];
      if (!ob) return;
      const lt = mergeLinkDefaults(l).type;
      if (lt !== 'ethernet' && lt !== 'fiber') return;
      if (GATEWAY_TYPES.has(ob.type)) uplinksToCore += 1;
    });
    if (uplinksToCore !== 1) return;
    const fanAccess = incident.filter((l) => {
      const other = l.source === n.id ? l.target : l.source;
      const ot = nodeById[other]?.type;
      const lt = mergeLinkDefaults(l).type;
      return (lt === 'ethernet' || lt === 'fiber') && ot && !GATEWAY_TYPES.has(ot);
    });
    if (fanAccess.length < 6) return;
    const downstreamIds = [...new Set(fanAccess.map((l) => (l.source === n.id ? l.target : l.source)))].slice(0, 16);
    findings.push({
      id: `core_spof_sw_${n.id}`,
      severity: 'medium',
      title: 'Aggregation switch may be a single point of failure',
      detail: `${n.label || n.id} fans out to many access links but has only one WAN/core-class uplink.`,
      nodeIds: [n.id, ...downstreamIds],
      linkIds: [],
      whyLines: [`degree=${deg}`, `uplinksToCore=${uplinksToCore}`],
      suggestions: ['Add a second uplink (LAG/stack)', 'Split access across redundant paths upstream'],
      autoFix: null,
    });
    const cur = deviceStates[n.id];
    if (!cur || cur.smartState === 'isolated') return;
    if (cur.smartState === 'no_internet') {
      deviceStates[n.id] = {
        ...cur,
        reasons: [...(cur.reasons || []), 'Many access links share a single core-facing uplink on this switch.'],
        suggestions: [...(cur.suggestions || []), 'Plan redundant uplinks between access and core'],
      };
    } else if (cur.smartState !== 'power_missing') {
      deviceStates[n.id] = {
        ...cur,
        smartState: 'at_risk',
        badgeLabel: 'Hub',
        badgeTone: 'risk',
        reasons: [...(cur.reasons || []), 'Many devices depend on a single core-facing uplink on this switch.'],
        suggestions: [...(cur.suggestions || []), 'Design redundant uplinks where possible'],
      };
    }
  });

  const vlanTaggedPositive = nodes.filter(
    (n) => n.type !== 'patchpanel' && String(n.vlan || '').trim() && normVlanTag(n.vlan),
  ).length;
  const redundantLinksPositive = links.filter(
    (l) => l.id !== excludeLinkId && String(mergeLinkDefaults(l).redundantGroup || '').trim(),
  ).length;
  const positiveHints = [];
  const highSeverityCount = findings.filter((f) => f.severity === 'high').length;
  if (overall >= 82 && highSeverityCount === 0) {
    positiveHints.push('Overall quality is strong with no high-severity findings (SC-56 style).');
  }
  if (aps.length >= 2 && coChanPairs.length === 0) {
    positiveHints.push('No overlapping fixed-channel AP pairs detected (SC-59 partial).');
  }
  if (vlanTaggedPositive >= 4 && nodes.length >= 8) {
    positiveHints.push('VLAN assignments are present across multiple devices — good segmentation baseline (SC-58 partial).');
  }
  if (!findings.some((f) => String(f.id || '').startsWith('poe_budget_')) && nodes.some((n) => n.type === 'switch')) {
    positiveHints.push('No switch PoE budget overage for modeled powered ports (SC-60 partial).');
  }
  if (redundantLinksPositive >= 2 && (firewallNodes.length >= 2 || cloudEdgeLinks.length >= 2)) {
    positiveHints.push('Redundant WAN or HA-style edges are modeled — aligns with SC-54 / SC-57.');
  }
  if (
    wifiClients.length >= 2 &&
    wifiClients.every((n) => (deviceStates[n.id]?.quality ?? 0) >= 70)
  ) {
    positiveHints.push('All modeled wireless clients sit at healthy signal scores.');
  }

  return {
    deviceStates,
    findings,
    overallScores,
    overallScore: overall,
    bottleneckLinks,
    apSuggestions,
    gatewayReach: lanReach,
    lanReach,
    wanReach,
    unprotectedWanLinkIds,
    apClients,
    vlanZones,
    meta: { nodeCount: nodes.length, linkCount: links.length, positiveHints },
  };
}

export function computeApGhostSuggestions(nodes, rooms, barriers, deviceStates, aps) {
  const ghosts = [];
  const weak = nodes.filter(n => {
    const st = deviceStates[n.id];
    return (
      st &&
      (st.smartState === 'weak_signal' ||
        st.smartState === 'slow_network' ||
        st.smartState === 'no_network' ||
        st.smartState === 'no_internet')
    );
  });
  if (!weak.length || !aps.length) return ghosts;

  weak.slice(0, 6).forEach((n, idx) => {
    const c = nodeCenter(n);
    const offset = (idx + 1) * 28;
    ghosts.push({
      id: `ghost_${n.id}`,
      x: c.x + offset,
      y: c.y - offset * 0.4,
      improvementPct: 12 + (idx % 4) * 5,
      forDeviceId: n.id,
    });
  });
  return ghosts;
}

export function shortestPath(nodes, links, fromId, toId, excludeNodeId = null, excludeLinkId = null) {
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const prev = new Map();
  const q = [fromId];
  const seen = new Set([fromId]);
  while (q.length) {
    const id = q.shift();
    if (id === toId) break;
    for (const n of adj.get(id) || []) {
      if (!seen.has(n)) {
        seen.add(n);
        prev.set(n, id);
        q.push(n);
      }
    }
  }
  if (!seen.has(toId)) return null;
  const path = [toId];
  let cur = toId;
  while (cur !== fromId) {
    cur = prev.get(cur);
    if (cur == null) return null;
    path.unshift(cur);
  }
  return path;
}

/** Axis-aligned bounds from wall-like barriers (v3 Phase B — room-from-walls helper). */
export function boundingBoxFromBarriers(barriers) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const raw of barriers || []) {
    if (raw.environmentKind === 'noise' || raw.environmentKind === 'conduit') continue;
    const x1 = raw.x1 ?? raw.x;
    const y1 = raw.y1 ?? raw.y;
    const x2 = raw.x2 ?? raw.x + (raw.dx || 0);
    const y2 = raw.y2 ?? raw.y + (raw.dy || 0);
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  }
  if (!Number.isFinite(minX)) return null;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 24 || h < 24) return null;
  return { x: minX, y: minY, w, h };
}

/** Ray-sampled signal field (segment AP→cell through barriers). Capped for CPU (Phase B). */
export function heatmapSignalSamples(nodes, rooms, barriers, bounds, step = 32) {
  const samples = [];
  const aps = coverageSources(nodes.map(mergeNodeDefaults));
  if (!aps.length) return samples;
  const MAX_SAMPLES = 720;
  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    for (let y = bounds.minY; y <= bounds.maxY; y += step) {
      if (samples.length >= MAX_SAMPLES) return samples;
      let best = 0;
      aps.forEach(ap => {
        const ac = nodeCenter(ap);
        const apn = mergeNodeDefaults(ap);
        const d = dist({ x, y }, ac);
        const maxR = (apn.maxRadius || 240) * txPowerRadiusMul(apn.txPower);
        const roomP = roomAtPoint(rooms, x, y);
        const roomAp = roomAtPoint(rooms, ac.x, ac.y);
        const { db, rfBlock } = collectBarrierLoss(barriers, ac.x, ac.y, x, y);
        const borderDb = roomBorderLossDb(roomAp, roomP);
        const floorDb = interFloorLossDb(roomAp, roomP);
        if (rfBlock) return;
        let s = 100 - (d / maxR) * 100 - (db + borderDb + floorDb) * 0.45 - noiseDbFromRoom(roomP) * 0.45;
        s = Math.max(0, Math.min(100, s));
        if (s > best) best = s;
      });
      samples.push({ x, y, strength: best });
    }
  }
  return samples;
}
