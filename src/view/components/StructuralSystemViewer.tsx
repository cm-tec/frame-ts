import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Arrow, Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type StructuralNode } from "../../solver/StructuralSystem";
import type { StructuralSystem } from '../../solver/StructuralSystem';
import { useAnimationStore } from '../../store/animationStore';
import { niceInterval, formatGridLabel } from '../utils/grid';

export interface PointForce {
    id: string | number;
    nodeId: number;
    magnitude: number;
    angle: number; // degrees, global angle (0 = downwards)
    color: string;
    scale?: number;
    label?: string;
}

export interface PointMoment {
    id: string | number;
    nodeId: number;
    magnitude: number;
    color: string;
    label?: string;
}

export interface DistributedForce {
    id: string | number;
    elementId: number;
    distribution: Array<{ xi: number; value: number }>;
    angle?: number; // degrees relative to normal (default = 0)
    color: string | { positive: string; negative: string };
    scale?: number;
    renderStyle: 'arrows' | 'diagram';
    showLabels?: boolean;
}

interface StructuralSystemViewerProps {
    structuralSystem: StructuralSystem;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number; theta?: number };
    getElementPositions: (elementId: number, time: number) => Array<{ x: number; z: number }>;
    showUndeformedSystem: boolean;
    showNodes: boolean;
    showBearings: boolean;
    showHinges?: boolean;
    showReferenceFiber?: boolean;
    pointForces?: PointForce[];
    pointMoments?: PointMoment[];
    distributedForces?: DistributedForce[];
    themeOverride?: Partial<Theme>;
    selectedElementId?: number | null;
    selectedNodeId?: number | null;
    onElementClick?: (elementId: number) => void;
    onNodeClick?: (nodeId: number) => void;
    showNodeCross?: boolean;
}

// #region Visual theme ─────────────────────────────────────────────────────────
const THEME = {
    nodeRadius: 8,
    bearingSize: 10,
    elementStrokeWidth: 6,
    elementLabelFontSize: 13,
    nodeFontSize: 18,
    bearingStrokeWidth: 1.5,
    elementLabelCornerRadius: 6,

    nodeStroke:      '#1e293b',
    nodeFill:        '#1e293b',
    nodeCircleFill:  '#1e293b',
    nodeText:        '#1e293b',
    supportFill: '#475569',
    elementStroke: '#ff349a',
    elementLabelFill: '#ffffff',
    elementLabelStroke: '#e2e8f0',
    elementLabelText: '#1e293b',

    ghostNodeStroke: '#cbd5e1',
    ghostNodeFill: 'transparent',
    ghostNodeText: '#cbd5e1',
    ghostSupportFill: '#e2e8f0',
    ghostElementStroke: '#e2e8f0',
    ghostElementStrokeWidth: 5,
    ghostElementDash: [8, 5] as number[],

    gridLine: '#efefef',
    gridLabel: '#c8c8c8',
    gridLabelFontSize: 11,

    hingeFill:   'white',
    hingeStroke: '#ff349a',   // matches elementStroke — hinge belongs to the element
};
export type Theme = typeof THEME;
// #endregion

const TEXT_BOX_SIZE = 20;
const HINGE_RADIUS  = 7;
const MOMENT_MIN_RADIUS = 30;
const MOMENT_CENTRE_DEG = 220;
const HINGE_OFFSET  = THEME.nodeRadius + HINGE_RADIUS;
const MARGIN_X = 0.05;
const MARGIN_Z = 0.1;
const CONTENT_MIN_DIM = 1.0;
const CONTENT_MAX_RATIO = 5;

type NodeColors = { supportFill: string; nodeFill: string; nodeCircleFill: string; stroke: string; text: string };

// The corners of whatever bearing glyphs NodeShape draws for this node, in the same
// canvas coordinates. Kept next to the shapes so the two cannot drift apart.
function supportOutline(node: StructuralNode, B: number): Array<[number, number]> {
    const corners: Array<[number, number]> = [];

    if (node.restraint.u) corners.push([0, 0], [-3 * B, -2 * B], [-3 * B, 2 * B]);
    if (node.restraint.v) corners.push([0, 0], [-2 * B, 3 * B], [2 * B, 3 * B]);

    return corners;
}

