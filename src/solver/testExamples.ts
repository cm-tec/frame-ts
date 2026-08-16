import { StructuralSystem } from './StructuralSystem';

export function getBeam(ea = 7, ei = 11, c = 13, m = 17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { D1: true, D2: true, D3: false }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { D1: false, D2: true, D3: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c },
        ],
        []
    );
}

export function getRotatedBeam(ea = 7, ei = 11, c = 13, m = 17): StructuralSystem {
    const alpha = Math.atan2(4 / 5, 3 / 5);
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { D1: true, D2: true, D3: false }, angle: alpha },
            { id: 2, x: 3 / 5, z: 4 / 5, mass: m, restraint: { D1: false, D2: true, D3: false }, angle: alpha },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c },
        ],
        []
    );
}

export function getCantilever(ea = 7, ei = 11, c = 13, m = 17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { D1: true, D2: true, D3: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c },
        ]
    );
}

export function getCantileverThroughReleases(ea = 7, ei = 11, c = 13, m = 17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { D1: true, D2: true, D3: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { D1: true, D2: true, D3: true }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c },
        ],
        [
            { id: 1, element_id: 1, end: 'j', D1: true, D2: true, D3: true },
        ]
    );
}

export function getFlippedCantilever(ea = 7, ei = 11, c = 13, m = 17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { D1: true, D2: true, D3: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { D1: false, D2: false, D3: false }, angle: Math.PI },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c },
        ]
    );
}

// Simply supported beam, two equal-length spans, center node free
export function getBeamWithCenterNode(ea = 7, ei = 11, c = 13, m = 17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0,   z: 0, mass: m, restraint: { D1: true, D2: true, D3: false }, angle: 0 },
            { id: 2, x: 0.5, z: 0, mass: m, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
            { id: 3, x: 1,   z: 0, mass: m, restraint: { D1: false, D2: true, D3: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c },
            { id: 2, node_i: 2, node_j: 3, ea, ei, c },
        ]
    );
}

// Two-span beam: simply supported at left (pin), middle (roller), with cantilever overhang to the right
export function getBeamWithCantileverArm(ea = 1, ei = 1): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0,   z: 0, mass: 0, restraint: { D1: true, D2: true, D3: false }, angle: 0 },
            { id: 2, x: 2.0, z: 0, mass: 0, restraint: { D1: false, D2: true, D3: false }, angle: 0 },
            { id: 3, x: 3.0, z: 0, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 },
            { id: 2, node_i: 2, node_j: 3, ea, ei, c: 0 },
        ]
    );
}

// Portal frame: two vertical columns (pinned bases), horizontal beam; moment release at top of right column
export function getPortalFrame(ea = 1, ei = 1): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { D1: true, D2: true, D3: false }, angle: 0 },
            { id: 2, x: 0, z: 1, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
            { id: 3, x: 1, z: 1, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
            { id: 4, x: 1, z: 0, mass: 0, restraint: { D1: true, D2: true, D3: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 },
            { id: 2, node_i: 2, node_j: 3, ea, ei, c: 0 },
            { id: 3, node_i: 3, node_j: 4, ea, ei, c: 0 },
        ],
        [
            { id: 1, element_id: 3, end: 'i', D1: false, D2: false, D3: true },
        ]
    );
}

// Fixed cantilever with a vertical strut/column attached at the free tip; moment release at strut top
export function getCantileverWithSupport(ea = 1, ei = 1): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z:  0, mass: 0, restraint: { D1: true, D2: true, D3: true }, angle: 0 },
            { id: 2, x: 1, z:  0, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
            { id: 3, x: 1, z: -1, mass: 0, restraint: { D1: true, D2: true, D3: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 },
            { id: 2, node_i: 2, node_j: 3, ea, ei, c: 0 },
        ],
        [
            { id: 1, element_id: 2, end: 'i', D1: false, D2: false, D3: true },
        ]
    );
}