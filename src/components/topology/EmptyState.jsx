import { LayoutGrid, Sparkles, Wand2, ArrowDown } from 'lucide-react';

export default function EmptyState({ onTemplates, onQuickStart, onDescribe }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center max-w-md pointer-events-auto">
        {/* Animated icon */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-3 rounded-full bg-primary/8 animate-pulse" style={{ animationDuration: '2.2s', animationDelay: '0.4s' }} />
          <div className="absolute inset-6 rounded-full border border-primary/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <Sparkles className="w-10 h-10 text-primary animate-shimmer" />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-foreground mb-3 tracking-tight">Design Your Network</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-sm mx-auto">
          Describe a network, pick a template, or drag devices onto the canvas to get started.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onDescribe}
            className="flex items-center gap-2.5 bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-xl transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98]"
          >
            <Wand2 className="w-4 h-4" />
            Describe Environment
          </button>
          <button
            onClick={onTemplates}
            className="flex items-center gap-2.5 bg-muted/60 hover:bg-muted border border-border/60 text-foreground text-sm font-medium px-6 py-2.5 rounded-xl transition-all hover:border-primary/30 active:scale-[0.98]"
          >
            <LayoutGrid className="w-4 h-4" />
            Browse Templates
          </button>
          <button
            onClick={onQuickStart}
            className="flex items-center gap-2.5 bg-muted/40 hover:bg-muted border border-border/60 text-foreground text-sm font-medium px-6 py-2.5 rounded-xl transition-all hover:border-primary/30 active:scale-[0.98]"
          >
            Smart Blueprint
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60">
          <ArrowDown className="h-3 w-3 animate-bounce" />
          Drag components from the left panel or double-click canvas
        </div>
      </div>
    </div>
  );
}
