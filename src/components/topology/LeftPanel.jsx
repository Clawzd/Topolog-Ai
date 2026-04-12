import { useState } from 'react';
import { DEVICE_TYPES } from '../../lib/topologyData';
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
    <div className="w-56 flex-shrink-0 bg-card border-r border-border flex flex-col overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full bg-muted text-foreground text-xs pl-7 pr-2 py-1.5 rounded border border-border focus:outline-none focus:border-primary placeholder-muted-foreground"
            placeholder="Search devices…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Device palette */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredGroups.map(({ group, types }) => (
          <div key={group} className="mb-1">
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapsed[group] ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {group}
            </button>
            {!collapsed[group] && (
              <div className="grid grid-cols-2 gap-1 px-2 pb-1">
                {types.map(type => {
                  const dt = DEVICE_TYPES[type];
                  return (
                    <div
                      key={type}
                      draggable
                      onDragStart={e => onDeviceDragStart(e, type)}
                      className="flex flex-col items-center gap-0.5 p-2 rounded bg-muted border border-transparent hover:border-primary/40 hover:bg-secondary cursor-grab active:cursor-grabbing transition-all group"
                      title={dt.label}
                    >
                      <span className="text-xl" style={{ color: dt.color }}>{dt.icon}</span>
                      <span className="text-[9px] text-muted-foreground group-hover:text-foreground leading-none text-center">
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

      {/* Mode label */}
      <div className="p-2 border-t border-border">
        <div className="text-[9px] text-muted-foreground text-center uppercase tracking-widest">
          Drag devices to canvas
        </div>
      </div>
    </div>
  );
}
