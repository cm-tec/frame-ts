import { matrix, multiply, transpose, zeros, type Matrix } from 'mathjs';
import { Polynomial } from './Polynomial';
import { condenseReleases, get_rotation_matrix_of_element, k_element } from './elementMatrices';
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
        const { fx, fy, m } = loads.ofNode(node.id);
        if (fx === 0 && fy === 0 && m === 0) continue;

        const c = Math.cos(node.angle);
        const s = Math.sin(node.angle);

        F.set([node.dofs[0], 0], F.get([node.dofs[0], 0]) + c * fx + s * fy);
        F.set([node.dofs[1], 0], F.get([node.dofs[1], 0]) - s * fx + c * fy);
        F.set([node.dofs[2], 0], F.get([node.dofs[2], 0]) + m);
    }

    for (const element of system.elements) {
        const { q_trans, q_axial } = loads.ofElement(element.id);
        if (q_trans.isZero && q_axial.isZero) continue;

        const f_local = equivalentNodalLoad(element, q_trans, q_axial);

        const R = get_rotation_matrix_of_element(element.angle, element.n_i.angle, element.n_j.angle);
        const f = multiply(transpose(R), condenseElementLoad(element, f_local)) as Matrix;

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

export function condenseElementLoad(element: StructuralElement, f: Matrix): Matrix {
    const k = k_element(element.ea, element.ei, element.L);

    return condenseReleases(f, k, element.releases_i, element.releases_j);
}
