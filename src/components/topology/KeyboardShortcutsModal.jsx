import { X } from 'lucide-react';

const ROWS = [
  ['Select mode', 'V'],
  ['Pan mode', 'H'],
  ['Connect mode', 'C'],
  ['Room / zone', 'R'],
  ['Barrier draw', 'B'],
  ['Undo', 'Ctrl+Z'],
  ['Redo', 'Ctrl+Y or Ctrl+Shift+Z'],
  ['Save', 'Ctrl+S'],
  ['Command palette', 'Ctrl+K'],
  ['Shortcuts', '?'],
  ['Signal heatmap', 'Ctrl+H'],
  ['Failure simulation', 'F (with selection)'],
  ['Escape', 'Cancel modes / close'],
];

export default function KeyboardShortcutsModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-1">
          {ROWS.map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 text-xs hover:bg-muted/40">
              <span className="text-muted-foreground">{label}</span>
              <kbd className="font-mono text-[10px] text-foreground bg-muted px-2 py-1 rounded border border-border">{keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
