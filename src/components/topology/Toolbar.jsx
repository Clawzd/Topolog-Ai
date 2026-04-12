import {
  MousePointer2,
  Link2,
  Move,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  RotateCcw,
  Redo2,
  BrickWall,
  LayoutGrid,
  Activity,
  Shield,
  Zap,
  MapPin,
  AlertTriangle,
  Download,
  X,
  Radio,
} from 'lucide-react';

const MODES = [
  { id: 'select', icon: MousePointer2, label: 'Select / Move', key: 'V' },
  { id: 'connect', icon: Link2, label: 'Draw Connection', key: 'C' },
  { id: 'pan', icon: Move, label: 'Pan Canvas', key: 'H' },
  { id: 'room', icon: Square, label: 'Draw Room', key: 'R' },
  { id: 'barrier', icon: BrickWall, label: 'Draw Barrier', key: 'B' },
  { id: 'vlanzone', icon: LayoutGrid, label: 'VLAN zone overlay', key: 'Z' },
];

function ToolBtn({ onClick, title, shortcut, children, active = false, danger = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${title} (${shortcut})` : title}
      className={`relative p-1.5 rounded-lg transition-all group ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
          : danger
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed'
      }`}
    >
      {children}
      {shortcut && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] bg-card border border-border px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 text-muted-foreground font-mono">
          {shortcut}
        </span>
      )}
    </button>
  );
}

const Divider = () => <div className="w-px h-5 bg-border mx-0.5" />;

export default function Toolbar({
  mode,
  setMode,
  zoom,
  setZoom,
  setPan,
  onDelete,
  onUndo,
  onRedo,
  canRedo = false,
  hasSelection,
  heatmapMode,
  setHeatmapMode,
  showTrafficFlow,
  setShowTrafficFlow,
  showComplianceView,
  setShowComplianceView,
  showPowerView,
  setShowPowerView,
  showApAdvisor,
  setShowApAdvisor,
  failureActive,
  onClearFailure,
  findingCount = 0,
  onExport,
}) {
  const resetView = () => {
    setZoom(1);
    setPan({ x: 60, y: 60 });
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-card/95 backdrop-blur-md border border-border/80 rounded-lg shadow-2xl shadow-black/40 max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 mr-1">
        {MODES.map(({ id, icon: Icon, label, key }) => (
          <ToolBtn key={id} onClick={() => setMode(id)} title={label} shortcut={key} active={mode === id}>
            <Icon className="w-3.5 h-3.5" />
          </ToolBtn>
        ))}
      </div>

      <Divider />

      <ToolBtn onClick={() => setZoom(z => Math.max(0.05, z - 0.15))} title="Zoom Out" shortcut="-">
        <ZoomOut className="w-3.5 h-3.5" />
      </ToolBtn>
      <button
        onClick={resetView}
        className="text-[10px] text-muted-foreground hover:text-primary font-mono px-1.5 py-1 rounded hover:bg-secondary transition-colors min-w-[40px] text-center tabular-nums"
        title="Reset Zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <ToolBtn onClick={() => setZoom(z => Math.min(3, z + 0.15))} title="Zoom In" shortcut="+">
        <ZoomIn className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={resetView} title="Fit to View" shortcut="0">
        <Maximize2 className="w-3.5 h-3.5" />
      </ToolBtn>

      <Divider />

      <ToolBtn onClick={onUndo} title="Undo" shortcut="Ctrl+Z">
        <RotateCcw className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={onRedo} title="Redo" shortcut="Ctrl+Y" disabled={!canRedo}>
        <Redo2 className="w-3.5 h-3.5" />
      </ToolBtn>
      {hasSelection && (
        <ToolBtn onClick={onDelete} title="Delete Selected" shortcut="Del" danger>
          <Trash2 className="w-3.5 h-3.5" />
        </ToolBtn>
      )}

      <Divider />

      <ToolBtn
        onClick={() => setHeatmapMode(heatmapMode === 'signal' ? null : 'signal')}
        title="Signal heatmap"
        shortcut="Ctrl+H"
        active={heatmapMode === 'signal'}
      >
        <Radio className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => setHeatmapMode(heatmapMode === 'bandwidth' ? null : 'bandwidth')}
        title="Bandwidth heatmap"
        active={heatmapMode === 'bandwidth'}
      >
        <Activity className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => setShowTrafficFlow(!showTrafficFlow)} title="Traffic flow" active={showTrafficFlow}>
        <Activity className="w-3.5 h-3.5 opacity-80" />
      </ToolBtn>
      <ToolBtn onClick={() => setShowComplianceView(!showComplianceView)} title="Compliance view" active={showComplianceView}>
        <Shield className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => setShowPowerView(!showPowerView)} title="Power view" active={showPowerView}>
        <Zap className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => setShowApAdvisor(!showApAdvisor)} title="AP placement advisor" active={showApAdvisor}>
        <MapPin className="w-3.5 h-3.5" />
      </ToolBtn>

      <Divider />

      {failureActive ? (
        <ToolBtn onClick={onClearFailure} title="End failure simulation" active danger>
          <X className="w-3.5 h-3.5" />
        </ToolBtn>
      ) : (
        <ToolBtn onClick={() => {}} title="Simulate failure (select device, press F)" disabled>
          <Zap className="w-3.5 h-3.5 opacity-40" />
        </ToolBtn>
      )}

      <div className="relative">
        <ToolBtn onClick={onExport} title="Export menu (use top bar)">
          <Download className="w-3.5 h-3.5" />
        </ToolBtn>
        {findingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-destructive text-[8px] font-bold text-white flex items-center justify-center">
            {findingCount > 9 ? '9+' : findingCount}
          </span>
        )}
      </div>

      {findingCount > 0 && (
        <span className="flex items-center gap-0.5 text-[9px] text-amber-400 ml-0.5">
          <AlertTriangle className="w-3 h-3" />
          {findingCount}
        </span>
      )}
    </div>
  );
}
