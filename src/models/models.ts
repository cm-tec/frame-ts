export type Node = {
    id: number;
    x: number;
    z: number;
    mass: number;

    angle: number;

    restraint: { u: boolean; v: boolean; theta: boolean };
};

export type InitialConditions = {
    [nodeId: number]: {
        u0: number; du0: number;
        v0: number; dv0: number;
        theta0: number; dtheta0: number
    };
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

export type Loads = {
    nodes: NodalLoad[];
    elements: ElementLoad[];
};

export type Element = {
    id: number;
    node_i: number;
    node_j: number;
    ea: number;
    ei: number;
    c: number;

    releases_i: { u: boolean; v: boolean; theta: boolean };
    releases_j: { u: boolean; v: boolean; theta: boolean };
};