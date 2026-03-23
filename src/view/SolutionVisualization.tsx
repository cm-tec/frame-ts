import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Konva from "konva";
import { SystemSolver } from "../solver/SystemSolver";
import { Box, Flex } from '@mantine/core';
import type { StructuralSystem } from "../solver/StructuralSystem";
import { matrix, zeros } from "mathjs";
import StructuralSystemViewer from "./StructuralSystemViewer";
import { DiagramSidebar } from "./DiagramSidebar";
import { useAnimationStore } from "../store/animationStore";
import { PlaybackBar } from "./PlaybackBar";

export default function SolutionVisualization({ structuralSystem }: { structuralSystem: StructuralSystem }) {
    const [speed, setSpeed] = useState(1);
    const [isRunning, setIsRunning] = useState(false);
    const [showUndeformedSystem, setShowUndeformedSystem] = useState(false);
    const [showNodes, setShowNodes] = useState(true);
    const [showBearings, setShowBearings] = useState(true);
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
            const node = structuralSystem.nodes.find(n => n.u_dof === dof || n.v_dof === dof)!;
            let disp = 0, vel = 0;
            if (node.u_dof === dof) { disp = node.u0; vel = node.du0; }
            else if (node.v_dof === dof) { disp = node.v0; vel = node.dv0; }
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
        };
    }, [structuralSystem, solution]);

    const getElementPositions = useCallback((elementId: number, time: number): Array<{ x: number; z: number }> => {
        const element = structuralSystem.elements.find(e => e.id == elementId)!;

        const points: Array<{ x: number; z: number }> = [
            getNodePosition(element.node_i, time),
            getNodePosition(element.node_j, time)
        ];

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
                        showNodes={showNodes}
                        showBearings={showBearings}
                    />
                </Box>

                <DiagramSidebar
                    structuralSystem={structuralSystem}
                    solution={solution}
                />
            </Flex>

            <PlaybackBar
                speed={speed}
                onSpeedChange={setSpeed}
                isRunning={isRunning}
                onToggle={() => setIsRunning(r => !r)}
                onRestart={restartAnimation}
                showUndeformedSystem={showUndeformedSystem}
                onShowUndeformedChange={setShowUndeformedSystem}
                showNodes={showNodes}
                onShowNodesChange={setShowNodes}
                showBearings={showBearings}
                onShowBearingsChange={setShowBearings}
            />
        </Flex>
    );
}
