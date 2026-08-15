import { Polynomial } from "./Polynomial";
import { elementForceField, localDisplacements } from "./internalForces";
import type { StructuralLoads } from "./StructuralLoads";
import type { StructuralElement } from "./StructuralSystem";

export type ElementDisplacementField = {
    /** Along the element axis i->j. */
    u: Polynomial;
    /** Perpendicular to it, 90 degrees CCW. */
    v: Polynomial;
};

// The displaced shape of one element, in its own frame, as polynomials in xi.
//
// Integrated from the internal forces rather than interpolated:
//
//     u' = N/EA        once,  fixed by u(0) = u_i
//     v'' = M/EI       twice, fixed by v(0) = v_i and v(1) = v_j
export function elementDisplacementField(
    element: StructuralElement,
    loads: StructuralLoads,
    getDof: (dof: number) => number,
): ElementDisplacementField {
    const L = element.L;
    const w = localDisplacements(element, getDof);

    const u_i = w.get([0, 0]);
    const v_i = w.get([1, 0]);
    const u_j = w.get([3, 0]);
    const v_j = w.get([4, 0]);

    const { N, M } = elementForceField(element, loads, getDof);

    return {
        u: element.ea > 0
            ? N.scaled(L / element.ea).antiderivative().plus(Polynomial.constant(u_i))
            : new Polynomial([u_i, u_j - u_i]),
        v: element.ei > 0
            ? bendingShape(M.scaled(L * L / element.ei), v_i, v_j)
            : new Polynomial([v_i, v_j - v_i]),
    };
}

function bendingShape(curvature: Polynomial, v_i: number, v_j: number): Polynomial {
    const particular = curvature.antiderivative().antiderivative();
    const slope = v_j - v_i - particular.at(1);

    return particular.plus(new Polynomial([v_i, slope]));
}
