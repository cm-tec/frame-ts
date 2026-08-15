import type { StructuralElement, StructuralNode } from '../../solver/StructuralSystem';
import { elementLocalState } from './elementLocalState';

const N_CURVE_POINTS = 20;

/**
 * Returns the physically correct local displacement {u, v} of a beam element
 * at parametric coordinate ξ ∈ [0, 1], using cubic Hermite interpolation of
 * the nodal DOFs plus an analytical particular solution for any distributed load.
 *
 * Sign conventions and the treatment of moment-released ends live in
 * elementLocalState — see there.
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
    const {
        L, u_i, v_i, th_i, u_j, v_j, th_j,
        qi_trans, qj_trans, qi_axial, qj_axial,
    } = elementLocalState(element, ni, nj, get_w, load);

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
