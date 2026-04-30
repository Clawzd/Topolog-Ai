import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Sparkles, Send, ChevronDown, ChevronUp } from 'lucide-react';
import {
  generateTopologyEditsFromPrompt,
  generateTopologyFromPrompt,
  getTopologyAiProviderLabel,
  getTopologyAiConnectionStatus,
} from '@/lib/topologyAiProvider';
import { DEVICE_TYPES, generateId } from '../../lib/topologyData';
import { patternIdFromPrompt } from '../../lib/topologyPatterns';
import { recommendTopology } from '../../lib/smartLayout';

const EXAMPLE_PROMPTS = [
  'Small office with 15 employees, 2 departments, WiFi coverage throughout, glass meeting-room wall, drywall partitions, and one door to the server closet',
  '3-story building with server room, VoIP phones, guest WiFi, concrete stairwell walls, cable conduit between floors, and windows along the office edge',
  'Home office with NAS, IP cameras, mesh WiFi system, brick exterior walls, interior drywall, furniture obstacles, and a garage door opening',
  'Retail store with POS terminals, guest WiFi, security cameras, glass storefront windows, metal shelving obstacles, stockroom wall, and checkout counter barrier',
  'University campus with student, faculty, and admin network segments, separate rooms, concrete lab walls, glass faculty office partitions, doors, and RF noise near the cafeteria',
  'Warehouse with IoT sensors, cameras, protected operations VLAN, metal racks as obstacles, concrete perimeter walls, loading dock doors, and cable tray raceways',
  'Data center edge with redundant routers, firewalls, storage tier, server-room walls, hot/cold aisle rack obstacles, cable trays, and an RF-shielded secure cage',
];

const TOPOLOGY_LABELS = {
  star: 'Star',
  bus: 'Bus',
  ring: 'Ring',
  mesh: 'Mesh',
  tree: 'Tree',
  hybrid: 'Hybrid',
};

const TOPOLOGY_REASONS = {
  star: 'The design centers devices around one main hub, which keeps a small network simple and easy to manage.',
  bus: 'The design uses one shared backbone cable with devices tapping directly into it, which matches a classic bus layout.',
  ring: 'The design forms a closed loop so traffic can follow a circular path between backbone devices.',
  mesh: 'The design emphasizes redundant interconnections between core devices for resilience and failover.',
  tree: 'The design follows a layered hierarchy from core to access to endpoints, which fits most structured building networks.',
  hybrid: 'The design mixes backbone and star-style segments to serve different zones with a shared core.',
};

function getNodeCenter(node) {
  return { x: node.x + 45, y: node.y + 28 };
}

function roomContainsNode(room, node) {
  const { x, y } = getNodeCenter(node);
  return x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h;
}

function inferTopologyType(topology, prompt) {
  const summary = String(topology?.summary || '').toLowerCase();
  for (const id of ['hybrid', 'mesh', 'ring', 'tree', 'star', 'bus']) {
    if (summary.includes(id)) return id;
  }

  const barriers = Array.isArray(topology?.barriers) ? topology.barriers : [];
  const links = Array.isArray(topology?.links) ? topology.links : [];
  const nodes = Array.isArray(topology?.nodes) ? topology.nodes.filter((n) => !n.isBusAnchor) : [];

  if (barriers.some((b) => b.environmentKind === 'bus')) {
    const busLinkCount = links.filter((l) => l.busId).length;
    const nonBusLinkCount = links.filter((l) => !l.busId).length;
    return nonBusLinkCount > Math.max(3, Math.floor(busLinkCount / 2)) ? 'hybrid' : 'bus';
  }

  const explicit = patternIdFromPrompt(prompt);
  if (explicit) return explicit;

  if (nodes.length > 0) {
    const wiredLinks = links.filter((l) => l.type !== 'wifi');
    const degree = new Map(nodes.map((n) => [n.id, 0]));
    wiredLinks.forEach((l) => {
      if (degree.has(l.source)) degree.set(l.source, degree.get(l.source) + 1);
      if (degree.has(l.target)) degree.set(l.target, degree.get(l.target) + 1);
    });
    const maxDegree = Math.max(...degree.values(), 0);
    if (maxDegree >= Math.max(3, nodes.length - 2)) return 'star';
  }

  return recommendTopology(prompt).topology;
}

