import { useState, useMemo, useCallback } from "react";
import { index, subset } from "mathjs";
import { Alert, Box, Checkbox, Divider, Flex, Group, Paper, SegmentedControl, Slider, Text } from "@mantine/core";
import type { StructuralSystem } from "../../solver/StructuralSystem";
import { SystemSolver } from "../../solver/SystemSolver";
import type { Loads } from "../../models/models";
import StructuralSystemViewer from "../components/StructuralSystemViewer";
import { StaticDiagramSidebar } from "../components/StaticDiagramSidebar";
import { deformedElementPoints } from "../utils/deformedShape";
import { assembleForceVector } from "../../solver/forceAssembly";
import { elementInternalForces } from "../utils/internalForces";

export default function StaticVisualization({ structuralSystem, loads }: {
    structuralSystem: StructuralSystem;
    loads: Loads;
}) {
    const [showUndeformedSystem, setShowUndeformedSystem] = useState(true);
    const [showNodes, setShowNodes] = useState(true);
    const [showBearings, setShowBearings] = useState(true);
    const [showNodal, setShowNodal] = useState(true);
    const [showElement, setShowElement] = useState(true);
    const [showReferenceFiber, setShowReferenceFiber] = useState(true);
    const [scale, setScale] = useState(1);
    const [forceMode, setForceMode] = useState<'none' | 'N' | 'Q' | 'M'>('none');
    const [forceScale, setForceScale] = useState(1);

    const solution = useMemo(() => {
        const solver = new SystemSolver(structuralSystem);
        const F_global = assembleForceVector(structuralSystem, loads);
        return solver.solveStatic(subset(F_global, index(solver.non_restrained, [0])));
    }, [structuralSystem, loads]);

    const autoForceScale = useMemo(() => {
        if (forceMode === 'none') return 1;
        let maxVal = 0;
        for (const el of structuralSystem.elements) {
            const ni = structuralSystem.nodes.find(n => n.id === el.node_i)!;
            const nj = structuralSystem.nodes.find(n => n.id === el.node_j)!;
            const load = loads.elements.find(l => l.element_id === el.id);
            const forces = elementInternalForces(
                el, ni, nj,
                (dof) => solution.get_w(dof),
                load ? { qi: load.q_i, qj: load.q_j } : undefined,
            );
            for (const f of forces) {
                if (forceMode === 'N') maxVal = Math.max(maxVal, Math.abs(f.N));
                if (forceMode === 'Q') maxVal = Math.max(maxVal, Math.abs(f.V));
                if (forceMode === 'M') maxVal = Math.max(maxVal, Math.abs(f.M));
            }
        }
        return maxVal > 0 ? 30 / maxVal : 1;
    }, [structuralSystem, solution, loads, forceMode]);

    const internalForcesData = useMemo(() => {
        const elementsData = structuralSystem.elements.map(el => {
            const ni = structuralSystem.nodes.find(n => n.id === el.node_i)!;
            const nj = structuralSystem.nodes.find(n => n.id === el.node_j)!;
            const load = loads.elements.find(l => l.element_id === el.id);
            const points = elementInternalForces(
                el, ni, nj,
                (dof) => solution.get_w(dof),
                load ? { qi: load.q_i, qj: load.q_j } : undefined,
            );
            return { elementId: el.id, points };
        });

        return {
            mode: forceMode,
            scale: autoForceScale * forceScale,
            elements: elementsData
        };
    }, [structuralSystem, solution, loads, forceMode, autoForceScale, forceScale]);

    const pointForces = useMemo(() => {
        if (!showNodal) return [];
        return loads.nodes.map((load) => ({
            id: `nodal-load-${load.id}`,
            nodeId: load.node_id,
            magnitude: load.magnitude,
            angle: load.angle,
            color: 'rgba(239, 68, 68, 0.8)',
        }));
    }, [loads.nodes, showNodal]);

    const distributedForces = useMemo(() => {
        const list: Array<any> = [];

        if (showElement) {
            loads.elements.forEach((load) => {
                list.push({
                    id: `element-load-${load.id}`,
                    elementId: load.element_id,
                    distribution: [
                        { xi: 0, value: load.q_i },
                        { xi: 1, value: load.q_j }
                    ],
                    angle: load.angle,
                    color: 'rgba(239, 68, 68, 0.8)',
                    renderStyle: 'arrows',
                });
            });
        }

        if (forceMode !== 'none') {
            const scaleFactor = autoForceScale * forceScale;
            const plotScale = forceMode === 'M' ? -scaleFactor : scaleFactor;

            internalForcesData.elements.forEach((elData) => {
                const distribution = elData.points.map((p) => {
                    let value = 0;
                    if (forceMode === 'N') value = p.N;
                    else if (forceMode === 'Q') value = p.V;
                    else if (forceMode === 'M') value = p.M;
                    return { xi: p.xi, value };
                });

                let color: string | { positive: string; negative: string } = 'rgba(16, 185, 129, 0.7)';
                if (forceMode === 'N') {
                    color = {
                        positive: 'rgba(59, 130, 246, 0.7)',
                        negative: 'rgba(239, 68, 68, 0.7)',
                    };
                } else if (forceMode === 'Q') {
                    color = 'rgba(139, 92, 246, 0.7)';
                } else if (forceMode === 'M') {
                    color = 'rgba(16, 185, 129, 0.7)';
                }

                list.push({
                    id: `internal-${forceMode}-${elData.elementId}`,
                    elementId: elData.elementId,
                    distribution,
                    angle: 0,
                    color,
                    scale: plotScale,
                    renderStyle: 'diagram',
                    showLabels: true,
                });
            });
        }

        return list;
    }, [loads.elements, showElement, forceMode, internalForcesData, autoForceScale, forceScale]);

    const getNodePosition = useCallback((nodeId: number): { x: number; z: number } => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        return {
            x: node.x + solution.get_w(node.dofs[0]) * scale,
            z: node.z + solution.get_w(node.dofs[1]) * scale,
        };
    }, [structuralSystem, solution, scale]);

    const getNodeRotation = useCallback((nodeId: number): number => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        return solution.get_w(node.dofs[2]) * scale;
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
            load ? { qi: load.q_i, qj: load.q_j, angle: load.angle } : undefined,
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
                        getNodeRotation={getNodeRotation}
                        showUndeformedSystem={showUndeformedSystem}
                        showNodes={showNodes}
                        showBearings={showBearings}
                        showHinges={true}
                        showReferenceFiber={showReferenceFiber}
                        pointForces={pointForces}
                        distributedForces={distributedForces}
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
                    <Group gap="md" align="center">
                        <Group gap="xs" align="center">
                            <Text size="xs" fw={700}>Deformation Scale</Text>
                            <Slider
                                value={scale} onChange={setScale}
                                min={0.1} max={5} step={0.1}
                                label={(v) => `×${v.toFixed(1)}`}
                                style={{ width: 80 }}
                            />
                            <Text size="xs" w={28}>×{scale.toFixed(1)}</Text>
                        </Group>

                        <Divider orientation="vertical" color="gray.3" />

                        <Group gap="xs" align="center">
                            <Text size="xs" fw={700}>Internal Forces</Text>
                            <SegmentedControl
                                value={forceMode}
                                onChange={(v) => setForceMode(v as any)}
                                data={[
                                    { label: 'None', value: 'none' },
                                    { label: 'N (Axial)', value: 'N' },
                                    { label: 'Q (Shear)', value: 'Q' },
                                    { label: 'M (Moment)', value: 'M' },
                                ]}
                                size="xs"
                            />
                            {forceMode !== 'none' && (
                                <>
                                    <Text size="xs" fw={700} ml="xs">Diagram Scale</Text>
                                    <Slider
                                        value={forceScale} onChange={setForceScale}
                                        min={0.1} max={5} step={0.1}
                                        label={(v) => `×${v.toFixed(1)}`}
                                        style={{ width: 80 }}
                                    />
                                    <Text size="xs" w={28}>×{forceScale.toFixed(1)}</Text>
                                </>
                            )}
                        </Group>
                    </Group>
                    <Group gap="xs" align="center">
                        <Checkbox label="Show Undeformed" checked={showUndeformedSystem} onChange={(e) => setShowUndeformedSystem(e.currentTarget.checked)} size="sm" />
                        <Checkbox label="Show Nodes"      checked={showNodes}             onChange={(e) => setShowNodes(e.currentTarget.checked)}             size="sm" />
                        <Checkbox label="Show Bearings"   checked={showBearings}          onChange={(e) => setShowBearings(e.currentTarget.checked)}          size="sm" />
                        <Checkbox label="Orientation"     checked={showReferenceFiber}    onChange={(e) => setShowReferenceFiber(e.currentTarget.checked)}    size="sm" />
                        <Checkbox label="Nodal Loads"     checked={showNodal}             onChange={(e) => setShowNodal(e.currentTarget.checked)}             size="sm" />
                        <Checkbox label="Element Loads"   checked={showElement}           onChange={(e) => setShowElement(e.currentTarget.checked)}           size="sm" />
                    </Group>
                </Group>
            </Paper>
        </Flex>
    );
}
