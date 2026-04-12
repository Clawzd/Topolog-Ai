import {
  Save,
  FolderOpen,
  Eraser,
  LayoutTemplate,
  Network,
  FileJson,
} from 'lucide-react';

function HeaderBtn({ onClick, title, children, variant = 'default' }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40';
  const styles =
    variant === 'danger'
      ? 'px-2.5 py-1.5 text-destructive hover:bg-destructive/10 border border-transparent'
      : 'px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60 bg-card/50';
  return (
    <button type="button" onClick={onClick} title={title} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export default function TopBar({
  onSave,
  onLoad,
  onReset,
  onTemplates,
  onVlanManager,
  onExportJson,
}) {
  return (
    <header className="flex-shrink-0 z-20 flex h-12 items-center justify-between gap-4 border-b border-border bg-card/90 px-4 backdrop-blur-sm">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">TopologAi</h1>
        <p className="truncate text-[10px] text-muted-foreground">Network diagram editor</p>
      </div>

      <nav className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
        <HeaderBtn onClick={onSave} title="Save to browser (Ctrl+S)">
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Save</span>
        </HeaderBtn>
        <HeaderBtn onClick={onLoad} title="Load from browser">
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Load</span>
        </HeaderBtn>
        <HeaderBtn onClick={onReset} title="Clear entire canvas" variant="danger">
          <Eraser className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </HeaderBtn>

        <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

        <HeaderBtn onClick={onTemplates} title="Template gallery">
          <LayoutTemplate className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Templates</span>
        </HeaderBtn>
        <HeaderBtn onClick={onVlanManager} title="VLAN manager">
          <Network className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">VLANs</span>
        </HeaderBtn>
        <HeaderBtn onClick={onExportJson} title="Export topology JSON">
          <FileJson className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Export</span>
        </HeaderBtn>
      </nav>
    </header>
  );
}
