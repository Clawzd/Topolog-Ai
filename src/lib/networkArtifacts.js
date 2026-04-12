import { DEVICE_TYPES, LINK_TYPES } from './topologyData';

const IPV4_CIDR = /^(\d{1,3}\.){3}\d{1,3}\/([0-9]|[12][0-9]|3[0-2])$/;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

function byId(items) {
  return Object.fromEntries(items.map(item => [item.id, item]));
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function isValidIp(value) {
  if (!value) return true;
  if (!IPV4.test(value)) return false;
  return value.split('.').every(part => Number(part) >= 0 && Number(part) <= 255);
}

function isValidCidr(value) {
  if (!value) return true;
  if (!IPV4_CIDR.test(value)) return false;
  const [ip] = value.split('/');
  return isValidIp(ip);
}

function firstGatewayForVlan(nodes, vlanName) {
  return nodes.find(node => node.vlan === vlanName && ['router', 'firewall', 'loadbalancer'].includes(node.type));
}

export function createTopologyPayload({ nodes, links, rooms, vlans, prompt = '' }) {
  return {
    version: 1,
    prompt,
    nodes,
    links,
    rooms,
    vlans,
    exportedAt: new Date().toISOString(),
  };
}

export function validateTopology({ nodes, links, vlans }) {
  const findings = [];
  const nodeMap = byId(nodes);
  const typeCounts = countBy(nodes, node => node.type);
  const usedIps = new Map();
  const usedVlanNames = new Set();

  nodes.forEach(node => {
    if (!isValidIp(node.ip)) {
      findings.push({
        severity: 'high',
        title: 'Invalid IP address',
        detail: `${node.label || node.id} has an invalid address: ${node.ip}`,
      });
    }
    if (node.ip) {
      const existing = usedIps.get(node.ip);
      if (existing) {
        findings.push({
          severity: 'high',
          title: 'Duplicate IP address',
          detail: `${node.label || node.id} and ${existing.label || existing.id} both use ${node.ip}.`,
        });
      }
      usedIps.set(node.ip, node);
    }
    if (node.vlan) usedVlanNames.add(node.vlan);
  });

  vlans.forEach(vlan => {
    if (!isValidCidr(vlan.subnet)) {
      findings.push({
        severity: 'high',
        title: 'Invalid VLAN subnet',
        detail: `${vlan.name} uses an invalid CIDR: ${vlan.subnet || 'empty'}.`,
      });
    }
    if (!firstGatewayForVlan(nodes, vlan.name)) {
      findings.push({
        severity: 'medium',
        title: 'Missing VLAN gateway',
        detail: `${vlan.name} has no router, firewall, or load balancer assigned to it.`,
      });
    }
  });

  usedVlanNames.forEach(vlanName => {
    if (!vlans.some(vlan => vlan.name === vlanName)) {
      findings.push({
        severity: 'medium',
        title: 'Undefined VLAN reference',
        detail: `${vlanName} is assigned to devices but is not defined in the VLAN manager.`,
      });
    }
  });

  links.forEach(link => {
    if (!nodeMap[link.source] || !nodeMap[link.target]) {
      findings.push({
        severity: 'high',
        title: 'Broken link reference',
        detail: `${link.label || link.id} points to a missing device.`,
      });
    }
  });

  const degree = Object.fromEntries(nodes.map(node => [node.id, 0]));
  links.forEach(link => {
    if (degree[link.source] !== undefined) degree[link.source] += 1;
    if (degree[link.target] !== undefined) degree[link.target] += 1;
  });
  const disconnected = nodes.filter(node => degree[node.id] === 0);
  if (disconnected.length) {
    findings.push({
      severity: disconnected.length > 2 ? 'high' : 'medium',
      title: 'Disconnected devices',
      detail: `${disconnected.map(node => node.label || node.id).slice(0, 5).join(', ')} ${disconnected.length > 5 ? 'and more ' : ''}are not linked.`,
    });
  }

  if (nodes.length > 2 && !typeCounts.firewall) {
    findings.push({
      severity: 'medium',
      title: 'No firewall at the edge',
      detail: 'Add a firewall between WAN/Internet and internal switching.',
    });
  }

  if (nodes.length > 8 && !links.some(link => link.type === 'fiber')) {
    findings.push({
      severity: 'low',
      title: 'No high-capacity uplinks',
      detail: 'Use fiber for core, distribution, or rack uplinks in larger designs.',
    });
  }

  if (nodes.length > 5 && vlans.length === 0) {
    findings.push({
      severity: 'medium',
      title: 'No segmentation plan',
      detail: 'Define VLANs for users, guests, servers, voice, IoT, or security devices.',
    });
  }

  const severityCost = { high: 18, medium: 10, low: 4 };
  const score = Math.max(0, findings.reduce((current, item) => current - severityCost[item.severity], 100));

  return {
    score,
    findings,
    summary: findings.length
      ? `${findings.length} design finding${findings.length > 1 ? 's' : ''} need review.`
      : 'No major design issues found.',
  };
}

export function generateDesignBrief(payload) {
  const validation = validateTopology(payload);
  const nodeMap = byId(payload.nodes);

  const lines = [
    '# TopologAi Design Brief',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    payload.prompt ? `Brief: ${payload.prompt}` : '',
    '',
    '## Inventory',
    `- Devices: ${payload.nodes.length}`,
    `- Links: ${payload.links.length}`,
    `- Rooms/Zones: ${payload.rooms.length}`,
    `- VLANs: ${payload.vlans.length}`,
    '',
    '## VLAN Plan',
    ...(payload.vlans.length
      ? payload.vlans.map(vlan => `- ${vlan.name}: ${vlan.label || 'Unlabeled'} (${vlan.subnet || 'no subnet'})`)
      : ['- No VLANs defined.']),
    '',
    '## Device List',
    ...payload.nodes.map(node => {
      const type = DEVICE_TYPES[node.type]?.label || node.type;
      return `- ${node.label || node.id}: ${type}, ${node.ip || 'no IP'}, ${node.vlan || 'no VLAN'}`;
    }),
    '',
    '## Link Plan',
    ...(payload.links.length
      ? payload.links.map(link => {
        const src = nodeMap[link.source]?.label || link.source;
        const dst = nodeMap[link.target]?.label || link.target;
        const type = LINK_TYPES[link.type]?.label || link.type;
        return `- ${src} to ${dst}: ${type}${link.label ? `, ${link.label}` : ''}`;
      })
      : ['- No links defined.']),
    '',
    '## Validation',
    `Score: ${validation.score}/100`,
    ...(validation.findings.length
      ? validation.findings.map(item => `- ${item.severity.toUpperCase()}: ${item.title} - ${item.detail}`)
      : ['- No major design issues found.']),
    '',
  ].filter(line => line !== '');

  return `${lines.join('\n')}\n`;
}

export function generateConfigBundle(payload) {
  const lines = [
    '! TopologAi vendor-neutral configuration draft',
    `! Generated ${new Date().toLocaleString()}`,
    '!',
    '! VLANs',
  ];

  payload.vlans.forEach((vlan, index) => {
    const vlanNumber = vlan.name.match(/\d+/)?.[0] || String(index + 10);
    lines.push(`vlan ${vlanNumber}`);
    lines.push(` name ${vlan.label || vlan.name}`);
    if (vlan.subnet) lines.push(` ! subnet ${vlan.subnet}`);
    lines.push('!');
  });

  lines.push('! Device intent');
  payload.nodes.forEach(node => {
    const type = DEVICE_TYPES[node.type]?.label || node.type;
    lines.push(`! ${node.label || node.id} | ${type} | ${node.ip || 'no-ip'} | ${node.vlan || 'no-vlan'}`);
  });

  lines.push('!');
  lines.push('! Link intent');
  const nodeMap = byId(payload.nodes);
  payload.links.forEach(link => {
    const src = nodeMap[link.source]?.label || link.source;
    const dst = nodeMap[link.target]?.label || link.target;
    const type = LINK_TYPES[link.type]?.label || link.type;
    lines.push(`! connect "${src}" to "${dst}" using ${type}${link.label ? ` (${link.label})` : ''}`);
  });

  lines.push('!');
  lines.push('! Security baseline');
  lines.push('! deny guest-to-corporate by default');
  lines.push('! permit management only from trusted admin VLANs');
  lines.push('! log denied traffic at the edge firewall');
  lines.push('');

  return lines.join('\n');
}

export function encodeShareState(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export function decodeShareState(encoded) {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
