import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Konva from "konva";
import { SystemSolver } from "../solver/SystemSolver";
import { Box, Divider, Flex, Slider, Table, Text } from '@mantine/core';
import type { StructuralSystem } from "../solver/StructuralSystem";
import StructuralSystemViewer from "./StructuralSystemViewer";
import { useAnimationStore } from "../store/animationStore";
import { PlaybackBar } from "./PlaybackBar";

export default function KinematicSystemVisualization({ structuralSystem }: { structuralSystem: StructuralSystem }) {
    const [selectedMode, setSelectedMode] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [scale, setScale] = useState(1);
    const [animKey, setAnimKey] = useState(0);
    const [showUndeformedSystem, setShowUndeformedSystem] = useState(true);
    const [showNodes, setShowNodes] = useState(true);
    const [showBearings, setShowBearings] = useState(true);

    const animRef = useRef<Konva.Animation | null>(null);
    const speedRef = useRef(speed);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    const solution = useMemo(() => {
        const solver = new SystemSolver(structuralSystem);
        return solver.solveKinematic();
    }, [structuralSystem]);

    // Auto-scale so max displacement is ~15% of structure extent
    const autoScale = useMemo(() => {
        if (!solution.modes[selectedMode]) return 1;

        const xs = structuralSystem.nodes.map(n => n.x);
        const zs = structuralSystem.nodes.map(n => n.z);
        const extent = Math.max(
            Math.max(...xs) - Math.min(...xs),
            Math.max(...zs) - Math.min(...zs),
            1
        );

        let maxDisp = 0;
        for (let i = 0; i < solution.NDOF; i++) {
            maxDisp = Math.max(maxDisp, Math.abs(solution.modes[selectedMode].get([i])));
        }

        return maxDisp > 0 ? (extent * 0.15) / maxDisp : 1;
    }, [solution, selectedMode, structuralSystem]);

    const getNodePosition = useCallback((nodeId: number, time: number): { x: number; z: number } => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        if (!solution.modes[selectedMode]) return { x: node.x, z: node.z };

        const factor = autoScale * scale * Math.cos(time);
        return {
            x: node.x + solution.get_w(selectedMode, node.u_dof) * factor,
            z: node.z + solution.get_w(selectedMode, node.v_dof) * factor,
        };
    }, [structuralSystem, solution, selectedMode, autoScale, scale]);

    const getElementPositions = useCallback((elementId: number, time: number): Array<{ x: number; z: number }> => {
        const element = structuralSystem.elements.find(e => e.id === elementId)!;
        return [getNodePosition(element.node_i, time), getNodePosition(element.node_j, time)];
    }, [structuralSystem, getNodePosition]);

    useEffect(() => {
        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            useAnimationStore.setState({ time: speedRef.current * frame.time / 1000 });
        });
        animRef.current = anim;
        return () => { anim.stop(); };
    }, [animKey]);

    useEffect(() => {
        if (!animRef.current) return;
        if (isRunning) animRef.current.start();
        else animRef.current.stop();
    }, [isRunning]);

    const restart = useCallback(() => {
        useAnimationStore.setState({ time: 0 });
        setIsRunning(false);
        setAnimKey(k => k + 1);
    }, []);

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
                    />
                </Box>

                <Box style={{ width: "30%", height: "100%", overflowY: 'auto', backgroundColor: '#f8f9fa', borderLeft: '1px solid #dee2e6' }}>
                    <Flex direction="column" gap="md" p="md">
                        <Text size="xs" fw={700} c="dimmed">KINEMATIC MODES</Text>

                        <Table highlightOnHover withTableBorder withColumnBorders fz="xs">
                            <Table.Tbody>
                                {solution.modes.map((_, i) => (
                                    <Table.Tr
                                        key={i}
                                        style={{ cursor: 'pointer', backgroundColor: selectedMode === i ? 'var(--mantine-color-blue-1)' : undefined }}
                                        onClick={() => selectMode(i)}
                                    >
                                        <Table.Td fw={selectedMode === i ? 700 : 400}>Mode {i + 1}</Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>

                        <Divider />

                        <Box>
                            <Text size="xs" fw={700} c="dimmed" mb="xs">AMPLITUDE SCALE ×{scale.toFixed(1)}</Text>
                            <Slider
                                value={scale}
                                onChange={setScale}
                                min={0.1}
                                max={5}
                                step={0.1}
                                label={(v) => `×${v.toFixed(1)}`}
                            />
                        </Box>
                    </Flex>
                </Box>
            </Flex>

            <PlaybackBar
                speed={speed}
                onSpeedChange={setSpeed}
                isRunning={isRunning}
                onToggle={() => setIsRunning(r => !r)}
                onRestart={restart}
                showUndeformedSystem={showUndeformedSystem}
                onShowUndeformedChange={setShowUndeformedSystem}
                showNodes={showNodes}
                onShowNodesChange={setShowNodes}
                showBearings={showBearings}
                onShowBearingsChange={setShowBearings}
                leftExtra={
                    <Text size="sm" fw={500}>
                        Kinematic Mode {selectedMode + 1} of {solution.modes.length}
                    </Text>
                }
            />
        </Flex>
    );
}
