const DEVICE_TYPE_ALIASES = {
  router: ['router', 'routers'],
  switch: ['switch', 'switches'],
  ap: ['ap', 'aps', 'access point', 'access points', 'wifi ap', 'wireless ap'],
  server: ['server', 'servers'],
  firewall: ['firewall', 'firewalls'],
  cloud: ['cloud', 'isp', 'internet'],
  pc: ['pc', 'pcs', 'desktop', 'desktops', 'workstation', 'workstations', 'computer', 'computers'],
  laptop: ['laptop', 'laptops', 'notebook', 'notebooks'],
  printer: ['printer', 'printers'],
  camera: ['camera', 'cameras'],
  nas: ['nas', 'storage'],
  phone: ['phone', 'phones', 'voip', 'voip phone', 'voip phones'],
  loadbalancer: ['load balancer', 'loadbalancer', 'load balancers', 'loadbalancers'],
  tablet: ['tablet', 'tablets', 'ipad', 'ipads'],
  iot: ['iot', 'sensor', 'sensors', 'iot device', 'iot devices'],
  pdu: ['pdu', 'pdus'],
  patchpanel: ['patch panel', 'patch panels', 'patchpanel', 'patchpanels'],
  smarttv: ['smart tv', 'smarttv', 'smart tvs', 'smarttvs', 'display', 'displays'],
};

const WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const TOTAL_COUNT_NOUNS = [
  'device',
  'devices',
  'node',
  'nodes',
  'endpoint',
  'endpoints',
  'host',
  'hosts',
  'client',
  'clients',
];

const INFRA_PRIORITY = new Set(['cloud', 'router', 'firewall', 'switch', 'loadbalancer', 'pdu', 'patchpanel']);

