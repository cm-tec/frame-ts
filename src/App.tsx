import '@mantine/core/styles.css';
import { ActionIcon, Alert, AppShell, Badge, Button, Divider, Group, MantineProvider, SegmentedControl, Text, TextInput, Tooltip } from '@mantine/core';
import { IconCamera, IconInfoCircle } from '@tabler/icons-react';
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
import Welcome from "./view/pages/Welcome";
import { examples } from "./examples";
import type { SystemFile } from "./models/systemFile";
import { useViewerStageStore } from "./store/viewerStageStore";
import { downloadThumbnail, toFilenameStem } from "./view/utils/thumbnail";

// What "Start from scratch" opens: a small damped two-element system with something to see.
const DEFAULT_SYSTEM: SystemFile = {
  name: 'My Structure',
  view: 'dynamic',
  nodes: [
    { id: 1, x: 0, z: 0,   mass: 1,  restraint: { u: true,  v: true,  theta: false }, angle: 0 },
    { id: 2, x: 0, z: 20,  mass: 80, restraint: { u: true,  v: false, theta: false }, angle: 0 },
    { id: 3, x: 0, z: 10,  mass: 8,  restraint: { u: true,  v: false, theta: false }, angle: 0 },
  ],
  elements: [
    { id: 1, node_i: 2, node_j: 3, ea: 2000, ei: 10, c: 0 },
    { id: 2, node_i: 3, node_j: 1, ea: 1250, ei: 10, c: 0.6 },
  ],
  hinges: [],
  initialConditions: {
    2: { u0: 0, v0: 1,  theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
    3: { u0: 0, v0: -1, theta0: 0, du0: 0, dv0: 0, dtheta0: 0 },
  },
  loads: {
    nodes:    [{ id: 1, node_id: 2, magnitude: 10, angle: 0, frequency: 0, phase_shift: 0 }],
    elements: [{ id: 1, element_id: 1, q_i: 5, q_j: 5, angle: 0, frequency: 0, phase_shift: 0 }],
  },
};

export default function App() {
  const [editMode, setEditMode]   = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(true);
  const [view,     setView]       = useState<'dynamic' | 'static'>('dynamic');
  const [subView,  setSubView]    = useState<'response' | 'eigenmodes'>('response');

  const [nodes, setNodes] = useState<NodeInput[]>(DEFAULT_SYSTEM.nodes!);
  const [elements, setElements] = useState<ElementInput[]>(DEFAULT_SYSTEM.elements!);
  const [hinges, setHinges] = useState<HingeInput[]>(DEFAULT_SYSTEM.hinges!);
  const [initialConditions, setInitialConditions] = useState<InitialConditions>(DEFAULT_SYSTEM.initialConditions!);
  const [loads, setLoads] = useState<Loads>(DEFAULT_SYSTEM.loads!);


  const [systemName, setSystemName] = useState('My Structure');

  const importRef = useRef<HTMLInputElement>(null);

  const viewerStage = useViewerStageStore(s => s.stage);

  const handleExport = () => {
    const json = JSON.stringify({ name: systemName.trim() || 'My Structure', view, nodes, elements, hinges, initialConditions, loads }, null, 2);
    const url  = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a    = document.createElement('a');
    const filename = systemName.trim() ? `${systemName.trim()}.json` : 'structure.json';
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleThumbnail = () => {
    if (viewerStage) downloadThumbnail(viewerStage, `${toFilenameStem(systemName)}.png`);
  };

  // The one way a structure enters the app - used by Import and by the example gallery.
  // Missing collections are cleared rather than kept, so no trace of the previous
  // structure can survive into the new one.
  const loadSystem = (d: SystemFile): boolean => {
    if (!Array.isArray(d.nodes) || d.nodes.length === 0 || !Array.isArray(d.elements)) return false;

    setSystemName(d.name?.trim() || 'My Structure');
    setView(d.view === 'static' ? 'static' : 'dynamic');
    setNodes(d.nodes);
    setElements(d.elements);
    setHinges(d.hinges ?? []);
    setInitialConditions(d.initialConditions ?? {});
    setLoads(d.loads ?? { nodes: [], elements: [] });
    return true;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        if (loadSystem(JSON.parse(ev.target?.result as string))) setGalleryOpen(false);
      } catch { /* ignore malformed files */ }
    };
    reader.readAsText(file);
  };

  // Separate structural systems per mode
  const staticSystem  = useMemo(() => new StructuralSystem(nodes, elements, hinges),  [nodes, elements, hinges]);
  const dynamicSystem = useMemo(() => StructuralSystem.createPureTruss(nodes, elements), [nodes, elements]);

  const activeSystem = view === 'static' ? staticSystem : dynamicSystem;
  const isKinematic  = useMemo(() => new SystemSolver(activeSystem).isKinematic(), [activeSystem]);

  // Only the dynamic model needs mass; the static one solves fine without it.
  const masslessDynamic = useMemo(
    () => view === 'dynamic' && !isKinematic && new SystemSolver(dynamicSystem).hasMasslessDofs(),
    [view, isKinematic, dynamicSystem],
  );

  const openExample = (data: SystemFile) => {
    if (loadSystem(data)) {
      setEditMode(false);
      setSubView('response');
      setGalleryOpen(false);
    }
  };

  const startFromScratch = () => {
    loadSystem(DEFAULT_SYSTEM);
    setEditMode(true);
    setGalleryOpen(false);
  };

  if (galleryOpen) {
    return (
      <MantineProvider>
        <AboutModal opened={aboutOpen} onClose={() => setAboutOpen(false)} />
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <Welcome
          examples={examples}
          onSelect={openExample}
          onStartFromScratch={startFromScratch}
          onImport={() => importRef.current?.click()}
          onAbout={() => setAboutOpen(true)}
        />
      </MantineProvider>
    );
  }

  return (
    <MantineProvider>
      <AboutModal opened={aboutOpen} onClose={() => setAboutOpen(false)} />
      <AppShell header={{ height: 50 }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap={6}>
              <Tooltip label="Back to examples">
                <Text
                  fw={700}
                  size="lg"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setGalleryOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') setGalleryOpen(true); }}
                >
                  FrameTS
                </Text>
              </Tooltip>
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
              {masslessDynamic && (
                <Badge color="orange" variant="light">Massless Degrees of Freedom</Badge>
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
              <Tooltip label="Save thumbnail — PNG of the current view, without the grid">
                <ActionIcon
                  onClick={handleThumbnail}
                  disabled={!viewerStage}
                  variant="default"
                  size={30}
                  aria-label="Save thumbnail"
                >
                  <IconCamera size={16} />
                </ActionIcon>
              </Tooltip>
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
          {!editMode && !isKinematic && view === 'dynamic' && masslessDynamic && (
            <Alert color="orange" title="Massless degrees of freedom" variant="light" m="md">
              <Text size="sm">
                Every node that is free to move needs a mass before the dynamic response can be
                computed. Give the unrestrained nodes a mass in the editor, or restrain them.
              </Text>
            </Alert>
          )}
          {!editMode && !isKinematic && !masslessDynamic && view === 'dynamic' && subView === 'response' && (
            <DynamicVisualization structuralSystem={dynamicSystem} initialConditions={initialConditions} loads={loads} />
          )}
          {!editMode && !isKinematic && !masslessDynamic && view === 'dynamic' && subView === 'eigenmodes' && (
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