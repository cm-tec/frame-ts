export type Node = {
    id: number;
    x: number;
    z: number;
    mass: number;
    restrained_u: boolean;
    restrained_v: boolean;
    restrained_phi: boolean;
};

export type Element = {
    id: number;
    node_i: number;
    node_j: number;
    ea: number;
    ei: number;
    c: number;
};