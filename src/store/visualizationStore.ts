import { create } from 'zustand';

interface VisualizationState {
    // Playback
    speed: number;
    showUndeformedSystem: boolean;
    showNodes: boolean;
    showBearings: boolean;

    // Diagram sidebar
    t1: number;
    t2: number;
    numPoints: number;
    activeDiagramViews: string[];

    // Internal: track DOF layout to detect when to reset chart selection
    dofKey: string;
}

interface VisualizationActions {
    setSpeed: (v: number) => void;
    setShowUndeformedSystem: (v: boolean) => void;
    setShowNodes: (v: boolean) => void;
    setShowBearings: (v: boolean) => void;
    setT1: (v: number) => void;
    setT2: (v: number) => void;
    setNumPoints: (v: number) => void;
    setActiveDiagramViews: (v: string[]) => void;
    syncDofKey: (key: string) => void;
}

export const useVisualizationStore = create<VisualizationState & VisualizationActions>((set) => ({
    speed: 1,
    showUndeformedSystem: false,
    showNodes: true,
    showBearings: true,
    t1: 0,
    t2: 10,
    numPoints: 100,
    activeDiagramViews: [],
    dofKey: '',

    setSpeed: (v) => set({ speed: v }),
    setShowUndeformedSystem: (v) => set({ showUndeformedSystem: v }),
    setShowNodes: (v) => set({ showNodes: v }),
    setShowBearings: (v) => set({ showBearings: v }),
    setT1: (v) => set({ t1: v }),
    setT2: (v) => set({ t2: v }),
    setNumPoints: (v) => set({ numPoints: v }),
    setActiveDiagramViews: (v) => set({ activeDiagramViews: v }),

    // Resets chart selection only when the free DOF layout changes
    syncDofKey: (key) => set((state) => {
        if (state.dofKey === key) return {};
        return { dofKey: key, activeDiagramViews: [] };
    }),
}));
