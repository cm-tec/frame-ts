import SolutionVisualization from "./view/SolutionVisualization";
import EigenmodeVisualization from "./view/EigenmodeVisualization";
import Editor from "./view/Editor";

import '@mantine/core/styles.css';

import { AppShell, Button, Group, MantineProvider, SegmentedControl, Text } from '@mantine/core';
import { useMemo, useState } from "react";

import { type Node, type Element } from "./models/models";
import { StructuralSystem } from "./solver/StructuralSystem";


export default function App() {

  const [editMode, setEditMode] = useState<boolean>(false);
  const [view, setView] = useState<'response' | 'eigenmodes'>('response');

  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, u0: 0, v0: 0, du0: 0, dv0: 0 },
    { id: 2, x: 0, z: -20, mass: 80, restrained_u: true, restrained_v: false, u0: 0, v0: -1, du0: 0, dv0: 0, },
    { id: 3, x: 0, z: -10, mass: 8, restrained_u: true, restrained_v: false, u0: 0, v0: 1, du0: 0, dv0: 0, },
  ]);

  const [elements, setElements] = useState<Element[]>([
    { id: 1, node_i: 2, node_j: 3, ea: 2000, c: 0 },
    { id: 2, node_i: 3, node_j: 1, ea: 1250, c: 0.6 },
  ]);

  const structuralSystem = useMemo(() => new StructuralSystem(nodes, elements), [nodes, elements]);

  return (
    <MantineProvider>
      <AppShell header={{ height: 50 }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Text fw={700} size="lg">Truss</Text>
            {!editMode && (
              <SegmentedControl
                value={view}
                onChange={(v) => setView(v as 'response' | 'eigenmodes')}
                data={[
                  { value: 'response', label: 'Response' },
                  { value: 'eigenmodes', label: 'Eigenmodes' },
                ]}
                size="xs"
              />
            )}
            <Button onClick={() => setEditMode(m => !m)} variant="light">
              {editMode ? 'Analyze' : 'Edit'}
            </Button>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          {editMode && <Editor nodes={nodes} setNodes={setNodes} elements={elements} setElements={setElements} />}
          {!editMode && view === 'response' && <SolutionVisualization structuralSystem={structuralSystem} />}
          {!editMode && view === 'eigenmodes' && <EigenmodeVisualization structuralSystem={structuralSystem} />}
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
