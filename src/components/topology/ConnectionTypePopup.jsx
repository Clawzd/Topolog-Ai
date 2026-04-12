import { LINK_TYPES } from '../../lib/topologyData';
import { X } from 'lucide-react';

export default function ConnectionTypePopup({ position, onSelect, onCancel }) {
  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl shadow-black/50 p-2 w-52"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -110%)' }}
    >
      <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-border">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Connection Type</span>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-0.5">
        {Object.entries(LINK_TYPES).map(([key, lt]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors text-left group"
          >
            {/* Line preview */}
            <svg width="28" height="12" className="flex-shrink-0">
              <line
                x1="2" y1="6" x2="26" y2="6"
                stroke={lt.color}
                strokeWidth="2"
                strokeDasharray={lt.dash ? '5 3' : undefined}
              />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground">{lt.label}</div>
              <div className="text-[9px] text-muted-foreground font-mono">{lt.speed}</div>
            </div>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: lt.color }} />
          </button>
        ))}
      </div>
    </div>
  );
}