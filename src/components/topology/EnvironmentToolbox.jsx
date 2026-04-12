import {
  BrickWall,
  DoorOpen,
  SquareDashedBottom,
  Box,
  Layers,
  Radio,
  Zap,
  Cable,
  Home,
} from 'lucide-react';

/** v3 §654–666 — nine environment tools */
const TOOLS = [
  { id: 'barrier', label: 'Wall / Barrier', hint: 'Draw walls and barriers', icon: BrickWall, primary: true },
  { id: 'room', label: 'Room / Zone', hint: 'Create smart zones', icon: Home },
  { id: 'door', label: 'Door / Opening', hint: 'Mark openings in walls', icon: DoorOpen },
  { id: 'window', label: 'Window / Glass', hint: 'Glass partitions', icon: SquareDashedBottom },
  { id: 'obstacle', label: 'Obstacle', hint: 'Furniture, shelves, racks', icon: Box },
  { id: 'vlanzone', label: 'VLAN Zone', hint: 'Network segmentation overlay', icon: Layers },
  { id: 'noise', label: 'Noise Source', hint: 'Interference', icon: Radio },
  { id: 'powerzone', label: 'Power Zone', hint: 'UPS/PDU coverage area', icon: Zap },
  { id: 'conduit', label: 'Cable Conduit', hint: 'Cable routing path', icon: Cable },
];

export default function EnvironmentToolbox({ mode, setMode }) {
  return (
    <div className="w-full flex-shrink-0 border-t border-border bg-card/90 backdrop-blur-sm flex flex-col max-h-[42vh]">
      <div className="px-3 pt-2 pb-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Environment</h2>
        <p className="text-[9px] text-muted-foreground/80 mt-0.5 leading-snug">v3 toolbox — click a tool, then draw on canvas</p>
      </div>
      <div className="px-2 pb-2 grid grid-cols-1 gap-1 overflow-y-auto min-h-0">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => setMode(t.id)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors border ${
                active
                  ? 'bg-primary/20 border-primary/50 text-foreground'
                  : t.primary
                    ? 'border-primary/35 bg-primary/5 hover:bg-primary/10 text-foreground'
                    : 'border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground/90'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-[11px] font-medium leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
