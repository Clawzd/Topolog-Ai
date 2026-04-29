import {
  BrickWall,
  Box,
  Radio,
  Route,
  Home,
} from 'lucide-react';

const TOOLS = [
  { id: 'barrier', label: 'Wall / Barrier', hint: 'Draw walls and barriers', icon: BrickWall, primary: true },
  { id: 'bus', label: 'Bus Backbone', hint: 'Draw a shared bus line', icon: Route },
  { id: 'room', label: 'Room / Zone', hint: 'Create smart zones', icon: Home },
  { id: 'obstacle', label: 'Obstacle', hint: 'Furniture, shelves, racks', icon: Box },
  { id: 'noise', label: 'Noise Source', hint: 'Interference', icon: Radio },
];

export default function EnvironmentToolbox({ mode, setMode }) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-card/90 backdrop-blur-sm">
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Environment</h2>
        <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground/80">Choose a tool, then draw it on the canvas</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="grid grid-cols-2 gap-2">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                onClick={() => setMode(t.id)}
                className={`flex min-h-[5.4rem] flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                  active
                    ? 'bg-primary/10 border-primary/70 shadow-sm shadow-primary/20 text-foreground'
                    : t.primary
                      ? 'border-primary/35 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-foreground'
                      : 'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-primary/35 text-foreground/90'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    active ? 'border-primary/50 bg-primary/12' : 'border-border/50 bg-card/70'
                  }`}>
                    <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <span className="text-[11px] font-medium leading-tight">{t.label}</span>
                </div>
                <span className="text-[9px] leading-snug text-muted-foreground/75">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
