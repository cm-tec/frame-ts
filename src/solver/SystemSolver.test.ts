import { expect, test } from 'vitest';
import { StructuralSystem } from './StructuralSystem';
import { SystemSolver } from './SystemSolver';
import { abs, matrix, max, sqrt, subtract, zeros } from 'mathjs';
import { assembleForceVector } from './forceAssembly';
import { StructuralLoads } from './StructuralLoads';
import type { Loads } from '../models/inputModels';
import {
    getBeam, getRotatedBeam, getCantilever, getCantileverThroughReleases,
    getFlippedCantilever, getBeamWithCenterNode, getPortalFrame, getCantileverWithSupport,
} from './testExamples';


const ACC = 10;

function solveWith(system: StructuralSystem, loads: Loads) {
    const solver = new SystemSolver(system);
    const F = assembleForceVector(system, new StructuralLoads(system, loads));

    return solver.solveStatic(F);
}

function nodalLoad(node_id: number, magnitude: number, angle: number) {
    return { id: node_id, node_id, magnitude, angle, frequency: 0, phase_shift: 0 };
}

function elementLoad(element_id: number, q: number) {
    return { id: element_id, element_id, q_i: q, q_j: q, angle: 270, frequency: 0, phase_shift: 0 };
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
    expect(areMatricesClose(solver.m_11, matrix([[0, 0, 0], [0, m, 0], [0, 0, 0]]))).toBe(true);
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
    expect(areMatricesClose(solver.m_11, matrix([[m, 0, 0], [0, m, 0], [0, 0, 0]]))).toBe(true);
    expect(areMatricesClose(solver.m_22, matrix([[m, 0, 0], [0, m, 0], [0, 0, 0]]))).toBe(true);
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
            { id: 1, x: 0, z: 0, mass: m, restraint: { D1: true, D2: true, D3: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: m, restraint: { D1: false, D2: true, D3: true }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: ea, ei: ei, c: c },
        ],
        [
            { id: 1, element_id: 1, end: 'j', D1: false, D2: true, D3: true }
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
        [ea,  0,       0          ],
        [0,   12 * ei, 6 * ei ],
        [0,   6 * ei,  4 * ei ]
    ]);
    expect(areMatricesClose(solver.k_11, expected_k_11)).toBe(true);

    const expected_k_12 = matrix([
        [ea,  0,          0         ],
        [0,   12 * ei,    6 * ei],
        [0,   6 * ei, 2 * ei    ]
    ]);
    expect(areMatricesClose(solver.k_12, expected_k_12)).toBe(true);

    const expected_c_11 = matrix([
        [c, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ]);
    expect(areMatricesClose(solver.c_11, expected_c_11)).toBe(true);
    
    expect(areMatricesClose(solver.c_12, matrix([
        [c, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ]))).toBe(true);

    expect(areMatricesClose(solver.m_11, matrix([
        [m, 0, 0],
        [0, m, 0],
        [0, 0, 0]
    ]))).toBe(true);
});






test('fully restrained system is not kinematic', () => {
    const system = new StructuralSystem(
        [{ id: 1, x: 0, z: 0, mass: 1, restraint: { D1: true, D2: true, D3: true }, angle: 0}],
        []
    );
    const solver = new SystemSolver(system);
    expect(solver.isKinematic()).toBe(false);
    expect(solver.ndof_non_restrained).toBe(0);
});

// ─── solveDynamic ─────────────────────────────────────────────────────────────

