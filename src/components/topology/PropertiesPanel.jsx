import { useState, useEffect } from 'react';
import { DEVICE_TYPES, LINK_TYPES } from '../../lib/topologyData';
import { Trash2, Network, Link2, Square, ChevronDown } from 'lucide-react';

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        {title}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-4 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, onBlur, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
      >
        <option value="">- None -</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function PropertiesPanel({ selectedId, nodes, links, rooms, vlans, onUpdate, onDelete }) {
  const [form, setForm] = useState(/** @type {Record<string, any>} */ ({}));

  const selectedNode = nodes.find(n => n.id === selectedId);
  const selectedLink = links.find(l => l.id === selectedId);
  const selectedRoom = rooms.find(r => r.id === selectedId);

  const item = selectedNode || selectedLink || selectedRoom;
  const type = selectedNode ? 'node' : selectedLink ? 'link' : selectedRoom ? 'room' : null;

  useEffect(() => {
    if (item) setForm({ ...item });
    else setForm({});
  }, [selectedId]);

  if (!item) return null;

  const change = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const save = () => onUpdate(selectedId, form, type);
  const saveKey = (key, val) => { const updated = { ...form, [key]: val }; setForm(updated); onUpdate(selectedId, updated, type); };

  const dt = selectedNode ? DEVICE_TYPES[form.type] || DEVICE_TYPES.pc : null;
  const lt = selectedLink ? LINK_TYPES[form.type] || LINK_TYPES.ethernet : null;

  const typeIcons = { node: <Network className="w-3.5 h-3.5" />, link: <Link2 className="w-3.5 h-3.5" />, room: <Square className="w-3.5 h-3.5" /> };
  const typeLabel = { node: 'Device', link: 'Connection', room: 'Room' };

  return (
    <div className="w-64 bg-card border-l border-border flex flex-col overflow-hidden slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <span className="text-primary">{typeIcons[type]}</span>
          <span className="text-xs font-semibold text-foreground">{typeLabel[type]} Properties</span>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* NODE */}
        {type === 'node' && (
          <>
            {/* Device identity badge */}
            <div className="mx-4 mt-3 mb-1 flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
              <span className="text-3xl leading-none" style={{ color: dt?.color }}>{dt?.icon}</span>
              <div>
                <div className="text-xs font-semibold text-foreground">{dt?.label}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{form.type}</div>
              </div>
            </div>

            <Section title="Identity">
              <Field label="Name / Label" value={form.label} onChange={v => change('label', v)} onBlur={save} placeholder="Device name" />
              <Field label="IP Address" value={form.ip} onChange={v => change('ip', v)} onBlur={save} placeholder="192.168.1.x" />
              <Field label="Description" value={form.description} onChange={v => change('description', v)} onBlur={save} placeholder="Optional notes" />
            </Section>

            <Section title="Classification">
              <SelectField
                label="Device Type"
                value={form.type}
                onChange={v => saveKey('type', v)}
                options={Object.entries(DEVICE_TYPES).map(([v, d]) => ({ value: v, label: d.label }))}
              />
              <SelectField
                label="VLAN"
                value={form.vlan}
                onChange={v => saveKey('vlan', v || null)}
                options={vlans.map(v => ({ value: v.name, label: `${v.name} - ${v.label}` }))}
              />
            </Section>

            <Section title="Position" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="X" value={Math.round(form.x)} onChange={v => change('x', parseFloat(v))} onBlur={save} type="number" />
                <Field label="Y" value={Math.round(form.y)} onChange={v => change('y', parseFloat(v))} onBlur={save} type="number" />
              </div>
            </Section>
          </>
        )}

        {/* LINK */}
        {type === 'link' && (
          <>
            {lt && (
              <div className="mx-4 mt-3 mb-1 flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
                <svg width="32" height="14" className="flex-shrink-0">
                  <line x1="2" y1="7" x2="30" y2="7" stroke={lt.color} strokeWidth="2.5" strokeDasharray={lt.dash ? '6 4' : undefined} />
                </svg>
                <div>
                  <div className="text-xs font-semibold text-foreground">{lt.label}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{lt.speed}</div>
                </div>
              </div>
            )}

            <div className="mx-4 mt-2 mb-1 p-2.5 bg-muted/30 border border-border/50 rounded-lg">
              <div className="text-[10px] text-muted-foreground">
                <span className="text-foreground font-medium">{nodes.find(n => n.id === item.source)?.label || '?'}</span>
                <span className="mx-1.5 opacity-50">to</span>
                <span className="text-foreground font-medium">{nodes.find(n => n.id === item.target)?.label || '?'}</span>
              </div>
            </div>

            <Section title="Connection">
              <Field label="Label" value={form.label} onChange={v => change('label', v)} onBlur={save} placeholder="Optional label" />
              <Field label="Bandwidth" value={form.bandwidth} onChange={v => change('bandwidth', v)} onBlur={save} placeholder="e.g. 1Gbps" />
              <SelectField
                label="Link Type"
                value={form.type}
                onChange={v => saveKey('type', v)}
                options={Object.entries(LINK_TYPES).map(([v, d]) => ({ value: v, label: `${d.label} (${d.speed})` }))}
              />
            </Section>
          </>
        )}

        {/* ROOM */}
        {type === 'room' && (
          <>
            <Section title="Identity">
              <Field label="Room Label" value={form.label} onChange={v => change('label', v)} onBlur={save} placeholder="Room name" />
            </Section>

            <Section title="Appearance">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Fill Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.colorHex || '#3b82f6'}
                    onChange={e => {
                      const hex = e.target.value;
                      const updated = { ...form, color: hex + '20', colorHex: hex };
                      setForm(updated);
                      onUpdate(selectedId, updated, type);
                    }}
                    className="w-8 h-8 rounded-lg border border-border bg-muted cursor-pointer flex-shrink-0"
                  />
                  <span className="text-xs text-muted-foreground font-mono">{form.colorHex || '#3b82f6'}</span>
                </div>
              </div>
            </Section>

            <Section title="Dimensions" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="X" value={Math.round(form.x)} onChange={v => change('x', parseFloat(v))} onBlur={save} type="number" />
                <Field label="Y" value={Math.round(form.y)} onChange={v => change('y', parseFloat(v))} onBlur={save} type="number" />
                <Field label="Width" value={Math.round(form.w)} onChange={v => change('w', parseFloat(v))} onBlur={save} type="number" />
                <Field label="Height" value={Math.round(form.h)} onChange={v => change('h', parseFloat(v))} onBlur={save} type="number" />
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border/50">
        <p className="text-[9px] text-muted-foreground/60 text-center">
          {type === 'room' ? 'Drag corner handles to resize' : 'Changes save automatically'}
        </p>
      </div>
    </div>
  );
}
