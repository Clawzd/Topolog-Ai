import {
  Save,
  FolderOpen,
  Eraser,
  LayoutTemplate,
  Network,
  FileJson,
  FileImage,
  Wand2,
  BrainCircuit,
  Focus,
  Upload,
  Share2,
  FileText,
  TerminalSquare,
  ShieldCheck,
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

function LogoMark() {
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 text-primary shadow-sm shadow-primary/10">
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
        <path d="M9 10 L16 6 L23 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9 22 L16 26 L23 22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9 10 L9 22 M23 10 L23 22 M16 6 L16 26" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
        <circle cx="16" cy="6" r="3.2" fill="currentColor" opacity="0.95" />
        <circle cx="9" cy="10" r="3" fill="currentColor" opacity="0.75" />
        <circle cx="23" cy="10" r="3" fill="currentColor" opacity="0.75" />
        <circle cx="9" cy="22" r="3" fill="currentColor" opacity="0.75" />
        <circle cx="23" cy="22" r="3" fill="currentColor" opacity="0.75" />
        <circle cx="16" cy="26" r="3.2" fill="currentColor" opacity="0.95" />
        <circle cx="16" cy="16" r="2.4" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

export default function TopBar({
  onSave,
  onLoad,
  onReset,
  onTemplates,
  onVlanManager,
  onImportJson,
  onExportJson,
  onExportSvg,
  onExportBrief,
  onExportConfig,
  onShare,
  onValidate,
  onAutoLayout,
  insightsOpen,
  onToggleInsights,
  focusMode,
  onToggleFocus,
}) {
  return (
    <header className="flex-shrink-0 z-20 flex h-12 items-center justify-between gap-4 border-b border-border bg-card/90 px-4 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2.5">
        <LogoMark />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">TopologAi Studio</h1>
          <p className="truncate text-[10px] text-muted-foreground">Network design canvas</p>
        </div>
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
        <HeaderBtn onClick={onImportJson} title="Import topology JSON">
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Import</span>
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
        <HeaderBtn onClick={onAutoLayout} title="Auto arrange topology">
          <Wand2 className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Layout</span>
        </HeaderBtn>
        <HeaderBtn onClick={onToggleInsights} title={insightsOpen ? 'Hide insights' : 'Show insights'}>
          <BrainCircuit className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{insightsOpen ? 'Insights On' : 'Insights'}</span>
        </HeaderBtn>
        <HeaderBtn onClick={onToggleFocus} title={focusMode ? 'Exit focus mode' : 'Focus canvas'}>
          <Focus className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{focusMode ? 'Exit Focus' : 'Focus'}</span>
        </HeaderBtn>
        <HeaderBtn onClick={onValidate} title="Validate network">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Validate</span>
        </HeaderBtn>
        <HeaderBtn onClick={onExportBrief} title="Export design brief">
          <FileText className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Brief</span>
        </HeaderBtn>
        <HeaderBtn onClick={onExportConfig} title="Generate config draft">
          <TerminalSquare className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Config</span>
        </HeaderBtn>
        <HeaderBtn onClick={onShare} title="Copy share link">
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Share</span>
        </HeaderBtn>
        <HeaderBtn onClick={onExportJson} title="Export topology JSON">
          <FileJson className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">JSON</span>
        </HeaderBtn>
        <HeaderBtn onClick={onExportSvg} title="Export topology SVG">
          <FileImage className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">SVG</span>
        </HeaderBtn>
      </nav>
    </header>
  );
}
