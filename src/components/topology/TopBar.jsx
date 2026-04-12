import { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Download,
  Settings2,
} from 'lucide-react';

function HeaderBtn({ onClick, title, children, variant = 'default', className = '' }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40';
  const styles =
    variant === 'danger'
      ? 'px-2.5 py-1.5 text-destructive hover:bg-destructive/10'
      : variant === 'primary'
      ? 'px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
      : 'px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60';
  return (
    <button type="button" onClick={onClick} title={title} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

function DropdownMenu({ trigger, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
      >
        {trigger}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-card border border-border rounded-lg shadow-xl shadow-black/30 py-1 z-50 slide-in-bottom">
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ onClick, icon: Icon, children, variant = 'default', close }) {
  return (
    <button
      type="button"
      onClick={() => { close?.(); onClick?.(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
        variant === 'danger'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground/80 hover:text-foreground hover:bg-muted/60'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-border/60 my-1" />;
}

function LogoMark() {
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/10">
      <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
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
    <header className="flex-shrink-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-border/60 bg-card/95 px-4 backdrop-blur-md">
      {/* Left: Logo */}
      <div className="flex min-w-0 items-center gap-2.5">
        <LogoMark />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">TopologAi</h1>
          <p className="truncate text-[10px] text-muted-foreground/70">Network Design Studio</p>
        </div>
      </div>

      {/* Center: Actions */}
      <nav className="flex flex-shrink-0 flex-wrap items-center justify-end gap-0.5">
        {/* File */}
        <DropdownMenu trigger={<><Save className="h-3.5 w-3.5" /><span className="hidden sm:inline">File</span></>}>
          {(close) => (
            <>
              <DropdownItem onClick={onSave} icon={Save} close={close}>Save Project</DropdownItem>
              <DropdownItem onClick={onLoad} icon={FolderOpen} close={close}>Load Project</DropdownItem>
              <DropdownItem onClick={onImportJson} icon={Upload} close={close}>Import JSON</DropdownItem>
              <Divider />
              <DropdownItem onClick={onReset} icon={Eraser} variant="danger" close={close}>Reset Canvas</DropdownItem>
            </>
          )}
        </DropdownMenu>

        {/* Export */}
        <DropdownMenu trigger={<><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Export</span></>}>
          {(close) => (
            <>
              <DropdownItem onClick={onExportJson} icon={FileJson} close={close}>Export JSON</DropdownItem>
              <DropdownItem onClick={onExportSvg} icon={FileImage} close={close}>Export SVG</DropdownItem>
              <DropdownItem onClick={onExportBrief} icon={FileText} close={close}>Design Brief</DropdownItem>
              <DropdownItem onClick={onExportConfig} icon={TerminalSquare} close={close}>Config Draft</DropdownItem>
              <Divider />
              <DropdownItem onClick={onShare} icon={Share2} close={close}>Copy Share Link</DropdownItem>
            </>
          )}
        </DropdownMenu>

        {/* Tools */}
        <DropdownMenu trigger={<><Settings2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Tools</span></>}>
          {(close) => (
            <>
              <DropdownItem onClick={onTemplates} icon={LayoutTemplate} close={close}>Template Gallery</DropdownItem>
              <DropdownItem onClick={onVlanManager} icon={Network} close={close}>VLAN Manager</DropdownItem>
              <DropdownItem onClick={onAutoLayout} icon={Wand2} close={close}>Auto Layout</DropdownItem>
              <DropdownItem onClick={onValidate} icon={ShieldCheck} close={close}>Validate Network</DropdownItem>
            </>
          )}
        </DropdownMenu>

        <div className="mx-1 hidden h-5 w-px bg-border/40 sm:block" />

        {/* Toggle buttons */}
        <HeaderBtn onClick={onToggleInsights} title={insightsOpen ? 'Hide insights' : 'Show insights'} variant={insightsOpen ? 'primary' : 'default'}>
          <BrainCircuit className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Insights</span>
        </HeaderBtn>
        <HeaderBtn onClick={onToggleFocus} title={focusMode ? 'Exit focus mode' : 'Focus canvas'} variant={focusMode ? 'primary' : 'default'}>
          <Focus className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Focus</span>
        </HeaderBtn>
      </nav>
    </header>
  );
}
