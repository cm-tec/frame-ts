import { add, all, atan2, complex, create, dot, dotMultiply, equal, exp, identity, index, inv, lusolve, map, matrix, multiply, phi, range, rotationMatrix, row, subset, transpose, zeros, type MathJsInstance, type Matrix } from "mathjs";
import { assert } from "vitest";
import { merge, getEigenvalues, getEigenvectors } from "./utils";
import type { StructuralSystem } from "./StructuralSystem";


function get_rotation_matrix_of_element(v: [number, number]) {
    const dx = v[0];
    const dz = v[1];

    const theta = atan2(dz, dx);
    const t = rotationMatrix(theta) as math.Matrix;

    const T_e = identity(6) as math.Matrix;

    T_e.subset(index([0, 1], [0, 1]), t);
    T_e.subset(index([3, 4], [3, 4]), t);

    return T_e;
}


function k_element(EA: number = 1, EI: number = 1, l: number = 1) {
    const k_axial = multiply(EA / l, matrix(
        [
            [1, 0, 0, -1, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [-1, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ]
    ));

    const k_flexural = multiply(2 * EI / l ** 3, matrix(
        [
            [0, 0, 0, 0, 0, 0],
            [0, 6, -3 * l, 0, -6, -3 * l],
            [0, -3 * l, 2 * l ** 2, 0, 3 * l, l ** 2],
            [0, 0, 0, 0, 0, 0],
            [0, -6, 3 * l, 0, 6, 3 * l],
            [0, -3 * l, l ** 2, 0, 3 * l, 2 * l ** 2],
        ]
    ));

    return add(k_axial, k_flexural);
}

function c_element(c: number) {
    return matrix(
        [
            [c, 0, 0, -c, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [-c, 0, 0, c, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ]
    )
}



export class SystemSolver {
    NDOF: number;

    m: Matrix;
    c: Matrix;
    k: Matrix;

    f: Matrix;
    initialConditions: Matrix;

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
            let n_i = system.nodes.find(n => n.id = e.node_i)!;
            let n_j = system.nodes.find(n => n.id = e.node_j)!;

            const R_e = get_rotation_matrix_of_element([n_j.x - n_i.x, n_j.z - n_i.z])
            const R_e_T = transpose(R_e);
            const k_e = multiply(R_e_T, multiply(k_element(), R_e));

            k = add(k, expand_matrix(k_e, [e.u_i_dof, e.v_i_dof, e.phi_i_dof, e.u_j_dof, e.v_j_dof, e.phi_j_dof]));

            c = add(c, expand_matrix(c_element(e.c), [e.u_i_dof, e.v_i_dof, e.phi_i_dof, e.u_j_dof, e.v_j_dof, e.phi_j_dof]));
        }

        for (const n of system.nodes) {
            subset(m, index(n.u_dof, n.u_dof), n.mass);
            subset(m, index(n.v_dof, n.v_dof), n.mass);

            if (n.restrained_u) {
                restrained.push(n.u_dof);
            }

            if (n.restrained_v) {
                restrained.push(n.v_dof);
            }

            if (n.restrained_phi) {
                restrained.push(n.phi_dof);
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

        console.log(k);
        console.log(this.k_11);


        this.NDOF = 2; //non_restrained.length;

        let m1 = 80.0;
        let m2 = 8.0;
        let k1 = 200.0;
        let k2 = 125.0;
        let c1 = 0.0;
        let c2 = 0.6;

        this.m = matrix([
            [m1, 0],
            [0, m2]
        ]);

        this.c = matrix([
            [c1, -c1],
            [-c1, c1 + c2]
        ]);

        this.k = matrix([
            [k1, -k1],
            [-k1, k1 + k2]
        ])

        this.f = zeros([this.NDOF, 1]) as Matrix;

        this.initialConditions = matrix([
            [complex(-1, 0)],
            [complex(1, 0)],
            [0],
            [0]
        ]);
    }



    solve(): SystemSolution {
        let m_inv = inv(this.m);

        let a11 = zeros([this.NDOF, this.NDOF]) as Matrix;
        let a12 = identity(this.NDOF) as Matrix;
        let a21 = multiply(-1, multiply(m_inv, this.k));
        let a22 = multiply(-1, multiply(m_inv, this.c));

        let a = merge(a11, a12, a21, a22);

        let eigenVectors = getEigenvectors(a);
        let eigenValues = getEigenvalues(a);

        let coefficients = lusolve(eigenVectors, this.initialConditions);

        return new SystemSolution(eigenVectors, eigenValues, coefficients);
    }
}


export class SystemSolution {
    NDOF: number;

    eigenVectors: Matrix;
    eigenValues: Matrix;

    coefficients: Matrix;


    constructor(eigenVectors: Matrix, eigenValues: Matrix, coefficients: Matrix) {
        assert(equal(eigenValues.size(), coefficients.size()))


        this.NDOF = eigenVectors.size().at(0)! / 2;

        this.eigenVectors = eigenVectors;
        this.eigenValues = eigenValues;

        this.coefficients = coefficients;
    }

    // Get the displacement of a dof over time
    get_w_history(dof: number, N: number = 1000, T: number = 10): Matrix {
        let dt = T / N;
        let w = matrix(zeros([2, N]));

        let t = 0;

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
        let e = map(multiply(this.eigenValues, t), exp);
        let ec = dotMultiply(this.coefficients, e);

        return multiply(row(this.eigenVectors, dof), ec).map((v, _) => v.re).get([0, 0])
    }
}