function NodeShape({ node, colors, showNode, showBearing, showNodeCross = false, jointRef }: { node: StructuralNode; colors: NodeColors; showNode: boolean; showBearing: boolean; showNodeCross?: boolean; jointRef?: React.Ref<Konva.Group> }) {
    const R = THEME.nodeRadius;
    const B = THEME.bearingSize;
    return <>
        {node.restraint.u && (
            <Shape visible={showBearing} stroke={colors.stroke} fill={colors.supportFill} strokeWidth={THEME.bearingStrokeWidth} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-3 * B, -2 * B);
                ctx.lineTo(-3 * B, 2 * B);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}
        {node.restraint.v && (
            <Shape visible={showBearing} stroke={colors.stroke} fill={colors.supportFill} strokeWidth={THEME.bearingStrokeWidth} sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-2 * B, 3 * B);
                ctx.lineTo(2 * B, 3 * B);
                ctx.closePath();
                ctx.fillStrokeShape(shape);
            }} />
        )}
        <Group ref={jointRef}>
            {node.restraint.theta
                ? <Rect visible={showNode} x={-(B-2)} y={-(B-2)} width={2 * (B-2)} height={2 * (B-2)} fill={colors.nodeFill} stroke={colors.stroke} strokeWidth={2} />
                : <Group visible={showNode}>
                      <Circle radius={R} fill={colors.nodeCircleFill} stroke={colors.stroke} strokeWidth={2} />
                      {showNodeCross && (
                          <>
                              <Line points={[-R + 2, 0, R - 2, 0]} stroke={colors.stroke === THEME.ghostNodeStroke ? '#94a3b8' : 'white'} strokeWidth={1.5} />
                              <Line points={[0, -R + 2, 0, R - 2]} stroke={colors.stroke === THEME.ghostNodeStroke ? '#94a3b8' : 'white'} strokeWidth={1.5} />
                          </>
                      )}
                  </Group>
            }
        </Group>
        <Text visible={showNode} x={R + 3} y={-R - 8} text={`${node.id}`} fontSize={THEME.nodeFontSize} fontStyle="bold" fill={colors.text} />
    </>;
}

// #region Grid layer ───────────────────────────────────────────────────────────


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

// #endregion

// #region Ghost layer ──────────────────────────────────────────────────────────

interface GhostLayerProps {
    structuralSystem: StructuralSystem;
    show: boolean;
    showNodes: boolean;
    showBearings: boolean;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
}

const GhostLayer = React.memo(({ structuralSystem, show, showNodes, showBearings, toCanvasX, toCanvasZ }: GhostLayerProps) => (
    <Layer listening={false}>
        {show && structuralSystem.elements.map(el => {
            return <Line key={el.id} stroke={THEME.ghostElementStroke} strokeWidth={THEME.ghostElementStrokeWidth} dash={THEME.ghostElementDash}
                points={[toCanvasX(el.n_i.x), toCanvasZ(el.n_i.y), toCanvasX(el.n_j.x), toCanvasZ(el.n_j.y)]} />;
        })}
        {show && structuralSystem.nodes.map(node => (
            <Group key={node.id} x={toCanvasX(node.x)} y={toCanvasZ(node.y)}>
                <NodeShape node={node} colors={{ stroke: THEME.ghostNodeStroke, nodeFill: THEME.ghostNodeFill, nodeCircleFill: THEME.ghostNodeFill, supportFill: THEME.ghostSupportFill, text: THEME.ghostNodeText }} showNode={showNodes} showBearing={showBearings} />
            </Group>
        ))}
    </Layer>
));

// #endregion

// #region Force render helpers ─────────────────────────────────────────────────

const TICK_COUNT = 5;

function withAlpha(color: string, alpha: string, fallback?: string): string {
    if (color.startsWith('rgba')) return color.replace(/[\d\.]+\)$/, `${alpha})`);
    return fallback ?? color;
}

function refSetter<T>(mapRef: { current: Map<any, T> }, id: any) {
    return (node: T | null) => { node ? mapRef.current.set(id, node) : mapRef.current.delete(id); };
}

