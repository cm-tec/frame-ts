import { matrix, zeros } from 'mathjs';
import type { Matrix } from 'mathjs';
import type { StructuralSystem } from './StructuralSystem';
import type { Loads } from '../models/inputModels';

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
        const L = el.L;
        if (L < 1e-6) return;
        const sinB = Math.sin(el.angle), cosB = Math.cos(el.angle);
        const rad = (load.angle * Math.PI) / 180;
        let cosVal = Math.cos(rad);
        let sinVal = Math.sin(rad);
        if (Math.abs(cosVal) < 1e-12) cosVal = 0;
        if (Math.abs(sinVal) < 1e-12) sinVal = 0;

        const qi_trans = load.q_i * cosVal;
        const qj_trans = load.q_j * cosVal;
        const qi_axial = load.q_i * sinVal;
        const qj_axial = load.q_j * sinVal;

        let vi = (L / 20) * (7 * qi_trans + 3 * qj_trans);
        let mi = (L * L / 60) * (3 * qi_trans + 2 * qj_trans);
        let vj = (L / 20) * (3 * qi_trans + 7 * qj_trans);
        let mj = -(L * L / 60) * (2 * qi_trans + 3 * qj_trans);

        const ui = (L / 6) * (2 * qi_axial + qj_axial);
        const uj = (L / 6) * (qi_axial + 2 * qj_axial);

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

        const gf = [
            vi * sinB + ui * cosB,
            -vi * cosB + ui * sinB,
            -mi,
            vj * sinB + uj * cosB,
            -vj * cosB + uj * sinB,
            -mj
        ];
        el.dofs.forEach((d, i) => F.set([d, 0], F.get([d, 0]) + gf[i]));
    });

    return F;
}