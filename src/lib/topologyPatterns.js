/**
 * Professional topology patterns as placeable multi-node segments.
 * Each pattern creates a realistic, production-grade network segment
 * with proper device diversity, labeling, and layout.
 */

/** @typedef {{ id: string, label: string, description: string, icon: string }} TopologyPatternMeta */

const NODE_W = 90;
const NODE_H = 56;

/** @param {number} ax @param {number} ay @param {number} deg @param {number} r */
function polar(ax, ay, deg, r) {
  const rad = (deg * Math.PI) / 180;
  return { x: ax + r * Math.cos(rad), y: ay + r * Math.sin(rad) };
}

/**
 * @param {string} patternId
 * @param {number} anchorX  canvas x (center of pattern)
 * @param {number} anchorY
 * @param {{ node: () => string, link: () => string }} genId
 * @returns {{ nodes: object[], links: object[] }}
 */
export function instantiateTopologyPattern(patternId, anchorX, anchorY, genId) {
  const ax = anchorX;
  const ay = anchorY;
  const hw = NODE_W / 2; // 45
  const hh = NODE_H / 2; // 28

  const node = (type, label, x, y, extra = {}) => ({
    id: genId.node(),
    type,
    label,
    x: x - hw,
    y: y - hh,
    ip: extra.ip || '',
    vlan: extra.vlan || null,
  });

  const link = (source, target, type = 'ethernet', label = '') => ({
    id: genId.link(),
    source,
    target,
    type,
    label,
  });

  switch (patternId) {
    case 'star':
      return buildStar(ax, ay, node, link);
    case 'bus':
      return buildBus(ax, ay, node, link);
    case 'ring':
      return buildRing(ax, ay, node, link);
    case 'mesh':
      return buildMesh(ax, ay, node, link);
    case 'tree':
      return buildTree(ax, ay, node, link);
    case 'hybrid':
      return buildHybrid(ax, ay, node, link);
    default:
      return { nodes: [], links: [] };
  }
}

/**
 * STAR: Central switch hub with 8 diverse endpoints radiating outward.
 * Realistic office/floor star with mixed wired and wireless devices.
 */
function buildStar(ax, ay, node, link) {
  // Central hub
  const hub = node('switch', 'Star — Core Switch', ax, ay, { ip: '10.1.1.2' });

  // Inner ring: infrastructure (radius ~130)
  const R1 = 140;
  const ap1 = node('ap', 'Star — WiFi AP 1', ...polarXY(ax, ay, -60, R1), { ip: '10.1.1.10' });
  const ap2 = node('ap', 'Star — WiFi AP 2', ...polarXY(ax, ay, 60, R1), { ip: '10.1.1.11' });
  const srv = node('server', 'Star — File Server', ...polarXY(ax, ay, 180, R1), { ip: '10.1.1.100' });

  // Outer ring: endpoints (radius ~250)
  const R2 = 260;
  const pc1 = node('pc', 'Star — Workstation 1', ...polarXY(ax, ay, -100, R2), { ip: '10.1.1.50' });
  const pc2 = node('pc', 'Star — Workstation 2', ...polarXY(ax, ay, -45, R2), { ip: '10.1.1.51' });
  const laptop = node('laptop', 'Star — Laptop', ...polarXY(ax, ay, 0, R2), { ip: '10.1.1.52' });
  const phone = node('phone', 'Star — VoIP Phone', ...polarXY(ax, ay, 45, R2), { ip: '10.1.1.60' });
  const printer = node('printer', 'Star — Printer', ...polarXY(ax, ay, 100, R2), { ip: '10.1.1.70' });
  const cam = node('camera', 'Star — IP Camera', ...polarXY(ax, ay, 150, R2), { ip: '10.1.1.80' });
  const tablet = node('tablet', 'Star — Tablet', ...polarXY(ax, ay, -150, R2), { ip: '10.1.1.53' });
  const iot = node('iot', 'Star — IoT Sensor', ...polarXY(ax, ay, 210, R2), { ip: '10.1.1.90' });

  const nodes = [hub, ap1, ap2, srv, pc1, pc2, laptop, phone, printer, cam, tablet, iot];
  const links = [
    // Hub to infrastructure
    link(hub.id, ap1.id, 'ethernet', 'PoE'),
    link(hub.id, ap2.id, 'ethernet', 'PoE'),
    link(hub.id, srv.id, 'ethernet', '1Gbps'),
    // Hub to wired endpoints
    link(hub.id, pc1.id, 'ethernet', ''),
    link(hub.id, pc2.id, 'ethernet', ''),
    link(hub.id, phone.id, 'ethernet', 'PoE'),
    link(hub.id, printer.id, 'ethernet', ''),
    link(hub.id, cam.id, 'ethernet', 'PoE'),
    link(hub.id, iot.id, 'ethernet', ''),
    // Wireless clients through APs
    link(ap1.id, laptop.id, 'wifi', 'WiFi'),
    link(ap2.id, tablet.id, 'wifi', 'WiFi'),
  ];

  return { nodes, links };
}

