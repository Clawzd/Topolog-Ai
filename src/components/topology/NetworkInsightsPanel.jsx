import { AlertTriangle, CheckCircle2, Layers3, Network, Route, ShieldCheck, Wand2, X, Activity, Wifi, Server } from 'lucide-react';
import { LINK_TYPES } from '../../lib/topologyData';
import { validateTopology } from '../../lib/networkArtifacts';

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

  // Compute topology depth (layers from edge to leaf)
  const maxDegree = Math.max(0, ...Object.values(degree));
  const avgDegree = nodes.length ? (Object.values(degree).reduce((a, b) => a + b, 0) / nodes.length).toFixed(1) : 0;

  // Count wireless vs wired
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

function ScoreBadge({ score }) {
  const tone = score >= 80 ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
    : score >= 55 ? 'text-amber-200 border-amber-400/30 bg-amber-500/10'
      : 'text-rose-200 border-rose-400/30 bg-rose-500/10';

  const label = score >= 80 ? 'Good' : score >= 55 ? 'Fair' : 'Needs Work';

  return (
    <div className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border ${tone}`}>
      <div className="text-center">
        <div className="text-xl font-bold leading-none">{score}</div>
        <div className="mt-1 text-[8px] uppercase tracking-widest opacity-70">{label}</div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconColor, label, value }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 p-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon className={`h-3 w-3 ${iconColor}`} />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default function NetworkInsightsPanel({
  nodes,
  links,
  vlans,
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

  return (
    <aside className="absolute bottom-3 left-3 z-20 w-[min(440px,calc(100%-1.5rem))] overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Network className="h-4 w-4 text-primary" />
            Network Intelligence
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Real-time design analysis — segmentation, redundancy, edge protection.
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

      {/* Score + Stats */}
      <div className="grid gap-3 p-4 sm:grid-cols-[auto,1fr]">
        <ScoreBadge score={validation.score} />
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={ShieldCheck} iconColor="text-emerald-300" label="VLAN Coverage" value={`${insights.vlanCoverage}%`} />
          <StatCard icon={Route} iconColor="text-primary" label="Central Device" value={insights.centralNode?.label || 'None'} />
          <StatCard icon={Activity} iconColor="text-amber-300" label="Avg Connections" value={insights.avgDegree} />
          <StatCard icon={Wifi} iconColor="text-violet-300" label="Wireless Links" value={`${insights.wirelessLinks} / ${links.length}`} />
        </div>
      </div>

      {/* Findings + Moves */}
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Findings
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {(validation.findings.length ? validation.findings.slice(0, 5) : insights.risks.slice(0, 3)).map((item, idx) => {
              const text = typeof item === 'string' ? item : `${item.title}: ${item.detail}`;
              const severity = typeof item === 'string' ? null : item.severity;
              const dotColor = severity === 'high' ? 'bg-rose-400' : severity === 'medium' ? 'bg-amber-400' : severity === 'low' ? 'bg-blue-400' : 'bg-primary';
              return (
                <div key={idx} className="flex gap-2 rounded-lg bg-muted/35 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
                  <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`} />
                  <span>{text}</span>
                </div>
              );
            })}
            {!validation.findings.length && !insights.risks.length && (
              <div className="flex gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[10px] text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
                No issues found
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Layers3 className="h-3 w-3" />
            Recommendations
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {insights.moves.slice(0, 4).map((move, idx) => (
              <div key={idx} className="rounded-lg bg-muted/35 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
                → {move}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-4 py-3">
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
        <div className="ml-auto flex items-center gap-2 text-[9px] text-muted-foreground">
          {Object.entries(insights.linkCounts).slice(0, 3).map(([type, count]) => (
            <span key={type} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: LINK_TYPES[type]?.color || '#6b7280' }} />
              {count} {LINK_TYPES[type]?.label || type}
            </span>
          ))}
          {!Object.keys(insights.linkCounts).length && 'No links yet'}
        </div>
      </div>
    </aside>
  );
}

export { buildInsights };
