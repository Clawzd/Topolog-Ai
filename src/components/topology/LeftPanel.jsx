import { useState } from 'react';
import { DEVICE_TYPES } from '../../lib/topologyData';
import DEVICE_ICONS from '../../lib/deviceIcons';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

const DEVICE_GROUPS = {
  'Network Core': ['router', 'switch', 'firewall', 'loadbalancer'],
  'Wireless': ['ap'],
  'Servers': ['server', 'nas'],
  'End Devices': ['pc', 'laptop', 'phone', 'printer', 'tablet', 'smarttv'],
  'Infrastructure': ['pdu', 'patchpanel'],
  'Other': ['cloud', 'camera', 'iot'],
};

export default function LeftPanel({ onDeviceDragStart, mode, setMode }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const toggleGroup = (g) => setCollapsed(c => ({ ...c, [g]: !c[g] }));

  const filteredGroups = Object.entries(DEVICE_GROUPS).map(([group, types]) => ({
    group,
    types: types.filter(t => {
      const dt = DEVICE_TYPES[t];
      return !search || dt.label.toLowerCase().includes(search.toLowerCase());
    }),
  })).filter(g => g.types.length > 0);

  return (
    <div className="w-full min-h-0 flex-1 flex-shrink-0 bg-card/80 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Components</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            className="w-full bg-muted/60 text-foreground text-sm pl-10 pr-3 py-2.5 rounded-lg border border-border/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 placeholder-muted-foreground transition-all"
            placeholder="Search devices..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Device palette */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {filteredGroups.map(({ group, types }) => (
          <div key={group} className="mb-1">
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center gap-2 px-2 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/40"
            >
              {collapsed[group] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span className="flex-1 text-left">{group}</span>
              <span className="text-[10px] text-muted-foreground/60 font-normal">{types.length}</span>
            </button>
            {!collapsed[group] && (
              <div className="grid grid-cols-2 gap-2 px-0.5 pb-2 pt-1">
                {types.map(type => {
                  const dt = DEVICE_TYPES[type];
                  const IconFn = DEVICE_ICONS[type] || DEVICE_ICONS.pc;
                  return (
                    <div
                      key={type}
                      draggable
                      onDragStart={e => onDeviceDragStart(e, type)}
                      className="relative flex flex-col items-center gap-1.5 p-3 min-h-[5.5rem] rounded-xl bg-muted/30 border border-border/40 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/10 cursor-grab active:cursor-grabbing transition-all duration-150 group"
                      title={`Drag to add ${dt.label}`}
                    >
                      <svg width="48" height="34" viewBox="0 0 90 50" className="flex-shrink-0">
                        {IconFn(dt.color)}
                      </svg>
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground leading-snug text-center font-medium transition-colors">
                        {dt.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-border/60">
        <div className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
          Drag & drop onto canvas
        </div>
      </div>
    </div>
  );
}
