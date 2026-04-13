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
 * BUS: Shared backbone with drop connections.
 * Two-row layout: backbone on center line, endpoints branching above and below.
 */
function buildBus(ax, ay, node, link) {
  const spacing = 140;
  const startX = ax - spacing * 3;

  // Backbone devices (horizontal line)
  const router = node('router', 'Bus — Edge Router', startX, ay, { ip: '10.2.0.1' });
  const fw = node('firewall', 'Bus — Firewall', startX + spacing, ay, { ip: '10.2.0.2' });
  const sw1 = node('switch', 'Bus — Switch A', startX + spacing * 2, ay, { ip: '10.2.1.1' });
  const sw2 = node('switch', 'Bus — Switch B', startX + spacing * 3, ay, { ip: '10.2.1.2' });
  const sw3 = node('switch', 'Bus — Switch C', startX + spacing * 4, ay, { ip: '10.2.1.3' });
  const srv = node('server', 'Bus — Server', startX + spacing * 5, ay, { ip: '10.2.10.1' });
  const nas = node('nas', 'Bus — NAS', startX + spacing * 6, ay, { ip: '10.2.10.2' });

  // Endpoints above backbone (y - 120)
  const yUp = ay - 130;
  const pc1 = node('pc', 'Bus — PC 1', startX + spacing * 2, yUp, { ip: '10.2.1.50' });
  const pc2 = node('pc', 'Bus — PC 2', startX + spacing * 3, yUp, { ip: '10.2.1.51' });
  const laptop1 = node('laptop', 'Bus — Laptop 1', startX + spacing * 4, yUp, { ip: '10.2.1.52' });
  const printer = node('printer', 'Bus — Printer', startX + spacing * 5, yUp, { ip: '10.2.1.70' });

  // Endpoints below backbone (y + 120)
  const yDown = ay + 130;
  const ap = node('ap', 'Bus — WiFi AP', startX + spacing * 2, yDown, { ip: '10.2.1.10' });
  const phone1 = node('phone', 'Bus — VoIP 1', startX + spacing * 3, yDown, { ip: '10.2.1.60' });
  const phone2 = node('phone', 'Bus — VoIP 2', startX + spacing * 4, yDown, { ip: '10.2.1.61' });
  const cam = node('camera', 'Bus — Camera', startX + spacing * 5, yDown, { ip: '10.2.1.80' });

  const nodes = [router, fw, sw1, sw2, sw3, srv, nas, pc1, pc2, laptop1, printer, ap, phone1, phone2, cam];

  const links = [
    // Backbone chain
    link(router.id, fw.id, 'wan', 'WAN'),
    link(fw.id, sw1.id, 'fiber', '10Gbps'),
    link(sw1.id, sw2.id, 'fiber', 'Backbone'),
    link(sw2.id, sw3.id, 'fiber', 'Backbone'),
    link(sw3.id, srv.id, 'ethernet', '1Gbps'),
    link(srv.id, nas.id, 'ethernet', '1Gbps'),
    // Drop connections above
    link(sw1.id, pc1.id, 'ethernet', ''),
    link(sw2.id, pc2.id, 'ethernet', ''),
    link(sw3.id, laptop1.id, 'ethernet', ''),
    link(srv.id, printer.id, 'ethernet', ''),
    // Drop connections below
    link(sw1.id, ap.id, 'ethernet', 'PoE'),
    link(sw2.id, phone1.id, 'ethernet', 'PoE'),
    link(sw3.id, phone2.id, 'ethernet', 'PoE'),
    link(sw3.id, cam.id, 'ethernet', 'PoE'),
  ];

  return { nodes, links };
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
 * HYBRID: Enterprise layout combining star cores, bus backbone, and mesh redundancy.
 * Full professional multi-zone network.
 */
function buildHybrid(ax, ay, node, link) {
  // WAN Edge (top)
  const cloud = node('cloud', 'Hybrid — ISP', ax, ay - 300, { ip: '203.0.113.1' });
  const edgeRouter = node('router', 'Hybrid — Edge Router', ax - 120, ay - 180, { ip: '10.6.0.1' });
  const fw = node('firewall', 'Hybrid — Firewall', ax + 120, ay - 180, { ip: '10.6.0.2' });

  // Core bus backbone (horizontal)
  const coreSw1 = node('switch', 'Hybrid — Core A', ax - 300, ay - 40, { ip: '10.6.1.1' });
  const coreSw2 = node('switch', 'Hybrid — Core B', ax, ay - 40, { ip: '10.6.1.2' });
  const coreSw3 = node('switch', 'Hybrid — Core C', ax + 300, ay - 40, { ip: '10.6.1.3' });
  const lb = node('loadbalancer', 'Hybrid — Load Balancer', ax, ay - 120, { ip: '10.6.1.10' });

  // Star zone 1 (left - office)
  const ap1 = node('ap', 'Hybrid — Office AP', ax - 400, ay + 120, { ip: '10.6.10.10' });
  const pc1 = node('pc', 'Hybrid — PC 1', ax - 480, ay + 250, { ip: '10.6.10.50' });
  const pc2 = node('pc', 'Hybrid — PC 2', ax - 350, ay + 250, { ip: '10.6.10.51' });
  const phone = node('phone', 'Hybrid — VoIP', ax - 480, ay + 120, { ip: '10.6.10.60' });
  const printer = node('printer', 'Hybrid — Printer', ax - 220, ay + 250, { ip: '10.6.10.70' });

  // Star zone 2 (center - server room)
  const srv1 = node('server', 'Hybrid — Web Server', ax - 80, ay + 120, { ip: '10.6.20.1' });
  const srv2 = node('server', 'Hybrid — App Server', ax + 80, ay + 120, { ip: '10.6.20.2' });
  const nas = node('nas', 'Hybrid — NAS', ax, ay + 250, { ip: '10.6.20.10' });
  const pdu = node('pdu', 'Hybrid — UPS/PDU', ax - 80, ay + 250, { ip: '10.6.20.20' });

  // Star zone 3 (right - wireless/IoT)
  const ap2 = node('ap', 'Hybrid — IoT AP', ax + 300, ay + 120, { ip: '10.6.30.10' });
  const cam1 = node('camera', 'Hybrid — Camera 1', ax + 220, ay + 250, { ip: '10.6.30.80' });
  const cam2 = node('camera', 'Hybrid — Camera 2', ax + 350, ay + 250, { ip: '10.6.30.81' });
  const iot = node('iot', 'Hybrid — IoT Gateway', ax + 480, ay + 120, { ip: '10.6.30.90' });
  const laptop = node('laptop', 'Hybrid — Laptop', ax + 480, ay + 250, { ip: '10.6.30.52' });
  const smarttv = node('smarttv', 'Hybrid — Smart TV', ax + 350, ay + 120, { ip: '10.6.30.95' });

  const nodes = [
    cloud, edgeRouter, fw, lb, coreSw1, coreSw2, coreSw3,
    ap1, pc1, pc2, phone, printer,
    srv1, srv2, nas, pdu,
    ap2, cam1, cam2, iot, laptop, smarttv,
  ];

  const links = [
    // WAN edge
    link(cloud.id, edgeRouter.id, 'wan', 'WAN'),
    link(cloud.id, fw.id, 'wan', 'WAN Backup'),
    link(edgeRouter.id, lb.id, 'fiber', '10Gbps'),
    link(fw.id, lb.id, 'fiber', '10Gbps'),
    // Backbone (bus)
    link(lb.id, coreSw2.id, 'fiber', '10Gbps'),
    link(coreSw1.id, coreSw2.id, 'fiber', 'Backbone'),
    link(coreSw2.id, coreSw3.id, 'fiber', 'Backbone'),
    // Mesh redundancy between cores
    link(coreSw1.id, coreSw3.id, 'fiber', 'Cross-link'),
    // Star zone 1 (office)
    link(coreSw1.id, ap1.id, 'ethernet', 'PoE'),
    link(coreSw1.id, phone.id, 'ethernet', 'PoE'),
    link(ap1.id, pc1.id, 'wifi', 'WiFi'),
    link(ap1.id, pc2.id, 'wifi', 'WiFi'),
    link(coreSw1.id, printer.id, 'ethernet', ''),
    // Star zone 2 (servers)
    link(coreSw2.id, srv1.id, 'fiber', '10Gbps'),
    link(coreSw2.id, srv2.id, 'fiber', '10Gbps'),
    link(srv2.id, nas.id, 'ethernet', '1Gbps'),
    link(pdu.id, srv1.id, 'ethernet', 'MGMT'),
    // Star zone 3 (wireless/IoT)
    link(coreSw3.id, ap2.id, 'ethernet', 'PoE'),
    link(coreSw3.id, iot.id, 'ethernet', ''),
    link(coreSw3.id, smarttv.id, 'ethernet', ''),
    link(ap2.id, cam1.id, 'wifi', 'WiFi'),
    link(ap2.id, cam2.id, 'wifi', 'WiFi'),
    link(ap2.id, laptop.id, 'wifi', 'WiFi'),
  ];

  return { nodes, links };
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
  if (/\bhybrid\b/.test(t)) return 'hybrid';
  if (/\b(full[-\s]?)?mesh\b|\bmesh\s+topology\b/.test(t)) return 'mesh';
  if (/\bring\b/.test(t)) return 'ring';
  if (/\b(bus|backbone|daisy[-\s]?chain)\b/.test(t)) return 'bus';
  if (/\b(tree|hierarchical|spine[-\s]?leaf|spoke)\b/.test(t)) return 'tree';
  if (/\bstar\b/.test(t)) return 'star';
  return null;
}
