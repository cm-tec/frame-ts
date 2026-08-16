import { matrix, multiply, subtract, type Matrix } from "mathjs";
import { Polynomial } from "./Polynomial";
import { condenseReleases, get_rotation_matrix_of_element, k_element } from "./elementMatrices";
import { condenseElementLoad, equivalentNodalLoad } from "./forceAssembly";
import type { StructuralLoads } from "./StructuralLoads";
import type { StructuralElement } from "./StructuralSystem";

export type ElementForceField = {
    N: Polynomial;
    V: Polynomial;
    M: Polynomial;
};

// The internal forces along one element, as polynomials in xi.
//     dN/dx = -q_axial,   dV/dx = q_trans,   dM/dx = V
export function elementForceField(
    element: StructuralElement,
    loads: StructuralLoads,
    getDof: (dof: number) => number,
): ElementForceField {
    const { q_trans, q_axial } = loads.ofElement(element.id);
    const s = memberEndForces(element, q_trans, q_axial, getDof);

    const N = Polynomial.constant(-s[0]).plus(q_axial.antiderivative().scaled(-element.L));
    const V = Polynomial.constant(s[1]).plus(q_trans.antiderivative().scaled(element.L));
    const M = Polynomial.constant(-s[2]).plus(V.antiderivative().scaled(element.L));

    return { N, V, M };
}

// Forces the nodes apply to the element, in local DOF directions:
//
//     s = k * w_local - f_equivalent
function memberEndForces(
    element: StructuralElement,
    q_trans: Polynomial,
    q_axial: Polynomial,
    getDof: (dof: number) => number,
): number[] {
    const w_local = localDisplacements(element, getDof);

    const k_e = k_element(element.ea, element.ei, element.L);

    const k = condenseReleases(k_e, k_e, element.releases_i, element.releases_j);
    const f = condenseElementLoad(element, equivalentNodalLoad(element, q_trans, q_axial));

    const s = subtract(multiply(k, w_local), f) as Matrix;

    return [0, 1, 2, 3, 4, 5].map(i => s.get([i, 0]));
}

// The element's end displacements in its own frame: [u_i, v_i, phi_i, u_j, v_j, phi_j].
export function localDisplacements(element: StructuralElement, getDof: (dof: number) => number): Matrix {
    const R = get_rotation_matrix_of_element(element.angle, element.n_i.angle, element.n_j.angle);
    const w_global = matrix(element.dofs.map(dof => [getDof(dof)])) as Matrix;

    return multiply(R, w_global) as Matrix;
}
