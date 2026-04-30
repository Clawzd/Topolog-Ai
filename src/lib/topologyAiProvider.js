import { generatePromptTopology } from './promptTopologyGenerator';
import { applySmartLayout, recommendTopology } from './smartLayout';
import { expandBusLinksForCanvas } from './busExpansion';

const TOPOLOGY_SCHEMA = {
  nodes: [
    { id: 'n1', type: 'router', label: 'Edge Router', x: 120, y: 80, ip: '10.0.0.1', vlan: null },
  ],
  links: [
    { id: 'l1', source: 'n1', target: 'n2', type: 'ethernet', label: '1Gbps' },
  ],
  rooms: [
    { id: 'r1', label: 'Server Room', x: 60, y: 60, w: 300, h: 180, color: 'rgba(20,184,166,0.08)' },
  ],
  vlans: [
    { id: 'v1', name: 'CORP', label: 'Corporate', color: '#14b8a6', subnet: '10.0.10.0/24' },
  ],
  // OPTIONAL — only include when topology=BUS. One bus barrier per backbone.
  barriers: [
    {
      id: 'bus1',
      shape: 'line',
      environmentKind: 'bus',
      x1: 120, y1: 320, x2: 880, y2: 320,
      portCount: 8,
      label: 'Office Bus Backbone',
    },
  ],
  summary: 'Short design summary.',
};

const EDIT_RESPONSE_SCHEMA = {
  summary: 'Short explanation of the edit that will be applied.',
  operations: [
    {
      op: 'move_node',
      id: 'existing-node-id',
      x: 420,
      y: 260,
    },
    {
      op: 'add_node',
      node: { tempId: 'new_ap_1', type: 'ap', label: 'AP - Student Lab', x: 240, y: 520, ip: '10.0.30.12', vlan: 'STUDENT' },
    },
    {
      op: 'add_link',
      link: { source: 'new_ap_1', target: 'existing-switch-id', type: 'ethernet', label: 'PoE' },
    },
    {
      op: 'delete_barrier',
      id: 'existing-wall-id',
    },
  ],
};

/** Trim and strip optional matching quotes (common in hand-edited `.env`). */
function trimEnvValue(v) {
  let s = String(v ?? '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function readDeepSeekEnv() {
  const providerRaw = trimEnvValue(import.meta.env.VITE_TOPOLOGAI_PROVIDER);
  const providerNorm = providerRaw.toLowerCase();
  const apiKey = trimEnvValue(import.meta.env.VITE_DEEPSEEK_API_KEY);
  const baseUrl = trimEnvValue(import.meta.env.VITE_DEEPSEEK_BASE_URL) || 'https://api.deepseek.com';
  const model = trimEnvValue(import.meta.env.VITE_DEEPSEEK_MODEL) || 'deepseek-chat';
  const enabled = providerNorm === 'deepseek' && apiKey.length > 0;
  const reasons = [];
  if (!providerRaw) reasons.push('VITE_TOPOLOGAI_PROVIDER is unset');
  else if (providerNorm !== 'deepseek') {
    reasons.push(`VITE_TOPOLOGAI_PROVIDER is "${providerRaw}" — set to deepseek`);
  }
  if (!apiKey.length) reasons.push('VITE_DEEPSEEK_API_KEY is empty or missing');
  return { providerRaw, providerNorm, apiKey, baseUrl, model, enabled, reasons };
}

function getDeepSeekConfig() {
  const e = readDeepSeekEnv();
  return {
    apiKey: e.apiKey,
    baseUrl: e.baseUrl,
    model: e.model,
    enabled: e.enabled,
  };
}

/**
 * Why DeepSeek is off (for UI). Does not expose the API key.
 * @returns {{ enabled: boolean, reasons: string[], providerRaw: string, keyPresent: boolean }}
 */
export function getTopologyAiConnectionStatus() {
  const e = readDeepSeekEnv();
  return {
    enabled: e.enabled,
    reasons: e.enabled ? [] : e.reasons,
    providerRaw: e.providerRaw || '(unset)',
    keyPresent: e.apiKey.length > 0,
  };
}

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1]);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error('DeepSeek response did not contain JSON.');
}

