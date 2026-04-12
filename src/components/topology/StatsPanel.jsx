import { DEVICE_TYPES } from '../../lib/topologyData';
import { mergeLinkDefaults } from '../../lib/smartNetworkEngine';

export default function StatsPanel({ nodes, links, vlans, rooms, barriers = [], highlightVlan, setHighlightVlan }) {
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

  return (
    <div className="bg-card border-t border-border px-4 py-2 flex items-center gap-6 text-[10px] text-muted-foreground overflow-x-auto flex-shrink-0">
      {/* Totals */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="text-foreground font-medium">{nodes.length} Devices</span>
        <span>{links.length} Links</span>
        <span>{rooms.length} Rooms</span>
        <span>{barriers.length} Barriers</span>
        <span>{apCount} APs</span>
        <span className="font-mono text-[9px] opacity-80">~{Math.round(estCableM)}m cable</span>
      </div>

      <div className="w-px h-4 bg-border flex-shrink-0" />

      {/* Device type breakdown */}
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
          {/* VLAN filters */}
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
