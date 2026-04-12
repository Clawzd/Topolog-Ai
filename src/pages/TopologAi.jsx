import { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from '../components/topology/TopBar';
import Toolbar from '../components/topology/Toolbar';
import LeftPanel from '../components/topology/LeftPanel';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import PropertiesPanel from '../components/topology/PropertiesPanel';
import AIPanel from '../components/topology/AIPanel';
import StatsPanel from '../components/topology/StatsPanel';
import VlanManager from '../components/topology/VlanManager';
import TemplateGallery from '../components/topology/TemplateGallery';
import MiniMap from '../components/topology/MiniMap';
import EmptyState from '../components/topology/EmptyState';
import { generateId } from '../lib/topologyData';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ConnectionTypePopup from '../components/topology/ConnectionTypePopup';
import ContextMenu from '../components/topology/ContextMenu';
import RenameModal from '../components/topology/RenameModal';

const CANVAS_STORAGE_KEY = 'topologai_canvas';

export default function TopologAi() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [vlans, setVlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [highlightVlan, setHighlightVlan] = useState(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [propsPanelOpen, setPropsPanelOpen] = useState(true);
  const [showVlanManager, setShowVlanManager] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [history, setHistory] = useState([]); // for undo
  const [toast, setToast] = useState(null);
  const [linkTypePopup, setLinkTypePopup] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [renameModal, setRenameModal] = useState(null); // {title, value, onConfirm}
  const [selectedIds, setSelectedIds] = useState([]);
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  // Measure canvas
  useEffect(() => {
    const observe = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasSize({ w: rect.width, h: rect.height });
      }
    };
    observe();
    window.addEventListener('resize', observe);
    return () => window.removeEventListener('resize', observe);
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Push to undo history
  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-19), { nodes, links, rooms, vlans }]);
  }, [nodes, links, rooms, vlans]);

  const handleUndo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setNodes(prev.nodes);
    setLinks(prev.links);
    setRooms(prev.rooms);
    setVlans(prev.vlans);
    showToast('Undo applied');
  };

  // Load topology from AI
  const loadTopology = (topology, prompt, isRefinement = false) => {
    pushHistory();
    if (isRefinement) {
      // Merge: add new nodes/links/rooms/vlans
      setNodes(n => {
        const existingIds = new Set(n.map(x => x.id));
        const newNodes = topology.nodes.map(node => ({
          ...node,
          id: existingIds.has(node.id) ? generateId('n') : node.id,
          x: node.x + 50,
          y: node.y + 50,
        }));
        return [...n, ...newNodes];
      });
      setLinks(l => [...l, ...topology.links.map(lk => ({ ...lk, id: generateId('l') }))]);
      setRooms(r => [...r, ...topology.rooms.map(rm => ({ ...rm, id: generateId('r') }))]);
      setVlans(v => {
        const existing = new Set(v.map(x => x.name));
        return [...v, ...topology.vlans.filter(x => !existing.has(x.name))];
      });
    } else {
      setNodes(topology.nodes);
      setLinks(topology.links);
      setRooms(topology.rooms);
      setVlans(topology.vlans);
    }
    if (prompt) setCurrentPrompt(prompt);
    setSelectedId(null);
    setConnectingFrom(null);
    showToast(isRefinement ? 'Topology refined!' : 'Topology generated!', 'success');
  };

  const handleTopologyGenerated = (topology, prompt) => loadTopology(topology, prompt, false);
  const handleRefinement = (topology, prompt) => loadTopology(topology, prompt, true);

  const handleTemplateSelect = (template) => {
    loadTopology(template.data, template.prompt, false);
    showToast(`Template "${template.name}" loaded`);
  };

  // Node operations
  const handleNodeMove = (id, x, y) => {
    setNodes(n => n.map(node => node.id === id ? { ...node, x: Math.max(0, x), y: Math.max(0, y) } : node));
  };

  const handleNodeAdd = (type, x, y) => {
    pushHistory();
    const newNode = {
      id: generateId('n'),
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1) + ' ' + (nodes.filter(n => n.type === type).length + 1),
      x, y,
      ip: '',
      vlan: null,
    };
    setNodes(n => [...n, newNode]);
    setSelectedId(newNode.id);
  };

  const handleLinkAdd = (sourceId, targetId) => {
    const exists = links.find(l => (l.source === sourceId && l.target === targetId) || (l.source === targetId && l.target === sourceId));
    if (exists) { showToast('Connection already exists'); return; }
    pushHistory();
    const newId = generateId('l');
    const newLink = { id: newId, source: sourceId, target: targetId, type: 'ethernet', label: '' };
    setLinks(l => [...l, newLink]);
    setSelectedId(newId);
    // Show type picker popup near center of canvas
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setLinkTypePopup({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, linkId: newId });
    }
  };

  const handleLinkTypeSelect = (type) => {
    if (!linkTypePopup) return;
    setLinks(l => l.map(x => x.id === linkTypePopup.linkId ? { ...x, type } : x));
    setLinkTypePopup(null);
    showToast(`Link set to ${type}`, 'success');
  };

  const handleLinkDelete = (linkId) => {
    pushHistory();
    setLinks(l => l.filter(x => x.id !== linkId));
    if (selectedId === linkId) setSelectedId(null);
    showToast('Connection removed');
  };

  const handleLinkUpdate = (id, data) => {
    setLinks(l => l.map(x => x.id === id ? { ...x, ...data } : x));
  };

  const handleContextMenuRequest = (x, y, target) => {
    setContextMenu({ x, y, target });
    if (target.id) setSelectedId(target.id);
  };

  const handleContextMenuAction = (action) => {
    const target = contextMenu?.target;
    if (!target) return;
    if (action === 'delete') {
      pushHistory();
      if (target.type === 'node') {
        setNodes(n => n.filter(x => x.id !== target.id));
        setLinks(l => l.filter(x => x.source !== target.id && x.target !== target.id));
      } else if (target.type === 'link') {
        setLinks(l => l.filter(x => x.id !== target.id));
      } else if (target.type === 'room') {
        setRooms(r => r.filter(x => x.id !== target.id));
      }
      setSelectedId(null);
      showToast('Deleted');
    } else if (action === 'duplicate' && target.type === 'node') {
      pushHistory();
      const orig = nodes.find(n => n.id === target.id);
      if (orig) {
        const dup = { ...orig, id: generateId('n'), x: orig.x + 30, y: orig.y + 30, label: orig.label + ' (copy)' };
        setNodes(n => [...n, dup]);
        setSelectedId(dup.id);
        showToast('Duplicated');
      }
    } else if (action === 'connect_from' && target.type === 'node') {
      setMode('connect');
      setConnectingFrom(target.id);
      showToast('Click target device to connect');
    } else if (action === 'change_type' && target.type === 'link') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) setLinkTypePopup({ x: contextMenu.x, y: contextMenu.y, linkId: target.id });
    } else if (action === 'zoom_fit') {
      setZoom(1); setPan({ x: 60, y: 60 });
    } else if (action === 'reset_view') {
      setZoom(1); setPan({ x: 60, y: 60 });
    } else if (action === 'draw_room') {
      setMode('room');
      showToast('Drag on canvas to draw a room');
    } else if (action === 'connect_mode') {
      setMode('connect');
    } else if (action === 'clear') {
      handleReset();
    } else if (action === 'rename') {
      if (target.type === 'node') {
        setRenameModal({ title: 'Rename Device', value: target.item?.label || '', onConfirm: (v) => setNodes(n => n.map(x => x.id === target.id ? { ...x, label: v } : x)) });
      } else if (target.type === 'link') {
        setRenameModal({ title: 'Edit Link Label', value: target.item?.label || '', onConfirm: (v) => setLinks(l => l.map(x => x.id === target.id ? { ...x, label: v } : x)) });
      } else if (target.type === 'room') {
        setRenameModal({ title: 'Rename Room', value: target.item?.label || '', onConfirm: (v) => setRooms(r => r.map(x => x.id === target.id ? { ...x, label: v } : x)) });
      }
    }
  };

  const handleRoomResize = (id, dims) => {
    setRooms(r => r.map(x => x.id === id ? { ...x, ...dims } : x));
  };

  const handleRoomAdd = ({ x, y, w, h }) => {
    pushHistory();
    const newRoom = {
      id: generateId('r'),
      label: 'Room ' + (rooms.length + 1),
      x, y, w, h,
      color: 'rgba(59,130,246,0.08)',
    };
    setRooms(r => [...r, newRoom]);
    setSelectedId(newRoom.id);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    pushHistory();
    setNodes(n => n.filter(x => x.id !== selectedId));
    setLinks(l => l.filter(x => x.id !== selectedId && x.source !== selectedId && x.target !== selectedId));
    setRooms(r => r.filter(x => x.id !== selectedId));
    setSelectedId(null);
  };

  const handleUpdate = (id, form, type) => {
    if (type === 'node') setNodes(n => n.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'link') setLinks(l => l.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'room') setRooms(r => r.map(x => x.id === id ? { ...x, ...form } : x));
  };

  // Drag and drop from device palette
  const handleDeviceDragStart = (e, type) => {
    e.dataTransfer.setData('deviceType', type);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('deviceType');
    if (!type) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    handleNodeAdd(type, x - 45, y - 25);
  };

  // Save / Load
  const handleSave = () => {
    const data = { nodes, links, rooms, vlans, prompt: currentPrompt };
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(data));
    showToast('Saved to browser', 'success');
  };

  const handleLoad = () => {
    const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (!raw) { showToast('No saved data found'); return; }
    const data = JSON.parse(raw);
    pushHistory();
    setNodes(data.nodes || []);
    setLinks(data.links || []);
    setRooms(data.rooms || []);
    setVlans(data.vlans || []);
    setCurrentPrompt(data.prompt || '');
    showToast('Loaded from browser', 'success');
  };

  const handleReset = () => {
    pushHistory();
    setNodes([]); setLinks([]); setRooms([]); setVlans([]);
    setSelectedId(null); setCurrentPrompt('');
    showToast('Canvas cleared');
  };

  // Export PNG
  const handleExportPng = () => {
    const svg = canvasRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topology.svg';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported as SVG', 'success');
  };

  // Export JSON
  const handleExportJson = () => {
    const data = { nodes, links, rooms, vlans, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topology.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported as JSON', 'success');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { setConnectingFrom(null); setMode('select'); }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedId) handleDelete(); }
      if (e.key === 'v' || e.key === 'V') setMode('select');
      if (e.key === 'c' || e.key === 'C') setMode('connect');
      if (e.key === 'h' || e.key === 'H') setMode('pan');
      if (e.key === 'r' || e.key === 'R') setMode('room');
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, mode]);

  const hasTopology = nodes.length > 0;
  const hasSelection = !!selectedId;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden font-inter">
      {/* Top bar */}
      <TopBar
        onSave={handleSave}
        onLoad={handleLoad}
        onReset={() => {
          if (window.confirm('Clear the entire canvas? This cannot be undone.')) handleReset();
        }}
        onTemplates={() => setShowTemplates(true)}
        onVlanManager={() => setShowVlanManager(true)}
        onExportJson={handleExportJson}
      />


      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* AI Panel */}
        <div className={`flex-shrink-0 border-r border-border bg-card transition-all duration-200 overflow-hidden flex flex-col ${aiPanelOpen ? 'w-64' : 'w-0'}`}>
          {aiPanelOpen && (
            <AIPanel
              onTopologyGenerated={handleTopologyGenerated}
              onRefinement={handleRefinement}
              hasTopology={hasTopology}
            />
          )}
        </div>

        {/* Toggle AI panel */}
        <button
          onClick={() => setAiPanelOpen(o => !o)}
          className="flex-shrink-0 w-4 bg-card border-r border-border hover:bg-secondary transition-colors flex items-center justify-center group"
          title={aiPanelOpen ? 'Hide AI Panel' : 'Show AI Panel'}
        >
          {aiPanelOpen
            ? <ChevronLeft className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
          }
        </button>

        {/* Left device panel */}
        <LeftPanel onDeviceDragStart={handleDeviceDragStart} mode={mode} setMode={setMode} />

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-background"
          onDragOver={e => e.preventDefault()}
          onDrop={handleCanvasDrop}
        >
          {/* Floating Toolbar */}
          <div className="absolute top-3 left-3 z-10">
            <Toolbar
              mode={mode} setMode={setMode}
              zoom={zoom} setZoom={setZoom} setPan={setPan}
              onDelete={handleDelete}
              onUndo={handleUndo}
              hasSelection={hasSelection}
            />
          </div>
          <TopologyCanvas
            nodes={nodes} links={links} rooms={rooms} vlans={vlans}
            selectedId={selectedId} setSelectedId={setSelectedId}
            selectedIds={selectedIds} onMultiSelect={setSelectedIds}
            mode={mode} setMode={setMode}
            onNodeMove={handleNodeMove}
            onNodeAdd={handleNodeAdd}
            onLinkAdd={handleLinkAdd}
            onLinkUpdate={handleLinkUpdate}
            onLinkDelete={handleLinkDelete}
            onRoomAdd={handleRoomAdd}
            onRoomResize={handleRoomResize}
            zoom={zoom} pan={pan}
            setZoom={setZoom} setPan={setPan}
            connectingFrom={connectingFrom}
            setConnectingFrom={setConnectingFrom}
            highlightVlan={highlightVlan}
            onContextMenuRequest={handleContextMenuRequest}
          />

          {!hasTopology && <EmptyState onTemplates={() => setShowTemplates(true)} />}

          {/* Minimap */}
          {hasTopology && (
            <MiniMap
              nodes={nodes} links={links} rooms={rooms}
              zoom={zoom} pan={pan}
              canvasSize={canvasSize}
            />
          )}

          {/* Mode indicator */}
          {mode === 'connect' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              {connectingFrom ? 'Click target device to connect' : 'Click source device to start connection'}
              <span className="ml-2 opacity-70">· Esc to cancel</span>
            </div>
          )}
          {mode === 'room' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Click and drag to draw a room · Esc to cancel
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 text-xs px-4 py-2 rounded-full shadow-xl slide-in-bottom ${
              toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-card border border-border text-foreground'
            }`}>
              {toast.msg}
            </div>
          )}
        </div>

        {/* Properties panel */}
        {hasSelection && propsPanelOpen && (
          <PropertiesPanel
            selectedId={selectedId}
            nodes={nodes} links={links} rooms={rooms} vlans={vlans}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Stats bar */}
      <StatsPanel
        nodes={nodes} links={links} vlans={vlans} rooms={rooms}
        highlightVlan={highlightVlan}
        setHighlightVlan={setHighlightVlan}
      />

      {/* Rename modal */}
      {renameModal && (
        <RenameModal
          title={renameModal.title}
          value={renameModal.value}
          onConfirm={renameModal.onConfirm}
          onClose={() => setRenameModal(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          target={contextMenu.target}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Link type picker popup */}
      {linkTypePopup && (
        <ConnectionTypePopup
          position={{ x: linkTypePopup.x, y: linkTypePopup.y }}
          onSelect={handleLinkTypeSelect}
          onCancel={() => setLinkTypePopup(null)}
        />
      )}

      {/* Modals */}
      {showVlanManager && (
        <VlanManager vlans={vlans} setVlans={setVlans} onClose={() => setShowVlanManager(false)} />
      )}
      {showTemplates && (
        <TemplateGallery onSelect={handleTemplateSelect} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}