function escapeRegex(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCountToken(token) {
  if (!token) return null;
  if (/^\d+$/.test(token)) return Number(token);
  return WORD_NUMBERS[token] ?? null;
}

function collectTypeCounts(text) {
  const perType = {};
  for (const [type, aliases] of Object.entries(DEVICE_TYPE_ALIASES)) {
    for (const alias of aliases) {
      const re = new RegExp(`\\b(\\d+|${Object.keys(WORD_NUMBERS).join('|')})\\s+${escapeRegex(alias)}\\b`, 'gi');
      let m = re.exec(text);
      while (m) {
        const count = parseCountToken(m[1]?.toLowerCase());
        if (Number.isFinite(count) && count > 0) {
          perType[type] = Math.max(perType[type] || 0, count);
        }
        m = re.exec(text);
      }
    }
  }
  return perType;
}

function parseTotalCount(text) {
  const nouns = TOTAL_COUNT_NOUNS.join('|');
  const re = new RegExp(`\\b(\\d+|${Object.keys(WORD_NUMBERS).join('|')})\\s+(${nouns})\\b`, 'i');
  const m = text.match(re);
  if (!m) return null;
  const count = parseCountToken(m[1]?.toLowerCase());
  return Number.isFinite(count) && count > 0 ? count : null;
}

export function parseRequestedCountSpec(promptText) {
  const text = String(promptText || '').toLowerCase();
  const perType = collectTypeCounts(text);
  const totalCount = parseTotalCount(text);
  const hasExplicitCount = Number.isFinite(totalCount) || Object.keys(perType).length > 0;
  const flexible = /\b(at least|minimum|min\.?|about|around|approximately|approx|roughly|up to|max(?:imum)?)\b/.test(text);
  return {
    hasExplicitCount,
    strictExact: hasExplicitCount && !flexible,
    totalCount,
    perType,
  };
}

function nodeRemovalRank(node, index) {
  const type = String(node?.type || '');
  const infraPenalty = INFRA_PRIORITY.has(type) ? 1000 : 0;
  const endpointBias = ['pc', 'laptop', 'tablet', 'phone', 'printer', 'camera', 'iot'].includes(type) ? 0 : 100;
  return infraPenalty + endpointBias + index;
}

function topologyBounds(nodes) {
  if (!nodes.length) return { minX: 120, minY: 120, maxX: 420, maxY: 340, cx: 270, cy: 230 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x ?? 0);
    minY = Math.min(minY, n.y ?? 0);
    maxX = Math.max(maxX, (n.x ?? 0) + 90);
    maxY = Math.max(maxY, (n.y ?? 0) + 56);
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function nextNodePlacement(nodes, index) {
  const b = topologyBounds(nodes);
  const col = index % 5;
  const row = Math.floor(index / 5);
  return {
    x: Math.round(b.cx - 240 + col * 120),
    y: Math.round(b.maxY + 80 + row * 96),
  };
}

function sanitizeLinks(links, nodeIds, barrierIds = new Set()) {
  return (links || []).filter((link) => {
    const sourceOk = nodeIds.has(link.source) || barrierIds.has(link.source);
    const targetOk = nodeIds.has(link.target) || barrierIds.has(link.target);
    return sourceOk && targetOk;
  });
}

function autoId(prefix, seq) {
  return `${prefix}_${Date.now()}_${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

export function enforceRequestedCounts(topology, spec, promptText = '') {
  if (!spec?.strictExact || !spec.hasExplicitCount) return topology;

  let nodes = [...(topology.nodes || [])];
  const links = [...(topology.links || [])];
  const barriers = [...(topology.barriers || [])];
  const barrierIds = new Set(barriers.map((b) => b.id));

  const removeNodeIds = new Set();
  const addNodes = [];

  const byType = (type) => nodes.filter((n) => n.type === type && !removeNodeIds.has(n.id));

  for (const [type, target] of Object.entries(spec.perType || {})) {
    const candidates = byType(type);
    if (candidates.length > target) {
      const extras = [...candidates]
        .map((n, i) => ({ n, rank: nodeRemovalRank(n, i) }))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, candidates.length - target);
      extras.forEach(({ n }) => removeNodeIds.add(n.id));
    } else if (candidates.length < target) {
      const missing = target - candidates.length;
      for (let i = 0; i < missing; i += 1) {
        const pos = nextNodePlacement(nodes.concat(addNodes), i);
        addNodes.push({
          id: autoId('n', i),
          type,
          label: `${type.charAt(0).toUpperCase()}${type.slice(1)} ${candidates.length + i + 1}`,
          x: pos.x,
          y: pos.y,
          ip: '',
          vlan: null,
        });
      }
    }
  }

  nodes = nodes.filter((n) => !removeNodeIds.has(n.id)).concat(addNodes);

  if (Number.isFinite(spec.totalCount)) {
    if (nodes.length > spec.totalCount) {
      const removable = nodes
        .map((n, i) => ({ n, rank: nodeRemovalRank(n, i) }))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, nodes.length - spec.totalCount);
      const extraIds = new Set(removable.map(({ n }) => n.id));
      nodes = nodes.filter((n) => !extraIds.has(n.id));
    } else if (nodes.length < spec.totalCount) {
      const fallbackType = Object.keys(spec.perType || {})[0] || 'pc';
      const missing = spec.totalCount - nodes.length;
      const start = nodes.length;
      for (let i = 0; i < missing; i += 1) {
        const pos = nextNodePlacement(nodes, i);
        nodes.push({
          id: autoId('n', start + i),
          type: fallbackType,
          label: `${fallbackType.charAt(0).toUpperCase()}${fallbackType.slice(1)} ${start + i + 1}`,
          x: pos.x,
          y: pos.y,
          ip: '',
          vlan: null,
        });
      }
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const cleanLinks = sanitizeLinks(links, nodeIds, barrierIds);

  const text = String(promptText || '').trim();
  const countText = Number.isFinite(spec.totalCount) ? `${spec.totalCount}` : 'requested';
  const summarySuffix = text ? ` Count enforced from prompt "${text.slice(0, 80)}".` : '';

  return {
    ...topology,
    nodes,
    links: cleanLinks,
    summary: `${topology.summary || 'Generated topology.'} Device count normalized to ${countText}.${summarySuffix}`,
  };
}

export function enforceEditAddOperationsCount(editResponse, promptText, mapState = {}) {
  const spec = parseRequestedCountSpec(promptText);
  if (!spec.strictExact || !spec.hasExplicitCount || !Number.isFinite(spec.totalCount)) return editResponse;
  const text = String(promptText || '').toLowerCase();
  if (!/\b(add|create|insert|place|put)\b/.test(text)) return editResponse;

  const operations = Array.isArray(editResponse?.operations) ? [...editResponse.operations] : [];
  const addNodeOps = operations.filter((op) => op?.op === 'add_node');
  if (!addNodeOps.length) return editResponse;

  const targetAdds = spec.totalCount;
  if (addNodeOps.length > targetAdds) {
    let keep = targetAdds;
    const trimmed = [];
    for (const op of operations) {
      if (op?.op === 'add_node') {
        if (keep > 0) {
          trimmed.push(op);
          keep -= 1;
        }
        continue;
      }
      if (op?.op === 'add_link' && op.link?.source?.startsWith('new_') && keep <= 0) continue;
      trimmed.push(op);
    }
    return { ...editResponse, operations: trimmed };
  }

  if (addNodeOps.length < targetAdds) {
    const extra = [];
    const baseX = ((mapState.nodes || []).reduce((m, n) => Math.max(m, (n.x || 0) + 90), 180)) + 80;
    const baseY = ((mapState.nodes || []).reduce((m, n) => Math.max(m, (n.y || 0) + 56), 120)) - 160;
    for (let i = addNodeOps.length; i < targetAdds; i += 1) {
      const tempId = `new_pc_${i + 1}`;
      extra.push({
        op: 'add_node',
        node: {
          tempId,
          type: 'pc',
          label: `PC ${i + 1}`,
          x: baseX + (i % 4) * 120,
          y: baseY + Math.floor(i / 4) * 96,
          ip: '',
          vlan: null,
        },
      });
    }
    return { ...editResponse, operations: [...operations, ...extra] };
  }
  return editResponse;
}
