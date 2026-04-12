import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Sparkles, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { generateTopologyFromPrompt, getTopologyAiProviderLabel } from '@/lib/topologyAiProvider';
import { generateId } from '../../lib/topologyData';

const EXAMPLE_PROMPTS = [
  'Small office with 15 employees, 2 departments, WiFi coverage throughout',
  '3-story building with server room, VoIP phones, and guest WiFi',
  'Home office with NAS, IP cameras, and mesh WiFi system',
  'Retail store with POS terminals, guest WiFi, and security cameras',
  'University campus with student, faculty, and admin network segments',
  'Warehouse with IoT sensors, cameras, and a protected operations VLAN',
  'Data center edge with redundant routers, firewalls, and storage tier',
];

/**
 * @typedef {object} AIPanelProps
 * @property {(topology: any, prompt: string) => void} onTopologyGenerated
 * @property {(topology: any, prompt: string) => void} onRefinement
 * @property {boolean} hasTopology
 */

const AIPanel = forwardRef(
  /**
   * @param {AIPanelProps} props
   * @param {import('react').ForwardedRef<{ submitGenerate: () => void }>} ref
   */
  function AIPanel({ onTopologyGenerated, onRefinement, hasTopology }, ref) {
  const [prompt, setPrompt] = useState('');
  const [exampleRotate, setExampleRotate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showExamples, setShowExamples] = useState(false);
  const [error, setError] = useState('');
  const providerLabel = getTopologyAiProviderLabel();
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
      const topology = await generateTopologyFromPrompt(cleanText);

      // Ensure all IDs are unique
      const fixedTopology = {
        ...topology,
        nodes: topology.nodes.map(n => ({ ...n, id: generateId('n'), vlan: n.vlan || null })),
        links: [],
        rooms: topology.rooms.map(r => ({ ...r, id: generateId('r') })),
        vlans: topology.vlans.map(v => ({ ...v, id: generateId('vlan') })),
      };
      // Re-map link source/target to new node IDs
      const idMap = {};
      topology.nodes.forEach((n, i) => { idMap[n.id] = fixedTopology.nodes[i].id; });
      fixedTopology.links = topology.links.map(l => ({
        ...l,
        id: generateId('l'),
        source: idMap[l.source] || l.source,
        target: idMap[l.target] || l.target,
      }));
      const entry = {
        id: Date.now(),
        prompt: cleanText,
        summary: fixedTopology.summary,
        isRefinement,
        timestamp: new Date().toLocaleTimeString(),
      };
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
                  {h.isRefinement && (
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Refinement</span>
                  )}
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