function describeRoomDevices(nodesInRoom) {
  if (!nodesInRoom.length) return 'No devices placed here.';

  const counts = new Map();
  nodesInRoom.forEach((node) => {
    const label = DEVICE_TYPES[node.type]?.label || node.type;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const topTypes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label, count]) => `${count} ${label}${count === 1 ? '' : 's'}`);

  return `${nodesInRoom.length} device${nodesInRoom.length === 1 ? '' : 's'}: ${topTypes.join(', ')}.`;
}

function buildGenerationInsight(topology, prompt, isRefinement) {
  const nodes = (topology?.nodes || []).filter((n) => !n.isBusAnchor);
  const links = topology?.links || [];
  const rooms = topology?.rooms || [];
  const vlans = topology?.vlans || [];
  const topologyType = inferTopologyType(topology, prompt);
  const topologyLabel = TOPOLOGY_LABELS[topologyType] || 'Structured';
  const roomSummaries = rooms.map((room) => {
    const roomNodes = nodes.filter((node) => roomContainsNode(room, node));
    return {
      id: room.id,
      label: room.label,
      detail: describeRoomDevices(roomNodes),
    };
  });

  const what = isRefinement
    ? `Refined the current design into ${nodes.length} devices, ${links.length} links, ${rooms.length} room${rooms.length === 1 ? '' : 's'}, and ${vlans.length} VLAN${vlans.length === 1 ? '' : 's'}.`
    : `Built a topology with ${nodes.length} devices, ${links.length} links, ${rooms.length} room${rooms.length === 1 ? '' : 's'}, and ${vlans.length} VLAN${vlans.length === 1 ? '' : 's'}.`;

  return {
    topologyType,
    topologyLabel,
    what,
    why: TOPOLOGY_REASONS[topologyType] || recommendTopology(prompt).reason,
    rooms: roomSummaries,
    summary: topology?.summary || 'Generated network topology.',
  };
}

