import React, { useEffect, useRef, useState } from 'react';
import { Circle, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node, type Element } from "../models/models";
import type { StructuralSystem } from '../solver/StructuralSystem';

interface StructuralSystemViewerProps {
    structuralSystem: StructuralSystem;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number };
    getElementPositions: (ElementId: number, time: number) => Array<{ x: number; z: number }>;
    time: number;
    showUndeformedSystem: boolean;
}

const CIRCLE_RADIUS = 20;
const TEXT_BOX_SIZE = CIRCLE_RADIUS * 2;

export default function StructuralSystemViewer({ structuralSystem, getNodePosition, getElementPositions, time, showUndeformedSystem }: StructuralSystemViewerProps) {

    const containerRef = useRef<HTMLDivElement>(null);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setStageSize({ width, height });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const canvasWidth = stageSize.width;
    const canvasHeight = stageSize.height;

    const marginX = 0.05;
    const marginZ = 0.1;

    // Compute bounds once per render
    const xs = structuralSystem.nodes.map(n => n.x);
    const zs = structuralSystem.nodes.map(n => n.z);
    const minX = min(xs);
    const maxX = max(xs);
    const minZ = min(zs);
    const maxZ = max(zs);
    const contentWidth = maxX - minX;
    const contentHeight = maxZ - minZ;

    const getNode = (id: number) => structuralSystem.nodes.find(n => n.id == id);

    const toCanvasX = (x: number) => {
        if (contentWidth == 0) return canvasWidth / 2;
        return marginX * canvasWidth + (x - minX) * (1 - 2 * marginX) * canvasWidth / contentWidth;
    };

    const toCanvasZ = (z: number) => {
        if (contentHeight == 0) {
            if (z == minZ) return canvasHeight / 2;
            const z_scale = (1 - 2 * marginZ) * canvasHeight / 10;
            return canvasHeight / 2 + (z - minZ) * z_scale;
        }
        return marginZ * canvasHeight + (z - minZ) * (1 - 2 * marginZ) * canvasHeight / contentHeight;
    };

    function renderNode(node: Node) {
        const { x, z } = getNodePosition(node.id, time);
        const circleX = toCanvasX(x);
        const circleY = toCanvasZ(z);
        const textX = circleX - TEXT_BOX_SIZE / 2;
        const textY = circleY - TEXT_BOX_SIZE / 2;

        return <React.Fragment key={node.id}>
            {node.restrained_u && (
                <Shape stroke="black" fill="lightgray" strokeWidth={1} sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.moveTo(circleX, circleY);
                    context.lineTo(circleX - 2 * CIRCLE_RADIUS, circleY - 1.4 * CIRCLE_RADIUS);
                    context.lineTo(circleX - 2 * CIRCLE_RADIUS, circleY + 1.4 * CIRCLE_RADIUS);
                    context.closePath();
                    context.fillStrokeShape(shape);
                }} />
            )}
            {node.restrained_v && (
                <Shape stroke="black" fill="lightgray" strokeWidth={1} sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.moveTo(circleX, circleY);
                    context.lineTo(circleX - 1.4 * CIRCLE_RADIUS, circleY + 2 * CIRCLE_RADIUS);
                    context.lineTo(circleX + 1.4 * CIRCLE_RADIUS, circleY + 2 * CIRCLE_RADIUS);
                    context.closePath();
                    context.fillStrokeShape(shape);
                }} />
            )}
            {node.restrained_phi
                ? <Rect x={circleX - CIRCLE_RADIUS * 1.75 / 2} y={circleY - CIRCLE_RADIUS * 1.75 / 2} width={CIRCLE_RADIUS * 1.75} height={CIRCLE_RADIUS * 1.75} fill="white" stroke="black" />
                : <Circle x={circleX} y={circleY} radius={CIRCLE_RADIUS} fill="red" stroke="black" />
            }
            <Text x={textX} y={textY} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${node.id}`} fontSize={20} fill="black" align="center" verticalAlign="middle" />
        </React.Fragment>;
    }

    function renderElement(element: Element) {
        const node_i = getNode(element.node_i);
        const node_j = getNode(element.node_j);
        if (!node_i || !node_j) return;

        const positions = getElementPositions(element.id, time);
        const canvasPoints = positions.flatMap(({ x, z }) => [toCanvasX(x), toCanvasZ(z)]);

        const centerIndex = Math.floor(positions.length / 2);
        let textX: number, textY: number;
        if (positions.length % 2 === 1) {
            textX = canvasPoints[centerIndex * 2] - TEXT_BOX_SIZE / 2;
            textY = canvasPoints[centerIndex * 2 + 1] - TEXT_BOX_SIZE / 2;
        } else {
            textX = (canvasPoints[(centerIndex - 1) * 2] + canvasPoints[centerIndex * 2]) / 2 - TEXT_BOX_SIZE / 2;
            textY = (canvasPoints[(centerIndex - 1) * 2 + 1] + canvasPoints[centerIndex * 2 + 1]) / 2 - TEXT_BOX_SIZE / 2;
        }

        return (
            <React.Fragment key={element.id}>
                <Line stroke="gray" strokeWidth={10} points={canvasPoints} />
                <Rect x={textX} y={textY} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} fill="white" stroke="black" strokeWidth={1} cornerRadius={10} />
                <Text x={textX} y={textY} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${element.id}`} fontSize={20} fill="black" align="center" verticalAlign="middle" />
            </React.Fragment>
        );
    }

    const ghostColors = {
        supportFill: "#e7e7e7",
        nodeFill: "#ffffff",
        stroke: "#aeaeae",
        text: "#848484"
    };

    function renderGhostNode(node: Node) {
        const circleX = toCanvasX(node.x);
        const circleY = toCanvasZ(node.z);
        const textX = circleX - TEXT_BOX_SIZE / 2;
        const textY = circleY - TEXT_BOX_SIZE / 2;

        return <React.Fragment key={node.id}>
            {node.restrained_u && (
                <Shape stroke={ghostColors.stroke} fill={ghostColors.supportFill} strokeWidth={1} sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.moveTo(circleX, circleY);
                    context.lineTo(circleX - 2 * CIRCLE_RADIUS, circleY - 1.4 * CIRCLE_RADIUS);
                    context.lineTo(circleX - 2 * CIRCLE_RADIUS, circleY + 1.4 * CIRCLE_RADIUS);
                    context.closePath();
                    context.fillStrokeShape(shape);
                }} />
            )}
            {node.restrained_v && (
                <Shape stroke={ghostColors.stroke} fill={ghostColors.supportFill} strokeWidth={1} sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.moveTo(circleX, circleY);
                    context.lineTo(circleX - 1.4 * CIRCLE_RADIUS, circleY + 2 * CIRCLE_RADIUS);
                    context.lineTo(circleX + 1.4 * CIRCLE_RADIUS, circleY + 2 * CIRCLE_RADIUS);
                    context.closePath();
                    context.fillStrokeShape(shape);
                }} />
            )}
            {node.restrained_phi
                ? <Rect x={circleX - CIRCLE_RADIUS * 1.75 / 2} y={circleY - CIRCLE_RADIUS * 1.75 / 2} width={CIRCLE_RADIUS * 1.75} height={CIRCLE_RADIUS * 1.75} fill={ghostColors.nodeFill} stroke={ghostColors.stroke} />
                : <Circle x={circleX} y={circleY} radius={CIRCLE_RADIUS} fill={ghostColors.nodeFill} stroke={ghostColors.stroke} />
            }
            <Text x={textX} y={textY} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${node.id}`} fontSize={20} fill={ghostColors.text} align="center" verticalAlign="middle" />
        </React.Fragment>;
    }

    function renderGhostElement(element: Element) {
        const node_i = getNode(element.node_i);
        const node_j = getNode(element.node_j);
        if (!node_i || !node_j) return;

        return (
            <Line
                key={element.id}
                stroke={ghostColors.stroke}
                strokeWidth={10}
                points={[toCanvasX(node_i.x), toCanvasZ(node_i.z), toCanvasX(node_j.x), toCanvasZ(node_j.z)]}
            />
        );
    }

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
            <Stage width={stageSize.width} height={stageSize.height}>
                <Layer>
                    {showUndeformedSystem && structuralSystem.elements.map(el => renderGhostElement(el))}
                    {showUndeformedSystem && structuralSystem.nodes.map(node => renderGhostNode(node))}
                    {structuralSystem.elements.map(el => renderElement(el))}
                    {structuralSystem.nodes.map(node => renderNode(node))}
                </Layer>
            </Stage>
        </div>
    );
}
