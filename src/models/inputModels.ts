export type NodeInput = {
    id: number;
    x: number;
    z: number;
    mass: number;

    angle: number;

    restraint: { D1: boolean; D2: boolean; D3: boolean };
};

export type ElementInput = {
    id: number;
    node_i: number;
    node_j: number;
    ea: number;
    ei: number;
    c: number;
};

export type HingeInput = {
    id: number;
    element_id: number;
    end: 'i' | 'j';
    D1: boolean; // release N (normal/axial force)
    D2: boolean; // release V (shear)
    D3: boolean; // release M (moment)
};


export type InitialConditions = {
    [nodeId: number]: {
        D1_0: number; dD1_0: number;
        D2_0: number; dD2_0: number;
        D3_0: number; dD3_0: number
    };
};

export type Loads = {
    nodes: NodalLoad[];
    elements: ElementLoad[];
};

export type NodalLoad = {
    id: number;
    node_id: number;
    magnitude: number;
    angle: number;
    frequency: number;
    phase_shift: number;
};

export type ElementLoad = {
    id: number;
    element_id: number;
    q_i: number;
    q_j: number;
    angle: number;
    frequency: number;
    phase_shift: number;
};