function buildRefinementInsight(editResult) {
  const operations = Array.isArray(editResult?.operations) ? editResult.operations : [];
  const actionCounts = operations.reduce((counts, operation) => {
    const key = String(operation?.op || 'edit').replace(/_/g, ' ');
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const actionText = [...actionCounts.entries()]
    .map(([label, count]) => `${count} ${label}`)
    .join(', ');

  return {
    topologyType: 'edit',
    topologyLabel: 'Canvas Edit',
    what: operations.length
      ? `Applied ${operations.length} canvas edit${operations.length === 1 ? '' : 's'}: ${actionText}.`
      : 'No safe canvas edit was applied.',
    why: 'The AI used the current canvas IDs and the refinement prompt to change the existing design instead of duplicating it.',
    rooms: [],
    summary: editResult?.summary || 'Updated the current topology.',
  };
}

/**
 * @typedef {object} AIPanelProps
 * @property {(topology: any, prompt: string) => void} onTopologyGenerated
 * @property {(topology: any, prompt: string) => void} onRefinement
 * @property {boolean} hasTopology
 * @property {() => object} [getMapState] - Returns current canvas state for AI context
 */

const AIPanel = forwardRef(
  /**
   * @param {AIPanelProps} props
   * @param {import('react').ForwardedRef<{ submitGenerate: () => void }>} ref
   */
  function AIPanel({ onTopologyGenerated, onRefinement, hasTopology, getMapState }, ref) {
  const [prompt, setPrompt] = useState('');
  const [exampleRotate, setExampleRotate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [latestInsight, setLatestInsight] = useState(null);
  const [showExamples, setShowExamples] = useState(false);
  const [error, setError] = useState('');
  const providerLabel = getTopologyAiProviderLabel();
  const aiStatus = getTopologyAiConnectionStatus();
  const generateRef = useRef(null);
  const promptRef = useRef(null);

  const generate = async (text, isRefinement = false) => {
    const cleanText = String(text || '').trim();
    if (!cleanText) {
      setError('Please describe your environment');
      promptRef.current?.focus();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const mapState = getMapState ? getMapState() : undefined;
      if (isRefinement) {
        const editResult = await generateTopologyEditsFromPrompt(cleanText, mapState);
        const insight = buildRefinementInsight(editResult);
        const entry = {
          id: Date.now(),
          prompt: cleanText,
          summary: editResult.summary,
          topologyType: 'Edit',
          isRefinement,
          timestamp: new Date().toLocaleTimeString(),
        };
        setLatestInsight(insight);
        setHistory(h => [entry, ...h.slice(0, 9)]);
        onRefinement(editResult, cleanText);
        setPrompt('');
        return;
      }

      const topology = await generateTopologyFromPrompt(cleanText, mapState);

      // Re-ID nodes, barriers, rooms, vlans so they don't collide with
      // anything already on the canvas, then remap every reference.
      const nodeIdMap = {};
      const newNodes = topology.nodes.map((n) => {
        const nextId = generateId(n.isBusAnchor ? 'bn' : 'n');
        nodeIdMap[n.id] = nextId;
        return { ...n, id: nextId, vlan: n.vlan || null };
      });

      const barrierIdMap = {};
      const newBarriers = (topology.barriers || []).map((b) => {
        const nextId = generateId('b');
        barrierIdMap[b.id] = nextId;
        return { ...b, id: nextId };
      });

      // Bus anchors carry a busId pointing into barriers — remap.
      for (const node of newNodes) {
        if (node.isBusAnchor && node.busId && barrierIdMap[node.busId]) {
          node.busId = barrierIdMap[node.busId];
        }
      }

      const newLinks = topology.links.map((l) => {
        const remapped = {
          ...l,
          id: generateId('l'),
          source: nodeIdMap[l.source] || l.source,
          target: nodeIdMap[l.target] || l.target,
        };
        if (l.busId && barrierIdMap[l.busId]) remapped.busId = barrierIdMap[l.busId];
        if (l.targetBusAnchorId && nodeIdMap[l.targetBusAnchorId]) {
          remapped.targetBusAnchorId = nodeIdMap[l.targetBusAnchorId];
        }
        if (l.sourceBusAnchorId && nodeIdMap[l.sourceBusAnchorId]) {
          remapped.sourceBusAnchorId = nodeIdMap[l.sourceBusAnchorId];
        }
        return remapped;
      });

      const fixedTopology = {
        ...topology,
        nodes: newNodes,
        links: newLinks,
        rooms: topology.rooms.map((r) => ({ ...r, id: generateId('r') })),
        vlans: topology.vlans.map((v) => ({ ...v, id: generateId('vlan') })),
        barriers: newBarriers,
      };
      const insight = buildGenerationInsight(fixedTopology, cleanText, isRefinement);
      const entry = {
        id: Date.now(),
        prompt: cleanText,
        summary: fixedTopology.summary,
        topologyType: insight.topologyLabel,
        isRefinement,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLatestInsight(insight);
      setHistory(h => [entry, ...h.slice(0, 9)]);
      if (isRefinement) {
        onRefinement(fixedTopology, cleanText);
      } else {
        onTopologyGenerated(fixedTopology, cleanText);
      }
      setPrompt('');
    } catch {
      setError('AI generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateRef.current = () => generate(prompt, hasTopology);
  }, [prompt, hasTopology]);

  useImperativeHandle(ref, () => ({
    submitGenerate: () => { void generateRef.current?.(); },
    focusPrompt: () => {
      promptRef.current?.focus();
      promptRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
  }), []);

  const handleSubmit = (e) => {
    e.preventDefault();
    generate(prompt, hasTopology);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">AI Topology Designer</h2>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {providerLabel} turns a site brief into an editable topology.
        </p>
        {!aiStatus.enabled && (
          <div className="text-[9px] mt-1.5 space-y-1 leading-snug">
            <p className="text-muted-foreground/80">
              For DeepSeek: in <span className="font-mono">.env</span> next to <span className="font-mono">package.json</span>, set{' '}
              <span className="font-mono">VITE_TOPOLOGAI_PROVIDER=deepseek</span> and{' '}
              <span className="font-mono">VITE_DEEPSEEK_API_KEY=…</span>, then stop and restart{' '}
              <span className="font-mono">npm run dev</span> (Vite only loads env at startup).
            </p>
            <p className="text-amber-600/90 dark:text-amber-500/90">
              Vite sees provider <span className="font-mono">{aiStatus.providerRaw}</span>
              {' · '}
              API key: {aiStatus.keyPresent ? 'present' : 'missing'}
              {aiStatus.reasons.length > 0 && (
                <>
                  {' · '}
                  {aiStatus.reasons.join(' ')}
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Prompt input */}
      <div className="p-3 border-b border-border">
        <form onSubmit={handleSubmit}>
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={hasTopology ? 'Refine: add a DMZ, change WiFi coverage…' : 'Describe your space, e.g.: 3 rooms — server room, open office with 15 workstations, meeting room. Thick concrete walls. Need full WiFi coverage and camera monitoring.'}
            rows={5}
            maxLength={4000}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-[9px] text-muted-foreground">⌘+Enter / Ctrl+Enter to generate (v3 §631)</p>
            <span className="text-[9px] font-mono text-muted-foreground">{prompt.length} / 4000</span>
          </div>
          {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
          <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              const p = EXAMPLE_PROMPTS[exampleRotate % EXAMPLE_PROMPTS.length];
              setExampleRotate((x) => x + 1);
              setPrompt(p);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 border border-border bg-muted/50 text-foreground text-xs font-medium py-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
          >
            Load example
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[1.4] flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-medium py-2 rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="flex items-end gap-0.5 h-4">
                  <span className="w-1 h-3 bg-primary-foreground rounded-full wave-bar-1 inline-block" />
                  <span className="w-1 h-4 bg-primary-foreground rounded-full wave-bar-2 inline-block" />
                  <span className="w-1 h-2 bg-primary-foreground rounded-full wave-bar-3 inline-block" />
                  <span className="w-1 h-4 bg-primary-foreground rounded-full wave-bar-4 inline-block" />
                  <span className="w-1 h-3 bg-primary-foreground rounded-full wave-bar-5 inline-block" />
                </span>
                {hasTopology ? 'Refining...' : 'Generating...'}
              </span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                {hasTopology ? 'Refine Topology' : 'Generate Topology'}
              </>
            )}
          </button>
          </div>
        </form>
      </div>

      {latestInsight && (
        <div className="p-2.5 border-b border-border bg-muted/25">
          <div className="rounded-lg border border-border/70 bg-card/90 p-2.5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Last AI Design</p>
                <h3 className="text-sm font-semibold text-foreground mt-1">
                  {latestInsight.topologyType === 'edit' ? latestInsight.topologyLabel : `${latestInsight.topologyLabel} topology`}
                </h3>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                {latestInsight.topologyType}
              </span>
            </div>

            <p className="text-[10px] leading-relaxed text-foreground/90">{latestInsight.what}</p>
            <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground line-clamp-3">{latestInsight.summary}</p>

            <div className="mt-2.5 space-y-2">
              <div>
                <p className="text-[10px] font-medium text-foreground">Why this topology</p>
                <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground line-clamp-2">{latestInsight.why}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-foreground">Rooms and zones</p>
                {latestInsight.rooms.length > 0 ? (
                  <div className="mt-1.5 max-h-28 space-y-1.5 overflow-y-auto pr-1">
                    {latestInsight.rooms.map((room) => (
                      <div key={room.id} className="rounded-md bg-muted/55 px-2.5 py-1.5">
                        <p className="text-[10px] font-medium text-foreground">{room.label}</p>
                        <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">{room.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-muted-foreground">No rooms were added in this generation.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Examples */}
      <div className="border-b border-border">
        <button
          onClick={() => setShowExamples(e => !e)}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="uppercase tracking-wider">Example Prompts</span>
          {showExamples ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showExamples && (
          <div className="px-3 pb-3 space-y-1.5">
            {EXAMPLE_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => setPrompt(p)}
                className="w-full text-left text-[10px] text-muted-foreground hover:text-primary bg-muted hover:bg-secondary px-2.5 py-2 rounded transition-all leading-relaxed"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">Recent Generations</p>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="bg-muted rounded-lg p-2.5 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-muted-foreground">{h.timestamp}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                      {h.topologyType}
                    </span>
                    {h.isRefinement && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Refinement</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-foreground line-clamp-2 mb-1">{h.prompt}</p>
                <p className="text-[9px] text-muted-foreground line-clamp-2">{h.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  }
);

export default AIPanel;
