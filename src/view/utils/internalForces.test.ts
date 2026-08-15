import { expect, test } from "vitest";
import { matrix } from "mathjs";
import { StructuralSystem } from "../../solver/StructuralSystem";
import { SystemSolver } from "../../solver/SystemSolver";
import { elementInternalForces, elementLocalDisplacements } from "./internalForces";
import { elementDisplacementAt } from "./deformedShape";

const ACC = 9;

/** Simply supported beam, modelled as a single element with a moment release at both ends. */
function hingedBeam(ea: number, ei: number) {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: 0, restraint: { u: false, v: true, theta: true }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 },
        ],
        [
            { id: 1, element_id: 1, end: 'i', u: false, v: false, theta: true },
            { id: 2, element_id: 1, end: 'j', u: false, v: false, theta: true },
        ],
    );
}

test('elementInternalForces — moment vanishes at released ends (UDL)', () => {
    const [ea, ei, q] = [7, 11, 13];
    const system = hingedBeam(ea, ei);
    const sol = new SystemSolver(system).solveStatic(matrix([0]));

    const el = system.elements[0];
    const [n_i, n_j] = system.nodes;
    const L = 1;

    const points = elementInternalForces(el, n_i, n_j, (dof) => sol.get_w(dof), { qi: q, qj: q }, 5);

    // Simply supported beam under UDL: M(0) = M(L) = 0, M(L/2) = qL²/8
    expect(points[0].M).toBeCloseTo(0, ACC);
    expect(points[points.length - 1].M).toBeCloseTo(0, ACC);
    expect(points[2].M).toBeCloseTo(q * L * L / 8, ACC);

    // V = dM/dx is linear from +qL/2 to −qL/2
    expect(points[0].V).toBeCloseTo(q * L / 2, ACC);
    expect(points[2].V).toBeCloseTo(0, ACC);
    expect(points[points.length - 1].V).toBeCloseTo(-q * L / 2, ACC);
});

test('elementLocalDisplacements — released ends give the simply supported deflection', () => {
    const [ea, ei, q] = [7, 11, 13];
    const system = hingedBeam(ea, ei);
    const sol = new SystemSolver(system).solveStatic(matrix([0]));

    const el = system.elements[0];
    const [n_i, n_j] = system.nodes;

    const points = elementLocalDisplacements(el, n_i, n_j, (dof) => sol.get_w(dof), { qi: q, qj: q }, 5);

    // 5·q·L⁴/(384·EI) = 5·13/(384·11) = 65/4224
    expect(points[2].v).toBeCloseTo(-65 / 4224, ACC);
    expect(points[0].v).toBeCloseTo(0, ACC);
    expect(points[points.length - 1].v).toBeCloseTo(0, ACC);
});

test('elementLocalDisplacements agrees with the drawn deformed shape', () => {
    const [ea, ei, q] = [7, 11, 13];
    const load = { qi: q, qj: 2 * q, angle: 30 };

    // One released end, one rigid end, and a node rotation that must not leak into the
    // released end — the case where the two code paths used to disagree.
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: 3, z: 4, mass: 0, restraint: { u: false, v: true, theta: false }, angle: 0.2 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 },
        ],
        [
            { id: 1, element_id: 1, end: 'i', u: false, v: false, theta: true },
        ],
    );

    const sol = new SystemSolver(system).solveStatic(matrix([1, 2]));

    const el = system.elements[0];
    const [n_i, n_j] = system.nodes;
    const getDof = (dof: number) => sol.get_w(dof);

    const nPoints = 7;
    const points = elementLocalDisplacements(el, n_i, n_j, getDof, load, nPoints);

    points.forEach((p, k) => {
        const xi = k / (nPoints - 1);
        const expected = elementDisplacementAt(el, n_i, n_j, getDof, xi, load);
        expect(p.u).toBeCloseTo(expected.u, ACC);
        expect(p.v).toBeCloseTo(expected.v, ACC);
    });

    // The released end carries no moment, the rigid end does.
    const forces = elementInternalForces(el, n_i, n_j, getDof, load, nPoints);
    expect(forces[0].M).toBeCloseTo(0, ACC);
    expect(Math.abs(forces[forces.length - 1].M)).toBeGreaterThan(1e-6);
});
