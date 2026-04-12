import { create } from 'zustand';

/** UI toggles and transient simulation state (TopologAi v3). */
export const useTopologyUiStore = create((set) => ({
  heatmapMode: null,
  setHeatmapMode: (heatmapMode) => set({ heatmapMode }),

  showTrafficFlow: false,
  setShowTrafficFlow: (showTrafficFlow) => set({ showTrafficFlow }),

  showComplianceView: false,
  setShowComplianceView: (showComplianceView) => set({ showComplianceView }),

  showPowerView: false,
  setShowPowerView: (showPowerView) => set({ showPowerView }),

  showApAdvisor: false,
  setShowApAdvisor: (showApAdvisor) => set({ showApAdvisor }),

  /** Simulated failed node or link id */
  failureTarget: null,
  failureKind: null,
  setFailureSim: (failureTarget, failureKind) => set({ failureTarget, failureKind }),
  clearFailureSim: () => set({ failureTarget: null, failureKind: null }),

  pulseNodeId: null,
  setPulseNodeId: (pulseNodeId) => set({ pulseNodeId }),

  pathTraceSource: null,
  pathTraceTarget: null,
  setPathTrace: (pathTraceSource, pathTraceTarget) => set({ pathTraceSource, pathTraceTarget }),
  clearPathTrace: () => set({ pathTraceSource: null, pathTraceTarget: null }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),

  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

  onboardingStep: null,
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
}));
