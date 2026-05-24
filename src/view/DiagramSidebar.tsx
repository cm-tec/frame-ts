import React, { useMemo, useState } from 'react';
import { Box, Flex, Text, MultiSelect, Group, CloseButton, Divider, NumberInput, SimpleGrid, Modal } from '@mantine/core';
import MatrixLineChart from "./Chart";
import type { StructuralSystem } from '../solver/StructuralSystem';
import { useVisualizationStore } from '../store/visualizationStore';

interface DiagramSidebarProps {
    structuralSystem: StructuralSystem;
    solution: any;
}

const MemoizedChart = ({ dofIdx, t1, t2, numPoints, solution, label, type }: any) => {
    const historyData = useMemo(() => {
        const fn = type === 'velocity' ? solution.get_dw_history : solution.get_w_history;
        return fn.call(solution, dofIdx, t1, Math.max(1, numPoints), t2 - t1);
    }, [dofIdx, t1, t2, numPoints, solution, type]);

    return <MatrixLineChart matrixData={historyData} yAxis={label} />;
};

export const DiagramSidebar = React.memo(function DiagramSidebar({
    structuralSystem,
    solution,
}: DiagramSidebarProps) {
    const { t1, setT1, t2, setT2, numPoints, setNumPoints, activeDiagramViews, setActiveDiagramViews } = useVisualizationStore();

    const diagramOptions = useMemo(() => {
        console.log("Construct DOF-Options in DiagramSidebar")
        const displacement: { value: string; label: string }[] = [];
        const velocity: { value: string; label: string }[] = [];
        structuralSystem.nodes.forEach(node => {
            if (!node.restrained_u) {
                displacement.push({ value: `${node.u_dof}-displacement`, label: `N${node.id} - U` });
                velocity.push({ value: `${node.u_dof}-velocity`, label: `N${node.id} - U` });
            }
            if (!node.restrained_v) {
                displacement.push({ value: `${node.v_dof}-displacement`, label: `N${node.id} - V` });
                velocity.push({ value: `${node.v_dof}-velocity`, label: `N${node.id} - V` });
            }
        });
        return [
            { group: 'Displacement', items: displacement },
            { group: 'Velocity', items: velocity },
        ];
    }, [structuralSystem]);

    const [expandedChart, setExpandedChart] = useState<{ dofIdx: number; type: string; label: string } | null>(null);

    const handleRemove = (idToRemove: string) => {
        setActiveDiagramViews(activeDiagramViews.filter(id => id !== idToRemove));
    };

    return (
        <>
            <Modal
                opened={expandedChart !== null}
                onClose={() => setExpandedChart(null)}
                title={expandedChart?.label}
                size="90%"
            >
                {expandedChart && (
                    <Box>
                        <MemoizedChart
                            dofIdx={expandedChart.dofIdx}
                            t1={t1}
                            t2={t2}
                            numPoints={numPoints}
                            solution={solution}
                            label={expandedChart.label}
                            type={expandedChart.type}
                        />
                    </Box>
                )}
            </Modal>
            <Box style={{
                width: "30%",
                height: "100%",
                overflowY: 'auto',
                backgroundColor: '#f8f9fa',
                borderLeft: '1px solid #dee2e6'
            }}>
                <Flex direction="column" gap="md" p="md">

                    <Box p="xs" style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                        <Text size="xs" fw={700} mb="xs" c="dimmed">TIME RANGE & SAMPLING</Text>
                        <SimpleGrid cols={2} spacing="xs">
                            <NumberInput
                                label="Start Time (t1)"
                                size="xs"
                                value={t1}
                                onChange={(val) => setT1(Number(val))}
                                min={0}
                                step={0.5}
                            />
                            <NumberInput
                                label="End Time (t2)"
                                size="xs"
                                value={t2}
                                onChange={(val) => setT2(Number(val))}
                                min={t1}
                                step={0.5}
                            />
                        </SimpleGrid>
                        <NumberInput
                            label="Number of Points (n)"
                            size="xs"
                            mt="xs"
                            value={numPoints}
                            onChange={(val) => setNumPoints(Number(val))}
                            min={2}
                            max={1000}
                        />
                    </Box>

                    <MultiSelect
                        placeholder="Add chart..."
                        data={diagramOptions}
                        value={activeDiagramViews}
                        onChange={setActiveDiagramViews}
                        searchable
                        clearable
                        hidePickedOptions
                    />

                    <Divider my="sm" variant="dotted" />

                    {/* --- Chart List --- */}
                    {activeDiagramViews.map((viewKey) => {
                        const [dofIdxStr, type] = viewKey.split('-');
                        const dofIdx = parseInt(dofIdxStr);
                        const baseLabel = diagramOptions.flatMap(g => g.items).find(opt => opt.value === viewKey)?.label || `DOF ${dofIdx}`;
                        const typeLabel = type === 'velocity' ? 'Velocity' : 'Displacement';
                        const label = `${baseLabel} — ${typeLabel}`;

                        return (
                            <Box key={viewKey} style={{ width: "100%" }}>
                                <Group justify="space-between" mb={5} wrap="nowrap">
                                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                                        {label}
                                    </Text>
                                    <CloseButton
                                        size="sm"
                                        onClick={() => handleRemove(viewKey)}
                                    />
                                </Group>

                                <Box
                                    style={{
                                        height: 220,
                                        width: "100%",
                                        background: 'white',
                                        borderRadius: '4px',
                                        border: '1px solid #eee',
                                        cursor: 'zoom-in',
                                    }}
                                    onClick={() => setExpandedChart({ dofIdx, type, label })}
                                >
                                    <MemoizedChart
                                        dofIdx={dofIdx}
                                        t1={t1}
                                        t2={t2}
                                        numPoints={numPoints}
                                        solution={solution}
                                        label={label}
                                        type={type}
                                    />
                                </Box>
                            </Box>
                        );
                    })}

                    {activeDiagramViews.length === 0 && (
                        <Text size="sm" c="dimmed" ta="center" mt="xl" fs="italic">
                            No diagrams active.
                        </Text>
                    )}
                </Flex>
            </Box>
        </>
    );
});