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
    showNodes: boolean;
    showBearings: boolean;
}

// ─── Visual theme ─────────────────────────────────────────────────────────────
const THEME = {
    // Sizes
    nodeRadius: 14,
    elementStrokeWidth: 6,
    elementLabelFontSize: 13,
    nodeFontSize: 14,
    bearingStrokeWidth: 1.5,
    elementLabelCornerRadius: 6,

    // Active system colors
    nodeStroke: '#1e293b',
    nodeFill: '#ffffff',
    nodeText: '#1e293b',
    supportFill: '#475569',
    elementStroke: '#ff349a',
    elementLabelFill: '#ffffff',
    elementLabelStroke: '#e2e8f0',
    elementLabelText: '#1e293b',

    // Ghost (undeformed) system colors
    ghostNodeStroke: '#cbd5e1',
    ghostNodeFill: '#f8fafc',
    ghostNodeText: '#cbd5e1',
    ghostSupportFill: '#e2e8f0',
    ghostElementStroke: '#e2e8f0',
    ghostElementStrokeWidth: 5,
    ghostElementDash: [8, 5] as number[],

    // Grid colors
    gridLine: '#efefef',
    gridLabel: '#c8c8c8',
    gridLabelFontSize: 11,
};
// ──────────────────────────────────────────────────────────────────────────────


const TEXT_BOX_SIZE = THEME.nodeRadius * 2;
const MARGIN_X = 0.05;
const MARGIN_Z = 0.1;

type NodeColors = { supportFill: string; nodeFill: string; stroke: string; text: string };