/**
 * BUS: Shared backbone with 4 star-cluster concentrators tapping off it.
 * Matches the classic "bus of stars" diagram: a horizontal backbone line
 * (Bus Backbone barrier) with 4 switches that each act as a local star hub,
 * plus an edge router at the far left.
 *
 * Layout:
 *   Router → (normal link) → SW-A
 *
 *   SW-A ─── SW-B ─── SW-C ─── SW-D     ← 4 concentrators tap the bus
 *   ────────────────── BUS ──────────────
 *    PC PC     AP Laptop  Server NAS    Camera Phone
 */
function buildBus(ax, ay, node, link) {
  const halfLen = 420;
  const x1 = ax - halfLen;
  const x2 = ax + halfLen;
  const yLine = ay;
  const portCount = 8;

  const bus = {
    id: 'bus_pattern_main',
    shape: 'line',
    environmentKind: 'bus',
    barrierType: 'metal',
    thickness: 'medium',
    portCount,
    blocksWifi: false,
    blocksCablePath: false,
    label: 'Bus backbone',
    x1, y1: yLine, x2, y2: yLine,
  };

  // 4 concentrator switches that tap the bus (evenly spaced)
  const spacing = (halfLen * 2) / 4; // ~210 px
  const cxA = ax - halfLen + spacing * 0.5; // ~ax - 315
  const cxB = ax - halfLen + spacing * 1.5; // ~ax - 105
  const cxC = ax - halfLen + spacing * 2.5; // ~ax + 105
  const cxD = ax - halfLen + spacing * 3.5; // ~ax + 315

  const swA = node('switch', 'Bus — Star Hub A', cxA, yLine - 140, { ip: '10.2.1.1' });
  const swB = node('switch', 'Bus — Star Hub B', cxB, yLine - 140, { ip: '10.2.1.2' });
  const swC = node('switch', 'Bus — Star Hub C', cxC, yLine + 140, { ip: '10.2.1.3' });
  const swD = node('switch', 'Bus — Star Hub D', cxD, yLine + 140, { ip: '10.2.1.4' });

  // Star cluster A (above-left) — 2 endpoints above swA
  const pc1 = node('pc', 'Bus — PC 1', cxA - 80, yLine - 280, { ip: '10.2.10.50' });
  const pc2 = node('pc', 'Bus — PC 2', cxA + 80, yLine - 280, { ip: '10.2.10.51' });

  // Star cluster B (above-right) — 2 endpoints above swB
  const ap = node('ap', 'Bus — WiFi AP', cxB - 80, yLine - 280, { ip: '10.2.10.10' });
  const laptop = node('laptop', 'Bus — Laptop', cxB + 80, yLine - 280, { ip: '10.2.10.52' });

  // Star cluster C (below-left) — 2 endpoints below swC
  const srv = node('server', 'Bus — Server', cxC - 80, yLine + 280, { ip: '10.2.20.1' });
  const nas = node('nas', 'Bus — NAS', cxC + 80, yLine + 280, { ip: '10.2.20.2' });

  // Star cluster D (below-right) — 2 endpoints below swD
  const cam = node('camera', 'Bus — Camera', cxD - 80, yLine + 280, { ip: '10.2.10.80' });
  const phone = node('phone', 'Bus — VoIP', cxD + 80, yLine + 280, { ip: '10.2.10.60' });

  // Edge router at the far left, connected to swA via normal link
  const router = node('router', 'Bus — Edge Router', ax - halfLen - 120, yLine - 140, { ip: '10.2.0.1' });

  const nodes = [router, swA, swB, swC, swD, pc1, pc2, ap, laptop, srv, nas, cam, phone];

  // Bus taps: each concentrator switch taps the backbone
  const tap = (n, port, type = 'ethernet', label = '') => ({
    id: `lp_bus_${port}_${Math.random().toString(36).slice(2, 5)}`,
    source: n.id,
    target: bus.id,
    type,
    label,
    busId: bus.id,
    busPortIndex: port,
  });

  const links = [
    // Router → Star Hub A (normal node-to-node link, not a bus tap)
    link(router.id, swA.id, 'wan', 'WAN'),
    // 4 concentrators tap the bus
    tap(swA, 1),
    tap(swB, 3),
    tap(swC, 4),
    tap(swD, 6),
    // Star cluster A
    link(swA.id, pc1.id, 'ethernet', ''),
    link(swA.id, pc2.id, 'ethernet', ''),
    // Star cluster B
    link(swB.id, ap.id, 'ethernet', 'PoE'),
    link(swB.id, laptop.id, 'ethernet', ''),
    // Star cluster C
    link(swC.id, srv.id, 'ethernet', '1Gbps'),
    link(swC.id, nas.id, 'ethernet', '1Gbps'),
    // Star cluster D
    link(swD.id, cam.id, 'ethernet', 'PoE'),
    link(swD.id, phone.id, 'ethernet', 'PoE'),
  ];

  return { nodes, links, barriers: [bus] };
}

