import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { generateId } from '../../lib/topologyData';

const VLAN_COLORS = ['#14b8a6', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#38bdf8', '#a3e635', '#f97316'];

export default function VlanManager({ vlans, setVlans, onClose }) {
  const [newVlan, setNewVlan] = useState({ name: '', label: '', subnet: '', color: VLAN_COLORS[0] });

  const addVlan = () => {
    if (!newVlan.name.trim()) return;
    setVlans(v => [...v, { ...newVlan, id: generateId('vlan') }]);
    setNewVlan({ name: '', label: '', subnet: '', color: VLAN_COLORS[vlans.length % VLAN_COLORS.length] });
  };

  const deleteVlan = (id) => setVlans(v => v.filter(x => x.id !== id));

  const updateVlan = (id, key, val) => {
    setVlans(v => v.map(x => x.id === id ? { ...x, [key]: val } : x));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">VLAN / Subnet Manager</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Existing VLANs */}
          {vlans.length > 0 ? (
            <div className="space-y-2 mb-5">
              {vlans.map(v => (
                <div key={v.id} className="flex items-center gap-2 bg-muted rounded-lg p-2.5">
                  <input
                    type="color"
                    value={v.color}
                    onChange={e => updateVlan(v.id, 'color', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input
                    value={v.name}
                    onChange={e => updateVlan(v.id, 'name', e.target.value)}
                    className="bg-secondary border border-border rounded px-2 py-1 text-xs w-24 text-foreground focus:outline-none focus:border-primary"
                    placeholder="VLAN10"
                  />
                  <input
                    value={v.label}
                    onChange={e => updateVlan(v.id, 'label', e.target.value)}
                    className="bg-secondary border border-border rounded px-2 py-1 text-xs flex-1 text-foreground focus:outline-none focus:border-primary"
                    placeholder="Description"
                  />
                  <input
                    value={v.subnet}
                    onChange={e => updateVlan(v.id, 'subnet', e.target.value)}
                    className="bg-secondary border border-border rounded px-2 py-1 text-xs w-32 text-foreground focus:outline-none focus:border-primary font-mono"
                    placeholder="10.0.0.0/24"
                  />
                  <button onClick={() => deleteVlan(v.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No VLANs defined yet.</p>
          )}

          {/* Add new VLAN */}
          <div className="border border-dashed border-border rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Add VLAN</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 flex-wrap mb-2">
                {VLAN_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewVlan(v => ({ ...v, color: c }))}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${newVlan.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                value={newVlan.name}
                onChange={e => setNewVlan(v => ({ ...v, name: e.target.value }))}
                className="bg-muted border border-border rounded px-2 py-1.5 text-xs w-24 text-foreground focus:outline-none focus:border-primary"
                placeholder="VLAN10"
              />
              <input
                value={newVlan.label}
                onChange={e => setNewVlan(v => ({ ...v, label: e.target.value }))}
                className="bg-muted border border-border rounded px-2 py-1.5 text-xs flex-1 text-foreground focus:outline-none focus:border-primary"
                placeholder="Description"
              />
              <input
                value={newVlan.subnet}
                onChange={e => setNewVlan(v => ({ ...v, subnet: e.target.value }))}
                className="bg-muted border border-border rounded px-2 py-1.5 text-xs w-32 text-foreground focus:outline-none focus:border-primary font-mono"
                placeholder="10.0.0.0/24"
              />
              <button
                onClick={addVlan}
                disabled={!newVlan.name.trim()}
                className="flex items-center gap-1 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
