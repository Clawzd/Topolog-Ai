import { useEffect, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { Search, LayoutTemplate, Network, Shield, Activity, Zap } from 'lucide-react';

export default function CommandPalette({
  open,
  onClose,
  onTemplates,
  onVlanManager,
  onAutoLayout,
  onToggleHeatmap,
  onToggleTraffic,
  onToggleCompliance,
  onTogglePower,
  onToggleApAdvisor,
  onExportBrief,
  onSave,
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const items = useMemo(() => {
    const all = [
      { id: 'tpl', label: 'Browse templates', keywords: 'gallery start', icon: LayoutTemplate, run: onTemplates },
      { id: 'vlan', label: 'VLAN manager', keywords: 'segment', icon: Network, run: onVlanManager },
      { id: 'layout', label: 'Auto layout', keywords: 'arrange', icon: Network, run: onAutoLayout },
      { id: 'heat', label: 'Toggle signal heatmap', keywords: 'wifi coverage', icon: Activity, run: onToggleHeatmap },
      { id: 'flow', label: 'Toggle traffic flow', keywords: 'bottleneck', icon: Activity, run: onToggleTraffic },
      { id: 'comp', label: 'Toggle compliance view', keywords: 'zone security', icon: Shield, run: onToggleCompliance },
      { id: 'pow', label: 'Toggle power view', keywords: 'pdu ups', icon: Zap, run: onTogglePower },
      { id: 'ap', label: 'Toggle AP advisor', keywords: 'placement', icon: Activity, run: onToggleApAdvisor },
      { id: 'brief', label: 'Export design brief', keywords: 'markdown', icon: Network, run: onExportBrief },
      { id: 'save', label: 'Save to browser', keywords: 'persist', icon: Network, run: onSave },
    ];
    const qq = q.trim().toLowerCase();
    if (!qq) return all;
    return all.filter(
      (x) =>
        x.label.toLowerCase().includes(qq) ||
        x.keywords.includes(qq) ||
        x.id.includes(qq)
    );
  }, [q, onTemplates, onVlanManager, onAutoLayout, onToggleHeatmap, onToggleTraffic, onToggleCompliance, onTogglePower, onToggleApAdvisor, onExportBrief, onSave]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Command
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        label="Command palette"
        shouldFilter={false}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Search actions…"
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground font-mono hidden sm:inline">Esc</kbd>
        </div>
        <Command.List className="max-h-72 overflow-y-auto p-1">
          <Command.Empty className="py-6 text-center text-xs text-muted-foreground">No matches.</Command.Empty>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Command.Item
                key={item.id}
                value={item.id}
                onSelect={() => {
                  item.run?.();
                  onClose();
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground aria-selected:bg-primary/15 aria-selected:text-primary"
              >
                <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
                <span>{item.label}</span>
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
