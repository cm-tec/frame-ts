import React, { useCallback, useMemo } from 'react';
import { ActionIcon, Box, Button, Checkbox, Divider, Flex, Group, NumberInput, ScrollArea, SegmentedControl, Stack, Table, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import { type Node, type Element, type Hinge, type InitialConditions, type Loads, type NodalLoad, type ElementLoad } from "../../models/models";
import { StructuralSystem } from '../../solver/StructuralSystem';
import StructuralSystemViewer, { type Theme } from '../components/StructuralSystemViewer';

const SIDEBAR_WIDTH = 420;
const ID_COL_WIDTH  = 60;

const BLUEPRINT_THEME: Partial<Theme> = {
    nodeStroke:        'rgba(255,255,255,1)',
    nodeFill:          'rgba(255,255,255,1)',
    nodeCircleFill:    'rgba(255,255,255,1)',
    nodeText:          'rgba(255,255,255,1)',
    supportFill:       'rgba(255,255,255,0.15)',
    elementStroke:     'rgba(255,255,255,0.75)',
    elementLabelFill:  'rgba(10,37,64,0.85)',
    elementLabelStroke:'rgba(255,255,255,0.25)',
    elementLabelText:  'rgba(255,255,255,1)',
    gridLine:          'rgba(255,255,255,0.10)',
    gridLabel:         'rgba(255,255,255,0.35)',
    hingeFill:         '#0a2540',
    hingeStroke:       'rgba(255,255,255,0.75)',  // matches elementStroke
};

interface EditorProps {
    view: 'dynamic' | 'static';
    nodes: Node[];
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    elements: Element[];
    setElements: React.Dispatch<React.SetStateAction<Element[]>>;
    hinges: Hinge[];
    setHinges: React.Dispatch<React.SetStateAction<Hinge[]>>;
    initialConditions: InitialConditions;
    setInitialConditions: React.Dispatch<React.SetStateAction<InitialConditions>>;
    loads: Loads;
    setLoads: React.Dispatch<React.SetStateAction<Loads>>;
}

export default function Editor({ view, nodes, setNodes, elements, setElements, hinges, setHinges, initialConditions, setInitialConditions, loads, setLoads }: EditorProps) {

    const updateNode = (id: number, patch: Partial<Omit<Node, 'id'>>) =>
        setNodes(r => r.map(row => row.id === id ? { ...row, ...patch } : row));

    const IC_DEFAULTS: InitialConditions[number] = { u0: 0, du0: 0, v0: 0, dv0: 0, theta0: 0, dtheta0: 0 };
    const updateInitialCondition = (nodeId: number, patch: Partial<InitialConditions[number]>) =>
        setInitialConditions(prev => ({
            ...prev,
            [nodeId]: { ...IC_DEFAULTS, ...prev[nodeId], ...patch },
        }));

    const NODAL_LOAD_DEFAULTS: Omit<NodalLoad, 'id' | 'node_id'> = { magnitude: 0, angle: 0, frequency: 0, phase_shift: 0 };
    const ELEMENT_LOAD_DEFAULTS: Omit<ElementLoad, 'id' | 'element_id'> = { q_i: 0, q_j: 0, angle: 0, frequency: 0, phase_shift: 0 };
    const nextLoadId = (list: { id: number }[]) => list.length ? Math.max(...list.map(l => l.id)) + 1 : 1;

    const addNodalLoad = () => setLoads(prev => ({
        ...prev,
        nodes: [...prev.nodes, { id: nextLoadId(prev.nodes), node_id: nodes[0]?.id ?? 0, ...NODAL_LOAD_DEFAULTS }],
    }));
    const updateNodalLoad = (id: number, patch: Partial<NodalLoad>) =>
        setLoads(prev => ({ ...prev, nodes: prev.nodes.map(l => l.id === id ? { ...l, ...patch } : l) }));
    const deleteNodalLoad = (id: number) =>
        setLoads(prev => ({ ...prev, nodes: prev.nodes.filter(l => l.id !== id) }));

    const addElementLoad = () => setLoads(prev => ({
        ...prev,
        elements: [...prev.elements, { id: nextLoadId(prev.elements), element_id: elements[0]?.id ?? 0, ...ELEMENT_LOAD_DEFAULTS }],
    }));
    const updateElementLoad = (id: number, patch: Partial<ElementLoad>) =>
        setLoads(prev => ({ ...prev, elements: prev.elements.map(l => l.id === id ? { ...l, ...patch } : l) }));
    const deleteElementLoad = (id: number) =>
        setLoads(prev => ({ ...prev, elements: prev.elements.filter(l => l.id !== id) }));

    const deleteNode = (id: number) =>
        setNodes(r => r.filter(row => row.id !== id));

    const updateElement = (id: number, patch: Partial<Omit<Element, 'id'>>) =>
        setElements(r => r.map(row => row.id === id ? { ...row, ...patch } : row));

    const deleteElement = (id: number) =>
        setElements(r => r.filter(row => row.id !== id));

    const addHinge = () => {
        const nextId = hinges.length ? Math.max(...hinges.map(h => h.id)) + 1 : 1;
        setHinges(r => [...r, { id: nextId, element_id: elements[0]?.id ?? 1, end: 'i', u: false, v: false, theta: true }]);
    };
    const updateHinge = (id: number, patch: Partial<Hinge>) =>
        setHinges(r => r.map(h => h.id === id ? { ...h, ...patch } : h));
    const deleteHinge = (id: number) =>
        setHinges(r => r.filter(h => h.id !== id));

    const addNode = () => {
        const nextId = nodes.length ? Math.max(...nodes.map((r) => r.id)) + 1 : 1;
        setNodes((r) => [...r, {
            id: nextId, x: 0, z: 0, mass: 0,
            restraint: { u: false, v: false, theta: true },
            angle: 0,
        }]);
    };

    const addElement = () => {
        const nextId = elements.length ? Math.max(...elements.map((r) => r.id)) + 1 : 1;
        setElements((r) => [...r, {
            id: nextId, node_i: 1, node_j: 2, ea: 1, ei: 0, c: 0,
            releases_i: { u: false, v: false, theta: false },
            releases_j: { u: false, v: false, theta: false },
        }]);
    };

    // ── Viewer data ──────────────────────────────────────────────────────────────

    const structuralSystem = useMemo(
        () => view === 'dynamic'
            ? StructuralSystem.createPureTruss(nodes, elements)
            : new StructuralSystem(nodes, elements, hinges),
        [view, nodes, elements, hinges]
    );

    const pointForces = useMemo(() => {
        if (view !== 'static') return undefined;
        return loads.nodes.map((load) => ({
            id: `nodal-load-${load.id}`,
            nodeId: load.node_id,
            magnitude: load.magnitude,
            angle: load.angle,
            color: 'rgba(239, 68, 68, 0.8)',
        }));
    }, [loads.nodes, view]);

    const distributedForces = useMemo(() => {
        if (view !== 'static') return undefined;
        return loads.elements.map((load) => ({
            id: `element-load-${load.id}`,
            elementId: load.element_id,
            distribution: [
                { xi: 0, value: load.q_i },
                { xi: 1, value: load.q_j }
            ],
            angle: load.angle,
            color: 'rgba(239, 68, 68, 0.8)',
            renderStyle: 'arrows' as const,
        }));
    }, [loads.elements, view]);

    const getNodePosition = useCallback((nodeId: number, _t: number) => {
        const node = nodes.find(n => n.id === nodeId);
        return { x: node?.x ?? 0, z: node?.z ?? 0 };
    }, [nodes]);

    const getElementPositions = useCallback((elementId: number, _t: number) => {
        const el = elements.find(e => e.id === elementId);
        if (!el) return [{ x: 0, z: 0 }, { x: 0, z: 0 }];
        const ni = nodes.find(n => n.id === el.node_i);
        const nj = nodes.find(n => n.id === el.node_j);
        if (!ni || !nj) return [{ x: 0, z: 0 }, { x: 0, z: 0 }];
        return [{ x: ni.x, z: ni.z }, { x: nj.x, z: nj.z }];
    }, [nodes, elements]);

    return (
        <Flex h="calc(100vh - var(--app-shell-header-height, 50px))">

            {/* Canvas */}
            <Box style={{ flex: 1, backgroundColor: '#0a2540', position: 'relative' }}>
                <StructuralSystemViewer
                    structuralSystem={structuralSystem}
                    getNodePosition={getNodePosition}
                    getElementPositions={getElementPositions}
                    showUndeformedSystem={false}
                    showNodes={true}
                    showBearings={true}
                    showHinges={true}
                    showReferenceFiber={true}
                    pointForces={pointForces}
                    distributedForces={distributedForces}
                    themeOverride={BLUEPRINT_THEME}
                />
            </Box>

            {/* Sidebar */}
            <ScrollArea
                w={SIDEBAR_WIDTH}
                style={{ borderLeft: '1px solid var(--mantine-color-gray-3)', flexShrink: 0 }}
            >
                <Stack p="md" gap="lg">

                    <div>
                        <Group justify="space-between" mb="xs">
                            <Text fw={600}>Nodes</Text>
                            <Button size="xs" variant="light" onClick={addNode}>Add Node</Button>
                        </Group>
                        <Table highlightOnHover withColumnBorders verticalSpacing="0">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th bg="gray.1">Id</Table.Th>
                                    <Table.Th>x</Table.Th>
                                    <Table.Th>z</Table.Th>
                                    {view === 'dynamic' && <Table.Th>Mass</Table.Th>}
                                    <Table.Th>u</Table.Th>
                                    <Table.Th>v</Table.Th>
                                    {view === 'static' && <Table.Th>θ</Table.Th>}
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {nodes.map((row) => (
                                    <Table.Tr key={row.id}>
                                        <Table.Td bg="gray.1">{row.id}</Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.x} onChange={(e) => updateNode(row.id, { x: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.z} onChange={(e) => updateNode(row.id, { z: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        {view === 'dynamic' && <Table.Td>
                                            <NumberInput value={row.mass} onChange={(e) => updateNode(row.id, { mass: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>}
                                        <Table.Td>
                                            <Checkbox checked={row.restraint.u} onChange={(e) => updateNode(row.id, { restraint: { ...row.restraint, u: e.currentTarget.checked } })} />
                                        </Table.Td>
                                        <Table.Td>
                                            <Checkbox checked={row.restraint.v} onChange={(e) => updateNode(row.id, { restraint: { ...row.restraint, v: e.currentTarget.checked } })} />
                                        </Table.Td>
                                        {view === 'static' && (
                                            <Table.Td>
                                                <Checkbox checked={row.restraint.theta} onChange={(e) => updateNode(row.id, { restraint: { ...row.restraint, theta: e.currentTarget.checked } })} />
                                            </Table.Td>
                                        )}
                                        <Table.Td>
                                            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => deleteNode(row.id)}>
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </div>

                    {view === 'dynamic' && (
                    <div>
                        <Text fw={600} mb="xs">Initial Conditions</Text>
                        <Table highlightOnHover withColumnBorders verticalSpacing="0">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th bg="gray.1">Id</Table.Th>
                                    <Table.Th>u₀</Table.Th>
                                    <Table.Th>v₀</Table.Th>
                                    <Table.Th>u̇₀</Table.Th>
                                    <Table.Th>v̇₀</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {nodes.map((row) => {
                                    const ic = { ...IC_DEFAULTS, ...initialConditions[row.id] };
                                    return (
                                    <Table.Tr key={row.id}>
                                        <Table.Td bg="gray.1">{row.id}</Table.Td>
                                        <Table.Td>
                                            <NumberInput value={ic.u0} onChange={(e) => updateInitialCondition(row.id, { u0: Number(e) || 0 })} variant="unstyled" hideControls disabled={row.restraint.u} />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={ic.v0} onChange={(e) => updateInitialCondition(row.id, { v0: Number(e) || 0 })} variant="unstyled" hideControls disabled={row.restraint.v} />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={ic.du0} onChange={(e) => updateInitialCondition(row.id, { du0: Number(e) || 0 })} variant="unstyled" hideControls disabled={row.restraint.u} />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={ic.dv0} onChange={(e) => updateInitialCondition(row.id, { dv0: Number(e) || 0 })} variant="unstyled" hideControls disabled={row.restraint.v} />
                                        </Table.Td>
                                    </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </div>
                    )}

                    {view === 'static' && (<>
                    <div>
                        <Group justify="space-between" mb="xs">
                            <Text fw={600}>Nodal Loads</Text>
                            <Button size="xs" variant="light" onClick={addNodalLoad}>Add</Button>
                        </Group>
                        <Table highlightOnHover withColumnBorders verticalSpacing="0">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th bg="gray.1" w={ID_COL_WIDTH}>Node</Table.Th>
                                    <Table.Th>F₀</Table.Th>
                                    <Table.Th>α (°)</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {loads.nodes.map((row) => (
                                    <Table.Tr key={row.id}>
                                        <Table.Td bg="gray.1" w={ID_COL_WIDTH}>
                                            <NumberInput value={row.node_id} onChange={(e) => updateNodalLoad(row.id, { node_id: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.magnitude} onChange={(e) => updateNodalLoad(row.id, { magnitude: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.angle} onChange={(e) => updateNodalLoad(row.id, { angle: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => deleteNodalLoad(row.id)}>
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </div>

                    <div>
                        <Group justify="space-between" mb="xs">
                            <Text fw={600}>Element Loads</Text>
                            <Button size="xs" variant="light" onClick={addElementLoad}>Add</Button>
                        </Group>
                        <Table highlightOnHover withColumnBorders verticalSpacing="0">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th bg="gray.1" w={ID_COL_WIDTH}>Elem</Table.Th>
                                    <Table.Th>qᵢ</Table.Th>
                                    <Table.Th>qⱼ</Table.Th>
                                    <Table.Th>α (°)</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {loads.elements.map((row) => (
                                    <Table.Tr key={row.id}>
                                        <Table.Td bg="gray.1" w={ID_COL_WIDTH}>
                                            <NumberInput value={row.element_id} onChange={(e) => updateElementLoad(row.id, { element_id: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.q_i} onChange={(e) => updateElementLoad(row.id, { q_i: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.q_j} onChange={(e) => updateElementLoad(row.id, { q_j: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.angle} onChange={(e) => updateElementLoad(row.id, { angle: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => deleteElementLoad(row.id)}>
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </div>

                    <div>
                        <Group justify="space-between" mb="xs">
                            <Text fw={600}>Hinges</Text>
                            <Button size="xs" variant="light" onClick={addHinge}>Add</Button>
                        </Group>
                        <Table highlightOnHover withColumnBorders verticalSpacing="0">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th bg="gray.1" w={ID_COL_WIDTH}>Elem</Table.Th>
                                    <Table.Th>End</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {hinges.map((row) => (
                                    <Table.Tr key={row.id}>
                                        <Table.Td bg="gray.1" w={ID_COL_WIDTH}>
                                            <NumberInput value={row.element_id} onChange={(e) => updateHinge(row.id, { element_id: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <SegmentedControl
                                                size="xs"
                                                value={row.end}
                                                onChange={(v) => updateHinge(row.id, { end: v as 'i' | 'j' })}
                                                data={[{ value: 'i', label: 'i' }, { value: 'j', label: 'j' }]}
                                            />
                                        </Table.Td>
                                        <Table.Td>
                                            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => deleteHinge(row.id)}>
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </div>

                    </>)}

                    <Divider />

                    <div>
                        <Group justify="space-between" mb="xs">
                            <Text fw={600}>Elements</Text>
                            <Button size="xs" variant="light" onClick={addElement}>Add Element</Button>
                        </Group>
                        <Table highlightOnHover withColumnBorders verticalSpacing="0">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th bg="gray.1">Id</Table.Th>
                                    <Table.Th>Node i</Table.Th>
                                    <Table.Th>Node j</Table.Th>
                                    <Table.Th>EA</Table.Th>
                                    <Table.Th>EI</Table.Th>
                                    {view === 'dynamic' && <Table.Th>c</Table.Th>}
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {elements.map((row) => (
                                    <Table.Tr key={row.id}>
                                        <Table.Td bg="gray.1">{row.id}</Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.node_i} onChange={(e) => updateElement(row.id, { node_i: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.node_j} onChange={(e) => updateElement(row.id, { node_j: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.ea} onChange={(e) => updateElement(row.id, { ea: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        <Table.Td>
                                            <NumberInput value={row.ei} onChange={(e) => updateElement(row.id, { ei: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
                                        {view === 'dynamic' && <Table.Td>
                                            <NumberInput value={row.c} onChange={(e) => updateElement(row.id, { c: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>}
                                        <Table.Td>
                                            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => deleteElement(row.id)}>
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </div>

                </Stack>
            </ScrollArea>

        </Flex>
    );
}
