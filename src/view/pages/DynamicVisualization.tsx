import { useEffect, useMemo, useCallback } from "react";
import { SystemSolver } from "../../solver/SystemSolver";
import { Box, Flex } from '@mantine/core';
import type { StructuralSystem } from "../../solver/StructuralSystem";
import { matrix, zeros } from "mathjs";
import StructuralSystemViewer from "../components/StructuralSystemViewer";
import { DiagramSidebar } from "../components/DiagramSidebar";
import { useVisualizationStore } from "../../store/visualizationStore";
import { PlaybackBar } from "../components/PlaybackBar";
import type { InitialConditions, Loads } from "../../models/models";
import { useAnimation } from "../hooks/useAnimation";
import { deformedElementPoints } from "../utils/deformedShape";

export default function DynamicVisualization({ structuralSystem, initialConditions, loads: _loads }: {
    structuralSystem: StructuralSystem;
    initialConditions: InitialConditions;
    loads: Loads;
}) {
    const { speed, setSpeed, showUndeformedSystem, setShowUndeformedSystem, showNodes, setShowNodes, showBearings, setShowBearings, syncDofKey } = useVisualizationStore();
    const { isRunning, setIsRunning, restart } = useAnimation(speed);

    useEffect(() => {
        const key = structuralSystem.nodes
            .flatMap(n => [n.restraint.u ? null : n.dofs[0], n.restraint.v ? null : n.dofs[1]])
            .filter(v => v !== null)
            .join(',');
        syncDofKey(key);
    }, [structuralSystem]);

    const solution = useMemo(() => {
        const solver = new SystemSolver(structuralSystem);
        const N = solver.non_restrained.length;
        const ic = matrix(zeros([2 * N, 1]));
        for (let i = 0; i < N; i++) {
            const dof = solver.non_restrained[i];
            const node = structuralSystem.nodes.find(n => n.dofs.includes(dof));
            if (!node) continue;
            const nodeIc = initialConditions[node.id];
            if (!nodeIc) continue;
            let disp = 0, vel = 0;
            if      (node.dofs[0] === dof) { disp = nodeIc.u0;     vel = nodeIc.du0; }
            else if (node.dofs[1] === dof) { disp = nodeIc.v0;     vel = nodeIc.dv0; }
            else if (node.dofs[2] === dof) { disp = nodeIc.theta0; vel = nodeIc.dtheta0; }
            ic.set([i, 0], disp);
            ic.set([i + N, 0], vel);
        }
        return solver.solveDynamic(ic);
    }, [structuralSystem, initialConditions]);

    const getNodeState = useCallback((nodeId: number, time: number) => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        return { x: node.x, z: node.z, u: solution.get_w(node.dofs[0], time), v: solution.get_w(node.dofs[1], time) };
    }, [structuralSystem, solution]);

    const getNodePosition = useCallback((nodeId: number, time: number): { x: number; z: number } => {
        const { x, z, u, v } = getNodeState(nodeId, time);
        return { x: x + u, z: z + v };
    }, [getNodeState]);

    const getNodeRotation = useCallback((nodeId: number, time: number): number => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        return solution.get_w(node.dofs[2], time);
    }, [structuralSystem, solution]);

    const getElementPositions = useCallback((elementId: number, time: number): Array<{ x: number; z: number }> => {
        const element = structuralSystem.elements.find(e => e.id === elementId)!;
        const ni = structuralSystem.nodes.find(n => n.id === element.node_i)!;
        const nj = structuralSystem.nodes.find(n => n.id === element.node_j)!;
        return deformedElementPoints(
            element, ni, nj,
            (dof) => solution.get_w(dof, time),
            1,
        );
    }, [structuralSystem, solution]);

    return (
        <Flex direction="column" style={{ height: 'calc(100vh - var(--app-shell-header-height, 50px))', overflow: 'hidden' }}>
            <Flex style={{ flex: 1, overflow: 'hidden' }}>
                <Box style={{ width: "70%", height: "100%", backgroundColor: "var(--mantine-color-gray-0)" }}>
                    <StructuralSystemViewer
                        structuralSystem={structuralSystem}
                        getNodePosition={getNodePosition}
                        getElementPositions={getElementPositions}
                        getNodeRotation={getNodeRotation}
                        showUndeformedSystem={showUndeformedSystem}
                        showNodes={showNodes}
                        showBearings={showBearings}
                        showHinges={true}
                    />
                </Box>
                <DiagramSidebar structuralSystem={structuralSystem} solution={solution} />
            </Flex>
            <PlaybackBar
                speed={speed} onSpeedChange={setSpeed}
                isRunning={isRunning} onToggle={() => setIsRunning(r => !r)} onRestart={restart}
                showUndeformedSystem={showUndeformedSystem} onShowUndeformedChange={setShowUndeformedSystem}
                showNodes={showNodes} onShowNodesChange={setShowNodes}
                showBearings={showBearings} onShowBearingsChange={setShowBearings}
            />
        </Flex>
    );
}
