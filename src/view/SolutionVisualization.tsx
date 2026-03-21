import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Konva from "konva";
import { SystemSolver } from "../solver/SystemSolver";
import { ActionIcon, Box, Checkbox, Divider, Flex, Group, NumberInput, Paper, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconRotateClockwise } from '@tabler/icons-react';
import type { StructuralSystem } from "../solver/StructuralSystem";
import { matrix, zeros } from "mathjs";
import StructuralSystemViewer from "./StructuralSystemViewer";
import { DiagramSidebar } from "./DiagramSidebar";
import { useAnimationStore } from "../store/animationStore";

function TimeDisplay() {
    const time = useAnimationStore(s => s.time);
    return <Text fw={500} size="sm" w={60}>{time.toFixed(2)} s</Text>;
}

export default function SolutionVisualization({ structuralSystem }: { structuralSystem: StructuralSystem }) {
    const [speed, setSpeed] = useState(1);
    const [isRunning, setIsRunning] = useState(false);
    const [showUndeformedSystem, setShowUndeformedSystem] = useState(false);
    const [animKey, setAnimKey] = useState(0);

    const animRef = useRef<Konva.Animation | null>(null);
    const speedRef = useRef(speed);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    const solution = useMemo(() => {
        const solver = new SystemSolver(structuralSystem);
        const N = solver.non_restrained.length;
        const initialConditions = matrix(zeros([2 * N, 1]));
        for (let i = 0; i < N; i++) {
            const dof = solver.non_restrained[i];
            const node = structuralSystem.nodes.find(n => n.u_dof === dof || n.v_dof === dof || n.phi_dof === dof)!;
            let disp = 0, vel = 0;
            if (node.u_dof === dof)        { disp = node.u0;   vel = node.du0; }
            else if (node.v_dof === dof)   { disp = node.v0;   vel = node.dv0; }
            else if (node.phi_dof === dof) { disp = node.phi0; vel = node.dphi0; }
            initialConditions.set([i, 0], disp);
            initialConditions.set([i + N, 0], vel);
        }
        return solver.solve(initialConditions);
    }, [structuralSystem]);

    const getNodePosition = useCallback((nodeId: number, time: number): { x: number; z: number } => {
        const node = getNodeState(nodeId, time);
        return {
            x: node.x + node.u,
            z: node.z + node.v
        };
    }, [structuralSystem, solution]);

    const getNodeState = useCallback((nodeId: number, time: number) => {
        const node = structuralSystem.nodes.find(n => n.id == nodeId)!;
        return {
            x: node.x,
            z: node.z,
            u: solution.get_w(node.u_dof, time),
            v: solution.get_w(node.v_dof, time),
            phi: solution.get_w(node.phi_dof, time)
        };
    }, [structuralSystem, solution]);

    const getElementPositions = useCallback((elementId: number, time: number): Array<{ x: number; z: number }> => {
        const element = structuralSystem.elements.find(e => e.id == elementId)!;

        const ni = getNodeState(element.node_i, time);
        const nj = getNodeState(element.node_j, time);

        const dx = nj.x - ni.x;
        const dz = nj.z - ni.z;
        const L = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const v_local_i = -ni.u * sinA + ni.v * cosA;
        const v_local_j = -nj.u * sinA + nj.v * cosA;
        const phi_i = ni.phi;
        const phi_j = nj.phi;
        const u_local_i = ni.u * cosA + ni.v * sinA;
        const u_local_j = nj.u * cosA + nj.v * sinA;

        const N = 50;
        const points: Array<{ x: number; z: number }> = [];

        for (let step = 0; step <= N; step++) {
            const xi = step / N;
            const local_x_dist = xi * L;

            const n1 = 1 - 3 * xi ** 2 + 2 * xi ** 3;
            const n2 = L * (xi - 2 * xi ** 2 + xi ** 3);
            const n3 = 3 * xi ** 2 - 2 * xi ** 3;
            const n4 = L * (-(xi ** 2) + xi ** 3);

            const local_v = n1 * v_local_i + n2 * phi_i + n3 * v_local_j + n4 * phi_j;
            const local_u = u_local_i * (1 - xi) + u_local_j * xi;
            const finalX = ni.x + (local_x_dist + local_u) * cosA - local_v * sinA;
            const finalZ = ni.z + (local_x_dist + local_u) * sinA + local_v * cosA;
            points.push({ x: finalX, z: finalZ });
        }
        return points;
    }, [structuralSystem, solution, getNodeState]);

    // Create a new animation each time animKey changes (restart resets frame.time)
    useEffect(() => {
        document.body.style.overflow = 'hidden';

        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            useAnimationStore.setState({ time: speedRef.current * frame.time / 1000 });
        });

        animRef.current = anim;

        return () => {
            document.body.style.overflow = '';
            anim.stop();
        };
    }, [animKey]);

    // Start / stop without recreating the animation (preserves timer position)
    useEffect(() => {
        if (!animRef.current) return;
        if (isRunning) animRef.current.start();
        else animRef.current.stop();
    }, [isRunning]);

    const pauseAnimation = () => setIsRunning(false);
    const resumeAnimation = () => setIsRunning(true);
    const restartAnimation = () => {
        useAnimationStore.setState({ time: 0 });
        setIsRunning(false);
        setAnimKey(k => k + 1);
    };

    return (
        <Flex direction="column" style={{ height: 'calc(100vh - var(--app-shell-header-height, 50px))', overflow: 'hidden' }}>
            <Flex style={{ flex: 1, overflow: 'hidden' }}>

                <Box style={{ width: "70%", height: "100%", backgroundColor: "var(--mantine-color-gray-0)" }}>
                    <StructuralSystemViewer
                        structuralSystem={structuralSystem}
                        getNodePosition={getNodePosition}
                        getElementPositions={getElementPositions}
                        showUndeformedSystem={showUndeformedSystem}
                    />
                </Box>

                <DiagramSidebar
                    structuralSystem={structuralSystem}
                    solution={solution}
                />
            </Flex>

            <Paper px="xl" py="xs" shadow="xl" withBorder style={{ zIndex: 100, borderRadius: 0, flexShrink: 0 }}>
                <Group justify="space-between" align="center">

                    <Group gap="xs" align="center">
                        <TimeDisplay />
                        <Divider orientation="vertical" color="gray.3" />
                        <Text size="sm">Speed</Text>
                        <NumberInput
                            value={speed}
                            onChange={(v) => setSpeed(Number(v) || 1)}
                            w={60}
                            size="sm"
                            step={0.1}
                            min={0.1}
                            hideControls
                        />
                    </Group>

                    <Group gap="xs">
                        <ActionIcon
                            onClick={isRunning ? pauseAnimation : resumeAnimation}
                            color={isRunning ? 'orange' : 'green'}
                            variant="light"
                            size="lg"
                            aria-label={isRunning ? "Pause" : "Resume"}
                        >
                            {isRunning ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}
                        </ActionIcon>
                        <ActionIcon
                            onClick={restartAnimation}
                            variant="default"
                            size="lg"
                            aria-label="Restart"
                        >
                            <IconRotateClockwise size={20} />
                        </ActionIcon>
                    </Group>

                    <Group gap="xs" align="center">
                        <Checkbox
                            label="Show Undeformed"
                            checked={showUndeformedSystem}
                            onChange={(e) => setShowUndeformedSystem(e.currentTarget.checked)}
                            size="sm"
                        />
                    </Group>
                </Group>
            </Paper>
        </Flex>
    );
}