/**
 * RING: Redundant loop with 6 nodes + attached endpoints.
 * Proper ring with no single point of failure.
 */
function buildRing(ax, ay, node, link) {
  const R = 170;
  // Ring nodes: 6 devices in a circle
  const angles = [-90, -30, 30, 90, 150, 210];
  const ringSpecs = [
    ['router', 'Ring — Core Router', '10.3.0.1'],
    ['switch', 'Ring — Switch A', '10.3.1.1'],
    ['switch', 'Ring — Switch B', '10.3.1.2'],
    ['router', 'Ring — Backup Router', '10.3.0.2'],
    ['switch', 'Ring — Switch C', '10.3.1.3'],
    ['switch', 'Ring — Switch D', '10.3.1.4'],
  ];

  const ringNodes = ringSpecs.map(([type, label, ip], i) => {
    const p = polar(ax, ay, angles[i], R);
    return node(type, label, p.x, p.y, { ip });
  });

  // Ring links (each connects to next, closing the loop)
  const ringLinks = [];
  for (let i = 0; i < ringNodes.length; i++) {
    const a = ringNodes[i];
    const b = ringNodes[(i + 1) % ringNodes.length];
    ringLinks.push(link(a.id, b.id, 'fiber', 'Ring'));
  }

  // Endpoints attached to ring switches (outer ring, radius ~300)
  const R2 = 310;
  const srv = node('server', 'Ring — Server', ...polarXY(ax, ay, -30, R2), { ip: '10.3.10.1' });
  const pc1 = node('pc', 'Ring — PC 1', ...polarXY(ax, ay, 30, R2), { ip: '10.3.1.50' });
  const ap = node('ap', 'Ring — WiFi AP', ...polarXY(ax, ay, 150, R2), { ip: '10.3.1.10' });
  const cam = node('camera', 'Ring — Camera', ...polarXY(ax, ay, 210, R2), { ip: '10.3.1.80' });
  const nas = node('nas', 'Ring — NAS', ...polarXY(ax, ay, 90, R2), { ip: '10.3.10.2' });
  const laptop = node('laptop', 'Ring — Laptop', ...polarXY(ax, ay, -90, R2 - 50), { ip: '10.3.1.52' });

  const endpointLinks = [
    link(ringNodes[1].id, srv.id, 'ethernet', '1Gbps'),
    link(ringNodes[2].id, pc1.id, 'ethernet', ''),
    link(ringNodes[4].id, ap.id, 'ethernet', 'PoE'),
    link(ringNodes[5].id, cam.id, 'ethernet', 'PoE'),
    link(ringNodes[3].id, nas.id, 'ethernet', '1Gbps'),
    link(ringNodes[0].id, laptop.id, 'wifi', 'WiFi'),
  ];

  return {
    nodes: [...ringNodes, srv, pc1, ap, cam, nas, laptop],
    links: [...ringLinks, ...endpointLinks],
  };
}

