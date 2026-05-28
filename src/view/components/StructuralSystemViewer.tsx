import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Arrow, Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { max, min } from 'mathjs';

import { type Node } from "../../models/models";
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
    distributedForces?: DistributedForce[];
    themeOverride?: Partial<Theme>;
}

// ─── Visual theme ─────────────────────────────────────────────────────────────
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
// ──────────────────────────────────────────────────────────────────────────────

const TEXT_BOX_SIZE = 20;
const HINGE_RADIUS  = 7;
const HINGE_OFFSET  = THEME.nodeRadius + HINGE_RADIUS;
const MARGIN_X = 0.05;
const MARGIN_Z = 0.1;
const CONTENT_MIN_DIM = 1.0;
const CONTENT_MAX_RATIO = 5;

type NodeColors = { supportFill: string; nodeFill: string; nodeCircleFill: string; stroke: string; text: string };

function NodeShape({ node, colors, showNode, showBearing, jointRef }: { node: Node; colors: NodeColors; showNode: boolean; showBearing: boolean; jointRef?: React.Ref<Konva.Group> }) {
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
                      <Line points={[-R + 2, 0, R - 2, 0]} stroke={colors.stroke === THEME.ghostNodeStroke ? '#94a3b8' : 'white'} strokeWidth={1.5} />
                      <Line points={[0, -R + 2, 0, R - 2]} stroke={colors.stroke === THEME.ghostNodeStroke ? '#94a3b8' : 'white'} strokeWidth={1.5} />
                  </Group>
            }
        </Group>
        <Text visible={showNode} x={R + 3} y={-R - 8} text={`${node.id}`} fontSize={THEME.nodeFontSize} fontStyle="bold" fill={colors.text} />
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
                <NodeShape node={node} colors={{ stroke: THEME.ghostNodeStroke, nodeFill: THEME.ghostNodeFill, nodeCircleFill: THEME.ghostNodeFill, supportFill: THEME.ghostSupportFill, text: THEME.ghostNodeText }} showNode={showNodes} showBearing={showBearings} />
            </Group>
        ))}
    </Layer>
));

interface ForceVisualizationLayerProps {
    structuralSystem: StructuralSystem;
    toCanvasX: (x: number) => number;
    toCanvasZ: (z: number) => number;
    canvasWidth: number;
    canvasHeight: number;
    getElementPositions: (elementId: number, time: number) => Array<{ x: number; z: number }>;
    pointForces?: PointForce[];
    distributedForces?: DistributedForce[];
    theme: Theme;
}

