export type Node = {
    id: number;
    x: number;
    z: number;
    mass: number;
    restrained_u: boolean;
    restrained_v: boolean;
    restrained_phi: boolean;
    u0: number;
    v0: number;
    phi0: number;
    du0: number;
    dv0: number;
    dphi0: number;
};

export type Element = {
    id: number;
    node_i: number;
    node_j: number;
    ea: number;
    ei: number;
    c: number;
};