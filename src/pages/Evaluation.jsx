import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTopologyCanvasStore } from '../stores/topologyCanvasStore';
import { computeSmartTopology } from '../lib/smartNetworkEngine';
import { validateTopology } from '../lib/networkArtifacts';

function mergeFindings(engineList, validationList) {
  const fromEngine = (engineList || []).map((f) => ({
    severity: f.severity,
    title: f.title,
    detail: f.detail,
  }));
  const fromVal = (validationList || []).map((f) => ({
    severity: f.severity,
    title: f.title,
    detail: f.detail,
  }));
  const seen = new Set();
  const out = [];
  [...fromEngine, ...fromVal].forEach((f) => {
    const k = `${f.title}\n${f.detail}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  });
  return out;
}

function dot(sev) {
  if (sev === 'high') return 'bg-rose-400';
  if (sev === 'medium') return 'bg-amber-400';
  return 'bg-sky-400';
}

export default function Evaluation() {
  const nodes = useTopologyCanvasStore((s) => s.nodes);
  const links = useTopologyCanvasStore((s) => s.links);
  const rooms = useTopologyCanvasStore((s) => s.rooms);
  const vlans = useTopologyCanvasStore((s) => s.vlans);
  const barriers = useTopologyCanvasStore((s) => s.barriers);
  const vlanZones = useTopologyCanvasStore((s) => s.vlanZones);
  const powerZones = useTopologyCanvasStore((s) => s.powerZones);

  const smartSnapshot = useMemo(
    () =>
      computeSmartTopology({
        nodes,
        links,
        rooms,
        vlans,
        barriers,
        vlanZones,
        powerZones,
      }),
    [nodes, links, rooms, vlans, barriers, vlanZones, powerZones]
  );

  const validation = useMemo(
    () => validateTopology({ nodes, links, vlans }),
    [nodes, links, vlans]
  );

  const allFindings = useMemo(
    () => mergeFindings(smartSnapshot?.findings, validation.findings),
    [smartSnapshot?.findings, validation.findings]
  );
  const findings = allFindings.slice(0, 8);
  const findingsTotal = allFindings.length;

  const overall = smartSnapshot?.overallScore ?? validation.score;
  const empty = nodes.length === 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <h1 className="text-sm font-semibold">Design evaluation</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {empty ? (
          <p className="text-sm text-muted-foreground">
            Nothing on the canvas yet. Build or load a design on the main page, then return here.
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall score</p>
              <p className="text-5xl font-bold tabular-nums leading-none">{Math.round(overall)}</p>
              <p className="mt-1 text-xs text-muted-foreground">From the same smart checks as the canvas (live data).</p>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {findingsTotal === 0
                  ? 'Findings'
                  : findingsTotal > 8
                    ? `Findings (showing 8 of ${findingsTotal})`
                    : `Findings (${findingsTotal})`}
              </p>
              {findingsTotal === 0 ? (
                <p className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300/90">
                  No issues flagged.
                </p>
              ) : (
                <ul className="space-y-2">
                  {findings.map((f, i) => (
                    <li key={`${f.title}-${i}`} className="flex gap-2 rounded-md border border-border/70 bg-card/40 px-3 py-2 text-sm">
                      <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot(f.severity)}`} />
                      <div>
                        <p className="font-medium leading-snug">{f.title}</p>
                        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{f.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
