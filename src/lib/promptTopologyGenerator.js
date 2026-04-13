import { MOCK_AI_RESPONSES, generateId } from './topologyData';
import { patternIdFromPrompt, instantiateTopologyPattern, TOPOLOGY_PATTERNS } from './topologyPatterns';
import { recommendTopology } from './smartLayout';

const SCENARIO_HINTS = [
  {
    match: ['warehouse', 'iot', 'camera', 'sensor', 'industrial'],
    note: 'Optimized for operations, cameras, and IoT isolation.',
  },
  {
    match: ['campus', 'school', 'university', 'library'],
    note: 'Optimized for multi-building segmentation.',
  },
  {
    match: ['data center', 'datacenter', 'server', 'rack'],
    note: 'Optimized for resilient core and server tiers.',
  },
  {
    match: ['retail', 'store', 'pos', 'payment'],
    note: 'Optimized for POS, guest WiFi, and security zones.',
  },
  {
    match: ['home', 'house', 'apartment', 'villa'],
    note: 'Optimized for WiFi coverage and shared services.',
  },
  {
    match: ['hospital', 'clinic', 'medical', 'health'],
    note: 'Optimized for clinical WiFi, imaging, and security zones.',
  },
  {
    match: ['hotel', 'resort', 'hospitality'],
    note: 'Optimized for guest isolation, PMS, and coverage.',
  },
  {
    match: ['factory', 'manufacturing', 'production'],
    note: 'Optimized for OT/IT segmentation and SCADA networks.',
  },
];

function getScenarioNote(prompt) {
  const lower = prompt.toLowerCase();
  return SCENARIO_HINTS.find(({ match }) => match.some(word => lower.includes(word)))?.note
    || 'Optimized for an editable office-grade topology.';
}

export function generatePromptTopology(userPrompt) {
  const hint = (userPrompt || 'office network').trim().slice(0, 200);
  const lower = hint.toLowerCase();

  // Check for specialized scenarios first
  if (['warehouse', 'iot', 'sensor', 'industrial', 'factory'].some(w => lower.includes(w))) {
    return smartWarehouseTopology(hint);
  }
  if (['zero trust', 'branch', 'sd-wan', 'sdwan'].some(w => lower.includes(w))) {
    return zeroTrustBranchTopology(hint);
  }
  if (['hospital', 'clinic', 'medical', 'health'].some(w => lower.includes(w))) {
    return hospitalTopology(hint);
  }
  if (['hotel', 'resort', 'hospitality'].some(w => lower.includes(w))) {
    return hotelTopology(hint);
  }

  // Check for explicit topology pattern keywords
  const pid = patternIdFromPrompt(hint);
  if (pid) {
    const genId = { node: () => generateId('n'), link: () => generateId('l') };
    const { nodes, links } = instantiateTopologyPattern(pid, 400, 300, genId);
    const meta = TOPOLOGY_PATTERNS.find((p) => p.id === pid);
    return {
      nodes,
      links,
      rooms: [],
      vlans: [],
      summary: `${meta?.label || pid} topology for "${hint}". ${getScenarioNote(hint)}`,
    };
  }

  // Use smart recommendation based on prompt
  const rec = recommendTopology(hint);

  // Use enriched mock responses (they already have rooms, VLANs, etc.)
  const topology = MOCK_AI_RESPONSES.default(hint);

  return {
    ...topology,
    summary: `${topology.summary} Using ${rec.topology} topology pattern: ${rec.reason}`,
  };
}