function renderArrowsForce(
    force: DistributedForce,
    nx: number, ny: number,
    getDeformedPosAtXi: (xi: number) => { x: number; z: number },
    pxPerUnit: number,
    loadGap: number,
): React.ReactNode {
    const segments: Array<{ distribution: Array<{ xi: number; value: number }>; sign: 1 | -1 }> = [];
    let currentPoints = [force.distribution[0]];
    for (let i = 0; i < force.distribution.length - 1; i++) {
        const p0 = force.distribution[i], p1 = force.distribution[i + 1];
        if (p0.value * p1.value < 0) {
            const zeroPt = { xi: p0.xi + (0 - p0.value) / (p1.value - p0.value) * (p1.xi - p0.xi), value: 0 };
            currentPoints.push(zeroPt);
            const nonZero = currentPoints.find(p => Math.abs(p.value) > 1e-10);
            segments.push({ distribution: currentPoints, sign: (nonZero ? (nonZero.value >= 0 ? 1 : -1) : 1) as 1 | -1 });
            currentPoints = [zeroPt, p1];
        } else {
            currentPoints.push(p1);
        }
    }
    const nonZero = currentPoints.find(p => Math.abs(p.value) > 1e-10);
    segments.push({ distribution: currentPoints, sign: (nonZero ? (nonZero.value >= 0 ? 1 : -1) : 1) as 1 | -1 });

    const loadNx = -nx, loadNy = -ny;
    const theta = ((force.angle ?? 0) * Math.PI) / 180;
    const O_x = loadNx * Math.cos(theta) + loadNy * Math.sin(theta);
    const O_y = -loadNx * Math.sin(theta) + loadNy * Math.cos(theta);
    const parallel = Math.abs(Math.sin(theta)) > Math.sin((75 * Math.PI) / 180);

    return (
        <React.Fragment key={`dist-force-${force.id}`}>
            {segments.map((seg, segIdx) => {
                const { distribution: segDist, sign: segSign } = seg;
                const mappedPts = segDist.map(pt => {
                    const base = getDeformedPosAtXi(pt.xi);
                    const absVal = Math.abs(pt.value);
                    const nearX = base.x + loadNx * segSign * loadGap;
                    const nearY = base.z + loadNy * segSign * loadGap;
                    return { nearX, nearY, farX: nearX + O_x * segSign * absVal * pxPerUnit, farY: nearY + O_y * segSign * absVal * pxPerUnit, value: pt.value };
                });

                const basePts = mappedPts.flatMap(p => [p.nearX, p.nearY]);
                const envPts  = [...mappedPts].reverse().flatMap(p => [p.farX, p.farY]);

                const ticks: React.ReactNode[] = [];
                for (let k = 0; k < TICK_COUNT; k++) {
                    const tickT = k / (TICK_COUNT - 1);
                    let val = 0, nearX = 0, nearY = 0, farX = 0, farY = 0;
                    if (mappedPts.length === 2) {
                        const lerp = (a: number, b: number) => a + tickT * (b - a);
                        val = lerp(mappedPts[0].value, mappedPts[1].value);
                        nearX = lerp(mappedPts[0].nearX, mappedPts[1].nearX); nearY = lerp(mappedPts[0].nearY, mappedPts[1].nearY);
                        farX  = lerp(mappedPts[0].farX,  mappedPts[1].farX);  farY  = lerp(mappedPts[0].farY,  mappedPts[1].farY);
                    } else {
                        const targetXi = segDist[0].xi + tickT * (segDist[segDist.length - 1].xi - segDist[0].xi);
                        let si = 0;
                        for (let i = 0; i < segDist.length - 1; i++) {
                            if (targetXi >= segDist[i].xi && targetXi <= segDist[i + 1].xi) { si = i; break; }
                        }
                        const p0 = segDist[si], p1 = segDist[si + 1];
                        const m0 = mappedPts[si], m1 = mappedPts[si + 1];
                        const segT = (p1.xi - p0.xi) > 1e-6 ? (targetXi - p0.xi) / (p1.xi - p0.xi) : 0;
                        const lerp = (a: number, b: number) => a + segT * (b - a);
                        val = lerp(p0.value, p1.value);
                        nearX = lerp(m0.nearX, m1.nearX); nearY = lerp(m0.nearY, m1.nearY);
                        farX  = lerp(m0.farX,  m1.farX);  farY  = lerp(m0.farY,  m1.farY);
                    }
                    if (Math.abs(val) < 1e-10) continue;
                    const arrowColor = typeof force.color === 'string' ? force.color : (val >= 0 ? force.color.positive : force.color.negative);
                    ticks.push(
                        <Arrow key={`tick-${force.id}-${segIdx}-${k}`}
                            points={[farX, farY, nearX, nearY]}
                            fill={arrowColor} stroke={arrowColor} strokeWidth={1.5}
                            pointerLength={6} pointerWidth={5} listening={false}
                        />
                    );
                }
                const strokeColor = typeof force.color === 'string' ? force.color : force.color.positive;
                const fillColor = withAlpha(strokeColor, '0.15', 'rgba(239, 68, 68, 0.15)');
                return (
                    <React.Fragment key={`seg-${segIdx}`}>
                        {!parallel && <Line points={[...basePts, ...envPts]} fill={fillColor} stroke={strokeColor} strokeWidth={1.5} closed listening={false} />}
                        {ticks}
                    </React.Fragment>
                );
            })}
        </React.Fragment>
    );
}

