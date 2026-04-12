import { X, AlertTriangle } from 'lucide-react';

export default function FailureImpactModal({
  open,
  onClose,
  affectedCount,
  apOfflineCount,
  scoreBefore,
  scoreAfter,
}) {
  if (!open) return null;
  const delta = scoreBefore != null && scoreAfter != null ? scoreAfter - scoreBefore : null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Failure impact</h2>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              Simulation summary — compare overall score before vs after the fault.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" title="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Affected devices</span><span className="font-mono text-foreground">{affectedCount}</span></div>
          <div className="flex justify-between"><span>APs offline / degraded</span><span className="font-mono text-foreground">{apOfflineCount}</span></div>
          {delta != null && (
            <div className="flex justify-between pt-1 border-t border-border">
              <span>Overall score Δ</span>
              <span className={`font-mono ${delta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {delta > 0 ? '+' : ''}{delta}
              </span>
            </div>
          )}
          {(scoreBefore != null || scoreAfter != null) && (
            <div className="text-[10px] pt-1">
              Before: <span className="font-mono text-foreground">{scoreBefore ?? '—'}</span>
              {' · '}
              After: <span className="font-mono text-foreground">{scoreAfter ?? '—'}</span>
            </div>
          )}
        </div>
        <div className="px-4 pb-3">
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-primary/15 py-2 text-xs font-medium text-primary hover:bg-primary/25">
            Continue editing
          </button>
        </div>
      </div>
    </div>
  );
}
