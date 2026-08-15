import React, { useMemo, useState } from 'react';
import { Badge, Box, Divider, Flex, Group, Modal, Text } from '@mantine/core';
import type { StructuralSystem } from '../../solver/StructuralSystem';
import type { StaticSolution } from '../../solver/StaticSolution';
import type { StructuralLoads } from '../../solver/StructuralLoads';
import { elementForceField } from '../../solver/internalForces';
import { elementDisplacementField } from '../../solver/displacementField';
import { sampleForces, sampleDisplacements } from '../utils/elementCurves';
import { DISPLACEMENT_COLOR, FORCE_COLOR } from '../utils/forceColors';

// ── Color map ────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
    N:  FORCE_COLOR.N,
    V:  FORCE_COLOR.V,
    M:  FORCE_COLOR.M,
    dv: DISPLACEMENT_COLOR.v,
    du: DISPLACEMENT_COLOR.u,
};

const TYPE_YLABEL: Record<string, string> = {
    N:  'Normal Force N',
    V:  'Shear Force V',
    M:  'Bending Moment M',
    dv: 'Transverse Disp. v',
    du: 'Axial Disp. u',
};

// ── SVG diagram ──────────────────────────────────────────────────────────────
const LABEL_STYLE: React.CSSProperties = {
    position: 'absolute',
    fontSize: 10,
    lineHeight: 1,
    fontFamily: 'var(--mantine-font-family-monospace, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontVariantNumeric: 'tabular-nums',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
};

function SVGDiagram({ values, color, invert = false }: { values: number[]; color: string; invert?: boolean }) {
    const W = 300, H = 108;
    const padT = 16, padB = 16, padL = 8, padR = 16;
    const cW = W - padL - padR;
    const cH = H - padT - padB;

    const n = values.length;
    const maxV = Math.max(...values);
    const minV = Math.min(...values);
    const range = maxV - minV;
    const span = Math.max(Math.abs(maxV), Math.abs(minV), 1e-10);

    // Zero is always in view, because the filled area is drawn down to it. A constant
    // series then spans the whole box from the baseline instead of sitting in half of it.
    const lo = Math.min(0, minV);
    const hi = Math.max(0, maxV);
    const isFlat = hi - lo < 1e-12;

    const displayMax   = isFlat ? 1 : hi;
    const displayRange = isFlat ? 2 : hi - lo;

    // Inverted for the bending moment, which is drawn on the tension side: a positive
    // (sagging) moment hangs below the axis, matching the diagram on the structure.
    const toY = (v: number): number => invert
        ? padT + (v - (displayMax - displayRange)) / displayRange * cH
        : padT + (displayMax - v) / displayRange * cH;

    const zerY = toY(0);
    const clampZerY = Math.max(padT, Math.min(padT + cH, zerY));

    const pts = values.map((v, i) => `${padL + (i / (n - 1)) * cW},${toY(v)}`).join(' ');
    const poly = `${padL},${clampZerY} ${pts} ${padL + cW},${clampZerY}`;

    const fmt = (v: number) => {
        const a = Math.abs(v);
        if (a < 1e-9) return '0';
        return a >= 100 ? v.toFixed(1) : v.toFixed(3);
    };

    // The plot is stretched to fill the card, so labels are placed as a percentage of the
    // same box rather than inside the SVG, where they would be stretched with it.
    const pctX = (x: number) => `${(x / W) * 100}%`;
    const pctY = (y: number) => `${(y / H) * 100}%`;

    // Sits on the point it describes, on the far side of the baseline so it never covers
    // the curve, and pulled inside the card near the edges.
    const atPoint = (i: number, v: number) => {
        const fraction = (padL + (i / (n - 1)) * cW) / W;
        const y = toY(v);
        const shiftY = y <= clampZerY ? 'translateY(-115%)' : 'translateY(15%)';

        if (fraction < 0.18) return { left: pctX(padL), top: pctY(y), transform: shiftY };
        if (fraction > 0.82) return { right: pctX(padR / 2), top: pctY(y), transform: shiftY };
        return { left: `${fraction * 100}%`, top: pctY(y), transform: `translateX(-50%) ${shiftY}` };
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                <polygon points={poly} fill={`${color}20`} stroke="none" />
                {/* Stroke width stays in screen pixels, so the non-uniform stretch above
                    cannot make vertical and horizontal lines different weights. */}
                <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <line x1={padL} y1={clampZerY} x2={padL + cW} y2={clampZerY} stroke="#adb5bd" strokeWidth={1} vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
            </svg>

            {Math.abs(maxV) > span * 1e-4 && (
                <span style={{ ...LABEL_STYLE, color, ...atPoint(values.indexOf(maxV), maxV) }}>{fmt(maxV)}</span>
            )}
            {range > span * 1e-4 && (
                <span style={{ ...LABEL_STYLE, color, ...atPoint(values.indexOf(minV), minV) }}>{fmt(minV)}</span>
            )}
        </div>
    );
}

// ── Sidebar component ────────────────────────────────────────────────────────
interface StaticDiagramSidebarProps {
    structuralSystem: StructuralSystem;
    solution: StaticSolution;
    structuralLoads: StructuralLoads;
    selectedElementId?: number | null;
    selectedNodeId?: number | null;
}

