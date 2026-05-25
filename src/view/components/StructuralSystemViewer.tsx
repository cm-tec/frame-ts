import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Arrow, Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node, type Element, type Loads } from "../../models/models";
import type { StructuralSystem } from '../../solver/StructuralSystem';
import { useAnimationStore } from '../../store/animationStore';
import { niceInterval, formatGridLabel } from '../utils/grid';

export interface LoadVisualization {
    loads: Loads;
    scale: number;
    showNodal: boolean;
    showElement: boolean;
}

interface StructuralSystemViewerProps {
    structuralSystem: StructuralSystem;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number };
    getElementPositions: (elementId: number, time: number) => Array<{ x: number; z: number }>;
    showUndeformedSystem: boolean;
    showNodes: boolean;
    showBearings: boolean;
    loadVisualization?: LoadVisualization;
}

// ─── Visual theme ─────────────────────────────────────────────────────────────
const THEME = {
    nodeRadius: 14,
    elementStrokeWidth: 6,
    elementLabelFontSize: 13,
    nodeFontSize: 14,
    bearingStrokeWidth: 1.5,
    elementLabelCornerRadius: 6,

    nodeStroke: '#1e293b',
    nodeFill: '#ffffff',
    nodeText: '#1e293b',
    supportFill: '#475569',
    elementStroke: '#ff349a',
    elementLabelFill: '#ffffff',
    elementLabelStroke: '#e2e8f0',
    elementLabelText: '#1e293b',

    ghostNodeStroke: '#cbd5e1',
    ghostNodeFill: '#f8fafc',
    ghostNodeText: '#cbd5e1',
    ghostSupportFill: '#e2e8f0',
    ghostElementStroke: '#e2e8f0',
    ghostElementStrokeWidth: 5,
    ghostElementDash: [8, 5] as number[],

    gridLine: '#efefef',
    gridLabel: '#c8c8c8',
    gridLabelFontSize: 11,
};
// ──────────────────────────────────────────────────────────────────────────────

const TEXT_BOX_SIZE = THEME.nodeRadius * 2;
const MARGIN_X = 0.05;
const MARGIN_Z = 0.1;
const CONTENT_MIN_DIM = 1.0;
const CONTENT_MAX_RATIO = 5;

type NodeColors = { supportFill: string; nodeFill: string; stroke: string; text: string };

