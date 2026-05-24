import type { Matrix } from "mathjs";

export class KinematicSolution {
    readonly modes: Matrix[];
    readonly restrained: number[];
    readonly non_restrained: number[];

    constructor(modes: Matrix[], restrained: number[], non_restrained: number[]) {
        this.modes = modes;
        this.restrained = restrained;
        this.non_restrained = non_restrained;
    }

    get_w(modeIndex: number, dof: number): number {
        if (this.restrained.includes(dof)) return 0;
        const i = this.non_restrained.indexOf(dof);
        if (i < 0) throw new Error(`DOF ${dof} not found in non-restrained DOFs`);
        return this.modes[modeIndex].get([i]);
    }
}
