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

const NODE_W = 90;
const NODE_H = 56;
const NODE_PAD = 32;
const ROOM_PAD = 96;

// Tally how many nodes of each type already live inside each room rectangle.
function pickHostRoom(rooms, allNodes, type) {
  if (!rooms || !rooms.length) return null;
  const counts = rooms.map(() => 0);
  for (const n of allNodes) {
    if (n.type !== type) continue;
    const cx = (n.x ?? 0) + NODE_W / 2;
    const cy = (n.y ?? 0) + NODE_H / 2;
    for (let i = 0; i < rooms.length; i += 1) {
      const r = rooms[i];
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
        counts[i] += 1;
        break;
      }
    }
  }
  let bestIdx = -1;
  let bestCount = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    if (counts[i] > bestCount) { bestCount = counts[i]; bestIdx = i; }
  }
  if (bestIdx >= 0) return { room: rooms[bestIdx], idx: bestIdx };
  // Fallback: pick the largest room as the host so synthesized nodes still
  // land somewhere visible instead of stranded below the canvas bounds.
  let largest = 0;
  let largestIdx = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    const area = (rooms[i].w || 0) * (rooms[i].h || 0);
    if (area > largest) { largest = area; largestIdx = i; }
  }
  return { room: rooms[largestIdx], idx: largestIdx };
}

// Find a switch already living inside `room` so synthesized endpoints can be
// linked to it instead of dangling as orphans.
function findRoomSwitch(room, allNodes) {
  if (!room) return null;
  for (const n of allNodes) {
    if (n.type !== 'switch') continue;
    const cx = (n.x ?? 0) + NODE_W / 2;
    const cy = (n.y ?? 0) + NODE_H / 2;
    if (cx >= room.x && cx <= room.x + room.w && cy >= room.y && cy <= room.y + room.h) {
      return n;
    }
  }
  return null;
}

// Append `count` nodes of `type` into `room`, growing the room and gridding
// them next to existing room nodes. Returns the new node objects.
function synthesizeNodesIntoRoom({ count, type, room, allNodes, labelPrefix, startSeq }) {
  const occupants = allNodes.filter((n) => {
    const cx = (n.x ?? 0) + NODE_W / 2;
    const cy = (n.y ?? 0) + NODE_H / 2;
    return cx >= room.x && cx <= room.x + room.w && cy >= room.y && cy <= room.y + room.h;
  });

  const total = occupants.length + count;
  const cellW = NODE_W + NODE_PAD;
  const cellH = NODE_H + NODE_PAD;
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / cols);
  const gridW = cols * cellW - NODE_PAD;
  const gridH = rows * cellH - NODE_PAD;

  const requiredW = gridW + ROOM_PAD * 2;
  const requiredH = gridH + ROOM_PAD * 2;
  if (requiredW > room.w) room.w = requiredW;
  if (requiredH > room.h) room.h = requiredH;

  const startX = Math.round(room.x + (room.w - gridW) / 2);
  const startY = Math.round(room.y + (room.h - gridH) / 2);

  const created = [];
  for (let i = 0; i < count; i += 1) {
    const slot = occupants.length + i;
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    created.push({
      id: autoId('n', startSeq + i),
      type,
      label: labelPrefix
        ? `${labelPrefix} ${startSeq + i + 1}`
        : `${type.charAt(0).toUpperCase()}${type.slice(1)} ${startSeq + i + 1}`,
      x: startX + col * cellW,
      y: startY + row * cellH,
      ip: '',
      vlan: null,
    });
  }
  return created;
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
  let links = [...(topology.links || [])];
  const rooms = (topology.rooms || []).map((r) => ({ ...r }));
  const barriers = [...(topology.barriers || [])];
  const barrierIds = new Set(barriers.map((b) => b.id));

  const addNodes = [];
  const addLinks = [];

  const byType = (type) => nodes.filter((n) => n.type === type);

  // Synthesize new endpoints inside the most relevant room so they don't end
  // up stranded below the topology with `Local only` tags. Pick the room that
  // already hosts the most devices of the same type, link the new nodes to
  // that room's switch (or any switch in the topology), and grow the room to
  // fit the expanded grid.
  const synthesizeInto = (count, type, startSeq) => {
    if (count <= 0) return [];
    const candidatesNow = nodes.concat(addNodes);
    const host = pickHostRoom(rooms, candidatesNow, type);
    let labelPrefix = null;
    if (host?.room?.label) {
      const labelText = String(host.room.label).trim();
      if (labelText) labelPrefix = `${type === 'pc' || type === 'laptop' ? 'Workstation' : type.charAt(0).toUpperCase() + type.slice(1)} - ${labelText}`;
    }
    if (!host) {
      const created = [];
      for (let i = 0; i < count; i += 1) {
        const pos = nextNodePlacement(candidatesNow.concat(created), i);
        created.push({
          id: autoId('n', startSeq + i),
          type,
          label: `${type.charAt(0).toUpperCase()}${type.slice(1)} ${startSeq + i + 1}`,
          x: pos.x,
          y: pos.y,
          ip: '',
          vlan: null,
        });
      }
      return created;
    }
    const created = synthesizeNodesIntoRoom({
      count,
      type,
      room: host.room,
      allNodes: candidatesNow,
      labelPrefix,
      startSeq,
    });
    const upstream = findRoomSwitch(host.room, candidatesNow)
      || candidatesNow.find((n) => n.type === 'switch')
      || candidatesNow.find((n) => n.type === 'router' || n.type === 'firewall');
    if (upstream) {
      created.forEach((node) => {
        addLinks.push({
          id: autoId('l', startSeq + created.indexOf(node)),
          source: upstream.id,
          target: node.id,
          type: node.type === 'ap' ? 'ethernet' : 'ethernet',
          label: '',
        });
      });
    }
    return created;
  };

  // Only fill in shortfalls — never trim what the AI emitted. Caps were
  // deleting devices the user explicitly asked for (e.g. "6 laptops … 4
  // laptops" wrongly capped at 6, removing the second-room laptops). Keep
  // exactly what the user requested as a minimum and let any extras through.
  for (const [type, target] of Object.entries(spec.perType || {})) {
    const candidates = byType(type);
    if (candidates.length < target) {
      const missing = target - candidates.length;
      const created = synthesizeInto(missing, type, candidates.length);
      addNodes.push(...created);
    }
  }

  nodes = nodes.concat(addNodes);

  if (Number.isFinite(spec.totalCount) && nodes.length < spec.totalCount) {
    const fallbackType = Object.keys(spec.perType || {})[0] || 'pc';
    const missing = spec.totalCount - nodes.length;
    const start = nodes.length;
    const created = synthesizeInto(missing, fallbackType, start);
    nodes = nodes.concat(created);
  }

  // Concat all synthesized links once nodes are settled (synthesizeInto
  // appends to addLinks via closure across both perType and totalCount passes).
  links = links.concat(addLinks);

  const nodeIds = new Set(nodes.map((n) => n.id));
  const cleanLinks = sanitizeLinks(links, nodeIds, barrierIds);

  const text = String(promptText || '').trim();
  const countText = Number.isFinite(spec.totalCount) ? `${spec.totalCount}` : 'requested';
  const summarySuffix = text ? ` Count enforced from prompt "${text.slice(0, 80)}".` : '';

  return {
    ...topology,
    nodes,
    links: cleanLinks,
    rooms,
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
