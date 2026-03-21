import { Box, Flex, Text, MultiSelect, Group, CloseButton, Divider, NumberInput, SimpleGrid } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useAnimationStore } from '../store/animationStore';
import MatrixLineChart from "./Chart";
import type { StructuralSystem } from '../solver/StructuralSystem';

interface DiagramSidebarProps {
    structuralSystem: StructuralSystem;
    solution: any;
}

const MemoizedChart = ({ dofIdx, t1, t2, numPoints, solution, time, label }: any) => {

    // This heavy calculation NOW only runs when t1, t2, n, or the DOF changes.
    // It NO LONGER runs when 'time' changes.
    const historyData = useMemo(() => {
        console.log(`Recalculating history for DOF ${dofIdx}`);
        return solution.get_w_history(dofIdx, t1, Math.max(1, numPoints), t2 - t1);
    }, [dofIdx, t1, t2, numPoints, solution]);

    return (
        <MatrixLineChart
            matrixData={historyData}
            currentTime={time}
            yAxis={label}
        />
    );
};

export function DiagramSidebar({
    structuralSystem,
    solution,
}: DiagramSidebarProps) {
    const time = useAnimationStore(s => s.time);
    // New states for explicit time range and point count
    const [t1, setT1] = useState<number>(0);
    const [t2, setT2] = useState<number>(10);
    const [numPoints, setNumPoints] = useState<number>(100);

    const dofOptions = useMemo(() => {
        console.log("Construct DOF-Options in DiagramSidebar")
        const options: { value: string; label: string }[] = [];
        structuralSystem.nodes.forEach(node => {
            options.push({ value: node.u_dof.toString(), label: `N${node.id} - U` });
            options.push({ value: node.v_dof.toString(), label: `N${node.id} - V` });
            options.push({ value: node.phi_dof.toString(), label: `N${node.id} - φ` });
        });
        return options;
    }, [structuralSystem]);

    const [activeDofIndices, setActiveDofIndices] = useState<string[]>([]);

    const handleRemove = (idToRemove: string) => {
        setActiveDofIndices(activeDofIndices.filter(id => id !== idToRemove));
    };


    return (
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
                    placeholder="Add displacement chart..."
                    data={dofOptions}
                    value={activeDofIndices}
                    onChange={setActiveDofIndices}
                    searchable
                    clearable
                    hidePickedOptions
                />

                <Divider my="sm" variant="dotted" />

                {/* --- Chart List --- */}
                {activeDofIndices.map((dofIdxStr) => {
                    const dofIdx = parseInt(dofIdxStr);
                    const label = dofOptions.find(opt => opt.value === dofIdxStr)?.label || `DOF ${dofIdx}`;

                    return (
                        <Box key={dofIdxStr} style={{ width: "100%" }}>
                            <Group justify="space-between" mb={5} wrap="nowrap">
                                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                                    {label}
                                </Text>
                                <CloseButton
                                    size="sm"
                                    onClick={() => handleRemove(dofIdxStr)}
                                />
                            </Group>

                            <Box style={{
                                height: 220,
                                width: "100%",
                                background: 'white',
                                borderRadius: '4px',
                                border: '1px solid #eee'
                            }}>
                                <MemoizedChart
                                    dofIdx={dofIdx}
                                    t1={t1}
                                    t2={t2}
                                    numPoints={numPoints}
                                    solution={solution}
                                    time={time}
                                    label={label}
                                />
                            </Box>
                        </Box>
                    );
                })}

                {activeDofIndices.length === 0 && (
                    <Text size="sm" c="dimmed" ta="center" mt="xl" fs="italic">
                        No diagrams active.
                    </Text>
                )}
            </Flex>
        </Box>
    );
}