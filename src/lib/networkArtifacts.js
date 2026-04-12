import { DEVICE_TYPES, LINK_TYPES } from './topologyData';
import { mergeRoomDefaults } from './smartNetworkEngine';

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

function getDegreeMap(nodes, links) {
  const degree = Object.fromEntries(nodes.map(node => [node.id, 0]));
  links.forEach(link => {
    if (degree[link.source] !== undefined) degree[link.source] += 1;
    if (degree[link.target] !== undefined) degree[link.target] += 1;
  });
  return degree;
}

function findConnectedComponents(nodes, links) {
  const adj = new Map(nodes.map(n => [n.id, []]));
  links.forEach(link => {
    if (adj.has(link.source)) adj.get(link.source).push(link.target);
    if (adj.has(link.target)) adj.get(link.target).push(link.source);
  });
  const visited = new Set();
  let components = 0;
  nodes.forEach(node => {
    if (visited.has(node.id)) return;
    components++;
    const stack = [node.id];
    while (stack.length) {
      const id = stack.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      (adj.get(id) || []).forEach(next => { if (!visited.has(next)) stack.push(next); });
    }
  });
  return components;
}

function findSinglePointsOfFailure(nodes, links) {
  const degree = getDegreeMap(nodes, links);
  const critical = [];
  const infraTypes = new Set(['router', 'switch', 'firewall', 'loadbalancer']);

  nodes.forEach(node => {
    if (!infraTypes.has(node.type)) return;
    const connections = degree[node.id] || 0;
    if (connections < 2) return;

    // Check if removing this node would split the graph
    const remainingNodes = nodes.filter(n => n.id !== node.id);
    const remainingLinks = links.filter(l => l.source !== node.id && l.target !== node.id);
    if (remainingNodes.length === 0) return;

    const components = findConnectedComponents(remainingNodes, remainingLinks);
    if (components > 1) {
      critical.push(node);
    }
  });

  return critical;
}

export function createTopologyPayload({ nodes, links, rooms, vlans, prompt = '', barriers = [], vlanZones = [], powerZones = [] }) {
  return {
    version: 1,
    prompt,
    nodes,
    links,
    rooms,
    vlans,
    barriers,
    vlanZones,
    powerZones,
    exportedAt: new Date().toISOString(),
  };
}

