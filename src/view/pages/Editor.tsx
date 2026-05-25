import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Box, Button, Checkbox, Divider, Flex, Group, NumberInput, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { Circle, Layer, Line, Rect, Shape, Stage, Text as KonvaText } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node, type Element, type InitialConditions, type Loads, type NodalLoad, type ElementLoad } from "../../models/models";
import { LoadLayer, GridLayer } from "../components/StructuralSystemViewer";

const CIRCLE_RADIUS = 20;
const TEXT_BOX_SIZE = CIRCLE_RADIUS * 2;
const SIDEBAR_WIDTH = 420;
const CONTENT_MIN_DIM = 1.0;
const CONTENT_MAX_RATIO = 5;
const BLUEPRINT = {
    background: '#0a2540',
    gridLine: 'rgba(255,255,255,0.10)',
    gridLabel: 'rgba(255,255,255,0.35)',
    gridLabelSize: 11,
    element: 'rgba(255,255,255,0.6)',
    elementLabel: 'rgba(255,255,255,0.85)',
    elementLabelBg: 'rgba(10,37,64,0.7)',
    node: '#0a2540',
    nodeStroke: 'rgba(255,255,255,0.9)',
    nodeText: 'rgba(255,255,255,0.9)',
    bearing: 'rgba(255,255,255,0.15)',
    bearingStroke: 'rgba(255,255,255,0.8)',
};



interface ElementShapeProps {
    element: Element;
    node_i: Node;
    node_j: Node;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

function ElementShape({ element, node_i, node_j, toCanvasX, toCanvasZ }: ElementShapeProps) {
    const x_i = toCanvasX(node_i.x);
    const z_i = toCanvasZ(node_i.z);
    const x_j = toCanvasX(node_j.x);
    const z_j = toCanvasZ(node_j.z);
    const textX = x_i + (x_j - x_i) / 2 - TEXT_BOX_SIZE / 2;
    const textY = z_i + (z_j - z_i) / 2 - TEXT_BOX_SIZE / 2;

    return <>
        <Line stroke={BLUEPRINT.element} strokeWidth={10} points={[x_i, z_i, x_j, z_j]} />
        <Rect
            x={textX}
            y={textY}
            width={TEXT_BOX_SIZE}
            height={TEXT_BOX_SIZE}
            fill={BLUEPRINT.elementLabelBg}
            stroke={BLUEPRINT.element}
            strokeWidth={1}
            cornerRadius={10}
        />
        <KonvaText
            x={textX}
            y={textY}
            width={TEXT_BOX_SIZE}
            height={TEXT_BOX_SIZE}
            text={`${element.id}`}
            fontSize={20}
            fill={BLUEPRINT.elementLabel}
            align="center"
            verticalAlign="middle"
        />
    </>;
}

interface NodeShapeProps {
    node: Node;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

function NodeShape({ node, toCanvasX, toCanvasZ }: NodeShapeProps) {
    const circleX = toCanvasX(node.x);
    const circleY = toCanvasZ(node.z);
    const textX = circleX - TEXT_BOX_SIZE / 2;
    const textY = circleY - TEXT_BOX_SIZE / 2;

    return <>
        {node.restraint.u && (
            <Shape
                stroke={BLUEPRINT.bearingStroke}
                fill={BLUEPRINT.bearing}
                strokeWidth={1}
                sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.moveTo(circleX, circleY);
                    context.lineTo(circleX - 2 * CIRCLE_RADIUS, circleY - 1.4 * CIRCLE_RADIUS);
                    context.lineTo(circleX - 2 * CIRCLE_RADIUS, circleY + 1.4 * CIRCLE_RADIUS);
                    context.closePath();
                    context.fillStrokeShape(shape);
                }}
            />
        )}
        {node.restraint.v && (
            <Shape
                stroke={BLUEPRINT.bearingStroke}
                fill={BLUEPRINT.bearing}
                strokeWidth={1}
                sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.moveTo(circleX, circleY);
                    context.lineTo(circleX - 1.4 * CIRCLE_RADIUS, circleY + 2 * CIRCLE_RADIUS);
                    context.lineTo(circleX + 1.4 * CIRCLE_RADIUS, circleY + 2 * CIRCLE_RADIUS);
                    context.closePath();
                    context.fillStrokeShape(shape);
                }}
            />
        )}

        <Circle
            x={circleX}
            y={circleY}
            radius={CIRCLE_RADIUS}
            fill={BLUEPRINT.node}
            stroke={BLUEPRINT.nodeStroke}
        />

        <KonvaText
            x={textX}
            y={textY}
            width={TEXT_BOX_SIZE}
            height={TEXT_BOX_SIZE}
            text={`${node.id}`}
            fontSize={20}
            fill={BLUEPRINT.nodeText}
            align="center"
            verticalAlign="middle"
        />
    </>;
}

interface EditorProps {
    view: 'dynamic' | 'static';
    nodes: Node[];
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    elements: Element[];
    setElements: React.Dispatch<React.SetStateAction<Element[]>>;
    initialConditions: InitialConditions;
    setInitialConditions: React.Dispatch<React.SetStateAction<InitialConditions>>;
    loads: Loads;
    setLoads: React.Dispatch<React.SetStateAction<Loads>>;
}

