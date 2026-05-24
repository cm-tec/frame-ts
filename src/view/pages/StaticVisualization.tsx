import { useState, useCallback } from "react";
import { Box, Checkbox, Divider, Flex, Group, Paper, Slider, Text } from "@mantine/core";
import type { StructuralSystem } from "../../solver/StructuralSystem";
import type { Loads } from "../../models/models";
import StructuralSystemViewer from "../components/StructuralSystemViewer";

type InternalForceType = 'N' | 'V' | 'M';

export default function StaticVisualization({ structuralSystem, loads: _loads }: {
    structuralSystem: StructuralSystem;
    loads: Loads;
}) {
    const [showNodes, setShowNodes] = useState(true);
    const [showBearings, setShowBearings] = useState(true);
    const [activeForces, setActiveForces] = useState<Set<InternalForceType>>(new Set(['N']));
    const [scale, setScale] = useState(1);

    const toggleForce = (type: InternalForceType) => {
        setActiveForces(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type); else next.add(type);
            return next;
        });
    };

    const getNodePosition = useCallback((nodeId: number, _time: number): { x: number; z: number } => {
        const node = structuralSystem.nodes.find(n => n.id === nodeId)!;
        return { x: node.x, z: node.z };
    }, [structuralSystem]);

    const getElementPositions = useCallback((elementId: number, time: number): Array<{ x: number; z: number }> => {
        const element = structuralSystem.elements.find(e => e.id === elementId)!;
        return [getNodePosition(element.node_i, time), getNodePosition(element.node_j, time)];
    }, [structuralSystem, getNodePosition]);

    return (
        <Flex direction="column" style={{ height: 'calc(100vh - var(--app-shell-header-height, 50px))', overflow: 'hidden' }}>
            <Flex style={{ flex: 1, overflow: 'hidden' }}>
                <Box style={{ width: "70%", height: "100%", backgroundColor: "var(--mantine-color-gray-0)" }}>
                    <StructuralSystemViewer
                        structuralSystem={structuralSystem}
                        getNodePosition={getNodePosition}
                        getElementPositions={getElementPositions}
                        showUndeformedSystem={false}
                        showNodes={showNodes}
                        showBearings={showBearings}
                    />
                </Box>

                <Box style={{ width: "30%", height: "100%", overflowY: 'auto', backgroundColor: '#f8f9fa', borderLeft: '1px solid #dee2e6' }}>
                    <Flex direction="column" gap="md" p="md">
                        <Text size="xs" fw={700} c="dimmed">INTERNAL FORCES</Text>

                        <Flex direction="column" gap="xs">
                            {(['N', 'V', 'M'] as InternalForceType[]).map(type => (
                                <Checkbox
                                    key={type}
                                    label={type === 'N' ? 'Normal Force (N)' : type === 'V' ? 'Shear Force (V)' : 'Bending Moment (M)'}
                                    checked={activeForces.has(type)}
                                    onChange={() => toggleForce(type)}
                                    size="sm"
                                />
                            ))}
                        </Flex>

                        <Divider />

                        <Box>
                            <Text size="xs" fw={700} c="dimmed" mb="xs">DIAGRAM SCALE ×{scale.toFixed(1)}</Text>
                            <Slider value={scale} onChange={setScale} min={0.1} max={5} step={0.1} label={(v) => `×${v.toFixed(1)}`} />
                        </Box>
                    </Flex>
                </Box>
            </Flex>

            <Paper px="xl" py="xs" shadow="xl" withBorder style={{ zIndex: 100, borderRadius: 0, flexShrink: 0 }}>
                <Group gap="xs" align="center">
                    <Checkbox
                        label="Show Nodes"
                        checked={showNodes}
                        onChange={(e) => setShowNodes(e.currentTarget.checked)}
                        size="sm"
                    />
                    <Checkbox
                        label="Show Bearings"
                        checked={showBearings}
                        onChange={(e) => setShowBearings(e.currentTarget.checked)}
                        size="sm"
                    />
                </Group>
            </Paper>
        </Flex>
    );
}
