function relTime(ts) {
  if (!ts) return 'Snapshot';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export default function HistoryPanel({ snapshots, onJumpTo }) {
  if (!snapshots?.length) return null;
  const recent = snapshots.slice(-15);
  const ordered = [...recent].reverse();
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-2 py-2 mt-2">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Restore points</div>
      <ul className="space-y-1 max-h-28 overflow-y-auto">
        {ordered.map((snap, i) => {
          const globalIdx = snapshots.length - 1 - i;
          return (
            <li key={`${snap.at}-${globalIdx}`}>
              <button
                type="button"
                onClick={() => onJumpTo(globalIdx)}
                className="w-full text-left text-[10px] px-2 py-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground truncate"
              >
                {relTime(snap.at)} · {snap.nodes?.length ?? 0} devices
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
