/**
 * Classic topology shapes as placeable multi-node segments (bus, star, ring, mesh, tree, hybrid).
 * Each pattern is instantiated at a canvas anchor with fresh IDs.
 */

/** @typedef {{ id: string, label: string, description: string, icon: string }} TopologyPatternMeta */

/** @param {number} ax @param {number} ay @param {number} deg @param {number} r */
function polar(ax, ay, deg, r) {
  const rad = (deg * Math.PI) / 180;
  return { x: ax + r * Math.cos(rad), y: ay + r * Math.sin(rad) };
}

/**
 * @param {string} patternId
 * @param {number} anchorX  canvas x (top-left bias of segment center)
 * @param {number} anchorY
 * @param {{ node: () => string, link: () => string }} genId
 * @returns {{ nodes: object[], links: object[] }}
 */
export function instantiateTopologyPattern(patternId, anchorX, anchorY, genId) {
  const ax = anchorX;
  const ay = anchorY;
  const node = (type, label, x, y) => ({
    id: genId.node(),
    type,
    label,
    x,
    y,
    ip: '',
    vlan: null,
  });
  const link = (source, target, type = 'ethernet', label = '') => ({
    id: genId.link(),
    source,
    target,
    type,
    label,
  });

  switch (patternId) {
    case 'star': {
      const sw = node('switch', 'Star — Core switch', ax - 45, ay - 28);
      const satTypes = [
        ['pc', 'Workstation'],
        ['laptop', 'Laptop'],
        ['printer', 'Printer'],
        ['camera', 'Camera'],
        ['ap', 'Access point'],
      ];
      const R = 140;
      const angles = [-90, -18, 54, 126, 198];
      const satellites = satTypes.map(([type, lab], i) => {
        const p = polar(ax, ay, angles[i], R);
        return node(type, `Star — ${lab}`, p.x - 45, p.y - 28);
      });
      const nodes = [sw, ...satellites];
      const links = satellites.map((s) => link(sw.id, s.id, 'ethernet', ''));
      return { nodes, links };
    }
    case 'bus': {
      const xs = [-220, -110, 0, 110, 220];
      const specs = [
        ['router', 'Bus — Edge router'],
        ['switch', 'Bus — Segment switch'],
        ['pc', 'Bus — Host A'],
        ['pc', 'Bus — Host B'],
        ['printer', 'Bus — Shared printer'],
      ];
      const nodes = specs.map(([type, lab], i) =>
        node(type, lab, ax + xs[i] - 45, ay - 28),
      );
      const links = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        links.push(link(nodes[i].id, nodes[i + 1].id, 'ethernet', 'Bus segment'));
      }
      return { nodes, links };
    }
    case 'ring': {
      const R = 110;
      const labs = ['Ring — Node A', 'Ring — Node B', 'Ring — Node C', 'Ring — Node D'];
      const types = ['switch', 'switch', 'switch', 'router'];
      const angles = [-90, 0, 90, 180];
      const nodes = types.map((type, i) => {
        const p = polar(ax, ay, angles[i], R);
        return node(type, labs[i], p.x - 45, p.y - 28);
      });
      const links = [];
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const b = nodes[(i + 1) % nodes.length];
        links.push(link(a.id, b.id, 'fiber', 'Ring'));
      }
      return { nodes, links };
    }
    case 'mesh': {
      const R = 95;
      const angles = [-90, 30, 150];
      const nodes = ['switch', 'switch', 'ap'].map((type, i) => {
        const p = polar(ax, ay, angles[i], R);
        return node(
          type,
          `Mesh — ${type === 'ap' ? 'WiFi AP' : `Switch ${i + 1}`}`,
          p.x - 45,
          p.y - 28,
        );
      });
      const links = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          links.push(link(nodes[i].id, nodes[j].id, 'ethernet', 'Mesh'));
        }
      }
      return { nodes, links };
    }
    case 'tree': {
      const r = node('router', 'Tree — Root router', ax - 45, ay - 148);
      const s1 = node('switch', 'Tree — Access A', ax - 125, ay - 28);
      const s2 = node('switch', 'Tree — Access B', ax + 35, ay - 28);
      const p1 = node('pc', 'Tree — Leaf PC 1', ax - 185, ay + 100);
      const p2 = node('laptop', 'Tree — Leaf laptop', ax - 65, ay + 100);
      const p3 = node('server', 'Tree — Server', ax + 35, ay + 100);
      const nodes = [r, s1, s2, p1, p2, p3];
      const links = [
        link(r.id, s1.id, 'fiber', 'Uplink'),
        link(r.id, s2.id, 'fiber', 'Uplink'),
        link(s1.id, p1.id, 'ethernet', ''),
        link(s1.id, p2.id, 'ethernet', ''),
        link(s2.id, p3.id, 'ethernet', ''),
      ];
      return { nodes, links };
    }
    case 'hybrid': {
      const r = node('router', 'Hybrid — Edge', ax - 45, ay - 120);
      const fw = node('firewall', 'Hybrid — Policy', ax - 45, ay - 28);
      const sw = node('switch', 'Hybrid — Core', ax - 45, ay + 72);
      const pc1 = node('pc', 'Hybrid — Bus PC 1', ax - 200, ay + 72);
      const pc2 = node('pc', 'Hybrid — Bus PC 2', ax - 200, ay + 170);
      const ap = node('ap', 'Hybrid — Star AP', ax + 120, ay + 40);
      const cam = node('camera', 'Hybrid — Star cam', ax + 120, ay + 150);
      const nodes = [r, fw, sw, pc1, pc2, ap, cam];
      const links = [
        link(r.id, fw.id, 'wan', 'WAN'),
        link(fw.id, sw.id, 'ethernet', ''),
        link(sw.id, pc1.id, 'ethernet', 'Bus'),
        link(pc1.id, pc2.id, 'ethernet', 'Bus'),
        link(sw.id, ap.id, 'ethernet', 'PoE'),
        link(sw.id, cam.id, 'ethernet', 'PoE'),
      ];
      return { nodes, links };
    }
    default:
      return { nodes: [], links: [] };
  }
}

/** @type {TopologyPatternMeta[]} */
export const TOPOLOGY_PATTERNS = [
  { id: 'star', label: 'Star segment', description: 'Switch hub + 5 endpoints', icon: '✶' },
  { id: 'bus', label: 'Bus segment', description: 'Linear backbone chain', icon: '▬' },
  { id: 'ring', label: 'Ring segment', description: '4-node redundant loop', icon: '○' },
  { id: 'mesh', label: 'Mesh cluster', description: '3-node full mesh', icon: '△' },
  { id: 'tree', label: 'Tree segment', description: 'Root + two access + leaves', icon: '⌇' },
  { id: 'hybrid', label: 'Hybrid segment', description: 'Star + bus + edge', icon: '✦' },
];

export const TOPOLOGY_PATTERN_IDS = new Set(TOPOLOGY_PATTERNS.map((p) => p.id));

/** Map free-text prompt to a pattern id, or null. */
export function patternIdFromPrompt(text) {
  const t = String(text || '').toLowerCase();
  if (/\bhybrid\b/.test(t)) return 'hybrid';
  if (/\b(full[-\s]?)?mesh\b|\bmesh\s+topology\b/.test(t)) return 'mesh';
  if (/\bring\b/.test(t)) return 'ring';
  if (/\b(bus|backbone|daisy[-\s]?chain)\b/.test(t)) return 'bus';
  if (/\b(tree|hierarchical|spoke)\b/.test(t)) return 'tree';
  if (/\bstar\b/.test(t)) return 'star';
  return null;
}
