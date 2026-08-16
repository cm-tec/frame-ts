import { expect, test, vi } from "vitest";
import { StructuralLoads } from "./StructuralLoads";
import { getBeam } from "./testExamples";
import type { Loads } from "../models/inputModels";

const ACC = 12;

function elementLoad(id: number, element_id: number, q_i: number, q_j: number, angle: number) {
    return { id, element_id, q_i, q_j, angle, frequency: 0, phase_shift: 0 };
}

function nodalLoad(id: number, node_id: number, magnitude: number, angle: number) {
    return { id, node_id, magnitude, angle, frequency: 0, phase_shift: 0 };
}

function loadsOf(elements: Loads['elements'] = [], nodes: Loads['nodes'] = []): Loads {
    return { nodes, moments: [], elements };
}

test('an element load at angle 0 is purely axial', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf([elementLoad(1, 1, 5, 11, 0)]));
    const { q_trans, q_axial } = loads.ofElement(1);

    expect(q_trans.isZero).toBe(true);
    expect(q_axial.at(0)).toBeCloseTo(5, ACC);
    expect(q_axial.at(1)).toBeCloseTo(11, ACC);
});

test('an element load at angle 90 is purely transverse', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf([elementLoad(1, 1, 5, 11, 90)]));
    const { q_trans, q_axial } = loads.ofElement(1);

    expect(q_axial.isZero).toBe(true);
    expect(q_trans.at(0)).toBeCloseTo(5, ACC);
    expect(q_trans.at(1)).toBeCloseTo(11, ACC);
});

test('an element load at angle 45 splits evenly', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf([elementLoad(1, 1, 10, 10, 45)]));
    const { q_trans, q_axial } = loads.ofElement(1);

    expect(q_trans.at(0.5)).toBeCloseTo(10 / Math.SQRT2, ACC);
    expect(q_axial.at(0.5)).toBeCloseTo(10 / Math.SQRT2, ACC);
});

test('several loads on one element superpose', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf([
        elementLoad(1, 1, 3, 3, 90),
        elementLoad(2, 1, 0, 10, 90),
    ]));
    const { q_trans } = loads.ofElement(1);

    expect(q_trans.at(0)).toBeCloseTo(3, ACC);
    expect(q_trans.at(1)).toBeCloseTo(13, ACC);
    expect(q_trans.at(0.5)).toBeCloseTo(8, ACC);
});

test('loads at different angles superpose per component', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf([
        elementLoad(1, 1, 4, 4, 0),
        elementLoad(2, 1, 6, 6, 90),
    ]));
    const { q_trans, q_axial } = loads.ofElement(1);

    expect(q_axial.at(0.3)).toBeCloseTo(4, ACC);
    expect(q_trans.at(0.3)).toBeCloseTo(6, ACC);
});

test('an unloaded element reports zero', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf());

    expect(loads.ofElement(1).q_trans.isZero).toBe(true);
    expect(loads.ofElement(1).q_axial.isZero).toBe(true);
});

test('a nodal load at angle 0 acts along +x', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf([], [nodalLoad(1, 2, 25, 0)]));

    expect(loads.ofNode(2).fx).toBeCloseTo(25, ACC);
    expect(loads.ofNode(2).fy).toBeCloseTo(0, ACC);
});

test('a nodal load at angle 90 acts along +y, at 270 downwards', () => {
    const up = new StructuralLoads(getBeam(), loadsOf([], [nodalLoad(1, 2, 25, 90)]));

    expect(up.ofNode(2).fx).toBeCloseTo(0, ACC);
    expect(up.ofNode(2).fy).toBeCloseTo(25, ACC);

    const down = new StructuralLoads(getBeam(), loadsOf([], [nodalLoad(1, 2, 25, 270)]));

    expect(down.ofNode(2).fx).toBeCloseTo(0, ACC);
    expect(down.ofNode(2).fy).toBeCloseTo(-25, ACC);
});

test('several nodal loads on one node superpose', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf([], [
        nodalLoad(1, 2, 25, 0),
        nodalLoad(2, 2, 10, 90),
    ]));

    expect(loads.ofNode(2).fx).toBeCloseTo(25, ACC);
    expect(loads.ofNode(2).fy).toBeCloseTo(10, ACC);
});

test('an unloaded node reports zero', () => {
    const loads = new StructuralLoads(getBeam(), loadsOf());

    expect(loads.ofNode(1)).toEqual({ fx: 0, fy: 0, m: 0 });
});

test('loads referencing a missing element or node are warned about and dropped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const loads = new StructuralLoads(getBeam(), loadsOf(
        [elementLoad(1, 99, 5, 5, 0)],
        [nodalLoad(1, 99, 5, 0)],
    ));

    expect(warn).toHaveBeenCalledTimes(2);
    expect(loads.ofElement(99).q_trans.isZero).toBe(true);
    expect(loads.ofNode(99)).toEqual({ fx: 0, fy: 0, m: 0 });

    warn.mockRestore();
});
