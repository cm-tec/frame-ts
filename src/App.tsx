import '@mantine/core/styles.css';
import { AppShell, Badge, Button, Group, MantineProvider, SegmentedControl, Text } from '@mantine/core';
import { useMemo, useState } from "react";

import { type Node, type Element, type InitialConditions, type Loads } from "./models/models";
import { StructuralSystem } from "./solver/StructuralSystem";
import { SystemSolver } from "./solver/SystemSolver";

import Editor from "./view/pages/Editor";
import DynamicVisualization from "./view/pages/DynamicVisualization";
import EigenmodeVisualization from "./view/pages/EigenmodeVisualization";
import StaticVisualization from "./view/pages/StaticVisualization";
import KinematicVisualization from "./view/pages/KinematicVisualization";

export default function App() {
  const [editMode, setEditMode]   = useState(false);
  const [view,     setView]       = useState<'dynamic' | 'static'>('dynamic');
  const [subView,  setSubView]    = useState<'response' | 'eigenmodes'>('response');

  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, x: 0, z: 0,   mass: 1,  restraint: { u: true,  v: true,  theta: true }, angle: 0 },
    { id: 2, x: 0, z: 20, mass: 80, restraint: { u: true,  v: false, theta: true }, angle: 0 },
    { id: 3, x: 0, z: 10, mass: 8,  restraint: { u: true,  v: false, theta: true }, angle: 0 },
  ]);

  const [elements, setElements] = useState<Element[]>([
    { id: 1, node_i: 2, node_j: 3, ea: 2000, ei: 0, c: 0,   releases_i: { u: false, v: false, theta: true }, releases_j: { u: false, v: false, theta: true } },
    { id: 2, node_i: 3, node_j: 1, ea: 1250, ei: 0, c: 0.6, releases_i: { u: false, v: false, theta: true }, releases_j: { u: false, v: false, theta: true } },
  ]);

  const [initialConditions, setInitialConditions] = useState<InitialConditions>({
    2: { u0: 0, v0: 1, theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
    3: { u0: 0, v0:  -1, theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
  });

  const [loads, setLoads] = useState<Loads>({
    nodes: [
      { id: 1, node_id: 2, magnitude: 10, angle: 0, frequency: 0, phase_shift: 0 },
    ],
    elements: [
      { id: 1, element_id: 1, q_i: 5, q_j: 5, angle: 0, frequency: 0, phase_shift: 0 },
    ],
  });

  const validElements = useMemo(
    () => elements.filter(e => nodes.some(n => n.id === e.node_i) && nodes.some(n => n.id === e.node_j)),
    [nodes, elements],
  );
  const validLoads = useMemo(() => ({
    nodes:    loads.nodes.filter(l => nodes.some(n => n.id === l.node_id)),
    elements: loads.elements.filter(l => validElements.some(e => e.id === l.element_id)),
  }), [nodes, loads, validElements]);

  const structuralSystem = useMemo(() => new StructuralSystem(nodes, validElements), [nodes, validElements]);
  const isKinematic      = useMemo(() => new SystemSolver(structuralSystem).isKinematic(), [structuralSystem]);

  return (
    <MantineProvider>
      <AppShell header={{ height: 50 }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Text fw={700} size="lg">Truss</Text>

            <Group gap="xs">
              {!isKinematic && editMode && (
                <SegmentedControl
                  value={view}
                  onChange={(v) => setView(v as 'dynamic' | 'static')}
                  data={[{ value: 'dynamic', label: 'Dynamic' }, { value: 'static', label: 'Static' }]}
                  size="xs"
                />
              )}
              {!isKinematic && !editMode && view === 'dynamic' && (
                <SegmentedControl
                  value={subView}
                  onChange={(v) => setSubView(v as 'response' | 'eigenmodes')}
                  data={[{ value: 'response', label: 'Response' }, { value: 'eigenmodes', label: 'Eigenmodes' }]}
                  size="xs"
                />
              )}
              {isKinematic && (
                <Badge color="orange" variant="light">Kinematic System</Badge>
              )}
            </Group>

            <Button onClick={() => setEditMode(m => !m)} variant="light">
              {editMode ? 'Analyze' : 'Edit'}
            </Button>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          {editMode && (
            <Editor
              view={view}
              nodes={nodes}               setNodes={setNodes}
              elements={elements}         setElements={setElements}
              initialConditions={initialConditions} setInitialConditions={setInitialConditions}
              loads={loads}               setLoads={setLoads}
            />
          )}
          {!editMode && isKinematic && (
            <KinematicVisualization structuralSystem={structuralSystem} />
          )}
          {!editMode && !isKinematic && view === 'dynamic' && subView === 'response' && (
            <DynamicVisualization structuralSystem={structuralSystem} initialConditions={initialConditions} loads={validLoads} />
          )}
          {!editMode && !isKinematic && view === 'dynamic' && subView === 'eigenmodes' && (
            <EigenmodeVisualization structuralSystem={structuralSystem} />
          )}
          {!editMode && !isKinematic && view === 'static' && (
            <StaticVisualization structuralSystem={structuralSystem} loads={validLoads} />
          )}
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
