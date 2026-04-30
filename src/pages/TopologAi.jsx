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
import { DEVICE_TYPES, generateId, normalizeTopologyForExpo, TEMPLATES } from '../lib/topologyData';
import { instantiateTopologyPattern, TOPOLOGY_PATTERNS } from '../lib/topologyPatterns';
import { expandBusLinksForCanvas } from '../lib/busExpansion';
import { ChevronLeft, ChevronRight, Box, Home, LayoutTemplate } from 'lucide-react';
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
import { mergeUniqueVlanIntoCsv } from '../lib/vlanListUtils';
import { computeSmartTopology, shortestPath, boundingBoxFromBarriers } from '../lib/smartNetworkEngine';
import { useTopologyUiStore } from '../stores/topologyUiStore';
import { useTopologyCanvasStore } from '../stores/topologyCanvasStore';
import CommandPalette from '../components/topology/CommandPalette';
import KeyboardShortcutsModal from '../components/topology/KeyboardShortcutsModal';
import OnboardingTour from '../components/topology/OnboardingTour';
import WorkflowProgress from '../components/topology/WorkflowProgress';
import EnvironmentToolbox from '../components/topology/EnvironmentToolbox';
import ExportMenuModal from '../components/topology/ExportMenuModal';
import FailureImpactModal from '../components/topology/FailureImpactModal';

const CANVAS_STORAGE_KEY = 'topologai_canvas';

// Expo / Course build flag — set false to restore the full feature set.
// When true, non-essential panels and advanced features are hidden so the
// demo focuses on the AI prompt, the canvas, devices, IP, and export.
const EXPO_MODE = true;

const adaptTopologyForCurrentMode = (topology) => (EXPO_MODE ? normalizeTopologyForExpo(topology) : topology);

const getBusPortCount = (bus) => {
  const raw = Number(bus?.portCount);
  if (!Number.isFinite(raw)) return 8;
  return Math.min(64, Math.max(2, Math.round(raw)));
};

const getBusEndpoints = (bus) => {
  const x1 = bus.x1 ?? bus.x;
  const y1 = bus.y1 ?? bus.y;
  const x2 = bus.x2 ?? bus.x + (bus.dx || 0);
  const y2 = bus.y2 ?? bus.y + (bus.dy || 0);
  return { x1, y1, x2, y2 };
};

const getBusPortAnchor = (bus, index) => {
  const { x1, y1, x2, y2 } = getBusEndpoints(bus);
  const portCount = getBusPortCount(bus);
  const t = portCount === 1 ? 0.5 : (index + 0.5) / portCount;
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
};

