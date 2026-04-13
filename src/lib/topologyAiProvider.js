import { generatePromptTopology } from './promptTopologyGenerator';
import { applySmartLayout, recommendTopology } from './smartLayout';

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
    '## TOPOLOGY ARCHITECTURE RULES',
    'Choose the BEST topology pattern for the scenario:',
    '- STAR: Central hub (switch/router) connecting endpoints radially. Best for small offices, simple networks.',
    '- BUS: Devices on a shared linear backbone. Place devices in a horizontal line with backbone cable, plus drop cables to endpoints above/below. Good for industrial, sequential environments.',
    '- RING: Circular redundant loop. Each node connects to exactly 2 neighbors forming a cycle. Good for metro/WAN, provider networks.',
    '- MESH: Every node connected to every other (full mesh) or most others (partial mesh). Best for critical high-availability needs.',
    '- TREE (Spine-Leaf): Hierarchical layers — core at top, distribution in middle, access/endpoints at bottom. Best for data centers, campuses, most offices.',
    '- HYBRID: Combines multiple patterns (e.g., star cores connected by ring backbone, tree with mesh at core). Best for enterprise, multi-site.',
    '',
    recommendation ? `RECOMMENDED TOPOLOGY for this request: ${recommendation.topology.toUpperCase()} — ${recommendation.reason}` : '',
    '',
    '## LAYOUT RULES (CRITICAL)',
    '- Canvas uses pixel coordinates. Each device node is 90px wide, 56px tall.',
    '- NEVER place two devices at the same or overlapping coordinates. Minimum 24px gap between all nodes.',
    '- Arrange devices in clear, organized layers:',
    '  Layer 1 (y=40-100): Internet/Cloud/WAN',
    '  Layer 2 (y=150-220): Edge security (firewalls, edge routers)',
    '  Layer 3 (y=280-350): Core/Distribution (core switches, routers)',
    '  Layer 4 (y=420-500): Access layer (access switches, APs)',
    '  Layer 5 (y=560-680): Endpoints (PCs, phones, cameras, printers, etc.)',
    '- Spread devices horizontally with at least 120px between centers.',
    '- For star topology: place hub at center, endpoints in a circle around it (radius 150-200px).',
    '- For bus: place backbone devices in a horizontal line, endpoints branching above/below.',
    '- For ring: place nodes in a circle or oval.',
    '- For tree: use clear hierarchical rows.',
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
    // Apply smart layout even for local generator
    return applySmartLayout(topology, mapState);
  }

  try {
    const topology = await generateWithDeepSeek(prompt, mapState);
    // Apply smart layout to resolve any remaining overlaps
    return applySmartLayout(topology, mapState);
  } catch (error) {
    console.warn(error);
    const fallback = generatePromptTopology(prompt);
    return {
      ...applySmartLayout(fallback, mapState),
      summary: 'DeepSeek generation failed, so TopologAi used the local generator instead.',
    };
  }
}

export function getTopologyAiProviderLabel() {
  return getDeepSeekConfig().enabled ? 'DeepSeek' : 'Local planner';
}
