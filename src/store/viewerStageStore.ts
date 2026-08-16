import type Konva from 'konva';
import { create } from 'zustand';

// The Konva stage of the currently mounted StructuralSystemViewer, so chrome outside the
// viewer (the thumbnail button) can grab a snapshot of whatever is on screen. Exactly one
// viewer is mounted at a time - the editor and every visualization page render their own.
export const useViewerStageStore = create<{ stage: Konva.Stage | null }>(() => ({ stage: null }));