export const StaticDiagramSidebar = React.memo(function StaticDiagramSidebar({
    structuralSystem, solution, structuralLoads, selectedElementId, selectedNodeId,
}: StaticDiagramSidebarProps) {
    const [expandedChart, setExpandedChart] = useState<{ key: string; label: string } | null>(null);

    const { elements } = structuralSystem;

    // Active views are driven entirely by which element is selected
    const activeViews = useMemo(() => {
        if (selectedElementId == null) return [];
        const el = structuralSystem.elements.find(e => e.id === selectedElementId);
        const keys = [`N-${selectedElementId}`];
        if (el && el.ei > 0) keys.push(`V-${selectedElementId}`, `M-${selectedElementId}`);
        keys.push(`dv-${selectedElementId}`, `du-${selectedElementId}`);
        return keys;
    }, [selectedElementId, structuralSystem.elements]);

    const selectedNode = selectedNodeId != null
        ? structuralSystem.nodes.find(n => n.id === selectedNodeId) ?? null
        : null;

    // Pre-compute chart data for the selected element only
    const allData = useMemo(() => {
        const map = new Map<string, number[]>();
        const getDof = (dof: number) => solution.get_w(dof);

        elements.forEach(el => {
            const forces = sampleForces(elementForceField(el, structuralLoads, getDof));
            map.set(`N-${el.id}`,  forces.map(p => p.N));
            map.set(`V-${el.id}`,  forces.map(p => p.V));
            map.set(`M-${el.id}`,  forces.map(p => p.M));

            const disps = sampleDisplacements(el, elementDisplacementField(el, structuralLoads, getDof));
            map.set(`dv-${el.id}`, disps.map(p => p.v));
            map.set(`du-${el.id}`, disps.map(p => p.u));
        });
        return map;
    }, [structuralSystem, solution, structuralLoads, elements]);

    const getLabel = (key: string) => {
        const type = key.split('-')[0];
        return TYPE_YLABEL[type] ?? type;
    };

    return (
        <>
            <Modal
                opened={expandedChart !== null}
                onClose={() => setExpandedChart(null)}
                title={expandedChart?.label}
                size="90%"
            >
                {expandedChart && (() => {
                    const type = expandedChart.key.split('-')[0];
                    const values = allData.get(expandedChart.key) ?? [];
                    return (
                        <Box style={{ height: 400 }}>
                            <SVGDiagram values={values} color={TYPE_COLOR[type] ?? '#555'} invert={type === 'M'} />
                        </Box>
                    );
                })()}
            </Modal>

            <Box style={{ width: '30%', height: '100%', overflowY: 'auto', backgroundColor: '#f8f9fa', borderLeft: '1px solid #dee2e6' }}>
                <Flex direction="column" gap="md" p="md">

                    {/* ── Node info card ─────────────────────────────── */}
                    {selectedNode && (() => {
                        const u  = solution.get_w(selectedNode.dofs[0]);
                        const v  = solution.get_w(selectedNode.dofs[1]);
                        const th = solution.get_w(selectedNode.dofs[2]);
                        const fmt = (n: number) => Math.abs(n) < 1e-9 ? '0' : n.toFixed(5);
                        const restraintLabel = [
                            selectedNode.restraint.u ? 'u' : null,
                            selectedNode.restraint.v ? 'v' : null,
                            selectedNode.restraint.theta ? 'θ' : null,
                        ].filter(Boolean).join(', ') || 'free';

                        return (
                            <Box
                                style={{
                                    background: 'white',
                                    border: '2px solid #f59e0b',
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                }}
                            >
                                <Group justify="space-between" mb={6}>
                                    <Text size="xs" fw={800} tt="uppercase" c="#f59e0b">Node {selectedNode.id}</Text>
                                    <Badge size="xs" color="yellow" variant="light">{restraintLabel === 'free' ? 'Free' : `Fixed: ${restraintLabel}`}</Badge>
                                </Group>
                                <Divider mb={8} color="yellow.2" />
                                <Flex direction="column" gap={3}>
                                    {[
                                        { label: 'x',     value: fmt(selectedNode.x) },
                                        { label: 'z',     value: fmt(selectedNode.y) },
                                        { label: 'angle', value: `${(selectedNode.angle * 180 / Math.PI).toFixed(2)} °` },
                                        null,
                                        { label: 'u',  value: fmt(u) },
                                        { label: 'v',  value: fmt(v) },
                                        { label: 'θ',  value: fmt(th) + ' rad' },
                                    ].map((row, i) =>
                                        row === null ? <Divider key={`sp-${i}`} my={4} color="gray.2" /> : (
                                            <Group key={row.label} justify="space-between">
                                                <Text size="xs" c="dimmed" ff="monospace">{row.label}</Text>
                                                <Text size="xs" fw={600} ff="monospace">{row.value}</Text>
                                            </Group>
                                        )
                                    )}
                                </Flex>
                            </Box>
                        );
                    })()}

                    {/* ── Element diagrams ────────────────────────────── */}
                    {activeViews.length > 0 && (
                        <Text size="xs" fw={800} tt="uppercase" c="dimmed">Element {selectedElementId}</Text>
                    )}

                    {activeViews.map(key => {
                        const type = key.split('-')[0];
                        const color = TYPE_COLOR[type] ?? '#555';
                        const label = getLabel(key);
                        const values = allData.get(key) ?? [];

                        return (
                            <Box key={key} style={{ width: '100%' }}>
                                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={5}>{label}</Text>
                                <Box
                                    style={{
                                        height: 140,
                                        width: '100%',
                                        background: 'white',
                                        borderRadius: '4px',
                                        border: '1px solid #eee',
                                        cursor: 'zoom-in',
                                        padding: '6px 8px',
                                    }}
                                    onClick={() => setExpandedChart({ key, label })}
                                >
                                    <SVGDiagram values={values} color={color} invert={type === 'M'} />
                                </Box>
                            </Box>
                        );
                    })}

                    {activeViews.length === 0 && !selectedNode && (
                        <Text size="sm" c="dimmed" ta="center" mt="xl" fs="italic">
                            Click an element or node to inspect it.
                        </Text>
                    )}
                </Flex>
            </Box>
        </>
    );
});
