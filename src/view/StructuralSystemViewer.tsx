import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node, type Element } from "../models/models";
import type { StructuralSystem } from '../solver/StructuralSystem';
import type Konva from 'konva';

interface StructuralSystemViewerProps {
    structuralSystem: StructuralSystem;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number };
    getElementPositions: (ElementId: number, time: number) => Array<{ x: number; z: number }>;
    time: number;
    showUndeformedSystem: boolean;
}

export default function StructuralSystemViewer({ structuralSystem, getNodePosition, getElementPositions, time, showUndeformedSystem }: StructuralSystemViewerProps) {

    const containerRef = useRef<HTMLDivElement>(null);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

    const layerRef = useRef<Konva.Layer>(null);

    // Measure the container size
    useLayoutEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setStageSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight || 500, // Fallback height
                });
            }
        };

        window.addEventListener("resize", updateSize);
        updateSize(); // Initial call

        return () => window.removeEventListener("resize", updateSize);
    }, []);

    const nodeGroupsRef = useRef<Map<number, Konva.Group>>(new Map());
    const elementLinesRef = useRef<Map<number, Konva.Line>>(new Map());
    const elementLabelsRef = useRef<Map<number, Konva.Group>>(new Map());



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
            if (z == getMinContentZ()) {
                return canvasHeight / 2;
            } else {
                const z_scale = (1 - 2 * marginZ) * canvasHeight / 10;
                return canvasHeight / 2 + (z - getMinContentZ()) * z_scale;
            }
        }

        const z_scale = (1 - 2 * marginZ) * canvasHeight / getContentHeight();

        return marginZ * canvasHeight + (z - getMinContentZ()) * z_scale;
    }

    const CIRCLE_RADIUS = 20;
    const TEXT_BOX_SIZE = CIRCLE_RADIUS * 2;


    useEffect(() => {
        // 1. Update Nodes
        structuralSystem.nodes.forEach((nodeData) => {
            const group = nodeGroupsRef.current.get(nodeData.id);
            if (group) {
                const disp = getNodePosition(nodeData.id, time);
                group.x(toCanvasX(disp.x));
                group.y(toCanvasZ(disp.z));
            }
        });

        // 2. Update Elements
        structuralSystem.elements.forEach((elData) => {
            const line = elementLinesRef.current.get(elData.id);
            const label = elementLabelsRef.current.get(elData.id);

            const points = getElementPositions(elData.id, time);
            const canvasPoints = points.flatMap(p => [toCanvasX(p.x), toCanvasZ(p.z)]);

            if (line) line.points(canvasPoints);

            if (label && canvasPoints.length >= 4) {
                const x_i = canvasPoints[0];
                const z_i = canvasPoints[1];
                const x_j = canvasPoints[canvasPoints.length - 2];
                const z_j = canvasPoints[canvasPoints.length - 1];
                label.x(x_i + (x_j - x_i) / 2 - 20);
                label.y(z_i + (z_j - z_i) / 2 - 20);
            }
        });

        // 3. Batch draw for performance
        layerRef.current?.batchDraw();

    }, [time, structuralSystem, getNodePosition, getElementPositions]);


    function renderNode(node: Node) {
        const { x, z } = getNodePosition(node.id, time);

        const circleX = toCanvasX(x);
        const circleY = toCanvasZ(z);

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
                fill={"red"}
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

        const position = getElementPositions(element.id, time);

        const canvasPositions = position.map(({ x, z }) => ({ x: toCanvasX(x), z: toCanvasZ(z) }));

        const centerIndex = Math.floor(canvasPositions.length / 2);

        let textX, textY;

        if (canvasPositions.length % 2 === 1) {
            textX = canvasPositions[centerIndex].x - (TEXT_BOX_SIZE / 2);
            textY = canvasPositions[centerIndex].z - (TEXT_BOX_SIZE / 2);
        } else {
            // If even (like a simple 2-node beam), average the two middle points
            const p1 = canvasPositions[centerIndex - 1];
            const p2 = canvasPositions[centerIndex];

            textX = (p1.x + p2.x) / 2 - (TEXT_BOX_SIZE / 2);
            textY = (p1.z + p2.z) / 2 - (TEXT_BOX_SIZE / 2);
        }

        return (
            <React.Fragment key={element.id}>
                <Line stroke="gray" strokeWidth={10} points={canvasPositions.flatMap(({ x, z }) => [x, z])} />
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


    function renderGhostNode(node: Node) {
        const { x, z } = { x: node.x, z: node.z }

        const circleX = toCanvasX(x);
        const circleY = toCanvasZ(z);

        const textX = circleX - (TEXT_BOX_SIZE / 2);
        const textY = circleY - (TEXT_BOX_SIZE / 2);

        let colors = {
            supportFill: "#e7e7e7", // Muted light gray
            nodeFill: "#ffffff",    // Desaturated "Red" (Pastel/Light Coral)
            stroke: "#aeaeae",      // Soft black/dark gray
            text: "#848484"
        }

        return <React.Fragment key={node.id}>

            {node.restrained_u ?

                <Shape
                    stroke={colors.stroke}
                    fill={colors.supportFill}
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
                    stroke={colors.stroke}
                    fill={colors.supportFill}
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
                fill={colors.nodeFill}
                stroke={colors.stroke}
            /> : <Circle
                x={circleX}
                y={circleY}
                radius={CIRCLE_RADIUS}
                fill={colors.nodeFill}
                stroke={colors.stroke}
            />}

            <Text
                x={textX}
                y={textY}
                width={TEXT_BOX_SIZE}
                height={TEXT_BOX_SIZE}
                text={`${node.id}`}
                fontSize={20}
                fill={colors.text}
                align="center"
                verticalAlign="middle"
            />
        </React.Fragment>;
    }



    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
            <Stage width={stageSize.width} height={stageSize.height}>
                <Layer ref={layerRef}>
                    {showUndeformedSystem && structuralSystem.nodes.map((node) => renderGhostNode(node))}

                    {structuralSystem.elements.map((element) => renderElement(element))}
                    {structuralSystem.nodes.map((node) => renderNode(node))}

                </Layer>
            </Stage>
        </div>
    );
}
