import { dotMultiply, exp, map, multiply, range, re, row, subset, index, zeros, matrix, type Matrix } from "mathjs";

export class DynamicSolution {
    readonly NDOF: number;
    readonly eigenVectors: Matrix;
    readonly eigenValues: Matrix;
    readonly coefficients: Matrix;
    readonly restrained: number[];
    readonly non_restrained: number[];

    constructor(
        eigenVectors: Matrix,
        eigenValues: Matrix,
        coefficients: Matrix,
        restrained: number[],
        non_restrained: number[]
    ) {
        this.NDOF = eigenVectors.size()[0] / 2;
        this.eigenVectors = eigenVectors;
        this.eigenValues = eigenValues;
        this.coefficients = coefficients;
        this.restrained = restrained;
        this.non_restrained = non_restrained;
    }

    get_w(dof: number, t: number): number {
        if (this.restrained.includes(dof)) return 0;
        const i = this.non_restrained.indexOf(dof);

        const e = map(multiply(this.eigenValues, t), exp);
        const ec = dotMultiply(this.coefficients, e);

        return multiply(row(this.eigenVectors, i), ec)
            .map((v, _) => re(v) as unknown as number)
            .get([0, 0]);
    }

    get_dw(dof: number, t: number): number {
        if (this.restrained.includes(dof)) return 0;
        const i = this.NDOF + this.non_restrained.indexOf(dof);

        const e = map(multiply(this.eigenValues, t), exp);
        const ec = dotMultiply(this.coefficients, e);

        return multiply(row(this.eigenVectors, i), ec)
            .map((v, _) => re(v) as unknown as number)
            .get([0, 0]);
    }

    get_w_history(dof: number, t0: number = 0, N: number = 1000, T: number = 10): Matrix {
        const dt = T / N;
        const w = matrix(zeros([2, N]));
        for (let n = 0; n < N; n++) {
            const t = t0 + n * dt;
            w.set([0, n], t);
            w.set([1, n], this.get_w(dof, t));
        }
        return w;
    }

    get_dw_history(dof: number, t0: number = 0, N: number = 1000, T: number = 10): Matrix {
        const dt = T / N;
        const w = matrix(zeros([2, N]));
        for (let n = 0; n < N; n++) {
            const t = t0 + n * dt;
            w.set([0, n], t);
            w.set([1, n], this.get_dw(dof, t));
        }
        return w;
    }

    get_w_total(t: number): Matrix {
        const e = map(multiply(this.eigenValues, t), exp);
        const ec = dotMultiply(this.coefficients, e);
        return multiply(this.eigenVectors, ec).map((v, _) => re(v) as unknown as number);
    }

    get_w_total_of_eigenmode(eigenmode: number, t: number): Matrix {
        if (eigenmode < 0 || eigenmode >= this.eigenValues.size()[0])
            throw new Error(`Eigenmode ${eigenmode} out of range`);

        const lambda = this.eigenValues.get([eigenmode, 0]);
        const eigenvector = subset(this.eigenVectors, index(range(0, this.NDOF * 2), eigenmode));
        const e = exp(multiply(lambda, t) as any);

        return multiply(eigenvector, e).map((v, _) => re(v) as unknown as number);
    }
}
