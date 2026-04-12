import { DEVICE_TYPES } from '../../lib/topologyData';
import { mergeLinkDefaults } from '../../lib/smartNetworkEngine';

/** v3 §539–542 — monospace stats strip */
export default function StatsPanel({
  nodes,
  links,
  vlans,
  rooms,
  barriers = [],
  highlightVlan,
  setHighlightVlan,
  smartSnapshot = null,
  zoom = 1,
}) {
  const typeCounts = {};
  nodes.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });

  const apCount = nodes.filter(n => n.type === 'ap').length;
  let estCableM = 0;
  links.forEach(l => {
    const a = nodes.find(n => n.id === l.source);
    const b = nodes.find(n => n.id === l.target);
    if (!a || !b) return;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    estCableM += mergeLinkDefaults(l).cableLengthM ?? d * 0.1524;
  });

  const onlineApprox = smartSnapshot?.deviceStates
    ? nodes.filter((n) => {
        const st = smartSnapshot.deviceStates[n.id]?.smartState;
        return st && !['no_network', 'isolated', 'power_missing', 'no_internet'].includes(st);
      }).length
    : null;
  const warnCount = smartSnapshot?.findings?.length ?? null;

  return (
    <div className="bg-card border-t border-border px-4 h-8 min-h-[32px] flex items-center gap-6 text-[10px] text-muted-foreground overflow-x-auto flex-shrink-0 font-mono">
      <div className="flex items-center gap-4 flex-shrink-0 text-foreground/90">
        <span>Devices: <span className="text-foreground">{nodes.length}</span></span>
        <span>Links: {links.length}</span>
        <span>APs: {apCount}</span>
        <span>Rooms: {rooms.length}</span>
        <span>Walls: {barriers.length}</span>
        {onlineApprox != null && <span>Online: {onlineApprox}</span>}
        {warnCount != null && <span>Warnings: {warnCount}</span>}
        <span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>

      <div className="w-px h-4 bg-border flex-shrink-0" />

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-muted-foreground">~{Math.round(estCableM)}m cable</span>
      </div>

      <div className="w-px h-4 bg-border flex-shrink-0" />

      <div className="flex items-center gap-3 flex-shrink-0">
        {Object.entries(typeCounts).map(([type, count]) => {
          const dt = DEVICE_TYPES[type];
          if (!dt) return null;
          return (
            <div key={type} className="flex items-center gap-1">
              <span style={{ color: dt.color }}>{dt.icon}</span>
              <span>{count} {dt.label}{count > 1 ? 's' : ''}</span>
            </div>
          );
        })}
      </div>

      {vlans.length > 0 && (
        <>
          <div className="w-px h-4 bg-border flex-shrink-0" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-muted-foreground">VLANs:</span>
            <button
              onClick={() => setHighlightVlan(null)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${!highlightVlan ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
            >
              All
            </button>
            {vlans.map(v => (
              <button
                key={v.id}
                onClick={() => setHighlightVlan(highlightVlan === v.name ? null : v.name)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                  highlightVlan === v.name ? 'text-foreground bg-secondary' : 'hover:bg-secondary'
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.color }} />
                {v.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
