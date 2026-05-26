import { matrix, zeros } from 'mathjs';
import type { Matrix } from 'mathjs';
import type { StructuralSystem } from './StructuralSystem';
import type { Loads } from '../models/models';

/**
 * Assembles the global force vector (ndof × 1) from nodal and element loads.
 *
 * Nodal loads: magnitude applied at angle (degrees), 0° = downward (−z), 90° = rightward (+x).
 * Element loads: trapezoidal distributed load q_i/q_j, positive = downward (local −v).
 *   Fixed-end forces:  V_i = L/20·(7qi+3qj),  M_i = L²/60·(3qi+2qj)
 *                      V_j = L/20·(3qi+7qj),  M_j = −L²/60·(2qi+3qj)
 */
export function assembleForceVector(structuralSystem: StructuralSystem, loads: Loads): Matrix {
    const F = matrix(zeros([structuralSystem.ndof, 1])) as Matrix;

    loads.nodes.forEach(load => {
        const node = structuralSystem.nodes.find(n => n.id === load.node_id);
        if (!node) return;
        const rad = (load.angle * Math.PI) / 180;
        F.set([node.dofs[0], 0], F.get([node.dofs[0], 0]) + load.magnitude * Math.sin(rad));
        F.set([node.dofs[1], 0], F.get([node.dofs[1], 0]) - load.magnitude * Math.cos(rad));
    });

    loads.elements.forEach(load => {
        const el = structuralSystem.elements.find(e => e.id === load.element_id);
        if (!el) return;
        const ni = structuralSystem.nodes.find(n => n.id === el.node_i)!;
        const nj = structuralSystem.nodes.find(n => n.id === el.node_j)!;
        const dx = nj.x - ni.x, dz = nj.z - ni.z;
        const L = Math.hypot(dx, dz);
        if (L < 1e-6) return;
        const sinB = dz / L, cosB = dx / L;
        const { q_i: qi, q_j: qj } = load;
        let vi = (L / 20) * (7 * qi + 3 * qj);
        let mi = (L * L / 60) * (3 * qi + 2 * qj);
        let vj = (L / 20) * (3 * qi + 7 * qj);
        let mj = -(L * L / 60) * (2 * qi + 3 * qj);

        // Condense FEF for moment releases (K_fr * K_rr⁻¹ * f_released).
        if (el.releases_i.theta && el.releases_j.theta) {
            const delta = (mi + mj) / L;
            vi -= delta; vj += delta;
            mi = 0; mj = 0;
        } else if (el.releases_i.theta) {
            vi -= (3 / (2 * L)) * mi;
            vj += (3 / (2 * L)) * mi;
            mj -= 0.5 * mi;
            mi = 0;
        } else if (el.releases_j.theta) {
            vi -= (3 / (2 * L)) * mj;
            mi -= 0.5 * mj;
            vj += (3 / (2 * L)) * mj;
            mj = 0;
        }

        const gf = [vi * sinB, -vi * cosB, -mi, vj * sinB, -vj * cosB, -mj];
        el.dofs.forEach((d, i) => F.set([d, 0], F.get([d, 0]) + gf[i]));
    });

    return F;
}