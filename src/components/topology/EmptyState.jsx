import { LayoutGrid, Network, Sparkles, Wand2 } from 'lucide-react';

export default function EmptyState({ onTemplates, onQuickStart }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center max-w-sm pointer-events-auto">
        {/* Animated rings */}
        <div className="relative w-28 h-28 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-2 rounded-full border border-primary/15 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.4s' }} />
          <div className="absolute inset-4 rounded-full border border-primary/25 animate-ping" style={{ animationDuration: '1.6s', animationDelay: '0.8s' }} />
          <div className="absolute inset-6 rounded-full border border-primary/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-9 h-9 text-primary animate-shimmer" />
          </div>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-2">Design Your Network</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-6">
          Describe a site, load a blueprint, or drop devices directly onto the canvas.
          Then connect links, assign VLANs, and export the design.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={onQuickStart}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
          >
            <Wand2 className="w-4 h-4" />
            Open Smart Blueprint
          </button>
          <button
            onClick={onTemplates}
            className="flex items-center gap-2 bg-secondary hover:bg-primary hover:text-primary-foreground border border-border text-foreground text-xs font-medium px-4 py-2 rounded-lg transition-all"
          >
            <LayoutGrid className="w-4 h-4" />
            Browse Templates
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <Network className="h-3.5 w-3.5 text-primary" />
          Double-click empty canvas space to add a switch.
        </div>
      </div>
    </div>
  );
}