/**
 * MESH: Full mesh core (4 nodes) + partial mesh access + endpoints.
 * Demonstrates high-availability interconnection.
 */
function buildMesh(ax, ay, node, link) {
  const R = 130;
  // Full mesh core: 4 nodes
  const coreAngles = [-90, 0, 90, 180];
  const coreSpecs = [
    ['router', 'Mesh — Router A', '10.4.0.1'],
    ['switch', 'Mesh — Switch A', '10.4.1.1'],
    ['router', 'Mesh — Router B', '10.4.0.2'],
    ['switch', 'Mesh — Switch B', '10.4.1.2'],
  ];

  const coreNodes = coreSpecs.map(([type, label, ip], i) => {
    const p = polar(ax, ay, coreAngles[i], R);
    return node(type, label, p.x, p.y, { ip });
  });

  // Full mesh links between all core nodes
  const coreLinks = [];
  for (let i = 0; i < coreNodes.length; i++) {
    for (let j = i + 1; j < coreNodes.length; j++) {
      coreLinks.push(link(coreNodes[i].id, coreNodes[j].id, 'fiber', 'Mesh'));
    }
  }

  // Access layer below and to sides
  const R2 = 280;
  const fw = node('firewall', 'Mesh — Firewall', ax, ay - R2, { ip: '10.4.0.10' });
  const ap1 = node('ap', 'Mesh — AP 1', ax - 200, ay + 180, { ip: '10.4.1.10' });
  const ap2 = node('ap', 'Mesh — AP 2', ax + 200, ay + 180, { ip: '10.4.1.11' });
  const srv = node('server', 'Mesh — Server', ax + R2, ay, { ip: '10.4.10.1' });
  const nas = node('nas', 'Mesh — NAS', ax - R2, ay, { ip: '10.4.10.2' });
  const pc1 = node('pc', 'Mesh — PC 1', ax - 200, ay + 300, { ip: '10.4.1.50' });
  const laptop = node('laptop', 'Mesh — Laptop', ax, ay + 300, { ip: '10.4.1.52' });
  const pc2 = node('pc', 'Mesh — PC 2', ax + 200, ay + 300, { ip: '10.4.1.51' });
  const cam = node('camera', 'Mesh — Camera', ax, ay + 180, { ip: '10.4.1.80' });

  const accessLinks = [
    link(coreNodes[0].id, fw.id, 'ethernet', ''),
    link(coreNodes[1].id, srv.id, 'ethernet', '1Gbps'),
    link(coreNodes[3].id, nas.id, 'ethernet', '1Gbps'),
    link(coreNodes[2].id, ap1.id, 'ethernet', 'PoE'),
    link(coreNodes[2].id, ap2.id, 'ethernet', 'PoE'),
    link(coreNodes[2].id, cam.id, 'ethernet', 'PoE'),
    link(ap1.id, pc1.id, 'wifi', 'WiFi'),
    link(ap2.id, pc2.id, 'wifi', 'WiFi'),
    link(ap1.id, laptop.id, 'wifi', 'WiFi'),
  ];

  return {
    nodes: [...coreNodes, fw, ap1, ap2, srv, nas, pc1, laptop, pc2, cam],
    links: [...coreLinks, ...accessLinks],
  };
}

/**
 * TREE: 3-tier hierarchy — core, distribution, access + endpoints.
 * Professional spine-leaf inspired layout.
 */
