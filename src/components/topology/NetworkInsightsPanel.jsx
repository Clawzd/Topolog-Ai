import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Layers3,
  Network,
  Wand2,
  X,
  Sparkles,
  Crosshair,
  Wrench,
  HelpCircle,
} from 'lucide-react';
import { LINK_TYPES } from '../../lib/topologyData';
import { validateTopology } from '../../lib/networkArtifacts';
import HistoryPanel from './HistoryPanel';

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getDegreeMap(nodes, links) {
  const degree = Object.fromEntries(nodes.map(node => [node.id, 0]));
  links.forEach(link => {
    if (degree[link.source] !== undefined) degree[link.source] += 1;
    if (degree[link.target] !== undefined) degree[link.target] += 1;
  });
  return degree;
}

function buildInsights(nodes, links, vlans) {
  const degree = getDegreeMap(nodes, links);
  const disconnected = nodes.filter(node => (degree[node.id] || 0) === 0);
  const typeCounts = countBy(nodes, node => node.type);
  const linkCounts = countBy(links, link => link.type);
  const vlanCoverage = nodes.length
    ? Math.round((nodes.filter(node => node.vlan).length / nodes.length) * 100)
    : 0;
  const centralNode = nodes
    .slice()
    .sort((a, b) => (degree[b.id] || 0) - (degree[a.id] || 0))[0];

  const maxDegree = Math.max(0, ...Object.values(degree));
  const avgDegree = nodes.length ? (Object.values(degree).reduce((a, b) => a + b, 0) / nodes.length).toFixed(1) : 0;

  const wirelessLinks = links.filter(l => l.type === 'wifi').length;
  const wiredLinks = links.length - wirelessLinks;

  const risks = [];
  if (!typeCounts.firewall && nodes.length > 2) risks.push('No firewall is protecting the edge.');
  if (disconnected.length) risks.push(`${disconnected.length} device${disconnected.length > 1 ? 's are' : ' is'} disconnected.`);
  if (nodes.length > 5 && vlans.length === 0) risks.push('No VLANs defined for network segmentation.');
  if (links.length < Math.max(0, nodes.length - 1)) risks.push('The graph may contain isolated islands.');
  if (typeCounts.ap && vlans.length === 0) risks.push('Wireless APs without VLAN segmentation.');
  if (!risks.length) risks.push('Core structure looks ready for review.');

  const moves = [];
  if (!typeCounts.firewall && nodes.length > 2) moves.push('Place a firewall between WAN and core.');
  if (vlans.length === 0 && nodes.length > 5) moves.push('Create user, guest, server, and operations VLANs.');
  if (!links.some(link => link.type === 'fiber') && nodes.length > 8) moves.push('Use fiber for core or distribution uplinks.');
  if (disconnected.length) moves.push('Connect every endpoint before export.');
  if (typeCounts.cloud && !typeCounts.firewall) moves.push('Add edge firewall before Internet link.');
  if (!moves.length) moves.push('Label critical bandwidths and export the design brief.');

  return {
    risks, moves, typeCounts, linkCounts, vlanCoverage, centralNode,
    maxDegree, avgDegree, wirelessLinks, wiredLinks, disconnectedCount: disconnected.length,
  };
}

function Sparkline({ values }) {
  if (!values?.length) return null;
  const w = 72;
  const h = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * w;
    const y = h - ((v - min) / span) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke="rgba(6,182,212,0.7)" strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function ScoreRing({ value }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = (value / 100) * c;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(55,65,81,0.6)" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none" stroke="rgba(6,182,212,0.9)" strokeWidth="6"
        strokeDasharray={`${p} ${c}`} strokeLinecap="round" transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor" className="text-foreground">
        {value}
      </text>
    </svg>
  );
}

