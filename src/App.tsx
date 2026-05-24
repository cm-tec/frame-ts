import SolutionVisualization from "./view/SolutionVisualization";
import EigenmodeVisualization from "./view/EigenmodeVisualization";
import KinematicSystemVisualization from "./view/KinematicSystemVisualization";
import Editor from "./view/Editor";

import '@mantine/core/styles.css';

import { AppShell, Button, Group, MantineProvider, SegmentedControl, Text } from '@mantine/core';
import { useMemo, useState } from "react";

import { type Node, type Element, type InitialConditions } from "./models/models";
import { StructuralSystem } from "./solver/StructuralSystem";
import { SystemSolver } from "./solver/SystemSolver";


export default function App() {

  const [editMode, setEditMode] = useState<boolean>(false);
  const [view, setView] = useState<'response' | 'eigenmodes'>('response');

  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, x: 0, z: 0, mass: 1, restraint: { u: true, v: true, theta: true }, angle: 0 },
    { id: 2, x: 0, z: -20, mass: 80, restraint: { u: true, v: false, theta: true }, angle: 0 },
    { id: 3, x: 0, z: -10, mass: 8, restraint: { u: true, v: false, theta: true }, angle: 0 },
  ]);

  const [initialConditions, setInitialConditions] = useState<InitialConditions>({
    2: { u0: 0, v0: -1, theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
    3: { u0: 0, v0: 1,  theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
  });

  const [elements, setElements] = useState<Element[]>([
    {
      id: 1, node_i: 2, node_j: 3, ea: 2000, ei: 0, c: 0,
      releases_i: { u: false, v: false, theta: true },
      releases_j: { u: false, v: false, theta: true }
    },
    {
      id: 2, node_i: 3, node_j: 1, ea: 1250, ei: 0, c: 0.6,
      releases_i: { u: false, v: false, theta: true },
      releases_j: { u: false, v: false, theta: true }
    },
  ]);

  const structuralSystem = useMemo(() => new StructuralSystem(nodes, elements), [nodes, elements]);
  const isKinematic = useMemo(() => new SystemSolver(structuralSystem).isKinematic(), [structuralSystem]);

  return (
    <MantineProvider>
      <AppShell header={{ height: 50 }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Text fw={700} size="lg">Truss</Text>
            {!editMode && !isKinematic && (
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
          {editMode && <Editor nodes={nodes} setNodes={setNodes} elements={elements} setElements={setElements} initialConditions={initialConditions} setInitialConditions={setInitialConditions} />}
          {!editMode && isKinematic && <KinematicSystemVisualization structuralSystem={structuralSystem} />}
          {!editMode && !isKinematic && view === 'response' && <SolutionVisualization structuralSystem={structuralSystem} initialConditions={initialConditions} />}
          {!editMode && !isKinematic && view === 'eigenmodes' && <EigenmodeVisualization structuralSystem={structuralSystem} />}
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
