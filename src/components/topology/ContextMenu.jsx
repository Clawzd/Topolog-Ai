import { useEffect, useRef } from 'react';
import { Trash2, Copy, Edit3, Link2, Square, Unlink, ZoomIn, RotateCcw, Layers, Zap } from 'lucide-react';

/** @param {any} _props */
function EmptyIcon(_props) {
  return null;
}

export default function ContextMenu({ x, y, target, onAction, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      window.addEventListener('mousedown', handle);
      window.addEventListener('keydown', handleKey);
    }, 0);
    return () => { window.removeEventListener('mousedown', handle); window.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  // Adjust position to stay in viewport
  const style = {
    position: /** @type {const} */ ('fixed'),
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 300),
    zIndex: 9999,
  };

  const Item = ({ icon: Icon = EmptyIcon, label = '', action = '', danger = false, disabled = false, divider = false }) => {
    if (divider) return <div className="my-1 border-t border-border/60" />;
    return (
      <button
        disabled={disabled}
        onClick={() => { onAction(action); onClose(); }}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-lg transition-colors text-left
          ${danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-secondary'}
          ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        {label}
      </button>
    );
  };

  const renderItems = () => {
    if (target?.type === 'node') return (
      <>
        <Item icon={Edit3} label="Rename" action="rename" />
        <Item icon={Zap} label="Simulate failure…" action="simulate_failure" />
        <Item icon={Link2} label="Connect from here" action="connect_from" />
        <Item icon={Copy} label="Duplicate" action="duplicate" />
        <Item icon={EmptyIcon} label="" divider />
        <Item icon={Trash2} label="Delete device" action="delete" danger />
      </>
    );
    if (target?.type === 'link') return (
      <>
        <Item icon={Edit3} label="Edit label" action="rename" />
        <Item icon={Layers} label="Change type..." action="change_type" />
        <Item icon={EmptyIcon} label="" divider />
        <Item icon={Unlink} label="Delete connection" action="delete" danger />
      </>
    );
    if (target?.type === 'room') return (
      <>
        <Item icon={Edit3} label="Rename room" action="rename" />
        <Item icon={EmptyIcon} label="" divider />
        <Item icon={Trash2} label="Delete room" action="delete" danger />
      </>
    );
    if (target?.type === 'barrier') return (
      <>
        <Item icon={Trash2} label="Delete barrier" action="delete" danger />
      </>
    );
    if (target?.type === 'vlanZone') return (
      <>
        <Item icon={Trash2} label="Delete VLAN zone" action="delete" danger />
      </>
    );
    if (target?.type === 'powerZone') return (
      <>
        <Item icon={Trash2} label="Delete power zone" action="delete" danger />
      </>
    );
    // Canvas
    return (
      <>
        <Item icon={ZoomIn} label="Zoom to fit" action="zoom_fit" />
        <Item icon={RotateCcw} label="Reset view" action="reset_view" />
        <Item icon={EmptyIcon} label="" divider />
        <Item icon={Square} label="Draw room here" action="draw_room" />
        <Item icon={Square} label="Room from barrier bounds" action="suggest_room_from_barriers" />
        <Item icon={Link2} label="Connect mode" action="connect_mode" />
        <Item icon={EmptyIcon} label="" divider />
        <Item icon={Trash2} label="Clear canvas" action="clear" danger />
      </>
    );
  };

  return (
    <div
      ref={ref}
      style={style}
      className="bg-card/98 backdrop-blur-md border border-border rounded-lg shadow-2xl shadow-black/50 p-1.5 w-48 animate-in fade-in zoom-in-95 duration-100"
      onContextMenu={e => e.preventDefault()}
    >
      {target && (
        <div className="px-3 py-1.5 mb-1 border-b border-border/60">
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">
            {target.type === 'node' ? target.item?.label || 'Device'
              : target.type === 'link' ? 'Connection'
              : target.type === 'room' ? target.item?.label || 'Room'
              : target.type === 'barrier' ? target.item?.label || 'Barrier'
              : target.type === 'vlanZone' ? target.item?.label || 'VLAN zone'
              : target.type === 'powerZone' ? target.item?.label || 'Power zone'
              : 'Canvas'}
          </span>
        </div>
      )}
      {renderItems()}
    </div>
  );
}
