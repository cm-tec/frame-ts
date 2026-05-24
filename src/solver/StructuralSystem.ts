import { type Node, type Element } from "../models/models";

export interface StructuralNode extends Node {
    // e.g., [0, 1, -1] means u=0, v=1, and theta is restrained
    dofs: [number, number, number];
}

export interface StructuralElement extends Element {
    // [u_i, v_i, theta_i, u_j, v_j, theta_j]
    dofs: [number, number, number, number, number, number];
}



export class StructuralSystem {
    readonly ndof: number;
    readonly ndof_active: number = 0;
    readonly nodes: StructuralNode[];
    readonly elements: StructuralElement[];

    constructor(rawNodes: Node[], rawElements: Element[]) {
        this.ndof = rawNodes.length * 3;

        this.nodes = [];
        this.elements = [];

        for (const n of rawNodes) {
            const dofs: [number, number, number] = [-1, -1, -1];

            if (!n.restraint.u) dofs[0] = this.ndof_active++;
            if (!n.restraint.v) dofs[1] = this.ndof_active++;
            if (!n.restraint.theta) dofs[2] = this.ndof_active++;

            this.nodes.push({
                ...n,
                dofs
            });
        }

        // 2. Map Elements by merging the node DOF arrays
        for (const e of rawElements) {
            const n_i = this.nodes.find(n => n.id === e.node_i);
            const n_j = this.nodes.find(n => n.id === e.node_j);

            if (!n_i || !n_j) continue;

            this.elements.push({
                ...e,
                // Flattening both 3-element arrays into a single 6-element array
                dofs: [...n_i.dofs, ...n_j.dofs]
            });
        }
    }
}