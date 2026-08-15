import { add, eigs, identity, index, inv, lusolve, matrix, multiply, subset, subtract, transpose, zeros, type Matrix } from "mathjs";
import { merge, getEigenvalues, getEigenvectors } from "./utils";
import { applyStaticCondensation, c_element, get_rotation_matrix_of_element, k_element } from "./elementMatrices";
import type { StructuralSystem } from "./StructuralSystem";
import { KinematicSolution } from "./KinematicSolution";
import { DynamicSolution } from "./DynamicSolution";
import { StaticSolution } from "./StaticSolution";


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
            let n_i = e.n_i;
            let n_j = e.n_j;

            let k_e = k_element(e.ea, e.ei, e.L);
            let c_e = c_element(e.c);

            k_e = applyStaticCondensation(k_e, e.releases_i, e.releases_j);
            c_e = applyStaticCondensation(c_e, e.releases_i, e.releases_j);

            const R_e = get_rotation_matrix_of_element(
                e.angle,
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

    solveStatic(force: Matrix): StaticSolution {
        const column = (dofs: number[]) => matrix(dofs.map(dof => [force.get([dof, 0])])) as Matrix;

        const w_non_restrained = this.ndof_non_restrained === 0
            ? matrix(zeros([0, 1])) as Matrix
            : lusolve(this.k_11, column(this.non_restrained)) as Matrix;

        const k_w = this.ndof_non_restrained === 0
            ? matrix(zeros([this.ndof_restrained, 1])) as Matrix
            : multiply(this.k_12, w_non_restrained) as Matrix;

        const r_restrained = this.ndof_restrained === 0
            ? matrix(zeros([0, 1])) as Matrix
            : subtract(k_w, column(this.restrained)) as Matrix;

        return new StaticSolution(
            w_non_restrained,
            r_restrained,
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
