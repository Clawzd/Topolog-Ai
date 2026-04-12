/**
 * Deterministic smart network engine (TopologAi v3).
 * Pure functions — no React. Call on topology changes (debounce in UI).
 */

export const NODE_DIM = { W: 90, H: 56 };

const WIFI_CLIENT_TYPES = new Set(['laptop', 'tablet', 'phone', 'printer', 'smarttv', 'iot', 'camera']);
const COVERAGE_SOURCE_TYPES = new Set(['ap', 'router']);
const GATEWAY_TYPES = new Set(['router', 'firewall', 'loadbalancer', 'cloud']);
const POE_NEED_TYPES = new Set(['camera', 'phone']);

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

function collectBarrierLoss(barriers, x1, y1, x2, y2) {
  let db = 0;
  let rfBlock = false;
  for (const raw of barriers || []) {
    const br = mergeBarrierDefaults(raw);
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

function roomBorderLossDb(roomA, roomB) {
  if (!roomA || !roomB || roomA.id === roomB.id) return 0;
  const mat = roomA.defaultWallMaterial || 'drywall';
  const thick = roomA.wallThickness || 'medium';
  const row = MATERIAL_DB[mat] || MATERIAL_DB.drywall;
  return row[thick] ?? row.medium;
}

function noiseDbFromRoom(room) {
  if (!room) return 0;
  if (room.environment === 'dense') return 4;
  if (room.environment === 'industrial') return 6;
  if (room.noiseLevel === 'high') return 8;
  if (room.noiseLevel === 'medium') return 4;
  return 0;
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

function nodesReachGateway(nodes, links, excludeNodeId, excludeLinkId) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const seeds = nodes.filter(n => n.type === 'cloud').map(n => n.id);
  if (!seeds.length) {
    nodes.filter(n => n.type === 'router').forEach(n => seeds.push(n.id));
  }
  if (!seeds.length) return new Set(nodes.map(n => n.id));
  return reachableFrom(seeds, adj);
}

function hasEthernetPathToGateway(nodeId, nodes, links, gatewayReach, excludeNodeId, excludeLinkId) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const adj = buildGraph(nodes, links, excludeNodeId, excludeLinkId);
  const stack = [nodeId];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    if (GATEWAY_TYPES.has(byId[id]?.type) && gatewayReach.has(id)) return true;
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

function cableLengthFromPixels(link, nodes) {
  const a = nodes.find(n => n.id === link.source);
  const b = nodes.find(n => n.id === link.target);
  if (!a || !b) return 0;
  const d = dist(nodeCenter(a), nodeCenter(b));
  return link.cableLengthM ?? d * 0.1524;
}

/** @param {object} params */
export function computeSmartTopology({
  nodes: rawNodes,
  links: rawLinks,
  rooms: rawRooms,
  vlans = [],
  barriers: rawBarriers = [],
  vlanZones = [],
  excludeNodeId = null,
  excludeLinkId = null,
}) {
  const nodes = rawNodes.map(mergeNodeDefaults);
  const links = rawLinks.map(mergeLinkDefaults);
  const rooms = rawRooms.map(mergeRoomDefaults);
  const barriers = (rawBarriers || []).map(mergeBarrierDefaults);
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

  const gatewayReach = nodesReachGateway(nodes, links, excludeNodeId, excludeLinkId);
  const aps = coverageSources(nodes);
  const findings = [];
  const deviceStates = {};

  const apClients = Object.fromEntries(aps.map(a => [a.id, []]));

  // Co-channel
  coChannelPairs(aps).forEach(([a, b]) => {
    findings.push({
      id: `cc_${a.id}_${b.id}`,
      severity: 'medium',
      title: 'Co-channel interference',
      detail: `${a.label || a.id} and ${b.label || b.id} use the same WiFi channel — overlap may reduce throughput.`,
      nodeIds: [a.id, b.id],
      linkIds: [],
      whyLines: [`Both on channel ${a.channel}`, `Distance ${Math.round(dist(nodeCenter(a), nodeCenter(b)))} canvas units`],
      suggestions: [`Change channel on ${b.label || b.id}`, 'Use 5 GHz where possible'],
      autoFix: null,
    });
  });

  // Assign wireless clients to APs
  nodes.forEach(client => {
    if (!isWirelessClient(client)) return;
    const cc = nodeCenter(client);
    const roomC = roomAtPoint(rooms, cc.x, cc.y);

    if (hasEthernetPathToGateway(client.id, nodes, links, gatewayReach, excludeNodeId, excludeLinkId)) {
      deviceStates[client.id] = {
        smartState: 'healthy',
        quality: 88,
        reasons: ['Connected via wired Ethernet path to gateway.'],
        suggestions: [],
        badgeLabel: 'Good',
        badgeTone: 'good',
        apId: null,
      };
      return;
    }

    let best = null;
    let bestScore = -1;
    aps.forEach(ap => {
      if (!gatewayReach.has(ap.id)) return;
      const ac = nodeCenter(ap);
      const d = dist(cc, ac);
      const apn = mergeNodeDefaults(ap);
      const maxR = (apn.maxRadius || 240) * txPowerRadiusMul(apn.txPower);
      const usableR = (apn.coverageRadius || 180) * txPowerRadiusMul(apn.txPower);
      const roomAp = roomAtPoint(rooms, ac.x, ac.y);
      const { db: barrierDb, rfBlock } = collectBarrierLoss(barriers, ac.x, ac.y, cc.x, cc.y);
      const borderDb = roomBorderLossDb(roomAp, roomC);
      const noiseDb = noiseDbFromRoom(roomC) + noiseDbFromRoom(roomAp);
      const totalDb = barrierDb + borderDb + noiseDb + (apn.environment === 'dense' ? 3 : 0);
      if (rfBlock) {
        if (bestScore < 0) best = { ap, score: 0, d, totalDb, rfBlock: true };
        return;
      }
      let score = 100 - (d / maxR) * 100 - totalDb * 0.45;
      score = Math.max(0, Math.min(100, score));
      if (score > bestScore) {
        bestScore = score;
        best = { ap, score, d, totalDb, rfBlock: false };
      }
    });

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

    const reasons = [
      `${Math.round(best.d)} canvas units from ${apn.label || apn.id}.`,
      best.totalDb > 0.5 ? `Estimated obstruction/noise penalty ~${Math.round(best.totalDb)} dB.` : '',
    ].filter(Boolean);
    if (congested) reasons.push(`AP serves ${load} clients (capacity ${cap}).`);

    const suggestions = [];
    if (score < 60) suggestions.push(`Move ${client.label || client.id} closer to ${apn.label || apn.id}.`);
    if (congested) suggestions.push('Add another AP or reduce client load.');
    if (best.totalDb > 8) suggestions.push('Remove barriers or add AP on the near side of the wall.');

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

  // Non-wireless-capable devices: gateway path
  nodes.forEach(n => {
    if (deviceStates[n.id]) return;
    if (n.type === 'ap' || n.type === 'patchpanel') return;
    if (gatewayReach.has(n.id)) {
      deviceStates[n.id] = {
        smartState: 'healthy',
        quality: 92,
        reasons: ['Reachable from WAN/core in the link graph.'],
        suggestions: [],
        badgeLabel: 'Online',
        badgeTone: 'good',
        apId: null,
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
        title: 'Isolated device',
        detail: `${n.label || n.id} has no connection path to the WAN/core.`,
        nodeIds: [n.id],
        linkIds: [],
        whyLines: ['Graph reachability from Cloud/WAN seeds did not include this node.'],
        suggestions: ['Connect to the rest of the network'],
        autoFix: null,
      });
    }
  });

  // APs themselves
  aps.forEach(ap => {
    const gr = gatewayReach.has(ap.id);
    deviceStates[ap.id] = {
      smartState: gr ? 'healthy' : 'isolated',
      quality: gr ? 95 : 0,
      reasons: gr ? ['Access point has uplink path to core.'] : ['AP has no uplink to gateway.'],
      suggestions: gr ? [] : ['Wire AP to switch or router'],
      badgeLabel: gr ? 'AP' : 'Isolated',
      badgeTone: gr ? 'good' : 'isolated',
      apId: null,
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

  // PoE check
  nodes.forEach(n => {
    if (!POE_NEED_TYPES.has(n.type)) return;
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
        whyLines: ['Camera/phone devices are assumed to need PoE unless a power uplink is set.'],
        suggestions: ['Set link PoE to PoE/PoE+ on the switch uplink'],
        autoFix: { type: 'set_link_poe', nodeId: n.id },
      });
    }
  });

  // Cable length / blocking barriers
  links.forEach(link => {
    const len = cableLengthFromPixels(link, nodes);
    const src = nodeById[link.source];
    const tgt = nodeById[link.target];
    if (!src || !tgt) return;
    const p1 = nodeCenter(src);
    const p2 = nodeCenter(tgt);
    const merged = mergeLinkDefaults(link);
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
    let cableBlock = false;
    (rawBarriers || []).forEach(br => {
      const b = mergeBarrierDefaults(br);
      if (!b.blocksCablePath) return;
      if (lineCrossesBarrier(b, p1.x, p1.y, p2.x, p2.y)) cableBlock = true;
    });
    if (cableBlock && merged.type !== 'wifi') {
      findings.push({
        id: `route_${link.id}`,
        severity: 'low',
        title: 'Cable route through barrier',
        detail: `Link ${src.label} → ${tgt.label} crosses a cable-blocking barrier.`,
        nodeIds: [src.id, tgt.id],
        linkIds: [link.id],
        whyLines: [],
        suggestions: ['Reroute cable or adjust barrier'],
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
      const hasWiredClient = wifiInRoom.some(c => hasEthernetPathToGateway(c.id, nodes, links, gatewayReach, excludeNodeId, excludeLinkId));
      if (!hasWiredClient) {
        findings.push({
          id: `covgap_${room.id}`,
          severity: 'low',
          title: 'Coverage gap',
          detail: `${room.label} has WiFi clients but no AP/router inside the zone.`,
          nodeIds: wifiInRoom.map(n => n.id),
          linkIds: [],
          whyLines: [],
          suggestions: ['Place an AP in this zone'],
          autoFix: null,
        });
      }
    }
  });

  // Cloud without firewall
  const hasCloud = nodes.some(n => n.type === 'cloud');
  const hasFw = nodes.some(n => n.type === 'firewall');
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

  // SPOF — reuse idea: high-degree articulation simplified as nodes with degree 1 that are switches? Skip heavy articulation; flag single uplink for critical servers
  nodes.forEach(n => {
    if (n.criticality !== 'critical' && n.type !== 'server') return;
    const deg = links.filter(l => l.source === n.id || l.target === n.id).length;
    if (n.type === 'server' && deg < 2) {
      findings.push({
        id: `spof_${n.id}`,
        severity: 'medium',
        title: 'Single point of failure risk',
        detail: `${n.label || n.id} has only one connection — no redundancy.`,
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
  const capacity = Math.max(0, 100 - bottleneckLinks.filter(b => b.utilization > 80).length * 12 - coChannelPairs(aps).length * 8);
  const security = Math.max(0, 100 - findings.filter(f => f.title.includes('firewall') || f.title.includes('public') || f.title.includes('VLAN')).length * 15);
  const resilience = Math.max(0, 100 - findings.filter(f => f.title.includes('Single point') || f.title.includes('Isolated')).length * 12);
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

  return {
    deviceStates,
    findings,
    overallScores,
    overallScore: overall,
    bottleneckLinks,
    apSuggestions,
    gatewayReach,
    apClients,
    vlanZones,
    meta: { nodeCount: nodes.length, linkCount: links.length },
  };
}

export function computeApGhostSuggestions(nodes, rooms, barriers, deviceStates, aps) {
  const ghosts = [];
  const weak = nodes.filter(n => {
    const st = deviceStates[n.id];
    return st && (st.smartState === 'weak_signal' || st.smartState === 'slow_network' || st.smartState === 'no_network');
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

export function heatmapSignalSamples(nodes, rooms, barriers, bounds, step = 40) {
  const samples = [];
  const aps = coverageSources(nodes.map(mergeNodeDefaults));
  if (!aps.length) return samples;
  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    for (let y = bounds.minY; y <= bounds.maxY; y += step) {
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
        if (rfBlock) return;
        let s = 100 - (d / maxR) * 100 - (db + borderDb) * 0.45 - noiseDbFromRoom(roomP) * 0.45;
        s = Math.max(0, Math.min(100, s));
        if (s > best) best = s;
      });
      samples.push({ x, y, strength: best });
    }
  }
  return samples;
}
