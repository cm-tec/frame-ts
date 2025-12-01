import { all, complex, create, dotMultiply, equal, exp, identity, index, inv, lusolve, map, matrix, multiply, range, row, subset, zeros, type MathJsInstance, type Matrix } from "mathjs";
import { assert } from "vitest";
import { merge, getEigenvalues, getEigenvectors } from "./utils";


export class SystemSolver {
    NDOF: number;

    m: Matrix;
    c: Matrix;
    k: Matrix;

    f: Matrix;
    initialConditions: Matrix;

    constructor() {
        this.NDOF = 2;

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