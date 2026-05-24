import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Box, Button, Checkbox, Divider, Flex, Group, NumberInput, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { Circle, Layer, Line, Rect, Shape, Stage, Text as KonvaText } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node, type Element, type InitialConditions } from "../models/models";


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

const GRID_LINE_COLOR = BLUEPRINT.gridLine;
const GRID_LABEL_COLOR = BLUEPRINT.gridLabel;
const GRID_LABEL_FONT_SIZE = BLUEPRINT.gridLabelSize;

function niceInterval(range: number, targetCount = 7): number {
    if (range === 0) return 1;
    const raw = range / targetCount;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    if (norm < 1.5) return mag;
    if (norm < 3.5) return 2 * mag;
    if (norm < 7.5) return 5 * mag;
    return 10 * mag;
}

function formatGridLabel(val: number, interval: number): string {
    const decimals = Math.max(0, -Math.floor(Math.log10(interval)));
    return val.toFixed(decimals);
}

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
    nodes: Node[];
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    elements: Element[];
    setElements: React.Dispatch<React.SetStateAction<Element[]>>;
    initialConditions: InitialConditions;
    setInitialConditions: React.Dispatch<React.SetStateAction<InitialConditions>>;
}

export default function Editor({ nodes, setNodes, elements, setElements, initialConditions, setInitialConditions }: EditorProps) {

    const updateNode = (id: number, patch: Partial<Omit<Node, 'id'>>) =>
        setNodes(r => r.map(row => row.id === id ? { ...row, ...patch } : row));

    const IC_DEFAULTS: InitialConditions[number] = { u0: 0, du0: 0, v0: 0, dv0: 0, theta0: 0, dtheta0: 0 };
    const updateInitialCondition = (nodeId: number, patch: Partial<InitialConditions[number]>) =>
        setInitialConditions(prev => ({
            ...prev,
            [nodeId]: { ...IC_DEFAULTS, ...prev[nodeId], ...patch },
        }));

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

    const [equalScale, setEqualScale] = useState(false);

    const { minX, minZ, contentWidth, contentHeight } = useMemo(() => {
        const xs = nodes.map(n => n.x);
        const zs = nodes.map(n => n.z);
        const rawMinX = min(xs), rawMaxX = max(xs);
        const rawMinZ = min(zs), rawMaxZ = max(zs);
        const rawW = rawMaxX - rawMinX;
        const rawH = rawMaxZ - rawMinZ;
        const contentWidth = Math.max(rawW, rawH / CONTENT_MAX_RATIO, CONTENT_MIN_DIM);
        const contentHeight = Math.max(rawH, rawW / CONTENT_MAX_RATIO, CONTENT_MIN_DIM);
        const minX = rawMinX - (contentWidth - rawW) / 2;
        const minZ = rawMinZ - (contentHeight - rawH) / 2;
        return { minX, minZ, contentWidth, contentHeight };
    }, [nodes]);

    const equalScaleParams = useMemo(() => {
        if (!equalScale || canvasSize.width === 0 || canvasSize.height === 0) return null;
        const sx = (1 - 2 * marginX) * canvasSize.width / contentWidth;
        const sz = (1 - 2 * marginZ) * canvasSize.height / contentHeight;
        return {
            scale: Math.min(sx, sz),
            cx: minX + contentWidth / 2,
            cz: minZ + contentHeight / 2,
        };
    }, [equalScale, canvasSize.width, canvasSize.height, contentWidth, contentHeight, minX, minZ]);

    const toCanvasX = (x: number) => {
        if (equalScaleParams)
            return canvasSize.width / 2 + (x - equalScaleParams.cx) * equalScaleParams.scale;
        return marginX * canvasSize.width + (x - minX) * (1 - 2 * marginX) * canvasSize.width / contentWidth;
    };

    const toCanvasZ = (z: number) => {
        if (equalScaleParams)
            return canvasSize.height / 2 + (z - equalScaleParams.cz) * equalScaleParams.scale;
        return marginZ * canvasSize.height + (z - minZ) * (1 - 2 * marginZ) * canvasSize.height / contentHeight;
    };

    return (
        <Flex h="calc(100vh - var(--app-shell-header-height, 50px))">

            {/* Canvas */}
            <Box ref={canvasContainerRef} style={{ flex: 1, background: BLUEPRINT.background, position: 'relative' }}>
                <Button
                    size="xs"
                    variant={equalScale ? 'filled' : 'default'}
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                    onClick={() => setEqualScale(v => !v)}
                >
                    1:1
                </Button>
                <Stage height={canvasSize.height} width={canvasSize.width}>
                    <Layer listening={false}>
                        {(() => {
                            const { width: W, height: H } = canvasSize;
                            if (W === 0 || H === 0) return null;
                            let worldLeft: number, worldRight: number, worldTop: number, worldBottom: number;
                            if (equalScaleParams) {
                                const { scale, cx, cz } = equalScaleParams;
                                worldLeft = cx - W / 2 / scale;
                                worldRight = cx + W / 2 / scale;
                                worldTop = cz - H / 2 / scale;
                                worldBottom = cz + H / 2 / scale;
                            } else {
                                const padX = marginX / (1 - 2 * marginX) * contentWidth;
                                const padZ = marginZ / (1 - 2 * marginZ) * contentHeight;
                                worldLeft = minX - padX;
                                worldRight = minX + contentWidth + padX;
                                worldTop = minZ - padZ;
                                worldBottom = minZ + contentHeight + padZ;
                            }
                            const xInterval = niceInterval(worldRight - worldLeft);
                            const zInterval = niceInterval(worldBottom - worldTop);
                            const xLines: number[] = [];
                            for (let x = Math.ceil(worldLeft / xInterval) * xInterval; x <= worldRight + xInterval * 0.01; x += xInterval)
                                xLines.push(Math.round(x / xInterval) * xInterval);
                            const zLines: number[] = [];
                            for (let z = Math.ceil(worldTop / zInterval) * zInterval; z <= worldBottom + zInterval * 0.01; z += zInterval)
                                zLines.push(Math.round(z / zInterval) * zInterval);
                            const xLabelStep = xLines.length > 8 ? 2 : 1;
                            const zLabelStep = zLines.length > 8 ? 2 : 1;
                            return <>
                                {xLines.map((x, i) => {
                                    const cx = toCanvasX(x);
                                    return <React.Fragment key={`gx-${x}`}>
                                        <Line points={[cx, 0, cx, H]} stroke={GRID_LINE_COLOR} strokeWidth={1} />
                                        {i % xLabelStep === 0 && <KonvaText x={cx + 3} y={H - GRID_LABEL_FONT_SIZE - 4} text={formatGridLabel(x, xInterval)} fontSize={GRID_LABEL_FONT_SIZE} fill={GRID_LABEL_COLOR} />}
                                    </React.Fragment>;
                                })}
                                {zLines.map((z, i) => {
                                    const cz = toCanvasZ(z);
                                    return <React.Fragment key={`gz-${z}`}>
                                        <Line points={[0, cz, W, cz]} stroke={GRID_LINE_COLOR} strokeWidth={1} />
                                        {i % zLabelStep === 0 && <KonvaText x={4} y={cz - GRID_LABEL_FONT_SIZE - 2} text={formatGridLabel(z, zInterval)} fontSize={GRID_LABEL_FONT_SIZE} fill={GRID_LABEL_COLOR} />}
                                    </React.Fragment>;
                                })}
                            </>;
                        })()}
                    </Layer>
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
                                    <Table.Th>Mass</Table.Th>
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
                                        <Table.Td>
                                            <NumberInput value={row.mass} onChange={(e) => updateNode(row.id, { mass: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
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
                                    <Table.Th>c</Table.Th>
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
                                            <NumberInput value={row.c} onChange={(e) => updateElement(row.id, { c: Number(e) || 0 })} variant="unstyled" hideControls />
                                        </Table.Td>
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
