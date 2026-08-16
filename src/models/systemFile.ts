import type { NodeInput, ElementInput, HingeInput, InitialConditions, Loads } from './inputModels';

/**
 * The on-disk shape of a structure: what Export writes, what Import reads, and what an
 * example in `src/examples` is. Every field is optional because the file comes from
 * outside the app and cannot be trusted to be complete.
 */
export type SystemFile = {
    name?: string;
    /** Optional one-liner shown on the welcome tile. Hand-added; the editor never writes it. */
    description?: string;
    view?: 'dynamic' | 'static';
    nodes?: NodeInput[];
    elements?: ElementInput[];
    hinges?: HingeInput[];
    initialConditions?: InitialConditions;
    loads?: Loads;
};
