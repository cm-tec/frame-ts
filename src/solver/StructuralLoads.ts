import type { Loads } from "../models/inputModels";
import { Polynomial } from "./Polynomial";
import type { StructuralSystem } from "./StructuralSystem";

export type ElementLoadField = {
    q_trans: Polynomial;
    q_axial: Polynomial;
};

export type NodalForce = {
    fx: number;
    fy: number;
    m: number;
};

const NO_ELEMENT_LOAD: ElementLoadField = { q_trans: Polynomial.ZERO, q_axial: Polynomial.ZERO };
const NO_NODAL_FORCE: NodalForce = { fx: 0, fy: 0, m: 0 };

export class StructuralLoads {
    private readonly elementLoads = new Map<number, ElementLoadField>();
    private readonly nodalForces = new Map<number, NodalForce>();

    constructor(system: StructuralSystem, loads: Loads) {
        const elementIds = new Set(system.elements.map(e => e.id));
        const nodeIds = new Set(system.nodes.map(n => n.id));

        for (const load of loads.elements) {
            if (!elementIds.has(load.element_id)) {
                console.warn(`Element load ${load.id} references non-existent element: ${load.element_id}`);
                continue;
            }

            const [cos, sin] = directionCosines(load.angle);
            const q = Polynomial.linear(load.q_i, load.q_j);
            const applied = this.ofElement(load.element_id);

            this.elementLoads.set(load.element_id, {
                q_axial: applied.q_axial.plus(q.scaled(cos)),
                q_trans: applied.q_trans.plus(q.scaled(sin)),
            });
        }

        for (const load of loads.nodes) {
            if (!nodeIds.has(load.node_id)) {
                console.warn(`Nodal load ${load.id} references non-existent node: ${load.node_id}`);
                continue;
            }

            const [cos, sin] = directionCosines(load.angle);
            const applied = this.ofNode(load.node_id);

            this.nodalForces.set(load.node_id, {
                ...applied,
                fx: applied.fx + load.magnitude * cos,
                fy: applied.fy + load.magnitude * sin,
            });
        }

        for (const load of loads.moments) {
            if (!nodeIds.has(load.node_id)) {
                console.warn(`Moment load ${load.id} references non-existent node: ${load.node_id}`);
                continue;
            }

            const applied = this.ofNode(load.node_id);

            this.nodalForces.set(load.node_id, { ...applied, m: applied.m + load.magnitude });
        }
    }

    ofElement(elementId: number): ElementLoadField {
        return this.elementLoads.get(elementId) ?? NO_ELEMENT_LOAD;
    }

    ofNode(nodeId: number): NodalForce {
        return this.nodalForces.get(nodeId) ?? NO_NODAL_FORCE;
    }
}

function directionCosines(angleInDegrees: number): [number, number] {
    const rad = (angleInDegrees * Math.PI) / 180;

    let cos = Math.cos(rad);
    let sin = Math.sin(rad);

    // Snapped so a purely transverse or purely axial load carries no trace of the other.
    if (Math.abs(cos) < 1e-12) cos = 0;
    if (Math.abs(sin) < 1e-12) sin = 0;

    return [cos, sin];
}