export default function NetworkInsightsPanel({
  nodes,
  links,
  vlans,
  smartSnapshot,
  scoreHistory = [],
  scoreDelta = 0,
  historySnapshots = [],
  onJumpHistory,
  onHighlightFinding,
  onAutoFixFinding,
  onAutoFixAll,
  onAutoLayout,
  onOpenVlanManager,
  onTemplates,
  onValidate,
  onExportBrief,
  onExportConfig,
  onShare,
  onClose,
}) {
  const insights = buildInsights(nodes, links, vlans);
  const validation = validateTopology({ nodes, links, vlans });
  const [whyId, setWhyId] = useState(null);

  const engineFindings = smartSnapshot?.findings || [];
  const mergedFindings = useMemo(() => {
    const fromEngine = engineFindings.map(f => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      detail: f.detail,
      nodeIds: f.nodeIds,
      autoFix: f.autoFix,
      whyLines: f.whyLines,
    }));
    const fromVal = validation.findings.map((f, i) => ({
      id: `v_${i}`,
      severity: f.severity,
      title: f.title,
      detail: f.detail,
      nodeIds: [],
      autoFix: null,
      whyLines: [],
    }));
    const seen = new Set();
    const out = [];
    [...fromEngine, ...fromVal].forEach(f => {
      const k = f.title + f.detail;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(f);
    });
    return out.slice(0, 24);
  }, [engineFindings, validation.findings]);

  const scores = smartSnapshot?.overallScores || {
    coverage: validation.score,
    capacity: validation.score,
    security: validation.score,
    resilience: validation.score,
    power: validation.score,
  };
  const overall = smartSnapshot?.overallScore ?? validation.score;
  const confidence = Math.min(96, Math.max(52, overall + Math.round((mergedFindings.length % 5) * 3)));

  const bar = (label, v) => (
    <div key={label} className="space-y-0.5">
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">{Math.round(v)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
          style={{ width: `${Math.min(100, v)}%` }}
        />
      </div>
    </div>
  );

  return (
    <aside className="absolute bottom-3 left-3 z-20 w-[min(440px,calc(100%-1.5rem))] max-h-[min(520px,calc(100vh-8rem))] overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-md flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Network className="h-4 w-4 text-primary" />
            Network Intelligence
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Deterministic coverage, capacity, and policy checks — updated live as you edit.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Hide insights"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[auto,1fr]">
          <ScoreRing value={overall} />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <Sparkles className="w-3 h-3" /> {confidence}%
              </span>
            </div>
            {scoreDelta !== 0 && (
              <div className={`text-[10px] font-mono ${scoreDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {scoreDelta > 0 ? '+' : ''}{scoreDelta} vs last edit
              </div>
            )}
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
              <span>Trend</span>
              <Sparkline values={scoreHistory.length ? scoreHistory : [overall]} />
            </div>
            <div className="grid gap-2">
              {bar('Coverage', scores.coverage)}
              {bar('Capacity', scores.capacity)}
              {bar('Security', scores.security)}
              {bar('Resilience', scores.resilience)}
              {bar('Power', scores.power)}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              Findings ({mergedFindings.length})
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {mergedFindings.map((item) => {
                const sev = item.severity;
                const dotColor = sev === 'high' ? 'bg-rose-400' : sev === 'medium' ? 'bg-amber-400' : 'bg-blue-400';
                return (
                  <div key={item.id} className="rounded-lg bg-muted/35 px-2 py-2 text-[10px] leading-relaxed text-muted-foreground space-y-1">
                    <div className="flex gap-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`} />
                      <span className="flex-1 text-foreground/90">{item.title}: {item.detail}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pl-3.5">
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1.5 py-0.5 text-[9px] hover:bg-muted"
                        onClick={() => onHighlightFinding?.(item.nodeIds)}
                      >
                        <Crosshair className="w-2.5 h-2.5" /> Highlight
                      </button>
                      {item.autoFix && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 rounded border border-primary/40 px-1.5 py-0.5 text-[9px] text-primary hover:bg-primary/10"
                          onClick={() => onAutoFixFinding?.(item.autoFix)}
                        >
                          <Wrench className="w-2.5 h-2.5" /> Auto fix
                        </button>
                      )}
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1.5 py-0.5 text-[9px] hover:bg-muted"
                        onClick={() => setWhyId(whyId === item.id ? null : item.id)}
                      >
                        <HelpCircle className="w-2.5 h-2.5" /> Why?
                      </button>
                    </div>
                    {whyId === item.id && (item.whyLines?.length ? (
                      <div className="pl-3.5 text-[9px] text-muted-foreground/90 border-l border-border/60 ml-1 space-y-0.5">
                        {item.whyLines.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    ) : (
                      <div className="pl-3.5 text-[9px] text-muted-foreground/80 border-l border-border/60 ml-1">
                        Derived from topology rules (distance, barriers, VLANs, redundancy).
                      </div>
                    ))}
                  </div>
                );
              })}
              {!mergedFindings.length && (
                <div className="flex gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[10px] text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  No issues detected
                </div>
              )}
            </div>
            {mergedFindings.some(f => f.autoFix) && (
              <button
                type="button"
                onClick={() => onAutoFixAll?.(mergedFindings)}
                className="mt-2 w-full text-[9px] rounded-lg border border-primary/40 py-1.5 text-primary hover:bg-primary/10"
              >
                Fix all auto-fixable
              </button>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <Layers3 className="h-3 w-3" />
              Recommendations
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {insights.moves.slice(0, 5).map((move, idx) => (
                <div key={idx} className="rounded-lg bg-muted/35 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
                  → {move}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <button type="button" onClick={onAutoLayout}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
            <Wand2 className="h-3 w-3" /> Auto Layout
          </button>
          {[
            { label: 'VLANs', onClick: onOpenVlanManager },
            { label: 'Templates', onClick: onTemplates },
            { label: 'Validate', onClick: onValidate },
            { label: 'Brief', onClick: onExportBrief },
            { label: 'Config', onClick: onExportConfig },
            { label: 'Share', onClick: onShare },
          ].map(btn => (
            <button key={btn.label} type="button" onClick={btn.onClick}
              className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[10px] font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground">
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[9px] text-muted-foreground flex-wrap">
          {Object.entries(insights.linkCounts).slice(0, 3).map(([type, count]) => (
            <span key={type} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: LINK_TYPES[type]?.color || '#6b7280' }} />
              {count} {LINK_TYPES[type]?.label || type}
            </span>
          ))}
          {!Object.keys(insights.linkCounts).length && 'No links yet'}
        </div>

        {smartSnapshot?.bottleneckLinks?.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Top bottlenecks</div>
            <ul className="text-[9px] text-muted-foreground space-y-0.5">
              {smartSnapshot.bottleneckLinks.slice(0, 5).map(b => (
                <li key={b.linkId} className="truncate">{b.label} — {Math.round(b.utilization)}%</li>
              ))}
            </ul>
          </div>
        )}

        <HistoryPanel snapshots={historySnapshots} onJumpTo={onJumpHistory} />
      </div>
    </aside>
  );
}

export { buildInsights };
