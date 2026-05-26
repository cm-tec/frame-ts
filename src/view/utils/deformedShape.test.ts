import { expect, test } from "vitest";
import { getBeamWithCenterNode } from "../../solver/testExamples";
import { SystemSolver } from "../../solver/SystemSolver";
import { matrix } from "mathjs";
import { elementDisplacementAt } from "./deformedShape";
import { StructuralSystem } from "../../solver/StructuralSystem";

const ACC = 12;

test('elementDisplacementAt — beam with central point load', () => {
    const [ea, ei, P] = [7, 11, 13];
    const system = getBeamWithCenterNode(ea, ei);

    let f = matrix([0, 0, -P, 0, 0, 0]);
    const sol = new SystemSolver(system).solveStatic(f);

    let el = system.elements[0];
    let n_i = system.nodes[0];
    let n_j = system.nodes[1];
    
    // Element 1 spans x=0->0.5; xi=0.5 is at global x=0.25
    let {u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.5);

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-13/768, ACC);


    el = system.elements[1];
    n_i = system.nodes[1];
    n_j = system.nodes[2];
    
    // Element 2 spans x=0.5->1; xi=0.5 is at global x=0.75
    ({ u, v } = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.5));

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-13/768, ACC);
});


test('elementDisplacementAt — beam with uniform distributed load (UDL)', () => {
    const [ea, ei, q] = [7, 11, 13];
    const system = getBeamWithCenterNode(ea, ei);

    const L = 1.0;
    const l = L / 2;

    const m_fixed = (q * Math.pow(l, 2)) / 12;
    const v_fixed_center = (q * l / 2) + (q * l / 2);

    let f = matrix([-m_fixed, 0, -v_fixed_center, 0, 0, m_fixed]);

    const sol = new SystemSolver(system).solveStatic(f);

    let el = system.elements[0];
    let n_i = system.nodes[0];
    let n_j = system.nodes[1];
    
    // Validate displacement at center x=0.5
    let {u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 1, { qi: q, qj: q });

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-65/4224, ACC);


    // Validate displacement for x=0.25
    ({ u, v } = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.5, { qi: q, qj: q }));

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-0.010963, 5);

    el = system.elements[1];
    n_i = system.nodes[1];
    n_j = system.nodes[2];

    // Validate displacement for x=0.75
    ({ u, v } = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.5, { qi: q, qj: q }));

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-0.010963, 5);
});


test('elementDisplacementAt — beam with uniform load and released joints', () => {
    const [ea, ei, q] = [7, 11, 13];
    const system = new StructuralSystem(
         [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: 0, restraint: { u: false, v: true, theta: true }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c:0 },
        ],
        [
             { id: 1, element_id: 1, end: 'i', u: false, v: false, theta: true },
             { id: 2, element_id: 1, end: 'j', u: false, v: false, theta: true },
        ]
    )

    let f = matrix([0]);

    const sol = new SystemSolver(system).solveStatic(f);

    let el = system.elements[0];
    let n_i = system.nodes[0];
    let n_j = system.nodes[1];
    
    // Validate displacement at center x=0.5
    let {u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.5, { qi: q, qj: q });

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-65/4224, ACC);
});


test('elementDisplacementAt — beam with rotational anti-symmetric distributed load', () => {
    const [ea, ei, q] = [1, 1, 1];
    const system = new StructuralSystem(
         [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true, v: true, theta: false }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: 0, restraint: { u: false, v: true, theta: false }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c:0 },
        ],
    )

    const l = 1.0;

    const m_fixed = (q * Math.pow(l, 2)) / 60;

    let f = matrix([-m_fixed, 0, -m_fixed]);

    const sol = new SystemSolver(system).solveStatic(f);

    let el = system.elements[0];
    let n_i = system.nodes[0];
    let n_j = system.nodes[1];
    
    // Validate displacement at center x=0.5
    let {u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.5, { qi: q, qj: -q });

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(0, ACC);

    // Validate displacement at x=0..25
    ({u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.25, { qi: q, qj: -q }));

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-5/12288, ACC);

    // Validate displacement at center x=0..0.75
    ({u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.75, { qi: q, qj: -q }));

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(5/12288, ACC);
});


test('elementDisplacementAt — beam with center node and rotational anti-symmetric distributed load', () => {
    const [ea, ei, q] = [1, 1, 1];
    const system = getBeamWithCenterNode(ea,ei)

    const L = 1.0;
    const l = L / 2;

    let f = matrix([-1/80, 0, 0, 1/60, 0, -1/80]);

    const sol = new SystemSolver(system).solveStatic(f);

    let el = system.elements[0];
    let n_i = system.nodes[0];
    let n_j = system.nodes[1];
    
    // Validate displacement at center x=0.5
    let {u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 1, { qi: q, qj: 0 });

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(0, ACC);

    // Validate displacement at x=0..25
    ({u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.5, { qi: q, qj: 0 }));

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-5/12288, ACC);
});


test('elementDisplacementAt — beam with released dof isnt affected by neighboring rotation', () => {
    const [ea, ei, q] = [7, 11, 13];
    const system = new StructuralSystem(
         [
            { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true, v: true, theta: true }, angle: 0 },
            { id: 2, x: 1, z: 0, mass: 0, restraint: { u: false, v: true, theta: true }, angle: 0 },
            { id: 3, x: 1, z: 0, mass: 0, restraint: { u: false, v: true, theta: true }, angle: 0 },
        ],
        [
            { id: 1, node_i: 1, node_j: 2, ea, ei, c:0 },
        ],
        [
             { id: 1, element_id: 1, end: 'i', u: false, v: false, theta: true },
             { id: 2, element_id: 1, end: 'j', u: false, v: false, theta: true },
        ]
    )

    let f = matrix([0]);

    const sol = new SystemSolver(system).solveStatic(f);

    let el = system.elements[0];
    let n_i = system.nodes[0];
    let n_j = system.nodes[1];
    
    // Validate displacement at center x=0.5
    let {u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 1, { qi: q, qj: 0 });

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(0, ACC);

    // Validate displacement at x=0..25
    ({u, v} = elementDisplacementAt(el, n_i, n_j, (dof) => sol.get_w(dof), 0.5, { qi: q, qj: 0 }));

    expect(u).toBeCloseTo(0, ACC);
    expect(v).toBeCloseTo(-5/12288, ACC);
});