function normalizeTopology(topology) {
  return {
    summary: topology.summary || 'Generated network topology.',
    nodes: Array.isArray(topology.nodes) ? topology.nodes : [],
    links: Array.isArray(topology.links) ? topology.links : [],
    rooms: Array.isArray(topology.rooms) ? topology.rooms : [],
    vlans: Array.isArray(topology.vlans) ? topology.vlans : [],
    barriers: Array.isArray(topology.barriers) ? topology.barriers : [],
  };
}

function promptRequestsPhysicalEnvironment(prompt) {
  const text = String(prompt || '').toLowerCase();
  return [
    /\bwall(s)?\b/,
    /\bbarrier(s)?\b/,
    /\bpartition wall(s)?\b/,
    /\bphysical partition(s)?\b/,
    /\bconcrete\b/,
    /\bbrick\b/,
    /\bglass wall(s)?\b/,
    /\bglass partition(s)?\b/,
    /\bdoor(s)?\b/,
    /\bwindow(s)?\b/,
    /\bobstacle(s)?\b/,
    /\bfurniture\b/,
    /\bshelf\b|\bshelves\b/,
    /\bcabinet(s)?\b/,
    /\bnoise source(s)?\b/,
    /\brf noise\b/,
    /\binterference\b/,
    /\bmicrowave\b/,
    /\bconduit(s)?\b/,
    /\braceway(s)?\b/,
    /\bcable tray(s)?\b/,
    /\bduct(s)?\b/,
    /\bfaraday\b/,
    /\brf shield\b/,
  ].some((pattern) => pattern.test(text));
}

function sanitizeGeneratedTopology(topology, prompt) {
  const normalized = normalizeTopology(topology);
  if (promptRequestsPhysicalEnvironment(prompt)) return normalized;

  return {
    ...normalized,
    barriers: normalized.barriers.filter((barrier) => barrier.environmentKind === 'bus'),
  };
}

function sanitizeEditResponse(edit, prompt) {
  const operations = Array.isArray(edit?.operations) ? edit.operations : [];
  const physicalEnvironmentAllowed = promptRequestsPhysicalEnvironment(prompt);

  return {
    summary: edit?.summary || 'Updated the current topology.',
    operations: operations
      .map((operation) => {
        if (operation?.op === 'replace_canvas' && operation.topology) {
          return {
            ...operation,
            topology: sanitizeGeneratedTopology(operation.topology, prompt),
          };
        }
        return operation;
      })
      .filter((operation) => {
        if (!operation || typeof operation.op !== 'string') return false;
        if (operation.op !== 'add_barrier') return true;
        const barrier = operation.barrier || operation.item || operation;
        return physicalEnvironmentAllowed || barrier.environmentKind === 'bus';
      }),
  };
}

function hasCanvasContent(mapState) {
  return Boolean(
    (mapState?.nodes || []).length ||
    (mapState?.links || []).length ||
    (mapState?.rooms || []).length ||
    (mapState?.barriers || []).length ||
    (mapState?.vlans || []).length,
  );
}

