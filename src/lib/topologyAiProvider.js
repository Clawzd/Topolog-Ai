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
    '## TOPOLOGY ARCHITECTURE — pick exactly ONE shape, then build it correctly',
    'The classic four shapes (always consider these first):',
    '- STAR: one central hub (switch or router); every other device connects directly to that hub and to nothing else. Best for small offices, single rooms, simple LANs.',
    '- BUS: a single shared backbone cable; every device taps onto the same backbone. Best for linear/industrial layouts, classroom/lab demos, simple legacy LANs. Use the BUS BARRIER ELEMENT (see below) — do NOT fake a bus by chaining switches.',
    '- RING: nodes form a closed loop; each node has exactly two neighbors and the last node links back to the first. Best for redundant metro/WAN cores, fiber rings, provider backbones.',
    '- MESH: every core node is linked to every other core node (full mesh) or most others (partial mesh). Best for high-availability cores, critical infra, redundant data centers.',
    'Extended shapes (only when the brief clearly calls for them):',
    '- TREE / Spine-Leaf: hierarchical layers — Internet at top, edge/firewall, core/distribution, access, endpoints. Best for data centers and multi-floor offices.',
    '- HYBRID: combines two of the above (e.g., star access on a ring backbone). Only use when the brief explicitly mixes shapes.',
    '',
    'Pick the shape based on the user prompt:',
    '- "bus", "backbone", "shared cable", "daisy chain", "classroom", "lab demo" → BUS',
    '- "ring", "loop", "redundant fiber", "metro" → RING',
    '- "mesh", "fully connected", "every-to-every", "HA core", "no single point of failure" → MESH',
    '- "office", "home", "small network", "central switch" → STAR',
    '- "data center", "campus", "spine-leaf", "multi-floor" → TREE',
    '- otherwise default to STAR for ≤10 devices, TREE for larger networks.',
    '',
    recommendation ? `RECOMMENDED TOPOLOGY for this request: ${recommendation.topology.toUpperCase()} — ${recommendation.reason}` : '',
    '',
    '## HOW TO BUILD EACH SHAPE (JSON output rules)',
    'STAR — one hub node + radial endpoints:',
    '  - Place the hub (a "switch" or "router") at the center, e.g. (x=460, y=320).',
    '  - Place 6–10 endpoint nodes around it on a circle of radius 150–220.',
    '  - Every link has the hub as one end and an endpoint as the other. NO endpoint-to-endpoint links.',
    '',
    'RING — closed loop of core nodes:',
    '  - Place 4–8 core nodes (switch/router) on a circle of radius ~170 (e.g. center 460,320).',
    '  - Create a link between every consecutive pair AND a final link closing the loop (last → first). Every core node ends up with exactly 2 ring links.',
    '  - Endpoints (PCs, APs, servers) hang off ring nodes via separate ethernet/wifi links.',
    '',
    'MESH — full mesh of core nodes:',
    '  - Place 3–5 core nodes (router/switch) roughly equidistant.',
    '  - For N core nodes emit N*(N-1)/2 fiber links — one between EVERY pair. Verify the count.',
    '  - Endpoints attach to one core node via ethernet/wifi; do NOT mesh the endpoints.',
    '',
    'BUS — one shared backbone (USE THE BUS BARRIER ELEMENT):',
    '  - Output exactly ONE entry in `barriers` with: `shape:"line"`, `environmentKind:"bus"`, x1/y1/x2/y2 (horizontal line, e.g. y1=y2=380, x1=120, x2=900), `portCount` between 6 and 16, and a meaningful `label`.',
    '  - For each device that taps the bus, output a normal node (router/switch/server/pc/etc.) placed above (y around 240) or below (y around 520) the backbone line.',
    '  - For each tap, output a link whose `source` is the device id and whose `target` is the bus barrier id (the same string used in `barriers[i].id`). Set `busId` to that same barrier id and `busPortIndex` to a unique integer in [0, portCount-1] (no two links share the same index on the same bus). Set `type` to "ethernet" or "fiber".',
    '  - Do NOT create a chain of switches to imitate a bus, and do NOT add bus-anchor nodes yourself — the canvas creates them automatically when it sees the link → bus reference.',
    '  - You may still output one link from cloud/WAN/firewall to the first bus device using the normal node-to-node form (no busId).',
    '',
    'TREE — hierarchical layers:',
    '  - Layer 1 (y=40-100): cloud/internet. Layer 2 (y=150-220): firewall/edge router. Layer 3 (y=280-350): core/distribution. Layer 4 (y=420-500): access switches/APs. Layer 5 (y=560-680): endpoints.',
    '  - Each device only links upward to its parent layer (and laterally only at the core).',
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
    '- Room color should use rgba with 0.08 alpha for subtle background.',
    '- Use distinct colors per room: teal rgba(20,184,166,0.08), blue rgba(59,130,246,0.08), purple rgba(139,92,246,0.08), amber rgba(245,158,11,0.08), red rgba(239,68,68,0.08), green rgba(16,185,129,0.08).',
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

/**
 * Generate topology from prompt.
 * @param {string} prompt - User's description
 * @param {object} [mapState] - Current canvas state { nodes, rooms, barriers } for context
 */
export async function generateTopologyFromPrompt(prompt, mapState) {
  const config = getDeepSeekConfig();
  if (!config.enabled) {
    const topology = generatePromptTopology(prompt);
    return expandBusLinksForCanvas(applySmartLayout(topology, mapState));
  }

  try {
    const topology = await generateWithDeepSeek(prompt, mapState);
    return expandBusLinksForCanvas(applySmartLayout(topology, mapState));
  } catch (error) {
    console.warn(error);
    const fallback = generatePromptTopology(prompt);
    return {
      ...expandBusLinksForCanvas(applySmartLayout(fallback, mapState)),
      summary: 'DeepSeek generation failed, so TopologAi used the local generator instead.',
    };
  }
}

export function getTopologyAiProviderLabel() {
  return getDeepSeekConfig().enabled ? 'DeepSeek' : 'Local planner';
}