function buildTree(ax, ay, node, link) {
  // Tier 1: Core (top)
  const core = node('router', 'Tree — Core Router', ax, ay - 240, { ip: '10.5.0.1' });
  const fw = node('firewall', 'Tree — Firewall', ax + 170, ay - 240, { ip: '10.5.0.2' });

  // Tier 2: Distribution
  const dist1 = node('switch', 'Tree — Dist Switch A', ax - 250, ay - 80, { ip: '10.5.1.1' });
  const dist2 = node('switch', 'Tree — Dist Switch B', ax, ay - 80, { ip: '10.5.1.2' });
  const dist3 = node('switch', 'Tree — Dist Switch C', ax + 250, ay - 80, { ip: '10.5.1.3' });

  // Tier 3: Access + Endpoints
  // Branch A (left)
  const pc1 = node('pc', 'Tree — PC 1', ax - 350, ay + 80, { ip: '10.5.10.50' });
  const pc2 = node('pc', 'Tree — PC 2', ax - 220, ay + 80, { ip: '10.5.10.51' });
  const printer1 = node('printer', 'Tree — Printer A', ax - 350, ay + 210, { ip: '10.5.10.70' });
  const phone1 = node('phone', 'Tree — VoIP 1', ax - 220, ay + 210, { ip: '10.5.10.60' });

  // Branch B (center)
  const srv1 = node('server', 'Tree — App Server', ax - 80, ay + 80, { ip: '10.5.20.1' });
  const srv2 = node('server', 'Tree — DB Server', ax + 80, ay + 80, { ip: '10.5.20.2' });
  const nas = node('nas', 'Tree — NAS Storage', ax, ay + 210, { ip: '10.5.20.10' });

  // Branch C (right)
  const ap1 = node('ap', 'Tree — AP Floor 1', ax + 180, ay + 80, { ip: '10.5.30.10' });
  const ap2 = node('ap', 'Tree — AP Floor 2', ax + 320, ay + 80, { ip: '10.5.30.11' });
  const laptop = node('laptop', 'Tree — Laptop', ax + 180, ay + 210, { ip: '10.5.30.50' });
  const tablet = node('tablet', 'Tree — Tablet', ax + 320, ay + 210, { ip: '10.5.30.51' });
  const cam = node('camera', 'Tree — Camera', ax + 250, ay + 210, { ip: '10.5.30.80' });

  const nodes = [core, fw, dist1, dist2, dist3, pc1, pc2, printer1, phone1, srv1, srv2, nas, ap1, ap2, laptop, tablet, cam];
  const links = [
    // Core to distribution
    link(core.id, fw.id, 'ethernet', ''),
    link(core.id, dist1.id, 'fiber', '10Gbps'),
    link(core.id, dist2.id, 'fiber', '10Gbps'),
    link(fw.id, dist3.id, 'fiber', '10Gbps'),
    // Cross-connects for redundancy
    link(core.id, dist3.id, 'fiber', 'Backup'),
    // Distribution to access
    link(dist1.id, pc1.id, 'ethernet', ''),
    link(dist1.id, pc2.id, 'ethernet', ''),
    link(dist1.id, printer1.id, 'ethernet', ''),
    link(dist1.id, phone1.id, 'ethernet', 'PoE'),
    link(dist2.id, srv1.id, 'fiber', '10Gbps'),
    link(dist2.id, srv2.id, 'fiber', '10Gbps'),
    link(dist2.id, nas.id, 'ethernet', '1Gbps'),
    link(dist3.id, ap1.id, 'ethernet', 'PoE'),
    link(dist3.id, ap2.id, 'ethernet', 'PoE'),
    link(dist3.id, cam.id, 'ethernet', 'PoE'),
    // Wireless endpoints
    link(ap1.id, laptop.id, 'wifi', 'WiFi'),
    link(ap2.id, tablet.id, 'wifi', 'WiFi'),
  ];

  return { nodes, links };
}

