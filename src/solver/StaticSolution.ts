import { type Matrix } from "mathjs";


export class StaticSolution {
    private readonly w_non_restrained: Matrix;
    private readonly r_restrained: Matrix;
    readonly restrained: number[];
    readonly non_restrained: number[];

    constructor(
        w_non_restrained: Matrix,       // (N × 1) displacements at non-restrained DOFs
        r_restrained: Matrix, // (M × 1) reactions at restrained DOFs
        restrained: number[],
        non_restrained: number[]
    ) {
        this.w_non_restrained = w_non_restrained;
        this.r_restrained = r_restrained;
        this.restrained = restrained;
        this.non_restrained = non_restrained;
    }

    get_w(dof: number): number {
        if (this.restrained.includes(dof)) return 0;

        const i = this.non_restrained.indexOf(dof);
        return this.w_non_restrained.get([i, 0]);
    }

    get_r(dof: number): number {
        if (this.non_restrained.includes(dof)) return 0;

        const i = this.restrained.indexOf(dof);
        return this.r_restrained.get([i, 0]);
    }

}
