import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Sparkles, Send, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  generateTopologyEditsFromPrompt,
  generateTopologyFromPrompt,
  getTopologyAiConnectionStatus,
} from '@/lib/topologyAiProvider';
import { DEVICE_TYPES, generateId } from '../../lib/topologyData';
import { patternIdFromPrompt } from '../../lib/topologyPatterns';
import { recommendTopology } from '../../lib/smartLayout';

// Example prompts are written as explicit per-room device lists so the LLM
// does not have to disambiguate parentheticals or guess what each room
// contains. Keep counts hard-attached to the room name (no "(15 ws)" style),
// and name the device type the user actually wants (pc vs laptop) — the AI
// will otherwise add laptops alongside requested PCs to "fill out" a room.
const EXAMPLE_PROMPTS = [
  'Small office, star topology. Reception: 1 desktop PC, 1 WiFi access point. Open Office: 15 desktop workstations, 1 WiFi access point. Meeting Room: empty. One core switch connects every device. Use only PCs, switches, and APs — do not add laptops, phones, printers, cameras, or other devices.',
  '3-story office, tree topology. Server Room: 1 server. Floor 1 Workspace: 8 VoIP phones, 1 guest WiFi AP. Floor 2 Workspace: 8 VoIP phones, 1 guest WiFi AP. Floor 3 Workspace: 8 VoIP phones, 1 guest WiFi AP. Per-floor access switches feed one core switch in the Server Room. No PCs, laptops, printers, or cameras.',
  'Home network, star topology. Living Room: 1 mesh WiFi AP, 1 NAS. Home Office: 1 router, 2 laptops. Bedroom: 1 mesh WiFi AP, 2 IP cameras. Router uplinks to the internet. No phones, printers, or extra workstations.',
  'Retail store, star topology. Sales Floor: 4 POS terminals (PCs), 1 guest WiFi AP, 3 security cameras. Stockroom: empty. Back Office: 1 core switch. All devices connect to the core switch. No laptops, phones, or printers.',
  'University campus, tree topology. Student Lab: 12 desktop PCs on a student VLAN. Faculty Office: 6 laptops on a faculty VLAN. Admin Office: 4 laptops on an admin VLAN. Server Room: 2 servers, 1 core switch, 1 firewall. One distribution switch per room feeds the core. No phones, printers, cameras, or tablets.',
  'Warehouse, star topology. Operations Floor: 8 IoT sensors and 6 IP cameras on a protected operations VLAN. Loading Dock: 2 IP cameras. Server Closet: 1 core switch, 1 firewall. Every device connects to the core switch. No PCs, laptops, phones, or printers.',
  'Data center, mesh topology between core devices. Core Row: 2 redundant core switches and 2 redundant routers, all interconnected. Storage Row: 4 servers, 2 NAS units. Edge Cage: 2 firewalls. Each access switch in Storage Row uplinks to both core switches. No PCs, laptops, phones, cameras, or printers.',
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
          <h2 className="text-sm font-semibold text-foreground flex-1">AI Topology Designer</h2>
          <button
            type="button"
            onClick={() => {
              setPrompt('');
              setLatestInsight(null);
              setHistory([]);
              setError('');
              setShowExamples(false);
              setExampleRotate(0);
            }}
            disabled={loading}
            title="Reset AI panel (clears prompt, last design, and history)"
            className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
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

      <div className="flex-1 overflow-y-auto min-h-0">
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
            placeholder={hasTopology ? 'Refine: add a DMZ, change WiFi coverage…' : 'Describe your space…'}
            rows={10}
            maxLength={4000}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-y leading-relaxed min-h-[200px]"
          />
          <div className="flex items-center justify-end mt-1">
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
            <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground break-words">{latestInsight.summary}</p>

            <div className="mt-2.5 space-y-2">
              <div>
                <p className="text-[10px] font-medium text-foreground">Why this topology</p>
                <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground break-words">{latestInsight.why}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-foreground">Rooms and zones</p>
                {latestInsight.rooms.length > 0 ? (
                  <div className="mt-1.5 space-y-1.5">
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
        <div className="p-3">
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
                <p className="text-[10px] leading-relaxed text-foreground break-words mb-1">{h.prompt}</p>
                <p className="text-[9px] leading-relaxed text-muted-foreground break-words">{h.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
  }
);

export default AIPanel;
