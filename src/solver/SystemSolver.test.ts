import { expect, test } from 'vitest';
import { StructuralSystem } from './StructuralSystem';
import { SystemSolver } from './SystemSolver';
import { abs, matrix, max, sqrt, subtract } from 'mathjs';


function areMatricesClose(A: math.Matrix, B: math.Matrix, epsilon = 1e-9) {
    const diff = subtract(A, B);
    const absDiff = abs(diff);

    const maxDiff = max(absDiff) as number;
    return maxDiff <= epsilon;
}

test('sdof', () => {
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



    expect(solver.k_11).toStrictEqual(matrix([
        [7]
    ]))

    expect(areMatricesClose(
        solver.k_22,
        matrix([
            [0, 0, 0],
            [0, 7, 0],
            [0, 0, 0]
        ])
    )).toBe(true);

    expect(areMatricesClose(
        solver.c_11,
        matrix([
            [11]
        ])
    )).toBe(true);

    expect(areMatricesClose(
        solver.c_22,
        matrix([
            [0, 0, 0],
            [0, 11, 0],
            [0, 0, 0]
        ])
    )).toBe(true);

    expect(areMatricesClose(
        solver.m_11,
        matrix([
            [3]
        ])
    )).toBe(true);

    expect(areMatricesClose(
        solver.m_22,
        matrix([
            [2, 0, 0],
            [0, 2, 0],
            [0, 0, 3]
        ])
    )).toBe(true);
});




test('sdof over critically damped', () => {
    const k = 400;
    const c = 1000;
    const m = 100;


    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
            { id: 2, x: 0, z: 1, mass: m, restrained_u: true, restrained_v: false, u0: 0, v0: 0, du0: 0, dv0: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: k, c: c },
        ]
    );

    const solver = new SystemSolver(system);

    expect(solver.ndof_restrained).toBe(3);
    expect(solver.ndof_non_restrained).toBe(1);

    expect(solver.restrained).toStrictEqual([0, 1, 2]);
    expect(solver.non_restrained).toStrictEqual([3]);



    expect(solver.k_11).toStrictEqual(matrix([
        [k]
    ]))

    expect(areMatricesClose(
        solver.k_22,
        matrix([
            [0, 0, 0],
            [0, k, 0],
            [0, 0, 0]
        ])
    )).toBe(true);

    expect(areMatricesClose(
        solver.c_11,
        matrix([
            [c]
        ])
    )).toBe(true);

    expect(areMatricesClose(
        solver.c_22,
        matrix([
            [0, 0, 0],
            [0, c, 0],
            [0, 0, 0]
        ])
    )).toBe(true);

    expect(areMatricesClose(
        solver.m_11,
        matrix([
            [m]
        ])
    )).toBe(true);

    expect(areMatricesClose(
        solver.m_22,
        matrix([
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, m]
        ])
    )).toBe(true);

    expect(solver.isKinematic()).toBe(false);

    const solution = solver.solve(matrix([0.1, 0]));

    const omega_n = sqrt(k / m) as number;
    const zeta = c / (2 * (sqrt(m * k) as number));

    const lambda_1 = omega_n * (-zeta + (sqrt(zeta ** 2 - 1) as number));
    const lambda_2 = omega_n * (-zeta - (sqrt(zeta ** 2 - 1) as number));

    expect(areMatricesClose(
        solution.eigenValues,
        matrix([
            [lambda_1],
            [lambda_2]
        ])
    )).toBe(true);

    // Coefficients from initial conditions: u(0)=0.1, u'(0)=0
    const A = 0.1 * lambda_2 / (lambda_2 - lambda_1);
    const B = 0.1 * lambda_1 / (lambda_1 - lambda_2);

    console.log(A)
    console.log(B)
    console.log(solution.coefficients)

    const analytical = (t: number) => A * Math.exp(lambda_1 * t) + B * Math.exp(lambda_2 * t);

    for (const t of [0, 0.1, 0.5, 1.0, 2.0, 5.0]) {
        expect(solution.get_w(3, t)).toBeCloseTo(analytical(t), 6);
    }
});