function NodeShape({ node, colors, showNode, showBearing }: { node: Node; colors: NodeColors; showNode: boolean; showBearing: boolean }) {
    return <>
        {node.restraint.u && (
            <Shape visible={showBearing} stroke={colors.stroke} fill={colors.supportFill} strokeWidth={THEME.bearingStrokeWidth} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-2 * THEME.nodeRadius, -1.4 * THEME.nodeRadius);
                ctx.lineTo(-2 * THEME.nodeRadius, 1.4 * THEME.nodeRadius);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}
        {node.restraint.v && (
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


interface GridLayerProps {
    canvasWidth: number;
    canvasHeight: number;
    worldLeft: number;
    worldRight: number;
    worldBottom: number;
    worldTop: number;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
    lineColor?: string;
    labelColor?: string;
    labelFontSize?: number;
}

export const GridLayer = React.memo(({ canvasWidth, canvasHeight, worldLeft, worldRight, worldBottom, worldTop, toCanvasX, toCanvasZ, lineColor = THEME.gridLine, labelColor = THEME.gridLabel, labelFontSize = THEME.gridLabelFontSize }: GridLayerProps) => {
    if (canvasWidth === 0 || canvasHeight === 0) return null;

    const interval = niceInterval(Math.max(worldRight - worldLeft, worldTop - worldBottom));

    const xLines: number[] = [];
    for (let x = Math.ceil(worldLeft / interval) * interval; x <= worldRight + interval * 0.01; x += interval)
        xLines.push(Math.round(x / interval) * interval);

    const zLines: number[] = [];
    for (let z = Math.ceil(worldBottom / interval) * interval; z <= worldTop + interval * 0.01; z += interval)
        zLines.push(Math.round(z / interval) * interval);

    const labelStep = Math.max(xLines.length, zLines.length) > 8 ? 2 : 1;

    return (
        <Layer listening={false}>
            {xLines.map((x, i) => {
                const cx = toCanvasX(x);
                return (
                    <React.Fragment key={`gx-${x}`}>
                        <Line points={[cx, 0, cx, canvasHeight]} stroke={lineColor} strokeWidth={1} />
                        {i % labelStep === 0 && <Text x={cx + 3} y={canvasHeight - labelFontSize - 4} text={formatGridLabel(x, interval)} fontSize={labelFontSize} fill={labelColor} />}
                    </React.Fragment>
                );
            })}
            {zLines.map((z, i) => {
                const cz = toCanvasZ(z);
                return (
                    <React.Fragment key={`gz-${z}`}>
                        <Line points={[0, cz, canvasWidth, cz]} stroke={lineColor} strokeWidth={1} />
                        {i % labelStep === 0 && <Text x={4} y={cz - labelFontSize - 2} text={formatGridLabel(z, interval)} fontSize={labelFontSize} fill={labelColor} />}
                    </React.Fragment>
                );
            })}
        </Layer>
    );
});

// ─── Ghost layer (undeformed system overlay) ──────────────────────────────────

interface GhostLayerProps {
    structuralSystem: StructuralSystem;
    show: boolean;
    showNodes: boolean;
    showBearings: boolean;
    nodeMap: Map<number, Node>;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

const GhostLayer = React.memo(({ structuralSystem, show, showNodes, showBearings, nodeMap, toCanvasX, toCanvasZ }: GhostLayerProps) => (
    <Layer listening={false}>
        {show && structuralSystem.elements.map(el => {
            const ni = nodeMap.get(el.node_i);
            const nj = nodeMap.get(el.node_j);
            if (!ni || !nj) return null;
            return <Line key={el.id} stroke={THEME.ghostElementStroke} strokeWidth={THEME.ghostElementStrokeWidth} dash={THEME.ghostElementDash}
                points={[toCanvasX(ni.x), toCanvasZ(ni.z), toCanvasX(nj.x), toCanvasZ(nj.z)]} />;
        })}
        {show && structuralSystem.nodes.map(node => (
            <Group key={node.id} x={toCanvasX(node.x)} y={toCanvasZ(node.z)}>
                <NodeShape node={node} colors={{ stroke: THEME.ghostNodeStroke, nodeFill: THEME.ghostNodeFill, supportFill: THEME.ghostSupportFill, text: THEME.ghostNodeText }} showNode={showNodes} showBearing={showBearings} />
            </Group>
        ))}
    </Layer>
));

// ─── Load layer ───────────────────────────────────────────────────────────────

const LOAD_FILL   = 'rgba(239, 68, 68, 0.15)';
const LOAD_STROKE = 'rgba(239, 68, 68, 0.8)';
const TICK_COUNT  = 5;
const LOAD_GAP    = THEME.elementStrokeWidth / 2 + 18;

interface LoadLayerProps {
    structuralSystem: { nodes: Node[], elements: Element[] };
    lv: LoadVisualization;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
    canvasWidth: number;
    canvasHeight: number;
}

export function LoadLayer({ structuralSystem, lv, toCanvasX, toCanvasZ, canvasWidth, canvasHeight }: LoadLayerProps) {
    const { loads, scale, showNodal, showElement } = lv;

    let maxVal = 1e-10;
    if (showNodal)   loads.nodes.forEach(l => { maxVal = Math.max(maxVal, Math.abs(l.magnitude)); });
    if (showElement) loads.elements.forEach(l => { maxVal = Math.max(maxVal, Math.abs(l.q_i), Math.abs(l.q_j)); });
    const pxPerUnit = (0.15 * Math.min(canvasWidth, canvasHeight) / maxVal) * scale;

    const loadDir = (angleDeg: number) => {
        const r = (angleDeg * Math.PI) / 180;
        return { dx: -Math.sin(r), dy: Math.cos(r) };
    };

    return (
        <Layer listening={false}>
            {showNodal && loads.nodes.map(load => {
                const node = structuralSystem.nodes.find(n => n.id === load.node_id);
                if (!node) return null;
                const cx = toCanvasX(node.x);
                const cy = toCanvasZ(node.z);
                
                const { dx, dy } = loadDir(load.angle);
                const sign = load.magnitude >= 0 ? 1 : -1;
                const len = Math.abs(load.magnitude) * pxPerUnit;
                
                const tailX = cx + sign * dx * (THEME.nodeRadius + LOAD_GAP);
                const tailY = cy + sign * dy * (THEME.nodeRadius + LOAD_GAP);
                
                return (
                    <Arrow key={load.id}
                        points={[tailX, tailY, tailX + sign * dx * len, tailY + sign * dy * len]}
                        fill={LOAD_STROKE} stroke={LOAD_STROKE} strokeWidth={2.5}
                        pointerLength={10} pointerWidth={8} listening={false}
                    />
                );
            })}

            {showElement && loads.elements.map(load => {
                const el = structuralSystem.elements.find(e => e.id === load.element_id);
                if (!el) return null;
                const ni = structuralSystem.nodes.find(n => n.id === el.node_i);
                const nj = structuralSystem.nodes.find(n => n.id === el.node_j);
                if (!ni || !nj) return null;
                
                const cxi = toCanvasX(ni.x), cyi = toCanvasZ(ni.z);
                const cxj = toCanvasX(nj.x), cyj = toCanvasZ(nj.z);

                // 1. Calculate path vector directly on the canvas to prevent grid-squish bugs
                const pixelDx = cxj - cxi;
                const pixelDy = cyj - cyi;
                const canvasLength = Math.hypot(pixelDx, pixelDy);
                
                if (canvasLength < 1e-6) return null;

                const cDx = pixelDx / canvasLength; 
                const cDy = pixelDy / canvasLength; 

                // 2. Base Normal Vector (N_x, N_y). 
                // On a screen where Y goes DOWN, this strictly points UP to the "TOP" of the beam
                const N_x = cDy; 
                const N_y = -cDx;

                // 3. Apply the custom load angle 
                // (Rotating CW on canvas effectively rotates CCW physically)
                const theta = (load.angle * Math.PI) / 180;
                const O_x = N_x * Math.cos(theta) - N_y * Math.sin(theta);
                const O_y = N_x * Math.sin(theta) + N_y * Math.cos(theta);

                // 4. Directional multipliers based on load intensity
                const sqi = load.q_i >= 0 ? 1 : -1;
                const sqj = load.q_j >= 0 ? 1 : -1;

                // 5. Build Polygon Envelopes
                // The "near" gap pushes off the beam purely in the Top/Bottom normal direction
                const nearXi = cxi + N_x * sqi * LOAD_GAP;
                const nearYi = cyi + N_y * sqi * LOAD_GAP;
                const nearXj = cxj + N_x * sqj * LOAD_GAP;
                const nearYj = cyj + N_y * sqj * LOAD_GAP;

                // The "far" boundary extends out along the angled load direction
                const farXi  = nearXi + O_x * sqi * Math.abs(load.q_i) * pxPerUnit;
                const farYi  = nearYi + O_y * sqi * Math.abs(load.q_i) * pxPerUnit;
                const farXj  = nearXj + O_x * sqj * Math.abs(load.q_j) * pxPerUnit;
                const farYj  = nearYj + O_y * sqj * Math.abs(load.q_j) * pxPerUnit;

                // A load should only be considered parallel if it's within 15° of the beam axis (75° to 90°)
                const parallel = Math.abs(Math.sin(theta)) > Math.sin((75 * Math.PI) / 180);

                const ticks = Array.from({ length: TICK_COUNT }, (_, k) => {
                    const t = k / (TICK_COUNT - 1);
                    const q = load.q_i + t * (load.q_j - load.q_i);
                    if (Math.abs(q) < 1e-10) return null;

                    const tFarX = farXi + t * (farXj - farXi);
                    const tFarY = farYi + t * (farYj - farYi);
                    const tNearX = nearXi + t * (nearXj - nearXi);
                    const tNearY = nearYi + t * (nearYj - nearYi);

                    // Because we carefully defined the offsets expanding AWAY from the beam,
                    // arrows ALWAYS point from far to near. No ternary flips required!
                    return (
                        <Arrow key={k}
                            points={[tFarX, tFarY, tNearX, tNearY]}
                            fill={LOAD_STROKE} stroke={LOAD_STROKE} strokeWidth={1.5}
                            pointerLength={6} pointerWidth={5} listening={false}
                        />
                    );
                });

                return (
                    <React.Fragment key={load.id}>
                        {!parallel && (
                            <Line 
                                points={[nearXi, nearYi, nearXj, nearYj, farXj, farYj, farXi, farYi]}
                                fill={LOAD_FILL} stroke={LOAD_STROKE} strokeWidth={1.5} closed listening={false} 
                            />
                        )}
                        {ticks}
                    </React.Fragment>
                );
            })}
        </Layer>
    );
}

// ─── Animated layer (deformed active system) ──────────────────────────────────

interface AnimatedLayerProps {
    structuralSystem: StructuralSystem;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number };
    getElementPositions: (elementId: number, time: number) => Array<{ x: number; z: number }>;
    showNodes: boolean;
    showBearings: boolean;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

function AnimatedLayer({ structuralSystem, getNodePosition, getElementPositions, showNodes, showBearings, toCanvasX, toCanvasZ }: AnimatedLayerProps) {
    const toCanvasXRef          = useRef(toCanvasX);
    const toCanvasZRef          = useRef(toCanvasZ);
    const getNodePositionRef    = useRef(getNodePosition);
    const getElementPositionsRef = useRef(getElementPositions);
    useEffect(() => { toCanvasXRef.current = toCanvasX; },           [toCanvasX]);
    useEffect(() => { toCanvasZRef.current = toCanvasZ; },           [toCanvasZ]);
    useEffect(() => { getNodePositionRef.current = getNodePosition; }, [getNodePosition]);
    useEffect(() => { getElementPositionsRef.current = getElementPositions; }, [getElementPositions]);

    const elementLineRefs       = useRef<Map<number, Konva.Line>>(new Map());
    const elementLabelGroupRefs = useRef<Map<number, Konva.Group>>(new Map());
    const nodeGroupRefs         = useRef<Map<number, Konva.Group>>(new Map());

    const applyPositions = useCallback((t: number) => {
        for (const el of structuralSystem.elements) {
            const line       = elementLineRefs.current.get(el.id);
            const labelGroup = elementLabelGroupRefs.current.get(el.id);
            if (!line) continue;
            const positions = getElementPositionsRef.current(el.id, t);
            line.points(positions.flatMap(({ x, z }) => [toCanvasXRef.current(x), toCanvasZRef.current(z)]));
            if (labelGroup) {
                const mid = positions[Math.floor((positions.length - 1) / 2)];
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

    useEffect(() => useAnimationStore.subscribe(state => applyPositions(state.time)), [applyPositions]);
    useEffect(() => { applyPositions(useAnimationStore.getState().time); }, [toCanvasX, toCanvasZ, applyPositions, showNodes, showBearings]);

    return (
        <Layer>
            {structuralSystem.elements.map(el => {
                const initialPositions = getElementPositions(el.id, 0);
                const initialPoints    = initialPositions.flatMap(({ x, z }) => [toCanvasX(x), toCanvasZ(z)]);
                const mid = initialPositions[Math.floor((initialPositions.length - 1) / 2)];

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
                        x={toCanvasX(pos.x)} y={toCanvasZ(pos.z)}
                    >
                        <NodeShape node={node} colors={{ stroke: THEME.nodeStroke, nodeFill: THEME.nodeFill, supportFill: THEME.supportFill, text: THEME.nodeText }} showNode={showNodes} showBearing={showBearings} />
                    </Group>
                );
            })}
        </Layer>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

const StructuralSystemViewer = React.memo(function StructuralSystemViewer({
    structuralSystem, getNodePosition, getElementPositions, showUndeformedSystem, showNodes, showBearings, loadVisualization,
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

    const { contentCx, contentCz, contentWidth, contentHeight } = useMemo(() => {
        const xs = structuralSystem.nodes.map(n => n.x);
        const zs = structuralSystem.nodes.map(n => n.z);
        if (xs.length === 0) return { contentCx: 0, contentCz: 0, contentWidth: CONTENT_MIN_DIM, contentHeight: CONTENT_MIN_DIM };
        const rawMinX = min(xs), rawMaxX = max(xs);
        const rawMinZ = min(zs), rawMaxZ = max(zs);
        const rawW = rawMaxX - rawMinX;
        const rawH = rawMaxZ - rawMinZ;
        const contentWidth  = Math.max(rawW, rawH / CONTENT_MAX_RATIO, CONTENT_MIN_DIM);
        const contentHeight = Math.max(rawH, rawW / CONTENT_MAX_RATIO, CONTENT_MIN_DIM);
        return {
            contentCx: (rawMinX + rawMaxX) / 2,
            contentCz: (rawMinZ + rawMaxZ) / 2,
            contentWidth,
            contentHeight,
        };
    }, [structuralSystem]);

    const nodeMap = useMemo(() => new Map(structuralSystem.nodes.map(n => [n.id, n])), [structuralSystem]);

    const { width: canvasWidth, height: canvasHeight } = stageSize;

    const scaleParams = useMemo(() => {
        if (canvasWidth === 0 || canvasHeight === 0) return null;
        const sx = (1 - 2 * MARGIN_X) * canvasWidth  / contentWidth;
        const sz = (1 - 2 * MARGIN_Z) * canvasHeight / contentHeight;
        return { scale: Math.min(sx, sz), cx: contentCx, cz: contentCz };
    }, [canvasWidth, canvasHeight, contentWidth, contentHeight, contentCx, contentCz]);

    const toCanvasX = useCallback((x: number) => {
        if (!scaleParams) return 0;
        return canvasWidth  / 2 + (x - scaleParams.cx) * scaleParams.scale;
    }, [canvasWidth, scaleParams]);

    const toCanvasZ = useCallback((z: number) => {
        if (!scaleParams) return 0;
        return canvasHeight / 2 - (z - scaleParams.cz) * scaleParams.scale;
    }, [canvasHeight, scaleParams]);

    const worldBounds = useMemo(() => {
        if (!scaleParams) return { worldLeft: 0, worldRight: 1, worldBottom: -1, worldTop: 1 };
        const { scale, cx, cz } = scaleParams;
        return {
            worldLeft:   cx - canvasWidth  / (2 * scale),
            worldRight:  cx + canvasWidth  / (2 * scale),
            worldBottom: cz - canvasHeight / (2 * scale),
            worldTop:    cz + canvasHeight / (2 * scale),
        };
    }, [scaleParams, canvasWidth, canvasHeight]);

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
            <Stage width={canvasWidth} height={canvasHeight}>
                <GridLayer
                    canvasWidth={canvasWidth} canvasHeight={canvasHeight}
                    {...worldBounds}
                    toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                />
                <GhostLayer
                    structuralSystem={structuralSystem}
                    show={showUndeformedSystem}
                    showNodes={showNodes} showBearings={showBearings}
                    nodeMap={nodeMap} toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                />
                {loadVisualization && (
                    <LoadLayer
                        structuralSystem={structuralSystem} lv={loadVisualization}
                        toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                        canvasWidth={canvasWidth} canvasHeight={canvasHeight}
                    />
                )}
                <AnimatedLayer
                    structuralSystem={structuralSystem}
                    getNodePosition={getNodePosition} getElementPositions={getElementPositions}
                    showNodes={showNodes} showBearings={showBearings}
                    toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                />
            </Stage>
        </div>
    );
});

export default StructuralSystemViewer;
