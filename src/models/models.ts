export type Node = {
    id: number;
    x: number;
    z: number;
    mass: number;
    restrained_u: boolean;
    restrained_v: boolean;
    u0: number;
    v0: number;
    du0: number;
    dv0: number;
};

export type Element = {
    id: number;
    node_i: number;
    node_j: number;
    ea: number;
    c: number;
};