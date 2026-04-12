import { generatePromptTopology } from './promptTopologyGenerator';

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

function getDeepSeekConfig() {
  const env = (/** @type {any} */ (import.meta)).env || {};
  return {
    apiKey: env.VITE_DEEPSEEK_API_KEY,
    baseUrl: env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: env.VITE_DEEPSEEK_MODEL || 'deepseek-chat',
    enabled: env.VITE_TOPOLOGAI_PROVIDER === 'deepseek' && !!env.VITE_DEEPSEEK_API_KEY,
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

async function generateWithDeepSeek(prompt) {
  const config = getDeepSeekConfig();
  const useDevProxy = !!(/** @type {any} */ (import.meta)).env?.DEV;
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
          content: [
            'You generate editable network topology JSON for a React topology canvas.',
            'Return only valid JSON. Do not include markdown.',
            'Use these device types only: router, switch, ap, server, firewall, cloud, pc, laptop, printer, camera, nas, phone, loadbalancer, tablet, iot, pdu, patchpanel, smarttv.',
            'Use these link types only: ethernet, fiber, wifi, wan, vpn.',
            `Schema example: ${JSON.stringify(TOPOLOGY_SCHEMA)}`,
          ].join(' '),
        },
        {
          role: 'user',
          content: `Create a useful frontend-only topology for: ${prompt}`,
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

export async function generateTopologyFromPrompt(prompt) {
  const config = getDeepSeekConfig();
  if (!config.enabled) {
    return generatePromptTopology(prompt);
  }

  try {
    return await generateWithDeepSeek(prompt);
  } catch (error) {
    console.warn(error);
    return {
      ...generatePromptTopology(prompt),
      summary: 'DeepSeek generation failed, so TopologAi used the local generator instead.',
    };
  }
}

export function getTopologyAiProviderLabel() {
  return getDeepSeekConfig().enabled ? 'DeepSeek' : 'Local planner';
}
