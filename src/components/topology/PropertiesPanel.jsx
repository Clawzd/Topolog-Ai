import { useState, useEffect } from 'react';
import { DEVICE_TYPES, LINK_TYPES } from '../../lib/topologyData';
import { Trash2, Network, Link2, Square, ChevronDown, BrickWall, Layers, Zap } from 'lucide-react';
import { mergeRoomDefaults, mergeBarrierDefaults } from '../../lib/smartNetworkEngine';

/** Match TopologyCanvas NODE_W / NODE_H for overlap tests */
const NODE_BOX_W = 90;
const NODE_BOX_H = 56;

function nodesOverlappingRoom(room, nodes) {
  return nodes.filter(
    (n) =>
      n.x + NODE_BOX_W > room.x &&
      n.x < room.x + room.w &&
      n.y + NODE_BOX_H > room.y &&
      n.y < room.y + room.h
  );
}

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

export default function PropertiesPanel({ selectedId, nodes, links, rooms, barriers = [], vlanZones = [], powerZones = [], vlans, onUpdate, onDelete, onSelectNode, deviceStates = null }) {
  const [form, setForm] = useState(/** @type {Record<string, any>} */ ({}));

  const selectedNode = nodes.find(n => n.id === selectedId);
  const selectedLink = links.find(l => l.id === selectedId);
  const selectedRoom = rooms.find(r => r.id === selectedId);
  const selectedBarrier = barriers.find(b => b.id === selectedId);
  const selectedVlanZone = vlanZones.find(z => z.id === selectedId);
  const selectedPowerZone = powerZones.find(z => z.id === selectedId);

  const item = selectedNode || selectedLink || selectedRoom || selectedBarrier || selectedVlanZone || selectedPowerZone;
  const type = selectedNode ? 'node' : selectedLink ? 'link' : selectedRoom ? 'room' : selectedBarrier ? 'barrier' : selectedVlanZone ? 'vlanZone' : selectedPowerZone ? 'powerZone' : null;

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

  const typeIcons = {
    node: <Network className="w-3.5 h-3.5" />,
    link: <Link2 className="w-3.5 h-3.5" />,
    room: <Square className="w-3.5 h-3.5" />,
    barrier: <BrickWall className="w-3.5 h-3.5" />,
    vlanZone: <Layers className="w-3.5 h-3.5" />,
    powerZone: <Zap className="w-3.5 h-3.5" />,
  };
  const typeLabel = { node: 'Device', link: 'Connection', room: 'Room', barrier: 'Barrier', vlanZone: 'VLAN zone', powerZone: 'Power zone' };

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
              <SelectField
                label="Criticality"
                value={form.criticality || 'normal'}
                onChange={v => saveKey('criticality', v)}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
              {(form.type === 'laptop' || form.type === 'pc' || form.type === 'tablet') && (
                <SelectField
                  label="Connection mode"
                  value={form.connectionMode || 'wifi'}
                  onChange={v => saveKey('connectionMode', v)}
                  options={[
                    { value: 'wifi', label: 'Wi‑Fi' },
                    { value: 'wired', label: 'Wired' },
                    { value: 'auto', label: 'Auto' },
                  ]}
                />
              )}
              {(form.type === 'laptop' ||
                form.type === 'tablet' ||
                form.type === 'phone' ||
                form.type === 'printer' ||
                form.type === 'smarttv' ||
                form.type === 'iot' ||
                form.type === 'camera' ||
                (form.type === 'pc' && (form.connectionMode || 'wifi') !== 'wired')) && (
                <Field
                  label="Preferred SSID (optional)"
                  value={form.preferredSsid}
                  onChange={v => change('preferredSsid', v)}
                  onBlur={save}
                  placeholder="Must match an AP SSID when set"
                />
              )}
            </Section>

            {(form.type === 'ap' || form.type === 'router') && (
              <Section title="Wireless (AP / router)" defaultOpen={false}>
                <Field label="SSID" value={form.ssid} onChange={v => change('ssid', v)} onBlur={save} placeholder="Corporate" />
                <SelectField
                  label="Wi‑Fi backhaul"
                  value={form.backhaulType || 'ethernet'}
                  onChange={v => saveKey('backhaulType', v)}
                  options={[
                    { value: 'ethernet', label: 'Ethernet uplink' },
                    { value: 'wifi_mesh', label: 'Wi‑Fi mesh / repeater' },
                    { value: 'powerline', label: 'Powerline (PLC)' },
                  ]}
                />
                <Field label="Coverage radius" value={form.coverageRadius} onChange={v => change('coverageRadius', Number(v))} onBlur={save} type="number" />
                <Field label="Max radius" value={form.maxRadius} onChange={v => change('maxRadius', Number(v))} onBlur={save} type="number" />
                <Field label="Channel" value={form.channel} onChange={v => change('channel', v)} onBlur={save} placeholder="auto / 6 / 11" />
                <Field label="Client capacity" value={form.capacityClients} onChange={v => change('capacityClients', Number(v))} onBlur={save} type="number" />
                <Field
                  label="Supported VLANs (comma)"
                  value={form.supportedVlans}
                  onChange={v => change('supportedVlans', v)}
                  onBlur={save}
                  placeholder="e.g. VLAN10, VLAN30 (empty = any SSID VLAN)"
                />
                <p className="text-[9px] text-muted-foreground leading-snug -mt-1">
                  When set, wireless clients must use a listed VLAN name (same spelling as the VLAN picker) to pass validation.
                </p>
              </Section>
            )}

            {deviceStates?.[selectedId] && (
              <Section title="Smart state" defaultOpen={false}>
                <div className="text-[10px] text-muted-foreground space-y-1">
                  <div>Quality: <span className="font-mono text-foreground">{deviceStates[selectedId].quality}</span></div>
                  <div>State: <span className="text-foreground">{deviceStates[selectedId].smartState}</span></div>
                  {form.demoUptime && (
                    <div>Uptime (demo): <span className="font-mono text-emerald-300">{form.demoUptime}</span></div>
                  )}
                  {(deviceStates[selectedId].reasons || []).map((r, i) => (
                    <div key={i}>• {r}</div>
                  ))}
                </div>
              </Section>
            )}

            {(form.type === 'switch' || form.type === 'router') && (() => {
              const portCount = Math.min(24, Math.max(8, (DEVICE_TYPES[form.type]?.defaultPorts || []).length));
              const uplinks = links
                .filter((l) => l.source === selectedId || l.target === selectedId)
                .filter((l) => l.type !== 'wifi')
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(0, portCount);
              return (
                <Section title="Ports" defaultOpen>
                  <div className="grid grid-cols-8 gap-1">
                    {Array.from({ length: portCount }, (_, i) => {
                      const link = uplinks[i];
                      const otherId = link ? (link.source === selectedId ? link.target : link.source) : null;
                      const other = otherId ? nodes.find((n) => n.id === otherId) : null;
                      const poeBad = link && ['camera', 'phone'].includes(other?.type || '') && (!link.poe || link.poe === 'none');
                      const tone = link ? (poeBad ? 'bg-rose-900/50 border-rose-500/60' : 'bg-emerald-900/40 border-emerald-500/50') : 'bg-muted/80 border-border';
                      return (
                        <div
                          key={i}
                          title={link ? `${link.type} · ${link.label || link.id}` : 'Unused'}
                          className={`relative h-6 rounded border text-[8px] font-mono flex items-center justify-center ${tone} text-foreground/90`}
                        >
                          {i + 1}
                          {link?.poe && link.poe !== 'none' && (
                            <span className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full bg-amber-400" title="PoE on link" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5 leading-snug">
                    Green: mapped uplink in order. Red: heuristic PoE mismatch on endpoint.
                  </p>
                </Section>
              );
            })()}

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
              <Field label="Bandwidth Mbps" value={form.bandwidthMbps} onChange={v => change('bandwidthMbps', Number(v))} onBlur={save} type="number" />
              <Field label="Cable length (m)" value={form.cableLengthM} onChange={v => change('cableLengthM', Number(v))} onBlur={save} type="number" />
              <Field label="Utilization %" value={form.utilizationPercent} onChange={v => change('utilizationPercent', Number(v))} onBlur={save} type="number" />
              <SelectField
                label="PoE"
                value={form.poe || 'none'}
                onChange={v => saveKey('poe', v)}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'poe', label: 'PoE' },
                  { value: 'poe+', label: 'PoE+' },
                  { value: 'poe++', label: 'PoE++' },
                ]}
              />
              <Field
                label="Trunk VLANs (comma)"
                value={form.trunkVlans}
                onChange={v => change('trunkVlans', v)}
                onBlur={save}
                placeholder="e.g. VLAN10, VLAN20 (empty = any)"
              />
              <p className="text-[9px] text-muted-foreground leading-snug -mt-1">
                When set, intelligence checks that device VLAN tags appear on this Ethernet/fiber hop toward the core.
              </p>
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

            <Section title="Smart zone" defaultOpen={false}>
              <SelectField
                label="Zone type"
                value={mergeRoomDefaults(form).zoneType}
                onChange={v => saveKey('zoneType', v)}
                options={[
                  { value: 'office', label: 'Office' },
                  { value: 'server_room', label: 'Server room' },
                  { value: 'guest_area', label: 'Guest area' },
                  { value: 'outdoor', label: 'Outdoor' },
                  { value: 'storage', label: 'Storage' },
                  { value: 'restricted', label: 'Restricted' },
                  { value: 'iot_area', label: 'IoT area' },
                ]}
              />
              <Field label="Floor" value={mergeRoomDefaults(form).floor} onChange={v => change('floor', Number(v) || 1)} onBlur={save} type="number" placeholder="1" />
              <p className="text-[9px] text-muted-foreground leading-snug -mt-1">
                When this zone and the AP zone both have a floor set, Wi‑Fi scoring and the signal heatmap add inter-floor loss between mismatched levels.
              </p>
              <SelectField
                label="Environment"
                value={mergeRoomDefaults(form).environment}
                onChange={v => saveKey('environment', v)}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'dense', label: 'Dense' },
                  { value: 'industrial', label: 'Industrial' },
                  { value: 'residential', label: 'Residential' },
                ]}
              />
              <Field label="Allowed device types (comma)" value={mergeRoomDefaults(form).allowedDeviceTypes} onChange={v => change('allowedDeviceTypes', v)} onBlur={save} placeholder="server,nas,switch" />
              <SelectField
                label="Security level"
                value={mergeRoomDefaults(form).securityLevel}
                onChange={v => saveKey('securityLevel', v)}
                options={[
                  { value: 'public', label: 'Public' },
                  { value: 'staff', label: 'Staff' },
                  { value: 'restricted', label: 'Restricted' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
              <Field label="Required VLAN name" value={form.requiredVlan} onChange={v => change('requiredVlan', v)} onBlur={save} placeholder="VLAN10" />
              <Field label="Max wireless users" value={form.maxUsers} onChange={v => change('maxUsers', Number(v))} onBlur={save} type="number" />
              <SelectField
                label="Wall material"
                value={mergeRoomDefaults(form).defaultWallMaterial}
                onChange={v => saveKey('defaultWallMaterial', v)}
                options={[
                  { value: 'drywall', label: 'Drywall' },
                  { value: 'glass', label: 'Glass' },
                  { value: 'brick', label: 'Brick' },
                  { value: 'concrete', label: 'Concrete' },
                  { value: 'metal', label: 'Metal' },
                ]}
              />
              <SelectField
                label="Wall thickness"
                value={mergeRoomDefaults(form).wallThickness}
                onChange={v => saveKey('wallThickness', v)}
                options={[
                  { value: 'thin', label: 'Thin' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'thick', label: 'Thick' },
                ]}
              />
              <SelectField
                label="Noise level"
                value={mergeRoomDefaults(form).noiseLevel}
                onChange={v => saveKey('noiseLevel', v)}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </Section>

            <Section title="Devices in this zone">
              {(() => {
                const inside = nodesOverlappingRoom(selectedRoom, nodes).sort((a, b) => a.label.localeCompare(b.label));
                if (!inside.length) {
                  return <p className="text-[10px] text-muted-foreground leading-relaxed">No devices overlap this room. Drag devices into the dashed area or resize the room to include them.</p>;
                }
                return (
                  <ul className="space-y-1">
                    {inside.map((n) => {
                      const dt = DEVICE_TYPES[n.type] || DEVICE_TYPES.pc;
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => onSelectNode?.(n.id)}
                            className="w-full flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-left text-xs hover:bg-muted/60 hover:border-border transition-colors"
                          >
                            <span className="text-base leading-none" aria-hidden>{dt.icon}</span>
                            <span className="flex-1 min-w-0">
                              <span className="font-medium text-foreground block truncate">{n.label}</span>
                              <span className="text-[9px] text-muted-foreground font-mono">{dt.label}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
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

        {type === 'barrier' && (
          <>
            <Section title="Barrier">
              <Field label="Label" value={form.label} onChange={v => change('label', v)} onBlur={save} />
              <SelectField
                label="Material"
                value={mergeBarrierDefaults(form).barrierType}
                onChange={v => saveKey('barrierType', v)}
                options={[
                  { value: 'drywall', label: 'Drywall' },
                  { value: 'glass', label: 'Glass' },
                  { value: 'wood', label: 'Wood' },
                  { value: 'brick', label: 'Brick' },
                  { value: 'concrete', label: 'Concrete' },
                  { value: 'metal', label: 'Metal' },
                  { value: 'water', label: 'Water' },
                  { value: 'rf_shield', label: 'RF shield' },
                  { value: 'custom', label: 'Custom' },
                ]}
              />
              <SelectField
                label="Thickness"
                value={mergeBarrierDefaults(form).thickness}
                onChange={v => saveKey('thickness', v)}
                options={[
                  { value: 'thin', label: 'Thin' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'thick', label: 'Thick' },
                ]}
              />
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <input type="checkbox" checked={form.blocksWifi !== false} onChange={e => saveKey('blocksWifi', e.target.checked)} />
                Blocks Wi‑Fi
              </label>
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <input type="checkbox" checked={!!form.blocksCablePath} onChange={e => saveKey('blocksCablePath', e.target.checked)} />
                Blocks cable path
              </label>
            </Section>
          </>
        )}

        {type === 'vlanZone' && (
          <>
            <Section title="VLAN overlay">
              <Field label="Label" value={form.label} onChange={v => change('label', v)} onBlur={save} />
              <SelectField
                label="VLAN"
                value={form.vlanName}
                onChange={v => saveKey('vlanName', v)}
                options={vlans.map(v => ({ value: v.name, label: `${v.name} — ${v.label}` }))}
              />
              <Field label="Fill (rgba/hex)" value={form.color} onChange={v => change('color', v)} onBlur={save} />
            </Section>
          </>
        )}

        {type === 'powerZone' && (
          <>
            <Section title="UPS / PDU coverage (v3)">
              <Field label="Label" value={form.label} onChange={v => change('label', v)} onBlur={save} />
              <Field label="Fill (rgba/hex)" value={form.fill} onChange={v => change('fill', v)} onBlur={save} placeholder="rgba(234,179,8,0.12)" />
            </Section>
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border/50">
        <p className="text-[9px] text-muted-foreground/60 text-center">
          {type === 'room' ? 'Drag the room to move; corner handles to resize'
            : type === 'barrier' ? 'Drag-draw barrier on canvas in Barrier mode (B)'
            : 'Changes save automatically'}
        </p>
      </div>
    </div>
  );
}
