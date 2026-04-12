import { AlertTriangle, CheckCircle2, Layers3, Network, Route, ShieldCheck, Wand2, X } from 'lucide-react';
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

  let score = 100;
  if (!typeCounts.firewall && nodes.length > 2) score -= 22;
  if (nodes.length > 5 && vlans.length === 0) score -= 18;
  if (disconnected.length) score -= Math.min(24, disconnected.length * 8);
  if (links.length < Math.max(0, nodes.length - 1)) score -= 12;
  if ((typeCounts.switch || 0) > 2 && !links.some(link => link.type === 'fiber')) score -= 8;
  score = Math.max(0, score);

  const risks = [];
  if (!typeCounts.firewall && nodes.length > 2) risks.push('No firewall is protecting the edge.');
  if (disconnected.length) risks.push(`${disconnected.length} device${disconnected.length > 1 ? 's are' : ' is'} disconnected.`);
  if (nodes.length > 5 && vlans.length === 0) risks.push('No VLANs are defined for segmentation.');
  if (links.length < Math.max(0, nodes.length - 1)) risks.push('The graph may contain isolated islands.');
  if (!risks.length) risks.push('Core structure looks ready for review.');

  const moves = [];
  if (!typeCounts.firewall && nodes.length > 2) moves.push('Place a firewall between WAN and core.');
  if (vlans.length === 0 && nodes.length > 5) moves.push('Create user, guest, server, and operations VLANs.');
  if (!links.some(link => link.type === 'fiber') && nodes.length > 8) moves.push('Use fiber for core or distribution uplinks.');
  if (disconnected.length) moves.push('Connect every endpoint before export.');
  if (!moves.length) moves.push('Label critical bandwidths and export the design brief.');

  return { score, risks, moves, typeCounts, linkCounts, vlanCoverage, centralNode };
}

function ScoreBadge({ score }) {
  const tone = score >= 80 ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
    : score >= 55 ? 'text-amber-200 border-amber-400/30 bg-amber-500/10'
      : 'text-rose-200 border-rose-400/30 bg-rose-500/10';

  return (
    <div className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border ${tone}`}>
      <div className="text-center">
        <div className="text-xl font-semibold leading-none">{score}</div>
        <div className="mt-1 text-[9px] uppercase tracking-widest">Score</div>
      </div>
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
    <aside className="absolute bottom-3 left-3 z-20 w-[min(420px,calc(100%-1.5rem))] overflow-hidden rounded-lg border border-border bg-card/95 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Network className="h-4 w-4 text-primary" />
            Network Intelligence
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Design checks for segmentation, edge protection, link mix, and disconnected devices.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Hide insights"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[auto,1fr]">
        <ScoreBadge score={validation.score} />
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/70 bg-muted/40 p-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
              VLAN Coverage
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">{insights.vlanCoverage}%</div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/40 p-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Route className="h-3 w-3 text-primary" />
              Central Device
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">
              {insights.centralNode?.label || 'None'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Checks
          </div>
          <div className="space-y-1.5">
            {(validation.findings.length ? validation.findings.slice(0, 3) : insights.risks.slice(0, 3)).map(item => (
              <div key={typeof item === 'string' ? item : item.title} className="flex gap-2 rounded-lg bg-muted/35 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" />
                <span>{typeof item === 'string' ? item : `${item.title}: ${item.detail}`}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Layers3 className="h-3 w-3" />
            Next Moves
          </div>
          <div className="space-y-1.5">
            {insights.moves.slice(0, 3).map(move => (
              <div key={move} className="rounded-lg bg-muted/35 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
                {move}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={onAutoLayout}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Wand2 className="h-3 w-3" />
          Auto Layout
        </button>
        <button
          type="button"
          onClick={onOpenVlanManager}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          VLAN Plan
        </button>
        <button
          type="button"
          onClick={onTemplates}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Templates
        </button>
        <button
          type="button"
          onClick={onValidate}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Validate
        </button>
        <button
          type="button"
          onClick={onExportBrief}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Brief
        </button>
        <button
          type="button"
          onClick={onExportConfig}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Config
        </button>
        <button
          type="button"
          onClick={onShare}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Share
        </button>
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
