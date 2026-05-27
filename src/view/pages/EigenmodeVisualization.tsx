import { useState, useMemo, useCallback } from "react";
import { SystemSolver } from "../../solver/SystemSolver";
import { Box, Divider, Flex, Slider, Table, Text } from '@mantine/core';
import type { StructuralSystem } from "../../solver/StructuralSystem";
import { matrix, zeros } from "mathjs";
import StructuralSystemViewer from "../components/StructuralSystemViewer";
import { PlaybackBar } from "../components/PlaybackBar";
import { useAnimation } from "../hooks/useAnimation";

export default function EigenmodeVisualization({ structuralSystem }: { structuralSystem: StructuralSystem }) {
    const [selectedMode, setSelectedMode] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [scale, setScale] = useState(1);
    const [showUndeformedSystem, setShowUndeformedSystem] = useState(true);
    const [showNodes, setShowNodes] = useState(true);
    const [showBearings, setShowBearings] = useState(true);

    const { isRunning, setIsRunning, restart } = useAnimation(speed);

    const solution = useMemo(() => {
        const solver = new SystemSolver(structuralSystem);
        const N = solver.non_restrained.length;
        return solver.solveDynamic(matrix(zeros([2 * N, 1])));
    }, [structuralSystem]);

    const modes = useMemo(() => {
        const n = solution.eigenValues.size()[0];
        const result: { stateSpaceIndex: number; omegaN: number; omegaD: number; omegaR: number | null; zeta: number; period: number }[] = [];

        for (let i = 0; i < n; i++) {
            const lambda = solution.eigenValues.get([i, 0]);
            if (lambda.im < 0) continue;

            const sigma = lambda.re;
            const omegaD = lambda.im;
            const omegaN = Math.sqrt(sigma * sigma + omegaD * omegaD);
            const zeta = omegaN > 0 ? -sigma / omegaN : 0;
            const period = omegaD > 0 ? (2 * Math.PI / omegaD) : Infinity;
            const omegaR = zeta < Math.SQRT1_2 ? omegaN * Math.sqrt(1 - 2 * zeta * zeta) : null;
            result.push({ stateSpaceIndex: i, omegaN, omegaD, omegaR, zeta, period });
        }

        result.sort((a, b) => a.omegaN - b.omegaN);
        return result;
    }, [solution]);

    const autoScale = useMemo(() => {
        const mode = modes[selectedMode];
        if (!mode) return 1;

        const xs = structuralSystem.nodes.map(n => n.x);
        const zs = structuralSystem.nodes.map(n => n.z);
        const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 1);

        const tSample = mode.omegaD > 0 ? Math.PI / (2 * mode.omegaD) : 1;
        const disp = solution.get_w_total_of_eigenmode(mode.stateSpaceIndex, tSample);

        let maxDisp = 0;
        for (let i = 0; i < solution.NDOF; i++) {
            maxDisp = Math.max(maxDisp, Math.abs(disp.get([i])));
        }
        return maxDisp > 0 ? (extent * 0.15) / maxDisp : 1;
    }, [solution, modes, selectedMode, structuralSystem]);

    const getNodePosition = useCallback((nodeId: number, time: number): { x: number; z: number } => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        const mode = modes[selectedMode];
        if (!mode) return { x: node.x, z: node.z };

        const disp = solution.get_w_total_of_eigenmode(mode.stateSpaceIndex, time);
        const factor = autoScale * scale;
        const ui = solution.non_restrained.indexOf(node.dofs[0]);
        const vi = solution.non_restrained.indexOf(node.dofs[1]);
        return {
            x: node.x + (ui >= 0 ? disp.get([ui]) * factor : 0),
            z: node.z + (vi >= 0 ? disp.get([vi]) * factor : 0),
        };
    }, [structuralSystem, solution, modes, selectedMode, autoScale, scale]);

    const getElementPositions = useCallback((elementId: number, time: number): Array<{ x: number; z: number }> => {
        const element = structuralSystem.elements.find(e => e.id === elementId)!;
        return [getNodePosition(element.node_i, time), getNodePosition(element.node_j, time)];
    }, [structuralSystem, getNodePosition]);

    const selectMode = useCallback((i: number) => {
        setSelectedMode(i);
        restart();
    }, [restart]);

    return (
        <Flex direction="column" style={{ height: 'calc(100vh - var(--app-shell-header-height, 50px))', overflow: 'hidden' }}>
            <Flex style={{ flex: 1, overflow: 'hidden' }}>
                <Box style={{ width: "70%", height: "100%", backgroundColor: "var(--mantine-color-gray-0)" }}>
                    <StructuralSystemViewer
                        structuralSystem={structuralSystem}
                        getNodePosition={getNodePosition}
                        getElementPositions={getElementPositions}
                        showUndeformedSystem={showUndeformedSystem}
                        showNodes={showNodes}
                        showBearings={showBearings}
                        showHinges={true}
                    />
                </Box>

                <Box style={{ width: "30%", height: "100%", overflowY: 'auto', backgroundColor: '#f8f9fa', borderLeft: '1px solid #dee2e6' }}>
                    <Flex direction="column" gap="md" p="md">
                        <Text size="xs" fw={700} c="dimmed">EIGENMODES</Text>
                        <Table highlightOnHover withTableBorder withColumnBorders fz="xs">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Mode</Table.Th>
                                    <Table.Th>ωₙ (rad/s)</Table.Th>
                                    <Table.Th>ωd (rad/s)</Table.Th>
                                    <Table.Th>ωr (rad/s)</Table.Th>
                                    <Table.Th>ζ</Table.Th>
                                    <Table.Th>T (s)</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {modes.map((mode, i) => (
                                    <Table.Tr
                                        key={i}
                                        style={{ cursor: 'pointer', backgroundColor: selectedMode === i ? 'var(--mantine-color-blue-1)' : undefined }}
                                        onClick={() => selectMode(i)}
                                    >
                                        <Table.Td fw={selectedMode === i ? 700 : 400}>{i + 1}</Table.Td>
                                        <Table.Td>{mode.omegaN.toFixed(3)}</Table.Td>
                                        <Table.Td>{mode.omegaD.toFixed(3)}</Table.Td>
                                        <Table.Td>{mode.omegaR !== null ? mode.omegaR.toFixed(3) : '—'}</Table.Td>
                                        <Table.Td>{mode.zeta.toFixed(3)}</Table.Td>
                                        <Table.Td>{mode.period === Infinity ? '—' : mode.period.toFixed(3)}</Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>

                        <Divider />

                        <Box>
                            <Text size="xs" fw={700} c="dimmed" mb="xs">AMPLITUDE SCALE ×{scale.toFixed(1)}</Text>
                            <Slider value={scale} onChange={setScale} min={0.1} max={5} step={0.1} label={(v) => `×${v.toFixed(1)}`} />
                        </Box>
                    </Flex>
                </Box>
            </Flex>

            <PlaybackBar
                speed={speed} onSpeedChange={setSpeed}
                isRunning={isRunning} onToggle={() => setIsRunning(r => !r)} onRestart={restart}
                showUndeformedSystem={showUndeformedSystem} onShowUndeformedChange={setShowUndeformedSystem}
                showNodes={showNodes} onShowNodesChange={setShowNodes}
                showBearings={showBearings} onShowBearingsChange={setShowBearings}
                leftExtra={modes[selectedMode] && <Text size="sm" fw={500}>Mode {selectedMode + 1}</Text>}
            />
        </Flex>
    );
}