/**
 * HYBRID: Bus backbone + 3 star clusters + mesh redundancy between cores.
 * Uses the Bus Backbone barrier so the backbone renders as the real element.
 *
 * Layout:
 *   Cloud → Router → Firewall    (WAN edge, top)
 *                  ↓
 *   Core-A ──── Core-B ──── Core-C   ← 3 cores tap the Bus Backbone
 *   ═══════════ BUS BACKBONE ═══════════
 *    ★ Star A       ★ Star B       ★ Star C
 *   (Office)     (Server room)  (Wireless/IoT)
 *
 *   Core-A ←──── mesh cross-link ────→ Core-C
 */
function buildHybrid(ax, ay, node, link) {
  // Bus backbone across the middle
  const halfLen = 380;
  const busY = ay;
  const bus = {
    id: 'hybrid_bus_main',
    shape: 'line',
    environmentKind: 'bus',
    barrierType: 'metal',
    thickness: 'medium',
    portCount: 6,
    blocksWifi: false,
    blocksCablePath: false,
    label: 'Core backbone',
    x1: ax - halfLen, y1: busY, x2: ax + halfLen, y2: busY,
  };

  // WAN edge (above the bus)
  const cloud = node('cloud', 'Hybrid — ISP', ax, ay - 320, { ip: '203.0.113.1' });
  const edgeRouter = node('router', 'Hybrid — Edge Router', ax - 100, ay - 200, { ip: '10.6.0.1' });
  const fw = node('firewall', 'Hybrid — Firewall', ax + 100, ay - 200, { ip: '10.6.0.2' });

  // 3 core switches — tap the bus backbone
  const cxA = ax - 280;
  const cxB = ax;
  const cxC = ax + 280;
  const coreY = ay - 110;  // sit above the bus line

  const coreA = node('switch', 'Hybrid — Core A', cxA, coreY, { ip: '10.6.1.1' });
  const coreB = node('switch', 'Hybrid — Core B', cxB, coreY, { ip: '10.6.1.2' });
  const coreC = node('switch', 'Hybrid — Core C', cxC, coreY, { ip: '10.6.1.3' });

  // Star A — office zone (below-left)
  const ap1   = node('ap',      'Hybrid — Office AP',  cxA - 80, ay + 140, { ip: '10.6.10.10' });
  const phone  = node('phone',   'Hybrid — VoIP',       cxA + 80, ay + 140, { ip: '10.6.10.60' });
  const pc1    = node('pc',      'Hybrid — PC 1',       cxA - 80, ay + 280, { ip: '10.6.10.50' });
  const printer= node('printer', 'Hybrid — Printer',    cxA + 80, ay + 280, { ip: '10.6.10.70' });

  // Star B — server room (below-center)
  const srv1   = node('server',  'Hybrid — Web Server', cxB - 80, ay + 140, { ip: '10.6.20.1' });
  const srv2   = node('server',  'Hybrid — App Server', cxB + 80, ay + 140, { ip: '10.6.20.2' });
  const nas    = node('nas',     'Hybrid — NAS',        cxB - 80, ay + 280, { ip: '10.6.20.10' });
  const pdu    = node('pdu',     'Hybrid — UPS/PDU',    cxB + 80, ay + 280, { ip: '10.6.20.20' });

  // Star C — wireless/IoT (below-right)
  const ap2    = node('ap',      'Hybrid — IoT AP',     cxC - 80, ay + 140, { ip: '10.6.30.10' });
  const iot    = node('iot',     'Hybrid — IoT GW',     cxC + 80, ay + 140, { ip: '10.6.30.90' });
  const laptop = node('laptop',  'Hybrid — Laptop',     cxC - 80, ay + 280, { ip: '10.6.30.52' });
  const cam    = node('camera',  'Hybrid — Camera',     cxC + 80, ay + 280, { ip: '10.6.30.80' });

  const nodes = [
    cloud, edgeRouter, fw,
    coreA, coreB, coreC,
    ap1, phone, pc1, printer,
    srv1, srv2, nas, pdu,
    ap2, iot, laptop, cam,
  ];

  const tap = (n, port) => ({
    id: `hy_tap_${port}_${Math.random().toString(36).slice(2, 5)}`,
    source: n.id,
    target: bus.id,
    type: 'fiber',
    label: 'Backbone',
    busId: bus.id,
    busPortIndex: port,
  });

  const links = [
    // WAN edge
    link(cloud.id, edgeRouter.id, 'wan', 'WAN'),
    link(cloud.id, fw.id, 'wan', 'Backup WAN'),
    link(edgeRouter.id, coreB.id, 'fiber', '10Gbps'),
    link(fw.id, coreB.id, 'fiber', '10Gbps'),
    // 3 cores tap the bus backbone
    tap(coreA, 1),
    tap(coreB, 3),
    tap(coreC, 5),
    // Mesh cross-link between edge cores (redundancy)
    link(coreA.id, coreC.id, 'fiber', 'Cross-link'),
    // Star A — office
    link(coreA.id, ap1.id, 'ethernet', 'PoE'),
    link(coreA.id, phone.id, 'ethernet', 'PoE'),
    link(ap1.id, pc1.id, 'wifi', 'WiFi'),
    link(coreA.id, printer.id, 'ethernet', ''),
    // Star B — servers
    link(coreB.id, srv1.id, 'fiber', '10Gbps'),
    link(coreB.id, srv2.id, 'fiber', '10Gbps'),
    link(coreB.id, nas.id, 'ethernet', '1Gbps'),
    link(pdu.id, srv1.id, 'ethernet', 'MGMT'),
    // Star C — wireless/IoT
    link(coreC.id, ap2.id, 'ethernet', 'PoE'),
    link(coreC.id, iot.id, 'ethernet', ''),
    link(ap2.id, laptop.id, 'wifi', 'WiFi'),
    link(ap2.id, cam.id, 'wifi', 'WiFi'),
  ];

  return { nodes, links, barriers: [bus] };
}

