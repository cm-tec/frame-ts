import type { StructuralSystem } from "../../solver/StructuralSystem";
import type { InitialConditions, Loads } from "../../models/models";
import { Box, Flex, Text } from "@mantine/core";

export default function StaticVisualization({ structuralSystem: _system, initialConditions: _ic, loads: _loads }: {
    structuralSystem: StructuralSystem;
    initialConditions: InitialConditions;
    loads: Loads;
}) {
    return (
        <Flex align="center" justify="center" style={{ height: 'calc(100vh - var(--app-shell-header-height, 50px))' }}>
            <Box>
                <Text c="dimmed">Static analysis — coming soon</Text>
            </Box>
        </Flex>
    );
}
