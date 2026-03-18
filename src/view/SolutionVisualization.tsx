import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Konva from "konva";
import { SystemSolver } from "../solver/SystemSolver";
import { ActionIcon, Box, Checkbox, Divider, Flex, Group, NumberInput, Paper, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconRotateClockwise } from '@tabler/icons-react';
import type { StructuralSystem } from "../solver/StructuralSystem";
import { matrix, zeros } from "mathjs";
import StructuralSystemViewer from "./StructuralSystemViewer";
import { DiagramSidebar } from "./DiagramSidebar";

export default function SolutionVisualization({ structuralSystem }: { structuralSystem: StructuralSystem }) {
    const [speed, setSpeed] = useState(1);
    const [isRunning, setIsRunning] = useState(false);

    const [showUndeformedSystem, setShowUndeformedSystem] = useState(false);

    const animRef = useRef<Konva.Animation | null>(null);
    const [time, setTime] = useState(0);


    const stageRef = useRef<any>(null);



    const solution = useMemo(() => {
        console.log("Solve StructuralSystem");
        const solver = new SystemSolver(structuralSystem);
        let initialConditions = matrix(zeros([2 * solver.non_restrained.length, 1]));
        initialConditions.set([0, 0], 0);
        initialConditions.set([1, 0], 0.2);


        return solver.solve(initialConditions);
    }, [structuralSystem]);

    const getNodePosition = useCallback((nodeId: number, time: number): { x: number; z: number } => {
        const node = structuralSystem.nodes.find(n => n.id == nodeId)!;

        return {
            x: node.x + solution.get_w(node.u_dof, time),
            z: node.z + solution.get_w(node.v_dof, time)
        };
    }, [structuralSystem, solution]);

    const getNodeState = (nodeId: number, time: number) => {
        const node = structuralSystem.nodes.find(n => n.id == nodeId)!;
        return {
            x: node.x,
            z: node.z,
            u: solution.get_w(node.u_dof, time),
            v: solution.get_w(node.v_dof, time),
            phi: solution.get_w(node.phi_dof, time)
        };
    };

    const getElementPositions = useCallback((elementId: number, time: number): Array<{ x: number; z: number }> => {
        const element = structuralSystem.elements.find(e => e.id == elementId)!;

        // 1. Get full state (pos + displacement) for both nodes
        const ni = getNodeState(element.node_i, time);
        const nj = getNodeState(element.node_j, time);


        // 2. Geometry basics
        const dx = nj.x - ni.x;
        const dz = nj.z - ni.z;
        const L = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);

        // 3. Project global displacements into local element coordinates
        // Local u is axial, Local v is transverse
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Local transverse displacements (v) and rotations (phi)
        const v_local_i = -ni.u * sinA + ni.v * cosA;
        const v_local_j = -nj.u * sinA + nj.v * cosA;
        const phi_i = ni.phi;
        const phi_j = nj.phi;

        // Local axial displacements (u)
        const u_local_i = ni.u * cosA + ni.v * sinA;
        const u_local_j = nj.u * cosA + nj.v * sinA;

        const N = 50; // 50 points is usually plenty for a smooth curve
        const points: Array<{ x: number; z: number }> = [];

        for (let step = 0; step <= N; step++) {
            const xi = step / N; // normalized distance 0 to 1
            const local_x_dist = xi * L;

            // Hermite Shape Functions
            const n1 = 1 - 3 * xi ** 2 + 2 * xi ** 3;
            const n2 = L * (xi - 2 * xi ** 2 + xi ** 3);
            const n3 = 3 * xi ** 2 - 2 * xi ** 3;
            const n4 = L * (- (xi ** 2) + xi ** 3);

            // Interpolate local displacements
            const local_v = n1 * v_local_i + n2 * phi_i + n3 * v_local_j + n4 * phi_j;
            const local_u = u_local_i * (1 - xi) + u_local_j * xi;

            // 4. Transform back to Global X, Z
            // Start at node_i, add axial component along beam, add transverse component perpendicular
            const finalX = ni.x + (local_x_dist + local_u) * cosA - local_v * sinA;
            const finalZ = ni.z + (local_x_dist + local_u) * sinA + local_v * cosA;

            points.push({ x: finalX, z: finalZ });
        }
        console.log(points);
        return points;
    }, [structuralSystem, solution, getNodeState]);



    useEffect(() => {
        const body = document.body;
        body.style.overflow = 'hidden';

        console.log("Use effect inside SolutionVisualization")
        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            let t = speed * frame.time / 1000;

            runFrame(t)
        }, stageRef.current?.getStage()?.children[0]);

        if (isRunning) {
            anim.start();
        }

        animRef.current = anim;

        return () => {
            body.style.overflow = '';
            anim.stop();
        };
    }, []);


    // Pause animation
    const pauseAnimation = () => {
        animRef.current?.stop();
        setIsRunning(false);
    };

    // Resume animation
    const resumeAnimation = () => {
        animRef.current?.start();
        setIsRunning(true);
    };

    const runFrame = (t: number) => {
        setTime(t);
    };

    // Restart animation
    const restartAnimation = () => {
        animRef.current?.stop();

        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            let t = speed * frame.time / 1000;

            runFrame(t)
        }, stageRef.current?.getStage()?.children[0]);

        animRef.current = anim;


        if (isRunning) {
            animRef.current?.start();
        } else {
            runFrame(0);
        }

    };

    return (
        // 1. Make the outer container a full-height column
        <Flex direction="column" style={{ height: 'calc(100vh - var(--app-shell-header-height, 50px))', overflow: 'hidden' }}>
            <Flex style={{ flex: 1, overflow: 'hidden' }}>

                <Box style={{ width: "70%", height: "100%", backgroundColor: "var(--mantine-color-gray-0)" }}>
                    <StructuralSystemViewer
                        structuralSystem={structuralSystem}
                        getNodePosition={getNodePosition}
                        getElementPositions={getElementPositions}
                        time={time}
                        showUndeformedSystem={showUndeformedSystem}
                    />
                </Box>

                <DiagramSidebar
                    structuralSystem={structuralSystem}
                    solution={solution}
                    time={time}
                />
            </Flex>


            <Paper
                px="xl"
                py="xs"
                shadow="xl"
                withBorder
                style={{
                    zIndex: 100,
                    borderRadius: 0,
                    flexShrink: 0
                }}
            >
                <Group justify="space-between" align="center">

                    {/* Left: time + speed */}
                    <Group gap="xs" align="center">
                        <Text fw={500} size="sm" w={50}>{time.toFixed(2)} s</Text>
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

                    {/* Center: transport controls */}
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

                    {/* Right: options */}
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