/** Helper: returns [x, y] from polar coords */
function polarXY(ax, ay, deg, r) {
  const p = polar(ax, ay, deg, r);
  return [p.x, p.y];
}

/** @type {TopologyPatternMeta[]} */
export const TOPOLOGY_PATTERNS = [
  { id: 'star', label: 'Star Network', description: 'Central switch + 11 diverse endpoints', icon: '✶' },
  { id: 'bus', label: 'Bus Network', description: '7-node backbone + 8 drop endpoints', icon: '▬' },
  { id: 'ring', label: 'Ring Network', description: '6-node redundant loop + endpoints', icon: '○' },
  { id: 'mesh', label: 'Mesh Network', description: '4-node full mesh + access layer', icon: '△' },
  { id: 'tree', label: 'Tree / Spine-Leaf', description: '3-tier hierarchy with 17 devices', icon: '⌇' },
  { id: 'hybrid', label: 'Hybrid Enterprise', description: 'Star + bus + mesh — 22 devices', icon: '✦' },
];

export const TOPOLOGY_PATTERN_IDS = new Set(TOPOLOGY_PATTERNS.map((p) => p.id));

/** Map free-text prompt to a pattern id, or null. */
export function patternIdFromPrompt(text) {
  const t = String(text || '').toLowerCase();
  // Hybrid must be checked first — it contains "bus", "mesh", etc.
  if (/\bhybrid\b/.test(t)) return 'hybrid';
  // Mesh
  if (/\b(full[-\s]?)?mesh\b|\bmesh\s+topology\b|\bfully[-\s]connected\b|\bevery[-\s]to[-\s]every\b/.test(t)) return 'mesh';
  // Ring
  if (/\bring\b|\btoken[-\s]ring\b|\bclosed[-\s]loop\b|\bcircular\b/.test(t)) return 'ring';
  // Bus
  if (/\b(bus|backbone|daisy[-\s]?chain|shared[-\s]cable|linear[-\s]network)\b/.test(t)) return 'bus';
  // Tree / spine-leaf
  if (/\b(tree|hierarchical|spine[-\s]?leaf|concentrator|multi[-\s]tier|3[-\s]tier)\b/.test(t)) return 'tree';
  // Star
  if (/\bstar\b|\bcentral[-\s]hub\b|\bhub[-\s]and[-\s]spoke\b/.test(t)) return 'star';
  return null;
}
