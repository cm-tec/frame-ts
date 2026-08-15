import { expect, test } from 'vitest';
import { StructuralLoads } from '../solver/StructuralLoads';
import { getBeam } from '../solver/testExamples';
import { toSolverAngles } from './loadConventions';
import type { Loads } from './inputModels';

const ACC = 12;

function editorLoads(loads: Partial<Loads>): Loads {
    return { nodes: [], elements: [], ...loads };
}

test('an editor nodal load at 0 degrees still pulls downwards', () => {
    const loads = editorLoads({ nodes: [{ id: 1, node_id: 2, magnitude: 25, angle: 0, frequency: 0, phase_shift: 0 }] });
    const resolved = new StructuralLoads(getBeam(), toSolverAngles(loads));

    expect(resolved.ofNode(2).fx).toBeCloseTo(0, ACC);
    expect(resolved.ofNode(2).fy).toBeCloseTo(-25, ACC);
});

test('an editor nodal load at 90 degrees still points to the right', () => {
    const loads = editorLoads({ nodes: [{ id: 1, node_id: 2, magnitude: 25, angle: 90, frequency: 0, phase_shift: 0 }] });
    const resolved = new StructuralLoads(getBeam(), toSolverAngles(loads));

    expect(resolved.ofNode(2).fx).toBeCloseTo(25, ACC);
    expect(resolved.ofNode(2).fy).toBeCloseTo(0, ACC);
});

test('an editor element load at 0 degrees still presses onto the member', () => {
    const loads = editorLoads({ elements: [{ id: 1, element_id: 1, q_i: 7, q_j: 7, angle: 0, frequency: 0, phase_shift: 0 }] });
    const resolved = new StructuralLoads(getBeam(), toSolverAngles(loads));

    // Perpendicular and pushing down, which is local -v.
    expect(resolved.ofElement(1).q_axial.isZero).toBe(true);
    expect(resolved.ofElement(1).q_trans.at(0.5)).toBeCloseTo(-7, ACC);
});

test('an editor element load at 90 degrees still acts along the member', () => {
    const loads = editorLoads({ elements: [{ id: 1, element_id: 1, q_i: 7, q_j: 7, angle: 90, frequency: 0, phase_shift: 0 }] });
    const resolved = new StructuralLoads(getBeam(), toSolverAngles(loads));

    expect(resolved.ofElement(1).q_trans.isZero).toBe(true);
    expect(resolved.ofElement(1).q_axial.at(0.5)).toBeCloseTo(7, ACC);
});