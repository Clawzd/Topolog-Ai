import { X, FileImage, FileCode, FileJson, FileText, Network, TerminalSquare, Copy, BookMarked } from 'lucide-react';

export default function ExportMenuModal({
  open,
  onClose,
  onExportPng,
  onExportSvg,
  onExportJson,
  onCopyJson,
  onExportPdf,
  onExportPkt,
  onExportScript,
  onExportBrief,
}) {
  if (!open) return null;

  const rows = [
    { icon: FileImage, label: 'PNG snapshot', sub: 'Raster export', onClick: onExportPng, demo: true },
    { icon: FileCode, label: 'SVG diagram', sub: 'Vector from canvas', onClick: onExportSvg, demo: false },
    { icon: FileJson, label: 'JSON topology', sub: 'Full state file', onClick: onExportJson, demo: false },
    { icon: Copy, label: 'Copy JSON', sub: 'Clipboard', onClick: onCopyJson, demo: false },
    { icon: BookMarked, label: 'Design Brief (MD)', sub: 'v3 §562–570 — scores, issues, BoM text', onClick: onExportBrief, demo: false },
    { icon: FileText, label: 'PDF report', sub: 'Print-ready layout (demo)', onClick: onExportPdf, demo: true },
    { icon: Network, label: 'Cisco Packet Tracer (.pkt)', sub: 'Interop stub', onClick: onExportPkt, demo: true },
    { icon: TerminalSquare, label: 'Vendor script', sub: 'Config bundle CLI', onClick: onExportScript, demo: false },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Export</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Seven export paths (some are demo stubs).</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-[70vh] overflow-y-auto py-1">
          {rows.map((r) => (
            <li key={r.label}>
              <button
                type="button"
                onClick={() => {
                  r.onClick?.();
                  if (!r.demo) onClose();
                }}
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-xs hover:bg-muted/60 transition-colors"
              >
                <r.icon className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-foreground block">{r.label}</span>
                  <span className="text-[10px] text-muted-foreground">{r.sub}</span>
                  {r.demo && <span className="mt-0.5 block text-[9px] text-amber-600/90">Demo: toast only until a library is wired.</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
