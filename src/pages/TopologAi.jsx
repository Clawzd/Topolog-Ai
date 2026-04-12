import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
import NetworkInsightsPanel from '../components/topology/NetworkInsightsPanel';
import { generateId } from '../lib/topologyData';
import { generatePromptTopology } from '../lib/promptTopologyGenerator';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ConnectionTypePopup from '../components/topology/ConnectionTypePopup';
import ContextMenu from '../components/topology/ContextMenu';
import RenameModal from '../components/topology/RenameModal';
import ArtifactModal from '../components/topology/ArtifactModal';
import {
  createTopologyPayload,
  decodeShareState,
  encodeShareState,
  generateConfigBundle,
  generateDesignBrief,
  validateTopology,
} from '../lib/networkArtifacts';
import { computeSmartTopology, shortestPath } from '../lib/smartNetworkEngine';
import { useTopologyUiStore } from '../stores/topologyUiStore';
import CommandPalette from '../components/topology/CommandPalette';
import KeyboardShortcutsModal from '../components/topology/KeyboardShortcutsModal';
import OnboardingTour from '../components/topology/OnboardingTour';

const CANVAS_STORAGE_KEY = 'topologai_canvas';

export default function TopologAi() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [vlans, setVlans] = useState([]);
  const [barriers, setBarriers] = useState([]);
  const [vlanZones, setVlanZones] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [highlightVlan, setHighlightVlan] = useState(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [propsPanelOpen, setPropsPanelOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [showVlanManager, setShowVlanManager] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [history, setHistory] = useState([]); // for undo
  const [toast, setToast] = useState(null);
  const [linkTypePopup, setLinkTypePopup] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [renameModal, setRenameModal] = useState(null); // {title, value, onConfirm}
  const [artifactModal, setArtifactModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const canvasRef = useRef(null);
  const importInputRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  const failureTarget = useTopologyUiStore(s => s.failureTarget);
  const failureKind = useTopologyUiStore(s => s.failureKind);
  const setFailureSim = useTopologyUiStore(s => s.setFailureSim);
  const clearFailureSim = useTopologyUiStore(s => s.clearFailureSim);
  const setPulseNodeId = useTopologyUiStore(s => s.setPulseNodeId);
  const heatmapMode = useTopologyUiStore(s => s.heatmapMode);
  const setHeatmapMode = useTopologyUiStore(s => s.setHeatmapMode);
  const showTrafficFlow = useTopologyUiStore(s => s.showTrafficFlow);
  const setShowTrafficFlow = useTopologyUiStore(s => s.setShowTrafficFlow);
  const showComplianceView = useTopologyUiStore(s => s.showComplianceView);
  const setShowComplianceView = useTopologyUiStore(s => s.setShowComplianceView);
  const showPowerView = useTopologyUiStore(s => s.showPowerView);
  const setShowPowerView = useTopologyUiStore(s => s.setShowPowerView);
  const showApAdvisor = useTopologyUiStore(s => s.showApAdvisor);
  const setShowApAdvisor = useTopologyUiStore(s => s.setShowApAdvisor);
  const pathTraceSource = useTopologyUiStore(s => s.pathTraceSource);
  const pathTraceTarget = useTopologyUiStore(s => s.pathTraceTarget);
  const setPathTrace = useTopologyUiStore(s => s.setPathTrace);
  const clearPathTrace = useTopologyUiStore(s => s.clearPathTrace);
  const commandPaletteOpen = useTopologyUiStore(s => s.commandPaletteOpen);
  const setCommandPaletteOpen = useTopologyUiStore(s => s.setCommandPaletteOpen);
  const shortcutsOpen = useTopologyUiStore(s => s.shortcutsOpen);
  const setShortcutsOpen = useTopologyUiStore(s => s.setShortcutsOpen);
  const onboardingStep = useTopologyUiStore(s => s.onboardingStep);
  const setOnboardingStep = useTopologyUiStore(s => s.setOnboardingStep);
  const pulseNodeId = useTopologyUiStore(s => s.pulseNodeId);

  const smartSnapshot = useMemo(
    () =>
      computeSmartTopology({
        nodes,
        links,
        rooms,
        vlans,
        barriers,
        vlanZones,
        excludeNodeId: failureKind === 'node' ? failureTarget : null,
        excludeLinkId: failureKind === 'link' ? failureTarget : null,
      }),
    [nodes, links, rooms, vlans, barriers, vlanZones, failureKind, failureTarget]
  );

  const baselineSnapshot = useMemo(
    () => computeSmartTopology({ nodes, links, rooms, vlans, barriers, vlanZones }),
    [nodes, links, rooms, vlans, barriers, vlanZones]
  );

  const failureImpactIds = useMemo(() => {
    if (!failureTarget || failureKind !== 'node') return new Set();
    const after = computeSmartTopology({
      nodes,
      links,
      rooms,
      vlans,
      barriers,
      vlanZones,
      excludeNodeId: failureTarget,
    });
    const ids = new Set();
    nodes.forEach((n) => {
      const b = baselineSnapshot.deviceStates[n.id]?.smartState;
      const a = after.deviceStates[n.id]?.smartState;
      if (a !== b && (a === 'no_network' || a === 'isolated' || a === 'slow_network')) ids.add(n.id);
    });
    return ids;
  }, [failureTarget, failureKind, nodes, links, rooms, vlans, barriers, vlanZones, baselineSnapshot]);

  const pathTracePath = useMemo(() => {
    if (!pathTraceSource || !pathTraceTarget) return null;
    return shortestPath(nodes, links, pathTraceSource, pathTraceTarget);
  }, [pathTraceSource, pathTraceTarget, nodes, links]);

  const [scoreHistory, setScoreHistory] = useState([]);
  useEffect(() => {
    if (smartSnapshot?.overallScore == null) return;
    setScoreHistory((h) => [...h.slice(-9), smartSnapshot.overallScore]);
  }, [smartSnapshot?.overallScore]);

  useEffect(() => {
    try {
      if (!localStorage.getItem('topologai_tour_done')) setOnboardingStep(0);
    } catch {
      /* ignore */
    }
  }, [setOnboardingStep]);

  const handleAutoFixFinding = useCallback(
    (fix) => {
      if (!fix) return;
      pushHistory();
      if (fix.type === 'set_node_vlan') {
        setNodes((n) => n.map((x) => (x.id === fix.nodeId ? { ...x, vlan: fix.vlan } : x)));
        showToast('VLAN updated');
      }
      if (fix.type === 'set_link_poe') {
        const uplink = links.find((l) => l.target === fix.nodeId || l.source === fix.nodeId);
        if (uplink) {
          setLinks((ls) => ls.map((l) => (l.id === uplink.id ? { ...l, poe: 'poe' } : l)));
          showToast('PoE set on uplink');
        }
      }
    },
    [links, pushHistory]
  );

  const handleHighlightFinding = useCallback(
    (ids) => {
      const id = ids?.[0];
      if (id) {
        setSelectedId(id);
        setSelectedIds([]);
        setPulseNodeId(id);
        setTimeout(() => setPulseNodeId(null), 2500);
      }
    },
    [setPulseNodeId]
  );

  const prevOverallRef = useRef(null);
  const [scoreDelta, setScoreDelta] = useState(0);
  useEffect(() => {
    const o = smartSnapshot?.overallScore;
    if (o == null) return;
    const prev = prevOverallRef.current;
    if (prev != null && prev !== o) {
      setScoreDelta(o - prev);
      const t = setTimeout(() => setScoreDelta(0), 2800);
      prevOverallRef.current = o;
      return () => clearTimeout(t);
    }
    prevOverallRef.current = o;
  }, [smartSnapshot?.overallScore]);

  const handleAutoFixAll = useCallback(
    (findings) => {
      const list = (findings || []).filter((f) => f.autoFix);
      if (!list.length) return;
      pushHistory();
      list.forEach((f) => {
        const fix = f.autoFix;
        if (fix.type === 'set_node_vlan') {
          setNodes((n) => n.map((x) => (x.id === fix.nodeId ? { ...x, vlan: fix.vlan } : x)));
        }
        if (fix.type === 'set_link_poe') {
          setLinks((ls) => {
            const uplink = ls.find((l) => l.target === fix.nodeId || l.source === fix.nodeId);
            if (!uplink) return ls;
            return ls.map((l) => (l.id === uplink.id ? { ...l, poe: 'poe' } : l));
          });
        }
      });
      showToast('Auto-fixes applied');
    },
    [pushHistory]
  );

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

  useEffect(() => {
    const encoded = window.location.hash.match(/topology=([^&]+)/)?.[1];
    if (!encoded) return;
    try {
      const data = decodeShareState(encoded);
      setNodes(data.nodes || []);
      setLinks(data.links || []);
      setRooms(data.rooms || []);
      setVlans(data.vlans || []);
      setBarriers(data.barriers || []);
      setVlanZones(data.vlanZones || []);
      setCurrentPrompt(data.prompt || 'Shared topology');
      setInsightsOpen(true);
      showToast('Shared topology loaded', 'success');
    } catch {
      showToast('Shared topology link is invalid');
    }
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Push to undo history
  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-19), { nodes, links, rooms, vlans, barriers, vlanZones, at: Date.now() }]);
    setRedoStack([]);
  }, [nodes, links, rooms, vlans, barriers, vlanZones]);

  const handleUndo = () => {
    if (!history.length) return;
    setRedoStack(r => [{ nodes, links, rooms, vlans, barriers, vlanZones }, ...r.slice(0, 19)]);
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setNodes(prev.nodes);
    setLinks(prev.links);
    setRooms(prev.rooms);
    setVlans(prev.vlans);
    setBarriers(prev.barriers || []);
    setVlanZones(prev.vlanZones || []);
    showToast('Undo applied');
  };

  const handleRedo = () => {
    if (!redoStack.length) return;
    setHistory(h => [...h.slice(-19), { nodes, links, rooms, vlans, barriers, vlanZones, at: Date.now() }]);
    const next = redoStack[0];
    setRedoStack(r => r.slice(1));
    setNodes(next.nodes);
    setLinks(next.links);
    setRooms(next.rooms);
    setVlans(next.vlans);
    setBarriers(next.barriers || []);
    setVlanZones(next.vlanZones || []);
    showToast('Redo applied');
  };

  const handleJumpToHistoryIndex = useCallback(
    (idx) => {
      const snap = history[idx];
      if (!snap) return;
      setNodes(snap.nodes);
      setLinks(snap.links);
      setRooms(snap.rooms);
      setVlans(snap.vlans);
      setBarriers(snap.barriers || []);
      setVlanZones(snap.vlanZones || []);
      setHistory((h) => h.slice(0, idx));
      setRedoStack([]);
      setSelectedId(null);
      setSelectedIds([]);
      showToast('Restored snapshot');
    },
    [history]
  );

  // Load topology from AI
  const loadTopology = (topology, prompt, isRefinement = false) => {
    pushHistory();
    if (isRefinement) {
      const existingIds = new Set(nodes.map(x => x.id));
      const idMap = {};
      const newNodes = topology.nodes.map(node => {
        const nextId = existingIds.has(node.id) ? generateId('n') : node.id;
        idMap[node.id] = nextId;
        return {
          ...node,
          id: nextId,
          x: node.x + 50,
          y: node.y + 50,
        };
      });

      setNodes(n => {
        return [...n, ...newNodes];
      });
      setLinks(l => [...l, ...topology.links.map(lk => ({
        ...lk,
        id: generateId('l'),
        source: idMap[lk.source] || lk.source,
        target: idMap[lk.target] || lk.target,
      }))]);
      setRooms(r => [...r, ...topology.rooms.map(rm => ({ ...rm, id: generateId('r') }))]);
      setVlans(v => {
        const existing = new Set(v.map(x => x.name));
        return [...v, ...topology.vlans.filter(x => !existing.has(x.name))];
      });
      setBarriers(b => [
        ...b,
        ...(topology.barriers || []).map(br => ({ ...br, id: generateId('b') })),
      ]);
      setVlanZones(z => [
        ...z,
        ...(topology.vlanZones || []).map(vz => ({ ...vz, id: generateId('vz') })),
      ]);
    } else {
      setNodes(topology.nodes);
      setLinks(topology.links);
      setRooms(topology.rooms);
      setVlans(topology.vlans);
      setBarriers(topology.barriers || []);
      setVlanZones(topology.vlanZones || []);
    }
    if (prompt) setCurrentPrompt(prompt);
    setSelectedId(null);
    setSelectedIds([]);
    setConnectingFrom(null);
    showToast(isRefinement ? 'Topology refined!' : 'Topology generated!', 'success');
  };

  const handleTopologyGenerated = (topology, prompt) => loadTopology(topology, prompt, false);
  const handleRefinement = (topology, prompt) => loadTopology(topology, prompt, true);

  const handleTemplateSelect = (template) => {
    loadTopology(template.data, template.prompt, false);
    showToast(`Template "${template.name}" loaded`);
  };

  const handleQuickStart = () => {
    const prompt = 'zero trust branch with SD-WAN edge, corporate WiFi, guest WiFi, and identity proxy';
    loadTopology(generatePromptTopology(prompt), prompt, false);
    setInsightsOpen(true);
  };

  // Node operations
  const handleNodeMove = (id, x, y) => {
    setNodes(n => n.map(node => (node.id === id ? { ...node, x, y } : node)));
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
      } else if (target.type === 'barrier') {
        setBarriers(b => b.filter(x => x.id !== target.id));
      } else if (target.type === 'vlanZone') {
        setVlanZones(z => z.filter(x => x.id !== target.id));
      }
      setSelectedId(null);
      setSelectedIds([]);
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

  const handleRoomMove = (id, x, y) => {
    setRooms(r => r.map(room => room.id === id ? { ...room, x, y } : room));
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
    const selectedNodeIds = selectedIds.length > 1 ? selectedIds : selectedId ? [selectedId] : [];
    if (!selectedNodeIds.length && !selectedId) return;
    if (selectedId && barriers.some(b => b.id === selectedId)) {
      pushHistory();
      setBarriers(b => b.filter(x => x.id !== selectedId));
      setSelectedId(null);
      return;
    }
    if (selectedId && vlanZones.some(z => z.id === selectedId)) {
      pushHistory();
      setVlanZones(z => z.filter(x => x.id !== selectedId));
      setSelectedId(null);
      return;
    }
    pushHistory();
    const selectedNodeSet = new Set(selectedNodeIds);
    setNodes(n => n.filter(x => !selectedNodeSet.has(x.id)));
    setLinks(l => l.filter(x => x.id !== selectedId && !selectedNodeSet.has(x.source) && !selectedNodeSet.has(x.target)));
    if (selectedId && selectedNodeIds.length === 1) setRooms(r => r.filter(x => x.id !== selectedId));
    setSelectedId(null);
    setSelectedIds([]);
  };

  const handleUpdate = (id, form, type) => {
    if (type === 'node') setNodes(n => n.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'link') setLinks(l => l.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'room') setRooms(r => r.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'barrier') setBarriers(b => b.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'vlanZone') setVlanZones(z => z.map(x => x.id === id ? { ...x, ...form } : x));
  };

  const handleBarrierAdd = (barrier) => {
    pushHistory();
    const id = generateId('b');
    setBarriers(b => [...b, { ...barrier, id }]);
    setSelectedId(id);
  };

  const handleVlanZoneAdd = (zone) => {
    pushHistory();
    const id = generateId('vz');
    setVlanZones(z => [...z, { ...zone, id }]);
    setSelectedId(id);
  };

  const handleGhostApPlace = useCallback(
    (gx, gy) => {
      pushHistory();
      const c = nodes.filter((n) => n.type === 'ap').length + 1;
      const newNode = {
        id: generateId('n'),
        type: 'ap',
        label: `Access Point ${c}`,
        x: gx - 45,
        y: gy - 28,
        ip: '',
        vlan: null,
      };
      setNodes((n) => [...n, newNode]);
      setSelectedId(newNode.id);
      setShowApAdvisor(false);
      showToast('AP placed from advisor');
    },
    [nodes, pushHistory, setShowApAdvisor]
  );

  const getPayload = () =>
    createTopologyPayload({ nodes, links, rooms, vlans, prompt: currentPrompt, barriers, vlanZones });

  const downloadText = (filename, body, type = 'text/plain') => {
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async (text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard unavailable');
      }
      showToast('Copied to clipboard', 'success');
    } catch {
      setArtifactModal({
        title: 'Copy Manually',
        filename: 'topology-copy.txt',
        body: text,
        type: 'text/plain',
      });
    }
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
    const data = { nodes, links, rooms, vlans, barriers, vlanZones, prompt: currentPrompt };
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(data));
    showToast('Saved to browser', 'success');
  };

  const handleLoad = () => {
    const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (!raw) { showToast('No saved data found'); return; }
    try {
      const data = JSON.parse(raw);
      pushHistory();
      setNodes(data.nodes || []);
      setLinks(data.links || []);
      setRooms(data.rooms || []);
      setVlans(data.vlans || []);
      setBarriers(data.barriers || []);
      setVlanZones(data.vlanZones || []);
      setCurrentPrompt(data.prompt || '');
      setSelectedId(null);
      setSelectedIds([]);
      showToast('Loaded from browser', 'success');
    } catch {
      showToast('Saved topology is invalid');
    }
  };

  const applyImportedTopology = (data, label = 'Imported topology') => {
    pushHistory();
    setNodes(data.nodes || []);
    setLinks(data.links || []);
    setRooms(data.rooms || []);
    setVlans(data.vlans || []);
    setBarriers(data.barriers || []);
    setVlanZones(data.vlanZones || []);
    setCurrentPrompt(data.prompt || label);
    setSelectedId(null);
    setSelectedIds([]);
    setInsightsOpen(true);
  };

  const handleImportJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      applyImportedTopology(data, file.name);
      showToast('JSON topology imported', 'success');
    } catch {
      showToast('Import failed. Choose a valid topology JSON file.');
    }
  };

  const handleReset = () => {
    pushHistory();
    setNodes([]); setLinks([]); setRooms([]); setVlans([]); setBarriers([]); setVlanZones([]);
    setSelectedId(null); setCurrentPrompt('');
    setSelectedIds([]);
    showToast('Canvas cleared');
  };

  // Export SVG
  const handleExportSvg = () => {
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
    const data = getPayload();
    downloadText('topology.json', JSON.stringify(data, null, 2), 'application/json');
    showToast('Exported as JSON', 'success');
  };

  const handleExportBrief = () => {
    const body = generateDesignBrief(getPayload(), smartSnapshot);
    downloadText('topology-design-brief.md', body, 'text/markdown');
    showToast('Design brief exported', 'success');
  };

  const handleExportConfig = () => {
    const body = generateConfigBundle(getPayload());
    setArtifactModal({
      title: 'Configuration Draft',
      filename: 'topology-config.txt',
      body,
      type: 'text/plain',
    });
  };

  const handleValidate = () => {
    const validation = validateTopology(getPayload());
    const body = [
      `Validation score: ${validation.score}/100`,
      validation.summary,
      '',
      ...(validation.findings.length
        ? validation.findings.map(item => `${item.severity.toUpperCase()} - ${item.title}: ${item.detail}`)
        : ['No major design issues found.']),
      '',
    ].join('\n');
    setArtifactModal({
      title: 'Network Validation',
      filename: 'topology-validation.txt',
      body,
      type: 'text/plain',
    });
  };

  const handleShareLink = async () => {
    const encoded = encodeShareState(getPayload());
    const url = `${window.location.origin}${window.location.pathname}#topology=${encoded}`;
    await copyText(url);
  };

  const handleAutoLayout = () => {
    if (!nodes.length) {
      showToast('Add devices before auto layout');
      return;
    }

    pushHistory();
    const adjacency = new Map(nodes.map(node => [node.id, []]));
    links.forEach(link => {
      if (adjacency.has(link.source)) adjacency.get(link.source).push(link.target);
      if (adjacency.has(link.target)) adjacency.get(link.target).push(link.source);
    });

    const roots = nodes.filter(node => node.type === 'cloud');
    if (!roots.length) roots.push(...nodes.filter(node => node.type === 'firewall'));
    if (!roots.length) roots.push(...nodes.filter(node => node.type === 'router'));
    const queue = (roots.length ? roots : [nodes[0]]).map(node => node.id);
    const depth = new Map(queue.map(id => [id, 0]));
    for (let i = 0; i < queue.length; i += 1) {
      const id = queue[i];
      const nextDepth = (depth.get(id) || 0) + 1;
      (adjacency.get(id) || []).forEach(nextId => {
        if (!depth.has(nextId)) {
          depth.set(nextId, nextDepth);
          queue.push(nextId);
        }
      });
    }

    const typePriority = {
      cloud: 0,
      firewall: 1,
      router: 2,
      loadbalancer: 3,
      switch: 4,
      patchpanel: 5,
      ap: 6,
      server: 7,
      nas: 7,
      pdu: 7,
      pc: 8,
      laptop: 8,
      phone: 8,
      printer: 8,
      camera: 8,
      tablet: 8,
      smarttv: 8,
      iot: 8,
    };

    const grouped = {};
    nodes.forEach(node => {
      const layer = depth.get(node.id) ?? (typePriority[node.type] || 8);
      grouped[layer] = grouped[layer] || [];
      grouped[layer].push(node);
    });

    const arranged = [];
    Object.entries(grouped).forEach(([layer, layerNodes]) => {
      layerNodes
        .sort((a, b) => (typePriority[a.type] || 20) - (typePriority[b.type] || 20) || a.label.localeCompare(b.label))
        .forEach((node, index) => {
          const centeredOffset = (index - (layerNodes.length - 1) / 2) * 118;
          arranged.push({
            ...node,
            x: 90 + Number(layer) * 165,
            y: 300 + centeredOffset,
          });
        });
    });

    setNodes(arranged);
    setZoom(0.9);
    setPan({ x: 80, y: 40 });
    showToast('Auto layout applied', 'success');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setMode('select');
        clearFailureSim();
        setCommandPaletteOpen(false);
        setShortcutsOpen(false);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedId || selectedIds.length) handleDelete(); }
      if (e.key === 'v' || e.key === 'V') setMode('select');
      if (e.key === 'c' || e.key === 'C') setMode('connect');
      if (e.key === 'h' || e.key === 'H') setMode('pan');
      if (e.key === 'b' || e.key === 'B') setMode('barrier');
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); handleRedo(); return; }
      if (e.key === 'i' || e.key === 'I') setInsightsOpen(open => !open);
      if (e.key === 'p' || e.key === 'P') setPropsPanelOpen(open => !open);
      if (e.key === 'r' || e.key === 'R') setMode('room');
      if (e.key === 'f' || e.key === 'F') {
        if (selectedId && nodes.some(n => n.id === selectedId)) setFailureSim(selectedId, 'node');
        else if (selectedId && links.some(l => l.id === selectedId)) setFailureSim(selectedId, 'link');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        setHeatmapMode(m => (m === 'signal' ? null : 'signal'));
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); setShortcutsOpen(true); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedIds, mode, nodes, links, clearFailureSim, setCommandPaletteOpen, setShortcutsOpen, setFailureSim, setHeatmapMode]);

  const hasTopology = nodes.length > 0;
  const hasSelection = !!selectedId || selectedIds.length > 1;

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
        onImportJson={() => importInputRef.current?.click()}
        onExportJson={handleExportJson}
        onExportSvg={handleExportSvg}
        onExportBrief={handleExportBrief}
        onExportConfig={handleExportConfig}
        onShare={handleShareLink}
        onValidate={handleValidate}
        onAutoLayout={handleAutoLayout}
        insightsOpen={insightsOpen}
        onToggleInsights={() => setInsightsOpen(open => !open)}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode(open => !open)}
      />
      <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportJson} />


      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* AI Panel */}
        {!focusMode && (
        <div className={`flex-shrink-0 border-r border-border bg-card transition-all duration-200 overflow-hidden flex flex-col ${aiPanelOpen ? 'w-64' : 'w-0'}`}>
          {aiPanelOpen && (
            <AIPanel
              onTopologyGenerated={handleTopologyGenerated}
              onRefinement={handleRefinement}
              hasTopology={hasTopology}
            />
          )}
        </div>
        )}

        {/* Toggle AI panel */}
        {!focusMode && (
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
        )}

        {/* Left device panel */}
        {!focusMode && <LeftPanel onDeviceDragStart={handleDeviceDragStart} mode={mode} setMode={setMode} />}

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
              onRedo={handleRedo}
              canRedo={redoStack.length > 0}
              hasSelection={hasSelection}
              heatmapMode={heatmapMode}
              setHeatmapMode={setHeatmapMode}
              showTrafficFlow={showTrafficFlow}
              setShowTrafficFlow={setShowTrafficFlow}
              showComplianceView={showComplianceView}
              setShowComplianceView={setShowComplianceView}
              showPowerView={showPowerView}
              setShowPowerView={setShowPowerView}
              showApAdvisor={showApAdvisor}
              setShowApAdvisor={setShowApAdvisor}
              failureActive={!!failureTarget}
              onClearFailure={clearFailureSim}
              findingCount={smartSnapshot?.findings?.length || 0}
              onExport={() => showToast('Use Top bar for full export options')}
            />
          </div>
          <TopologyCanvas
            nodes={nodes} links={links} rooms={rooms} vlans={vlans}
            barriers={barriers}
            vlanZones={vlanZones}
            smartSnapshot={smartSnapshot}
            heatmapMode={heatmapMode}
            showTrafficFlow={showTrafficFlow}
            showComplianceView={showComplianceView}
            showPowerView={showPowerView}
            showApAdvisor={showApAdvisor}
            failureImpactIds={failureImpactIds}
            pathTracePath={pathTracePath}
            pulseNodeId={pulseNodeId}
            onBarrierAdd={handleBarrierAdd}
            onVlanZoneAdd={handleVlanZoneAdd}
            onGhostApPlace={handleGhostApPlace}
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
            onRoomMove={handleRoomMove}
            onBeforeChange={pushHistory}
            zoom={zoom} pan={pan}
            setZoom={setZoom} setPan={setPan}
            connectingFrom={connectingFrom}
            setConnectingFrom={setConnectingFrom}
            highlightVlan={highlightVlan}
            onContextMenuRequest={handleContextMenuRequest}
          />

          {!hasTopology && <EmptyState onTemplates={() => setShowTemplates(true)} onQuickStart={handleQuickStart} />}

          {/* Minimap */}
          {hasTopology && (
            <MiniMap
              nodes={nodes} links={links} rooms={rooms} barriers={barriers}
              zoom={zoom} pan={pan}
              canvasSize={canvasSize}
            />
          )}

          {hasTopology && insightsOpen && !focusMode && (
            <NetworkInsightsPanel
              nodes={nodes}
              links={links}
              vlans={vlans}
              smartSnapshot={smartSnapshot}
              scoreHistory={scoreHistory}
              scoreDelta={scoreDelta}
              historySnapshots={history}
              onJumpHistory={handleJumpToHistoryIndex}
              onHighlightFinding={handleHighlightFinding}
              onAutoFixFinding={handleAutoFixFinding}
              onAutoFixAll={handleAutoFixAll}
              onAutoLayout={handleAutoLayout}
              onOpenVlanManager={() => setShowVlanManager(true)}
              onTemplates={() => setShowTemplates(true)}
              onValidate={handleValidate}
              onExportBrief={handleExportBrief}
              onExportConfig={handleExportConfig}
              onShare={handleShareLink}
              onClose={() => setInsightsOpen(false)}
            />
          )}

          {/* Mode indicator */}
          {mode === 'connect' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              {connectingFrom ? 'Click target device to connect' : 'Click source device to start connection'}
              <span className="ml-2 opacity-70">- Esc to cancel</span>
            </div>
          )}
          {mode === 'room' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Click and drag to draw a room - Esc to cancel
            </div>
          )}
          {mode === 'barrier' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Drag to draw a wall / barrier — affects Wi‑Fi in intelligence engine
            </div>
          )}
          {mode === 'vlanzone' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Drag a VLAN overlay region — Esc to cancel
            </div>
          )}

          {selectedIds.length >= 2 && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/80 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-md">
              <span className="text-[10px] text-muted-foreground">{selectedIds.length} selected</span>
              <button
                type="button"
                className="text-[10px] rounded-lg bg-primary px-2.5 py-1 font-medium text-primary-foreground"
                onClick={() => setPathTrace(selectedIds[0], selectedIds[1])}
              >
                Trace route
              </button>
              <button
                type="button"
                className="text-[10px] rounded-lg border border-border px-2.5 py-1 text-foreground/80 hover:bg-muted"
                onClick={() => clearPathTrace()}
              >
                Clear trace
              </button>
              <button
                type="button"
                className="text-[10px] rounded-lg border border-border px-2.5 py-1 text-foreground/80 hover:bg-muted"
                onClick={() => {
                  pushHistory();
                  const sel = nodes.filter(n => selectedIds.includes(n.id));
                  if (sel.length < 2) return;
                  const minX = Math.min(...sel.map(n => n.x));
                  setNodes(n => n.map(node => (selectedIds.includes(node.id) ? { ...node, x: minX } : node)));
                  showToast('Aligned horizontally');
                }}
              >
                Align H
              </button>
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
        {hasSelection && propsPanelOpen && !focusMode && (
          <PropertiesPanel
            selectedId={selectedId}
            nodes={nodes} links={links} rooms={rooms} barriers={barriers} vlanZones={vlanZones} vlans={vlans}
            deviceStates={smartSnapshot?.deviceStates}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onSelectNode={(id) => { setSelectedId(id); setSelectedIds([]); }}
          />
        )}
      </div>

      {/* Stats bar */}
      <StatsPanel
        nodes={nodes} links={links} vlans={vlans} rooms={rooms} barriers={barriers}
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

      {artifactModal && (
        <ArtifactModal
          title={artifactModal.title}
          body={artifactModal.body}
          onClose={() => setArtifactModal(null)}
          onCopy={() => copyText(artifactModal.body)}
          onDownload={() => {
            downloadText(artifactModal.filename, artifactModal.body, artifactModal.type);
            showToast('Artifact downloaded', 'success');
          }}
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

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onTemplates={() => setShowTemplates(true)}
        onVlanManager={() => setShowVlanManager(true)}
        onAutoLayout={handleAutoLayout}
        onToggleHeatmap={() => setHeatmapMode(m => (m === 'signal' ? null : 'signal'))}
        onToggleTraffic={() => setShowTrafficFlow(v => !v)}
        onToggleCompliance={() => setShowComplianceView(v => !v)}
        onTogglePower={() => setShowPowerView(v => !v)}
        onToggleApAdvisor={() => setShowApAdvisor(v => !v)}
        onExportBrief={handleExportBrief}
        onSave={handleSave}
      />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <OnboardingTour
        step={onboardingStep}
        onStep={setOnboardingStep}
        onDismiss={() => {
          try {
            localStorage.setItem('topologai_tour_done', '1');
          } catch { /* ignore */ }
          setOnboardingStep(null);
        }}
      />
    </div>
  );
}
