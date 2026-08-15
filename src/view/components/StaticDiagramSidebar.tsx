import React, { useMemo, useState } from 'react';
import { Badge, Box, Divider, Flex, Group, Modal, Text } from '@mantine/core';
import type { StructuralSystem } from '../../solver/StructuralSystem';
import type { StaticSolution } from '../../solver/StaticSolution';
import type { StructuralLoads } from '../../solver/StructuralLoads';
import { elementForceField } from '../../solver/internalForces';
import { elementDisplacementField } from '../../solver/displacementField';
import { sampleForces, sampleDisplacements } from '../utils/elementCurves';

// ── Color map ────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
    N:  '#2563eb',
    V:  '#16a34a',
    M:  '#dc2626',
    dv: '#d97706',
    du: '#7c3aed',
};

const TYPE_YLABEL: Record<string, string> = {
    N:  'Normal Force N',
    V:  'Shear Force V',
    M:  'Bending Moment M',
    dv: 'Transverse Disp. v',
    du: 'Axial Disp. u',
};

// ── SVG diagram ──────────────────────────────────────────────────────────────
function SVGDiagram({ values, color }: { values: number[]; color: string }) {
    const W = 300, H = 108;
    const padT = 14, padB = 10, padL = 6, padR = 6;
    const cW = W - padL - padR;
    const cH = H - padT - padB;

    const n = values.length;
    const maxV = Math.max(...values);
    const minV = Math.min(...values);
    const range = maxV - minV;
    const span = Math.max(Math.abs(maxV), Math.abs(minV), 1e-10);

    const displayMax   = range > span * 1e-4 ? maxV : span;
    const displayRange = range > span * 1e-4 ? range : span * 2;

    const toY = (v: number): number => padT + (displayMax - v) / displayRange * cH;

    const zerY = toY(0);
    const clampZerY = Math.max(padT, Math.min(padT + cH, zerY));

    const pts = values.map((v, i) => `${padL + (i / (n - 1)) * cW},${toY(v)}`).join(' ');
    const poly = `${padL},${clampZerY} ${pts} ${padL + cW},${clampZerY}`;

    const fmt = (v: number) => {
        const a = Math.abs(v);
        if (a < 1e-9) return '0';
        return a >= 100 ? v.toFixed(1) : v.toFixed(3);
    };

    const crossesZero = minV < -1e-9 && maxV > 1e-9;

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <polygon points={poly} fill={`${color}20`} stroke="none" />
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
            <line x1={padL} y1={clampZerY} x2={padL + cW} y2={clampZerY} stroke="#555" strokeWidth={1.5} />
            {Math.abs(maxV) > span * 1e-4 && (
                <text x={padL + 2} y={padT - 2} fontSize={9} fill={color} fontFamily="monospace">{fmt(maxV)}</text>
            )}
            {range > span * 1e-4 && (
                <text x={padL + 2} y={H - 1} fontSize={9} fill={color} fontFamily="monospace">{fmt(minV)}</text>
            )}
            {crossesZero && Math.abs(zerY - padT) > 12 && Math.abs(zerY - (padT + cH)) > 12 && (
                <text x={padL + cW - 2} y={clampZerY - 3} fontSize={9} fill="#777" fontFamily="monospace" textAnchor="end">0</text>
            )}
        </svg>
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
        const [type, id] = key.split('-');
        return `Element ${id} — ${TYPE_YLABEL[type] ?? type}`;
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
                            <SVGDiagram values={values} color={TYPE_COLOR[type] ?? '#555'} />
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
                                    <SVGDiagram values={values} color={color} />
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
