import { type Node, type Element, type Hinge } from "../models/models";

export interface StructuralNode extends Node {
    // e.g., [0, 1, -1] means u=0, v=1, and theta is restrained
    dofs: [number, number, number];
}

export interface StructuralElement extends Element {
    // [u_i, v_i, theta_i, u_j, v_j, theta_j]
    dofs: [number, number, number, number, number, number];

    releases_i: { u: boolean; v: boolean; theta: boolean };
    releases_j: { u: boolean; v: boolean; theta: boolean };
}



export class StructuralSystem {
    readonly ndof: number;
    readonly ndof_active: number = 0;
    readonly nodes: StructuralNode[];
    readonly elements: StructuralElement[];

    constructor(rawNodes: Node[], rawElements: Element[], hinges: Hinge[]) {
        this.ndof = rawNodes.length * 3;

        this.nodes = [];
        this.elements = [];

        let dofCounter = 0;

        for (const n of rawNodes) {
            const dofs: [number, number, number] = [dofCounter, dofCounter+1, dofCounter+2];

            this.nodes.push({
                ...n,
                dofs
            });

            dofCounter += 3;
        }

        // 2. Map Elements by merging the node DOF arrays
        for (const e of rawElements) {
            const n_i = this.nodes.find(n => n.id === e.node_i);
            const n_j = this.nodes.find(n => n.id === e.node_j);

            if (!n_i || !n_j) {
                console.warn(`Element ${e.id} references non-existent node: i=${e.node_i}, j=${e.node_j}`);
                continue;
            }

            // Initialize default values where all internal force components are completely unreleased (rigid)
            const releases_i = { u: false, v: false, theta: false };
            const releases_j = { u: false, v: false, theta: false };

            // Find all hinges belonging to this element and bind them to their respective ends
            const elementHinges = hinges.filter(h => h.element_id === e.id);
            for (const h of elementHinges) {
                if (h.end === 'i') {
                    releases_i.u = h.u;
                    releases_i.v = h.v;
                    releases_i.theta = h.theta;
                } else if (h.end === 'j') {
                    releases_j.u = h.u;
                    releases_j.v = h.v;
                    releases_j.theta = h.theta;
                }
            }

            this.elements.push({
                ...e,
                dofs: [...n_i.dofs, ...n_j.dofs],
                releases_i,
                releases_j
            });
        }
    }


    /**
     * Factory method to construct a pure space-saving Truss System.
     * Automatically locks down all rotational DOFs at the node level
     * and introduces moment releases at both ends of every member.
     */
    static createPureTruss(rawNodes: Node[], rawElements: Element[]): StructuralSystem {
        // Force all nodes to restrain their rotation (theta: true)
        const trussNodes: Node[] = rawNodes.map(node => ({
            ...node,
            restraint: {
                ...node.restraint,
                theta: true // Every joint is safe from torsion spins
            }
        }));

        // Dynamically build a full double-ended moment release array for every single element
        const trussHinges: Hinge[] = [];
        let hingeIdCounter = 1;

        for (const e of rawElements) {
            // Hinge at Node I
            trussHinges.push({
                id: hingeIdCounter++,
                element_id: e.id,
                end: 'i',
                u: false,
                v: false,
                theta: true // Release Moment M_i
            });

            // Hinge at Node J
            trussHinges.push({
                id: hingeIdCounter++,
                element_id: e.id,
                end: 'j',
                u: false,
                v: false,
                theta: true // Release Moment M_j
            });
        }

        // Return a fully configured StructuralSystem utilizing our internal automated sets
        return new StructuralSystem(trussNodes, rawElements, trussHinges);
    }
}