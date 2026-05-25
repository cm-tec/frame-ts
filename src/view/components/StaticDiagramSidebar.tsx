import React, { useMemo, useState } from 'react';
import { Box, CloseButton, Divider, Flex, Group, Modal, MultiSelect, Text } from '@mantine/core';
import type { StructuralSystem } from '../../solver/StructuralSystem';
import type { StaticSolution } from '../../solver/StaticSolution';
import type { Loads } from '../../models/models';
import { elementInternalForces, elementLocalDisplacements } from '../utils/internalForces';

// ── Color map ────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
    N:  '#2563eb',
    V:  '#16a34a',
    M:  '#dc2626',
    dv: '#d97706',
    du: '#7c3aed',
};

const TYPE_YLABEL: Record<string, string> = {
    N:  'N',
    V:  'V',
    M:  'M',
    dv: 'v',
    du: 'u',
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

    // When all values are the same (e.g. constant N), centre zero and show the
    // constant value offset from it using ±span as the display range.
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
            {/* Fill */}
            <polygon points={poly} fill={`${color}20`} stroke="none" />
            {/* Curve */}
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
            {/* Zero axis — always prominent */}
            <line
                x1={padL} y1={clampZerY} x2={padL + cW} y2={clampZerY}
                stroke="#555"
                strokeWidth={1.5}
            />
            {/* Max label */}
            {Math.abs(maxV) > span * 1e-4 && (
                <text x={padL + 2} y={padT - 2} fontSize={9} fill={color} fontFamily="monospace">{fmt(maxV)}</text>
            )}
            {/* Min label */}
            {range > span * 1e-4 && (
                <text x={padL + 2} y={H - 1} fontSize={9} fill={color} fontFamily="monospace">{fmt(minV)}</text>
            )}
            {/* Zero label when crossing */}
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
    loads: Loads;
}

export const StaticDiagramSidebar = React.memo(function StaticDiagramSidebar({
    structuralSystem, solution, loads,
}: StaticDiagramSidebarProps) {
    const [activeViews, setActiveViews] = useState<string[]>([]);
    const [expandedChart, setExpandedChart] = useState<{ key: string; label: string } | null>(null);

    const { elements } = structuralSystem;

    // Build MultiSelect option groups
    const diagramOptions = useMemo(() => {
        const bend = elements.filter(e => e.ei > 0);
        const allItems = (type: string, els: typeof elements) =>
            els.map(e => ({ value: `${type}-${e.id}`, label: `Element ${e.id}` }));

        return [
            { group: 'Normal Force N',          items: allItems('N',  elements) },
            ...(bend.length ? [
                { group: 'Shear Force V',        items: allItems('V',  bend) },
                { group: 'Bending Moment M',     items: allItems('M',  bend) },
            ] : []),
            { group: 'Transverse Displacement v', items: allItems('dv', elements) },
            { group: 'Axial Displacement u',      items: allItems('du', elements) },
        ];
    }, [elements]);

    // Pre-compute all chart data once
    const allData = useMemo(() => {
        const map = new Map<string, number[]>();
        const getDof = (dof: number) => solution.get_w(dof);

        elements.forEach(el => {
            const ni = structuralSystem.nodes.find(n => n.id === el.node_i)!;
            const nj = structuralSystem.nodes.find(n => n.id === el.node_j)!;
            const load = loads.elements.find(l => l.element_id === el.id);
            const loadOpt = load ? { qi: load.q_i, qj: load.q_j } : undefined;

            const forces = elementInternalForces(el, ni, nj, getDof, loadOpt);
            map.set(`N-${el.id}`,  forces.map(p => p.N));
            map.set(`V-${el.id}`,  forces.map(p => p.V));
            map.set(`M-${el.id}`,  forces.map(p => p.M));

            const disps = elementLocalDisplacements(el, ni, nj, getDof, loadOpt);
            map.set(`dv-${el.id}`, disps.map(p => p.v));
            map.set(`du-${el.id}`, disps.map(p => p.u));
        });
        return map;
    }, [structuralSystem, solution, loads, elements]);

    const getLabel = (key: string) => {
        const allItems = diagramOptions.flatMap(g => g.items);
        const opt = allItems.find(o => o.value === key);
        const type = key.split('-')[0];
        return opt ? `${opt.label} — ${TYPE_YLABEL[type]}` : key;
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
                    <MultiSelect
                        placeholder="Add chart…"
                        data={diagramOptions}
                        value={activeViews}
                        onChange={setActiveViews}
                        searchable
                        clearable
                        hidePickedOptions
                    />

                    <Divider variant="dotted" />

                    {activeViews.map(key => {
                        const type = key.split('-')[0];
                        const color = TYPE_COLOR[type] ?? '#555';
                        const label = getLabel(key);
                        const values = allData.get(key) ?? [];

                        return (
                            <Box key={key} style={{ width: '100%' }}>
                                <Group justify="space-between" mb={5} wrap="nowrap">
                                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">{label}</Text>
                                    <CloseButton size="sm" onClick={() => setActiveViews(v => v.filter(k => k !== key))} />
                                </Group>
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

                    {activeViews.length === 0 && (
                        <Text size="sm" c="dimmed" ta="center" mt="xl" fs="italic">
                            No diagrams active.
                        </Text>
                    )}
                </Flex>
            </Box>
        </>
    );
});
