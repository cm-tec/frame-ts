import { add, eigs, atan2, dotMultiply, equal, exp, hypot, identity, index, inv, lusolve, map, matrix, multiply, range, rotationMatrix, row, subset, transpose, zeros, type Matrix } from "mathjs";
import { assert } from "vitest";
import { merge, getEigenvalues, getEigenvectors } from "./utils";
import type { StructuralSystem } from "./StructuralSystem";


function get_rotation_matrix_of_element(v: [number, number]) {
    const dx = v[0];
    const dz = v[1];

    const theta = atan2(dz, dx);
    const t = rotationMatrix(theta) as math.Matrix;

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

    f_1: Matrix;
    f_2: Matrix;

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

        this.f_1 = matrix(zeros([non_restrained.length, 1]));
        this.f_2 = matrix(zeros([restrained.length, 1]));

        this.ndof_non_restrained = non_restrained.length;
        this.ndof_restrained = restrained.length;

        this.restrained = restrained;
        this.non_restrained = non_restrained;
    }



    solve(initialConditions: Matrix): SystemSolution {
        let m_inv = inv(this.m_11);

        let a11 = zeros([this.ndof_non_restrained, this.ndof_non_restrained]) as Matrix;
        let a12 = identity(this.ndof_non_restrained) as Matrix;
        let a21 = multiply(-1, multiply(m_inv, this.k_11));
        let a22 = multiply(-1, multiply(m_inv, this.c_11));

        let a = merge(a11, a12, a21, a22);

        let eigenVectors = getEigenvectors(a);
        let eigenValues = getEigenvalues(a);

        let coefficients = lusolve(eigenVectors, initialConditions);

        return new SystemSolution(
            eigenVectors,
            eigenValues,
            coefficients,
            this.restrained,
            this.non_restrained
        );
    }

    isKinematic(threshold: number = 1e-9): boolean {
        return this.getKinematicModes(threshold).length > 0;
    }

    getKinematicModes(threshold: number = 1e-9): Matrix[] {
        return eigs(this.k_11).eigenvectors
            .filter(ev => Math.abs(ev.value as number) < threshold)
            .map(ev => ev.vector as Matrix);
    }

    solveKinematic(threshold: number = 1e-9): KinematicSystemSolution {
        return new KinematicSystemSolution(
            this.getKinematicModes(threshold),
            this.restrained,
            this.non_restrained
        );
    }
}


export class KinematicSystemSolution {
    NDOF: number;
    modes: Matrix[];
    restrained: number[];
    non_restrained: number[];

    constructor(modes: Matrix[], restrained: number[], non_restrained: number[]) {
        this.modes = modes;
        this.restrained = restrained;
        this.non_restrained = non_restrained;
        this.NDOF = non_restrained.length;
    }

    get_w(modeIndex: number, dof: number): number {
        if (this.restrained.includes(dof)) return 0;

        const i = this.non_restrained.indexOf(dof);

        if (i < 0) throw Error();

        return this.modes[modeIndex].get([i]);
    }
}


export class SystemSolution {
    NDOF: number;

    eigenVectors: Matrix;
    eigenValues: Matrix;

    coefficients: Matrix;

    restrained: number[];
    non_restrained: number[];

    constructor(
        eigenVectors: Matrix,
        eigenValues: Matrix,
        coefficients: Matrix,
        restrained: number[],
        non_restrained: number[]
    ) {
        assert(equal(eigenValues.size(), coefficients.size()))


        this.NDOF = eigenVectors.size().at(0)! / 2;

        this.eigenVectors = eigenVectors;
        this.eigenValues = eigenValues;

        this.coefficients = coefficients;

        this.restrained = restrained;
        this.non_restrained = non_restrained;
    }

    // Get the displacement of a dof over time
    get_w_history(dof: number, t0: number = 0, N: number = 1000, T: number = 10): Matrix {

        let dt = T / N;
        let w = matrix(zeros([2, N]));

        let t = t0;

        for (let n = 0; n < N; n++) {
            t = n * dt
            w.set([0, n], t);
            w.set([1, n], this.get_w(dof, t));
        }
        return w;
    }

    // Get the displacements of all dofs at certain time t
    get_w_total(t: number): Matrix {
        let e = map(multiply(this.eigenValues, t), exp);

        let ec = dotMultiply(this.coefficients, e);

        return multiply(this.eigenVectors, ec).map((v, _) => v.re)
    }

    // Get the displacement of a specific dof at certain time t
    get_w(dof: number, t: number): number {
        if (this.restrained.includes(dof)) {
            return 0;
        }
        let i = this.non_restrained.indexOf(dof);

        let e = map(multiply(this.eigenValues, t), exp);
        let ec = dotMultiply(this.coefficients, e);

        //console.log(multiply(row(this.eigenVectors, i), ec).map((v, _) => v.re));

        return multiply(row(this.eigenVectors, i), ec).map((v, _) => v.re).get([0, 0])
    }

    get_dw(dof: number, t: number): number {
        if (this.restrained.includes(dof)) {
            return 0;
        }
        let i = this.NDOF + this.non_restrained.indexOf(dof);

        let e = map(multiply(this.eigenValues, t), exp);
        let ec = dotMultiply(this.coefficients, e);

        //console.log(multiply(row(this.eigenVectors, i), ec).map((v, _) => v.re));

        return multiply(row(this.eigenVectors, i), ec).map((v, _) => v.re).get([0, 0])
    }

    // Get the displacement of a dof over time
    get_dw_history(dof: number, t0: number = 0, N: number = 1000, T: number = 10): Matrix {

        let dt = T / N;
        let w = matrix(zeros([2, N]));

        let t = t0;

        for (let n = 0; n < N; n++) {
            t = n * dt
            w.set([0, n], t);
            w.set([1, n], this.get_dw(dof, t));
        }
        return w;
    }

    // Get the displacements of all dofs for eigenmode n at certain time t
    get_w_total_of_eigenmode(eigenmode: number, t: number): Matrix {
        if (eigenmode < 0 || eigenmode >= this.eigenValues.size()[0])
            throw new Error(`Eigenmode ${eigenmode} out of range`);

        const lambda = this.eigenValues.get([eigenmode, 0]);

        const eigenvector = subset(this.eigenVectors, index(range(0, this.NDOF * 2), eigenmode))

        const e = exp(multiply(lambda, t) as any);

        return multiply(eigenvector, e).map((v, _) => v.re)
    }

}