function compactCanvasSnapshot(mapState = {}) {
  const cleanItems = (items, fields) =>
    (items || []).map((item) =>
      fields.reduce((acc, field) => {
        if (item[field] !== undefined && item[field] !== null && item[field] !== '') {
          acc[field] = item[field];
        }
        return acc;
      }, {}),
    );

  return {
    nodes: cleanItems(mapState.nodes, ['id', 'type', 'label', 'x', 'y', 'ip', 'vlan', 'isBusAnchor', 'busId', 'supportedVlans']),
    links: cleanItems(mapState.links, ['id', 'source', 'target', 'type', 'label', 'busId', 'busPortIndex', 'sourceBusAnchorId', 'targetBusAnchorId', 'poe', 'trunkVlans']),
    rooms: cleanItems(mapState.rooms, ['id', 'label', 'x', 'y', 'w', 'h', 'color']),
    vlans: cleanItems(mapState.vlans, ['id', 'name', 'label', 'color', 'subnet']),
    barriers: cleanItems(mapState.barriers, ['id', 'shape', 'environmentKind', 'barrierType', 'thickness', 'blocksWifi', 'blocksCablePath', 'x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'portCount', 'label']),
    vlanZones: cleanItems(mapState.vlanZones, ['id', 'label', 'vlan', 'x', 'y', 'w', 'h', 'color']),
    powerZones: cleanItems(mapState.powerZones, ['id', 'label', 'x', 'y', 'w', 'h', 'capacity']),
  };
}

/**
 * Build a compact map context string for the AI so it knows what's already on the canvas.
 */
function buildMapContext(mapState) {
  if (!mapState) return '';
  const parts = [];

  const { nodes, rooms, barriers } = mapState;
  if (nodes && nodes.length > 0) {
    const typeCounts = {};
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const summary = Object.entries(typeCounts).map(([t, c]) => `${c}x ${t}`).join(', ');
    parts.push(`EXISTING DEVICES (${nodes.length} total): ${summary}. Occupied area: x=${Math.round(minX)}-${Math.round(maxX)}, y=${Math.round(minY)}-${Math.round(maxY)}.`);
  }

  if (rooms && rooms.length > 0) {
    const roomList = rooms.map(r => `"${r.label}" at (${Math.round(r.x)},${Math.round(r.y)}) size ${Math.round(r.w)}x${Math.round(r.h)}`).join('; ');
    parts.push(`EXISTING ROOMS: ${roomList}.`);
  }

  if (barriers && barriers.length > 0) {
    parts.push(`WALLS/BARRIERS: ${barriers.length} barrier(s) on canvas. Avoid placing devices on walls.`);
  }

  return parts.length > 0
    ? '\n\nCURRENT MAP STATE:\n' + parts.join('\n') + '\nIMPORTANT: Place new devices in empty areas that do not overlap existing devices. Each node is 90x56px. Leave at least 24px gap between nodes. If rooms exist, fit devices inside rooms. Size rooms to contain all their devices with 30px padding.'
    : '';
}

/**
 * Build the enhanced system prompt for the AI.
 */
function buildSystemPrompt(mapState) {
  const mapContext = buildMapContext(mapState);
  const recommendation = mapState?._userPrompt ? recommendTopology(mapState._userPrompt) : null;

  return [
    'You are TopologAi, an expert network topology architect. You generate professional, production-ready network topology JSON for a React SVG canvas.',
    '',
    '## OUTPUT FORMAT',
    'Return ONLY valid JSON (no markdown, no explanation). Schema:',
    JSON.stringify(TOPOLOGY_SCHEMA),
    '',
    '## DEVICE TYPES (use ALL that are relevant):',
    'router, switch, ap, server, firewall, cloud, pc, laptop, printer, camera, nas, phone, loadbalancer, tablet, iot, pdu, patchpanel, smarttv',
    '',
    '## LINK TYPES: ethernet, fiber, wifi, wan, vpn',
    '',
    '## ENVIRONMENT / BARRIER TYPES (optional when requested):',
    'Use `barriers` for physical/environment elements with `shape:"line"` when the prompt asks for them.',
    'Do not include wall, door, window, noise, conduit, or obstacle barriers unless the user explicitly asks for physical environment elements. Network segments, VLAN segments, departments, and rooms do not mean walls.',
    '- `environmentKind:"wall"` for walls and partitions with materials like drywall, glass, brick, concrete, metal, wood, water, or rf_shield.',
    '- `environmentKind:"door"` for doors and openings.',
    '- `environmentKind:"window"` for windows or glass spans.',
    '- `environmentKind:"noise"` for interference or RF noise sources.',
    '- `environmentKind:"conduit"` for cable raceways or conduits.',
    '- `environmentKind:"obstacle"` for shelves, cabinets, furniture, or physical blockers.',
    '- `environmentKind:"bus"` only for bus topology backbones.',
    '',
    '## TOPOLOGY SHAPES — pick exactly ONE, then build it by the rules below',
    '- STAR: one central hub (switch/router); ALL other devices link only to that hub. Best for small offices, home networks, single-room LANs.',
    '- BUS: one horizontal backbone (Bus Barrier); every device taps the backbone. Best for classrooms, labs, industrial lines, legacy LANs.',
    '- RING: a closed loop; each node has EXACTLY 2 ring links and the loop closes back to the first. Best for token ring, fiber metro, redundant WAN.',
    '- MESH: every core node linked to every other core node. Best for HA cores, fully-redundant infra, no-SPOF requirements.',
    '- TREE: strict hierarchy — root → distribution → access → endpoints, with no lateral links except at the root. Best for data centers, campuses, multi-floor offices.',
    '- HYBRID: Bus backbone in the center + 3 star clusters hanging off it + one mesh cross-link for redundancy. Best for enterprise with mixed zones.',
    '',
    'Keyword → shape mapping (first match wins):',
    '  "hybrid", "enterprise", "mixed topology" → HYBRID',
    '  "mesh", "fully connected", "every-to-every", "HA core", "no single point of failure" → MESH',
    '  "ring", "token ring", "closed loop", "circular", "redundant fiber loop" → RING',
    '  "bus", "backbone", "shared cable", "daisy chain", "linear network", "classroom", "lab" → BUS',
    '  "tree", "spine-leaf", "hierarchical", "concentrator", "multi-tier", "3-tier" → TREE',
    '  "star", "central hub", "hub and spoke" → STAR',
    '  ≤10 devices → STAR; larger general networks → TREE',
    '',
    recommendation ? `RECOMMENDED TOPOLOGY for this request: ${recommendation.topology.toUpperCase()} — ${recommendation.reason}` : '',
    '',
    '## HOW TO BUILD EACH SHAPE (strict JSON rules)',
    '',
    'STAR:',
    '  - One hub node (switch/router) at center, e.g. (460, 320).',
    '  - 6–12 endpoint nodes placed in a circle (radius 150–220px) around it.',
    '  - Every link: hub ↔ endpoint. ZERO endpoint-to-endpoint links.',
    '',
    'BUS:',
    '  - One `barriers` entry: shape:"line", environmentKind:"bus", horizontal (y1=y2), x1=~100, x2=~950, portCount 6–14.',
    '  - Treat the backbone as the shared medium: endpoint devices attach DIRECTLY to the bus, not through switches or hubs.',
    '  - Place endpoint devices ABOVE (y ≈ backbone_y − 150) and BELOW (y ≈ backbone_y + 150).',
    '  - Each tap link: source=device_id, target=bus_barrier_id, busId=bus_barrier_id, busPortIndex=unique int in [0,portCount-1].',
    '  - Prefer classic bus endpoints like PCs, printers, servers, cameras, and workstations on the same subnet.',
    '  - Show the backbone as terminated at both ends conceptually; do NOT add hubs, concentrators, or star sub-groups.',
    '  - Do NOT chain switches to fake a bus. Do NOT emit bus-anchor nodes.',
    '',
    'RING:',
    '  - 4–8 switch/router nodes on a circle (radius ~170px, center ~460,320).',
    '  - Link each node to the NEXT in order, PLUS one final link from last → first to close the loop.',
    '  - Every ring node has exactly 2 ring links. Add endpoint spurs via separate non-ring links.',
    '',
    'MESH:',
    '  - 3–5 core router/switch nodes placed roughly equidistant.',
    '  - Emit one fiber link between EVERY pair (N*(N-1)/2 total). Example: 4 nodes = 6 links.',
    '  - Endpoints attach to ONE core node only; do NOT mesh the endpoint layer.',
    '',
    'TREE:',
    '  - Layer 1 (y=50): cloud/internet. Layer 2 (y=160): firewall/edge router.',
    '  - Layer 3 (y=290): core/distribution switches. Layer 4 (y=430): access switches/APs.',
    '  - Layer 5 (y=570): endpoints (PCs, phones, cameras, etc.).',
    '  - Links go strictly downward; lateral links allowed only at layer 3 (redundancy).',
    '',
    'HYBRID:',
    '  - One horizontal Bus Backbone barrier (same rules as BUS above).',
    '  - 3 core switches tap the bus (ports 1, 3, 5).',
    '  - Each core switch is the hub of a star cluster below it (office / server / wireless).',
    '  - Edge: cloud → router + firewall (above bus), both connecting to the center core.',
    '  - Add ONE cross-link between the left and right core switches (mesh redundancy).',
    '',
    '## LAYOUT RULES (apply to every shape)',
    '- Canvas uses pixel coordinates. Each device node is 90px wide, 56px tall.',
    '- NEVER place two devices at the same or overlapping coordinates. Minimum 24px gap between all nodes.',
    '- Spread devices horizontally with at least 120px between centers.',
    '- Keep the whole drawing inside x=40..1100, y=40..720.',
    '',
    '## ROOM RULES',
    '- Create rooms/zones to logically group devices (e.g., Server Room, Office Area, Security Zone).',
    '- Room must be large enough to contain ALL its devices with 30px padding on each side.',
    '- Rooms must not overlap each other. Leave at least 16px gap between room rectangles.',
    '- Put endpoint devices physically inside the matching room rectangle. Do not put core/distribution switches inside endpoint rooms unless the room label says IDF, closet, rack, or server.',
    '- Keep cloud/ISP, firewall, core routers, and distribution switches outside user rooms unless explicitly requested.',
    '- Room label must match its contents: Student Lab contains student endpoints, Faculty Office contains faculty endpoints, Admin Office contains admin endpoints.',
    '- Room color should use rgba with 0.08 alpha for subtle background.',
    '- Use distinct colors per room: teal rgba(20,184,166,0.08), blue rgba(59,130,246,0.08), purple rgba(139,92,246,0.08), amber rgba(245,158,11,0.08), red rgba(239,68,68,0.08), green rgba(16,185,129,0.08).',
    '',
    '## ENVIRONMENT RULES',
    '- If the prompt mentions walls, barriers, thick concrete, glass partitions, doors, windows, obstacles, interference, or conduit/raceway, include matching `barriers` entries.',
    '- If the prompt only mentions network segmentation, VLANs, departments, offices, labs, or rooms, do NOT add walls or other physical barriers.',
    '- Keep environment lines near the relevant rooms or between zones so they explain the floorplan.',
    '- Do not draw environment lines across unrelated rooms or through the topology core. A staff-room wall belongs inside or directly around the staff room.',
    '- For U-shaped or multi-segment walls, emit separate straight `barriers` entries for each segment with clear labels.',
    '- Concrete, brick, and metal walls should normally use `blocksWifi:true`; walls and obstacles should usually use `blocksCablePath:true`.',
    '- Doors and windows should usually use `blocksCablePath:false` and lighter materials like drywall or glass.',
    '- Do not place devices directly on top of barriers.',
    '',
    '## PROFESSIONAL QUALITY',
    '- Use realistic IPs (10.x.x.x, 172.16.x.x, 192.168.x.x for private; 203.0.113.x for examples).',
    '- Add proper VLANs for network segmentation (corporate, guest, IoT, security, management).',
    '- Use meaningful labels (not "Node 1" — use "Core Switch", "AP - Conference Room", etc.).',
    '- Use appropriate link types: fiber for backbone/uplinks, ethernet for access, wifi for wireless clients, wan for internet, vpn for tunnels.',
    '- Include link labels for speeds (10Gbps, 1Gbps) on backbone links.',
    '- Add PoE labels where applicable (APs, cameras, phones).',
    '- Generate 10-30 devices for typical scenarios. More for complex environments.',
    '- Every requested device category must be represented.',
    mapContext,
  ].filter(Boolean).join('\n');
}

function buildEditSystemPrompt(mapState) {
  return [
    'You are TopologAi, an expert network topology editor. The user already has a canvas. Return edit operations that modify the existing canvas in place.',
    '',
    '## OUTPUT FORMAT',
    'Return ONLY valid JSON (no markdown, no explanation). Schema:',
    JSON.stringify(EDIT_RESPONSE_SCHEMA),
    '',
    '## CANVAS SNAPSHOT',
    JSON.stringify(compactCanvasSnapshot(mapState)),
    '',
    '## ALLOWED OPERATIONS',
    'add_node, add_link, add_room, add_barrier, update_node, update_link, update_room, update_barrier, delete_node, delete_link, delete_room, delete_barrier, move_node, move_room, move_barrier, replace_canvas',
    '',
    '## EDIT RULES',
    '- Use existing IDs from the snapshot when updating, moving, linking, or deleting existing items.',
    '- For newly added nodes/barriers/rooms/links, use tempId only when another operation needs to reference it. The app will generate final IDs.',
    '- "add" means append to the existing canvas.',
    '- "delete", "remove", or "get rid of" means delete only the requested existing item and any dangling links.',
    '- "move", "relocate", "shift", "put", or "place" means move existing items, not duplicate them.',
    '- "rename", "change name", or "call it" means update the label field.',
    '- "replace", "redesign", "start over", or "make this a ..." means use one replace_canvas operation with a full topology.',
    '- If a user names an item by label, match the closest existing label and use its ID.',
    '- Prefer precise operations over replace_canvas unless the user clearly asks for a full redesign.',
    '- Keep existing object IDs; never invent an ID for an existing item.',
    '',
    '## ENVIRONMENT SAFETY',
    '- Do not add wall, door, window, noise, conduit, or obstacle barriers unless the user explicitly asks for physical environment elements.',
    '- Network segments, VLANs, departments, offices, labs, and rooms do not mean physical walls.',
    '',
    '## REPLACE_CANVAS TOPOLOGY SCHEMA',
    JSON.stringify(TOPOLOGY_SCHEMA),
  ].join('\n');
}

async function generateWithDeepSeek(prompt, mapState) {
  const config = getDeepSeekConfig();
  const useDevProxy = !!import.meta.env.DEV;
  const path = '/chat/completions';
  const url = useDevProxy
    ? `/deepseek-api${path}`
    : `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(useDevProxy ? {} : { Authorization: `Bearer ${config.apiKey}` }),
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt({ ...mapState, _userPrompt: prompt }),
        },
        {
          role: 'user',
          content: `Design a professional network topology for: ${prompt}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.text();
      if (errBody) detail = ` — ${errBody.slice(0, 200)}`;
    } catch {
      /* ignore */
    }
    throw new Error(`DeepSeek request failed: ${response.status}${detail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned an empty response.');
  return normalizeTopology(extractJson(content));
}

async function generateEditsWithDeepSeek(prompt, mapState) {
  const config = getDeepSeekConfig();
  const useDevProxy = !!import.meta.env.DEV;
  const path = '/chat/completions';
  const url = useDevProxy
    ? `/deepseek-api${path}`
    : `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(useDevProxy ? {} : { Authorization: `Bearer ${config.apiKey}` }),
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildEditSystemPrompt({ ...mapState, _userPrompt: prompt }),
        },
        {
          role: 'user',
          content: `Apply this change to the current canvas: ${prompt}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.text();
      if (errBody) detail = ` â€” ${errBody.slice(0, 200)}`;
    } catch {
      /* ignore */
    }
    throw new Error(`DeepSeek edit request failed: ${response.status}${detail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned an empty edit response.');
  return sanitizeEditResponse(extractJson(content), prompt);
}

const DEVICE_WORDS = {
  ap: ['ap', 'access point', 'wifi', 'wi-fi'],
  printer: ['printer'],
  server: ['server'],
  firewall: ['firewall'],
  router: ['router'],
  switch: ['switch'],
  pc: ['pc', 'workstation', 'desktop', 'computer'],
  laptop: ['laptop'],
  camera: ['camera'],
  nas: ['nas', 'storage'],
  phone: ['phone', 'voip'],
};

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function requestedDeviceType(text) {
  return Object.entries(DEVICE_WORDS).find(([, words]) => includesAny(text, words))?.[0] || 'pc';
}

function requestedCount(text) {
  const numeric = text.match(/\b(\d+)\b/);
  if (numeric) return Math.min(12, Math.max(1, Number(numeric[1])));
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return Object.entries(words).find(([word]) => new RegExp(`\\b${word}\\b`).test(text))?.[1] || 1;
}

function scoreLabelMatch(item, text) {
  const label = String(item?.label || item?.name || '').toLowerCase();
  if (!label) return 0;
  if (text.includes(label)) return 100;
  return label
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && text.includes(word))
    .length;
}

function bestMatch(items, text, predicate = () => true) {
  return (items || [])
    .filter(predicate)
    .map((item) => ({ item, score: scoreLabelMatch(item, text) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

function findTargetNode(mapState, text) {
  const type = requestedDeviceType(text);
  return bestMatch(mapState.nodes, text, (node) => node.type === type && !node.isBusAnchor)
    || bestMatch(mapState.nodes, text, (node) => !node.isBusAnchor)
    || null;
}

function findTargetRoom(mapState, text) {
  return bestMatch(mapState.rooms, text) || null;
}

function findTargetBarrier(mapState, text) {
  if (/\bwall(s)?\b/.test(text)) {
    return bestMatch(mapState.barriers, text, (barrier) => barrier.environmentKind === 'wall')
      || (mapState.barriers || []).find((barrier) => barrier.environmentKind === 'wall')
      || null;
  }
  if (/\bbus\b|\bbackbone\b/.test(text)) {
    return bestMatch(mapState.barriers, text, (barrier) => barrier.environmentKind === 'bus')
      || (mapState.barriers || []).find((barrier) => barrier.environmentKind === 'bus')
      || null;
  }
  return bestMatch(mapState.barriers, text) || null;
}

function roomCenter(room) {
  return { x: (room?.x || 120) + (room?.w || 260) / 2, y: (room?.y || 120) + (room?.h || 180) / 2 };
}

function nearestSwitch(mapState, room) {
  const switches = (mapState.nodes || []).filter((node) => node.type === 'switch' && !node.isBusAnchor);
  if (!switches.length) return null;
  const anchor = roomCenter(room);
  return switches
    .map((node) => ({ node, dist: Math.hypot((node.x || 0) - anchor.x, (node.y || 0) - anchor.y) }))
    .sort((a, b) => a.dist - b.dist)[0]?.node || null;
}

async function generateLocalEditOperations(prompt, mapState) {
  const text = String(prompt || '').toLowerCase();
  if (!hasCanvasContent(mapState)) {
    return { summary: 'No existing canvas was available, so no edit was applied.', operations: [] };
  }

  if (/\b(replace|redesign|start over|start again|rebuild)\b/.test(text)) {
    const topology = await generateTopologyFromPrompt(prompt, undefined);
    return {
      summary: 'Replaced the current canvas with a newly generated topology.',
      operations: [{ op: 'replace_canvas', topology }],
    };
  }

  if (/\b(delete|remove|get rid of)\b/.test(text)) {
    const barrier = findTargetBarrier(mapState, text);
    if (barrier) return { summary: `Removed ${barrier.label || barrier.environmentKind || 'barrier'}.`, operations: [{ op: 'delete_barrier', id: barrier.id }] };
    const node = findTargetNode(mapState, text);
    if (node) return { summary: `Removed ${node.label || node.type}.`, operations: [{ op: 'delete_node', id: node.id }] };
    const room = findTargetRoom(mapState, text);
    if (room) return { summary: `Removed ${room.label || 'room'}.`, operations: [{ op: 'delete_room', id: room.id }] };
    return { summary: 'I could not find a matching item to remove.', operations: [] };
  }

  if (/\b(rename|change name|call it)\b/.test(text)) {
    const nextLabel = prompt.match(/\b(?:to|as|it)\s+["']?([^"']+?)["']?\s*$/i)?.[1]?.trim();
    const target = findTargetRoom(mapState, text) || findTargetNode(mapState, text) || findTargetBarrier(mapState, text);
    if (target && nextLabel) {
      const op = (mapState.rooms || []).some((room) => room.id === target.id)
        ? 'update_room'
        : (mapState.barriers || []).some((barrier) => barrier.id === target.id)
          ? 'update_barrier'
          : 'update_node';
      return { summary: `Renamed ${target.label || target.id} to ${nextLabel}.`, operations: [{ op, id: target.id, fields: { label: nextLabel } }] };
    }
  }

  if (/\b(move|relocate|shift|place|put)\b/.test(text)) {
    const dx = /\bleft\b/.test(text) ? -160 : /\bright\b/.test(text) ? 160 : 0;
    const dy = /\bup\b|\babove\b/.test(text) ? -120 : /\bdown\b|\bbelow\b/.test(text) ? 120 : 0;
    const room = findTargetRoom(mapState, text);
    if (room) return { summary: `Moved ${room.label || 'room'}.`, operations: [{ op: 'move_room', id: room.id, dx, dy }] };
    const barrier = findTargetBarrier(mapState, text);
    if (barrier) return { summary: `Moved ${barrier.label || 'barrier'}.`, operations: [{ op: 'move_barrier', id: barrier.id, dx, dy }] };
    const node = findTargetNode(mapState, text);
    if (node) return { summary: `Moved ${node.label || node.type}.`, operations: [{ op: 'move_node', id: node.id, dx, dy }] };
  }

  if (/\b(add|create|insert|put)\b/.test(text)) {
    const type = requestedDeviceType(text);
    const count = requestedCount(text);
    const room = findTargetRoom(mapState, text);
    const targetSwitch = nearestSwitch(mapState, room);
    const base = roomCenter(room);
    const operations = [];

    for (let i = 0; i < count; i++) {
      const tempId = `new_${type}_${i + 1}`;
      const x = Math.round(base.x - 45 + (i % 3) * 120);
      const y = Math.round(base.y - 28 + Math.floor(i / 3) * 96);
      operations.push({
        op: 'add_node',
        node: {
          tempId,
          type,
          label: `${type === 'ap' ? 'AP' : type.charAt(0).toUpperCase() + type.slice(1)}${room?.label ? ` - ${room.label}` : ''} ${i + 1}`,
          x,
          y,
          ip: '',
          vlan: null,
        },
      });
      if (targetSwitch) {
        operations.push({
          op: 'add_link',
          link: { source: tempId, target: targetSwitch.id, type: 'ethernet', label: type === 'ap' ? 'PoE' : '' },
        });
      }
    }

    return { summary: `Added ${count} ${type}${count === 1 ? '' : 's'}${room?.label ? ` to ${room.label}` : ''}.`, operations };
  }

  return { summary: 'I could not turn that refinement into a safe local edit.', operations: [] };
}

/**
 * Generate topology from prompt.
 * @param {string} prompt - User's description
 * @param {object} [mapState] - Current canvas state { nodes, rooms, barriers } for context
 */
export async function generateTopologyFromPrompt(prompt, mapState) {
  const config = getDeepSeekConfig();
  if (!config.enabled) {
    const topology = sanitizeGeneratedTopology(generatePromptTopology(prompt), prompt);
    return expandBusLinksForCanvas(applySmartLayout(topology, mapState));
  }

  try {
    const topology = sanitizeGeneratedTopology(await generateWithDeepSeek(prompt, mapState), prompt);
    return expandBusLinksForCanvas(applySmartLayout(topology, mapState));
  } catch (error) {
    console.warn(error);
    const fallback = sanitizeGeneratedTopology(generatePromptTopology(prompt), prompt);
    return {
      ...expandBusLinksForCanvas(applySmartLayout(fallback, mapState)),
      summary: 'DeepSeek generation failed, so TopologAi used the local generator instead.',
    };
  }
}

export async function generateTopologyEditsFromPrompt(prompt, mapState) {
  const config = getDeepSeekConfig();
  if (!hasCanvasContent(mapState)) {
    return { summary: 'No existing topology is available to refine.', operations: [] };
  }

  if (!config.enabled) {
    return sanitizeEditResponse(await generateLocalEditOperations(prompt, mapState), prompt);
  }

  try {
    return sanitizeEditResponse(await generateEditsWithDeepSeek(prompt, mapState), prompt);
  } catch (error) {
    console.warn(error);
    return sanitizeEditResponse(await generateLocalEditOperations(prompt, mapState), prompt);
  }
}

export function getTopologyAiProviderLabel() {
  return getDeepSeekConfig().enabled ? 'DeepSeek' : 'Local planner';
}
