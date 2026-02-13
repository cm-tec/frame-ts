import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Circle, Line } from "react-konva";
import Konva from "konva";
import { SystemSolution, SystemSolver } from "./SystemSolver";
import MatrixLineChart from "./Chart";
import { Button, Group, Paper, TextInput, Box, Text, Flex, rem } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconRotateClockwise } from '@tabler/icons-react';
import type { StructuralSystem } from "./StructuralSystem";
import { matrix, zeros } from "mathjs";
import StructuralSystemViewer from "./view/StructuralSystemViewer";

export default function SolutionVisualization({ structuralSystem }: { structuralSystem: StructuralSystem }) {
    const [speed, setSpeed] = useState(1);
    const [isRunning, setIsRunning] = useState(true);

    const animRef = useRef<Konva.Animation | null>(null);
    const [time, setTime] = useState(0);


    const stageRef = useRef<any>(null);

    const solver = new SystemSolver(structuralSystem);

    let initialConditions = matrix(zeros([2 * solver.non_restrained.length, 1]));
    initialConditions.set([0, 0], -1);
    initialConditions.set([1, 0], 1);

    const solution = solver.solve(initialConditions);

    const getNodePosition = (nodeId: number, time: number): { x: number; z: number } => {
        const node = structuralSystem.nodes.find(n => n.id == nodeId)!;

        return {
            x: node.x + solution.get_w(node.u_dof, time),
            z: node.z + solution.get_w(node.v_dof, time)
        };
    };

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

    const getElementPositions = (elementId: number, time: number): Array<{ x: number; z: number }> => {
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

        return points;
    };



    useEffect(() => {
        const body = document.body;

        body.style.overflow = 'hidden';




        // Create animation
        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            let t = speed * frame.time / 1000;

            runFrame(t)
        }, stageRef.current?.getStage()?.children[0]);

        anim.start();
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
        <Flex direction="column" style={{ height: '100vh', overflow: 'hidden' }}>
            <Flex style={{ flex: 1, overflow: 'hidden' }}>
                {/* 70% Viewer Box */}
                <Box style={{ width: "70%", height: "100%", backgroundColor: "lightblue" }}>
                    <StructuralSystemViewer
                        structuralSystem={structuralSystem}
                        getNodePosition={getNodePosition}
                        getElementPositions={getElementPositions}
                        time={time}
                    />
                </Box>



                <Box style={{
                    width: "30%",
                    height: "100%",
                    overflowY: 'auto',
                    backgroundColor: '#f8f9fa', // Optional: light gray for contrast
                    borderLeft: '1px solid #dee2e6'
                }}>
                    <Flex direction="column" gap="xl" p="md">

                        {/* Diagram 1 */}
                        <Box style={{ width: "100%" }}>
                            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={5}>
                                Displacement U_2
                            </Text>
                            <Box style={{ height: 250, width: "100%" }}>
                                <MatrixLineChart
                                    matrixData={solution.get_w_history(3, 300, 100)}
                                    currentTime={time}

                                />
                            </Box>
                        </Box>

                        {/* Diagram 2 */}
                        <Box style={{ width: "100%" }}>
                            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={5}>
                                Displacement U_3
                            </Text>
                            <Box style={{ height: 250, width: "100%" }}>
                                <MatrixLineChart
                                    matrixData={solution.get_w_history(6, 300, 100)}
                                    currentTime={time}

                                />
                            </Box>
                        </Box>

                    </Flex>
                </Box>
            </Flex>


            <Paper
                p="xs"
                shadow="xl"
                withBorder
                style={{
                    zIndex: 100,
                    borderRadius: 0,
                    flexShrink: 0
                }}
            >
                {/* This outer Group manages the "Space Between" the left and right clusters */}
                <Group justify="space-between">

                    {/* Left Cluster: Time and Speed */}
                    <Group gap="md">
                        <Box w={80}>
                            <Text fw={500}>
                                {time.toFixed(2)} s
                            </Text>
                        </Box>
                        <TextInput
                            label="Speed"
                            type="number"
                            value={speed}
                            onChange={(e) => setSpeed(Number(e.target.value))}
                            style={{ width: 60 }}
                            size="xs"
                            step={0.1}
                            min={0.1}
                        />
                    </Group>

                    {/* Right Cluster: Play/Pause and Restart */}
                    <Group gap="md">
                        <Button
                            onClick={isRunning ? pauseAnimation : resumeAnimation}
                            leftSection={isRunning ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}
                            color={isRunning ? 'orange' : 'green'}
                            variant="light"
                        >
                            {isRunning ? "Pause" : "Resume"}
                        </Button>

                        <Button
                            onClick={restartAnimation}
                            leftSection={<IconRotateClockwise size={20} />}
                            variant="default"
                        >
                            Restart
                        </Button>
                    </Group>
                </Group>
            </Paper>
        </Flex>
    );
}

