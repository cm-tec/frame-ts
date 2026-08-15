import { det, index, inv, matrix, multiply, subset, subtract, transpose, zeros, type Matrix } from 'mathjs';
import { Polynomial } from './Polynomial';
import { get_rotation_matrix_of_element, k_element } from './elementMatrices';
import type { StructuralLoads } from './StructuralLoads';
import type { StructuralElement, StructuralSystem } from './StructuralSystem';



const N_AXIAL_I = new Polynomial([1, -1]);
const N_AXIAL_J = new Polynomial([0, 1]);

const N_1 = new Polynomial([1, 0, -3, 2]);
const N_2 = new Polynomial([0, 1, -2, 1]);
const N_3 = new Polynomial([0, 0, 3, -2]);
const N_4 = new Polynomial([0, 0, -1, 1]);

export function assembleForceVector(system: StructuralSystem, loads: StructuralLoads): Matrix {
    const F = matrix(zeros([system.ndof, 1])) as Matrix;

    for (const node of system.nodes) {
        const { fx, fy } = loads.ofNode(node.id);
        if (fx === 0 && fy === 0) continue;

        const c = Math.cos(node.angle);
        const s = Math.sin(node.angle);

        F.set([node.dofs[0], 0], F.get([node.dofs[0], 0]) + c * fx + s * fy);
        F.set([node.dofs[1], 0], F.get([node.dofs[1], 0]) - s * fx + c * fy);
    }

    for (const element of system.elements) {
        const { q_trans, q_axial } = loads.ofElement(element.id);
        if (q_trans.isZero && q_axial.isZero) continue;

        const f_local = equivalentNodalLoad(element, q_trans, q_axial);

        const R = get_rotation_matrix_of_element(element.angle, element.n_i.angle, element.n_j.angle);
        const f = multiply(transpose(R), condenseForReleases(element, f_local)) as Matrix;

        element.dofs.forEach((dof, i) => F.set([dof, 0], F.get([dof, 0]) + f.get([i, 0])));
    }

    return F;
}

export function equivalentNodalLoad(element: StructuralElement, q_trans: Polynomial, q_axial: Polynomial): Matrix {
    const L = element.L;

    return matrix([
        [ L     * q_axial.times(N_AXIAL_I).integral()],
        [L     * q_trans.times(N_1).integral()],
        [L * L * q_trans.times(N_2).integral()],
        [ L     * q_axial.times(N_AXIAL_J).integral()],
        [L     * q_trans.times(N_3).integral()],
        [L * L * q_trans.times(N_4).integral()],
    ]) as Matrix;
}

export function condenseForReleases(element: StructuralElement, f: Matrix): Matrix {
    const { releases_i, releases_j } = element;

    if (releases_i.u && releases_i.v && releases_i.theta) return matrix(zeros([6, 1])) as Matrix;
    if (releases_j.u && releases_j.v && releases_j.theta) return matrix(zeros([6, 1])) as Matrix;

    const cut: number[] = [];
    if (releases_i.u) cut.push(0);
    if (releases_i.v) cut.push(1);
    if (releases_i.theta) cut.push(2);
    if (releases_j.u) cut.push(3);
    if (releases_j.v) cut.push(4);
    if (releases_j.theta) cut.push(5);

    if (cut.length === 0) return f;

    const keep = [0, 1, 2, 3, 4, 5].filter(i => !cut.includes(i));

    const k = k_element(element.ea, element.ei, element.L);
    const K_cc = subset(k, index(cut, cut)) as Matrix;

    const condensed = matrix(zeros([6, 1])) as Matrix;

    if (Math.abs(det(K_cc)) < 1e-12) {
        keep.forEach(r => condensed.set([r, 0], f.get([r, 0])));
        return condensed;
    }

    const K_kc = subset(k, index(keep, cut)) as Matrix;
    const f_cut = subset(f, index(cut, [0])) as Matrix;
    const f_keep = subset(f, index(keep, [0])) as Matrix;

    const corrected = subtract(f_keep, multiply(K_kc, multiply(inv(K_cc), f_cut))) as Matrix;
    keep.forEach((r, i) => condensed.set([r, 0], corrected.get([i, 0])));

    return condensed;
}
