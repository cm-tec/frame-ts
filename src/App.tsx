import SolutionVisualization from "./view/SolutionVisualization";
import Editor from "./view/Editor";

import '@mantine/core/styles.css';

import { AppShell, Button, Group, MantineProvider, Text } from '@mantine/core';
import { useState } from "react";

import { type Node, type Element } from "./models/models";
import { StructuralSystem } from "./solver/StructuralSystem";


export default function App() {

  const [editMode, setEditMode] = useState<boolean>(false);

  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, restrained_phi: true },
    { id: 2, x: 1, z: 0, mass: 1, restrained_u: false, restrained_v: false, restrained_phi: false },
    { id: 3, x: 1, z: 1, mass: 1, restrained_u: false, restrained_v: false, restrained_phi: false },
  ]);

  const [elements, setElements] = useState<Element[]>([
    { id: 1, node_i: 1, node_j: 2, ea: 1, ei: 2, c: 1 },
    { id: 2, node_i: 2, node_j: 3, ea: 1, ei: 100, c: 1 },
  ]);

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
            : <SolutionVisualization structuralSystem={new StructuralSystem(nodes, elements)} />
          }
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
