import { expect, test, vi } from 'vitest';
import { StructuralSystem } from './StructuralSystem';
import { SystemSolver } from './SystemSolver';
import type { ElementInput, NodeInput } from '../models/inputModels';

const NODES: NodeInput[] = [
    { id: 1, x: 0, z: 0, mass: 0, restraint: { u: true,  v: true,  theta: true  }, angle: 0 },
    { id: 2, x: 1, z: 0, mass: 0, restraint: { u: false, v: false, theta: false }, angle: 0 },
];

function systemWith(elements: ElementInput[], nodes: NodeInput[] = NODES) {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const system = new StructuralSystem(nodes, elements);
    warn.mockRestore();

    return system;
}

test('an element referencing a node that does not exist is dropped', () => {
    const system = systemWith([{ id: 1, node_i: 1, node_j: 99, ea: 1000, ei: 1000, c: 0 }]);

    expect(system.elements).toHaveLength(0);
});

test('an element whose two nodes coincide is dropped', () => {
    const coincident: NodeInput[] = [
        NODES[0],
        { ...NODES[1], x: 0, z: 0 },
    ];
    const system = systemWith([{ id: 1, node_i: 1, node_j: 2, ea: 1000, ei: 1000, c: 0 }], coincident);

    expect(system.elements).toHaveLength(0);
});

test('dropping a degenerate element keeps the stiffness matrix finite', () => {
    const coincident: NodeInput[] = [
        NODES[0],
        { ...NODES[1], x: 0, z: 0 },
    ];
    const system = systemWith([{ id: 1, node_i: 1, node_j: 2, ea: 1000, ei: 1000, c: 0 }], coincident);

    const solver = new SystemSolver(system);
    solver.k_11.forEach((value: number) => expect(Number.isFinite(value)).toBe(true));
});

test('the surviving elements are still assembled', () => {
    const system = systemWith([
        { id: 1, node_i: 1, node_j: 99, ea: 1000, ei: 1000, c: 0 },
        { id: 2, node_i: 1, node_j: 2,  ea: 1000, ei: 1000, c: 0 },
    ]);

    expect(system.elements.map(e => e.id)).toEqual([2]);
});
