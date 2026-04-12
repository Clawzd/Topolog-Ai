import { X, ArrowRight } from 'lucide-react';
import { TEMPLATES } from '../../lib/topologyData';
import { generatePromptTopology } from '../../lib/promptTopologyGenerator';

const EXTRA_TEMPLATES = [
  {
    id: 'zero-trust-branch',
    name: 'Zero-Trust Branch',
    description: 'Identity-aware branch with guest isolation and app gateway',
    icon: 'ZT',
    prompt: 'Zero trust branch with SD-WAN edge, policy firewall, corporate WiFi, guest WiFi, and identity proxy',
    data: generatePromptTopology('zero trust branch with SD-WAN edge and identity proxy'),
  },
  {
    id: 'smart-warehouse',
    name: 'Smart Warehouse',
    description: 'Operations, camera, scanner, and IoT VLAN design',
    icon: 'WH',
    prompt: 'Warehouse with IoT sensors, cameras, scanners, and protected operations VLAN',
    data: generatePromptTopology('warehouse with IoT sensors and protected operations VLAN'),
  },
];

export default function TemplateGallery({ onSelect, onClose }) {
  const templates = [...EXTRA_TEMPLATES, ...TEMPLATES];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Template Gallery</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Start from a pre-built network topology</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => { onSelect(t); onClose(); }}
              className="group text-left bg-muted hover:bg-secondary border border-border hover:border-primary/40 rounded-lg p-4 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl mt-0.5">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">{t.name}</h3>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[9px] bg-card border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                      {t.data.nodes.length} devices
                    </span>
                    <span className="text-[9px] bg-card border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                      {t.data.links.length} links
                    </span>
                    {t.data.vlans.length > 0 && (
                      <span className="text-[9px] bg-card border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                        {t.data.vlans.length} VLANs
                      </span>
                    )}
                    {t.data.rooms.length > 0 && (
                      <span className="text-[9px] bg-card border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                        {t.data.rooms.length} rooms
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
