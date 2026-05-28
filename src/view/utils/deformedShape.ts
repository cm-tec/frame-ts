import type { StructuralElement, StructuralNode } from '../../solver/StructuralSystem';

const N_CURVE_POINTS = 20;

/**
 * Returns the physically correct local displacement {u, v} of a beam element
 * at parametric coordinate ξ ∈ [0, 1], using cubic Hermite interpolation of
 * the nodal DOFs plus an analytical particular solution for any distributed load.
 *
 * Sign conventions (must match StaticVisualization load assembly):
 *   - Local u  : along element axis from node_i to node_j
 *   - Local v  : 90° CCW from local u (the "top" of the beam)
 *   - Positive q means downward (= local −v direction)
 *
 * Returns unscaled physical displacements — multiply by scale in the caller.
 */
export function elementDisplacementAt(
    element: StructuralElement,
    ni: StructuralNode,
    nj: StructuralNode,
    get_w: (dof: number) => number,
    xi: number,
    load?: { qi: number; qj: number; angle?: number },
): { u: number; v: number } {
    const dx = nj.x - ni.x;
    const dz = nj.z - ni.z;
    const L = Math.hypot(dx, dz);

    const thetaE = Math.atan2(dz, dx);

    const w = element.dofs.map(d => get_w(d));

    const theta_i = thetaE - ni.angle;
    const ci = Math.cos(theta_i), si = Math.sin(theta_i);
    const theta_j = thetaE - nj.angle;
    const cj = Math.cos(theta_j), sj = Math.sin(theta_j);

    const u_i  =  ci * w[0] + si * w[1];
    const v_i  = -si * w[0] + ci * w[1];
    let th_i =  w[2];
    const u_j  =  cj * w[3] + sj * w[4];
    const v_j  = -sj * w[3] + cj * w[4];
    let th_j =  w[5];

    // Project load to local coordinate system components
    const rad = (load && load.angle !== undefined) ? (load.angle * Math.PI) / 180 : 0;
    let cosVal = Math.cos(rad);
    let sinVal = Math.sin(rad);
    if (Math.abs(cosVal) < 1e-12) cosVal = 0;
    if (Math.abs(sinVal) < 1e-12) sinVal = 0;
    const qi_trans = load ? load.qi * cosVal : 0;
    const qj_trans = load ? load.qj * cosVal : 0;
    const qi_axial = load ? load.qi * sinVal : 0;
    const qj_axial = load ? load.qj * sinVal : 0;

    // Static condensation means the solver gives node rotations, not element end
    // rotations at hinged ends. Back-calculate true end slopes from M = 0.
    //
    // Beam stiffness: M_i = (EI/L)[4φᵢ + 2φⱼ − 6(vⱼ−vᵢ)/L] + M_i^FEM = 0
    // Fixed-end moments (positive q downward, matches StaticVisualization.tsx):
    //   M_i^FEM = (3qᵢ+2qⱼ)L²/60,  M_j^FEM = −(2qᵢ+3qⱼ)L²/60
    if (element.releases_i.theta || element.releases_j.theta) {
        const chord = (v_j - v_i) / L;
        const EI = element.ei;

        if (EI === 0) {
            if (element.releases_i.theta && element.releases_j.theta) {
                th_i = chord;
                th_j = chord;
            } else if (element.releases_i.theta) {
                th_i = 1.5 * chord - th_j / 2;
            } else {
                th_j = 1.5 * chord - th_i / 2;
            }
        } else {
            const Mi_fem = (3 * qi_trans + 2 * qj_trans) * L * L / 60;
            const Mj_fem = -(2 * qi_trans + 3 * qj_trans) * L * L / 60;

            if (element.releases_i.theta && element.releases_j.theta) {
                th_i = chord + Mj_fem * L / (6 * EI) - Mi_fem * L / (3 * EI);
                th_j = chord + Mi_fem * L / (6 * EI) - Mj_fem * L / (3 * EI);
            } else if (element.releases_i.theta) {
                th_i = 1.5 * chord - th_j / 2 - Mi_fem * L / (4 * EI);
            } else {
                th_j = 1.5 * chord - th_i / 2 - Mj_fem * L / (4 * EI);
            }
        }
    }

    const L4overEI = (load && element.ei > 0)
        ? (L * L * L * L) / element.ei
        : 0;

    const xi2 = xi * xi;
    const xi3 = xi2 * xi;
    const N1 = 1 - 3 * xi2 + 2 * xi3;
    const N2 = xi  - 2 * xi2 + xi3;
    const N3 =      3 * xi2  - 2 * xi3;
    const N4 =     -xi2      + xi3;

    let u = (1 - xi) * u_i + xi * u_j;
    let v = N1 * v_i  + N2 * L * th_i
          + N3 * v_j  + N4 * L * th_j;

    // Particular solution for axial displacement under distributed axial load.
    if (load && element.ea > 0) {
        u += (L * L / (6 * element.ea)) * (
            (2 * qi_axial + qj_axial) * xi - 3 * qi_axial * xi2 - (qj_axial - qi_axial) * xi3
        );
    }

    // Particular solution for transverse displacement under distributed transverse load.
    if (load && L4overEI !== 0) {
        const one_minus_xi = 1 - xi;
        v -= qi_trans * xi2 * one_minus_xi * one_minus_xi * L4overEI / 24;

        const dq = qj_trans - qi_trans;
        if (dq !== 0) {
            v -= dq * L4overEI * (xi2 * xi3 / 120 - xi3 / 40 + xi2 / 60);
        }
    }
    return { u, v };
}

/**
 * Returns N points along the physically correct deformed shape of a beam element.
 * Delegates per-point displacement to elementDisplacementAt, then applies the
 * local→global coordinate transform.
 */
export function deformedElementPoints(
    element: StructuralElement,
    ni: StructuralNode,
    nj: StructuralNode,
    getDof: (dof: number) => number,
    scale: number,
    load?: { qi: number; qj: number; angle?: number },
    nPoints = N_CURVE_POINTS,
): Array<{ x: number; z: number }> {
    const dx = nj.x - ni.x;
    const dz = nj.z - ni.z;
    const L = Math.hypot(dx, dz);
    if (L < 1e-10) return [{ x: ni.x, z: ni.z }, { x: nj.x, z: nj.z }];

    if (element.ei === 0 && element.releases_i.theta && element.releases_j.theta) {
        const w = element.dofs.map(d => getDof(d));
        return [
            { x: ni.x + w[0] * scale, z: ni.z + w[1] * scale },
            { x: nj.x + w[3] * scale, z: nj.z + w[4] * scale },
        ];
    }

    const thetaE = Math.atan2(dz, dx);
    const c = Math.cos(thetaE);
    const s = Math.sin(thetaE);

    const points: Array<{ x: number; z: number }> = [];

    for (let k = 0; k < nPoints; k++) {
        const xi = k / (nPoints - 1);
        const { u, v } = elementDisplacementAt(element, ni, nj, getDof, xi, load);

        const x_loc = xi * L + scale * u;
        const z_loc = scale * v;

        points.push({
            x: ni.x + c * x_loc - s * z_loc,
            z: ni.z + s * x_loc + c * z_loc,
        });
    }

    return points;
}
