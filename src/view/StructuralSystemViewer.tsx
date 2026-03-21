import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node } from "../models/models";
import type { StructuralSystem } from '../solver/StructuralSystem';
import { useAnimationStore } from '../store/animationStore';

interface StructuralSystemViewerProps {
    structuralSystem: StructuralSystem;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number };
    getElementPositions: (elementId: number, time: number) => Array<{ x: number; z: number }>;
    showUndeformedSystem: boolean;
}

const CIRCLE_RADIUS = 20;
const TEXT_BOX_SIZE = CIRCLE_RADIUS * 2;
const MARGIN_X = 0.05;
const MARGIN_Z = 0.1;

const defaultColors = { supportFill: 'lightgray', nodeFill: 'red',     stroke: 'black',   text: 'black'   };
const ghostColors   = { supportFill: '#e7e7e7',   nodeFill: '#ffffff', stroke: '#aeaeae', text: '#848484' };
type NodeColors = typeof defaultColors;

// Renders at origin — caller positions via a Group wrapper
function NodeShape({ node, colors }: { node: Node; colors: NodeColors }) {
    return <>
        {node.restrained_u && (
            <Shape stroke={colors.stroke} fill={colors.supportFill} strokeWidth={1} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-2 * CIRCLE_RADIUS, -1.4 * CIRCLE_RADIUS);
                ctx.lineTo(-2 * CIRCLE_RADIUS,  1.4 * CIRCLE_RADIUS);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}
        {node.restrained_v && (
            <Shape stroke={colors.stroke} fill={colors.supportFill} strokeWidth={1} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-1.4 * CIRCLE_RADIUS, 2 * CIRCLE_RADIUS);
                ctx.lineTo( 1.4 * CIRCLE_RADIUS, 2 * CIRCLE_RADIUS);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}
        {node.restrained_phi
            ? <Rect x={-CIRCLE_RADIUS * 1.75 / 2} y={-CIRCLE_RADIUS * 1.75 / 2} width={CIRCLE_RADIUS * 1.75} height={CIRCLE_RADIUS * 1.75} fill={colors.nodeFill} stroke={colors.stroke} />
            : <Circle radius={CIRCLE_RADIUS} fill={colors.nodeFill} stroke={colors.stroke} />
        }
        <Text x={-TEXT_BOX_SIZE / 2} y={-TEXT_BOX_SIZE / 2} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${node.id}`} fontSize={20} fill={colors.text} align="center" verticalAlign="middle" />
    </>;
}

// ─── Static layer (ghost undeformed system) ───────────────────────────────────

interface StaticLayerProps {
    structuralSystem: StructuralSystem;
    showUndeformedSystem: boolean;
    nodeMap: Map<number, Node>;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

const StaticLayer = React.memo(({ structuralSystem, showUndeformedSystem, nodeMap, toCanvasX, toCanvasZ }: StaticLayerProps) => (
    <Layer listening={false}>
        {showUndeformedSystem && structuralSystem.elements.map(el => {
            const ni = nodeMap.get(el.node_i);
            const nj = nodeMap.get(el.node_j);
            if (!ni || !nj) return null;
            return <Line key={el.id} stroke={ghostColors.stroke} strokeWidth={10}
                points={[toCanvasX(ni.x), toCanvasZ(ni.z), toCanvasX(nj.x), toCanvasZ(nj.z)]} />;
        })}
        {showUndeformedSystem && structuralSystem.nodes.map(node => (
            <Group key={node.id} x={toCanvasX(node.x)} y={toCanvasZ(node.z)}>
                <NodeShape node={node} colors={ghostColors} />
            </Group>
        ))}
    </Layer>
));

// ─── Main component ───────────────────────────────────────────────────────────

export default function StructuralSystemViewer({
    structuralSystem, getNodePosition, getElementPositions, showUndeformedSystem,
}: StructuralSystemViewerProps) {

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

    // Refs to keep callbacks fresh without restarting subscriptions
    const toCanvasXRef           = useRef(toCanvasX);
    const toCanvasZRef           = useRef(toCanvasZ);
    const getNodePositionRef     = useRef(getNodePosition);
    const getElementPositionsRef = useRef(getElementPositions);
    useEffect(() => { toCanvasXRef.current = toCanvasX; },               [toCanvasX]);
    useEffect(() => { toCanvasZRef.current = toCanvasZ; },               [toCanvasZ]);
    useEffect(() => { getNodePositionRef.current = getNodePosition; },   [getNodePosition]);
    useEffect(() => { getElementPositionsRef.current = getElementPositions; }, [getElementPositions]);

    // Refs to Konva nodes for imperative per-frame updates
    const elementLineRefs        = useRef<Map<number, Konva.Line>>(new Map());
    const elementLabelGroupRefs  = useRef<Map<number, Konva.Group>>(new Map());
    const nodeGroupRefs          = useRef<Map<number, Konva.Group>>(new Map());

    const applyPositions = useCallback((t: number) => {
        for (const element of structuralSystem.elements) {
            const line       = elementLineRefs.current.get(element.id);
            const labelGroup = elementLabelGroupRefs.current.get(element.id);
            if (!line) continue;
            const positions = getElementPositionsRef.current(element.id, t);
            line.points(positions.flatMap(({ x, z }) => [toCanvasXRef.current(x), toCanvasZRef.current(z)]));
            if (labelGroup) {
                const mid = positions[Math.floor(positions.length / 2)];
                labelGroup.x(toCanvasXRef.current(mid.x) - TEXT_BOX_SIZE / 2);
                labelGroup.y(toCanvasZRef.current(mid.z) - TEXT_BOX_SIZE / 2);
            }
        }
        for (const node of structuralSystem.nodes) {
            const group = nodeGroupRefs.current.get(node.id);
            if (!group) continue;
            const pos = getNodePositionRef.current(node.id, t);
            group.x(toCanvasXRef.current(pos.x));
            group.y(toCanvasZRef.current(pos.z));
        }
    }, [structuralSystem]);

    // Subscribe to store — fires synchronously when animation writes time, zero React re-renders
    useEffect(() => {
        return useAnimationStore.subscribe(state => applyPositions(state.time));
    }, [applyPositions]);

    // Reposition when canvas is resized (toCanvasX/Z change)
    useEffect(() => {
        applyPositions(useAnimationStore.getState().time);
    }, [toCanvasX, toCanvasZ, applyPositions]);

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
                    {structuralSystem.elements.map(el => {
                        const initialPositions = getElementPositions(el.id, 0);
                        const initialPoints    = initialPositions.flatMap(({ x, z }) => [toCanvasX(x), toCanvasZ(z)]);
                        const mid              = initialPositions[Math.floor(initialPositions.length / 2)];

                        return (
                            <React.Fragment key={el.id}>
                                <Line
                                    ref={n => { n ? elementLineRefs.current.set(el.id, n) : elementLineRefs.current.delete(el.id); }}
                                    stroke="gray" strokeWidth={10} points={initialPoints}
                                />
                                <Group
                                    ref={n => { n ? elementLabelGroupRefs.current.set(el.id, n) : elementLabelGroupRefs.current.delete(el.id); }}
                                    x={toCanvasX(mid.x) - TEXT_BOX_SIZE / 2}
                                    y={toCanvasZ(mid.z) - TEXT_BOX_SIZE / 2}
                                >
                                    <Rect width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} fill="white" stroke="black" strokeWidth={1} cornerRadius={10} />
                                    <Text width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${el.id}`} fontSize={20} fill="black" align="center" verticalAlign="middle" />
                                </Group>
                            </React.Fragment>
                        );
                    })}
                    {structuralSystem.nodes.map(node => {
                        const pos = getNodePosition(node.id, 0);
                        return (
                            <Group
                                key={node.id}
                                ref={g => { g ? nodeGroupRefs.current.set(node.id, g) : nodeGroupRefs.current.delete(node.id); }}
                                x={toCanvasX(pos.x)}
                                y={toCanvasZ(pos.z)}
                            >
                                <NodeShape node={node} colors={defaultColors} />
                            </Group>
                        );
                    })}
                </Layer>
            </Stage>
        </div>
    );
}
