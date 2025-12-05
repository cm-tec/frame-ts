import React, { useState } from 'react';
import { Table, TextInput, Button, Checkbox } from '@mantine/core';
import { Circle, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';


type Node = {
    id: number;
    x: number;
    z: number;
    restrained_u: boolean;
    restrained_v: boolean;
    restrained_phi: boolean;
};

type Element = {
    id: number;
    node_i: number;
    node_j: number;
    ea: number;
    c: number;
};


export default function Editor() {
    const [nodes, setNodes] = useState<Node[]>([
        { id: 1, x: 1, z: 0, restrained_u: false, restrained_v: false, restrained_phi: false },
        { id: 2, x: 2, z: 1, restrained_u: false, restrained_v: false, restrained_phi: false },
    ]);

    const [elements, setElements] = useState<Element[]>([
        { id: 1, node_i: 1, node_j: 2, ea: 1, c: 0 },
    ]);



    const updateCell = (id: number, key: keyof Omit<Node, 'id'>, value: any) => {
        setNodes((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    };

    const updateElementCell = (id: number, key: keyof Omit<Element, 'id'>, value: string) => {
        setElements((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    };

    const addNode = () => {
        const nextId = nodes.length ? Math.max(...nodes.map((r) => r.id)) + 1 : 1;
        setNodes((r) => [...r, { id: nextId, x: 0, z: 0, restrained_u: false, restrained_v: false, restrained_phi: false },]);
    };

    const getNode = (id: number) => {
        return nodes.find(n => n.id == id)
    };

    const addElement = () => {
        const nextId = elements.length ? Math.max(...elements.map((r) => r.id)) + 1 : 1;
        setElements((r) => [...r, { id: nextId, node_i: 1, node_j: 2, ea: 1, c: 0 }]);
    };

    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const canvasWidth = stageSize.width;
    const canvasHeight = stageSize.height / 2;


    const getMinContentX = () => min(nodes.map(n => n.x));
    const getMaxContentX = () => max(nodes.map(n => n.x));

    const getMinContentZ = () => min(nodes.map(n => n.z));
    const getMaxContentZ = () => max(nodes.map(n => n.z));

    const getContentWidth = () => getMaxContentX() - getMinContentX();
    const getContentHeight = () => getMaxContentZ() - getMinContentZ();




    const marginX = 0.05;
    const marginZ = 0.1;


    const toCanvasX = (x: number) => {
        if (getContentWidth() == 0) {
            return canvasWidth / 2;
        }

        const x_scale = (1 - 2 * marginX) * canvasWidth / getContentWidth();

        return marginX * canvasWidth + (x - getMinContentX()) * x_scale;
    }

    const toCanvasZ = (z: number) => {
        if (getContentHeight() == 0) {
            return canvasHeight / 2;
        }

        const z_scale = (1 - 2 * marginZ) * canvasHeight / getContentHeight();

        return marginZ * canvasHeight + (z - getMinContentZ()) * z_scale;
    }

    const CIRCLE_RADIUS = 20;
    const TEXT_BOX_SIZE = CIRCLE_RADIUS * 2; // Bounding box for the text to ensure it covers the circle


    function renderNode(node: Node) {
        const circleX = toCanvasX(node.x);
        const circleY = toCanvasZ(node.z);

        const textX = circleX - (TEXT_BOX_SIZE / 2);
        const textY = circleY - (TEXT_BOX_SIZE / 2);

        return <React.Fragment key={node.id}>

            {node.restrained_u ?

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
                /> : null


            }
            {node.restrained_v ?
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
                /> : null}
            {node.restrained_phi ? <Rect
                x={circleX - CIRCLE_RADIUS * 1.75 / 2}
                y={circleY - CIRCLE_RADIUS * 1.75 / 2}
                width={CIRCLE_RADIUS * 1.75}
                height={CIRCLE_RADIUS * 1.75}
                fill={"white"}
                stroke={"black"}
            /> : <Circle
                x={circleX}
                y={circleY}
                radius={CIRCLE_RADIUS}
                fill={"white"}
                stroke={"black"}
            />}

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
        </React.Fragment>;
    }


    return (
        <>
            <Stage height={canvasHeight} width={canvasWidth}>
                <Layer>
                    {elements.map(element => {
                        const node_i = getNode(element.node_i);
                        if (!node_i) {
                            return;
                        }
                        const node_j = getNode(element.node_j);
                        if (!node_j) {
                            return;
                        }


                        const x_i = toCanvasX(node_i.x);
                        const z_i = toCanvasZ(node_i.z);

                        const x_j = toCanvasX(node_j.x);
                        const z_j = toCanvasZ(node_j.z);


                        const textX = x_i + (x_j - x_i) / 2 - (TEXT_BOX_SIZE / 2);
                        const textY = z_i + (z_j - z_i) / 2 - (TEXT_BOX_SIZE / 2);

                        return (
                            <React.Fragment key={element.id}>
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
                            </React.Fragment>

                        );
                    })}


                    {nodes.map(node => renderNode(node))}
                </Layer>
            </Stage>



            <Table highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Id</Table.Th>
                        <Table.Th>x</Table.Th>
                        <Table.Th>z</Table.Th>
                        <Table.Th>u</Table.Th>
                        <Table.Th>v</Table.Th>
                        <Table.Th>phi</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {
                        nodes.map((row) => (
                            <Table.Tr key={row.id}>
                                <Table.Td>{row.id}</Table.Td>
                                <Table.Td>
                                    <TextInput
                                        value={row.x}
                                        onChange={(e) => updateCell(row.id, 'x', e.currentTarget.value)}
                                        variant="unstyled"
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <TextInput
                                        value={row.z}
                                        onChange={(e) => updateCell(row.id, 'z', e.currentTarget.value)}
                                        variant="unstyled"
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <Checkbox
                                        checked={row.restrained_u}
                                        onChange={(e) => updateCell(row.id, "restrained_u", e.currentTarget.checked)}
                                    />

                                </Table.Td>
                                <Table.Td>
                                    <Checkbox
                                        checked={row.restrained_v}
                                        onChange={(e) => updateCell(row.id, "restrained_v", e.currentTarget.checked)}
                                    />

                                </Table.Td>
                                <Table.Td>
                                    <Checkbox
                                        checked={row.restrained_phi}
                                        onChange={(e) => updateCell(row.id, "restrained_phi", e.currentTarget.checked)}
                                    />

                                </Table.Td>

                            </Table.Tr>
                        ))
                    }
                </Table.Tbody>
            </Table>
            <Button onClick={addNode}>Add Node</Button>

            <Table highlightOnHover verticalSpacing="xsea">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Id</Table.Th>
                        <Table.Th>Node i</Table.Th>
                        <Table.Th>Node j</Table.Th>
                        <Table.Th>EA</Table.Th>
                        <Table.Th>c</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {
                        elements.map((row) => (
                            <Table.Tr key={row.id}>
                                <Table.Td>{row.id}</Table.Td>
                                <Table.Td>
                                    <TextInput
                                        value={row.node_i}
                                        onChange={(e) => updateElementCell(row.id, 'node_i', e.currentTarget.value)}
                                        placeholder="Name"
                                        variant="unstyled"
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <TextInput
                                        value={row.node_j}
                                        onChange={(e) => updateElementCell(row.id, 'node_j', e.currentTarget.value)}
                                        placeholder="Age"
                                        variant="unstyled"
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <TextInput
                                        value={row.ea}
                                        onChange={(e) => updateElementCell(row.id, 'ea', e.currentTarget.value)}
                                        placeholder="Age"
                                        variant="unstyled"
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <TextInput
                                        value={row.c}
                                        onChange={(e) => updateElementCell(row.id, 'c', e.currentTarget.value)}
                                        placeholder="Age"
                                        variant="unstyled"
                                    />
                                </Table.Td>
                            </Table.Tr>
                        ))
                    }
                </Table.Tbody>
            </Table>
            <Button onClick={addElement}>Add element</Button>
        </>
    );
}
