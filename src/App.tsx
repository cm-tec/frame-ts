import SolutionVisualization from "./view/SolutionVisualization";
import Editor from "./view/Editor";

import '@mantine/core/styles.css';

import { AppShell, Button, Group, MantineProvider, Text } from '@mantine/core';
import { useMemo, useState } from "react";

import { type Node, type Element } from "./models/models";
import { StructuralSystem } from "./solver/StructuralSystem";


export default function App() {

  const [editMode, setEditMode] = useState<boolean>(false);

  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
    { id: 2, x: 0.5, z: 0.5, mass: 1, restrained_u: false, restrained_v: false, u0: 0, v0: 0, du0: 0, dv0: 0, },
    { id: 3, x: 1, z: 0, mass: 1, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0, },
  ]);

  const [elements, setElements] = useState<Element[]>([
    { id: 1, node_i: 1, node_j: 2, ea: 1, c: 1 },
    { id: 2, node_i: 2, node_j: 3, ea: 1, c: 1 },
  ]);

  const structuralSystem = useMemo(() => new StructuralSystem(nodes, elements), [nodes, elements]);

  return (
    <MantineProvider>
      <AppShell header={{ height: 50 }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Text fw={700} size="lg">Truss</Text>
            <Button onClick={() => setEditMode(m => !m)} variant="light">
              {editMode ? 'Analyze' : 'Edit'}
            </Button>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          {editMode
            ? <Editor nodes={nodes} setNodes={setNodes} elements={elements} setElements={setElements} />
            : <SolutionVisualization structuralSystem={structuralSystem} />
          }
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
