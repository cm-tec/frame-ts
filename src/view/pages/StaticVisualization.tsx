import { useState, useMemo, useCallback } from "react";
import { index, Matrix, matrix, subset, zeros } from "mathjs";
import { Alert, Box, Checkbox, Divider, Flex, Group, Paper, Slider, Text } from "@mantine/core";
import type { StructuralSystem } from "../../solver/StructuralSystem";
import { SystemSolver } from "../../solver/SystemSolver";
import type { Loads } from "../../models/models";
import StructuralSystemViewer from "../components/StructuralSystemViewer";
import { deformedElementPoints } from "../utils/deformedShape";

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
        
        // 1. Initialize a full-sized global load vector (Size: total system ndof)
        const F_global = matrix(zeros([structuralSystem.ndof, 1]));

            // =====================================================================
            // PART A: NODAL LOADS ASSEMBLY
            // =====================================================================
            loads.nodes.forEach(load => {
            const node = structuralSystem.nodes.find(n => n.id === load.node_id);
            if (!node) return;

            const rad = (load.angle * Math.PI) / 180;
            
            // Aligns perfectly with the canvas layer:
            const fx = load.magnitude * Math.sin(rad);   // 0° -> 0,       90° -> Positive Right (+X)
            const fz = -load.magnitude * Math.cos(rad);  // 0° -> Negative Down (-Z), 180° -> Positive Up (+Z)

            const dofX = node.dofs[0]; // Global X (u)
            const dofZ = node.dofs[1]; // Global Z (v)
            
            F_global.set([dofX, 0], F_global.get([dofX, 0]) + fx);
            F_global.set([dofZ, 0], F_global.get([dofZ, 0]) + fz);
        });


        // =====================================================================
        // PART B: ELEMENT LOADS ASSEMBLY (Equivalent Nodal Forces)
        // =====================================================================
        loads.elements.forEach(load => {
            const el = structuralSystem.elements.find(e => e.id === load.element_id);
            if (!el) return;

            const ni = structuralSystem.nodes.find(n => n.id === el.node_i)!;
            const nj = structuralSystem.nodes.find(n => n.id === el.node_j)!;

            const dx = nj.x - ni.x;
            const dz = nj.z - ni.z;
            const L = Math.hypot(dx, dz);
            if (L < 1e-6) return;

            const cosB = dx / L;
            const sinB = dz / L;

            // Compute local Fixed-End Reactions (perpendicular trapezoidal load)
            const qi = load.q_i;
            const qj = load.q_j;

            const vi = (L / 20) * (7 * qi + 3 * qj);
            const mi = (L * L / 60) * (3 * qi + 2 * qj);
            const vj = (L / 20) * (3 * qi + 7 * qj);
            const mj = -(L * L / 60) * (2 * qi + 3 * qj);

            // Transform local reactions into Global Equivalent Node Actions (Action = -Reaction)
            const g_fx_i = -(-vi * sinB);
            const g_fz_i = -(vi * cosB);
            const g_m_i  = -mi;

            const g_fx_j = -(-vj * sinB);
            const g_fz_j = -(vj * cosB);
            const g_m_j  = -mj;

            // Element DOFs array: [node_i_u, node_i_v, node_i_theta, node_j_u, node_j_v, node_j_theta]
            const globalForces = [g_fx_i, g_fz_i, g_m_i, g_fx_j, g_fz_j, g_m_j];

            // Accumulate directly into F_global using the element's explicit DOFs array mapping
            el.dofs.forEach((globalDof, localIdx) => {
                F_global.set([globalDof, 0], F_global.get([globalDof, 0]) + globalForces[localIdx]);
            });
        });

        // =====================================================================
        // PART C: EXTRACTION & SOLVE
        // =====================================================================
        // Extract only the rows belonging to non-restrained DOFs, matching k_11 slicing exactly
        const f_non_restrained = subset(F_global, index(solver.non_restrained, [0]));
        console.log(f_non_restrained);
        // Pass the sliced matrix into your static solver
        return solver.solveStatic(f_non_restrained);

    }, [structuralSystem, loads]);

    const getNodePosition = useCallback((nodeId: number, _time: number): { x: number; z: number } => {
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

    const getElementPositions = useCallback((elementId: number, _time: number): Array<{ x: number; z: number }> => {
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
                <Box style={{ width: "70%", height: "100%", backgroundColor: "var(--mantine-color-gray-0)" }}>
                    <StructuralSystemViewer
                        structuralSystem={structuralSystem}
                        getNodePosition={getNodePosition}
                        getElementPositions={getElementPositions}
                        showUndeformedSystem={showUndeformedSystem}
                        showNodes={showNodes}
                        showBearings={showBearings}
                        loadVisualization={{ loads, scale: 1, showNodal, showElement }}
                    />
                </Box>

                <Box style={{ width: "30%", height: "100%", overflowY: 'auto', backgroundColor: '#f8f9fa', borderLeft: '1px solid #dee2e6' }}>
                    <Flex direction="column" gap="md" p="md">
                        {bendingWarnings.length > 0 && (
                            <Alert color="orange" title="No bending stiffness" variant="light">
                                <Text size="xs">
                                    Element{bendingWarnings.length > 1 ? 's' : ''} {bendingWarnings.join(', ')} {bendingWarnings.length > 1 ? 'have' : 'has'} EI = 0 but {bendingWarnings.length > 1 ? 'carry' : 'carries'} a distributed load with an orthogonal component. The deflection curve cannot be computed — a straight line is shown instead.
                                </Text>
                            </Alert>
                        )}

                        <Text size="xs" fw={700} c="dimmed">INTERNAL FORCES</Text>
                        <Text size="xs" c="dimmed">Coming soon</Text>

                        <Divider />

                        <Text size="xs" fw={700} c="dimmed">DISPLACEMENTS</Text>
                        <Text size="xs" c="dimmed">Coming soon</Text>

                        <Divider />

                        <Box>
                            <Text size="xs" fw={700} c="dimmed" mb="xs">DEFORMATION SCALE ×{scale.toFixed(1)}</Text>
                            <Slider value={scale} onChange={setScale} min={0.1} max={5} step={0.1} label={(v) => `×${v.toFixed(1)}`} />
                        </Box>
                    </Flex>
                </Box>
            </Flex>

            <Paper px="xl" py="xs" shadow="xl" withBorder style={{ zIndex: 100, borderRadius: 0, flexShrink: 0 }}>
                <Group gap="xs" align="center">
                    <Checkbox label="Show Undeformed" checked={showUndeformedSystem} onChange={(e) => setShowUndeformedSystem(e.currentTarget.checked)} size="sm" />
                    <Checkbox label="Show Nodes" checked={showNodes} onChange={(e) => setShowNodes(e.currentTarget.checked)} size="sm" />
                    <Checkbox label="Show Bearings" checked={showBearings} onChange={(e) => setShowBearings(e.currentTarget.checked)} size="sm" />
                    <Checkbox label="Nodal Loads" checked={showNodal} onChange={(e) => setShowNodal(e.currentTarget.checked)} size="sm" />
                    <Checkbox label="Element Loads" checked={showElement} onChange={(e) => setShowElement(e.currentTarget.checked)} size="sm" />
                </Group>
            </Paper>
        </Flex>
    );
}
