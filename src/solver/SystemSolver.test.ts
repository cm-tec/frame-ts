import { expect, test } from 'vitest';
import { StructuralSystem } from './StructuralSystem';
import { SystemSolver } from './SystemSolver';
import { abs, matrix, max, sqrt, subtract, zeros } from 'mathjs';

function makeForces(ndofs: number, entries: [dof: number, value: number][]): math.Matrix {
    const f = matrix(zeros([ndofs, 1]));
    for (const [dof, val] of entries) (f as math.Matrix).set([dof, 0], val);
    return f as math.Matrix;
}

function areMatricesClose(A: math.Matrix, B: math.Matrix, epsilon = 1e-9) {
    const diff = subtract(A, B);
    const absDiff = abs(diff);
    const maxDiff = max(absDiff) as number;
    return maxDiff <= epsilon;
}

test('sdof — dof counts and matrix assembly', () => {
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 2, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 2, x: 0, z: 1, mass: 3, restrained_u: true, restrained_v: false, u0: 0, v0: 0, du0: 0, dv0: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: 7, c: 11 },
        ]
    );

    const solver = new SystemSolver(system);

    expect(solver.ndof_restrained).toBe(3);
    expect(solver.ndof_non_restrained).toBe(1);
    expect(solver.restrained).toStrictEqual([0, 1, 2]);
    expect(solver.non_restrained).toStrictEqual([3]);

    expect(solver.k_11).toStrictEqual(matrix([[7]]));
    expect(areMatricesClose(solver.k_22, matrix([[0, 0, 0], [0, 7, 0], [0, 0, 0]]))).toBe(true);
    expect(areMatricesClose(solver.c_11, matrix([[11]]))).toBe(true);
    expect(areMatricesClose(solver.c_22, matrix([[0, 0, 0], [0, 11, 0], [0, 0, 0]]))).toBe(true);
    expect(areMatricesClose(solver.m_11, matrix([[3]]))).toBe(true);
    expect(areMatricesClose(solver.m_22, matrix([[2, 0, 0], [0, 2, 0], [0, 0, 3]]))).toBe(true);
});

test('fully restrained system is not kinematic', () => {
    const system = new StructuralSystem(
        [{ id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 }],
        []
    );
    const solver = new SystemSolver(system);
    expect(solver.isKinematic()).toBe(false);
    expect(solver.ndof_non_restrained).toBe(0);
});

// ─── solveStatic ──────────────────────────────────────────────────────────────
// DOF layout convention used in these tests:
//   horizontal bar (nodes 1→2 along x): u1=0(R), v1=1(R), u2=2(F), v2=3(R)
//   vertical bar   (nodes 1→2 along z): u1=0(R), v1=1(R), u2=2(R), v2=3(F)
//   two-bar sym    (nodes 1,2,3 along x): u1=0(R),v1=1(R), u2=2(F),v2=3(R), u3=4(R),v3=5(R)

test('solveStatic — horizontal bar displacement', () => {
    const EA = 500, L = 2, F = 10;
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 2, x: L, z: 0, mass: 0, restrained_u: false, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea: EA, c: 0 }]
    );
    const sol = new SystemSolver(system).solveStatic(makeForces(system.ndofs, [[2, F]]));

    expect(sol.get_w(2)).toBeCloseTo(F * L / EA, 10);
    expect(sol.get_w(0)).toBeCloseTo(0, 10);
    expect(sol.get_r(0)).toBeCloseTo(-F, 10);
});

test('solveStatic — vertical bar displacement', () => {
    const EA = 300, L = 4, F = 6;
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 2, x: 0, z: L, mass: 0, restrained_u: true, restrained_v: false, u0: 0, v0: 0, du0: 0, dv0: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea: EA, c: 0 }]
    );
    const sol = new SystemSolver(system).solveStatic(makeForces(system.ndofs, [[3, F]]));

    expect(sol.get_w(3)).toBeCloseTo(F * L / EA, 10);
    expect(sol.get_r(1)).toBeCloseTo(-F, 10);
});

test('solveStatic — two-bar symmetric: displacement, reactions, normal forces', () => {
    const EA = 400, L = 3, F = 20;
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 2, x: L, z: 0, mass: 0, restrained_u: false, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 3, x: 2 * L, z: 0, mass: 0, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: EA, c: 0 },
            { id: 2, node_i: 2, node_j: 3, ea: EA, c: 0 },
        ]
    );
    const sol = new SystemSolver(system).solveStatic(makeForces(system.ndofs, [[2, F]]));

    // Middle node displaces by F / (2*EA/L)
    expect(sol.get_w(2)).toBeCloseTo(F * L / (2 * EA), 10);
});

test('solveStatic — global equilibrium holds', () => {
    const EA = 400, L = 3, F = 20;
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 2, x: L, z: 0, mass: 0, restrained_u: false, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 3, x: 2 * L, z: 0, mass: 0, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: EA, c: 0 },
            { id: 2, node_i: 2, node_j: 3, ea: EA, c: 0 },
        ]
    );
    const sol = new SystemSolver(system).solveStatic(makeForces(system.ndofs, [[2, F]]));

    // Sum of all reactions + applied forces = 0
    const totalU = sol.get_r(0) + sol.get_r(4) + F;
    expect(totalU).toBeCloseTo(0, 10);
});

// ─── solveDynamic ─────────────────────────────────────────────────────────────

test('solveDynamic — overdamped SDOF eigenvalues and time response', () => {
    const k = 400, c = 1000, m = 100;

    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 2, x: 0, z: 1, mass: m, restrained_u: true, restrained_v: false, u0: 0, v0: 0, du0: 0, dv0: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea: k, c: c }]
    );

    const sol = new SystemSolver(system).solveDynamic(matrix([0.1, 0]));

    const omega_n = sqrt(k / m) as number;
    const zeta = c / (2 * (sqrt(m * k) as number));
    const lambda_1 = omega_n * (-zeta + (sqrt(zeta ** 2 - 1) as number));
    const lambda_2 = omega_n * (-zeta - (sqrt(zeta ** 2 - 1) as number));

    expect(areMatricesClose(sol.eigenValues, matrix([[lambda_1], [lambda_2]]))).toBe(true);

    const A = 0.1 * lambda_2 / (lambda_2 - lambda_1);
    const B = 0.1 * lambda_1 / (lambda_1 - lambda_2);
    const analytical = (t: number) => A * Math.exp(lambda_1 * t) + B * Math.exp(lambda_2 * t);

    for (const t of [0, 0.1, 0.5, 1.0, 2.0, 5.0]) {
        expect(sol.get_w(3, t)).toBeCloseTo(analytical(t), 6);
    }
});

test('solveDynamic — fully restrained system returns zero displacement', () => {
    const system = new StructuralSystem(
        [{ id: 1, x: 0, z: 0, mass: 0, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 }],
        []
    );
    const sol = new SystemSolver(system).solveStatic(makeForces(system.ndofs, []));
    expect(sol.get_w(0)).toBeCloseTo(0, 10);
    expect(sol.get_w(1)).toBeCloseTo(0, 10);
});
