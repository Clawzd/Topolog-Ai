import { create } from 'zustand';

const initialCanvas = () => ({
  nodes: [],
  links: [],
  rooms: [],
  vlans: [],
  barriers: [],
  vlanZones: [],
  powerZones: [],
});

export const useTopologyCanvasStore = create((set, get) => ({
  ...initialCanvas(),
  history: [],
  redoStack: [],

  setNodes: (updater) =>
    set((s) => ({ nodes: typeof updater === 'function' ? updater(s.nodes) : updater })),
  setLinks: (updater) =>
    set((s) => ({ links: typeof updater === 'function' ? updater(s.links) : updater })),
  setRooms: (updater) =>
    set((s) => ({ rooms: typeof updater === 'function' ? updater(s.rooms) : updater })),
  setVlans: (updater) =>
    set((s) => ({ vlans: typeof updater === 'function' ? updater(s.vlans) : updater })),
  setBarriers: (updater) =>
    set((s) => ({ barriers: typeof updater === 'function' ? updater(s.barriers) : updater })),
  setVlanZones: (updater) =>
    set((s) => ({ vlanZones: typeof updater === 'function' ? updater(s.vlanZones) : updater })),
  setPowerZones: (updater) =>
    set((s) => ({ powerZones: typeof updater === 'function' ? updater(s.powerZones) : updater })),

  replaceCanvas: (partial) =>
    set((s) => ({
      ...s,
      ...initialCanvas(),
      ...partial,
    })),

  pushHistory: () => {
    const { nodes, links, rooms, vlans, barriers, vlanZones, powerZones, history } = get();
    const snap = { nodes, links, rooms, vlans, barriers, vlanZones, powerZones, at: Date.now() };
    set({ history: [...history.slice(-19), snap], redoStack: [] });
  },

  undo: () => {
    const { history, nodes, links, rooms, vlans, barriers, vlanZones, powerZones, redoStack } = get();
    if (!history.length) return false;
    const prev = history[history.length - 1];
    const cur = { nodes, links, rooms, vlans, barriers, vlanZones, powerZones };
    set({
      nodes: prev.nodes,
      links: prev.links,
      rooms: prev.rooms,
      vlans: prev.vlans,
      barriers: prev.barriers || [],
      vlanZones: prev.vlanZones || [],
      powerZones: prev.powerZones || [],
      history: history.slice(0, -1),
      redoStack: [cur, ...redoStack.slice(0, 19)],
    });
    return true;
  },

  redo: () => {
    const { redoStack, nodes, links, rooms, vlans, barriers, vlanZones, powerZones, history } = get();
    if (!redoStack.length) return false;
    const next = redoStack[0];
    const cur = { nodes, links, rooms, vlans, barriers, vlanZones, powerZones, at: Date.now() };
    set({
      nodes: next.nodes,
      links: next.links,
      rooms: next.rooms,
      vlans: next.vlans,
      barriers: next.barriers || [],
      vlanZones: next.vlanZones || [],
      powerZones: next.powerZones || [],
      history: [...history.slice(-19), cur],
      redoStack: redoStack.slice(1),
    });
    return true;
  },

  jumpToHistoryIndex: (idx) => {
    const { history } = get();
    const snap = history[idx];
    if (!snap) return false;
    set({
      nodes: snap.nodes,
      links: snap.links,
      rooms: snap.rooms,
      vlans: snap.vlans,
      barriers: snap.barriers || [],
      vlanZones: snap.vlanZones || [],
      powerZones: snap.powerZones || [],
      history: history.slice(0, idx),
      redoStack: [],
    });
    return true;
  },
}));
