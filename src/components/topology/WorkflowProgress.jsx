import { Fragment } from 'react';

/**
 * TopologAi v3 spec (steps 618–624): nine connected steps with exact labels.
 * Current step is derived from canvas heuristics (see comments).
 */
const STEP_LABELS = [
  'Describe',
  'Generate',
  'Place Devices',
  'Draw Walls',
  'Add Barriers',
  'Set Zones',
  'Review Intelligence',
  'Trace & Simulate',
  'Export',
];

export default function WorkflowProgress({
  hasTopology,
  nodeCount = 0,
  hasRooms,
  hasClassicBarriers,
  hasVlanZonesOrVlans,
  hasLinks,
  insightsOpen,
  pathTraceActive,
  failureActive,
  exportReady,
}) {
  let step = 1;
  if (hasTopology) step = 2;
  if (hasTopology && nodeCount >= 2) step = 3;
  if (hasTopology && hasRooms) step = 4;
  if (hasTopology && hasClassicBarriers) step = 5;
  if (hasTopology && hasVlanZonesOrVlans) step = 6;
  if (hasTopology && insightsOpen) step = 7;
  if (hasTopology && (pathTraceActive || failureActive)) step = 8;
  if (exportReady) step = 9;
  step = Math.min(9, Math.max(1, step));

  return (
    <div className="px-3 py-2.5 border-b border-border/60 bg-card/50">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Workflow</div>
      <div className="flex items-center w-full">
        {STEP_LABELS.map((label, idx) => {
          const n = idx + 1;
          const done = n < step;
          const current = n === step;
          return (
            <Fragment key={label}>
              <div
                title={label}
                className={`flex flex-col items-center flex-1 min-w-0 max-w-[52px] ${
                  current ? 'text-primary' : done ? 'text-primary/70' : 'text-muted-foreground/50'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 transition-all ${
                    current ? 'bg-primary scale-125' : done ? 'bg-primary/80' : 'bg-muted border border-border/80'
                  }`}
                  style={current ? { boxShadow: '0 0 8px hsl(var(--primary) / 0.65)' } : undefined}
                />
                <span className="hidden min-[380px]:block text-[6.5px] leading-tight text-center mt-1 px-0.5 truncate w-full">
                  {label.includes(' ') ? `${label.split(' ')[0]}…` : label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div
                  className={`h-px flex-1 min-w-[1px] -mt-3 mx-px ${n < step ? 'bg-primary/45' : 'bg-border/50'}`}
                  aria-hidden
                />
              )}
            </Fragment>
          );
        })}
      </div>
      <div className="mt-1.5 text-[9px] text-muted-foreground">
        Step <span className="font-mono text-foreground">{step}</span>/9 —{' '}
        <span className="text-foreground/90 font-medium">{STEP_LABELS[step - 1]}</span>
      </div>
    </div>
  );
}
