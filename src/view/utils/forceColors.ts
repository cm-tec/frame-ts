// Single source of truth for the internal force and displacement colours, so the diagram
// drawn on the structure and the chart in the sidebar can never drift apart.

export const FORCE_COLOR = {
    N: '#3b82f6',
    V: '#8b5cf6',
    M: '#10b981',
} as const;

export const DISPLACEMENT_COLOR = {
    v: '#d97706',
    u: '#0891b2',
} as const;

export const LOAD_COLOR = 'rgba(239, 68, 68, 0.8)';
export const REACTION_COLOR = '#0d9488';

export function withOpacity(hex: string, alpha: number): string {
    const value = parseInt(hex.slice(1), 16);

    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}