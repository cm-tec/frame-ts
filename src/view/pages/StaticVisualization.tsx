import { useState, useMemo, useCallback } from "react";
import { index, subset } from "mathjs";
import { Alert, Box, Checkbox, Flex, Group, Paper, Slider, Text } from "@mantine/core";
import type { StructuralSystem } from "../../solver/StructuralSystem";
import { SystemSolver } from "../../solver/SystemSolver";
import type { Loads } from "../../models/models";
import StructuralSystemViewer from "../components/StructuralSystemViewer";
import { StaticDiagramSidebar } from "../components/StaticDiagramSidebar";
import { deformedElementPoints } from "../utils/deformedShape";
import { assembleForceVector } from "../../solver/forceAssembly";

export default function StaticVisualization({ structuralSystem, loads }: {
    structuralSystem: StructuralSystem;
    loads: Loads;
}) {
    const [showUndeformedSystem, setShowUndeformedSystem] = useState(true);
    const [showNodes, setShowNodes] = useState(true);
    const [showBearings, setShowBearings] = useState(true);
    const [showNodal, setShowNodal] = useState(true);
    const [showElement, setShowElement] = useState(true);
    const [scale, setScale] = useState(1);

    const solution = useMemo(() => {
        const solver = new SystemSolver(structuralSystem);
        const F_global = assembleForceVector(structuralSystem, loads);
        return solver.solveStatic(subset(F_global, index(solver.non_restrained, [0])));
    }, [structuralSystem, loads]);

    const getNodePosition = useCallback((nodeId: number): { x: number; z: number } => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        return {
            x: node.x + solution.get_w(node.dofs[0]) * scale,
            z: node.z + solution.get_w(node.dofs[1]) * scale,
        };
    }, [structuralSystem, solution, scale]);

    const bendingWarnings = useMemo(() =>
        loads.elements.filter(l => {
            const el = structuralSystem.elements.find(e => e.id === l.element_id);
            return el && el.ei === 0 && (l.q_i !== 0 || l.q_j !== 0);
        }).map(l => l.element_id),
    [structuralSystem, loads]);

    const getElementPositions = useCallback((elementId: number): Array<{ x: number; z: number }> => {
        const element = structuralSystem.elements.find(e => e.id === elementId)!;
        const ni = structuralSystem.nodes.find(n => n.id === element.node_i)!;
        const nj = structuralSystem.nodes.find(n => n.id === element.node_j)!;
        const load = loads.elements.find(l => l.element_id === elementId);
        return deformedElementPoints(
            element, ni, nj,
            (dof) => solution.get_w(dof),
            scale,
            load ? { qi: load.q_i, qj: load.q_j } : undefined,
        );
    }, [structuralSystem, solution, scale, loads]);

    return (
        <Flex direction="column" style={{ height: 'calc(100vh - var(--app-shell-header-height, 50px))', overflow: 'hidden' }}>
            <Flex style={{ flex: 1, overflow: 'hidden' }}>
                <Box style={{ width: '70%', height: '100%', backgroundColor: 'var(--mantine-color-gray-0)' }}>
                    {bendingWarnings.length > 0 && (
                        <Alert color="orange" title="No bending stiffness" variant="light" style={{ margin: 8 }}>
                            <Text size="xs">
                                Element{bendingWarnings.length > 1 ? 's' : ''} {bendingWarnings.join(', ')} {bendingWarnings.length > 1 ? 'have' : 'has'} EI = 0 but {bendingWarnings.length > 1 ? 'carry' : 'carries'} a distributed load with an orthogonal component.
                            </Text>
                        </Alert>
                    )}
                    <StructuralSystemViewer
                        structuralSystem={structuralSystem}
                        getNodePosition={getNodePosition}
                        getElementPositions={getElementPositions}
                        showUndeformedSystem={showUndeformedSystem}
                        showNodes={showNodes}
                        showBearings={showBearings}
                        showHinges={true}
                        loadVisualization={{ loads, scale: 1, showNodal, showElement }}
                    />
                </Box>

                <StaticDiagramSidebar
                    structuralSystem={structuralSystem}
                    solution={solution}
                    loads={loads}
                />
            </Flex>

            <Paper px="xl" py="xs" shadow="xl" withBorder style={{ zIndex: 100, borderRadius: 0, flexShrink: 0 }}>
                <Group justify="space-between" align="center">
                    <Group gap="xs" align="center">
                        <Text size="sm">Scale</Text>
                        <Slider
                            value={scale} onChange={setScale}
                            min={0.1} max={5} step={0.1}
                            label={(v) => `×${v.toFixed(1)}`}
                            style={{ width: 120 }}
                        />
                        <Text size="sm" w={36}>×{scale.toFixed(1)}</Text>
                    </Group>
                    <Group gap="xs" align="center">
                        <Checkbox label="Show Undeformed" checked={showUndeformedSystem} onChange={(e) => setShowUndeformedSystem(e.currentTarget.checked)} size="sm" />
                        <Checkbox label="Show Nodes"      checked={showNodes}             onChange={(e) => setShowNodes(e.currentTarget.checked)}             size="sm" />
                        <Checkbox label="Show Bearings"   checked={showBearings}          onChange={(e) => setShowBearings(e.currentTarget.checked)}          size="sm" />
                        <Checkbox label="Nodal Loads"     checked={showNodal}             onChange={(e) => setShowNodal(e.currentTarget.checked)}             size="sm" />
                        <Checkbox label="Element Loads"   checked={showElement}           onChange={(e) => setShowElement(e.currentTarget.checked)}           size="sm" />
                    </Group>
                </Group>
            </Paper>
        </Flex>
    );
}