test('solveDynamic — overdamped SDOF eigenvalues and time response', () => {
    const k = 400, c = 1000, m = 100;

    const system = StructuralSystem.createPureTruss(
        [
            { id: 1, x: 0, z: 0, mass: 1, restraint: { D1: true, D2: true, D3: true }, angle: 0},
            { id: 2, x: 0, z: 1, mass: m, restraint: { D1: true, D2: false, D3: true }, angle: 0},
        ],
        [
            {
                id: 1, node_i: 1, node_j: 2, ea: k, ei: 1, c: c
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






// Test the solution of a static system

test('solveStatic — cantilever with a moment at the free end', () => {
    const [ea, ei, M] = [7, 11, 13];
    const system = getCantilever(ea, ei);
    const L = 1.0;

    const sol = solveWith(system, {
        nodes: [],
        moments: [{ id: 1, node_id: 2, magnitude: M, frequency: 0, phase_shift: 0 }],
        elements: [],
    });

    expect(sol.get_w(4)).toBeCloseTo(M * L * L / (2 * ei), ACC);
    expect(sol.get_w(5)).toBeCloseTo(M * L / ei, ACC);

    expect(sol.get_r(2)).toBeCloseTo(-M, ACC);
});

test('solveStatic — beam with central point load', () => {
    const [ea, ei, P] = [7, 11, 13];
    const system = getBeamWithCenterNode(ea, ei);

    const sol = solveWith(system, { nodes: [nodalLoad(2, P, 270)], moments: [], elements: [] });

    const L = 1.0;
    const expectedDeflection = (P * Math.pow(L, 3)) / (48 * ei);
    const expectedBoundarySlope = (P * Math.pow(L, 2)) / (16 * ei);

    expect(sol.get_w(0)).toBe(0);
    expect(sol.get_w(1)).toBe(0);
    expect(sol.get_w(2)).toBeCloseTo(-expectedBoundarySlope, ACC);

    expect(sol.get_w(3)).toBe(0);
    expect(sol.get_w(4)).toBeCloseTo(-expectedDeflection, ACC);
    expect(sol.get_w(5)).toBe(0);

    expect(sol.get_w(6)).toBe(0);
    expect(sol.get_w(7)).toBe(0);
    expect(sol.get_w(8)).toBeCloseTo(expectedBoundarySlope, ACC);
});


test('solveStatic — beam with uniform distributed load (UDL)', () => {
    const [ea, ei, q] = [7, 11, 13];
    const system = getBeamWithCenterNode(ea, ei);

    const L = 1.0;

    const sol = solveWith(system, { nodes: [], moments: [], elements: [elementLoad(1, q), elementLoad(2, q)] });

    const expectedDeflection = (5 * q * Math.pow(L, 4)) / (384 * ei);
    const expectedBoundarySlope = (q * Math.pow(L, 3)) / (24 * ei);


    expect(sol.get_w(0)).toBe(0);
    expect(sol.get_w(1)).toBe(0);
    expect(sol.get_w(2)).toBeCloseTo(-expectedBoundarySlope, ACC);


    expect(sol.get_w(3)).toBe(0);
    expect(sol.get_w(4)).toBeCloseTo(-expectedDeflection, ACC);
    expect(sol.get_w(5)).toBe(0);

    expect(sol.get_w(6)).toBe(0);
    expect(sol.get_w(7)).toBe(0);
    expect(sol.get_w(8)).toBeCloseTo(expectedBoundarySlope, ACC);
});







test('solveStatic - Frame under point load', () => {
    const [ea, ei] = [1, 1];
    const system = getPortalFrame(ea, ei);

    const sol = solveWith(system, { nodes: [nodalLoad(2, Math.SQRT2, 315)], moments: [], elements: [] });

    expect(sol.get_w(0)).toBe(0);
    expect(sol.get_w(1)).toBe(0);
    expect(sol.get_w(2)).toBeCloseTo(-11/6, ACC);

    // Node 2 (Top Left Corner Joint)
    expect(sol.get_w(3)).toBeCloseTo(5/3, ACC);
    expect(sol.get_w(4)).toBeCloseTo(0, 5);
    expect(sol.get_w(5)).toBeCloseTo(-4/3, 5);

    // Node 3 (Top Right Corner Joint)
    expect(sol.get_w(6)).toBeCloseTo(5/3, 5);
    expect(sol.get_w(7)).toBeCloseTo(-1, 5);
    expect(sol.get_w(8)).toBeCloseTo(-5/6, 5);

    // Node 4 (Base Right - Pinned translation)
    expect(sol.get_w(9)).toBe(0);
    expect(sol.get_w(10)).toBe(0);
    expect(sol.get_w(11)).toBeCloseTo(-5/3, ACC);
});

test('solveStatic — cantilever arm with additional strut support', () => {
    const [ea, ei, q] = [1, 1, 1];
    const system = getCantileverWithSupport(ea, ei);

    const sol = solveWith(system, { nodes: [], moments: [], elements: [elementLoad(1, q)] });

    expect(sol.get_w(0)).toBe(0);
    expect(sol.get_w(1)).toBe(0);
    expect(sol.get_w(2)).toBe(0);

    expect(sol.get_w(3)).toBe(0);
    expect(sol.get_w(4)).toBeCloseTo(-3 / 32, 5);
    expect(sol.get_w(5)).toBeCloseTo(-23 / 192, 5);

    expect(sol.get_w(6)).toBe(0);
    expect(sol.get_w(7)).toBe(0);
    expect(sol.get_w(8)).toBe(0);
});

test('solveStatic — reaction forces of beam', () => {
    const [ea, ei, P] = [7, 11, 13];
    const system = getBeamWithCenterNode(ea, ei);

    const sol = solveWith(system, { nodes: [nodalLoad(2, P, 270)], moments: [], elements: [] });

    expect(sol.get_r(0)).toBe(0);
    expect(sol.get_r(1)).toBeCloseTo(P/2, ACC);
    expect(sol.get_r(2)).toBe(0);

    expect(sol.get_r(3)).toBe(0);
    expect(sol.get_r(4)).toBeCloseTo(0);
    expect(sol.get_r(5)).toBeCloseTo(0);

    expect(sol.get_r(6)).toBe(0);
    expect(sol.get_r(7)).toBeCloseTo(P/2, ACC);
    expect(sol.get_r(8)).toBe(0);
});

test('solveStatic — reaction forces of frame', () => {
 const [ea, ei] = [1, 1];
    const system = getPortalFrame(ea, ei);

    const sol = solveWith(system, { nodes: [nodalLoad(2, Math.SQRT2, 315)], moments: [], elements: [] });

    expect(sol.get_r(0)).toBeCloseTo(-1, ACC);
    expect(sol.get_r(1)).toBeCloseTo(0, ACC);
    expect(sol.get_r(2)).toBe(0);

    expect(sol.get_r(3)).toBe(0);
    expect(sol.get_r(4)).toBeCloseTo(0);
    expect(sol.get_r(5)).toBeCloseTo(0);

    expect(sol.get_r(6)).toBe(0);
    expect(sol.get_r(7)).toBe(0);
    expect(sol.get_r(8)).toBe(0);


    expect(sol.get_r(9)).toBeCloseTo(0, ACC);
    expect(sol.get_r(10)).toBeCloseTo(1, ACC);
    expect(sol.get_r(11)).toBe(0);
});

test('solveStatic — reaction forces of cantilever arm with additional strut support', () => {
    const [ea, ei, q] = [1, 1, 1];
    const system = getCantileverWithSupport(ea, ei);

    const sol = solveWith(system, { nodes: [], moments: [], elements: [elementLoad(1, q)] });

    // The two supports carry the whole span load of q * L = 1.
    const fixedEnd = sol.get_r(system.nodes[0].dofs[1]);
    const strutBase = sol.get_r(system.nodes[2].dofs[1]);

    expect(fixedEnd + strutBase).toBeCloseTo(q * 1, ACC);
    expect(fixedEnd).toBeCloseTo(29 / 32, ACC);
});

test('a reaction includes the load applied directly at that support', () => {
    const [ea, ei, P] = [1e9, 1000, 7];
    const system = getCantilever(ea, ei);
    const support = system.nodes[0];

    // Everything is restrained at node 1, so the structure does not move at all and the
    // support alone carries the load. A reaction of K_21*w would read zero here.
    const sol = solveWith(system, { nodes: [nodalLoad(1, P, 270)], moments: [], elements: [] });

    expect(sol.get_r(support.dofs[1])).toBeCloseTo(P, ACC);
});

test('a reaction includes the fixed-end forces of a span load reaching the support', () => {
    const [ea, ei, q] = [1e9, 1000, 7];
    const L = 1;
    const system = getCantilever(ea, ei);
    const support = system.nodes[0];

    const sol = solveWith(system, { nodes: [], moments: [], elements: [elementLoad(1, q)] });

    // The single support carries the whole span load and its moment about the support.
    expect(sol.get_r(support.dofs[1])).toBeCloseTo(q * L, ACC);
    expect(sol.get_r(support.dofs[2])).toBeCloseTo(q * L * L / 2, ACC);
});


test('a free node without mass leaves the mass matrix singular', () => {
    const system = StructuralSystem.createPureTruss(
        [
            { id: 1, x: 0, z: 0, mass: 5, restraint: { D1: true,  D2: true,  D3: false }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea: 1000, ei: 0, c: 0 }],
    );

    expect(new SystemSolver(system).hasMasslessDofs()).toBe(true);
});

test('a system carrying mass at every free node is not flagged', () => {
    const system = StructuralSystem.createPureTruss(
        [
            { id: 1, x: 0, z: 0, mass: 5, restraint: { D1: true,  D2: true,  D3: false }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: 5, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea: 1000, ei: 0, c: 0 }],
    );

    expect(new SystemSolver(system).hasMasslessDofs()).toBe(false);
});
