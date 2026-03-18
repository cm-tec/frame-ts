import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Checkbox, NumberInput } from '@mantine/core';
import { Circle, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node, type Element } from "../models/models";

const CIRCLE_RADIUS = 20;
const TEXT_BOX_SIZE = CIRCLE_RADIUS * 2;

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
        <Line stroke="gray" strokeWidth={10} points={[x_i, z_i, x_j, z_j]} />
        <Rect
            x={textX}
            y={textY}
            width={TEXT_BOX_SIZE}
            height={TEXT_BOX_SIZE}
            fill="white"
            stroke="black"
            strokeWidth={1}
            cornerRadius={10}
        />
        <Text
            x={textX}
            y={textY}
            width={TEXT_BOX_SIZE}
            height={TEXT_BOX_SIZE}
            text={`${element.id}`}
            fontSize={20}
            fill="black"
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
        {node.restrained_u && (
            <Shape
                stroke="black"
                fill="lightgray"
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
        {node.restrained_v && (
            <Shape
                stroke="black"
                fill="lightgray"
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
        {node.restrained_phi
            ? <Rect
                x={circleX - CIRCLE_RADIUS * 1.75 / 2}
                y={circleY - CIRCLE_RADIUS * 1.75 / 2}
                width={CIRCLE_RADIUS * 1.75}
                height={CIRCLE_RADIUS * 1.75}
                fill="white"
                stroke="black"
            />
            : <Circle
                x={circleX}
                y={circleY}
                radius={CIRCLE_RADIUS}
                fill="white"
                stroke="black"
            />
        }
        <Text
            x={textX}
            y={textY}
            width={TEXT_BOX_SIZE}
            height={TEXT_BOX_SIZE}
            text={`${node.id}`}
            fontSize={20}
            fill="black"
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
}

export default function Editor({ nodes, setNodes, elements, setElements }: EditorProps) {

    const updateNode = (id: number, patch: Partial<Omit<Node, 'id'>>) =>
        setNodes(r => r.map(row => row.id === id ? { ...row, ...patch } : row));

    const updateElement = (id: number, patch: Partial<Omit<Element, 'id'>>) =>
        setElements(r => r.map(row => row.id === id ? { ...row, ...patch } : row));

    const addNode = () => {
        const nextId = nodes.length ? Math.max(...nodes.map((r) => r.id)) + 1 : 1;
        setNodes((r) => [...r, { id: nextId, x: 0, z: 0, mass: 0, restrained_u: false, restrained_v: false, restrained_phi: false }]);
    };

    const getNode = (id: number) => nodes.find(n => n.id == id);

    const addElement = () => {
        const nextId = elements.length ? Math.max(...elements.map((r) => r.id)) + 1 : 1;
        setElements((r) => [...r, { id: nextId, node_i: 1, node_j: 2, ea: 1, ei: 1, c: 0 }]);
    };

    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const onResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const canvasWidth = stageSize.width;
    const canvasHeight = stageSize.height / 2;

    const marginX = 0.05;
    const marginZ = 0.1;

    const { minX, minZ, contentWidth, contentHeight } = useMemo(() => {
        const xs = nodes.map(n => n.x);
        const zs = nodes.map(n => n.z);
        const minX = min(xs);
        const maxX = max(xs);
        const minZ = min(zs);
        const maxZ = max(zs);
        return { minX, minZ, contentWidth: maxX - minX, contentHeight: maxZ - minZ };
    }, [nodes]);

    const toCanvasX = (x: number) => {
        if (contentWidth == 0) return canvasWidth / 2;
        return marginX * canvasWidth + (x - minX) * (1 - 2 * marginX) * canvasWidth / contentWidth;
    };

    const toCanvasZ = (z: number) => {
        if (contentHeight == 0) return canvasHeight / 2;
        return marginZ * canvasHeight + (z - minZ) * (1 - 2 * marginZ) * canvasHeight / contentHeight;
    };

    return (
        <>
            <Stage height={canvasHeight} width={canvasWidth}>
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

            <Table highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Id</Table.Th>
                        <Table.Th>x</Table.Th>
                        <Table.Th>z</Table.Th>
                        <Table.Th>Mass</Table.Th>
                        <Table.Th>u</Table.Th>
                        <Table.Th>v</Table.Th>
                        <Table.Th>phi</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {nodes.map((row) => (
                        <Table.Tr key={row.id}>
                            <Table.Td>{row.id}</Table.Td>
                            <Table.Td>
                                <NumberInput value={row.x} onChange={(e) => updateNode(row.id, { x: Number(e) || 0 })} variant="unstyled" />
                            </Table.Td>
                            <Table.Td>
                                <NumberInput value={row.z} onChange={(e) => updateNode(row.id, { z: Number(e) || 0 })} variant="unstyled" />
                            </Table.Td>
                            <Table.Td>
                                <NumberInput value={row.mass} onChange={(e) => updateNode(row.id, { mass: Number(e) || 0 })} variant="unstyled" />
                            </Table.Td>
                            <Table.Td>
                                <Checkbox checked={row.restrained_u} onChange={(e) => updateNode(row.id, { restrained_u: e.currentTarget.checked })} />
                            </Table.Td>
                            <Table.Td>
                                <Checkbox checked={row.restrained_v} onChange={(e) => updateNode(row.id, { restrained_v: e.currentTarget.checked })} />
                            </Table.Td>
                            <Table.Td>
                                <Checkbox checked={row.restrained_phi} onChange={(e) => updateNode(row.id, { restrained_phi: e.currentTarget.checked })} />
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
            <Button onClick={addNode}>Add Node</Button>

            <Table highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Id</Table.Th>
                        <Table.Th>Node i</Table.Th>
                        <Table.Th>Node j</Table.Th>
                        <Table.Th>EA</Table.Th>
                        <Table.Th>EI</Table.Th>
                        <Table.Th>c</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {elements.map((row) => (
                        <Table.Tr key={row.id}>
                            <Table.Td>{row.id}</Table.Td>
                            <Table.Td>
                                <NumberInput value={row.node_i} onChange={(e) => updateElement(row.id, { node_i: Number(e) || 0 })} variant="unstyled" />
                            </Table.Td>
                            <Table.Td>
                                <NumberInput value={row.node_j} onChange={(e) => updateElement(row.id, { node_j: Number(e) || 0 })} variant="unstyled" />
                            </Table.Td>
                            <Table.Td>
                                <NumberInput value={row.ea} onChange={(e) => updateElement(row.id, { ea: Number(e) || 0 })} variant="unstyled" />
                            </Table.Td>
                            <Table.Td>
                                <NumberInput value={row.ei} onChange={(e) => updateElement(row.id, { ei: Number(e) || 0 })} variant="unstyled" />
                            </Table.Td>
                            <Table.Td>
                                <NumberInput value={row.c} onChange={(e) => updateElement(row.id, { c: Number(e) || 0 })} variant="unstyled" />
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
            <Button onClick={addElement}>Add element</Button>
        </>
    );
}