function renderDiagramForce(
    force: DistributedForce,
    nx: number, ny: number,
    basePoints: number[],
    getDeformedPosAtXi: (xi: number) => { x: number; z: number },
    theme: Theme,
): React.ReactNode {
    const pxScale = force.scale ?? 1.0;
    const diagNx = -nx, diagNy = -ny;

    const curvePoints = force.distribution.map(pt => {
        const base = getDeformedPosAtXi(pt.xi);
        const off = pt.value * pxScale;
        return { x: base.x + diagNx * off, y: base.z + diagNy * off, val: pt.value, xi: pt.xi };
    });

    const polyPoints = [...basePoints, ...curvePoints.slice().reverse().flatMap(p => [p.x, p.y])];

    const avgVal = curvePoints.reduce((acc, p) => acc + p.val, 0) / curvePoints.length;
    let strokeColor = 'rgba(16, 185, 129, 0.7)';
    let fillColor   = 'rgba(16, 185, 129, 0.12)';
    if (typeof force.color === 'string') {
        strokeColor = force.color;
        fillColor = withAlpha(force.color, '0.12', force.color + '22');
    } else {
        const c = avgVal >= 0 ? force.color.positive : force.color.negative;
        strokeColor = c;
        fillColor = withAlpha(c, '0.12', c + '22');
    }

    const hatchLines = curvePoints.flatMap((cPt, k) => {
        if (k !== 0 && k !== curvePoints.length - 1 && k % 3 !== 0) return [];
        const base = getDeformedPosAtXi(cPt.xi);
        return [<Line key={`hatch-${force.id}-${k}`} points={[base.x, base.z, cPt.x, cPt.y]} stroke={strokeColor} strokeWidth={1} opacity={0.4} />];
    });

    const labels: React.ReactNode[] = [];
    if (force.showLabels && curvePoints.length >= 2) {
        const threshold = 1e-1;
        const fmt = (v: number) => Math.abs(v) < threshold ? '0' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
        const startVal = curvePoints[0].val;
        const endVal   = curvePoints[curvePoints.length - 1].val;
        let peakIndex = 0, maxAbs = -1;
        for (let k = 0; k < curvePoints.length; k++) {
            if (Math.abs(curvePoints[k].val) > maxAbs) { maxAbs = Math.abs(curvePoints[k].val); peakIndex = k; }
        }
        const peakVal = curvePoints[peakIndex].val;
        const lbl = (key: string, x: number, y: number, text: string, bold = false) => (
            <Text key={key} x={x} y={y} text={text} fontSize={10} fontStyle={bold ? 'bold' : 'normal'} fill={theme.nodeText} align="center" />
        );
        if (Math.abs(startVal) > threshold)
            labels.push(lbl(`lbl-start-${force.id}`, curvePoints[0].x + diagNx * 5, curvePoints[0].y + diagNy * 5, fmt(startVal)));
        if (Math.abs(endVal) > threshold && Math.abs(endVal - startVal) > threshold)
            labels.push(lbl(`lbl-end-${force.id}`, curvePoints[curvePoints.length - 1].x + diagNx * 5, curvePoints[curvePoints.length - 1].y + diagNy * 5, fmt(endVal)));
        if (peakIndex > 0 && peakIndex < curvePoints.length - 1 && Math.abs(peakVal) > threshold)
            labels.push(lbl(`lbl-peak-${force.id}`, curvePoints[peakIndex].x + diagNx * 5, curvePoints[peakIndex].y + diagNy * 5, fmt(peakVal), true));
    }

    return (
        <React.Fragment key={`dist-diag-${force.id}`}>
            <Line points={polyPoints} fill={fillColor} closed />
            <Line points={curvePoints.flatMap(p => [p.x, p.y])} stroke={strokeColor} strokeWidth={1.5} />
            {hatchLines}
            {labels}
        </React.Fragment>
    );
}

// #endregion

// #region ForceVisualizationLayer ──────────────────────────────────────────────

interface ForceVisualizationLayerProps {
    structuralSystem: StructuralSystem;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
    canvasWidth: number;
    canvasHeight: number;
    getElementPositions: (elementId: number, time: number) => Array<{ x: number; z: number }>;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number; theta?: number };
    pointForces?: PointForce[];
    pointMoments?: PointMoment[];
    distributedForces?: DistributedForce[];
    showBearings?: boolean;
    theme: Theme;
}

