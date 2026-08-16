import { expect, test } from 'vitest';
import { index, subset } from 'mathjs';
import { assembleForceVector } from './forceAssembly';
import { Polynomial } from './Polynomial';
import { StructuralLoads } from './StructuralLoads';
import { StructuralSystem } from './StructuralSystem';
import { SystemSolver } from './SystemSolver';
import type { Loads } from '../models/inputModels';

const ACC = 9;

function horizontalBeam(nodeAngle: number = 0) {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
            { id: 2, x: 6, z: 0, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: nodeAngle },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: 1000, ei: 1000, c: 0 },
        ]
    );
}

function elementLoads(angle: number, q_i = 10, q_j = 10): Loads {
    return { nodes: [], elements: [{ id: 1, element_id: 1, q_i, q_j, angle, frequency: 0, phase_shift: 0 }] };
}

function assemble(system: StructuralSystem, loads: Loads) {
    return assembleForceVector(system, new StructuralLoads(system, loads));
}

test('element load perpendicular to the element (angle = 90)', () => {
    const system = horizontalBeam();
    const F = assemble(system, elementLoads(90));

    // 90 degrees from the element axis is local +v, so this load points upwards
    expect(F.get([0, 0])).toBeCloseTo(0, ACC);
    expect(F.get([1, 0])).toBeCloseTo(30, ACC);
    expect(F.get([2, 0])).toBeCloseTo(30, ACC);
    expect(F.get([3, 0])).toBeCloseTo(0, ACC);
    expect(F.get([4, 0])).toBeCloseTo(30, ACC);
    expect(F.get([5, 0])).toBeCloseTo(-30, ACC);
});

test('element load along the element (angle = 0)', () => {
    const system = horizontalBeam();
    const F = assemble(system, elementLoads(0));

    // ui = 6/6 * (2*10 + 10) = 30
    expect(F.get([0, 0])).toBeCloseTo(30, ACC);
    expect(F.get([1, 0])).toBeCloseTo(0, ACC);
    expect(F.get([2, 0])).toBeCloseTo(0, ACC);
    expect(F.get([3, 0])).toBeCloseTo(30, ACC);
    expect(F.get([4, 0])).toBeCloseTo(0, ACC);
    expect(F.get([5, 0])).toBeCloseTo(0, ACC);
});

test('element load at 45 degrees splits between both', () => {
    const system = horizontalBeam();
    const F = assemble(system, elementLoads(45));
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);

    expect(F.get([0, 0])).toBeCloseTo(30 * cos45, ACC);
    expect(F.get([1, 0])).toBeCloseTo(30 * sin45, ACC);
    expect(F.get([2, 0])).toBeCloseTo(30 * sin45, ACC);
    expect(F.get([3, 0])).toBeCloseTo(30 * cos45, ACC);
    expect(F.get([4, 0])).toBeCloseTo(30 * sin45, ACC);
    expect(F.get([5, 0])).toBeCloseTo(-30 * sin45, ACC);
});

test('a quadratic element load integrates exactly', () => {
    const system = horizontalBeam();
    const q = new Polynomial([0, 0, 12]);

    const stub = {
        ofElement: () => ({ q_trans: q, q_axial: Polynomial.ZERO }),
        ofNode: () => ({ fx: 0, fy: 0 }),
    } as unknown as StructuralLoads;

    const F = assembleForceVector(system, stub);

    expect(F.get([1, 0])).toBeCloseTo(6 * 12 / 15, ACC);
    expect(F.get([4, 0])).toBeCloseTo(6 * 12 * 4 / 15, ACC);
});

function nodalLoads(angle: number, magnitude = 100): Loads {
    return { nodes: [{ id: 1, node_id: 2, magnitude, angle, frequency: 0, phase_shift: 0 }], elements: [] };
}

test('nodal load angles are measured CCW from the x axis', () => {
    const system = horizontalBeam();

    const right = assemble(system, nodalLoads(0));
    expect(right.get([3, 0])).toBeCloseTo(100, ACC);
    expect(right.get([4, 0])).toBeCloseTo(0, ACC);

    const up = assemble(system, nodalLoads(90));
    expect(up.get([3, 0])).toBeCloseTo(0, ACC);
    expect(up.get([4, 0])).toBeCloseTo(100, ACC);

    const down = assemble(system, nodalLoads(270));
    expect(down.get([3, 0])).toBeCloseTo(0, ACC);
    expect(down.get([4, 0])).toBeCloseTo(-100, ACC);
});
