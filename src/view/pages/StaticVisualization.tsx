import { useState, useMemo, useCallback } from "react";
import { Alert, Box, Checkbox, Divider, Flex, Group, Paper, SegmentedControl, Slider, Text } from "@mantine/core";
import type { StructuralSystem } from "../../solver/StructuralSystem";
import { StructuralLoads } from "../../solver/StructuralLoads";
import { SystemSolver } from "../../solver/SystemSolver";
import type { Loads } from "../../models/inputModels";
import { toSolverAngles } from "../../models/loadConventions";
import StructuralSystemViewer, { type PointForce, type PointMoment } from "../components/StructuralSystemViewer";
import { StaticDiagramSidebar } from "../components/StaticDiagramSidebar";
import { assembleForceVector } from "../../solver/forceAssembly";
import { elementForceField } from "../../solver/internalForces";
import { elementDisplacementField } from "../../solver/displacementField";
import { deformedElementPoints, sampleForces } from "../utils/elementCurves";
import { FORCE_COLOR, LOAD_COLOR, REACTION_COLOR, withOpacity } from "../utils/forceColors";

export default function StaticVisualization({ structuralSystem, loads }: {
    structuralSystem: StructuralSystem;
    loads: Loads;
}) {
    const [showUndeformedSystem, setShowUndeformedSystem] = useState(true);
    const [showNodes, setShowNodes] = useState(true);
    const [showBearings, setShowBearings] = useState(true);
    const [showNodal, setShowNodal] = useState(true);
    const [showElement, setShowElement] = useState(true);
    const [showReactions, setShowReactions] = useState(true);
    const [showReferenceFiber, setShowReferenceFiber] = useState(true);
    const [scale, setScale] = useState(1);
    const [forceMode, setForceMode] = useState<'none' | 'N' | 'Q' | 'M'>('none');
    const [forceScale, setForceScale] = useState(1);
    const [selectedElementId, setSelectedElementId] = useState<number | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

    const handleElementClick = useCallback((id: number) => {
        setSelectedElementId(prev => prev === id ? null : id);
        setSelectedNodeId(null);
    }, []);

    const handleNodeClick = useCallback((id: number) => {
        setSelectedNodeId(prev => prev === id ? null : id);
        setSelectedElementId(null);
    }, []);


    const structuralLoads = useMemo(
        () => new StructuralLoads(structuralSystem, toSolverAngles(loads)),
        [structuralSystem, loads],
    );

    const solution = useMemo(() => {
        const solver = new SystemSolver(structuralSystem);
        return solver.solveStatic(assembleForceVector(structuralSystem, structuralLoads));
    }, [structuralSystem, structuralLoads]);

    const autoForceScale = useMemo(() => {
        if (forceMode === 'none') return 1;
        let maxVal = 0;
        for (const el of structuralSystem.elements) {
            const forces = sampleForces(elementForceField(el, structuralLoads, dof => solution.get_w(dof)));
            for (const f of forces) {
                if (forceMode === 'N') maxVal = Math.max(maxVal, Math.abs(f.N));
                if (forceMode === 'Q') maxVal = Math.max(maxVal, Math.abs(f.V));
                if (forceMode === 'M') maxVal = Math.max(maxVal, Math.abs(f.M));
            }
        }
        return maxVal > 1e-7 ? 30 / maxVal : 1;
    }, [structuralSystem, solution, structuralLoads, forceMode]);

    const internalForcesData = useMemo(() => {
        const elementsData = structuralSystem.elements.map(el => ({
            elementId: el.id,
            points: sampleForces(elementForceField(el, structuralLoads, dof => solution.get_w(dof))),
        }));

        return {
            mode: forceMode,
            scale: autoForceScale * forceScale,
            elements: elementsData
        };
    }, [structuralSystem, solution, structuralLoads, forceMode, autoForceScale, forceScale]);

    const pointForces = useMemo(() => {
        if (!showNodal) return [];
        return loads.nodes.map((load) => ({
            id: `nodal-load-${load.id}`,
            nodeId: load.node_id,
            magnitude: load.magnitude,
            angle: load.angle,
            color: LOAD_COLOR,
        }));
    }, [loads.nodes, showNodal]);

    // One arrow per restrained translation, along the bearing's own axes, so an inclined
    // support reports its reaction parallel and orthogonal to itself rather than in x/z.
    const reactionForces = useMemo(() => {
        if (!showReactions) return [];

        const arrows: PointForce[] = [];

        for (const node of structuralSystem.nodes) {
            const c = Math.cos(node.angle);
            const s = Math.sin(node.angle);

            const components = [
                { active: node.restraint.u, dof: node.dofs[0], name: 'u', wx:  c, wy: s },
                { active: node.restraint.v, dof: node.dofs[1], name: 'v', wx: -s, wy: c },
            ];

            for (const component of components) {
                if (!component.active) continue;

                const value = solution.get_r(component.dof);
                if (Math.abs(value) < 1e-9) continue;

                arrows.push({
                    id: `reaction-${node.id}-${component.name}`,
                    nodeId: node.id,
                    magnitude: value,
                    // The viewer measures arrow angles clockwise from straight down.
                    angle: Math.atan2(component.wx, -component.wy) * 180 / Math.PI,
                    color: REACTION_COLOR,
                    label: Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(2),
                    flipOnNegative: false,
                });
            }
        }
        return arrows;
    }, [structuralSystem, solution, showReactions]);

    const reactionMoments = useMemo(() => {
        if (!showReactions) return [];

        const moments: PointMoment[] = [];

        for (const node of structuralSystem.nodes) {
            if (!node.restraint.theta) continue;

            const value = solution.get_r(node.dofs[2]);
            if (Math.abs(value) < 1e-9) continue;

            moments.push({
                id: `reaction-${node.id}-theta`,
                nodeId: node.id,
                magnitude: value,
                color: REACTION_COLOR,
                label: Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(2),
            });
        }
        return moments;
    }, [structuralSystem, solution, showReactions]);

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
                    color: LOAD_COLOR,
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

                const color = withOpacity(FORCE_COLOR[forceMode === 'Q' ? 'V' : forceMode], 0.7);

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

    const getNodePosition = useCallback((nodeId: number): { x: number; z: number; theta: number } => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        return {
            x: node.x + solution.get_w(node.dofs[0]) * scale,
            z: node.y + solution.get_w(node.dofs[1]) * scale,
            theta: node.angle + solution.get_w(node.dofs[2]) * scale,
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
        const field = elementDisplacementField(element, structuralLoads, dof => solution.get_w(dof));

        return deformedElementPoints(element, field, scale);
    }, [structuralSystem, solution, scale, structuralLoads]);

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
                        showReferenceFiber={showReferenceFiber}
                        pointForces={[...pointForces, ...reactionForces]}
                        pointMoments={reactionMoments}
                        distributedForces={distributedForces}
                        selectedElementId={selectedElementId}
                        selectedNodeId={selectedNodeId}
                        onElementClick={handleElementClick}
                        onNodeClick={handleNodeClick}
                    />
                </Box>

                <StaticDiagramSidebar
                    structuralSystem={structuralSystem}
                    solution={solution}
                    structuralLoads={structuralLoads}
                    selectedElementId={selectedElementId}
                    selectedNodeId={selectedNodeId}
                />
            </Flex>

            <Paper px="xl" py="xs" shadow="xl" withBorder style={{ zIndex: 100, borderRadius: 0, flexShrink: 0 }}>
                <Group justify="space-between" align="center">
                    <Group gap="md" align="center">
                        <Group gap="xs" align="center">
                            <Text size="xs" fw={700}>Deformation Scale</Text>
                            <Slider
                                value={scale} onChange={setScale}
                                min={0} max={5} step={0.1}
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
                                        min={0} max={5} step={0.1}
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
                        <Checkbox label="Reactions"       checked={showReactions}         onChange={(e) => setShowReactions(e.currentTarget.checked)}         size="sm" />
                    </Group>
                </Group>
            </Paper>
        </Flex>
    );
}
