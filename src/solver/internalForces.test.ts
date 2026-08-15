import { expect, test } from "vitest";
import { index, subset } from "mathjs";
import { StructuralSystem } from "./StructuralSystem";
import { SystemSolver } from "./SystemSolver";
import { StructuralLoads } from "./StructuralLoads";
import { assembleForceVector } from "./forceAssembly";
import { elementForceField } from "./internalForces";
import type { HingeInput, Loads } from "../models/inputModels";

const ACC = 9;

const DOWN = 270;

function fieldOf(system: StructuralSystem, loads: Loads, elementId: number) {
    const solver = new SystemSolver(system);
    const structuralLoads = new StructuralLoads(system, loads);
    const F = assembleForceVector(system, structuralLoads);
    const solution = solver.solveStatic(subset(F, index(solver.non_restrained, [0])));

    const element = system.elements.find(e => e.id === elementId)!;
    return elementForceField(element, structuralLoads, dof => solution.get_w(dof));
}

function beam(L: number, ea: number, ei: number, hinges: HingeInput[] = []) {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true, v: true, theta: false }, angle: 0 },
            { id: 2, x: L, z: 0, mass: 0, restraint: { u: false, v: true, theta: false }, angle: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 }],
        hinges,
    );
}

function cantilever(L: number, ea: number, ei: number) {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: L, z: 0, mass: 0, restraint: { u: false, v: false, theta: false }, angle: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 }],
    );
}

test('cantilever with a tip point load — V constant, M linear to -PL at the support', () => {
    const [L, P, ei] = [4, 7, 1000];
    const loads: Loads = { nodes: [{ id: 1, node_id: 2, magnitude: P, angle: DOWN, frequency: 0, phase_shift: 0 }], elements: [] };

    const { N, V, M } = fieldOf(cantilever(L, 1e9, ei), loads, 1);

    expect(N.isZero).toBe(true);

    // V = dM/dx, and M rises from -PL at the support to 0 at the tip
    expect(V.at(0)).toBeCloseTo(P, ACC);
    expect(V.at(1)).toBeCloseTo(P, ACC);

    expect(M.at(0)).toBeCloseTo(-P * L, ACC);
    expect(M.at(0.5)).toBeCloseTo(-P * L / 2, ACC);
    expect(M.at(1)).toBeCloseTo(0, ACC);
});

test('cantilever under UDL — V linear, M parabolic to -qL^2/2', () => {
    const [L, q, ei] = [4, 7, 1000];
    const loads: Loads = { nodes: [], elements: [{ id: 1, element_id: 1, q_i: q, q_j: q, angle: DOWN, frequency: 0, phase_shift: 0 }] };

    const { V, M } = fieldOf(cantilever(L, 1e9, ei), loads, 1);

    expect(V.at(0)).toBeCloseTo(q * L, ACC);
    expect(V.at(1)).toBeCloseTo(0, ACC);

    expect(M.at(0)).toBeCloseTo(-q * L * L / 2, ACC);
    expect(M.at(1)).toBeCloseTo(0, ACC);
});

test('simply supported beam under UDL — M is qL^2/8 at midspan and zero at both ends', () => {
    const [L, q, ei] = [3, 11, 1000];
    const loads: Loads = { nodes: [], elements: [{ id: 1, element_id: 1, q_i: q, q_j: q, angle: DOWN, frequency: 0, phase_shift: 0 }] };

    const { V, M } = fieldOf(beam(L, 1e9, ei), loads, 1);

    expect(M.at(0)).toBeCloseTo(0, ACC);
    expect(M.at(1)).toBeCloseTo(0, ACC);
    expect(M.at(0.5)).toBeCloseTo(q * L * L / 8, ACC);

    expect(V.at(0)).toBeCloseTo(q * L / 2, ACC);
    expect(V.at(0.5)).toBeCloseTo(0, ACC);
    expect(V.at(1)).toBeCloseTo(-q * L / 2, ACC);
});

test('dM/dx = V and dV/dx = q_trans hold as polynomial identities', () => {
    const [L, q, ei] = [3, 11, 1000];
    const loads: Loads = { nodes: [], elements: [{ id: 1, element_id: 1, q_i: q, q_j: 2 * q, angle: DOWN, frequency: 0, phase_shift: 0 }] };

    const { V, M } = fieldOf(beam(L, 1e9, ei), loads, 1);

    for (const xi of [0, 0.25, 0.5, 0.75, 1]) {
        const h = 1e-6;
        const dM = (M.at(xi + h) - M.at(xi - h)) / (2 * h * L);
        const dV = (V.at(xi + h) - V.at(xi - h)) / (2 * h * L);

        expect(dM).toBeCloseTo(V.at(xi), 5);
        expect(dV).toBeCloseTo(-(q + (2 * q - q) * xi), 5);
    }
});

test('a moment release reports exactly zero moment at that end', () => {
    const [L, q, ei] = [3, 11, 1000];
    const loads: Loads = { nodes: [], elements: [{ id: 1, element_id: 1, q_i: q, q_j: q, angle: DOWN, frequency: 0, phase_shift: 0 }] };

    const system = beam(L, 1e9, ei, [{ id: 1, element_id: 1, end: 'i', u: false, v: false, theta: true }]);
    const { M } = fieldOf(system, loads, 1);

    expect(M.at(0)).toBeCloseTo(0, ACC);
});

test('axial load gives a linear N, tension positive', () => {
    const [L, P, ea] = [4, 7, 1000];
    const loads: Loads = { nodes: [{ id: 1, node_id: 2, magnitude: P, angle: 0, frequency: 0, phase_shift: 0 }], elements: [] };

    const { N } = fieldOf(cantilever(L, ea, 1000), loads, 1);

    expect(N.at(0)).toBeCloseTo(P, ACC);
    expect(N.at(1)).toBeCloseTo(P, ACC);
});

test('the internal forces of an inclined member match the same member rotated flat', () => {
    const [L, q, ei] = [4, 7, 1000];
    const elementLoad = { id: 1, element_id: 1, q_i: q, q_j: q, angle: 90, frequency: 0, phase_shift: 0 };
    const loads: Loads = { nodes: [], elements: [elementLoad] };

    const flat = fieldOf(cantilever(L, 1e9, ei), loads, 1);

    const inclined = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: L * 0.6, z: L * 0.8, mass: 0, restraint: { u: false, v: false, theta: false }, angle: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea: 1e9, ei, c: 0 }],
    );
    const tilted = fieldOf(inclined, loads, 1);

    for (const xi of [0, 0.5, 1]) {
        expect(tilted.M.at(xi)).toBeCloseTo(flat.M.at(xi), 6);
        expect(tilted.V.at(xi)).toBeCloseTo(flat.V.at(xi), 6);
    }
});
