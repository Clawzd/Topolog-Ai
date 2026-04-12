import { MOCK_AI_RESPONSES } from './topologyData';

const SCENARIO_HINTS = [
  {
    match: ['warehouse', 'iot', 'camera', 'sensor', 'industrial'],
    note: 'The canvas is optimized for operations, cameras, and IoT isolation.',
  },
  {
    match: ['campus', 'school', 'university', 'library'],
    note: 'The canvas is optimized for multi-building segmentation.',
  },
  {
    match: ['data center', 'datacenter', 'server', 'rack'],
    note: 'The canvas is optimized for resilient core and server tiers.',
  },
  {
    match: ['retail', 'store', 'pos', 'payment'],
    note: 'The canvas is optimized for POS, guest WiFi, and security zones.',
  },
  {
    match: ['home', 'house', 'apartment', 'villa'],
    note: 'The canvas is optimized for WiFi coverage and shared services.',
  },
];

function getScenarioNote(prompt) {
  const lower = prompt.toLowerCase();
  return SCENARIO_HINTS.find(({ match }) => match.some(word => lower.includes(word)))?.note
    || 'The canvas is optimized for an editable office-grade topology.';
}

export function generatePromptTopology(userPrompt) {
  const hint = (userPrompt || 'office network').trim().slice(0, 120);
  const lower = hint.toLowerCase();
  if (['warehouse', 'iot', 'sensor', 'industrial'].some(word => lower.includes(word))) {
    return smartWarehouseTopology(hint);
  }
  if (['zero trust', 'branch', 'sd-wan', 'sdwan'].some(word => lower.includes(word))) {
    return zeroTrustBranchTopology(hint);
  }

  const topology = MOCK_AI_RESPONSES.default(hint);

  return {
    ...topology,
    summary: `${topology.summary} ${getScenarioNote(hint)}`,
  };
}