export function validateTopology({ nodes, links, vlans }) {
  const findings = [];
  const nodeMap = byId(nodes);
  const typeCounts = countBy(nodes, node => node.type);
  const usedIps = new Map();
  const usedVlanNames = new Set();

  // IP validation
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

  // VLAN validation
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
        detail: `${vlan.name} has no router, firewall, or load balancer assigned.`,
      });
    }
  });

  // Undefined VLAN references
  usedVlanNames.forEach(vlanName => {
    if (!vlans.some(vlan => vlan.name === vlanName)) {
      findings.push({
        severity: 'medium',
        title: 'Undefined VLAN reference',
        detail: `${vlanName} is assigned to devices but not defined in VLAN manager.`,
      });
    }
  });

  // Broken link references
  links.forEach(link => {
    if (!nodeMap[link.source] || !nodeMap[link.target]) {
      findings.push({
        severity: 'high',
        title: 'Broken link reference',
        detail: `${link.label || link.id} points to a missing device.`,
      });
    }
  });

  // Disconnected devices
  const degree = getDegreeMap(nodes, links);
  const disconnected = nodes.filter(node => degree[node.id] === 0);
  if (disconnected.length) {
    findings.push({
      severity: disconnected.length > 2 ? 'high' : 'medium',
      title: 'Disconnected devices',
      detail: `${disconnected.map(node => node.label || node.id).slice(0, 5).join(', ')} ${disconnected.length > 5 ? 'and more ' : ''}not linked.`,
    });
  }

  // No firewall
  if (nodes.length > 2 && !typeCounts.firewall) {
    findings.push({
      severity: 'medium',
      title: 'No firewall at the edge',
      detail: 'Add a firewall between WAN/Internet and internal switching.',
    });
  }

  // No fiber in larger designs
  if (nodes.length > 8 && !links.some(link => link.type === 'fiber')) {
    findings.push({
      severity: 'low',
      title: 'No high-capacity uplinks',
      detail: 'Use fiber for core, distribution, or rack uplinks in larger designs.',
    });
  }

  // No segmentation
  if (nodes.length > 5 && vlans.length === 0) {
    findings.push({
      severity: 'medium',
      title: 'No segmentation plan',
      detail: 'Define VLANs for users, guests, servers, voice, IoT, or security devices.',
    });
  }

  // Single points of failure (redundancy check)
  if (nodes.length > 3) {
    const spof = findSinglePointsOfFailure(nodes, links);
    if (spof.length > 0) {
      findings.push({
        severity: 'medium',
        title: 'Single point of failure',
        detail: `${spof.map(n => n.label || n.id).slice(0, 3).join(', ')} — removing any of these splits the network.`,
      });
    }
  }

  // Isolated network islands
  if (nodes.length > 1) {
    const validLinks = links.filter(l => nodeMap[l.source] && nodeMap[l.target]);
    const components = findConnectedComponents(nodes, validLinks);
    if (components > 1) {
      findings.push({
        severity: 'high',
        title: 'Network islands detected',
        detail: `${components} separate groups of devices exist with no connections between them.`,
      });
    }
  }

  // Cloud/ISP without firewall
  if (typeCounts.cloud && !typeCounts.firewall && nodes.length > 2) {
    findings.push({
      severity: 'high',
      title: 'Unprotected WAN edge',
      detail: 'Cloud/ISP connection exists without a firewall — traffic is unfiltered.',
    });
  }

  // Wireless without segmentation
  if (typeCounts.ap && vlans.length === 0 && nodes.length > 4) {
    findings.push({
      severity: 'medium',
      title: 'Unsegmented wireless',
      detail: 'Access points exist without VLAN segmentation — guest and corporate traffic mix.',
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

export function generateDesignBrief(payload, smartSnapshot = null) {
  const validation = validateTopology(payload);
  const nodeMap = byId(payload.nodes);

  const bom = {};
  payload.nodes.forEach((n) => {
    const k = n.type || 'unknown';
    bom[k] = (bom[k] || 0) + 1;
  });
  const topIssues = smartSnapshot?.findings?.slice(0, 5).map((f) => `- ${f.severity}: ${f.title} — ${f.detail}`) || [];
  const topFixes = smartSnapshot?.findings?.flatMap((f) => f.suggestions || []).slice(0, 5) || [];
  const vlanTransportFindings = (smartSnapshot?.findings || []).filter(
    (f) => f.title === 'VLAN missing on trunk' || f.title === 'AP VLAN support mismatch',
  );

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
    `- Barriers: ${(payload.barriers || []).length}`,
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
    '## Zones (rooms)',
    ...(payload.rooms.length
      ? payload.rooms.map((room) => {
          const z = mergeRoomDefaults(room);
          return `- ${room.label || room.id}: floor ${z.floor}, zone ${z.zoneType}, security ${z.securityLevel}`;
        })
      : ['- No rooms defined.']),
    '',
    '## Validation',
    `Score: ${validation.score}/100`,
    ...(validation.findings.length
      ? validation.findings.map(item => `- ${item.severity.toUpperCase()}: ${item.title} - ${item.detail}`)
      : ['- No major design issues found.']),
    '',
    ...(smartSnapshot
      ? [
          '## Smart engine scores',
          `- Coverage: ${Math.round(smartSnapshot.overallScores?.coverage ?? 0)}`,
          `- Capacity: ${Math.round(smartSnapshot.overallScores?.capacity ?? 0)}`,
          `- Security: ${Math.round(smartSnapshot.overallScores?.security ?? 0)}`,
          `- Resilience: ${Math.round(smartSnapshot.overallScores?.resilience ?? 0)}`,
          `- Power: ${Math.round(smartSnapshot.overallScores?.power ?? 0)}`,
          `- Overall: ${smartSnapshot.overallScore ?? validation.score}`,
          '',
          '## Top smart findings',
          ...(topIssues.length ? topIssues : ['- None']),
          '',
          '## Top recommendations',
          ...(topFixes.length ? topFixes.map((t) => `- ${t}`) : ['- Review findings panel for next steps.']),
          '',
          '## VLAN transport (engine)',
          ...(vlanTransportFindings.length
            ? vlanTransportFindings.slice(0, 12).map((f) => `- ${f.severity}: ${f.title} — ${f.detail}`)
            : ['- No trunk or AP supported-VLAN mismatches flagged.']),
          '- Hint: In Properties, use comma lists on links (Trunk VLANs) and on APs/routers (Supported VLANs); names must match the VLAN picker.',
          '- Multi-floor RF: when the AP center and the client (or heatmap cell) both lie inside rooms, different room floor numbers add extra attenuation in Wi-Fi scoring and the signal heatmap.',
          '',
        ]
      : []),
    '## Bill of materials (counts)',
    ...Object.entries(bom).map(([t, c]) => `- ${t}: ${c}`),
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

  lines.push('!');
  lines.push('! Zones / floors');
  (payload.rooms || []).forEach((room) => {
    const z = mergeRoomDefaults(room);
    lines.push(
      `! zone "${room.label || room.id}" | floor ${z.floor} | type ${z.zoneType} | security ${z.securityLevel}`,
    );
  });

  lines.push('!');
  lines.push('! Device intent');
  payload.nodes.forEach(node => {
    const type = DEVICE_TYPES[node.type]?.label || node.type;
    const sup = node.supportedVlans?.trim();
    lines.push(
      `! ${node.label || node.id} | ${type} | ${node.ip || 'no-ip'} | ${node.vlan || 'no-vlan'}${sup ? ` | supported-vlans: ${sup}` : ''}`,
    );
  });

  lines.push('!');
  lines.push('! Link intent');
  const nodeMap = byId(payload.nodes);
  payload.links.forEach(link => {
    const src = nodeMap[link.source]?.label || link.source;
    const dst = nodeMap[link.target]?.label || link.target;
    const type = LINK_TYPES[link.type]?.label || link.type;
    const trunk = link.trunkVlans?.trim();
    lines.push(
      `! connect "${src}" to "${dst}" using ${type}${link.label ? ` (${link.label})` : ''}${trunk ? ` | trunk-vlans: ${trunk}` : ''}`,
    );
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