export const ForceVisualizationLayer = React.memo(({
    structuralSystem,
    toCanvasX,
    toCanvasZ,
    canvasWidth,
    canvasHeight,
    getElementPositions,
    getNodePosition,
    pointForces = [],
    pointMoments = [],
    distributedForces = [],
    showBearings = false,
    theme
}: ForceVisualizationLayerProps) => {
    let maxArrowVal = 1e-10;
    pointForces.forEach(f => { maxArrowVal = Math.max(maxArrowVal, Math.abs(f.magnitude)); });
    distributedForces.forEach(f => {
        if (f.renderStyle === 'arrows') {
            f.distribution.forEach(pt => { maxArrowVal = Math.max(maxArrowVal, Math.abs(pt.value)); });
        }
    });
    const defaultArrowPxPerUnit = (0.15 * Math.min(canvasWidth, canvasHeight) / maxArrowVal);

    const LOAD_GAP = theme.elementStrokeWidth / 2 + 18;

    return (
        <Layer listening={false}>
            {/* ─── Render Point Forces ─── */}
            {pointForces.map(force => {
                const node = structuralSystem.nodes.find(n => n.id === force.nodeId);
                if (!node) return null;
                const drawnAt = getNodePosition(node.id, 0);
                const cx = toCanvasX(drawnAt.x);
                const cy = toCanvasZ(drawnAt.z);

                const rad = (force.angle * Math.PI) / 180;
                const sign = force.magnitude >= 0 ? 1 : -1;
                const dx = Math.sin(rad) * sign;
                const dy = Math.cos(rad) * sign;
                
                const pxPerUnit = force.scale !== undefined ? force.scale : defaultArrowPxPerUnit;
                const len = Math.abs(force.magnitude) * pxPerUnit;

                // How far the drawn support reaches along the arrow's own direction, so a
                // reaction starts outside its bearing rather than on top of it.
                const clearance = showBearings
                    ? supportOutline(node, theme.bearingSize)
                        .reduce((furthest, [vx, vy]) => Math.max(furthest, vx * -dx + vy * -dy), 0)
                    : 0;

                const standoff = Math.max(theme.nodeRadius + LOAD_GAP, clearance + 8);

                const headX = cx - dx * standoff;
                const headY = cy - dy * standoff;

                const tailX = headX - dx * len;
                const tailY = headY - dy * len;

                return (
                    <Group key={`pt-force-${force.id}`}>
                        <Arrow
                            points={[tailX, tailY, headX, headY]}
                            fill={force.color} stroke={force.color} strokeWidth={2.5}
                            pointerLength={10} pointerWidth={8} listening={false}
                        />
                        {force.label && (() => {
                            // Alongside the shaft rather than past its end: above a
                            // horizontal arrow, to the right of a vertical one.
                            let px = -dy, py = dx;
                            if (py > 1e-6 || (Math.abs(py) <= 1e-6 && px < 0)) { px = -px; py = -py; }

                            const anchorX = (tailX + headX) / 2 + px * 8;
                            const anchorY = (tailY + headY) / 2 + py * 8;

                            const boxW = 90;
                            const lineH = 13;

                            return (
                                <Text
                                    x={anchorX + ((px - 1) / 2) * boxW}
                                    y={anchorY + ((py - 1) / 2) * lineH}
                                    width={boxW}
                                    text={force.label}
                                    fontSize={11}
                                    fontStyle="bold"
                                    fill={force.color}
                                    align={px > 0.3 ? 'left' : px < -0.3 ? 'right' : 'center'}
                                />
                            );
                        })()}
                    </Group>
                );
            })}

            {/* ─── Render Point Moments ─── */}
            {pointMoments.map(moment => {
                const node = structuralSystem.nodes.find(n => n.id === moment.nodeId);
                if (!node) return null;

                const drawnAt = getNodePosition(node.id, 0);
                const cx = toCanvasX(drawnAt.x);
                const cy = toCanvasZ(drawnAt.z);

                const reach = showBearings
                    ? supportOutline(node, theme.bearingSize)
                        .reduce((r, [vx, vy]) => Math.max(r, Math.hypot(vx, vy)), theme.nodeRadius)
                    : theme.nodeRadius;

                const radius = Math.max(reach + 10, MOMENT_MIN_RADIUS);

                // The canvas y axis points down, so decreasing the angle traces the arc
                // counter-clockwise on screen, which is the positive sense.
                const direction = moment.magnitude >= 0 ? -1 : 1;

                // Centred to the lower right: clear of the bearing glyphs, and below the
                // node number, which sits just above and right of the node. Swept the same
                // span either way, so only the arrowhead betrays the sign.
                const middle = MOMENT_CENTRE_DEG * Math.PI / 180;
                const sweep = 110 * Math.PI / 180;
                const start = middle - direction * sweep / 2;

                const arc: number[] = [];
                for (let i = 0; i <= 24; i++) {
                    const a = start + direction * sweep * (i / 24);
                    arc.push(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
                }

                return (
                    <Group key={`pt-moment-${moment.id}`}>
                        <Arrow
                            points={arc}
                            stroke={moment.color} fill={moment.color} strokeWidth={2.5}
                            pointerLength={9} pointerWidth={7} listening={false}
                        />
                        {moment.label && (() => {
                            // Anchored by whichever edge faces the node, so the text runs
                            // outwards instead of back across the arc.
                            const ox = Math.cos(middle);
                            const oy = Math.sin(middle);

                            const anchorX = cx + (radius + 8) * ox;
                            const anchorY = cy + (radius + 8) * oy;

                            const boxW = 90;
                            const lineH = 13;

                            return (
                                <Text
                                    x={ox > 0.3 ? anchorX : ox < -0.3 ? anchorX - boxW : anchorX - boxW / 2}
                                    y={oy > 0.3 ? anchorY : oy < -0.3 ? anchorY - lineH : anchorY - lineH / 2}
                                    width={boxW}
                                    text={moment.label}
                                    fontSize={11}
                                    fontStyle="bold"
                                    fill={moment.color}
                                    align={ox > 0.3 ? 'left' : ox < -0.3 ? 'right' : 'center'}
                                />
                            );
                        })()}
                    </Group>
                );
            })}

            {/* ─── Render Distributed Forces ─── */}
            {distributedForces.map(force => {
                const el = structuralSystem.elements.find(e => e.id === force.elementId);
                if (!el) return null;

                const positions = getElementPositions(el.id, 0);
                if (positions.length < 2 || force.distribution.length < 2) return null;

                const cdx = toCanvasX(positions[positions.length - 1].x) - toCanvasX(positions[0].x);
                const cdy = toCanvasZ(positions[positions.length - 1].z) - toCanvasZ(positions[0].z);
                const dL = Math.hypot(cdx, cdy);
                if (dL < 1e-6) return null;

                const nx = -cdy / dL, ny = cdx / dL;
                const getDeformedPosAtXi = (xi: number) => {
                    const f = xi * (positions.length - 1);
                    const lo = Math.floor(f), hi = Math.ceil(f), frac = f - lo;
                    const pLo = positions[lo], pHi = positions[hi];
                    return { x: toCanvasX(pLo.x + frac * (pHi.x - pLo.x)), z: toCanvasZ(pLo.z + frac * (pHi.z - pLo.z)) };
                };

                const pxPerUnit = force.scale ?? defaultArrowPxPerUnit;

                if (force.renderStyle === 'arrows')
                    return renderArrowsForce(force, nx, ny, getDeformedPosAtXi, pxPerUnit, LOAD_GAP);

                return renderDiagramForce(force, nx, ny, positions.flatMap(p => [toCanvasX(p.x), toCanvasZ(p.z)]), getDeformedPosAtXi, theme);
            })}
        </Layer>
    );
});


// #endregion

// #region AnimatedLayer ────────────────────────────────────────────────────────

const SELECTION_COLOR  = '#f59e0b'; // amber-400 — glow ring / element highlight
const SELECTION_FILL   = '#fde68a'; // amber-200 — bearing & node body fill
const SELECTION_STROKE = '#d97706'; // amber-600 — crisp dark outline

interface AnimatedLayerProps {
    structuralSystem: StructuralSystem;
    getNodePosition: (nodeId: number, time: number) => { x: number; z: number; theta?: number };
    getElementPositions: (elementId: number, time: number) => Array<{ x: number; z: number }>;
    showNodes: boolean;
    showBearings: boolean;
    showHinges?: boolean;
    showReferenceFiber?: boolean;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
    theme: Theme;
    selectedElementId?: number | null;
    selectedNodeId?: number | null;
    onElementClick?: (elementId: number) => void;
    onNodeClick?: (nodeId: number) => void;
    showNodeCross?: boolean;
}

function AnimatedLayer({ structuralSystem, getNodePosition, getElementPositions, showNodes, showBearings, showHinges = false, showReferenceFiber = false, toCanvasX, toCanvasZ, theme, selectedElementId, selectedNodeId, onElementClick, onNodeClick, showNodeCross = false }: AnimatedLayerProps) {
    const toCanvasXRef          = useRef(toCanvasX);
    const toCanvasZRef          = useRef(toCanvasZ);
    const getNodePositionRef    = useRef(getNodePosition);
    const getElementPositionsRef = useRef(getElementPositions);

    const elementLineRefs       = useRef<Map<number, Konva.Line>>(new Map());
    const elementLabelGroupRefs = useRef<Map<number, Konva.Group>>(new Map());
    const nodeGroupRefs         = useRef<Map<number, Konva.Group>>(new Map());
    const nodeJointRefs         = useRef<Map<number, Konva.Group>>(new Map());
    const hingeCircleRefs = useRef<Map<string, Konva.Circle>>(new Map());
    const referenceFiberRefs    = useRef<Map<number, Konva.Line>>(new Map());

    const applyPositions = useCallback((t: number) => {
        for (const el of structuralSystem.elements) {
            const line       = elementLineRefs.current.get(el.id);
            const labelGroup = elementLabelGroupRefs.current.get(el.id);
            const referenceFiber = referenceFiberRefs.current.get(el.id);
            if (line) {
                const positions = getElementPositionsRef.current(el.id, t);
                line.points(positions.flatMap(({ x, z }) => [toCanvasXRef.current(x), toCanvasZRef.current(z)]));
                if (labelGroup) {
                    const mi = (positions.length - 1) / 2;
                    const lo = Math.floor(mi), hi = Math.ceil(mi), frac = mi - lo;
                    const mid = { x: positions[lo].x + frac * (positions[hi].x - positions[lo].x), z: positions[lo].z + frac * (positions[hi].z - positions[lo].z) };
                    labelGroup.x(toCanvasXRef.current(mid.x) - TEXT_BOX_SIZE / 2);
                    labelGroup.y(toCanvasZRef.current(mid.z) - TEXT_BOX_SIZE / 2);
                }
                const first    = positions[0];
                const last     = positions[positions.length - 1];
                const hcxi = toCanvasXRef.current(first.x), hcyi = toCanvasZRef.current(first.z);
                const hcxj = toCanvasXRef.current(last.x),  hcyj = toCanvasZRef.current(last.z);
                
                if (referenceFiber) {
                    const dx = hcxj - hcxi;
                    const dy = hcyj - hcyi;
                    const dL = Math.hypot(dx, dy);
                    if (dL > 1e-6) {
                        const ux = dx / dL;
                        const uy = dy / dL;
                        const rx = -uy;
                        const ry = ux;
                        const offset = 7;
                        referenceFiber.points([
                            hcxi + rx * offset, hcyi + ry * offset,
                            hcxj + rx * offset, hcyj + ry * offset
                        ]);
                    }
                }
                const hi = hingeCircleRefs.current.get(`${el.id}-i`);
                const hj = hingeCircleRefs.current.get(`${el.id}-j`);
                if (hi || hj) {
                    const second   = positions[1];
                    const prevLast = positions[positions.length - 2];
                    if (hi) {
                        const diX = toCanvasXRef.current(second.x) - hcxi;
                        const diY = toCanvasZRef.current(second.z) - hcyi;
                        const diL = Math.hypot(diX, diY);
                        if (diL > 1e-6) { hi.x(hcxi + HINGE_OFFSET * diX / diL); hi.y(hcyi + HINGE_OFFSET * diY / diL); }
                    }
                    if (hj) {
                        const djX = toCanvasXRef.current(prevLast.x) - hcxj;
                        const djY = toCanvasZRef.current(prevLast.z) - hcyj;
                        const djL = Math.hypot(djX, djY);
                        if (djL > 1e-6) { hj.x(hcxj + HINGE_OFFSET * djX / djL); hj.y(hcyj + HINGE_OFFSET * djY / djL); }
                    }
                }
            }
        }
        for (const node of structuralSystem.nodes) {
            const group = nodeGroupRefs.current.get(node.id);
            if (!group) continue;
            const pos = getNodePositionRef.current(node.id, t);
            group.x(toCanvasXRef.current(pos.x));
            group.y(toCanvasZRef.current(pos.z));
            
            const joint = nodeJointRefs.current.get(node.id);
            if (joint && pos.theta !== undefined) {
                joint.rotation(-(pos.theta * 180) / Math.PI);
            }
        }
    }, [structuralSystem]);

    useEffect(() => useAnimationStore.subscribe(state => applyPositions(state.time)), [applyPositions]);
    useLayoutEffect(() => {
        toCanvasXRef.current = toCanvasX;
        toCanvasZRef.current = toCanvasZ;
        getNodePositionRef.current = getNodePosition;
        getElementPositionsRef.current = getElementPositions;
        applyPositions(useAnimationStore.getState().time);
    });

    return (
        <Layer>
            {structuralSystem.elements.map(el => {
                const initialPositions = getElementPositions(el.id, 0);
                const initialPoints    = initialPositions.flatMap(({ x, z }) => [toCanvasX(x), toCanvasZ(z)]);
                const mi   = (initialPositions.length - 1) / 2;
                const mlo  = Math.floor(mi), mhi = Math.ceil(mi), mt = mi - mlo;
                const mid  = { x: initialPositions[mlo].x + mt * (initialPositions[mhi].x - initialPositions[mlo].x), z: initialPositions[mlo].z + mt * (initialPositions[mhi].z - initialPositions[mlo].z) };
                const first    = initialPositions[0];
                const second   = initialPositions[1];
                const prevLast = initialPositions[initialPositions.length - 2];
                const last     = initialPositions[initialPositions.length - 1];
                const hcxi = toCanvasX(first.x), hcyi = toCanvasZ(first.z);
                const hcxj = toCanvasX(last.x),  hcyj = toCanvasZ(last.z);
                // Tangent at i-end: direction first→second
                const diX = toCanvasX(second.x) - hcxi, diY = toCanvasZ(second.z) - hcyi;
                const diL = Math.hypot(diX, diY);
                const hdxi = diL > 1e-6 ? diX / diL : 1;
                const hdyi = diL > 1e-6 ? diY / diL : 0;
                // Tangent at j-end: direction last→prevLast (inward along element)
                const djX = toCanvasX(prevLast.x) - hcxj, djY = toCanvasZ(prevLast.z) - hcyj;
                const djL = Math.hypot(djX, djY);
                const hdxj = djL > 1e-6 ? djX / djL : -1;
                const hdyj = djL > 1e-6 ? djY / djL : 0;

                const fdx = hcxj - hcxi;
                const fdy = hcyj - hcyi;
                const fdL = Math.hypot(fdx, fdy);
                const fux = fdL > 1e-6 ? fdx / fdL : 1;
                const fuy = fdL > 1e-6 ? fdy / fdL : 0;
                const frx = -fuy;
                const fry = fux;
                const foffset = 7;
                const initialFiberPoints = [
                    hcxi + frx * foffset, hcyi + fry * foffset,
                    hcxj + frx * foffset, hcyj + fry * foffset
                ];

                const isElSelected = selectedElementId === el.id;
                return (
                    <React.Fragment key={el.id}>
                        {/* Actual element stroke */}
                        <Line
                            ref={refSetter(elementLineRefs, el.id)}
                            stroke={isElSelected ? SELECTION_COLOR : theme.elementStroke}
                            strokeWidth={theme.elementStrokeWidth}
                            points={initialPoints}
                        />
                        {/* Transparent thick hit-area for easy clicking */}
                        <Line
                            points={initialPoints}
                            stroke="transparent"
                            strokeWidth={theme.elementStrokeWidth + 16}
                            onClick={() => onElementClick?.(el.id)}
                            onTap={() => onElementClick?.(el.id)}
                            style={{ cursor: 'pointer' }}
                        />
                        {showReferenceFiber && (
                            <Line
                                ref={refSetter(referenceFiberRefs, el.id)}
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                                dash={[3, 3]}
                                points={initialFiberPoints}
                            />
                        )}
                        <Group
                            ref={refSetter(elementLabelGroupRefs, el.id)}
                            x={toCanvasX(mid.x) - TEXT_BOX_SIZE / 2}
                            y={toCanvasZ(mid.z) - TEXT_BOX_SIZE / 2}
                            onClick={() => onElementClick?.(el.id)}
                            onTap={() => onElementClick?.(el.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <Rect
                                width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE}
                                fill={isElSelected ? SELECTION_COLOR : theme.elementLabelFill}
                                stroke={isElSelected ? SELECTION_COLOR : theme.elementLabelStroke}
                                strokeWidth={isElSelected ? 2.5 : 1}
                                cornerRadius={theme.elementLabelCornerRadius}
                            />
                            <Text
                                width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE}
                                text={`${el.id}`}
                                fontSize={theme.elementLabelFontSize}
                                fontStyle="bold"
                                fill={isElSelected ? 'white' : theme.elementLabelText}
                                align="center" verticalAlign="middle"
                            />
                        </Group>
                        {showHinges && el.releases_i.theta && (
                            <Circle
                                ref={refSetter(hingeCircleRefs, `${el.id}-i`)}
                                x={hcxi + HINGE_OFFSET * hdxi} y={hcyi + HINGE_OFFSET * hdyi}
                                radius={HINGE_RADIUS} fill={theme.hingeFill} stroke={theme.hingeStroke} strokeWidth={1.5}
                            />
                        )}
                        {showHinges && el.releases_j.theta && (
                            <Circle
                                ref={refSetter(hingeCircleRefs, `${el.id}-j`)}
                                x={hcxj + HINGE_OFFSET * hdxj} y={hcyj + HINGE_OFFSET * hdyj}
                                radius={HINGE_RADIUS} fill={theme.hingeFill} stroke={theme.hingeStroke} strokeWidth={1.5}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        {structuralSystem.nodes.map(node => {
                const pos = getNodePosition(node.id, 0);
                const isNodeSelected = selectedNodeId === node.id;
                const nodeColors = isNodeSelected
                    ? { stroke: SELECTION_STROKE, nodeFill: SELECTION_COLOR, nodeCircleFill: SELECTION_COLOR, supportFill: SELECTION_FILL, text: SELECTION_STROKE }
                    : { stroke: theme.nodeStroke, nodeFill: theme.nodeFill, nodeCircleFill: theme.nodeCircleFill, supportFill: theme.supportFill, text: theme.nodeText };
                return (
                    <Group
                        key={node.id}
                        ref={refSetter(nodeGroupRefs, node.id)}
                        x={toCanvasX(pos.x)} y={toCanvasZ(pos.z)}
                        onClick={() => onNodeClick?.(node.id)}
                        onTap={() => onNodeClick?.(node.id)}
                        style={{ cursor: 'pointer' }}
                    >
                        <NodeShape
                            node={node}
                            colors={nodeColors}
                            showNode={showNodes}
                            showBearing={showBearings}
                            showNodeCross={showNodeCross}
                            jointRef={refSetter(nodeJointRefs, node.id)}
                        />
                        {/* Extra glow ring when selected */}
                        {isNodeSelected && (
                            <Circle radius={THEME.nodeRadius + 5} fill="transparent" stroke={nodeColors.stroke} strokeWidth={2.5} opacity={0.7} />
                        )}
                    </Group>
                );
            })}
        </Layer>
    );
}

// #endregion

// #region StructuralSystemViewer ───────────────────────────────────────────────

const StructuralSystemViewer = React.memo(function StructuralSystemViewer({
    structuralSystem, getNodePosition, getElementPositions, showUndeformedSystem, showNodes, showBearings, showHinges, showReferenceFiber, pointForces, pointMoments, distributedForces, themeOverride,
    selectedElementId, selectedNodeId, onElementClick, onNodeClick, showNodeCross = false,
}: StructuralSystemViewerProps) {
    const effectiveTheme = useMemo(() => ({ ...THEME, ...themeOverride }), [themeOverride]);
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
        const zs = structuralSystem.nodes.map(n => n.y);
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
                    lineColor={effectiveTheme.gridLine}
                    labelColor={effectiveTheme.gridLabel}
                    labelFontSize={effectiveTheme.gridLabelFontSize}
                />
                <GhostLayer
                    structuralSystem={structuralSystem}
                    show={showUndeformedSystem}
                    showNodes={showNodes} showBearings={showBearings}
                    toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                />
                {(pointForces || pointMoments || distributedForces) && (
                    <ForceVisualizationLayer
                        structuralSystem={structuralSystem}
                        toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                        canvasWidth={canvasWidth} canvasHeight={canvasHeight}
                        getElementPositions={getElementPositions}
                        getNodePosition={getNodePosition}
                        pointForces={pointForces}
                        pointMoments={pointMoments}
                        distributedForces={distributedForces}
                        showBearings={showBearings}
                        theme={effectiveTheme}
                    />
                )}
                 <AnimatedLayer
                    structuralSystem={structuralSystem}
                    getNodePosition={getNodePosition} getElementPositions={getElementPositions}
                    showNodes={showNodes} showBearings={showBearings} showHinges={showHinges}
                    showReferenceFiber={showReferenceFiber}
                    toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                    theme={effectiveTheme}
                    selectedElementId={selectedElementId}
                    selectedNodeId={selectedNodeId}
                    onElementClick={onElementClick}
                    onNodeClick={onNodeClick}
                    showNodeCross={showNodeCross}
                />
            </Stage>
        </div>
    );
});

// #endregion

export default StructuralSystemViewer;
