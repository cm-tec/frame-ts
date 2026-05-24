import { expect, test } from 'vitest';
import { StructuralSystem } from './StructuralSystem';
import { c_element, k_element, SystemSolver } from './SystemSolver';
import { abs, matrix, max, sqrt, subtract, zeros } from 'mathjs';
/*
function makeForces(ndofs: number, entries: [dof: number, value: number][]): math.Matrix {
    const f = matrix(zeros([ndofs, 1]));
    for (const [dof, val] of entries) (f as math.Matrix).set([dof, 0], val);
    return f as math.Matrix;
}

function areMatricesClose(A: math.Matrix, B: math.Matrix, epsilon = 1e-9) {
    const sameShape = A.size().length === B.size().length && A.size().every((d, i) => d === B.size()[i]);
    if (!sameShape) return false;
    if (A.valueOf().flat().length === 0) return true;
    const diff = subtract(A, B);
    const absDiff = abs(diff);
    const maxDiff = max(absDiff) as number;
    return maxDiff <= epsilon;
}


function getBeam(ea: number = 7, ei: number = 11, c: number = 13, m=17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { u: true, v: true, theta: false }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { u: false, v: true, theta: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: ea, ei: ei, c: c, releases_i: { u: false, v: false, theta: false }, releases_j: { u: false, v: false, theta: false } },
        ]
    );
}


function getRotatedBeam(ea: number = 7, ei: number = 11, c: number = 13, m=17): StructuralSystem {
    const alpha = Math.atan2(4 / 5, 3 / 5);

    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { u: true, v: true, theta: false }, angle: alpha },
            { id: 2, x: 3/5, z: 4/5, mass: m, restraint: { u: false, v: true, theta: false }, angle: alpha },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: ea, ei: ei, c: c, releases_i: { u: false, v: false, theta: false }, releases_j: { u: false, v: false, theta: false } },
        ]
    );
}

function getCantilever(ea: number = 7, ei: number = 11, c: number = 13, m=17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { u: false, v: false, theta: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: ea, ei: ei, c: c, releases_i: { u: false, v: false, theta: false }, releases_j: { u: false, v: false, theta: false } },
        ]
    );
}

function getCantileverThroughReleases(ea: number = 7, ei: number = 11, c: number = 13, m=17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { u: true, v: true, theta: true }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: ea, ei: ei, c: c, releases_i: { u: false, v: false, theta: false }, releases_j: { u: true, v: true, theta: true } },
        ]
    );
}

function getFlippedCantilever(ea: number = 7, ei: number = 11, c: number = 13, m = 17): StructuralSystem {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { u: true, v: true, theta: true }, angle: 0 },
            // Free tip with local coordinates flipped 180°
            { id: 2, x: 1, z: 0, mass: m, restraint: { u: false, v: false, theta: false }, angle: Math.PI },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: ea, ei: ei, c: c, releases_i: { u: false, v: false, theta: false }, releases_j: { u: false, v: false, theta: false } },
        ]
    );
}

test('assembly of matrices for beam', () => {
    const [ea, ei, c, m] = [7, 11, 13, 17];
    const system = getBeam(ea, ei, c, m);


    const solver = new SystemSolver(system);

    expect(solver.ndof_restrained).toBe(3);
    expect(solver.ndof_non_restrained).toBe(3);
    expect(solver.restrained).toStrictEqual([0, 1, 4]);
    expect(solver.non_restrained).toStrictEqual([2, 3, 5]);

    expect(areMatricesClose(solver.k_11, matrix([[4*ei, 0, 2*ei], [0, ea, 0], [2*ei, 0, 4*ei]]))).toBe(true);
    expect(areMatricesClose(solver.k_22, matrix([[ea, 0, 0], [0, 12*ei, -12*ei], [0, -12*ei, 12*ei]]))).toBe(true);
    expect(areMatricesClose(solver.c_11, matrix([[0, 0, 0], [0, c, 0], [0, 0, 0]]))).toBe(true);
    expect(areMatricesClose(solver.c_22, matrix([[c, 0, 0], [0, 0, 0], [0, 0, 0]]))).toBe(true);
    expect(areMatricesClose(solver.m_11, matrix([[10, 0, 0], [0, m, 0], [0, 0, 10]]))).toBe(true);
    expect(areMatricesClose(solver.m_22, matrix([[m, 0, 0], [0, m, 0], [0, 0, m]]))).toBe(true);
});



test('assembly of matrices for cantilever', () => {
    const [ea, ei, c, m] = [7, 11, 13, 17];
    const system = getCantilever(ea, ei, c, m);


    const solver = new SystemSolver(system);

    expect(solver.ndof_restrained).toBe(3);
    expect(solver.ndof_non_restrained).toBe(3);
    expect(solver.restrained).toStrictEqual([0, 1, 2]);
    expect(solver.non_restrained).toStrictEqual([3, 4, 5]);

    expect(areMatricesClose(solver.k_11, matrix([[ea, 0, 0], [0, 12*ei, -6*ei], [0, -6*ei, 4*ei]]))).toBe(true);
    expect(areMatricesClose(solver.k_22, matrix([[ea, 0, 0], [0, 12*ei, 6*ei], [0, 6*ei, 4*ei]]))).toBe(true);
    expect(areMatricesClose(solver.c_11, matrix([[c, 0, 0], [0, 0, 0], [0, 0, 0]]))).toBe(true);
    expect(areMatricesClose(solver.c_22, matrix([[c, 0, 0], [0, 0, 0], [0, 0, 0]]))).toBe(true);
    expect(areMatricesClose(solver.m_11, matrix([[m, 0, 0], [0, m, 0], [0, 0, 10]]))).toBe(true);
    expect(areMatricesClose(solver.m_22, matrix([[m, 0, 0], [0, m, 0], [0, 0, 10]]))).toBe(true);
});


test('assembly of matrices with releases', () => {
    const [ea, ei, c, m] = [7, 11, 13, 17];
    let system = getCantileverThroughReleases(ea, ei, c, m);


    let solver = new SystemSolver(system);

    expect(solver.ndof_restrained).toBe(6);
    expect(solver.ndof_non_restrained).toBe(0);
    expect(solver.restrained).toStrictEqual([0, 1, 2, 3, 4, 5]);
    expect(solver.non_restrained).toStrictEqual([]);

    expect(areMatricesClose(solver.k_11, matrix())).toBe(true);
    expect(areMatricesClose(solver.k_22, matrix(zeros([6,6])))).toBe(true);
    expect(areMatricesClose(solver.c_11, matrix())).toBe(true);
    expect(areMatricesClose(solver.c_22, matrix(zeros([6,6])))).toBe(true);
    expect(areMatricesClose(solver.m_11, matrix())).toBe(true);


    system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: m, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { u: false, v: true, theta: true }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: ea, ei: ei, c: c, releases_i: { u: false, v: false, theta: false }, releases_j: { u: false, v: true, theta: true } },
        ]
    );
    solver = new SystemSolver(system);

    expect(solver.ndof_restrained).toBe(5);
    expect(solver.ndof_non_restrained).toBe(1);
    expect(solver.restrained).toStrictEqual([0, 1, 2, 4, 5]);
    expect(solver.non_restrained).toStrictEqual([3]);

    expect(areMatricesClose(solver.k_11, matrix([[ea]]))).toBe(true);
    expect(areMatricesClose(solver.k_22, matrix([
        [ea, 0, 0, 0, 0],
        [0,  0, 0, 0, 0],
        [0,  0, 0, 0, 0],
        [0,  0, 0, 0, 0],
        [0,  0, 0, 0, 0]
    ]))).toBe(true);
    expect(areMatricesClose(solver.c_11, matrix([[c]]))).toBe(true);
    expect(areMatricesClose(solver.c_22, matrix([
        [c, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
    ]))).toBe(true);
    expect(areMatricesClose(solver.m_11, matrix([[m]]))).toBe(true);

});


test('assembly invariance under rigid system and support rotation', () => {
    const [ea, ei, c, m] = [7, 11, 13, 17];

    const baselineSystem = getBeam(ea, ei, c, m);
    const baselineSolver = new SystemSolver(baselineSystem);

    const rotatedSystem = getRotatedBeam(ea, ei, c, m);
    const rotatedSolver = new SystemSolver(rotatedSystem);

    expect(rotatedSolver.ndof_restrained).toBe(baselineSolver.ndof_restrained);
    expect(rotatedSolver.ndof_non_restrained).toBe(baselineSolver.ndof_non_restrained);
    expect(rotatedSolver.restrained).toStrictEqual(baselineSolver.restrained);
    expect(rotatedSolver.non_restrained).toStrictEqual(baselineSolver.non_restrained);

    expect(areMatricesClose(rotatedSolver.k_11, baselineSolver.k_11)).toBe(true);
    expect(areMatricesClose(rotatedSolver.k_22, baselineSolver.k_22)).toBe(true);
    expect(areMatricesClose(rotatedSolver.k_12, baselineSolver.k_12)).toBe(true);

    expect(areMatricesClose(rotatedSolver.c_11, baselineSolver.c_11)).toBe(true);
    expect(areMatricesClose(rotatedSolver.c_22, baselineSolver.c_22)).toBe(true);

    expect(areMatricesClose(rotatedSolver.m_11, baselineSolver.m_11)).toBe(true);
});


test('assembly of cantilever with a 180-degree flipped node system', () => {
    const [ea, ei, c, m] = [7, 11, 13, 17];
    const system = getFlippedCantilever(ea, ei, c, m);
    const solver = new SystemSolver(system);

    expect(solver.ndof_restrained).toBe(3);
    expect(solver.ndof_non_restrained).toBe(3);
    expect(solver.restrained).toStrictEqual([0, 1, 2]);
    expect(solver.non_restrained).toStrictEqual([3, 4, 5]);


    const expected_k_11 = matrix([
        [ea,  0,       0      ],
        [0,   12 * ei, 6 * ei ], // Sign flipped from -6*ei to +6*ei
        [0,   6 * ei,  4 * ei ]  // Sign flipped from -6*ei to +6*ei
    ]);
    expect(areMatricesClose(solver.k_11, expected_k_11)).toBe(true);

    const expected_k_12 = matrix([
        [ea,  0,        0      ], // Baseline -ea becomes +ea
        [0,   12 * ei,  6 * ei], // Baseline -12*ei becomes +12*ei and -6*ei becomes +6*ei
        [0,   6 * ei,   2 * ei]
    ]);
    expect(areMatricesClose(solver.k_12, expected_k_12)).toBe(true);

    const expected_c_11 = matrix([
        [c, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ]);
    expect(areMatricesClose(solver.c_11, expected_c_11)).toBe(true);
    
    expect(areMatricesClose(solver.c_12, matrix([
        [c, 0, 0], // Baseline -c becomes +c
        [0, 0, 0],
        [0, 0, 0]
    ]))).toBe(true);

    expect(areMatricesClose(solver.m_11, matrix([
        [m, 0, 0],
        [0, m, 0],
        [0, 0, 10]
    ]))).toBe(true);
});






test('fully restrained system is not kinematic', () => {
    const system = new StructuralSystem(
        [{ id: 1, x: 0, z: 0, mass: 1, restraint: { u: true, v: true, theta: true }, angle: 0}],
        []
    );
    const solver = new SystemSolver(system);
    expect(solver.isKinematic()).toBe(false);
    expect(solver.ndof_non_restrained).toBe(0);
});

// ─── solveDynamic ─────────────────────────────────────────────────────────────

test('solveDynamic — overdamped SDOF eigenvalues and time response', () => {
    const k = 400, c = 1000, m = 100;

    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 1, restraint: { u: true, v: true, theta: true }, angle: 0},
            { id: 2, x: 0, z: 1, mass: m, restraint: { u: true, v: false, theta: true }, angle: 0},
        ],
        [
            {
                id: 1, node_i: 1, node_j: 2, ea: k, ei: 1, c: c,
                releases_i: { u: false, v: false, theta: true },
                releases_j: { u: false, v: false, theta: true }
            }
        ]
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
        expect(sol.get_w(4, t)).toBeCloseTo(analytical(t), 6);
    }
});

*/