import { add, eigs, atan2, hypot, identity, index, inv, lusolve, matrix, multiply, rotationMatrix, subset, transpose, zeros, type Matrix, subtract, det } from "mathjs";
import { merge, getEigenvalues, getEigenvectors } from "./utils";
import type { StructuralSystem } from "./StructuralSystem";
import { KinematicSolution } from "./KinematicSolution";
import { DynamicSolution } from "./DynamicSolution";


function get_rotation_matrix_of_element(v: [number, number], angle_i: number, angle_j: number): Matrix {
    const dx = v[0];
    const dz = v[1];

    // The absolute spatial angle of the element itself
    const theta_element = atan2(dz, dx);

    // Calculate relative angles for Node i and Node j transformations
    const theta_i = theta_element - angle_i;
    const theta_j = theta_element - angle_j;

    // Generate the distinct 2x2 rotation components
    // (Note: math.js rotationMatrix rotates counter-clockwise. Depending on your 
    // exact local-to-global convention, you may or may not need the transpose here)
    const t_i = transpose(rotationMatrix(theta_i)) as Matrix;
    const t_j = transpose(rotationMatrix(theta_j)) as Matrix;

    // Build the final 6x6 transformation matrix
    const T_e = identity(6) as Matrix;
    
    // Inject Node i's specific translation transformation
    T_e.subset(index([0, 1], [0, 1]), t_i); 
    
    // Inject Node j's specific translation transformation
    T_e.subset(index([3, 4], [3, 4]), t_j); 

    // Rotations (indices 2 and 5) remain 1 on the diagonal 
    return T_e;
}

export function k_element(EA: number, EI: number, l: number): Matrix {
    return matrix([
        [ EA/l,    0,          0,         -EA/l,   0,          0         ],
        [ 0,       12*EI/l**3, 6*EI/l**2,  0,     -12*EI/l**3, 6*EI/l**2 ],
        [ 0,       6*EI/l**2,  4*EI/l,     0,      -6*EI/l**2, 2*EI/l    ],
        [-EA/l,    0,          0,          EA/l,   0,          0         ],
        [ 0,      -12*EI/l**3,-6*EI/l**2,  0,      12*EI/l**3, -6*EI/l**2],
        [ 0,       6*EI/l**2,  2*EI/l,     0,      -6*EI/l**2, 4*EI/l    ]
    ]);
}

export function c_element(c: number): Matrix {
    return matrix([
        [ c,  0,  0,  -c,  0,  0 ],
        [ 0,  0,  0,   0,  0,  0 ],
        [ 0,  0,  0,   0,  0,  0 ],
        [-c,  0,  0,   c,  0,  0 ],
        [ 0,  0,  0,   0,  0,  0 ],
        [ 0,  0,  0,   0,  0,  0 ]
    ]);
}


function applyStaticCondensation(k_elem: Matrix, releases_i: any, releases_j: any): Matrix {
    const all_i_released = releases_i.u && releases_i.v && releases_i.theta;
    const all_j_released = releases_j.u && releases_j.v && releases_j.theta;

    if (all_i_released || all_j_released) {
        // If either end is completely disconnected, the element transmits 0 stiffness/damping
        return matrix(zeros([6, 6]));
    }


    // Array of local DOF indices to condense (0 to 5)
    // u_i=0, v_i=1, theta_i=2, u_j=3, v_j=4, theta_j=5
    const cutIdx: number[] = [];
    if (releases_i.u) cutIdx.push(0);
    if (releases_i.v) cutIdx.push(1);
    if (releases_i.theta) cutIdx.push(2);
    if (releases_j.u) cutIdx.push(3);
    if (releases_j.v) cutIdx.push(4);
    if (releases_j.theta) cutIdx.push(5);

    if (cutIdx.length === 0) return k_elem;


    const keepIdx = [0, 1, 2, 3, 4, 5].filter(idx => !cutIdx.includes(idx));

    // Split the element matrix into Sub-matrices
    const K_rr = subset(k_elem, index(keepIdx, keepIdx));
    const K_rc = subset(k_elem, index(keepIdx, cutIdx));
    const K_cr = subset(k_elem, index(cutIdx, keepIdx));
    const K_cc = subset(k_elem, index(cutIdx, cutIdx));

    let K_condensed: Matrix;

    // Check if K_cc is invertible (abs of determinant > tiny threshold)
    // If it's a 1x1 or larger matrix, math.js det() will tell us if it's singular
    if (Math.abs(det(K_cc)) < 1e-12) {
        // If the cut properties are already pure zero (like in the damping matrix),
        // there is nothing to condense out; K_rr is already the answer.
        K_condensed = K_rr;
    } else {
        K_condensed = subtract(K_rr, multiply(K_rc, multiply(inv(K_cc), K_cr)));
    }
    
    // Reconstruct a full 6x6 matrix with zeros in the cut positions 
    // so it perfectly fits your existing assembly pipeline
    let k_final = matrix(zeros([6, 6]));
    keepIdx.forEach((r, i) => {
        keepIdx.forEach((c, j) => {
            k_final.set([r, c], K_condensed.get([i, j]));
        });
    });

    return k_final;
}


