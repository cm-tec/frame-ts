import { create } from 'zustand';

export const useAnimationStore = create<{ time: number }>(() => ({ time: 0 }));
