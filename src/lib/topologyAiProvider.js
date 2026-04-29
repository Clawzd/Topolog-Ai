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
    '  - Place concentrator switches or endpoint devices ABOVE (y ≈ backbone_y − 150) and BELOW (y ≈ backbone_y + 150).',
    '  - Each tap link: source=device_id, target=bus_barrier_id, busId=bus_barrier_id, busPortIndex=unique int in [0,portCount-1].',
    '  - Concentrator switches can also have their own star sub-groups connected via normal links.',
    '  - Edge router/firewall may connect via a normal node-to-node WAN link (no busId) to one concentrator.',
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