export default function Editor({ view, nodes, setNodes, elements, setElements, initialConditions, setInitialConditions, loads, setLoads }: EditorProps) {

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

    const addNode = () => {
        const nextId = nodes.length ? Math.max(...nodes.map((r) => r.id)) + 1 : 1;
        setNodes((r) => [...r, {
            id: nextId, x: 0, z: 0, mass: 0,
            restraint: { u: false, v: false, theta: true },
            angle: 0,
        }]);
    };

    const getNode = (id: number) => nodes.find(n => n.id == id);

    const addElement = () => {
        const nextId = elements.length ? Math.max(...elements.map((r) => r.id)) + 1 : 1;
        setElements((r) => [...r, {
            id: nextId, node_i: 1, node_j: 2, ea: 1, ei: 0, c: 0,
            releases_i: { u: false, v: false, theta: true },
            releases_j: { u: false, v: false, theta: true }
        }]);
    };

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth - SIDEBAR_WIDTH, height: window.innerHeight - 50 });

    useEffect(() => {
        const el = canvasContainerRef.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setCanvasSize({ width, height });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const marginX = 0.05;
    const marginZ = 0.1;

    const { contentCx, contentCz, contentWidth, contentHeight } = useMemo(() => {
        const xs = nodes.map(n => n.x);
        const zs = nodes.map(n => n.z);
        const rawMinX = min(xs), rawMaxX = max(xs);
        const rawMinZ = min(zs), rawMaxZ = max(zs);
        const rawW = rawMaxX - rawMinX;
        const rawH = rawMaxZ - rawMinZ;
        const contentWidth = Math.max(rawW, rawH / CONTENT_MAX_RATIO, CONTENT_MIN_DIM);
        const contentHeight = Math.max(rawH, rawW / CONTENT_MAX_RATIO, CONTENT_MIN_DIM);
        return {
            contentCx: (rawMinX + rawMaxX) / 2,
            contentCz: (rawMinZ + rawMaxZ) / 2,
            contentWidth,
            contentHeight,
        };
    }, [nodes]);

    const scaleParams = useMemo(() => {
        if (canvasSize.width === 0 || canvasSize.height === 0) return null;
        const sx = (1 - 2 * marginX) * canvasSize.width / contentWidth;
        const sz = (1 - 2 * marginZ) * canvasSize.height / contentHeight;
        return { scale: Math.min(sx, sz), cx: contentCx, cz: contentCz };
    }, [canvasSize.width, canvasSize.height, contentWidth, contentHeight, contentCx, contentCz, marginX, marginZ]);

    const toCanvasX = (x: number) => {
        if (!scaleParams) return 0;
        return canvasSize.width / 2 + (x - scaleParams.cx) * scaleParams.scale;
    };

    const toCanvasZ = (z: number) => {
        if (!scaleParams) return 0;
        return canvasSize.height / 2 - (z - scaleParams.cz) * scaleParams.scale;
    };

    const worldBounds = useMemo(() => {
        if (!scaleParams) return { worldLeft: 0, worldRight: 1, worldBottom: -1, worldTop: 1 };
        const { scale, cx, cz } = scaleParams;
        return {
            worldLeft:   cx - canvasSize.width  / (2 * scale),
            worldRight:  cx + canvasSize.width  / (2 * scale),
            worldBottom: cz - canvasSize.height / (2 * scale),
            worldTop:    cz + canvasSize.height / (2 * scale),
        };
    }, [scaleParams, canvasSize.width, canvasSize.height]);

    return (
        <Flex h="calc(100vh - var(--app-shell-header-height, 50px))">

            {/* Canvas */}
            <Box ref={canvasContainerRef} style={{ flex: 1, background: BLUEPRINT.background, position: 'relative' }}>
                <Stage height={canvasSize.height} width={canvasSize.width}>
                    <GridLayer
                        canvasWidth={canvasSize.width} canvasHeight={canvasSize.height}
                        {...worldBounds}
                        toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                        lineColor={BLUEPRINT.gridLine} labelColor={BLUEPRINT.gridLabel} labelFontSize={BLUEPRINT.gridLabelSize}
                    />
                    <Layer>
                        {elements.map(element => {
                            const node_i = getNode(element.node_i);
                            const node_j = getNode(element.node_j);
                            if (!node_i || !node_j) return;
                            return <ElementShape key={element.id} element={element} node_i={node_i} node_j={node_j} toCanvasX={toCanvasX} toCanvasZ={toCanvasZ} />;
                        })}
                        {nodes.map(node => (
                            <NodeShape key={node.id} node={node} toCanvasX={toCanvasX} toCanvasZ={toCanvasZ} />
                        ))}
                    </Layer>
                    {view === 'static' && (
                        <LoadLayer
                            structuralSystem={{ nodes, elements }}
                            lv={{ loads, scale: 1, showNodal: true, showElement: true }}
                            toCanvasX={toCanvasX}
                            toCanvasZ={toCanvasZ}
                            canvasWidth={canvasSize.width}
                            canvasHeight={canvasSize.height}
                        />
                    )}
                </Stage>
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
                                    <Table.Th bg="gray.1">Node</Table.Th>
                                    <Table.Th>F₀</Table.Th>
                                    <Table.Th>α (°)</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {loads.nodes.map((row) => (
                                    <Table.Tr key={row.id}>
                                        <Table.Td bg="gray.1">
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
                                    <Table.Th bg="gray.1">Elem</Table.Th>
                                    <Table.Th>qᵢ</Table.Th>
                                    <Table.Th>qⱼ</Table.Th>
                                    <Table.Th>α (°)</Table.Th>
                                    <Table.Th />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {loads.elements.map((row) => (
                                    <Table.Tr key={row.id}>
                                        <Table.Td bg="gray.1">
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