export default function TopologAi() {
  const nodes = useTopologyCanvasStore((s) => s.nodes);
  const links = useTopologyCanvasStore((s) => s.links);
  const rooms = useTopologyCanvasStore((s) => s.rooms);
  const vlans = useTopologyCanvasStore((s) => s.vlans);
  const barriers = useTopologyCanvasStore((s) => s.barriers);
  const vlanZones = useTopologyCanvasStore((s) => s.vlanZones);
  const powerZones = useTopologyCanvasStore((s) => s.powerZones);
  const redoStack = useTopologyCanvasStore((s) => s.redoStack);
  const setNodes = useTopologyCanvasStore((s) => s.setNodes);
  const setLinks = useTopologyCanvasStore((s) => s.setLinks);
  const setRooms = useTopologyCanvasStore((s) => s.setRooms);
  const setVlans = useTopologyCanvasStore((s) => s.setVlans);
  const setBarriers = useTopologyCanvasStore((s) => s.setBarriers);
  const setVlanZones = useTopologyCanvasStore((s) => s.setVlanZones);
  const setPowerZones = useTopologyCanvasStore((s) => s.setPowerZones);
  const pushHistory = useTopologyCanvasStore((s) => s.pushHistory);
  const undoCanvas = useTopologyCanvasStore((s) => s.undo);
  const redoCanvas = useTopologyCanvasStore((s) => s.redo);
  const jumpCanvasHistory = useTopologyCanvasStore((s) => s.jumpToHistoryIndex);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('select');
  const [placementType, setPlacementType] = useState(null);
  const [placementPattern, setPlacementPattern] = useState(null);
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
  const history = useTopologyCanvasStore((s) => s.history);
  const [toast, setToast] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const [generateAnimKey, setGenerateAnimKey] = useState(0);
  const aiSubmitRef = useRef(null);
  const spacebarPanRef = useRef({ active: false, prevMode: 'select' });
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
  const commandPaletteOpen = useTopologyUiStore(s => s.commandPaletteOpen);
  const setCommandPaletteOpen = useTopologyUiStore(s => s.setCommandPaletteOpen);
  const shortcutsOpen = useTopologyUiStore(s => s.shortcutsOpen);
  const setShortcutsOpen = useTopologyUiStore(s => s.setShortcutsOpen);
  const onboardingStep = useTopologyUiStore(s => s.onboardingStep);
  const setOnboardingStep = useTopologyUiStore(s => s.setOnboardingStep);
  const pulseNodeId = useTopologyUiStore(s => s.pulseNodeId);
  const gridSnap = useTopologyUiStore(s => s.gridSnap);
  const setGridSnap = useTopologyUiStore(s => s.setGridSnap);

  useEffect(() => {
    if (failureTarget) setFailureModalOpen(true);
  }, [failureTarget]);

  useEffect(() => {
    if (mode !== 'place') {
      if (placementType) setPlacementType(null);
      if (placementPattern) setPlacementPattern(null);
    }
  }, [mode, placementType, placementPattern]);

  const [debouncedGraph, setDebouncedGraph] = useState(() => ({
    nodes,
    links,
    rooms,
    vlans,
    barriers,
    vlanZones,
    powerZones,
  }));
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedGraph({ nodes, links, rooms, vlans, barriers, vlanZones, powerZones });
    }, 200);
    return () => clearTimeout(id);
  }, [nodes, links, rooms, vlans, barriers, vlanZones, powerZones]);

  const smartSnapshot = useMemo(
    () =>
      computeSmartTopology({
        nodes: debouncedGraph.nodes,
        links: debouncedGraph.links,
        rooms: debouncedGraph.rooms,
        vlans: debouncedGraph.vlans,
        barriers: debouncedGraph.barriers,
        vlanZones: debouncedGraph.vlanZones,
        powerZones: debouncedGraph.powerZones,
        excludeNodeId: failureKind === 'node' ? failureTarget : null,
        excludeLinkId: failureKind === 'link' ? failureTarget : null,
      }),
    [debouncedGraph, failureKind, failureTarget]
  );

  const baselineSnapshot = useMemo(
    () =>
      computeSmartTopology({
        nodes: debouncedGraph.nodes,
        links: debouncedGraph.links,
        rooms: debouncedGraph.rooms,
        vlans: debouncedGraph.vlans,
        barriers: debouncedGraph.barriers,
        vlanZones: debouncedGraph.vlanZones,
        powerZones: debouncedGraph.powerZones,
      }),
    [debouncedGraph]
  );

  const failureImpactIds = useMemo(() => {
    if (!failureTarget || failureKind !== 'node') return new Set();
    const { nodes: n, links: l, rooms: r, vlans: v, barriers: b, vlanZones: vz } = debouncedGraph;
    const after = computeSmartTopology({
      nodes: n,
      links: l,
      rooms: r,
      vlans: v,
      barriers: b,
      vlanZones: vz,
      powerZones: debouncedGraph.powerZones,
      excludeNodeId: failureTarget,
    });
    const ids = new Set();
    n.forEach((node) => {
      const b = baselineSnapshot.deviceStates[node.id]?.smartState;
      const a = after.deviceStates[node.id]?.smartState;
      if (
        a !== b &&
        (a === 'no_network' || a === 'isolated' || a === 'slow_network' || a === 'no_internet')
      ) {
        ids.add(node.id);
      }
    });
    return ids;
  }, [failureTarget, failureKind, debouncedGraph, baselineSnapshot]);

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

      if (fix.type === 'append_link_trunk_vlan') {
        const target = links.find((l) => l.id === fix.linkId);
        if (!target) return;
        const next = mergeUniqueVlanIntoCsv(target.trunkVlans, fix.vlan);
        if (next === String(target.trunkVlans || '').trim()) {
          showToast('VLAN already on trunk');
          return;
        }
        pushHistory();
        setLinks((ls) => ls.map((l) => (l.id === fix.linkId ? { ...l, trunkVlans: next } : l)));
        showToast('Trunk VLANs updated');
        return;
      }

      if (fix.type === 'append_ap_supported_vlan') {
        const target = nodes.find((n) => n.id === fix.apId);
        if (!target) return;
        const next = mergeUniqueVlanIntoCsv(target.supportedVlans, fix.vlan);
        if (next === String(target.supportedVlans || '').trim()) {
          showToast('VLAN already listed on AP');
          return;
        }
        pushHistory();
        setNodes((ns) => ns.map((x) => (x.id === fix.apId ? { ...x, supportedVlans: next } : x)));
        showToast('Supported VLANs updated');
        return;
      }

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
    [links, nodes, pushHistory]
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
        if (fix.type === 'append_link_trunk_vlan') {
          setLinks((ls) =>
            ls.map((l) => {
              if (l.id !== fix.linkId) return l;
              const next = mergeUniqueVlanIntoCsv(l.trunkVlans, fix.vlan);
              return { ...l, trunkVlans: next };
            }),
          );
        }
        if (fix.type === 'append_ap_supported_vlan') {
          setNodes((ns) =>
            ns.map((x) => {
              if (x.id !== fix.apId) return x;
              const next = mergeUniqueVlanIntoCsv(x.supportedVlans, fix.vlan);
              return { ...x, supportedVlans: next };
            }),
          );
        }
      });
      showToast('Auto-fixes applied');
    },
    [pushHistory, setLinks, setNodes]
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
      const data = adaptTopologyForCurrentMode(decodeShareState(encoded));
      setNodes(data.nodes || []);
      setLinks(data.links || []);
      setRooms(data.rooms || []);
      setVlans(data.vlans || []);
      setBarriers(data.barriers || []);
      setVlanZones(data.vlanZones || []);
      setPowerZones(data.powerZones || []);
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

  const handleUndo = () => {
    if (!undoCanvas()) return;
    showToast('Undo applied');
  };

  const handleRedo = () => {
    if (!redoCanvas()) return;
    showToast('Redo applied');
  };

  const handleJumpToHistoryIndex = useCallback(
    (idx) => {
      if (!jumpCanvasHistory(idx)) return;
      setSelectedId(null);
      setSelectedIds([]);
      showToast('Restored snapshot');
    },
    [jumpCanvasHistory]
  );

  const handleDuplicateSelection = useCallback(() => {
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    if (!ids.length) return;
    const nodesToDupe = nodes.filter((n) => ids.includes(n.id));
    if (!nodesToDupe.length) {
      showToast('Duplicate works for devices only', 'info');
      return;
    }
    pushHistory();
    setNodes((ns) => {
      const dupes = nodesToDupe.map((n) => ({
        ...n,
        id: generateId('n'),
        x: n.x + 28,
        y: n.y + 28,
        label: `${n.label} copy`,
      }));
      return [...ns, ...dupes];
    });
    showToast('Selection duplicated', 'success');
  }, [selectedIds, selectedId, pushHistory, setNodes, nodes]);

  // Load topology from AI
  const loadTopology = (topology, prompt, isRefinement = false) => {
    const nextTopology = adaptTopologyForCurrentMode(topology);
    pushHistory();
    if (isRefinement) {
      const existingIds = new Set(nodes.map(x => x.id));
      const existingBarrierIds = new Set(barriers.map((x) => x.id));
      const idMap = {};
      const barrierIdMap = {};
      const newBarriers = (nextTopology.barriers || []).map(br => {
        const nextId = existingBarrierIds.has(br.id) ? generateId('b') : br.id;
        barrierIdMap[br.id] = nextId;
        return { ...br, id: nextId };
      });
      const newNodes = nextTopology.nodes.map(node => {
        const nextId = existingIds.has(node.id) ? generateId(node.isBusAnchor ? 'bn' : 'n') : node.id;
        idMap[node.id] = nextId;
        const remapped = {
          ...node,
          id: nextId,
          x: node.x + 50,
          y: node.y + 50,
        };
        if (node.busId && barrierIdMap[node.busId]) remapped.busId = barrierIdMap[node.busId];
        return remapped;
      });

      setNodes(n => {
        return [...n, ...newNodes];
      });
      setLinks(l => [...l, ...nextTopology.links.map(lk => {
        const remapped = {
          ...lk,
          id: generateId('l'),
          source: idMap[lk.source] || lk.source,
          target: idMap[lk.target] || lk.target,
        };
        if (lk.busId && barrierIdMap[lk.busId]) remapped.busId = barrierIdMap[lk.busId];
        if (lk.targetBusAnchorId && idMap[lk.targetBusAnchorId]) {
          remapped.targetBusAnchorId = idMap[lk.targetBusAnchorId];
        }
        if (lk.sourceBusAnchorId && idMap[lk.sourceBusAnchorId]) {
          remapped.sourceBusAnchorId = idMap[lk.sourceBusAnchorId];
        }
        return remapped;
      })]);
      setRooms(r => [...r, ...nextTopology.rooms.map(rm => ({ ...rm, id: generateId('r') }))]);
      setVlans(v => {
        const existing = new Set(v.map(x => x.name));
        return [...v, ...nextTopology.vlans.filter(x => !existing.has(x.name))];
      });
      setBarriers(b => [...b, ...newBarriers]);
      setVlanZones(z => [
        ...z,
        ...(nextTopology.vlanZones || []).map(vz => ({ ...vz, id: generateId('vz') })),
      ]);
      setPowerZones(z => [
        ...z,
        ...(nextTopology.powerZones || []).map(pz => ({ ...pz, id: generateId('pz') })),
      ]);
    } else {
      setNodes(nextTopology.nodes);
      setLinks(nextTopology.links);
      setRooms(nextTopology.rooms);
      setVlans(nextTopology.vlans);
      setBarriers(nextTopology.barriers || []);
      setVlanZones(nextTopology.vlanZones || []);
      setPowerZones(nextTopology.powerZones || []);
    }
    if (prompt) setCurrentPrompt(prompt);
    setSelectedId(null);
    setSelectedIds([]);
    setConnectingFrom(null);
    showToast(isRefinement ? 'Topology refined!' : 'Topology generated!', 'success');
    setGenerateAnimKey((k) => k + 1);
  };

  const omitIdentity = (value = {}) => {
    const { id, tempId, op, fields, item, node, link, room, barrier, topology, ...rest } = value;
    return rest;
  };

  const shiftBarrier = (barrier, dx = 0, dy = 0) => {
    const shifted = { ...barrier };
    if (typeof shifted.x === 'number') shifted.x += dx;
    if (typeof shifted.y === 'number') shifted.y += dy;
    if (typeof shifted.x1 === 'number') shifted.x1 += dx;
    if (typeof shifted.y1 === 'number') shifted.y1 += dy;
    if (typeof shifted.x2 === 'number') shifted.x2 += dx;
    if (typeof shifted.y2 === 'number') shifted.y2 += dy;
    return shifted;
  };

  const applyAiOperations = (editResult, prompt) => {
    const operations = Array.isArray(editResult?.operations) ? editResult.operations : [];
    if (!operations.length) {
      showToast(editResult?.summary || 'No safe AI edit was applied');
      return;
    }

    pushHistory();

    let next = {
      nodes: [...nodes],
      links: [...links],
      rooms: [...rooms],
      vlans: [...vlans],
      barriers: [...barriers],
      vlanZones: [...vlanZones],
      powerZones: [...powerZones],
    };
    const idMap = {};
    const resolveId = (id) => idMap[id] || id;
    const idsFromOperation = (operation) => {
      const raw = operation.ids || operation.id || operation.targetId || operation.nodeId || operation.linkId || operation.roomId || operation.barrierId;
      return Array.isArray(raw) ? raw.map(resolveId).filter(Boolean) : raw ? [resolveId(raw)] : [];
    };

    const removeNodes = (ids) => {
      const del = new Set(ids);
      next.nodes = next.nodes.filter((node) => !del.has(node.id));
      next.links = next.links.filter((link) => !del.has(link.source) && !del.has(link.target));
    };

    const removeLinks = (ids) => {
      const del = new Set(ids);
      next.links = next.links.filter((link) => !del.has(link.id));
    };

    const removeBarriers = (ids) => {
      const del = new Set(ids);
      next.barriers = next.barriers.filter((barrier) => !del.has(barrier.id));
      next.links = next.links.filter((link) => !del.has(link.busId) && !del.has(link.source) && !del.has(link.target));
    };

    for (const operation of operations) {
      const op = operation?.op;
      if (!op) continue;

      if (op === 'replace_canvas') {
        const replacement = adaptTopologyForCurrentMode(operation.topology || {});
        next = {
          nodes: replacement.nodes || [],
          links: replacement.links || [],
          rooms: replacement.rooms || [],
          vlans: replacement.vlans || [],
          barriers: replacement.barriers || [],
          vlanZones: replacement.vlanZones || [],
          powerZones: replacement.powerZones || [],
        };
        continue;
      }

      if (op === 'add_node') {
        const input = operation.node || operation.item || omitIdentity(operation);
        const id = generateId(input.isBusAnchor ? 'bn' : 'n');
        if (input.tempId || input.id) idMap[input.tempId || input.id] = id;
        next.nodes.push({
          ...omitIdentity(input),
          id,
          type: input.type || 'pc',
          label: input.label || `${input.type || 'Device'} ${next.nodes.length + 1}`,
          x: Number.isFinite(Number(input.x)) ? Number(input.x) : 120,
          y: Number.isFinite(Number(input.y)) ? Number(input.y) : 120,
          ip: input.ip || '',
          vlan: input.vlan || null,
        });
        continue;
      }

      if (op === 'add_link') {
        const input = operation.link || operation.item || omitIdentity(operation);
        const source = resolveId(input.source);
        const target = resolveId(input.target);
        if (!source || !target) continue;
        next.links.push({
          ...omitIdentity(input),
          id: generateId('l'),
          source,
          target,
          type: input.type || 'ethernet',
          label: input.label || '',
          ...(input.busId ? { busId: resolveId(input.busId) } : {}),
          ...(input.sourceBusAnchorId ? { sourceBusAnchorId: resolveId(input.sourceBusAnchorId) } : {}),
          ...(input.targetBusAnchorId ? { targetBusAnchorId: resolveId(input.targetBusAnchorId) } : {}),
        });
        continue;
      }

      if (op === 'add_room') {
        const input = operation.room || operation.item || omitIdentity(operation);
        const id = generateId('r');
        if (input.tempId || input.id) idMap[input.tempId || input.id] = id;
        next.rooms.push({
          ...omitIdentity(input),
          id,
          label: input.label || `Room ${next.rooms.length + 1}`,
          x: Number.isFinite(Number(input.x)) ? Number(input.x) : 80,
          y: Number.isFinite(Number(input.y)) ? Number(input.y) : 80,
          w: Number.isFinite(Number(input.w)) ? Number(input.w) : 260,
          h: Number.isFinite(Number(input.h)) ? Number(input.h) : 180,
          color: input.color || 'rgba(59,130,246,0.08)',
        });
        continue;
      }

      if (op === 'add_barrier') {
        const input = operation.barrier || operation.item || omitIdentity(operation);
        const id = generateId('b');
        if (input.tempId || input.id) idMap[input.tempId || input.id] = id;
        next.barriers.push({
          ...omitIdentity(input),
          id,
          shape: input.shape || 'line',
          environmentKind: input.environmentKind || 'wall',
          label: input.label || 'Barrier',
        });
        continue;
      }

      if (op === 'update_node') {
        const ids = idsFromOperation(operation);
        const patch = omitIdentity(operation.fields || operation.node || operation.patch || {});
        next.nodes = next.nodes.map((node) => (ids.includes(node.id) ? { ...node, ...patch } : node));
        continue;
      }

      if (op === 'update_link') {
        const ids = idsFromOperation(operation);
        const patch = omitIdentity(operation.fields || operation.link || operation.patch || {});
        next.links = next.links.map((link) => (ids.includes(link.id) ? { ...link, ...patch } : link));
        continue;
      }

      if (op === 'update_room') {
        const ids = idsFromOperation(operation);
        const patch = omitIdentity(operation.fields || operation.room || operation.patch || {});
        next.rooms = next.rooms.map((room) => (ids.includes(room.id) ? { ...room, ...patch } : room));
        continue;
      }

      if (op === 'update_barrier') {
        const ids = idsFromOperation(operation);
        const patch = omitIdentity(operation.fields || operation.barrier || operation.patch || {});
        next.barriers = next.barriers.map((barrier) => (ids.includes(barrier.id) ? { ...barrier, ...patch } : barrier));
        continue;
      }

      if (op === 'move_node') {
        const ids = idsFromOperation(operation);
        next.nodes = next.nodes.map((node) => {
          if (!ids.includes(node.id)) return node;
          const dx = Number(operation.dx) || 0;
          const dy = Number(operation.dy) || 0;
          return {
            ...node,
            x: Number.isFinite(Number(operation.x)) ? Number(operation.x) : node.x + dx,
            y: Number.isFinite(Number(operation.y)) ? Number(operation.y) : node.y + dy,
          };
        });
        continue;
      }

      if (op === 'move_room') {
        const ids = idsFromOperation(operation);
        next.rooms = next.rooms.map((room) => {
          if (!ids.includes(room.id)) return room;
          const dx = Number(operation.dx) || 0;
          const dy = Number(operation.dy) || 0;
          return {
            ...room,
            x: Number.isFinite(Number(operation.x)) ? Number(operation.x) : room.x + dx,
            y: Number.isFinite(Number(operation.y)) ? Number(operation.y) : room.y + dy,
          };
        });
        continue;
      }

      if (op === 'move_barrier') {
        const ids = idsFromOperation(operation);
        next.barriers = next.barriers.map((barrier) => {
          if (!ids.includes(barrier.id)) return barrier;
          const dx = Number(operation.dx) || 0;
          const dy = Number(operation.dy) || 0;
          if (Number.isFinite(Number(operation.x)) && Number.isFinite(Number(operation.y))) {
            return { ...barrier, x: Number(operation.x), y: Number(operation.y) };
          }
          return shiftBarrier(barrier, dx, dy);
        });
        continue;
      }

      if (op === 'delete_node') removeNodes(idsFromOperation(operation));
      if (op === 'delete_link') removeLinks(idsFromOperation(operation));
      if (op === 'delete_room') {
        const del = new Set(idsFromOperation(operation));
        next.rooms = next.rooms.filter((room) => !del.has(room.id));
      }
      if (op === 'delete_barrier') removeBarriers(idsFromOperation(operation));
    }

    const nodeIds = new Set(next.nodes.map((node) => node.id));
    const barrierIds = new Set(next.barriers.map((barrier) => barrier.id));
    next.links = next.links.filter((link) => {
      const validSource = nodeIds.has(link.source) || barrierIds.has(link.source);
      const validTarget = nodeIds.has(link.target) || barrierIds.has(link.target);
      const validBus = !link.busId || barrierIds.has(link.busId);
      return validSource && validTarget && validBus;
    });
    const linkedIds = new Set(next.links.flatMap((link) => [link.source, link.target, link.sourceBusAnchorId, link.targetBusAnchorId].filter(Boolean)));
    next.nodes = next.nodes.filter((node) => !node.isBusAnchor || linkedIds.has(node.id));

    setNodes(next.nodes);
    setLinks(next.links);
    setRooms(next.rooms);
    setVlans(next.vlans);
    setBarriers(next.barriers);
    setVlanZones(next.vlanZones);
    setPowerZones(next.powerZones);
    if (prompt) setCurrentPrompt(prompt);
    setSelectedId(null);
    setSelectedIds([]);
    setConnectingFrom(null);
    showToast(editResult?.summary || 'AI edits applied', 'success');
    setGenerateAnimKey((k) => k + 1);
  };

  const handleTopologyGenerated = (topology, prompt) => loadTopology(topology, prompt, false);
  const handleRefinement = (editResult, prompt) => applyAiOperations(editResult, prompt);

  const handleTemplateSelect = (template) => {
    loadTopology(template.data, template.prompt, false);
    showToast(`Template "${template.name}" loaded`);
  };

  const commandPaletteExtras = useMemo(
    () => [
      ...nodes.filter((n) => !n.isBusAnchor).map((n) => ({
        id: `dev_${n.id}`,
        label: `Device: ${n.label || n.id}`,
        keywords: `${n.label || ''} ${n.type}`.toLowerCase(),
        icon: Box,
        run: () => {
          setSelectedId(n.id);
          setSelectedIds([]);
          setMode('select');
        },
      })),
      ...rooms.map((r) => ({
        id: `room_${r.id}`,
        label: `Room: ${r.label || r.id}`,
        keywords: `${r.label || ''} room zone`.toLowerCase(),
        icon: Home,
        run: () => {
          setSelectedId(r.id);
          setSelectedIds([]);
          setMode('select');
        },
      })),
      ...TEMPLATES.map((t) => ({
        id: `tpl_${t.id}`,
        label: `Template: ${t.name}`,
        keywords: `${t.name} ${t.description || ''} ${t.prompt || ''}`.toLowerCase(),
        icon: LayoutTemplate,
        run: () => {
          loadTopology(t.data, t.prompt, false);
          showToast(`Template "${t.name}" loaded`);
        },
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- palette rebuilds on graph shape; loadTopology is stable enough per session
    [nodes, rooms]
  );

  // Node operations (v3 §678 grid snap)
  const handleNodeMove = (id, x, y) => {
    const SNAP = 8;
    let nx = x;
    let ny = y;
    if (gridSnap) {
      nx = Math.round(x / SNAP) * SNAP;
      ny = Math.round(y / SNAP) * SNAP;
    }
    setNodes((n) => n.map((node) => (node.id === id ? { ...node, x: nx, y: ny } : node)));
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

  const handlePatternAdd = (patternId, anchorX, anchorY) => {
    const genId = { node: () => generateId('n'), link: () => generateId('l') };
    const raw = instantiateTopologyPattern(patternId, anchorX, anchorY, genId);
    if (!raw.nodes.length) {
      showToast('Unknown topology pattern');
      return;
    }
    // Re-ID any pattern-emitted barriers so they don't collide with the
    // canvas, then remap busId references in nodes/links and finally expand
    // flat device→bus taps into anchor form.
    const barrierIdMap = {};
    const reidBarriers = (raw.barriers || []).map((b) => {
      const nextId = generateId('b');
      barrierIdMap[b.id] = nextId;
      return { ...b, id: nextId };
    });
    const remappedLinks = raw.links.map((l) => {
      if (l.busId && barrierIdMap[l.busId]) {
        const refsBus = l.target === l.busId ? 'target' : l.source === l.busId ? 'source' : null;
        return {
          ...l,
          busId: barrierIdMap[l.busId],
          ...(refsBus ? { [refsBus]: barrierIdMap[l.busId] } : {}),
        };
      }
      return l;
    });
    const expanded = expandBusLinksForCanvas({
      nodes: raw.nodes,
      links: remappedLinks,
      barriers: reidBarriers,
    });
    pushHistory();
    setNodes((n) => [...n, ...expanded.nodes]);
    setLinks((l) => [...l, ...expanded.links]);
    if (reidBarriers.length) setBarriers((b) => [...b, ...reidBarriers]);
    setSelectedId(raw.nodes[0]?.id ?? null);
    const label = TOPOLOGY_PATTERNS.find((p) => p.id === patternId)?.label || patternId;
    showToast(`Added ${label}`, 'success');
  };

  const handleDevicePick = (type) => {
    setPlacementPattern(null);
    setPlacementType(type);
    setMode('place');
    showToast(`Click canvas to place ${DEVICE_TYPES[type]?.label || type}`);
  };

  const handlePatternPick = (patternId) => {
    setPlacementType(null);
    setPlacementPattern(patternId);
    setMode('place');
    const label = TOPOLOGY_PATTERNS.find((p) => p.id === patternId)?.label || patternId;
    showToast(`Click canvas to drop ${label} (multi-device segment)`);
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
    setLinks((l) =>
      l.map((x) => {
        if (x.id !== linkTypePopup.linkId) return x;
        if (x.busId && type !== 'ethernet' && type !== 'fiber') return { ...x, type: 'ethernet' };
        return { ...x, type };
      }),
    );
    setLinkTypePopup(null);
    showToast(`Link set to ${type === 'ethernet' || type === 'fiber' ? type : 'ethernet'}`, 'success');
  };

  const handleLinkDelete = (linkId) => {
    pushHistory();
    const linkToDelete = links.find((x) => x.id === linkId);
    setLinks(l => l.filter(x => x.id !== linkId));
    if (linkToDelete?.busId) {
      const busAnchorId = linkToDelete.sourceBusAnchorId || linkToDelete.targetBusAnchorId;
      if (busAnchorId) {
        const stillUsed = links.some(
          (l) =>
            l.id !== linkId &&
            (l.sourceBusAnchorId === busAnchorId || l.targetBusAnchorId === busAnchorId),
        );
        if (!stillUsed) {
          setNodes((n) => n.filter((x) => x.id !== busAnchorId));
        }
      }
    }
    if (selectedId === linkId) setSelectedId(null);
    showToast('Connection removed');
  };

  const handleConnectNodeToBus = (nodeId, busId, anchor) => {
    const node = nodes.find((n) => n.id === nodeId);
    const bus = barriers.find((b) => b.id === busId && b.environmentKind === 'bus');
    if (!node || !bus) return;
    const exists = links.find((l) => l.busId === busId && (l.source === nodeId || l.target === nodeId));
    if (exists) {
      showToast('Device is already attached to this bus');
      return;
    }
    const portCount = getBusPortCount(bus);
    const usedPortIndex = new Set(
      links
        .filter((l) => l.busId === busId && Number.isInteger(l.busPortIndex))
        .map((l) => l.busPortIndex),
    );
    const availablePortIndexes = Array.from({ length: portCount }, (_, i) => i).filter((i) => !usedPortIndex.has(i));
    if (!availablePortIndexes.length) {
      showToast(`Bus is full (${portCount} ports used)`);
      return;
    }
    const fallbackAnchor = getBusPortAnchor(bus, availablePortIndexes[0]);
    const targetAnchor = anchor || fallbackAnchor;
    const bestPortIndex = availablePortIndexes.reduce((best, idx) => {
      const p = getBusPortAnchor(bus, idx);
      const d = Math.hypot(targetAnchor.x - p.x, targetAnchor.y - p.y);
      if (!best || d < best.dist) return { idx, dist: d, point: p };
      return best;
    }, null);
    const selectedPortIndex = bestPortIndex?.idx ?? availablePortIndexes[0];
    const selectedPortAnchor = bestPortIndex?.point ?? fallbackAnchor;
    pushHistory();
    const busAnchorId = generateId('bn');
    const busAnchorNode = {
      id: busAnchorId,
      type: 'switch',
      label: `Bus tap (${bus.label || 'Bus'})`,
      x: selectedPortAnchor.x - 45,
      y: selectedPortAnchor.y - 28,
      ip: '',
      vlan: null,
      isBusAnchor: true,
      busId,
      busPortIndex: selectedPortIndex,
    };
    setNodes((n) => [...n, busAnchorNode]);
    const newId = generateId('l');
    const newLink = {
      id: newId,
      source: nodeId,
      target: busAnchorId,
      type: 'ethernet',
      label: 'Bus',
      busId,
      busPortIndex: selectedPortIndex,
      targetBusAnchorId: busAnchorId,
    };
    setLinks((l) => [...l, newLink]);
    setSelectedId(newId);
    showToast('Device attached to bus', 'success');
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
        const targetLink = links.find((l) => l.id === target.id);
        setLinks(l => l.filter(x => x.id !== target.id));
        const busAnchorId = targetLink?.sourceBusAnchorId || targetLink?.targetBusAnchorId;
        if (busAnchorId) {
          const stillUsed = links.some(
            (l) =>
              l.id !== target.id &&
              (l.sourceBusAnchorId === busAnchorId || l.targetBusAnchorId === busAnchorId),
          );
          if (!stillUsed) setNodes((n) => n.filter((x) => x.id !== busAnchorId));
        }
      } else if (target.type === 'room') {
        setRooms(r => r.filter(x => x.id !== target.id));
      } else if (target.type === 'barrier') {
        const isBus = target.item?.environmentKind === 'bus';
        setBarriers(b => b.filter(x => x.id !== target.id));
        if (isBus) {
          const busAnchorIds = links
            .filter((l) => l.busId === target.id)
            .flatMap((l) => [l.sourceBusAnchorId, l.targetBusAnchorId].filter(Boolean));
          setLinks((ls) => ls.filter((l) => l.busId !== target.id));
          if (busAnchorIds.length) {
            const anchorSet = new Set(busAnchorIds);
            setNodes((n) => n.filter((x) => !anchorSet.has(x.id)));
          }
        }
      } else if (target.type === 'vlanZone') {
        setVlanZones(z => z.filter(x => x.id !== target.id));
      } else if (target.type === 'powerZone') {
        setPowerZones(z => z.filter(x => x.id !== target.id));
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
      if (target.item?.busId) {
        showToast('Bus links support Ethernet or Fiber only');
        return;
      }
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
    } else if (action === 'simulate_failure' && target.type === 'node') {
      setFailureSim(target.id, 'node');
      showToast('Failure simulation — see impact overlay');
    } else if (action === 'suggest_room_from_barriers') {
      const box = boundingBoxFromBarriers(barriers);
      if (!box) {
        showToast('Add wall-like barriers first (noise/conduit excluded).');
        return;
      }
      pushHistory();
      const id = generateId('r');
      setRooms((r) => [
        ...r,
        {
          id,
          label: 'Room from walls',
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          color: 'rgba(59,130,246,0.08)',
          colorHex: '#3b82f6',
        },
      ]);
      setSelectedId(id);
      showToast('Room created from barrier bounds');
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

  const handleBarrierMove = useCallback(
    (barrierId, dx, dy, orig) => {
      const { x1, y1, x2, y2, anchorOrigins = {} } = orig;
      setBarriers((bs) =>
        bs.map((b) => {
          if (b.id !== barrierId) return b;
          return {
            ...b,
            shape: b.shape ?? 'line',
            x1: x1 + dx,
            y1: y1 + dy,
            x2: x2 + dx,
            y2: y2 + dy,
            x: undefined,
            y: undefined,
            dx: undefined,
            dy: undefined,
          };
        }),
      );
      setNodes((ns) =>
        ns.map((n) => {
          const o = anchorOrigins[n.id];
          if (!o) return n;
          return { ...n, x: o.x + dx, y: o.y + dy };
        }),
      );
    },
    [setBarriers, setNodes],
  );

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
    const allIdsRaw = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    if (!allIdsRaw.length && !selectedId) return;

    pushHistory();

    const allIds = [...new Set(allIdsRaw.length ? allIdsRaw : selectedId ? [selectedId] : [])];
    if (!allIds.length) return;

    const nodeIds = new Set(nodes.map((n) => n.id));
    const linkIdsSet = new Set(links.map((l) => l.id));
    const barrierIdsSet = new Set(barriers.map((b) => b.id));
    const roomIdsSet = new Set(rooms.map((r) => r.id));
    const vlanZoneIdsSet = new Set(vlanZones.map((z) => z.id));
    const powerZoneIdsSet = new Set(powerZones.map((z) => z.id));

    const delNodeIds = allIds.filter((id) => nodeIds.has(id));
    const delExplicitLinkIds = allIds.filter((id) => linkIdsSet.has(id));
    const delBarrierIds = allIds.filter((id) => barrierIdsSet.has(id));
    const delRoomIds = allIds.filter((id) => roomIdsSet.has(id));
    const delVlanZoneIds = allIds.filter((id) => vlanZoneIdsSet.has(id));
    const delPowerZoneIds = allIds.filter((id) => powerZoneIdsSet.has(id));

    const busAnchorIdsFromBars = barriers
      .filter((b) => delBarrierIds.includes(b.id) && b.environmentKind === 'bus')
      .flatMap((b) =>
        links
          .filter((l) => l.busId === b.id)
          .flatMap((l) => [l.sourceBusAnchorId, l.targetBusAnchorId].filter(Boolean)),
      );

    const delLinkIds = links
      .filter((l) => delNodeIds.includes(l.source) || delNodeIds.includes(l.target))
      .map((l) => l.id)
      .concat(delExplicitLinkIds)
      .concat(links.filter((l) => delBarrierIds.includes(l.busId)).map((l) => l.id));

    const delBusAnchorNodeIds = [...new Set(busAnchorIdsFromBars)];

    if (delNodeIds.length)
      setNodes((n) => n.filter((x) => !delNodeIds.includes(x.id)));
    if (delBusAnchorNodeIds.length)
      setNodes((n) => n.filter((x) => !delBusAnchorNodeIds.includes(x.id)));
    if (delBarrierIds.length)
      setBarriers((b) => b.filter((x) => !delBarrierIds.includes(x.id)));
    if (delRoomIds.length)
      setRooms((r) => r.filter((x) => !delRoomIds.includes(x.id)));
    if (delVlanZoneIds.length)
      setVlanZones((z) => z.filter((x) => !delVlanZoneIds.includes(x.id)));
    if (delPowerZoneIds.length)
      setPowerZones((z) => z.filter((x) => !delPowerZoneIds.includes(x.id)));

    if (delNodeIds.length || delLinkIds.length || delBusAnchorNodeIds.length)
      setLinks((l) =>
        l.filter(
          (ln) =>
            !delLinkIds.includes(ln.id) &&
            !delNodeIds.includes(ln.source) &&
            !delNodeIds.includes(ln.target) &&
            !delBusAnchorNodeIds.includes(ln.source) &&
            !delBusAnchorNodeIds.includes(ln.target),
        ),
      );

    setSelectedId(null);
    setSelectedIds([]);
  };

  const handleUpdate = (id, form, type) => {
    if (type === 'node') setNodes(n => n.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'link') {
      const existing = links.find((l) => l.id === id);
      const nextForm =
        existing?.busId && form?.type && form.type !== 'ethernet' && form.type !== 'fiber'
          ? { ...form, type: 'ethernet' }
          : form;
      setLinks((l) => l.map((x) => (x.id === id ? { ...x, ...nextForm } : x)));
    }
    if (type === 'room') setRooms(r => r.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'barrier') setBarriers(b => b.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'vlanZone') setVlanZones(z => z.map(x => x.id === id ? { ...x, ...form } : x));
    if (type === 'powerZone') setPowerZones(z => z.map(x => x.id === id ? { ...x, ...form } : x));
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

  const handlePowerZoneAdd = (zone) => {
    pushHistory();
    const id = generateId('pz');
    setPowerZones(z => [...z, { ...zone, id, fill: zone.fill || 'rgba(234,179,8,0.12)' }]);
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
    createTopologyPayload({ nodes, links, rooms, vlans, prompt: currentPrompt, barriers, vlanZones, powerZones });

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

  const handlePatternDragStart = (e, patternId) => {
    e.dataTransfer.setData('topologyPattern', patternId);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    const patternId = e.dataTransfer.getData('topologyPattern');
    if (patternId) {
      handlePatternAdd(patternId, x, y);
      return;
    }
    const type = e.dataTransfer.getData('deviceType');
    if (!type) return;
    handleNodeAdd(type, x - 45, y - 25);
  };

  // Save / Load
  const handleSave = () => {
    const data = { nodes, links, rooms, vlans, barriers, vlanZones, powerZones, prompt: currentPrompt };
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(data));
    showToast('Saved to browser', 'success');
  };

  const handleLoad = () => {
    const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (!raw) { showToast('No saved data found'); return; }
    try {
      const data = adaptTopologyForCurrentMode(JSON.parse(raw));
      pushHistory();
      setNodes(data.nodes || []);
      setLinks(data.links || []);
      setRooms(data.rooms || []);
      setVlans(data.vlans || []);
      setBarriers(data.barriers || []);
      setVlanZones(data.vlanZones || []);
      setPowerZones(data.powerZones || []);
      setCurrentPrompt(data.prompt || '');
      setSelectedId(null);
      setSelectedIds([]);
      showToast('Loaded from browser', 'success');
    } catch {
      showToast('Saved topology is invalid');
    }
  };

  const applyImportedTopology = (data, label = 'Imported topology') => {
    const nextData = adaptTopologyForCurrentMode(data);
    pushHistory();
    setNodes(nextData.nodes || []);
    setLinks(nextData.links || []);
    setRooms(nextData.rooms || []);
    setVlans(nextData.vlans || []);
    setBarriers(nextData.barriers || []);
    setVlanZones(nextData.vlanZones || []);
    setPowerZones(nextData.powerZones || []);
    setCurrentPrompt(nextData.prompt || label);
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
    setNodes([]); setLinks([]); setRooms([]); setVlans([]); setBarriers([]); setVlanZones([]); setPowerZones([]);
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

  const handleCopyJsonExport = async () => {
    await copyText(JSON.stringify(getPayload(), null, 2));
    setExportModalOpen(false);
  };

  const handleExportPngDemo = () => {
    showToast('PNG export is demo-only in this build (wire html2canvas or server render).', 'info');
    setExportModalOpen(false);
  };

  const handleExportPdfDemo = () => {
    showToast('PDF pack is demo-only until jspdf layout is connected.', 'info');
    setExportModalOpen(false);
  };

  const handleExportPktDemo = () => {
    showToast('Cisco .pkt export is demo-only (interop requires Packet Tracer schema).', 'info');
    setExportModalOpen(false);
  };

  const handleSimulateUptime = () => {
    pushHistory();
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        demoUptime: `${(99.2 + Math.random() * 0.79).toFixed(2)}%`,
      }))
    );
    showToast('Mock uptime strings set on devices (see Properties)', 'success');
  };

  /** v3 §D — status dots on nodes */
  const handleSimulateDeviceStatus = () => {
    pushHistory();
    const statuses = ['online', 'idle', 'warning', 'offline'];
    setNodes((ns) =>
      ns.map((n, i) => ({
        ...n,
        demoStatus: statuses[(i + Math.floor(Math.random() * 4)) % 4],
      }))
    );
    showToast('Status dots randomized (Online / Idle / Warning / Offline)', 'success');
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
      const ae = document.activeElement;
      const tag = ae?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ae?.isContentEditable) return;
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setMode('select');
        setPlacementType(null);
        setPlacementPattern(null);
        clearFailureSim();
        setCommandPaletteOpen(false);
        setShortcutsOpen(false);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedId || selectedIds.length) handleDelete(); }
      if (e.key === 'v' || e.key === 'V') setMode('select');
      if (e.key === 'c' || e.key === 'C') setMode('connect');
      if (e.key === 'h' || e.key === 'H') setMode('pan');
      if (e.key === 'b' || e.key === 'B') setMode('barrier');
      if (e.key === 'w' || e.key === 'W') setMode('barrier');
      if (e.key === 'l' || e.key === 'L') {
        if (selectedId && nodes.some((n) => n.id === selectedId)) {
          e.preventDefault();
          const n = nodes.find((x) => x.id === selectedId);
          setRenameModal({
            title: 'Rename / Label',
            value: n?.label || '',
            onConfirm: (v) => setNodes((ns) => ns.map((x) => (x.id === selectedId ? { ...x, label: v } : x))),
          });
        } else if (selectedId && links.some((l) => l.id === selectedId)) {
          e.preventDefault();
          const l = links.find((x) => x.id === selectedId);
          setRenameModal({
            title: 'Edit Link Label',
            value: l?.label || '',
            onConfirm: (v) => setLinks((ls) => ls.map((x) => (x.id === selectedId ? { ...x, label: v } : x))),
          });
        }
      }
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setExportModalOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicateSelection();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const selectableNodes = nodes.filter((n) => !n.isBusAnchor);
        if (selectableNodes.length) {
          setSelectedIds(selectableNodes.map((n) => n.id));
          setSelectedId(null);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        aiSubmitRef.current?.submitGenerate?.();
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const rawMoveIds = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
        const nodeIdSet = new Set(nodes.map((n) => n.id));
        const moveIds = rawMoveIds.filter((id) => nodeIdSet.has(id));
        if (moveIds.length) {
          e.preventDefault();
          pushHistory();
          /* v3 §809: Arrow 16px, Shift+Arrow 1px */
          const step = e.shiftKey ? 1 : 16;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          setNodes((ns) => ns.map((n) => (moveIds.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)));
        }
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); setShortcutsOpen(true); }
      // Space bar: temporarily switch to pan mode while held
      if (e.key === ' ' && !e.repeat && !spacebarPanRef.current.active) {
        e.preventDefault();
        spacebarPanRef.current = { active: true, prevMode: mode };
        setMode('pan');
      }
    };
    const handleKeyUp = (e) => {
      const ae = document.activeElement;
      const tag = ae?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ae?.isContentEditable) return;
      if (e.key === ' ' && spacebarPanRef.current.active) {
        e.preventDefault();
        const prev = spacebarPanRef.current.prevMode;
        spacebarPanRef.current = { active: false, prevMode: 'select' };
        setMode(prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [selectedId, selectedIds, mode, nodes, links, clearFailureSim, setCommandPaletteOpen, setShortcutsOpen, setFailureSim, setHeatmapMode, handleUndo, handleRedo, handleSave, handleDelete, handleDuplicateSelection, pushHistory, setNodes, setLinks, setSelectedIds, setSelectedId, setRenameModal, setMode]);

  const hasTopology =
    nodes.length > 0 ||
    rooms.length > 0 ||
    barriers.length > 0 ||
    vlanZones.length > 0 ||
    powerZones.length > 0;
  const hasSelection = !!selectedId || selectedIds.length > 1;

  const hasClassicBarriers = useMemo(
    () => barriers.some((b) => !b.environmentKind || (b.environmentKind !== 'noise' && b.environmentKind !== 'conduit')),
    [barriers]
  );
  const exportReadyHeuristic = hasTopology && links.length > 0 && vlans.length > 0 && insightsOpen;
  const pathTraceActive = !!(pathTraceSource && pathTraceTarget);

  const failureModalStats = useMemo(() => {
    const affected = failureImpactIds?.size ?? 0;
    const apOff = nodes.filter((n) => n.type === 'ap' && failureImpactIds?.has(n.id)).length;
    return {
      affected,
      apOff,
      before: baselineSnapshot?.overallScore ?? null,
      after: smartSnapshot?.overallScore ?? null,
    };
  }, [failureImpactIds, nodes, baselineSnapshot, smartSnapshot]);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden font-inter">
      {/* Top bar */}
      <TopBar
        expoMode={EXPO_MODE}
        onSave={handleSave}
        onLoad={handleLoad}
        onReset={() => {
          if (window.confirm('Clear the entire canvas? This cannot be undone.')) handleReset();
        }}
        onImportJson={() => importInputRef.current?.click()}
        onExportJson={handleExportJson}
        onExportSvg={handleExportSvg}
        onExportBrief={handleExportBrief}
        onExportConfig={handleExportConfig}
        onOpenExportHub={EXPO_MODE ? null : () => setExportModalOpen(true)}
        onShare={handleShareLink}
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
            <>
              {!EXPO_MODE && (
                <WorkflowProgress
                  hasTopology={hasTopology}
                  nodeCount={nodes.length}
                  hasRooms={rooms.length > 0}
                  hasClassicBarriers={hasClassicBarriers}
                  hasVlanZonesOrVlans={vlanZones.length > 0 || vlans.length > 0}
                  hasLinks={links.length > 0}
                  insightsOpen={insightsOpen}
                  pathTraceActive={pathTraceActive}
                  failureActive={!!failureTarget}
                  exportReady={exportReadyHeuristic}
                />
              )}
              <AIPanel
                ref={aiSubmitRef}
                onTopologyGenerated={handleTopologyGenerated}
                onRefinement={handleRefinement}
                hasTopology={hasTopology}
                getMapState={() => ({ nodes, links, rooms, vlans, barriers, vlanZones, powerZones })}
              />
            </>
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

        {/* Left: device palette (majority of height) + environment toolbox (capped) */}
        {!focusMode && (
          <div className="flex h-full min-h-0 w-[18rem] shrink-0 flex-col border-r border-border bg-card/80 sm:w-80">
            <div className="flex min-h-0 flex-[3] flex-col overflow-hidden basis-0">
              <LeftPanel
                expoMode={EXPO_MODE}
                onDeviceDragStart={handleDeviceDragStart}
                onPatternDragStart={handlePatternDragStart}
                onDevicePick={handleDevicePick}
                onPatternPick={handlePatternPick}
                mode={mode}
                placementType={placementType}
                placementPattern={placementPattern}
              />
            </div>
            <div className={`flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-border/80 ${
              EXPO_MODE ? 'max-h-[min(36vh,320px)]' : 'max-h-[min(28vh,248px)]'
            }`}>
              <EnvironmentToolbox mode={mode} setMode={setMode} />
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          className={`flex-1 relative overflow-hidden bg-background ${heatmapMode === 'signal' ? 'ring-1 ring-primary/20' : ''}`}
          onDragOver={e => e.preventDefault()}
          onDrop={handleCanvasDrop}
        >
          {heatmapMode === 'signal' && (
            <div className="absolute inset-0 z-[4] pointer-events-none bg-foreground/10 transition-opacity duration-300" aria-hidden />
          )}
          {/* Floating Toolbar */}
          <div className="absolute top-3 left-3 z-10">
            <Toolbar
              expoMode={EXPO_MODE}
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
              onExport={EXPO_MODE ? handleExportJson : () => setExportModalOpen(true)}
              onSimulateUptime={EXPO_MODE ? null : handleSimulateUptime}
              onSimulateDeviceStatus={EXPO_MODE ? null : handleSimulateDeviceStatus}
              onOpenInsights={() => setInsightsOpen(true)}
              onCollapseSidebars={EXPO_MODE ? null : () => {
                setFocusMode(true);
                setAiPanelOpen(false);
                setPropsPanelOpen(false);
                setInsightsOpen(false);
                showToast('Focus canvas — sidebars hidden', 'info');
              }}
            />
          </div>
          <TopologyCanvas
            nodes={nodes} links={links} rooms={rooms} vlans={vlans}
            barriers={barriers}
            vlanZones={vlanZones}
            powerZones={powerZones}
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
            onPowerZoneAdd={handlePowerZoneAdd}
            onGhostApPlace={handleGhostApPlace}
            selectedId={selectedId} setSelectedId={setSelectedId}
            selectedIds={selectedIds} onMultiSelect={setSelectedIds}
            mode={mode} setMode={setMode}
            placementType={placementType}
            placementPattern={placementPattern}
            onPatternAdd={handlePatternAdd}
            onNodeMove={handleNodeMove}
            onNodeAdd={handleNodeAdd}
            onLinkAdd={handleLinkAdd}
            onConnectNodeToBus={handleConnectNodeToBus}
            onLinkUpdate={handleLinkUpdate}
            onLinkDelete={handleLinkDelete}
            onRoomAdd={handleRoomAdd}
            onRoomResize={handleRoomResize}
            onRoomMove={handleRoomMove}
            onBarrierMove={handleBarrierMove}
            onBeforeChange={pushHistory}
            zoom={zoom} pan={pan}
            setZoom={setZoom} setPan={setPan}
            connectingFrom={connectingFrom}
            setConnectingFrom={setConnectingFrom}
            highlightVlan={highlightVlan}
            onContextMenuRequest={handleContextMenuRequest}
            onNodeLabelDoubleClick={(id) => {
              const n = nodes.find((x) => x.id === id);
              setRenameModal({
                title: 'Rename / Label',
                value: n?.label || '',
                onConfirm: (v) => setNodes((ns) => ns.map((x) => (x.id === id ? { ...x, label: v } : x))),
              });
            }}
          />

          {!hasTopology && (
            <EmptyState
              onTemplates={EXPO_MODE ? null : () => setShowTemplates(true)}
              onDescribe={() => aiSubmitRef.current?.focusPrompt?.()}
            />
          )}

          {/* Minimap — shown whenever there is topology (including expo / course build) */}
          {hasTopology && (
            <MiniMap
              nodes={nodes} links={links} rooms={rooms} barriers={barriers} powerZones={powerZones}
              zoom={zoom} pan={pan} setPan={setPan}
              canvasSize={canvasSize}
            />
          )}

          {hasTopology && insightsOpen && !focusMode && (
            <NetworkInsightsPanel
              nodes={nodes}
              links={links}
              vlans={vlans}
              smartSnapshot={smartSnapshot}
              simple={EXPO_MODE}
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
              pathTracePath={pathTracePath}
              generateAnimKey={generateAnimKey}
            />
          )}

          {/* Mode indicator */}
          {mode === 'connect' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              {connectingFrom ? 'Click target device to connect' : 'Click source device to start connection'}
              <span className="ml-2 opacity-70">- Esc to cancel</span>
            </div>
          )}
          {mode === 'place' && placementPattern && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Click canvas to place{' '}
              {TOPOLOGY_PATTERNS.find((p) => p.id === placementPattern)?.label || placementPattern}
              <span className="ml-2 opacity-70">- Esc to cancel</span>
            </div>
          )}
          {mode === 'place' && placementType && !placementPattern && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Click canvas to place {DEVICE_TYPES[placementType]?.label || placementType}
              <span className="ml-2 opacity-70">- Esc to cancel</span>
            </div>
          )}
          {mode === 'room' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Click and drag to draw a room - Esc to cancel
            </div>
          )}
          {(mode === 'barrier' || mode === 'bus' || mode === 'noise' || mode === 'conduit' || mode === 'obstacle') && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              {mode === 'noise' && 'Draw noise source line — RF hint for the engine'}
              {mode === 'conduit' && 'Draw cable conduit — visual raceway (non-blocking)'}
              {mode === 'barrier' && 'Drag to draw a wall / barrier — affects Wi‑Fi in intelligence engine'}
              {mode === 'bus' && 'Drag to draw a bus backbone, then connect devices to the line'}
              {mode === 'obstacle' && 'Draw furniture / rack — wood default, may block cable path'}
            </div>
          )}
          {mode === 'powerzone' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-600/95 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Drag to draw UPS/PDU coverage area (v3 power zone)
            </div>
          )}
          {mode === 'vlanzone' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              Drag a room overlay region — Esc to cancel
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
            expoMode={EXPO_MODE}
            selectedId={selectedId}
            nodes={nodes} links={links} rooms={rooms} barriers={barriers} vlanZones={vlanZones} powerZones={powerZones} vlans={vlans}
            deviceStates={smartSnapshot?.deviceStates}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onSelectNode={(id) => { setSelectedId(id); setSelectedIds([]); }}
          />
        )}
      </div>

      {/* Stats bar */}
      {EXPO_MODE ? (
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-1.5 text-[11px] text-muted-foreground border-t border-border/60 bg-card/80">
          <span className="font-medium">
            {nodes.filter((n) => !n.isBusAnchor).length} device{nodes.filter((n) => !n.isBusAnchor).length === 1 ? '' : 's'} · {links.length} link{links.length === 1 ? '' : 's'}
          </span>
          <span className="font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
        </div>
      ) : (
        <StatsPanel
          nodes={nodes} links={links} vlans={vlans} rooms={rooms} barriers={barriers}
          highlightVlan={highlightVlan}
          setHighlightVlan={setHighlightVlan}
          smartSnapshot={smartSnapshot}
          zoom={zoom}
        />
      )}

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
      {!EXPO_MODE && showTemplates && (
        <TemplateGallery onSelect={handleTemplateSelect} onClose={() => setShowTemplates(false)} />
      )}

      {!EXPO_MODE && (
        <ExportMenuModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExportPng={handleExportPngDemo}
          onExportSvg={() => { handleExportSvg(); setExportModalOpen(false); }}
          onExportJson={() => { handleExportJson(); setExportModalOpen(false); }}
          onCopyJson={handleCopyJsonExport}
          onExportPdf={handleExportPdfDemo}
          onExportPkt={handleExportPktDemo}
          onExportScript={() => { handleExportConfig(); setExportModalOpen(false); }}
          onExportBrief={() => { handleExportBrief(); setExportModalOpen(false); }}
        />
      )}
      {!EXPO_MODE && (
        <FailureImpactModal
          open={failureModalOpen && !!failureTarget}
          onClose={() => setFailureModalOpen(false)}
          affectedCount={failureModalStats.affected}
          apOfflineCount={failureModalStats.apOff}
          scoreBefore={failureModalStats.before}
          scoreAfter={failureModalStats.after}
        />
      )}

      {!EXPO_MODE && (
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
          extraItems={commandPaletteExtras}
        />
      )}
      {!EXPO_MODE && (
        <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      )}
      {!EXPO_MODE && (
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
      )}
    </div>
  );
}
