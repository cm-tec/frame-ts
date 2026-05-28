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
    load?: { qi: number; qj: number; angle?: number },
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

    const rad = (load && load.angle !== undefined) ? (load.angle * Math.PI) / 180 : 0;
    let cosVal = Math.cos(rad);
    let sinVal = Math.sin(rad);
    if (Math.abs(cosVal) < 1e-12) cosVal = 0;
    if (Math.abs(sinVal) < 1e-12) sinVal = 0;

    const qi_trans = load ? load.qi * cosVal : 0;
    const qj_trans = load ? load.qj * cosVal : 0;
    const qi_axial = load ? load.qi * sinVal : 0;
    const qj_axial = load ? load.qj * sinVal : 0;

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

/** Local element displacements u(ξ) and v(ξ) at nPoints along the element. */
export function elementLocalDisplacements(
    element: StructuralElement,
    ni: StructuralNode,
    nj: StructuralNode,
    getDof: (dof: number) => number,
    load?: { qi: number; qj: number; angle?: number },
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

        let u_val = (1 - xi) * u_i + xi * u_j;
        if (load && element.ea > 0) {
            const rad = (load.angle !== undefined) ? (load.angle * Math.PI) / 180 : 0;
            let sinVal = Math.sin(rad);
            if (Math.abs(sinVal) < 1e-12) sinVal = 0;
            const qi_axial = load.qi * sinVal;
            const qj_axial = load.qj * sinVal;
            u_val += (L * L / (6 * element.ea)) * (
                (2 * qi_axial + qj_axial) * xi - 3 * qi_axial * xi2 - (qj_axial - qi_axial) * xi3
            );
        }

        const N1 = 1 - 3 * xi2 + 2 * xi3;
        const N2 = xi - 2 * xi2 + xi3;
        const N3 = 3 * xi2 - 2 * xi3;
        const N4 = -xi2 + xi3;
        let v_val = N1 * v_i + N2 * L * th_i + N3 * v_j + N4 * L * th_j;

        if (load && L4overEI !== 0) {
            const rad = (load.angle !== undefined) ? (load.angle * Math.PI) / 180 : 0;
            let cosVal = Math.cos(rad);
            if (Math.abs(cosVal) < 1e-12) cosVal = 0;
            const qi_trans = load.qi * cosVal;
            const qj_trans = load.qj * cosVal;
            const one_minus_xi = 1 - xi;
            v_val -= qi_trans * xi2 * one_minus_xi * one_minus_xi * L4overEI / 24;
            const dq = qj_trans - qi_trans;
            if (dq !== 0) v_val -= dq * L4overEI * (xi2 * xi3 / 120 - xi3 / 40 + xi2 / 60);
        }

        let cleanU = Math.abs(u_val) < 1e-9 ? 0 : u_val;
        let cleanV = Math.abs(v_val) < 1e-9 ? 0 : v_val;

        points.push({ x: xi * L, u: cleanU, v: cleanV });
    }
    return points;
}