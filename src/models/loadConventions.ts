import type { Loads } from './inputModels';

// The editor still measures load angles the old way: 0 points downwards for a nodal load
// and perpendicular to the member for an element load. The solver measures every angle
// CCW from the x axis of the frame the load belongs to.
//
// Both are the same direction turned by 90 degrees, so one shift covers both.
export function toSolverAngles(loads: Loads): Loads {
    return {
        nodes: loads.nodes.map(load => ({ ...load, angle: load.angle - 90 })),
        elements: loads.elements.map(load => ({ ...load, angle: load.angle - 90 })),
    };
}