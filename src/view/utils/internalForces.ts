import type { StructuralElement, StructuralNode } from '../../solver/StructuralSystem';
import { elementLocalState } from './elementLocalState';
import { elementDisplacementAt } from './deformedShape';

export interface ForcePoint { xi: number; N: number; V: number; M: number; }
export interface DispPoint  { x: number; u: number; v: number; }

/**
 * Returns N points of internal forces along a beam element.
 * Sign conventions:
 *   N > 0 = tension
 *   M > 0 = sagging (EI·d²v/dx², v = local transverse, positive upward)
 *   V = dM/dx (standard beam convention)
 *   Distributed load sign: positive q = downward = local −v (matches elementLocalState.ts and forceAssembly.ts)
 */
export function elementInternalForces(
    element: StructuralElement,
    ni: StructuralNode,
    nj: StructuralNode,
    getDof: (dof: number) => number,
    load?: { qi: number; qj: number; angle?: number },
    nPoints = 30,
): ForcePoint[] {
    if (Math.hypot(nj.x - ni.x, nj.z - ni.z) < 1e-10) return [];

    const {
        L, u_i, v_i, th_i, u_j, v_j, th_j,
        qi_trans, qj_trans, qi_axial, qj_axial,
    } = elementLocalState(element, ni, nj, getDof, load);

    const { ea, ei } = element;
    const N_val = ea > 0 ? (ea / L) * (u_j - u_i) : 0;

    const EIoL2 = ei / (L * L);
    const EIoL3 = ei / (L * L * L);
    // Homogeneous shear is constant (d³v_h/dξ³ is constant for cubic Hermite)
    const V_h = EIoL3 * (12 * v_i + 6 * L * th_i - 12 * v_j + 6 * L * th_j);

    const points: ForcePoint[] = [];
    for (let k = 0; k < nPoints; k++) {
        const xi  = k / (nPoints - 1);
        const xi2 = xi * xi;
        const xi3 = xi2 * xi;

        // M_h = EI/L² · d²v_h/dξ²  (N1''=−6+12ξ, N2''=−4+6ξ, N3''=6−12ξ, N4''=−2+6ξ)
        const M_h = EIoL2 * (
            (-6 + 12 * xi) * v_i + L * (-4 + 6 * xi) * th_i +
            ( 6 - 12 * xi) * v_j + L * (-2 + 6 * xi) * th_j
        );

        let M = M_h;
        let V = V_h;

        // Particular solution (fixed-fixed particular solution, same derivation as deformedShape.ts):
        //   M_p_uniform  = −qi_trans · L²/12 · (1 − 6ξ + 6ξ²)
        //   V_p_uniform  =  qi_trans · L/2   · (1 − 2ξ)
        //   M_p_triangle = −Δq_trans · L²    · (ξ³/6 − 3ξ/20 + 1/30)
        //   V_p_triangle = −Δq_trans · L     · (ξ²/2 − 3/20)
        if (load && ei > 0) {
            const L2 = L * L;
            M += -qi_trans * L2 / 12 * (1 - 6 * xi + 6 * xi2);
            V +=  qi_trans * L  / 2  * (1 - 2 * xi);
            const dq = qj_trans - qi_trans;
            if (dq !== 0) {
                M += -dq * L2 * (xi3 / 6 - 3 * xi / 20 + 1 / 30);
                V += -dq * L  * (xi2 / 2 - 3 / 20);
            }
        }

        let N = N_val;
        if (load && ea > 0) {
            // N_p(xi) = L * ( (2*q_a,i + q_a,j)/6 - q_a,i * xi - xi^2/2 * (q_a,j - q_a,i) )
            N += L * (
                (2 * qi_axial + qj_axial) / 6 -
                qi_axial * xi -
                (xi2 / 2) * (qj_axial - qi_axial)
            );
        }

        let cleanN = Math.abs(N) < 1e-9 ? 0 : N;
        let cleanV = Math.abs(V) < 1e-9 ? 0 : V;
        let cleanM = Math.abs(M) < 1e-9 ? 0 : M;

        points.push({ xi, N: cleanN, V: cleanV, M: cleanM });
    }
    return points;
}

/**
 * Local element displacements u(ξ) and v(ξ) at nPoints along the element.
 *
 * Uses the same displacement field as the drawn deformed shape, so the diagrams in the
 * sidebar and the curve in the viewer can never disagree.
 */
export function elementLocalDisplacements(
    element: StructuralElement,
    ni: StructuralNode,
    nj: StructuralNode,
    getDof: (dof: number) => number,
    load?: { qi: number; qj: number; angle?: number },
    nPoints = 30,
): DispPoint[] {
    const L = Math.hypot(nj.x - ni.x, nj.z - ni.z);
    if (L < 1e-10) return [];

    const points: DispPoint[] = [];
    for (let k = 0; k < nPoints; k++) {
        const xi = k / (nPoints - 1);
        const { u, v } = elementDisplacementAt(element, ni, nj, getDof, xi, load);

        points.push({
            x: xi * L,
            u: Math.abs(u) < 1e-9 ? 0 : u,
            v: Math.abs(v) < 1e-9 ? 0 : v,
        });
    }
    return points;
}