// Renders at origin — caller positions via a Group wrapper
function NodeShape({ node, colors, showNode, showBearing }: { node: Node; colors: NodeColors; showNode: boolean; showBearing: boolean }) {
    return <>
        {node.restrained_u && (
            <Shape visible={showBearing} stroke={colors.stroke} fill={colors.supportFill} strokeWidth={THEME.bearingStrokeWidth} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-2 * THEME.nodeRadius, -1.4 * THEME.nodeRadius);
                ctx.lineTo(-2 * THEME.nodeRadius, 1.4 * THEME.nodeRadius);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}
        {node.restrained_v && (
            <Shape visible={showBearing} stroke={colors.stroke} fill={colors.supportFill} strokeWidth={THEME.bearingStrokeWidth} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-1.4 * THEME.nodeRadius, 2 * THEME.nodeRadius);
                ctx.lineTo(1.4 * THEME.nodeRadius, 2 * THEME.nodeRadius);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}


        <Circle visible={showNode} radius={THEME.nodeRadius} fill={colors.nodeFill} stroke={colors.stroke} strokeWidth={2} />

        <Text visible={showNode} x={-TEXT_BOX_SIZE / 2} y={-TEXT_BOX_SIZE / 2} width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${node.id}`} fontSize={THEME.nodeFontSize} fontStyle="bold" fill={colors.text} align="center" verticalAlign="middle" />
    </>;
}

// ─── Grid layer ───────────────────────────────────────────────────────────────

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

interface GridLayerProps {
    canvasWidth: number;
    canvasHeight: number;
    minX: number;
    minZ: number;
    contentWidth: number;
    contentHeight: number;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

const GridLayer = React.memo(({ canvasWidth, canvasHeight, minX, minZ, contentWidth, contentHeight, toCanvasX, toCanvasZ }: GridLayerProps) => {
    if (canvasWidth === 0 || canvasHeight === 0) return null;

    const effWidth = contentWidth === 0 ? 10 : contentWidth;
    const effHeight = contentHeight === 0 ? 10 : contentHeight;

    // World-space extents including margins
    const padX = MARGIN_X / (1 - 2 * MARGIN_X) * effWidth;
    const padZ = MARGIN_Z / (1 - 2 * MARGIN_Z) * effHeight;
    const worldLeft = minX - padX;
    const worldRight = minX + effWidth + padX;
    const worldTop = minZ - padZ;
    const worldBottom = minZ + effHeight + padZ;

    const xInterval = niceInterval(worldRight - worldLeft);
    const zInterval = niceInterval(worldBottom - worldTop);

    const xLines: number[] = [];
    const xStart = Math.ceil(worldLeft / xInterval) * xInterval;
    for (let x = xStart; x <= worldRight + xInterval * 0.01; x += xInterval)
        xLines.push(Math.round(x / xInterval) * xInterval);

    const zLines: number[] = [];
    const zStart = Math.ceil(worldTop / zInterval) * zInterval;
    for (let z = zStart; z <= worldBottom + zInterval * 0.01; z += zInterval)
        zLines.push(Math.round(z / zInterval) * zInterval);

    // Label every other line when there are many, otherwise all
    const xLabelStep = xLines.length > 8 ? 2 : 1;
    const zLabelStep = zLines.length > 8 ? 2 : 1;

    return (
        <Layer listening={false}>
            {xLines.map((x, i) => {
                const cx = toCanvasX(x);
                const showLabel = i % xLabelStep === 0;
                return (
                    <React.Fragment key={`gx-${x}`}>
                        <Line points={[cx, 0, cx, canvasHeight]} stroke={THEME.gridLine} strokeWidth={1} />
                        {showLabel && (
                            <Text x={cx + 3} y={canvasHeight - THEME.gridLabelFontSize - 4} text={formatGridLabel(x, xInterval)} fontSize={THEME.gridLabelFontSize} fill={THEME.gridLabel} />
                        )}
                    </React.Fragment>
                );
            })}
            {zLines.map((z, i) => {
                const cz = toCanvasZ(z);
                const showLabel = i % zLabelStep === 0;
                return (
                    <React.Fragment key={`gz-${z}`}>
                        <Line points={[0, cz, canvasWidth, cz]} stroke={THEME.gridLine} strokeWidth={1} />
                        {showLabel && (
                            <Text x={4} y={cz - THEME.gridLabelFontSize - 2} text={formatGridLabel(z, zInterval)} fontSize={THEME.gridLabelFontSize} fill={THEME.gridLabel} />
                        )}
                    </React.Fragment>
                );
            })}
        </Layer>
    );
});

// ─── Static layer (ghost undeformed system) ───────────────────────────────────

interface StaticLayerProps {
    structuralSystem: StructuralSystem;
    showUndeformedSystem: boolean;
    showNodes: boolean;
    showBearings: boolean;
    nodeMap: Map<number, Node>;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

const StaticLayer = React.memo(({ structuralSystem, showUndeformedSystem, showNodes, showBearings, nodeMap, toCanvasX, toCanvasZ }: StaticLayerProps) => (
    <Layer listening={false}>
        {showUndeformedSystem && structuralSystem.elements.map(el => {
            const ni = nodeMap.get(el.node_i);
            const nj = nodeMap.get(el.node_j);
            if (!ni || !nj) return null;
            return <Line key={el.id} stroke={THEME.ghostElementStroke} strokeWidth={THEME.ghostElementStrokeWidth} dash={THEME.ghostElementDash}
                points={[toCanvasX(ni.x), toCanvasZ(ni.z), toCanvasX(nj.x), toCanvasZ(nj.z)]} />;
        })}
        {showUndeformedSystem && structuralSystem.nodes.map(node => (
            <Group key={node.id} x={toCanvasX(node.x)} y={toCanvasZ(node.z)}>
                <NodeShape node={node} colors={{ stroke: THEME.ghostNodeStroke, nodeFill: THEME.ghostNodeFill, supportFill: THEME.ghostSupportFill, text: THEME.ghostNodeText }} showNode={showNodes} showBearing={showBearings} />
            </Group>
        ))}
    </Layer>
));

// ─── Main component ───────────────────────────────────────────────────────────

const StructuralSystemViewer = React.memo(function StructuralSystemViewer({
    structuralSystem, getNodePosition, getElementPositions, showUndeformedSystem, showNodes, showBearings,
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
    const toCanvasXRef = useRef(toCanvasX);
    const toCanvasZRef = useRef(toCanvasZ);
    const getNodePositionRef = useRef(getNodePosition);
    const getElementPositionsRef = useRef(getElementPositions);
    useEffect(() => { toCanvasXRef.current = toCanvasX; }, [toCanvasX]);
    useEffect(() => { toCanvasZRef.current = toCanvasZ; }, [toCanvasZ]);
    useEffect(() => { getNodePositionRef.current = getNodePosition; }, [getNodePosition]);
    useEffect(() => { getElementPositionsRef.current = getElementPositions; }, [getElementPositions]);

    // Refs to Konva nodes for imperative per-frame updates
    const elementLineRefs = useRef<Map<number, Konva.Line>>(new Map());
    const elementLabelGroupRefs = useRef<Map<number, Konva.Group>>(new Map());
    const nodeGroupRefs = useRef<Map<number, Konva.Group>>(new Map());

    const applyPositions = useCallback((t: number) => {
        for (const element of structuralSystem.elements) {
            const line = elementLineRefs.current.get(element.id);
            const labelGroup = elementLabelGroupRefs.current.get(element.id);
            if (!line) continue;
            const positions = getElementPositionsRef.current(element.id, t);
            line.points(positions.flatMap(({ x, z }) => [toCanvasXRef.current(x), toCanvasZRef.current(z)]));
            if (labelGroup) {
                const mid = {
                    x: (positions[0].x + positions[1].x) / 2,
                    z: (positions[0].z + positions[1].z) / 2
                };
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
                <GridLayer
                    canvasWidth={canvasWidth}
                    canvasHeight={canvasHeight}
                    minX={minX}
                    minZ={minZ}
                    contentWidth={contentWidth}
                    contentHeight={contentHeight}
                    toCanvasX={toCanvasX}
                    toCanvasZ={toCanvasZ}
                />
                <StaticLayer
                    structuralSystem={structuralSystem}
                    showUndeformedSystem={showUndeformedSystem}
                    showNodes={showNodes}
                    showBearings={showBearings}
                    nodeMap={nodeMap}
                    toCanvasX={toCanvasX}
                    toCanvasZ={toCanvasZ}
                />
                <Layer>
                    {structuralSystem.elements.map(el => {
                        const initialPositions = getElementPositions(el.id, 0);
                        const initialPoints = initialPositions.flatMap(({ x, z }) => [toCanvasX(x), toCanvasZ(z)]);

                        const mid = {
                            x: (initialPositions[0].x + initialPositions[1].x) / 2,
                            z: (initialPositions[0].z + initialPositions[1].z) / 2
                        };

                        return (
                            <React.Fragment key={el.id}>
                                <Line
                                    ref={n => { n ? elementLineRefs.current.set(el.id, n) : elementLineRefs.current.delete(el.id); }}
                                    stroke={THEME.elementStroke} strokeWidth={THEME.elementStrokeWidth} points={initialPoints}
                                />
                                <Group
                                    ref={n => { n ? elementLabelGroupRefs.current.set(el.id, n) : elementLabelGroupRefs.current.delete(el.id); }}
                                    x={toCanvasX(mid.x) - TEXT_BOX_SIZE / 2}
                                    y={toCanvasZ(mid.z) - TEXT_BOX_SIZE / 2}
                                >
                                    <Rect width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} fill={THEME.elementLabelFill} stroke={THEME.elementLabelStroke} strokeWidth={1} cornerRadius={THEME.elementLabelCornerRadius} />
                                    <Text width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${el.id}`} fontSize={THEME.elementLabelFontSize} fontStyle="bold" fill={THEME.elementLabelText} align="center" verticalAlign="middle" />
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
                                <NodeShape node={node} colors={{ stroke: THEME.nodeStroke, nodeFill: THEME.nodeFill, supportFill: THEME.supportFill, text: THEME.nodeText }} showNode={showNodes} showBearing={showBearings} />
                            </Group>
                        );
                    })}
                </Layer>
            </Stage>
        </div>
    );
});

export default StructuralSystemViewer;