export class SystemSolver {
    ndof_restrained: number;
    ndof_non_restrained: number;

    restrained: number[];
    non_restrained: number[];

    m_11: Matrix; m_12: Matrix; m_22: Matrix;
    c_11: Matrix; c_12: Matrix; c_22: Matrix;
    k_11: Matrix; k_12: Matrix; k_22: Matrix;

    constructor(system: StructuralSystem) {
        let k = matrix(zeros(system.ndof, system.ndof));
        let c = matrix(zeros(system.ndof, system.ndof));
        let m = matrix(zeros(system.ndof, system.ndof));

        let restrained: number[] = [];
        let non_restrained: number[] = [];

        const expand_matrix = (m: Matrix, indices: number[]) => {
            let T = matrix(zeros([indices.length, system.ndof]))

            indices.forEach((idx, i) => {
                T.set([i, idx], 1);
            });

            return multiply(transpose(T), multiply(m, T));
        }


        for (const e of system.elements) {
            let n_i = system.nodes.find(n => n.id === e.node_i)!;
            let n_j = system.nodes.find(n => n.id === e.node_j)!;

            const l = hypot(n_j.x - n_i.x, n_j.z - n_i.z);

            let k_e = k_element(e.ea, e.ei, l);
            let c_e = c_element(e.c);

            k_e = applyStaticCondensation(k_e, e.releases_i, e.releases_j);
            c_e = applyStaticCondensation(c_e, e.releases_i, e.releases_j);

            const R_e = get_rotation_matrix_of_element(
                [n_j.x - n_i.x, n_j.z - n_i.z],
                n_i.angle,
                n_j.angle
            )
            const R_e_T = transpose(R_e);

            const k_e_global = multiply(R_e_T, multiply(k_e, R_e));
            const c_e_global = multiply(R_e_T, multiply(c_e, R_e));

            k = add(k, expand_matrix(k_e_global, e.dofs));
            c = add(c, expand_matrix(c_e_global, e.dofs));
        }

        for (const n of system.nodes) {
            m.set([n.dofs[0], n.dofs[0]], n.mass);
            m.set([n.dofs[1], n.dofs[1]], n.mass);
            m.set([n.dofs[2], n.dofs[2]], 10);
        }

        for (const n of system.nodes) {
            if (n.restraint.u)     restrained.push(n.dofs[0]);
            if (n.restraint.v)     restrained.push(n.dofs[1]);
            if (n.restraint.theta) restrained.push(n.dofs[2]);
        }

        for (let i = 0; i < system.ndof; i++) {
            if (!restrained.includes(i)) {
                non_restrained.push(i);
            }
        }


        this.k_11 = subset(k, index(non_restrained, non_restrained));
        this.k_12 = subset(k, index(restrained, non_restrained));
        this.k_22 = subset(k, index(restrained, restrained));

        this.c_11 = subset(c, index(non_restrained, non_restrained));
        this.c_12 = subset(c, index(restrained, non_restrained));
        this.c_22 = subset(c, index(restrained, restrained));

        this.m_11 = subset(m, index(non_restrained, non_restrained));
        this.m_12 = subset(m, index(restrained, non_restrained));
        this.m_22 = subset(m, index(restrained, restrained));

        this.ndof_non_restrained = non_restrained.length;
        this.ndof_restrained = restrained.length;

        this.restrained = restrained;
        this.non_restrained = non_restrained;
    }


    isKinematic(threshold: number = 1e-9): boolean {
        return this.getKinematicModes(threshold).length > 0;
    }

    getKinematicModes(threshold: number = 1e-9): Matrix[] {
        if (this.ndof_non_restrained === 0) return [];

        return eigs(this.k_11).eigenvectors
            .filter(ev => Math.abs(ev.value as number) < threshold)
            .map(ev => ev.vector as Matrix);
    }

    solveKinematic(threshold: number = 1e-9): KinematicSolution {
        return new KinematicSolution(
            this.getKinematicModes(threshold),
            this.restrained,
            this.non_restrained
        );
    }

    solveDynamic(initialConditions: Matrix): DynamicSolution {
        if (this.ndof_non_restrained === 0) {
            return new DynamicSolution(
                matrix(zeros([0, 0])), matrix(zeros([0, 1])), matrix(zeros([0, 1])),
                this.restrained, this.non_restrained
            );
        }

        let m_inv = inv(this.m_11);

        let a11 = zeros([this.ndof_non_restrained, this.ndof_non_restrained]) as Matrix;
        let a12 = identity(this.ndof_non_restrained) as Matrix;
        let a21 = multiply(-1, multiply(m_inv, this.k_11));
        let a22 = multiply(-1, multiply(m_inv, this.c_11));

        let a = merge(a11, a12, a21, a22);

        let eigenVectors = getEigenvectors(a);
        let eigenValues = getEigenvalues(a);

        let coefficients = lusolve(eigenVectors, initialConditions);

        return new DynamicSolution(
            eigenVectors,
            eigenValues,
            coefficients,
            this.restrained,
            this.non_restrained
        );
    }
}
