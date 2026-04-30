import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { useTopologyCanvasStore } from '../stores/topologyCanvasStore';
import { computeSmartTopology } from '../lib/smartNetworkEngine';
import { validateTopology } from '../lib/networkArtifacts';

function mergeFindings(engineList, validationList, max = 18) {
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
  return out.slice(0, max);
}

function severityDot(sev) {
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

  const findings = useMemo(
    () => mergeFindings(smartSnapshot?.findings, validation.findings),
    [smartSnapshot?.findings, validation.findings]
  );

  const scores = smartSnapshot?.overallScores ?? {
    coverage: validation.score,
    capacity: validation.score,
    security: validation.score,
    resilience: validation.score,
    power: validation.score,
  };
  const overall = smartSnapshot?.overallScore ?? validation.score;

  const empty = nodes.length === 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Canvas
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardCheck className="h-4 w-4 flex-shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">Evaluation</h1>
              <p className="truncate text-[10px] text-muted-foreground">
                Score and checks for your current design (same data as the canvas).
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {empty ? (
          <p className="text-sm text-muted-foreground">
            The canvas is empty. Add devices on the main page or load a project, then open this page again.
          </p>
        ) : (
          <div className="space-y-8">
            <section className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Overall</p>
                <p className="text-4xl font-bold tabular-nums">{Math.round(overall)}</p>
                <p className="text-[11px] text-muted-foreground">out of 100</p>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-5">
                {[
                  ['Coverage', scores.coverage],
                  ['Capacity', scores.capacity],
                  ['Security', scores.security],
                  ['Resilience', scores.resilience],
                  ['Power', scores.power],
                ].map(([label, v]) => (
                  <div key={label}>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="font-mono tabular-nums text-foreground">{Math.round(v)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Findings ({findings.length})
              </h2>
              {findings.length === 0 ? (
                <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-200/90">
                  No issues reported for this topology.
                </p>
              ) : (
                <ul className="space-y-2">
                  {findings.map((f, i) => (
                    <li
                      key={`${f.title}-${i}`}
                      className="rounded-lg border border-border/60 bg-card/50 px-3 py-2.5 text-sm"
                    >
                      <div className="flex gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${severityDot(f.severity)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground/95">{f.title}</p>
                          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{f.detail}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
