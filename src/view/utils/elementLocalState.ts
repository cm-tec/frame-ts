import type { StructuralElement, StructuralNode } from '../../solver/StructuralSystem';

export interface ElementLocalState {
    /** Element length. */
    L: number;
    /** End displacements in local coordinates (u along the axis i→j, v 90° CCW from it). */
    u_i: number; v_i: number; th_i: number;
    u_j: number; v_j: number; th_j: number;
    /** Load ordinates split into the local transverse and axial directions. */
    qi_trans: number; qj_trans: number;
    qi_axial: number; qj_axial: number;
}

/**
 * Projects the global nodal DOFs of an element onto its local axis and splits any
 * distributed load into local components.
 *
 * The returned rotations are the *element end slopes*, not the nodal rotations. At a
 * moment-released end the solver has condensed the element rotation away, so the nodal θ
 * carries no information about this element and the true end slope has to be recovered
 * from M = 0. Every consumer of the element displacement field — deformed shape, internal
 * forces, local displacement diagrams — must use these values; using the raw nodal θ
 * evaluates a hinged element as if it were rigidly connected.
 *
 * Sign conventions (must match the load assembly in forceAssembly.ts):
 *   - Local u : along the element axis from node_i to node_j
 *   - Local v : 90° CCW from local u (the "top" of the beam)
 *   - Positive q means downward (= local −v direction)
 */
export function elementLocalState(
    element: StructuralElement,
    ni: StructuralNode,
    nj: StructuralNode,
    getDof: (dof: number) => number,
    load?: { qi: number; qj: number; angle?: number },
): ElementLocalState {
    const dx = nj.x - ni.x;
    const dz = nj.z - ni.z;
    const L = Math.hypot(dx, dz);

    const thetaE = Math.atan2(dz, dx);

    const w = element.dofs.map(d => getDof(d));

    const theta_i = thetaE - ni.angle;
    const ci = Math.cos(theta_i), si = Math.sin(theta_i);
    const theta_j = thetaE - nj.angle;
    const cj = Math.cos(theta_j), sj = Math.sin(theta_j);

    const u_i =  ci * w[0] + si * w[1];
    const v_i = -si * w[0] + ci * w[1];
    let   th_i =  w[2];
    const u_j =  cj * w[3] + sj * w[4];
    const v_j = -sj * w[3] + cj * w[4];
    let   th_j =  w[5];

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

    // Back-calculate the true end slopes at released ends from M = 0.
    //
    // Beam stiffness: M_i = (EI/L)[4φᵢ + 2φⱼ − 6(vⱼ−vᵢ)/L] + M_i^FEM = 0
    // Fixed-end moments (positive q downward, matches forceAssembly.ts):
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

    return { L, u_i, v_i, th_i, u_j, v_j, th_j, qi_trans, qj_trans, qi_axial, qj_axial };
}
