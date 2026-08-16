import { expect, test } from "vitest";
import { index, subset } from "mathjs";
import { StructuralSystem } from "./StructuralSystem";
import { SystemSolver } from "./SystemSolver";
import { StructuralLoads } from "./StructuralLoads";
import { assembleForceVector } from "./forceAssembly";
import { elementDisplacementField } from "./displacementField";
import type { HingeInput, Loads } from "../models/inputModels";

const ACC = 9;

const DOWN = 270;

function fieldOf(system: StructuralSystem, loads: Loads, elementId: number) {
    const solver = new SystemSolver(system);
    const structuralLoads = new StructuralLoads(system, loads);
    const F = assembleForceVector(system, structuralLoads);
    const solution = solver.solveStatic(F);

    const element = system.elements.find(e => e.id === elementId)!;
    return elementDisplacementField(element, structuralLoads, dof => solution.get_w(dof));
}

function udl(q: number): Loads {
    return { nodes: [], elements: [{ id: 1, element_id: 1, q_i: q, q_j: q, angle: DOWN, frequency: 0, phase_shift: 0 }] };
}

function beam(L: number, ea: number, ei: number, hinges: HingeInput[] = []) {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { D1: true, D2: true, D3: false }, angle: 0 },
            { id: 2, x: L, z: 0, mass: 0, restraint: { D1: false, D2: true, D3: false }, angle: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 }],
        hinges,
    );
}

function cantilever(L: number, ea: number, ei: number) {
    return new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { D1: true, D2: true, D3: true }, angle: 0 },
            { id: 2, x: L, z: 0, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
        ],
        [{ id: 1, node_i: 1, node_j: 2, ea, ei, c: 0 }],
    );
}

test('simply supported beam under UDL — midspan is 5qL^4/384EI, entirely from the interior', () => {
    const [L, q, ei] = [3, 11, 1000];
    const { v } = fieldOf(beam(L, 1e9, ei), udl(q), 1);

    // Both end displacements are zero, so the whole curve comes from integrating M.
    expect(v.at(0)).toBeCloseTo(0, ACC);
    expect(v.at(1)).toBeCloseTo(0, ACC);
    expect(v.at(0.5)).toBeCloseTo(-5 * q * L ** 4 / (384 * ei), ACC);
});

test('cantilever under UDL — tip is qL^4/8EI and midspan 17qL^4/384EI', () => {
    const [L, q, ei] = [4, 7, 1000];
    const { v } = fieldOf(cantilever(L, 1e9, ei), udl(q), 1);

    expect(v.at(0)).toBeCloseTo(0, ACC);
    expect(v.at(0.5)).toBeCloseTo(-17 * q * L ** 4 / (384 * ei), ACC);
    expect(v.at(1)).toBeCloseTo(-q * L ** 4 / (8 * ei), ACC);
});

test('cantilever with a tip load — tip is PL^3/3EI', () => {
    const [L, P, ei] = [4, 7, 1000];
    const loads: Loads = { nodes: [{ id: 1, node_id: 2, magnitude: P, angle: DOWN, frequency: 0, phase_shift: 0 }], elements: [] };

    const { v } = fieldOf(cantilever(L, 1e9, ei), loads, 1);

    expect(v.at(1)).toBeCloseTo(-P * L ** 3 / (3 * ei), ACC);
    expect(v.at(0.5)).toBeCloseTo(-5 * P * L ** 3 / (48 * ei), ACC);
});

test('axial load stretches the bar linearly to PL/EA', () => {
    const [L, P, ea] = [4, 7, 1000];
    const loads: Loads = { nodes: [{ id: 1, node_id: 2, magnitude: P, angle: 0, frequency: 0, phase_shift: 0 }], elements: [] };

    const { u } = fieldOf(cantilever(L, ea, 1000), loads, 1);

    expect(u.at(0)).toBeCloseTo(0, ACC);
    expect(u.at(0.5)).toBeCloseTo(P * L / (2 * ea), ACC);
    expect(u.at(1)).toBeCloseTo(P * L / ea, ACC);
});

test('the ends of the curve are the nodal displacements the solver produced', () => {
    const [L, q, ei] = [3, 11, 1000];

    const system = new StructuralSystem(
        [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { D1: true, D2: true, D3: false }, angle: 0 },
            { id: 2, x: L, z: 0, mass: 0, restraint: { D1: false, D2: false, D3: false }, angle: 0 },
            { id: 3, x: 2 * L, z: 0, mass: 0, restraint: { D1: false, D2: true, D3: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea: 1e9, ei, c: 0 },
            { id: 2, node_i: 2, node_j: 3, ea: 1e9, ei, c: 0 },
        ],
    );
    const loads: Loads = {
        nodes: [],
        elements: [
            { id: 1, element_id: 1, q_i: q, q_j: q, angle: DOWN, frequency: 0, phase_shift: 0 },
            { id: 2, element_id: 2, q_i: q, q_j: q, angle: DOWN, frequency: 0, phase_shift: 0 },
        ],
    };

    const solver = new SystemSolver(system);
    const structuralLoads = new StructuralLoads(system, loads);
    const F = assembleForceVector(system, structuralLoads);
    const solution = solver.solveStatic(F);
    const get = (dof: number) => solution.get_w(dof);

    const first = elementDisplacementField(system.elements[0], structuralLoads, get);
    const second = elementDisplacementField(system.elements[1], structuralLoads, get);

    const midNode = solution.get_w(system.nodes[1].dofs[1]);

    expect(first.v.at(1)).toBeCloseTo(midNode, ACC);
    expect(second.v.at(0)).toBeCloseTo(midNode, ACC);
});

test('a moment release needs no special case — the curve stays continuous through it', () => {
    const [L, q, ei] = [3, 11, 1000];
    const hinged = beam(L, 1e9, ei, [{ id: 1, element_id: 1, end: 'i', D1: false, D2: false, D3: true }]);

    const { v } = fieldOf(hinged, udl(q), 1);

    expect(v.at(0)).toBeCloseTo(0, ACC);
    expect(v.at(1)).toBeCloseTo(0, ACC);
    // Propped cantilever, released at i: maximum sag is 0.0054 * q L^4 / EI near mid-span.
    expect(v.at(0.5)).toBeLessThan(0);
});

test('a truss member with EI = 0 stays straight instead of dividing by zero', () => {
    const [L, ei] = [3, 0];
    const trussy = beam(L, 1000, ei, [
        { id: 1, element_id: 1, end: 'i', D1: false, D2: false, D3: true },
        { id: 2, element_id: 1, end: 'j', D1: false, D2: false, D3: true },
    ]);

    const { v } = fieldOf(trussy, { nodes: [], elements: [] }, 1);

    expect(Number.isFinite(v.at(0.5))).toBe(true);
    expect(v.degree).toBeLessThanOrEqual(1);
});
