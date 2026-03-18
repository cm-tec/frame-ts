import { type Node, type Element } from "../models/models";

interface StructuralNode extends Node {
    id: number;
    u_dof: number;
    v_dof: number;
    phi_dof: number;
}

interface StructuralElement extends Element {
    id: number;
    u_i_dof: number;
    v_i_dof: number;
    phi_i_dof: number;
    u_j_dof: number;
    v_j_dof: number;
    phi_j_dof: number;
}



export class StructuralSystem {
    ndofs: number;
    nodes: StructuralNode[];
    elements: StructuralElement[];

    constructor(nodes: Node[], elements: Element[]) {
        this.ndofs = 0;
        this.nodes = [];
        this.elements = [];

        for (const n of nodes) {
            this.nodes.push({ ...n, u_dof: this.ndofs, v_dof: this.ndofs + 1, phi_dof: this.ndofs + 2 });
            this.ndofs += 3;
        }


        for (const e of elements) {
            let n_i = this.nodes.find(n => n.id == e.node_i);
            let n_j = this.nodes.find(n => n.id == e.node_j);

            if (!n_i || !n_j) {
                continue;
            }

            this.elements.push({
                ...e,
                u_i_dof: n_i.u_dof,
                v_i_dof: n_i.v_dof,
                phi_i_dof: n_i.phi_dof,
                u_j_dof: n_j.u_dof,
                v_j_dof: n_j.v_dof,
                phi_j_dof: n_j.phi_dof
            });
        }
    }
}