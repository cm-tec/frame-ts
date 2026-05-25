import type { StructuralElement, StructuralNode } from '../../solver/StructuralSystem';

export interface ForcePoint { xi: number; N: number; V: number; M: number; }
export interface DispPoint  { x: number; u: number; v: number; }

/**
 * Returns N points of internal forces along a beam element.
 * Sign conventions:
 *   N > 0 = tension
 *   M > 0 = sagging (EI·d²v/dx², v = local transverse, positive upward)
 *   V = dM/dx (standard beam convention)
 *   Distributed load sign: positive q = downward = local −v (matches deformedShape.ts and StaticVisualization load assembly)
 */
export function elementInternalForces(
    element: StructuralElement,
    ni: StructuralNode,
    nj: StructuralNode,
    getDof: (dof: number) => number,
    load?: { qi: number; qj: number },
    nPoints = 30,
): ForcePoint[] {
    const dx = nj.x - ni.x;
    const dz = nj.z - ni.z;
    const L = Math.hypot(dx, dz);
    if (L < 1e-10) return [];

    const thetaE = Math.atan2(dz, dx);
    const w = element.dofs.map(d => getDof(d));

    const theta_i = thetaE - ni.angle;
    const ci = Math.cos(theta_i), si = Math.sin(theta_i);
    const theta_j = thetaE - nj.angle;
    const cj = Math.cos(theta_j), sj = Math.sin(theta_j);

    const u_i  =  ci * w[0] + si * w[1];
    const v_i  = -si * w[0] + ci * w[1];
    const th_i =  w[2];
    const u_j  =  cj * w[3] + sj * w[4];
    const v_j  = -sj * w[3] + cj * w[4];
    const th_j =  w[5];

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
        //   M_p_uniform  = −qi · L²/12 · (1 − 6ξ + 6ξ²)
        //   V_p_uniform  =  qi · L/2   · (1 − 2ξ)
        //   M_p_triangle = −Δq · L²    · (ξ³/6 − 3ξ/20 + 1/30)
        //   V_p_triangle = −Δq · L     · (ξ²/2 − 3/20)
        if (load && ei > 0) {
            const { qi, qj } = load;
            const L2 = L * L;
            M += -qi * L2 / 12 * (1 - 6 * xi + 6 * xi2);
            V +=  qi * L  / 2  * (1 - 2 * xi);
            const dq = qj - qi;
            if (dq !== 0) {
                M += -dq * L2 * (xi3 / 6 - 3 * xi / 20 + 1 / 30);
                V += -dq * L  * (xi2 / 2 - 3 / 20);
            }
        }

        points.push({ xi, N: N_val, V, M });
    }
    return points;
}

/** Local element displacements u(ξ) and v(ξ) at nPoints along the element. */
export function elementLocalDisplacements(
    element: StructuralElement,
    ni: StructuralNode,
    nj: StructuralNode,
    getDof: (dof: number) => number,
    load?: { qi: number; qj: number },
    nPoints = 30,
): DispPoint[] {
    const dx = nj.x - ni.x;
    const dz = nj.z - ni.z;
    const L = Math.hypot(dx, dz);
    if (L < 1e-10) return [];

    const thetaE = Math.atan2(dz, dx);
    const w = element.dofs.map(d => getDof(d));

    const theta_i = thetaE - ni.angle;
    const ci = Math.cos(theta_i), si = Math.sin(theta_i);
    const theta_j = thetaE - nj.angle;
    const cj = Math.cos(theta_j), sj = Math.sin(theta_j);

    const u_i  =  ci * w[0] + si * w[1];
    const v_i  = -si * w[0] + ci * w[1];
    const th_i =  w[2];
    const u_j  =  cj * w[3] + sj * w[4];
    const v_j  = -sj * w[3] + cj * w[4];
    const th_j =  w[5];

    const L4overEI = (load && element.ei > 0) ? (L * L * L * L) / element.ei : 0;

    const points: DispPoint[] = [];
    for (let k = 0; k < nPoints; k++) {
        const xi  = k / (nPoints - 1);
        const xi2 = xi * xi;
        const xi3 = xi2 * xi;

        const u_val = (1 - xi) * u_i + xi * u_j;

        const N1 = 1 - 3 * xi2 + 2 * xi3;
        const N2 = xi - 2 * xi2 + xi3;
        const N3 = 3 * xi2 - 2 * xi3;
        const N4 = -xi2 + xi3;
        let v_val = N1 * v_i + N2 * L * th_i + N3 * v_j + N4 * L * th_j;

        if (load && L4overEI !== 0) {
            const { qi, qj } = load;
            const one_minus_xi = 1 - xi;
            v_val -= qi * xi2 * one_minus_xi * one_minus_xi * L4overEI / 24;
            const dq = qj - qi;
            if (dq !== 0) v_val -= dq * L4overEI * (xi2 * xi3 / 120 - xi3 / 40 + xi2 / 60);
        }

        points.push({ x: xi * L, u: u_val, v: v_val });
    }
    return points;
}