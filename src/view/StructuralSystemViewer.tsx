import React, { useState } from 'react';
import { Table, TextInput, Button, Checkbox } from '@mantine/core';
import { Circle, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node, type Element } from "../models/models";
import type { StructuralSystem } from '../StructuralSystem';

interface StructuralSystemViewerProps {
    structuralSystem: StructuralSystem;
}

export default function StructuralSystemViewer({ structuralSystem }: StructuralSystemViewerProps) {


    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });


    const canvasWidth = stageSize.width;
    const canvasHeight = stageSize.height;


    const getMinContentX = () => min(structuralSystem.nodes.map(n => n.x));
    const getMaxContentX = () => max(structuralSystem.nodes.map(n => n.x));

    const getMinContentZ = () => min(structuralSystem.nodes.map(n => n.z));
    const getMaxContentZ = () => max(structuralSystem.nodes.map(n => n.z));

    const getContentWidth = () => getMaxContentX() - getMinContentX();
    const getContentHeight = () => getMaxContentZ() - getMinContentZ();


    const getNode = (id: number) => {
        return structuralSystem.nodes.find(n => n.id == id)
    };


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


    function renderElement(element: Element) {
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
    }


    return (
        <Stage width={canvasWidth} height={canvasHeight}>
            <Layer>
                {structuralSystem.elements.map(
                    (e) => renderElement(e)
                )}


                {structuralSystem.nodes.map(
                    (n) => renderNode(n)
                )}



            </Layer>
        </Stage>
    );
}
