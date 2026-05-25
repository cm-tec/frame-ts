import '@mantine/core/styles.css';
import { AppShell, Badge, Button, Group, MantineProvider, SegmentedControl, Text } from '@mantine/core';
import { useMemo, useState } from "react";

import { type Node, type Element, type Hinge, type InitialConditions, type Loads } from "./models/models";
import { StructuralSystem } from "./solver/StructuralSystem";
import { SystemSolver } from "./solver/SystemSolver";

import Editor from "./view/pages/Editor";
import DynamicVisualization from "./view/pages/DynamicVisualization";
import EigenmodeVisualization from "./view/pages/EigenmodeVisualization";
import StaticVisualization from "./view/pages/StaticVisualization";
import KinematicVisualization from "./view/pages/KinematicVisualization";

const TRUSS_RELEASE = { u: false, v: false, theta: true };

export default function App() {
  const [editMode, setEditMode]   = useState(false);
  const [view,     setView]       = useState<'dynamic' | 'static'>('dynamic');
  const [subView,  setSubView]    = useState<'response' | 'eigenmodes'>('response');

  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, x: 0, z: 0,   mass: 1,  restraint: { u: true,  v: true,  theta: true  }, angle: 0 },
    { id: 2, x: 0, z: 20,  mass: 80, restraint: { u: true,  v: false, theta: false }, angle: 0 },
    { id: 3, x: 0, z: 10,  mass: 8,  restraint: { u: true,  v: false, theta: false }, angle: 0 },
  ]);

  const [elements, setElements] = useState<Element[]>([
    { id: 1, node_i: 2, node_j: 3, ea: 2000, ei: 0, c: 0,   releases_i: { u: false, v: false, theta: false }, releases_j: { u: false, v: false, theta: false } },
    { id: 2, node_i: 3, node_j: 1, ea: 1250, ei: 0, c: 0.6, releases_i: { u: false, v: false, theta: false }, releases_j: { u: false, v: false, theta: false } },
  ]);

  // Hinges are managed separately from elements so they can reference
  // elements that don't exist yet without breaking anything.
  const [hinges, setHinges] = useState<Hinge[]>([
    { id: 1, element_id: 1, end: 'i', u: false, v: false, theta: true },
    { id: 2, element_id: 1, end: 'j', u: false, v: false, theta: true },
    { id: 3, element_id: 2, end: 'i', u: false, v: false, theta: true },
    { id: 4, element_id: 2, end: 'j', u: false, v: false, theta: true },
  ]);

  const [initialConditions, setInitialConditions] = useState<InitialConditions>({
    2: { u0: 0, v0: 1,  theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
    3: { u0: 0, v0: -1, theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
  });

  const [loads, setLoads] = useState<Loads>({
    nodes:    [{ id: 1, node_id: 2, magnitude: 10, angle: 0, frequency: 0, phase_shift: 0 }],
    elements: [{ id: 1, element_id: 1, q_i: 5, q_j: 5, angle: 0, frequency: 0, phase_shift: 0 }],
  });

  // Elements with valid node references (shared filter base)
  const validElements = useMemo(
    () => elements.filter(e => nodes.some(n => n.id === e.node_i) && nodes.some(n => n.id === e.node_j)),
    [nodes, elements],
  );

  // Static: merge hinge state into element releases
  const staticElements = useMemo(() =>
    validElements.map(el => {
      const hi = hinges.filter(h => h.element_id === el.id && h.end === 'i');
      const hj = hinges.filter(h => h.element_id === el.id && h.end === 'j');
      return {
        ...el,
        releases_i: { u: hi.some(h => h.u), v: hi.some(h => h.v), theta: hi.some(h => h.theta) },
        releases_j: { u: hj.some(h => h.u), v: hj.some(h => h.v), theta: hj.some(h => h.theta) },
      };
    }),
    [validElements, hinges],
  );

  // Dynamic: always override to plain truss (theta released, no moment transfer)
  const dynamicElements = useMemo(
    () => validElements.map(el => ({ ...el, releases_i: TRUSS_RELEASE, releases_j: TRUSS_RELEASE })),
    [validElements],
  );
  const dynamicNodes = useMemo(
    () => nodes.map(n => ({ ...n, restraint: { ...n.restraint, theta: true } })),
    [nodes],
  );

  const validLoads = useMemo(() => ({
    nodes:    loads.nodes.filter(l => nodes.some(n => n.id === l.node_id)),
    elements: loads.elements.filter(l => validElements.some(e => e.id === l.element_id)),
  }), [nodes, loads, validElements]);

  // Separate structural systems per mode
  const staticSystem  = useMemo(() => new StructuralSystem(nodes,        staticElements),  [nodes,        staticElements]);
  const dynamicSystem = useMemo(() => new StructuralSystem(dynamicNodes, dynamicElements), [dynamicNodes, dynamicElements]);

  const activeSystem = view === 'static' ? staticSystem : dynamicSystem;
  const isKinematic  = useMemo(() => new SystemSolver(activeSystem).isKinematic(), [activeSystem]);

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
              nodes={nodes}                         setNodes={setNodes}
              elements={elements}                   setElements={setElements}
              hinges={hinges}                       setHinges={setHinges}
              initialConditions={initialConditions} setInitialConditions={setInitialConditions}
              loads={loads}                         setLoads={setLoads}
            />
          )}
          {!editMode && isKinematic && (
            <KinematicVisualization structuralSystem={activeSystem} />
          )}
          {!editMode && !isKinematic && view === 'dynamic' && subView === 'response' && (
            <DynamicVisualization structuralSystem={dynamicSystem} initialConditions={initialConditions} loads={validLoads} />
          )}
          {!editMode && !isKinematic && view === 'dynamic' && subView === 'eigenmodes' && (
            <EigenmodeVisualization structuralSystem={dynamicSystem} />
          )}
          {!editMode && !isKinematic && view === 'static' && (
            <StaticVisualization structuralSystem={staticSystem} loads={validLoads} />
          )}
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}