function smartWarehouseTopology(hint) {
  return {
    summary: `Smart warehouse/industrial network for "${hint}". Separates operations, security, IoT, and guest wireless.`,
    nodes: [
      { id: 'n1', type: 'cloud', label: 'ISP / WAN', x: 420, y: 40, ip: '203.0.113.10', vlan: null },
      { id: 'n2', type: 'firewall', label: 'Edge Firewall', x: 420, y: 140, ip: '10.44.0.1', vlan: null },
      { id: 'n3', type: 'router', label: 'Core Router', x: 420, y: 250, ip: '10.44.0.2', vlan: null },
      { id: 'n4', type: 'switch', label: 'Core Switch', x: 420, y: 370, ip: '10.44.1.2', vlan: 'OPS' },
      // Operations zone
      { id: 'n5', type: 'switch', label: 'Dock Switch', x: 140, y: 500, ip: '10.44.10.2', vlan: 'OPS' },
      { id: 'n6', type: 'server', label: 'WMS Server', x: 80, y: 640, ip: '10.44.40.10', vlan: 'SRV' },
      { id: 'n7', type: 'pc', label: 'Dock Terminal', x: 200, y: 640, ip: '10.44.10.50', vlan: 'OPS' },
      { id: 'n8', type: 'printer', label: 'Label Printer', x: 320, y: 640, ip: '10.44.10.70', vlan: 'OPS' },
      // Security zone
      { id: 'n9', type: 'switch', label: 'Security Switch', x: 420, y: 500, ip: '10.44.30.2', vlan: 'SEC' },
      { id: 'n10', type: 'camera', label: 'Camera — Dock', x: 420, y: 640, ip: '10.44.30.11', vlan: 'SEC' },
      { id: 'n11', type: 'camera', label: 'Camera — Floor A', x: 540, y: 640, ip: '10.44.30.12', vlan: 'SEC' },
      { id: 'n12', type: 'camera', label: 'Camera — Gate', x: 660, y: 640, ip: '10.44.30.13', vlan: 'SEC' },
      { id: 'n13', type: 'nas', label: 'NVR Storage', x: 540, y: 500, ip: '10.44.30.20', vlan: 'SEC' },
      // IoT / Wireless zone
      { id: 'n14', type: 'ap', label: 'Warehouse AP 1', x: 700, y: 500, ip: '10.44.20.2', vlan: 'IOT' },
      { id: 'n15', type: 'ap', label: 'Warehouse AP 2', x: 830, y: 500, ip: '10.44.20.3', vlan: 'IOT' },
      { id: 'n16', type: 'iot', label: 'IoT Gateway', x: 700, y: 640, ip: '10.44.20.10', vlan: 'IOT' },
      { id: 'n17', type: 'tablet', label: 'Scanner Fleet', x: 830, y: 640, ip: '10.44.20.50', vlan: 'IOT' },
      { id: 'n18', type: 'pdu', label: 'Rack UPS', x: 260, y: 500, ip: '10.44.1.20', vlan: 'OPS' },
    ],
    links: [
      { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN' },
      { id: 'l2', source: 'n2', target: 'n3', type: 'fiber', label: '10Gbps' },
      { id: 'l3', source: 'n3', target: 'n4', type: 'fiber', label: '10Gbps' },
      { id: 'l4', source: 'n4', target: 'n5', type: 'fiber', label: 'Dock uplink' },
      { id: 'l5', source: 'n4', target: 'n9', type: 'fiber', label: 'Security uplink' },
      { id: 'l6', source: 'n4', target: 'n14', type: 'ethernet', label: 'PoE' },
      { id: 'l7', source: 'n4', target: 'n15', type: 'ethernet', label: 'PoE' },
      { id: 'l8', source: 'n5', target: 'n6', type: 'ethernet', label: '1Gbps' },
      { id: 'l9', source: 'n5', target: 'n7', type: 'ethernet', label: '' },
      { id: 'l10', source: 'n5', target: 'n8', type: 'ethernet', label: '' },
      { id: 'l11', source: 'n5', target: 'n18', type: 'ethernet', label: 'MGMT' },
      { id: 'l12', source: 'n9', target: 'n10', type: 'ethernet', label: 'PoE' },
      { id: 'l13', source: 'n9', target: 'n11', type: 'ethernet', label: 'PoE' },
      { id: 'l14', source: 'n9', target: 'n12', type: 'ethernet', label: 'PoE' },
      { id: 'l15', source: 'n9', target: 'n13', type: 'ethernet', label: '1Gbps' },
      { id: 'l16', source: 'n14', target: 'n16', type: 'wifi', label: 'Zigbee' },
      { id: 'l17', source: 'n15', target: 'n17', type: 'wifi', label: 'WiFi' },
    ],
    rooms: [
      { id: 'r1', label: 'Dock Operations', x: 50, y: 460, w: 330, h: 250, color: 'rgba(20,184,166,0.08)' },
      { id: 'r2', label: 'Security Zone', x: 390, y: 460, w: 240, h: 250, color: 'rgba(244,63,94,0.08)' },
      { id: 'r3', label: 'Wireless / IoT Floor', x: 660, y: 460, w: 230, h: 250, color: 'rgba(245,158,11,0.08)' },
    ],
    vlans: [
      { id: 'v1', name: 'OPS', label: 'Operations', color: '#14b8a6', subnet: '10.44.10.0/24' },
      { id: 'v2', name: 'IOT', label: 'IoT / Scanners', color: '#f59e0b', subnet: '10.44.20.0/24' },
      { id: 'v3', name: 'SEC', label: 'Security Cameras', color: '#f43f5e', subnet: '10.44.30.0/24' },
      { id: 'v4', name: 'SRV', label: 'Warehouse Servers', color: '#22c55e', subnet: '10.44.40.0/24' },
    ],
  };
}

function zeroTrustBranchTopology(hint) {
  return {
    summary: `Zero-trust branch network for "${hint}". Identity-based access, guest isolation, and protected services.`,
    nodes: [
      { id: 'n1', type: 'cloud', label: 'Internet', x: 420, y: 40, ip: '0.0.0.0/0', vlan: null },
      { id: 'n2', type: 'router', label: 'SD-WAN Edge', x: 280, y: 160, ip: '198.51.100.2', vlan: null },
      { id: 'n3', type: 'firewall', label: 'Policy Firewall', x: 560, y: 160, ip: '10.80.0.1', vlan: null },
      { id: 'n4', type: 'switch', label: 'Secure Core', x: 420, y: 290, ip: '10.80.1.2', vlan: 'CORP' },
      // Identity zone
      { id: 'n5', type: 'loadbalancer', label: 'App Gateway', x: 160, y: 420, ip: '10.80.40.10', vlan: 'APPS' },
      { id: 'n6', type: 'server', label: 'Identity Proxy', x: 100, y: 560, ip: '10.80.40.11', vlan: 'APPS' },
      { id: 'n7', type: 'server', label: 'RADIUS Server', x: 240, y: 560, ip: '10.80.40.12', vlan: 'APPS' },
      // Corporate zone
      { id: 'n8', type: 'ap', label: 'Corp WiFi AP', x: 420, y: 420, ip: '10.80.20.2', vlan: 'CORP' },
      { id: 'n9', type: 'laptop', label: 'Managed Laptop', x: 340, y: 560, ip: '10.80.20.50', vlan: 'CORP' },
      { id: 'n10', type: 'phone', label: 'VoIP Phone', x: 460, y: 560, ip: '10.80.20.60', vlan: 'CORP' },
      { id: 'n11', type: 'pc', label: 'Corp Desktop', x: 560, y: 560, ip: '10.80.20.51', vlan: 'CORP' },
      { id: 'n12', type: 'printer', label: 'Secure Printer', x: 420, y: 560, ip: '10.80.20.70', vlan: 'CORP' },
      // Guest zone
      { id: 'n13', type: 'ap', label: 'Guest WiFi AP', x: 700, y: 420, ip: '10.80.30.2', vlan: 'GUEST' },
      { id: 'n14', type: 'tablet', label: 'Guest Tablet', x: 640, y: 560, ip: '10.80.30.50', vlan: 'GUEST' },
      { id: 'n15', type: 'laptop', label: 'Visitor Laptop', x: 760, y: 560, ip: '10.80.30.51', vlan: 'GUEST' },
      // Cameras
      { id: 'n16', type: 'camera', label: 'Entrance Camera', x: 840, y: 420, ip: '10.80.50.1', vlan: 'SEC' },
    ],
    links: [
      { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN A' },
      { id: 'l2', source: 'n1', target: 'n3', type: 'vpn', label: 'Policy tunnel' },
      { id: 'l3', source: 'n2', target: 'n4', type: 'fiber', label: 'Primary' },
      { id: 'l4', source: 'n3', target: 'n4', type: 'fiber', label: 'Inspected' },
      { id: 'l5', source: 'n4', target: 'n5', type: 'ethernet', label: '' },
      { id: 'l6', source: 'n4', target: 'n8', type: 'ethernet', label: 'PoE' },
      { id: 'l7', source: 'n4', target: 'n13', type: 'ethernet', label: 'PoE' },
      { id: 'l8', source: 'n4', target: 'n16', type: 'ethernet', label: 'PoE' },
      { id: 'l9', source: 'n5', target: 'n6', type: 'ethernet', label: 'App path' },
      { id: 'l10', source: 'n5', target: 'n7', type: 'ethernet', label: 'Auth path' },
      { id: 'l11', source: 'n8', target: 'n9', type: 'wifi', label: 'Corp SSID' },
      { id: 'l12', source: 'n8', target: 'n10', type: 'wifi', label: 'Voice' },
      { id: 'l13', source: 'n8', target: 'n12', type: 'wifi', label: 'WiFi' },
      { id: 'l14', source: 'n4', target: 'n11', type: 'ethernet', label: '' },
      { id: 'l15', source: 'n13', target: 'n14', type: 'wifi', label: 'Guest SSID' },
      { id: 'l16', source: 'n13', target: 'n15', type: 'wifi', label: 'Guest SSID' },
    ],
    rooms: [
      { id: 'r1', label: 'Identity Zone', x: 60, y: 380, w: 240, h: 230, color: 'rgba(34,197,94,0.08)' },
      { id: 'r2', label: 'Corporate Access', x: 300, y: 380, w: 310, h: 230, color: 'rgba(20,184,166,0.08)' },
      { id: 'r3', label: 'Guest Isolation', x: 610, y: 380, w: 200, h: 230, color: 'rgba(245,158,11,0.08)' },
    ],
    vlans: [
      { id: 'v1', name: 'CORP', label: 'Corporate Access', color: '#14b8a6', subnet: '10.80.20.0/24' },
      { id: 'v2', name: 'GUEST', label: 'Guest Isolation', color: '#f59e0b', subnet: '10.80.30.0/24' },
      { id: 'v3', name: 'APPS', label: 'Identity Services', color: '#22c55e', subnet: '10.80.40.0/24' },
      { id: 'v4', name: 'SEC', label: 'Physical Security', color: '#ef4444', subnet: '10.80.50.0/24' },
    ],
  };
}

function hospitalTopology(hint) {
  return {
    summary: `Hospital/clinical network for "${hint}". Segmented clinical WiFi, imaging, guest, and security zones.`,
    nodes: [
      { id: 'n1', type: 'cloud', label: 'Internet / HIS', x: 400, y: 40, ip: '0.0.0.0/0', vlan: null },
      { id: 'n2', type: 'firewall', label: 'Edge Firewall', x: 400, y: 140, ip: '172.16.0.1', vlan: null },
      { id: 'n3', type: 'router', label: 'Clinical Router', x: 400, y: 250, ip: '172.16.1.1', vlan: null },
      { id: 'n4', type: 'switch', label: 'Core Switch', x: 400, y: 360, ip: '172.16.2.1', vlan: null },
      // Ward A
      { id: 'n5', type: 'switch', label: 'Ward A Switch', x: 140, y: 490, ip: '172.16.10.1', vlan: 'CLINICAL' },
      { id: 'n6', type: 'ap', label: 'AP — Ward A', x: 80, y: 620, ip: '172.16.10.10', vlan: 'CLINICAL' },
      { id: 'n7', type: 'tablet', label: 'Nurse Tablet 1', x: 80, y: 750, ip: '172.16.10.50', vlan: 'CLINICAL' },
      { id: 'n8', type: 'laptop', label: 'Doctor Laptop', x: 200, y: 750, ip: '172.16.10.51', vlan: 'CLINICAL' },
      { id: 'n9', type: 'phone', label: 'VoIP — Station A', x: 200, y: 620, ip: '172.16.10.60', vlan: 'CLINICAL' },
      // Ward B / Imaging
      { id: 'n10', type: 'switch', label: 'Imaging Switch', x: 400, y: 490, ip: '172.16.20.1', vlan: 'PACS' },
      { id: 'n11', type: 'server', label: 'PACS Server', x: 340, y: 620, ip: '172.16.20.10', vlan: 'PACS' },
      { id: 'n12', type: 'nas', label: 'PACS NAS', x: 460, y: 620, ip: '172.16.20.11', vlan: 'PACS' },
      { id: 'n13', type: 'pc', label: 'Radiology WS', x: 400, y: 750, ip: '172.16.20.50', vlan: 'PACS' },
      // Security / Public
      { id: 'n14', type: 'switch', label: 'Public Switch', x: 660, y: 490, ip: '172.16.30.1', vlan: 'GUEST' },
      { id: 'n15', type: 'ap', label: 'AP — Lobby', x: 600, y: 620, ip: '172.16.30.10', vlan: 'GUEST' },
      { id: 'n16', type: 'camera', label: 'Hall Camera', x: 720, y: 620, ip: '172.16.40.5', vlan: 'SEC' },
      { id: 'n17', type: 'camera', label: 'Entrance Camera', x: 840, y: 620, ip: '172.16.40.6', vlan: 'SEC' },
      { id: 'n18', type: 'smarttv', label: 'Patient TV', x: 600, y: 750, ip: '172.16.30.90', vlan: 'GUEST' },
      { id: 'n19', type: 'laptop', label: 'Guest Laptop', x: 720, y: 750, ip: '172.16.30.50', vlan: 'GUEST' },
    ],
    links: [
      { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN' },
      { id: 'l2', source: 'n2', target: 'n3', type: 'fiber', label: '10Gbps' },
      { id: 'l3', source: 'n3', target: 'n4', type: 'fiber', label: '10Gbps' },
      { id: 'l4', source: 'n4', target: 'n5', type: 'fiber', label: '' },
      { id: 'l5', source: 'n4', target: 'n10', type: 'fiber', label: '' },
      { id: 'l6', source: 'n4', target: 'n14', type: 'fiber', label: '' },
      { id: 'l7', source: 'n5', target: 'n6', type: 'ethernet', label: 'PoE' },
      { id: 'l8', source: 'n5', target: 'n9', type: 'ethernet', label: 'PoE' },
      { id: 'l9', source: 'n6', target: 'n7', type: 'wifi', label: 'Clinical WiFi' },
      { id: 'l10', source: 'n6', target: 'n8', type: 'wifi', label: 'Clinical WiFi' },
      { id: 'l11', source: 'n10', target: 'n11', type: 'fiber', label: '10Gbps' },
      { id: 'l12', source: 'n10', target: 'n12', type: 'fiber', label: '10Gbps' },
      { id: 'l13', source: 'n10', target: 'n13', type: 'ethernet', label: '' },
      { id: 'l14', source: 'n14', target: 'n15', type: 'ethernet', label: 'PoE' },
      { id: 'l15', source: 'n14', target: 'n16', type: 'ethernet', label: 'PoE' },
      { id: 'l16', source: 'n14', target: 'n17', type: 'ethernet', label: 'PoE' },
      { id: 'l17', source: 'n15', target: 'n18', type: 'wifi', label: 'Guest WiFi' },
      { id: 'l18', source: 'n15', target: 'n19', type: 'wifi', label: 'Guest WiFi' },
    ],
    rooms: [
      { id: 'r1', label: 'Ward A — Clinical', x: 40, y: 450, w: 250, h: 350, color: 'rgba(59,130,246,0.08)' },
      { id: 'r2', label: 'Imaging / PACS', x: 300, y: 450, w: 220, h: 350, color: 'rgba(139,92,246,0.08)' },
      { id: 'r3', label: 'Public / Guest', x: 560, y: 450, w: 200, h: 350, color: 'rgba(245,158,11,0.08)' },
      { id: 'r4', label: 'Security Cameras', x: 690, y: 570, w: 210, h: 130, color: 'rgba(239,68,68,0.08)' },
    ],
    vlans: [
      { id: 'v1', name: 'CLINICAL', label: 'Clinical WiFi', color: '#3b82f6', subnet: '172.16.10.0/24' },
      { id: 'v2', name: 'PACS', label: 'Imaging / PACS', color: '#8b5cf6', subnet: '172.16.20.0/24' },
      { id: 'v3', name: 'GUEST', label: 'Patient / Guest', color: '#f59e0b', subnet: '172.16.30.0/24' },
      { id: 'v4', name: 'SEC', label: 'Physical Security', color: '#ef4444', subnet: '172.16.40.0/24' },
    ],
  };
}

function hotelTopology(hint) {
  return {
    summary: `Hotel/hospitality network for "${hint}". Guest WiFi isolation, PMS system, and back-of-house operations.`,
    nodes: [
      { id: 'n1', type: 'cloud', label: 'ISP / Internet', x: 400, y: 40, ip: '203.0.113.1', vlan: null },
      { id: 'n2', type: 'firewall', label: 'Edge Firewall', x: 400, y: 140, ip: '10.50.0.1', vlan: null },
      { id: 'n3', type: 'router', label: 'Core Router', x: 400, y: 250, ip: '10.50.0.2', vlan: null },
      { id: 'n4', type: 'switch', label: 'Core Switch', x: 400, y: 360, ip: '10.50.1.1', vlan: null },
      // Guest zone
      { id: 'n5', type: 'switch', label: 'Guest Switch', x: 140, y: 490, ip: '10.50.10.1', vlan: 'GUEST' },
      { id: 'n6', type: 'ap', label: 'AP — Lobby', x: 80, y: 620, ip: '10.50.10.10', vlan: 'GUEST' },
      { id: 'n7', type: 'ap', label: 'AP — Floor 2', x: 200, y: 620, ip: '10.50.10.11', vlan: 'GUEST' },
      { id: 'n8', type: 'laptop', label: 'Guest Laptop', x: 80, y: 750, ip: '10.50.10.50', vlan: 'GUEST' },
      { id: 'n9', type: 'smarttv', label: 'Room TV', x: 200, y: 750, ip: '10.50.10.90', vlan: 'GUEST' },
      // PMS / Admin
      { id: 'n10', type: 'switch', label: 'PMS Switch', x: 400, y: 490, ip: '10.50.20.1', vlan: 'PMS' },
      { id: 'n11', type: 'server', label: 'PMS Server', x: 340, y: 620, ip: '10.50.20.10', vlan: 'PMS' },
      { id: 'n12', type: 'pc', label: 'Front Desk PC', x: 460, y: 620, ip: '10.50.20.50', vlan: 'PMS' },
      { id: 'n13', type: 'printer', label: 'Receipt Printer', x: 400, y: 750, ip: '10.50.20.70', vlan: 'PMS' },
      // Back of house
      { id: 'n14', type: 'switch', label: 'BOH Switch', x: 660, y: 490, ip: '10.50.30.1', vlan: 'BOH' },
      { id: 'n15', type: 'camera', label: 'Lobby Camera', x: 600, y: 620, ip: '10.50.30.80', vlan: 'SEC' },
      { id: 'n16', type: 'camera', label: 'Parking Camera', x: 720, y: 620, ip: '10.50.30.81', vlan: 'SEC' },
      { id: 'n17', type: 'iot', label: 'HVAC Controller', x: 660, y: 750, ip: '10.50.30.90', vlan: 'BOH' },
      { id: 'n18', type: 'pdu', label: 'Server UPS', x: 780, y: 750, ip: '10.50.30.20', vlan: 'BOH' },
    ],
    links: [
      { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN' },
      { id: 'l2', source: 'n2', target: 'n3', type: 'fiber', label: '10Gbps' },
      { id: 'l3', source: 'n3', target: 'n4', type: 'fiber', label: '10Gbps' },
      { id: 'l4', source: 'n4', target: 'n5', type: 'fiber', label: '' },
      { id: 'l5', source: 'n4', target: 'n10', type: 'fiber', label: '' },
      { id: 'l6', source: 'n4', target: 'n14', type: 'fiber', label: '' },
      { id: 'l7', source: 'n5', target: 'n6', type: 'ethernet', label: 'PoE' },
      { id: 'l8', source: 'n5', target: 'n7', type: 'ethernet', label: 'PoE' },
      { id: 'l9', source: 'n6', target: 'n8', type: 'wifi', label: 'Guest WiFi' },
      { id: 'l10', source: 'n7', target: 'n9', type: 'wifi', label: 'Room WiFi' },
      { id: 'l11', source: 'n10', target: 'n11', type: 'ethernet', label: '1Gbps' },
      { id: 'l12', source: 'n10', target: 'n12', type: 'ethernet', label: '' },
      { id: 'l13', source: 'n10', target: 'n13', type: 'ethernet', label: '' },
      { id: 'l14', source: 'n14', target: 'n15', type: 'ethernet', label: 'PoE' },
      { id: 'l15', source: 'n14', target: 'n16', type: 'ethernet', label: 'PoE' },
      { id: 'l16', source: 'n14', target: 'n17', type: 'ethernet', label: '' },
      { id: 'l17', source: 'n14', target: 'n18', type: 'ethernet', label: 'MGMT' },
    ],
    rooms: [
      { id: 'r1', label: 'Guest WiFi Zone', x: 40, y: 450, w: 250, h: 350, color: 'rgba(245,158,11,0.08)' },
      { id: 'r2', label: 'PMS / Front Desk', x: 300, y: 450, w: 220, h: 350, color: 'rgba(59,130,246,0.08)' },
      { id: 'r3', label: 'Back of House', x: 560, y: 450, w: 270, h: 350, color: 'rgba(16,185,129,0.08)' },
    ],
    vlans: [
      { id: 'v1', name: 'GUEST', label: 'Guest WiFi', color: '#f59e0b', subnet: '10.50.10.0/24' },
      { id: 'v2', name: 'PMS', label: 'Property Management', color: '#3b82f6', subnet: '10.50.20.0/24' },
      { id: 'v3', name: 'BOH', label: 'Back of House', color: '#10b981', subnet: '10.50.30.0/24' },
      { id: 'v4', name: 'SEC', label: 'Security Cameras', color: '#ef4444', subnet: '10.50.30.0/25' },
    ],
  };
}
