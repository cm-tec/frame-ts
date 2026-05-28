import { expect, test } from 'vitest';
import { assembleForceVector } from './forceAssembly';
import { StructuralSystem } from './StructuralSystem';
import { matrix, zeros } from 'mathjs';

test('assembleForceVector - element load at different angles', () => {
    // Define a simple horizontal system of length L = 6.0
    // Node 1 at (0, 0), Node 2 at (6, 0)
    // Global DOFs:
    // Node 1: 0 (u), 1 (v), 2 (theta)
    // Node 2: 3 (u), 4 (v), 5 (theta)
    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: false, v: false, theta: false }, angle: 0 },
            { id: 2, x: 6, z: 0, mass: 0, restraint: { u: false, v: false, theta: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: 1000, ei: 1000, c: 0 },
        ]
    );

    // 1. Test standard perpendicular load (angle = 0 degrees)
    const load0 = {
        nodes: [],
        elements: [
            { id: 1, element_id: 1, q_i: 10, q_j: 10, angle: 0, frequency: 0, phase_shift: 0 }
        ]
    };
    const F0 = assembleForceVector(system, load0);
    // Transverse forces:
    // vi = 6/20 * (7*10 + 3*10) = 30
    // mi = 36/60 * (3*10 + 2*10) = 30
    // vj = 6/20 * (3*10 + 7*10) = 30
    // mj = -36/60 * (2*10 + 3*10) = -30
    // Global forces: F = [0, -vi, -mi, 0, -vj, -mj] = [0, -30, -30, 0, -30, 30]
    expect(F0.get([0, 0])).toBeCloseTo(0, 5);
    expect(F0.get([1, 0])).toBeCloseTo(-30, 5);
    expect(F0.get([2, 0])).toBeCloseTo(-30, 5);
    expect(F0.get([3, 0])).toBeCloseTo(0, 5);
    expect(F0.get([4, 0])).toBeCloseTo(-30, 5);
    expect(F0.get([5, 0])).toBeCloseTo(30, 5);

    // 2. Test purely axial load (angle = 90 degrees)
    const load90 = {
        nodes: [],
        elements: [
            { id: 1, element_id: 1, q_i: 10, q_j: 10, angle: 90, frequency: 0, phase_shift: 0 }
        ]
    };
    const F90 = assembleForceVector(system, load90);
    // Axial forces:
    // ui = 6/6 * (2*10 + 10) = 30
    // uj = 6/6 * (10 + 2*10) = 30
    // Global forces: F = [ui, 0, 0, uj, 0, 0] = [30, 0, 0, 30, 0, 0]
    expect(F90.get([0, 0])).toBeCloseTo(30, 5);
    expect(F90.get([1, 0])).toBeCloseTo(0, 5);
    expect(F90.get([2, 0])).toBeCloseTo(0, 5);
    expect(F90.get([3, 0])).toBeCloseTo(30, 5);
    expect(F90.get([4, 0])).toBeCloseTo(0, 5);
    expect(F90.get([5, 0])).toBeCloseTo(0, 5);

    // 3. Test inclined load (angle = 45 degrees)
    const load45 = {
        nodes: [],
        elements: [
            { id: 1, element_id: 1, q_i: 10, q_j: 10, angle: 45, frequency: 0, phase_shift: 0 }
        ]
    };
    const F45 = assembleForceVector(system, load45);
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);
    expect(F45.get([0, 0])).toBeCloseTo(30 * sin45, 5);
    expect(F45.get([1, 0])).toBeCloseTo(-30 * cos45, 5);
    expect(F45.get([2, 0])).toBeCloseTo(-30 * cos45, 5);
    expect(F45.get([3, 0])).toBeCloseTo(30 * sin45, 5);
    expect(F45.get([4, 0])).toBeCloseTo(-30 * cos45, 5);
    expect(F45.get([5, 0])).toBeCloseTo(30 * cos45, 5);
});