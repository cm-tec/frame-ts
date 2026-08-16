import { create } from 'zustand';

export type ForceMode = 'none' | 'N' | 'Q' | 'M';

interface StaticViewState {
    showUndeformedSystem: boolean;
    showNodes: boolean;
    showBearings: boolean;
    showReferenceFiber: boolean;
    showNodal: boolean;
    showElement: boolean;
    showReactions: boolean;

    scale: number;
    forceMode: ForceMode;
    forceScale: number;
}

interface StaticViewActions {
    setShowUndeformedSystem: (v: boolean) => void;
    setShowNodes: (v: boolean) => void;
    setShowBearings: (v: boolean) => void;
    setShowReferenceFiber: (v: boolean) => void;
    setShowNodal: (v: boolean) => void;
    setShowElement: (v: boolean) => void;
    setShowReactions: (v: boolean) => void;

    setScale: (v: number) => void;
    setForceMode: (v: ForceMode) => void;
    setForceScale: (v: number) => void;
}

export const useStaticViewStore = create<StaticViewState & StaticViewActions>((set) => ({
    showUndeformedSystem: true,
    showNodes: true,
    showBearings: true,
    showReferenceFiber: true,
    showNodal: true,
    showElement: true,
    showReactions: true,

    scale: 1,
    forceMode: 'none',
    forceScale: 1,

    setShowUndeformedSystem: (v) => set({ showUndeformedSystem: v }),
    setShowNodes: (v) => set({ showNodes: v }),
    setShowBearings: (v) => set({ showBearings: v }),
    setShowReferenceFiber: (v) => set({ showReferenceFiber: v }),
    setShowNodal: (v) => set({ showNodal: v }),
    setShowElement: (v) => set({ showElement: v }),
    setShowReactions: (v) => set({ showReactions: v }),

    setScale: (v) => set({ scale: v }),
    setForceMode: (v) => set({ forceMode: v }),
    setForceScale: (v) => set({ forceScale: v }),
}));
