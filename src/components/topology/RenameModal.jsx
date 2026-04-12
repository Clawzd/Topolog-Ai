import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

export default function RenameModal({ title, value, onConfirm, onClose }) {
  const [val, setVal] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.select(), 50);
  }, []);

  const confirm = () => { if (val.trim()) onConfirm(val.trim()); onClose(); };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-2xl shadow-black/50 p-4 w-72"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{title}</p>
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') onClose(); }}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={confirm}
            disabled={!val.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium py-2 rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Check className="w-3.5 h-3.5" /> Rename
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
