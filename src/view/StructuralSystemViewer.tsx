import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node, type Element } from "../models/models";
import type { StructuralSystem } from '../solver/StructuralSystem';

interface StructuralSystemViewerProps {
    structuralSystem: StructuralSystem;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number };
    getElementPositions: (elementId: number, time: number) => Array<{ x: number; z: number }>;
    time: number;
    showUndeformedSystem: boolean;
}

const CIRCLE_RADIUS = 20;
const TEXT_BOX_SIZE = CIRCLE_RADIUS * 2;
const MARGIN_X = 0.05;
const MARGIN_Z = 0.1;

const defaultColors = { supportFill: 'lightgray', nodeFill: 'red',     stroke: 'black',   text: 'black'   };
const ghostColors   = { supportFill: '#e7e7e7',   nodeFill: '#ffffff', stroke: '#aeaeae', text: '#848484' };
type NodeColors = typeof defaultColors;

// ─── Shared sub-components ───────────────────────────────────────────────────

function NodeShape({ node, cx, cy, colors }: { node: Node; cx: number; cy: number; colors: NodeColors }) {
    const textX = cx - TEXT_BOX_SIZE / 2;
    const textY = cy - TEXT_BOX_SIZE / 2;
    return <>
        {node.restrained_u && (
            <Shape stroke={colors.stroke} fill={colors.supportFill} strokeWidth={1} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx - 2 * CIRCLE_RADIUS, cy - 1.4 * CIRCLE_RADIUS);
                ctx.lineTo(cx - 2 * CIRCLE_RADIUS, cy + 1.4 * CIRCLE_RADIUS);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}
        {node.restrained_v && (
            <Shape stroke={colors.stroke} fill={colors.supportFill} strokeWidth={1} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx - 1.4 * CIRCLE_RADIUS, cy + 2 * CIRCLE_RADIUS);
                ctx.lineTo(cx + 1.4 * CIRCLE_RADIUS, cy + 2 * CIRCLE_RADIUS);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}
        {node.restrained_phi
            ? <Rect x={cx - CIRCLE_RADIUS * 1.75 / 2} y={cy - CIRCLE_RADIUS * 1.75 / 2} width={CIRCLE_RADIUS * 1.75} height={CIRCLE_RADIUS * 1.75} fill={colors.nodeFill} stroke={colors.stroke} />
            : <Circle x={cx} y={cy} radius={CIRCLE_RADIUS} fill={colors.nodeFill} stroke={colors.stroke} />
        }
        <Text x={textX} y={textY} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${node.id}`} fontSize={20} fill={colors.text} align="center" verticalAlign="middle" />
    </>;
}

// ─── Static layer (ghost) — only re-renders when structure or transforms change ─

interface StaticLayerProps {
    structuralSystem: StructuralSystem;
    showUndeformedSystem: boolean;
    nodeMap: Map<number, Node>;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

const StaticLayer = React.memo(({ structuralSystem, showUndeformedSystem, nodeMap, toCanvasX, toCanvasZ }: StaticLayerProps) => {
    return (
        <Layer listening={false}>
            {showUndeformedSystem && structuralSystem.elements.map(el => {
                const ni = nodeMap.get(el.node_i);
                const nj = nodeMap.get(el.node_j);
                if (!ni || !nj) return null;
                return <Line key={el.id} stroke={ghostColors.stroke} strokeWidth={10}
                    points={[toCanvasX(ni.x), toCanvasZ(ni.z), toCanvasX(nj.x), toCanvasZ(nj.z)]} />;
            })}
            {showUndeformedSystem && structuralSystem.nodes.map(node => (
                <NodeShape key={node.id} node={node} cx={toCanvasX(node.x)} cy={toCanvasZ(node.z)} colors={ghostColors} />
            ))}
        </Layer>
    );
});

// ─── Main component ───────────────────────────────────────────────────────────

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

    const { minX, minZ, contentWidth, contentHeight } = useMemo(() => {
        const xs = structuralSystem.nodes.map(n => n.x);
        const zs = structuralSystem.nodes.map(n => n.z);
        const minX = min(xs), maxX = max(xs);
        const minZ = min(zs), maxZ = max(zs);
        return { minX, minZ, contentWidth: maxX - minX, contentHeight: maxZ - minZ };
    }, [structuralSystem]);

    const nodeMap = useMemo(
        () => new Map(structuralSystem.nodes.map(n => [n.id, n])),
        [structuralSystem]
    );

    const { width: canvasWidth, height: canvasHeight } = stageSize;

    const toCanvasX = useCallback((x: number) => {
        if (contentWidth === 0) return canvasWidth / 2;
        return MARGIN_X * canvasWidth + (x - minX) * (1 - 2 * MARGIN_X) * canvasWidth / contentWidth;
    }, [canvasWidth, minX, contentWidth]);

    const toCanvasZ = useCallback((z: number) => {
        if (contentHeight === 0) {
            if (z === minZ) return canvasHeight / 2;
            return canvasHeight / 2 + (z - minZ) * (1 - 2 * MARGIN_Z) * canvasHeight / 10;
        }
        return MARGIN_Z * canvasHeight + (z - minZ) * (1 - 2 * MARGIN_Z) * canvasHeight / contentHeight;
    }, [canvasHeight, minZ, contentHeight]);

    function renderElement(element: Element) {
        const ni = nodeMap.get(element.node_i);
        const nj = nodeMap.get(element.node_j);
        if (!ni || !nj) return;

        const positions = getElementPositions(element.id, time);
        const canvasPoints = positions.flatMap(({ x, z }) => [toCanvasX(x), toCanvasZ(z)]);
        const centerIndex = Math.floor(positions.length / 2);
        const textX = canvasPoints[centerIndex * 2] - TEXT_BOX_SIZE / 2;
        const textY = canvasPoints[centerIndex * 2 + 1] - TEXT_BOX_SIZE / 2;

        return (
            <React.Fragment key={element.id}>
                <Line stroke="gray" strokeWidth={10} points={canvasPoints} />
                <Rect x={textX} y={textY} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} fill="white" stroke="black" strokeWidth={1} cornerRadius={10} />
                <Text x={textX} y={textY} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${element.id}`} fontSize={20} fill="black" align="center" verticalAlign="middle" />
            </React.Fragment>
        );
    }

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
            <Stage width={canvasWidth} height={canvasHeight}>
                <StaticLayer
                    structuralSystem={structuralSystem}
                    showUndeformedSystem={showUndeformedSystem}
                    nodeMap={nodeMap}
                    toCanvasX={toCanvasX}
                    toCanvasZ={toCanvasZ}
                />
                <Layer>
                    {structuralSystem.elements.map(el => renderElement(el))}
                    {structuralSystem.nodes.map(node => {
                        const pos = getNodePosition(node.id, time);
                        return <NodeShape key={node.id} node={node} cx={toCanvasX(pos.x)} cy={toCanvasZ(pos.z)} colors={defaultColors} />;
                    })}
                </Layer>
            </Stage>
        </div>
    );
}