export const ForceVisualizationLayer = React.memo(({
    structuralSystem,
    toCanvasX,
    toCanvasZ,
    canvasWidth,
    canvasHeight,
    getElementPositions,
    pointForces = [],
    distributedForces = [],
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
    const TICK_COUNT = 5;

    return (
        <Layer listening={false}>
            {/* ─── Render Point Forces ─── */}
            {pointForces.map(force => {
                const node = structuralSystem.nodes.find(n => n.id === force.nodeId);
                if (!node) return null;
                const cx = toCanvasX(node.x);
                const cy = toCanvasZ(node.z);

                const rad = (force.angle * Math.PI) / 180;
                const sign = force.magnitude >= 0 ? 1 : -1;
                const dx = Math.sin(rad) * sign;
                const dy = Math.cos(rad) * sign;
                
                const pxPerUnit = force.scale !== undefined ? force.scale : defaultArrowPxPerUnit;
                const len = Math.abs(force.magnitude) * pxPerUnit;

                const headX = cx - dx * (theme.nodeRadius + LOAD_GAP);
                const headY = cy - dy * (theme.nodeRadius + LOAD_GAP);

                const tailX = headX - dx * len;
                const tailY = headY - dy * len;

                return (
                    <Group key={`pt-force-${force.id}`}>
                        <Arrow
                            points={[tailX, tailY, headX, headY]}
                            fill={force.color} stroke={force.color} strokeWidth={2.5}
                            pointerLength={10} pointerWidth={8} listening={false}
                        />
                        {force.label && (
                            <Text
                                x={tailX - dx * 10}
                                y={tailY - dy * 10}
                                text={force.label}
                                fontSize={11}
                                fontStyle="bold"
                                fill={force.color}
                                align="center"
                            />
                        )}
                    </Group>
                );
            })}

            {/* ─── Render Distributed Forces ─── */}
            {distributedForces.map(force => {
                const el = structuralSystem.elements.find(e => e.id === force.elementId);
                if (!el) return null;

                const positions = getElementPositions(el.id, 0);
                if (positions.length < 2 || force.distribution.length < 2) return null;

                const pStart = positions[0];
                const pEnd = positions[positions.length - 1];
                const cStart = { x: toCanvasX(pStart.x), y: toCanvasZ(pStart.z) };
                const cEnd = { x: toCanvasX(pEnd.x), y: toCanvasZ(pEnd.z) };
                const dx = cEnd.x - cStart.x;
                const dy = cEnd.y - cStart.y;
                const dL = Math.hypot(dx, dy);
                if (dL < 1e-6) return null;

                const ux = dx / dL;
                const uy = dy / dL;
                const nx = -uy;
                const ny = ux;

                const getDeformedPosAtXi = (xi: number) => {
                    const idxFloat = xi * (positions.length - 1);
                    const idxLow = Math.floor(idxFloat);
                    const idxHigh = Math.ceil(idxFloat);
                    const t = idxFloat - idxLow;
                    const pLow = positions[idxLow];
                    const pHigh = positions[idxHigh];
                    return {
                        x: toCanvasX(pLow.x + t * (pHigh.x - pLow.x)),
                        z: toCanvasZ(pLow.z + t * (pHigh.z - pLow.z))
                    };
                };

                if (force.renderStyle === 'arrows') {
                    const segments: Array<{
                        distribution: Array<{ xi: number; value: number }>;
                        sign: 1 | -1;
                    }> = [];

                    let currentPoints: Array<{ xi: number; value: number }> = [force.distribution[0]];
                    for (let i = 0; i < force.distribution.length - 1; i++) {
                        const p0 = force.distribution[i];
                        const p1 = force.distribution[i + 1];

                        if (p0.value * p1.value < 0) {
                            const xi_0 = p0.xi + (0 - p0.value) / (p1.value - p0.value) * (p1.xi - p0.xi);
                            const zeroPt = { xi: xi_0, value: 0 };
                            currentPoints.push(zeroPt);
                            
                            const nonZeroPt = currentPoints.find(p => Math.abs(p.value) > 1e-10);
                            const segmentSign = nonZeroPt ? (nonZeroPt.value >= 0 ? 1 : -1) : 1;
                            
                            segments.push({
                                distribution: currentPoints,
                                sign: segmentSign as any
                            });
                            currentPoints = [zeroPt, p1];
                        } else {
                            currentPoints.push(p1);
                        }
                    }
                    const nonZeroPt = currentPoints.find(p => Math.abs(p.value) > 1e-10);
                    const segmentSign = nonZeroPt ? (nonZeroPt.value >= 0 ? 1 : -1) : 1;
                    segments.push({
                        distribution: currentPoints,
                        sign: segmentSign as any
                    });

                    const pxPerUnit = force.scale !== undefined ? force.scale : defaultArrowPxPerUnit;

                    const loadNx = -nx;
                    const loadNy = -ny;
                    const forceAngle = force.angle ?? 0;
                    const theta = (forceAngle * Math.PI) / 180;
                    const O_x = loadNx * Math.cos(theta) + loadNy * Math.sin(theta);
                    const O_y = -loadNx * Math.sin(theta) + loadNy * Math.cos(theta);

                    const parallel = Math.abs(Math.sin(theta)) > Math.sin((75 * Math.PI) / 180);

                    return (
                        <React.Fragment key={`dist-force-${force.id}`}>
                            {segments.map((seg, segIdx) => {
                                const segmentDist = seg.distribution;
                                const segmentSign = seg.sign;

                                const envelopePoints: number[] = [];
                                const basePoints: number[] = [];

                                const mappedPts = segmentDist.map(pt => {
                                    const basePos = getDeformedPosAtXi(pt.xi);
                                    const val = pt.value;
                                    const absVal = Math.abs(val);

                                    const nearX = basePos.x + loadNx * segmentSign * LOAD_GAP;
                                    const nearY = basePos.z + loadNy * segmentSign * LOAD_GAP;

                                    const farX = nearX + O_x * segmentSign * absVal * pxPerUnit;
                                    const farY = nearY + O_y * segmentSign * absVal * pxPerUnit;

                                    return { nearX, nearY, farX, farY, value: val };
                                });

                                mappedPts.forEach(pt => {
                                    basePoints.push(pt.nearX, pt.nearY);
                                });
                                for (let k = mappedPts.length - 1; k >= 0; k--) {
                                    envelopePoints.push(mappedPts[k].farX, mappedPts[k].farY);
                                }
                                const fullPolyPoints = [...basePoints, ...envelopePoints];

                                const ticks: React.ReactNode[] = [];
                                for (let k = 0; k < TICK_COUNT; k++) {
                                    const t = k / (TICK_COUNT - 1);
                                    
                                    let val = 0;
                                    let nearX = 0, nearY = 0, farX = 0, farY = 0;
                                    
                                    if (mappedPts.length === 2) {
                                        val = mappedPts[0].value + t * (mappedPts[1].value - mappedPts[0].value);
                                        nearX = mappedPts[0].nearX + t * (mappedPts[1].nearX - mappedPts[0].nearX);
                                        nearY = mappedPts[0].nearY + t * (mappedPts[1].nearY - mappedPts[0].nearY);
                                        farX = mappedPts[0].farX + t * (mappedPts[1].farX - mappedPts[0].farX);
                                        farY = mappedPts[0].farY + t * (mappedPts[1].farY - mappedPts[0].farY);
                                    } else {
                                        const targetXi = segmentDist[0].xi + t * (segmentDist[segmentDist.length - 1].xi - segmentDist[0].xi);
                                        let segIndex = 0;
                                        for (let i = 0; i < segmentDist.length - 1; i++) {
                                            if (targetXi >= segmentDist[i].xi && targetXi <= segmentDist[i + 1].xi) {
                                                segIndex = i;
                                                break;
                                            }
                                        }
                                        const p0 = segmentDist[segIndex];
                                        const p1 = segmentDist[segIndex + 1];
                                        const segT = (p1.xi - p0.xi) > 1e-6 ? (targetXi - p0.xi) / (p1.xi - p0.xi) : 0;
                                        
                                        const m0 = mappedPts[segIndex];
                                        const m1 = mappedPts[segIndex + 1];

                                        val = p0.value + segT * (p1.value - p0.value);
                                        nearX = m0.nearX + segT * (m1.nearX - m0.nearX);
                                        nearY = m0.nearY + segT * (m1.nearY - m0.nearY);
                                        farX = m0.farX + segT * (m1.farX - m0.farX);
                                        farY = m0.farY + segT * (m1.farY - m0.farY);
                                    }

                                    if (Math.abs(val) < 1e-10) continue;

                                    const arrowColor = typeof force.color === 'string' ? force.color : (val >= 0 ? force.color.positive : force.color.negative);

                                    ticks.push(
                                        <Arrow
                                            key={`tick-${force.id}-${segIdx}-${k}`}
                                            points={[farX, farY, nearX, nearY]}
                                            fill={arrowColor} stroke={arrowColor} strokeWidth={1.5}
                                            pointerLength={6} pointerWidth={5} listening={false}
                                        />
                                    );
                                }

                                const strokeColor = typeof force.color === 'string' ? force.color : force.color.positive;
                                const fillColor = strokeColor.startsWith('rgba') 
                                    ? strokeColor.replace(/[\d\.]+\)$/, '0.15)')
                                    : 'rgba(239, 68, 68, 0.15)';

                                return (
                                    <React.Fragment key={`seg-${segIdx}`}>
                                        {!parallel && (
                                            <Line
                                                points={fullPolyPoints}
                                                fill={fillColor} stroke={strokeColor} strokeWidth={1.5}
                                                closed listening={false}
                                            />
                                        )}
                                        {ticks}
                                    </React.Fragment>
                                );
                            })}
                        </React.Fragment>
                    );
                } else {
                    const pxScale = force.scale ?? 1.0;
                    const diagNx = -nx;
                    const diagNy = -ny;

                    const curvePoints = force.distribution.map(pt => {
                        const basePos = getDeformedPosAtXi(pt.xi);
                        const offsetHeight = pt.value * pxScale;
                        
                        return {
                            x: basePos.x + diagNx * offsetHeight,
                            y: basePos.z + diagNy * offsetHeight,
                            val: pt.value,
                            xi: pt.xi
                        };
                    });

                    const polyPoints: number[] = [];
                    for (let k = 0; k < positions.length; k++) {
                        polyPoints.push(toCanvasX(positions[k].x), toCanvasZ(positions[k].z));
                    }
                    for (let k = curvePoints.length - 1; k >= 0; k--) {
                        polyPoints.push(curvePoints[k].x, curvePoints[k].y);
                    }

                    const avgVal = curvePoints.reduce((acc, p) => acc + p.val, 0) / curvePoints.length;
                    let strokeColor = 'rgba(16, 185, 129, 0.7)';
                    let fillColor = 'rgba(16, 185, 129, 0.12)';

                    if (typeof force.color === 'string') {
                        strokeColor = force.color;
                        fillColor = force.color.startsWith('rgba')
                            ? force.color.replace(/[\d\.]+\)$/, '0.12)')
                            : force.color + '22';
                    } else {
                        const c = avgVal >= 0 ? force.color.positive : force.color.negative;
                        strokeColor = c;
                        fillColor = c.startsWith('rgba')
                            ? c.replace(/[\d\.]+\)$/, '0.12)')
                            : c + '22';
                    }

                    const hatchLines: React.ReactNode[] = [];
                    curvePoints.forEach((cPt, k) => {
                        if (k === 0 || k === curvePoints.length - 1 || k % 3 === 0) {
                            const basePos = getDeformedPosAtXi(cPt.xi);
                            hatchLines.push(
                                <Line
                                    key={`hatch-${force.id}-${k}`}
                                    points={[basePos.x, basePos.z, cPt.x, cPt.y]}
                                    stroke={strokeColor}
                                    strokeWidth={1}
                                    opacity={0.4}
                                />
                            );
                        }
                    });

                    const labels: React.ReactNode[] = [];
                    if (force.showLabels && curvePoints.length >= 2) {
                        const startVal = curvePoints[0].val;
                        const endVal = curvePoints[curvePoints.length - 1].val;
                        
                        let peakIndex = 0;
                        let maxAbsVal = -1;
                        for (let k = 0; k < curvePoints.length; k++) {
                            const absVal = Math.abs(curvePoints[k].val);
                            if (absVal > maxAbsVal) {
                                maxAbsVal = absVal;
                                peakIndex = k;
                            }
                        }
                        const peakVal = curvePoints[peakIndex].val;

                        const labelFormat = (val: number) => {
                            return Math.abs(val) < 1e-1 ? '0' : `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
                        };

                        const threshold = 1e-1;
                        if (Math.abs(startVal) > threshold) {
                            labels.push(
                                <Text
                                    key={`lbl-start-${force.id}`}
                                    x={curvePoints[0].x + diagNx * 5}
                                    y={curvePoints[0].y + diagNy * 5}
                                    text={labelFormat(startVal)}
                                    fontSize={10}
                                    fill={theme.nodeText}
                                    align="center"
                                />
                            );
                        }
                        if (Math.abs(endVal) > threshold && Math.abs(endVal - startVal) > threshold) {
                            labels.push(
                                <Text
                                    key={`lbl-end-${force.id}`}
                                    x={curvePoints[curvePoints.length - 1].x + diagNx * 5}
                                    y={curvePoints[curvePoints.length - 1].y + diagNy * 5}
                                    text={labelFormat(endVal)}
                                    fontSize={10}
                                    fill={theme.nodeText}
                                    align="center"
                                />
                            );
                        }
                        if (peakIndex > 0 && peakIndex < curvePoints.length - 1 && Math.abs(peakVal) > threshold) {
                            labels.push(
                                <Text
                                    key={`lbl-peak-${force.id}`}
                                    x={curvePoints[peakIndex].x + diagNx * 5}
                                    y={curvePoints[peakIndex].y + diagNy * 5}
                                    text={labelFormat(peakVal)}
                                    fontSize={10}
                                    fontStyle="bold"
                                    fill={theme.nodeText}
                                    align="center"
                                />
                            );
                        }
                    }

                    const boundaryPoints = curvePoints.flatMap(p => [p.x, p.y]);

                    return (
                        <React.Fragment key={`dist-diag-${force.id}`}>
                            <Line
                                points={polyPoints}
                                fill={fillColor}
                                closed={true}
                            />
                            <Line
                                points={boundaryPoints}
                                stroke={strokeColor}
                                strokeWidth={1.5}
                            />
                            {hatchLines}
                            {labels}
                        </React.Fragment>
                    );
                }
            })}
        </Layer>
    );
});

// ─── Animated layer (deformed active system) ──────────────────────────────────

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
}

function AnimatedLayer({ structuralSystem, getNodePosition, getElementPositions, showNodes, showBearings, showHinges = false, showReferenceFiber = false, toCanvasX, toCanvasZ, theme }: AnimatedLayerProps) {
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
                    const lo = Math.floor(mi), hi = Math.ceil(mi), t = mi - lo;
                    const mid = { x: positions[lo].x + t * (positions[hi].x - positions[lo].x), z: positions[lo].z + t * (positions[hi].z - positions[lo].z) };
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

                return (
                    <React.Fragment key={el.id}>
                        <Line
                            ref={n => { n ? elementLineRefs.current.set(el.id, n) : elementLineRefs.current.delete(el.id); }}
                            stroke={theme.elementStroke} strokeWidth={theme.elementStrokeWidth} points={initialPoints}
                        />
                        {showReferenceFiber && (
                            <Line
                                ref={n => { n ? referenceFiberRefs.current.set(el.id, n) : referenceFiberRefs.current.delete(el.id); }}
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                                dash={[3, 3]}
                                points={initialFiberPoints}
                            />
                        )}
                        <Group
                            ref={n => { n ? elementLabelGroupRefs.current.set(el.id, n) : elementLabelGroupRefs.current.delete(el.id); }}
                            x={toCanvasX(mid.x) - TEXT_BOX_SIZE / 2}
                            y={toCanvasZ(mid.z) - TEXT_BOX_SIZE / 2}
                        >
                            <Rect width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} fill={theme.elementLabelFill} stroke={theme.elementLabelStroke} strokeWidth={1} cornerRadius={theme.elementLabelCornerRadius} />
                            <Text width={TEXT_BOX_SIZE} height={TEXT_BOX_SIZE} text={`${el.id}`} fontSize={theme.elementLabelFontSize} fontStyle="bold" fill={theme.elementLabelText} align="center" verticalAlign="middle" />
                        </Group>
                        {showHinges && el.releases_i.theta && (
                            <Circle
                                ref={c => { c ? hingeCircleRefs.current.set(`${el.id}-i`, c) : hingeCircleRefs.current.delete(`${el.id}-i`); }}
                                x={hcxi + HINGE_OFFSET * hdxi} y={hcyi + HINGE_OFFSET * hdyi}
                                radius={HINGE_RADIUS} fill={theme.hingeFill} stroke={theme.hingeStroke} strokeWidth={1.5}
                            />
                        )}
                        {showHinges && el.releases_j.theta && (
                            <Circle
                                ref={c => { c ? hingeCircleRefs.current.set(`${el.id}-j`, c) : hingeCircleRefs.current.delete(`${el.id}-j`); }}
                                x={hcxj + HINGE_OFFSET * hdxj} y={hcyj + HINGE_OFFSET * hdyj}
                                radius={HINGE_RADIUS} fill={theme.hingeFill} stroke={theme.hingeStroke} strokeWidth={1.5}
                            />
                        )}
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
                        <NodeShape 
                            node={node} 
                            colors={{ stroke: theme.nodeStroke, nodeFill: theme.nodeFill, nodeCircleFill: theme.nodeCircleFill, supportFill: theme.supportFill, text: theme.nodeText }} 
                            showNode={showNodes} 
                            showBearing={showBearings}
                            jointRef={g => { g ? nodeJointRefs.current.set(node.id, g) : nodeJointRefs.current.delete(node.id); }}
                        />
                    </Group>
                );
            })}
        </Layer>
    );
}

const StructuralSystemViewer = React.memo(function StructuralSystemViewer({
    structuralSystem, getNodePosition, getElementPositions, showUndeformedSystem, showNodes, showBearings, showHinges, showReferenceFiber, pointForces, distributedForces, themeOverride,
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
                    lineColor={effectiveTheme.gridLine}
                    labelColor={effectiveTheme.gridLabel}
                    labelFontSize={effectiveTheme.gridLabelFontSize}
                />
                <GhostLayer
                    structuralSystem={structuralSystem}
                    show={showUndeformedSystem}
                    showNodes={showNodes} showBearings={showBearings}
                    nodeMap={nodeMap} toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                />
                {(pointForces || distributedForces) && (
                    <ForceVisualizationLayer
                        structuralSystem={structuralSystem}
                        toCanvasX={toCanvasX} toCanvasZ={toCanvasZ}
                        canvasWidth={canvasWidth} canvasHeight={canvasHeight}
                        getElementPositions={getElementPositions}
                        pointForces={pointForces}
                        distributedForces={distributedForces}
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
                />
            </Stage>
        </div>
    );
});

export default StructuralSystemViewer;
