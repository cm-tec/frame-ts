import '@mantine/core/styles.css';
import { ActionIcon, AppShell, Badge, Button, Divider, Group, MantineProvider, SegmentedControl, Text, TextInput, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useMemo, useRef, useState } from "react";

import { type NodeInput, type ElementInput, type HingeInput, type InitialConditions, type Loads } from "./models/inputModels";
import { StructuralSystem } from "./solver/StructuralSystem";
import { SystemSolver } from "./solver/SystemSolver";

import Editor from "./view/pages/Editor";
import DynamicVisualization from "./view/pages/DynamicVisualization";
import EigenmodeVisualization from "./view/pages/EigenmodeVisualization";
import StaticVisualization from "./view/pages/StaticVisualization";
import KinematicVisualization from "./view/pages/KinematicVisualization";
import { AboutModal } from "./view/components/AboutModal";

export default function App() {
  const [editMode, setEditMode]   = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [view,     setView]       = useState<'dynamic' | 'static'>('dynamic');
  const [subView,  setSubView]    = useState<'response' | 'eigenmodes'>('response');

  const [nodes, setNodes] = useState<NodeInput[]>([
    { id: 1, x: 0, z: 0,   mass: 1,  restraint: { u: true,  v: true,  theta: false  }, angle: 0 },
    { id: 2, x: 0, z: 20,  mass: 80, restraint: { u: true,  v: false, theta: false }, angle: 0 },
    { id: 3, x: 0, z: 10,  mass: 8,  restraint: { u: true,  v: false, theta: false }, angle: 0 },
  ]);

  const [elements, setElements] = useState<ElementInput[]>([
    { id: 1, node_i: 2, node_j: 3, ea: 2000, ei: 10, c: 0 },
    { id: 2, node_i: 3, node_j: 1, ea: 1250, ei: 10, c: 0.6 },
  ]);

  const [hinges, setHinges] = useState<HingeInput[]>([]);

  const [initialConditions, setInitialConditions] = useState<InitialConditions>({
    2: { u0: 0, v0: 1,  theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
    3: { u0: 0, v0: -1, theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
  });

  const [loads, setLoads] = useState<Loads>({
    nodes:    [{ id: 1, node_id: 2, magnitude: 10, angle: 0, frequency: 0, phase_shift: 0 }],
    elements: [{ id: 1, element_id: 1, q_i: 5, q_j: 5, angle: 0, frequency: 0, phase_shift: 0 }],
  });


  const [systemName, setSystemName] = useState('My Structure');

  const importRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = JSON.stringify({ name: systemName.trim() || 'My Structure', view, nodes, elements, hinges, initialConditions, loads }, null, 2);
    const url  = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a    = document.createElement('a');
    const filename = systemName.trim() ? `${systemName.trim()}.json` : 'structure.json';
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (d.name)              setSystemName(d.name);
        if (d.view)              setView(d.view);
        if (d.nodes)             setNodes(d.nodes);
        if (d.elements)          setElements(d.elements);
        if (d.hinges)            setHinges(d.hinges);
        if (d.initialConditions) setInitialConditions(d.initialConditions);
        if (d.loads)             setLoads(d.loads);
      } catch { /* ignore malformed files */ }
    };
    reader.readAsText(file);
  };

  // Separate structural systems per mode
  const staticSystem  = useMemo(() => new StructuralSystem(nodes, elements, hinges),  [nodes, elements, hinges]);
  const dynamicSystem = useMemo(() => StructuralSystem.createPureTruss(nodes, elements), [nodes, elements]);

  const activeSystem = view === 'static' ? staticSystem : dynamicSystem;
  const isKinematic  = useMemo(() => new SystemSolver(activeSystem).isKinematic(), [activeSystem]);

  return (
    <MantineProvider>
      <AboutModal opened={aboutOpen} onClose={() => setAboutOpen(false)} />
      <AppShell header={{ height: 50 }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap={6}>
              <Text fw={700} size="lg">Truss</Text>
              <Tooltip label="About — concepts, methods, conventions">
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setAboutOpen(true)} aria-label="About">
                  <IconInfoCircle size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

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

            <Group gap="xs">
              <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
              <TextInput
                value={systemName}
                onChange={e => setSystemName(e.currentTarget.value)}
                size="xs"
                w={160}
                placeholder="System name"
              />
              <Button onClick={() => importRef.current?.click()} variant="default" size="xs">Import</Button>
              <Button onClick={handleExport} variant="default" size="xs">Export</Button>
              <Divider orientation="vertical" />
              <Button onClick={() => setEditMode(m => !m)} variant="light" size="xs">
                {editMode ? 'Analyze' : 'Edit'}
              </Button>
            </Group>
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
            <DynamicVisualization structuralSystem={dynamicSystem} initialConditions={initialConditions} loads={loads} />
          )}
          {!editMode && !isKinematic && view === 'dynamic' && subView === 'eigenmodes' && (
            <EigenmodeVisualization structuralSystem={dynamicSystem} />
          )}
          {!editMode && !isKinematic && view === 'static' && (
            <StaticVisualization structuralSystem={staticSystem} loads={loads} />
          )}
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}