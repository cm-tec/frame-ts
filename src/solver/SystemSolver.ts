import { add, eigs, atan2, hypot, identity, index, inv, lusolve, matrix, multiply, rotationMatrix, subset, transpose, zeros, type Matrix } from "mathjs";
import { merge, getEigenvalues, getEigenvectors } from "./utils";
import type { StructuralSystem } from "./StructuralSystem";
import { DynamicSolution } from "./DynamicSolution";
import { KinematicSolution } from "./KinematicSolution";
import { StaticSolution } from "./StaticSolution";


function get_rotation_matrix_of_element(v: [number, number]) {
    const dx = v[0];
    const dz = v[1];

    const theta = atan2(dz, dx);
    const t = transpose(rotationMatrix(theta)) as math.Matrix;

    const T_e = identity(4) as math.Matrix;

    T_e.subset(index([0, 1], [0, 1]), t);
    T_e.subset(index([2, 3], [2, 3]), t);

    return T_e;
}


function k_element(EA: number, l: number) {
    const k_axial = multiply(EA / l, matrix(
        [
            [1, 0, -1, 0],
            [0, 0, 0, 0],
            [-1, 0, 1, 0],
            [0, 0, 0, 0],
        ]
    ));

    return k_axial;
}

function c_element(c: number) {
    return matrix(
        [
            [c, 0, -c, 0],
            [0, 0, 0, 0],
            [-c, 0, c, 0],
            [0, 0, 0, 0],
        ]
    )
}


export class SystemSolver {
    ndof_restrained: number;
    ndof_non_restrained: number;

    restrained: number[];
    non_restrained: number[];

    m_11: Matrix;
    m_12: Matrix;
    m_22: Matrix;

    c_11: Matrix;
    c_12: Matrix;
    c_22: Matrix;

    k_11: Matrix;
    k_12: Matrix;
    k_22: Matrix;

    constructor(system: StructuralSystem) {
        let k = matrix(zeros(system.ndofs, system.ndofs));
        let c = matrix(zeros(system.ndofs, system.ndofs));
        let m = matrix(zeros(system.ndofs, system.ndofs));

        let restrained: number[] = [];
        let non_restrained: number[] = [];


        const expand_matrix = (m: Matrix, indices: number[]) => {
            let T = matrix(zeros([indices.length, system.ndofs]))

            indices.forEach((idx, i) => {
                T.set([i, idx], 1);
            });

            return multiply(transpose(T), multiply(m, T));
        }


        for (const e of system.elements) {
            let n_i = system.nodes.find(n => n.id === e.node_i)!;
            let n_j = system.nodes.find(n => n.id === e.node_j)!;

            const R_e = get_rotation_matrix_of_element([n_j.x - n_i.x, n_j.z - n_i.z])
            const R_e_T = transpose(R_e);

            const l = hypot(n_j.x - n_i.x, n_j.z - n_i.z);

            const k_e = multiply(R_e_T, multiply(k_element(e.ea, l), R_e));
            const c_e = multiply(R_e_T, multiply(c_element(e.c), R_e));

            k = add(k, expand_matrix(k_e, [e.u_i_dof, e.v_i_dof, e.u_j_dof, e.v_j_dof]));

            c = add(c, expand_matrix(c_e, [e.u_i_dof, e.v_i_dof, e.u_j_dof, e.v_j_dof]));
        }

        for (const n of system.nodes) {
            m.set([n.u_dof, n.u_dof], n.mass);
            m.set([n.v_dof, n.v_dof], n.mass);

            if (n.restrained_u) {
                restrained.push(n.u_dof);
            }

            if (n.restrained_v) {
                restrained.push(n.v_dof);
            }
        }

        for (let i = 0; i < system.ndofs; i++) {
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


    solveDynamic(initialConditions: Matrix): DynamicSolution {
        if (this.ndof_non_restrained === 0) {
            return new DynamicSolution(
                matrix(zeros([0, 0])),
                matrix(zeros([0, 1])),
                matrix(zeros([0, 1])),
                this.restrained,
                this.non_restrained
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
            coefficients as Matrix,
            this.restrained,
            this.non_restrained
        );
    }

    // forces: (ndofs × 1) global force vector, indexed by DOF number
    solveStatic(forces: Matrix): StaticSolution {
        if (this.ndof_non_restrained === 0) {
            return new StaticSolution(
                matrix(zeros([0, 1])),
                matrix(zeros([this.ndof_restrained, 1])),
                this.restrained,
                this.non_restrained
            );
        }

        const f_1 = subset(forces, index(this.non_restrained, [0])) as Matrix;

        const u_1 = lusolve(this.k_11, f_1) as Matrix;

        const r = multiply(this.k_12, u_1) as Matrix;

        return new StaticSolution(u_1, r, this.restrained, this.non_restrained);
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
}