function smartWarehouseTopology(hint) {
  return {
    summary: `Smart warehouse network for "${hint}". The canvas separates operations, security, IoT, and guest wireless paths.`,
    nodes: [
      { id: 'n1', type: 'cloud', label: 'ISP / WAN', x: 420, y: 40, ip: '203.0.113.10', vlan: null },
      { id: 'n2', type: 'firewall', label: 'Edge Firewall', x: 420, y: 150, ip: '10.44.0.1', vlan: null },
      { id: 'n3', type: 'router', label: 'Core Router', x: 420, y: 260, ip: '10.44.0.2', vlan: null },
      { id: 'n4', type: 'switch', label: 'Core Switch', x: 420, y: 380, ip: '10.44.1.2', vlan: 'OPS' },
      { id: 'n5', type: 'switch', label: 'Dock Switch', x: 190, y: 510, ip: '10.44.10.2', vlan: 'OPS' },
      { id: 'n6', type: 'switch', label: 'Security Switch', x: 420, y: 510, ip: '10.44.30.2', vlan: 'SEC' },
      { id: 'n7', type: 'ap', label: 'Warehouse AP', x: 650, y: 510, ip: '10.44.20.2', vlan: 'IOT' },
      { id: 'n8', type: 'server', label: 'WMS Server', x: 150, y: 650, ip: '10.44.40.10', vlan: 'SRV' },
      { id: 'n9', type: 'iot', label: 'IoT Gateway', x: 300, y: 650, ip: '10.44.20.10', vlan: 'IOT' },
      { id: 'n10', type: 'camera', label: 'Camera Row A', x: 420, y: 650, ip: '10.44.30.11', vlan: 'SEC' },
      { id: 'n11', type: 'camera', label: 'Camera Dock', x: 540, y: 650, ip: '10.44.30.12', vlan: 'SEC' },
      { id: 'n12', type: 'tablet', label: 'Scanner Fleet', x: 690, y: 650, ip: '10.44.20.50', vlan: 'IOT' },
    ],
    links: [
      { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN' },
      { id: 'l2', source: 'n2', target: 'n3', type: 'fiber', label: '10Gbps' },
      { id: 'l3', source: 'n3', target: 'n4', type: 'fiber', label: '10Gbps' },
      { id: 'l4', source: 'n4', target: 'n5', type: 'fiber', label: 'Dock uplink' },
      { id: 'l5', source: 'n4', target: 'n6', type: 'fiber', label: 'Security uplink' },
      { id: 'l6', source: 'n4', target: 'n7', type: 'ethernet', label: 'PoE' },
      { id: 'l7', source: 'n5', target: 'n8', type: 'ethernet', label: '' },
      { id: 'l8', source: 'n5', target: 'n9', type: 'ethernet', label: '' },
      { id: 'l9', source: 'n6', target: 'n10', type: 'ethernet', label: 'PoE' },
      { id: 'l10', source: 'n6', target: 'n11', type: 'ethernet', label: 'PoE' },
      { id: 'l11', source: 'n7', target: 'n12', type: 'wifi', label: 'WiFi' },
    ],
    rooms: [
      { id: 'r1', label: 'Dock Operations', x: 120, y: 470, w: 250, h: 230, color: 'rgba(20,184,166,0.08)' },
      { id: 'r2', label: 'Security Coverage', x: 390, y: 470, w: 210, h: 230, color: 'rgba(244,63,94,0.08)' },
      { id: 'r3', label: 'Wireless Floor', x: 620, y: 470, w: 180, h: 230, color: 'rgba(245,158,11,0.08)' },
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
    summary: `Zero-trust branch network for "${hint}". The canvas highlights identity, guest isolation, and a protected service tier.`,
    nodes: [
      { id: 'n1', type: 'cloud', label: 'Internet', x: 420, y: 40, ip: '0.0.0.0/0', vlan: null },
      { id: 'n2', type: 'router', label: 'SD-WAN Edge', x: 300, y: 160, ip: '198.51.100.2', vlan: null },
      { id: 'n3', type: 'firewall', label: 'Policy Firewall', x: 540, y: 160, ip: '10.80.0.1', vlan: null },
      { id: 'n4', type: 'switch', label: 'Secure Core', x: 420, y: 300, ip: '10.80.1.2', vlan: 'CORP' },
      { id: 'n5', type: 'loadbalancer', label: 'App Gateway', x: 210, y: 430, ip: '10.80.40.10', vlan: 'APPS' },
      { id: 'n6', type: 'ap', label: 'Corp WiFi AP', x: 420, y: 430, ip: '10.80.20.2', vlan: 'CORP' },
      { id: 'n7', type: 'ap', label: 'Guest WiFi AP', x: 640, y: 430, ip: '10.80.30.2', vlan: 'GUEST' },
      { id: 'n8', type: 'server', label: 'Identity Proxy', x: 150, y: 570, ip: '10.80.40.11', vlan: 'APPS' },
      { id: 'n9', type: 'laptop', label: 'Managed Laptop', x: 360, y: 570, ip: '10.80.20.50', vlan: 'CORP' },
      { id: 'n10', type: 'phone', label: 'VoIP Phone', x: 480, y: 570, ip: '10.80.20.60', vlan: 'CORP' },
      { id: 'n11', type: 'tablet', label: 'Guest Device', x: 650, y: 570, ip: '10.80.30.50', vlan: 'GUEST' },
    ],
    links: [
      { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN A' },
      { id: 'l2', source: 'n1', target: 'n3', type: 'vpn', label: 'Policy tunnel' },
      { id: 'l3', source: 'n2', target: 'n4', type: 'fiber', label: 'Primary' },
      { id: 'l4', source: 'n3', target: 'n4', type: 'fiber', label: 'Inspected' },
      { id: 'l5', source: 'n4', target: 'n5', type: 'ethernet', label: '' },
      { id: 'l6', source: 'n4', target: 'n6', type: 'ethernet', label: 'PoE' },
      { id: 'l7', source: 'n4', target: 'n7', type: 'ethernet', label: 'PoE' },
      { id: 'l8', source: 'n5', target: 'n8', type: 'ethernet', label: 'App path' },
      { id: 'l9', source: 'n6', target: 'n9', type: 'wifi', label: 'Corp SSID' },
      { id: 'l10', source: 'n6', target: 'n10', type: 'wifi', label: 'Voice SSID' },
      { id: 'l11', source: 'n7', target: 'n11', type: 'wifi', label: 'Guest SSID' },
    ],
    rooms: [
      { id: 'r1', label: 'Identity Zone', x: 120, y: 390, w: 200, h: 220, color: 'rgba(34,197,94,0.08)' },
      { id: 'r2', label: 'Corporate Access', x: 350, y: 390, w: 210, h: 220, color: 'rgba(20,184,166,0.08)' },
      { id: 'r3', label: 'Guest Isolation', x: 610, y: 390, w: 170, h: 220, color: 'rgba(245,158,11,0.08)' },
    ],
    vlans: [
      { id: 'v1', name: 'CORP', label: 'Corporate Access', color: '#14b8a6', subnet: '10.80.20.0/24' },
      { id: 'v2', name: 'GUEST', label: 'Guest Isolation', color: '#f59e0b', subnet: '10.80.30.0/24' },
      { id: 'v3', name: 'APPS', label: 'Identity Services', color: '#22c55e', subnet: '10.80.40.0/24' },
    ],
  };
}
