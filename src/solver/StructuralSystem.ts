import { type NodeInput, type ElementInput, type HingeInput } from "../models/inputModels";

export interface StructuralNode {
    id: number;
    
    x: number;
    z: number;

    mass: number;
    
    angle: number;
    
    restraint: { u: boolean; v: boolean; theta: boolean };
    dofs: [number, number, number];
}


/**
 * Which internal force components are released at one end of an element.
 *
 * The resolved form of a HingeInput: the input names an element and an end, this says
 * what is released, per end, on the element itself.
 */
export type Releases = { u: boolean; v: boolean; theta: boolean };


export class StructuralElement {
    readonly id: number;

    readonly n_i: StructuralNode;
    readonly n_j: StructuralNode;

    readonly ea: number;
    readonly ei: number;
    readonly c: number;

    // [u_i, v_i, theta_i, u_j, v_j, theta_j]
    readonly dofs: [number, number, number, number, number, number];

    readonly releases_i: Releases;
    readonly releases_j: Releases;

    constructor(
        element: ElementInput,
        n_i: StructuralNode,
        n_j: StructuralNode,
        hinges: HingeInput[] = [],
    ) {
        this.id = element.id;
        this.n_i = n_i;
        this.n_j = n_j;
        this.ea = element.ea;
        this.ei = element.ei;
        this.c = element.c;

        this.dofs = [...n_i.dofs, ...n_j.dofs];

        // Rigidly connected by default; each hinge on this element releases what it names.
        this.releases_i = { u: false, v: false, theta: false };
        this.releases_j = { u: false, v: false, theta: false };

        for (const h of hinges) {
            if (h.element_id !== this.id) continue;

            const released = h.end === 'i' ? this.releases_i : this.releases_j;
            released.u = h.u;
            released.v = h.v;
            released.theta = h.theta;
        }
    }

    // Element length
    get L(): number {
        return Math.hypot(this.n_j.x - this.n_i.x, this.n_j.z - this.n_i.z);
    }

    
    // Direction of the local axis i→j, measured from global +x.
    get angle(): number {
        return Math.atan2(this.n_j.z - this.n_i.z, this.n_j.x - this.n_i.x);
    }
}



export class StructuralSystem {
    readonly ndof: number;
    readonly ndof_active: number = 0;
    readonly nodes: StructuralNode[];
    readonly elements: StructuralElement[];

    constructor(rawNodes: NodeInput[], rawElements: ElementInput[], hinges: HingeInput[] = []) {
        this.ndof = rawNodes.length * 3;

        this.nodes = [];
        this.elements = [];

        let dofCounter = 0;

        for (const n of rawNodes) {
            const dofs: [number, number, number] = [dofCounter, dofCounter+1, dofCounter+2];

            this.nodes.push({
                id: n.id,
                x: n.x,
                z: n.z,
                mass: n.mass,
                angle: n.angle,
                restraint: { ...n.restraint },
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

            this.elements.push(new StructuralElement(e, n_i, n_j, hinges));
        }
    }


    /*
        Factory method to construct a pure space-saving Truss System.
        Automatically locks down all rotational DOFs at the node level
        and introduces moment releases at both ends of every member.
    */
    static createPureTruss(rawNodes: NodeInput[], rawElements: ElementInput[]): StructuralSystem {
        // Force all nodes to restrain their rotation (theta: true)
        const trussNodes: NodeInput[] = rawNodes.map(node => ({
            ...node,
            restraint: {
                ...node.restraint,
                theta: true
            }
        }));

        const trussHinges: HingeInput[] = [];
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
        return new StructuralSystem(trussNodes, rawElements, trussHinges);
    }
}