import { expect, test } from 'vitest';
import { StructuralSystem } from './StructuralSystem';
import { SystemSolver } from './SystemSolver';
import { matrix } from 'mathjs';




test('bernoulli beam', () => {
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true },
            { id: 2, x: 1, z: 0, mass: 1, restrained_u: false, restrained_v: true },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: 1, ei: 1, c: 1 },
        ]
    );

    const solver = new SystemSolver(system);

    expect(solver.restrained).toStrictEqual([0, 1, 4]);
    expect(solver.non_restrained).toStrictEqual([2, 3, 5]);

    expect(solver.ndof_restrained).toBe(3);
    expect(solver.ndof_non_restrained).toBe(3);

    expect(solver.non_restrained).toStrictEqual([2, 3, 5]);


    expect(solver.k_11).toStrictEqual(matrix([
        [4, 0, 2],
        [0, 1, 0],
        [2, 0, 4]
    ]))

    expect(solver.k_22).toStrictEqual(matrix([
        [1, 0, 0],
        [0, 12, -12],
        [0, -12, 12]
    ]))
});



test('right angle', () => {
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, restrained_phi: true },
            { id: 2, x: 1, z: 0, mass: 1, restrained_u: false, restrained_v: false, restrained_phi: false },
            { id: 3, x: 1, z: 1, mass: 1, restrained_u: false, restrained_v: false, restrained_phi: false },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: 1, ei: 1, c: 1 },
            { id: 2, node_i: 2, node_j: 3, ea: 1, ei: 1, c: 1 },
        ]
    );

    const solver = new SystemSolver(system);

    expect(solver.restrained).toStrictEqual([0, 1, 2]);
    expect(solver.non_restrained).toStrictEqual([3, 4, 5, 6, 7, 8]);

    expect(solver.ndof_restrained).toBe(3);
    expect(solver.ndof_non_restrained).toBe(6);

});


