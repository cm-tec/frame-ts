import '@mantine/core/styles.css';
import { ActionIcon, Alert, AppShell, Badge, Button, Divider, Group, MantineProvider, SegmentedControl, Text, TextInput, Tooltip } from '@mantine/core';
import { IconCamera } from '@tabler/icons-react';
import { useMemo, useRef, useState } from "react";

import { type NodeInput, type ElementInput, type HingeInput, type InitialConditions, type Loads } from "./models/inputModels";
import { StructuralSystem } from "./solver/StructuralSystem";
import { SystemSolver } from "./solver/SystemSolver";

import Editor from "./view/pages/Editor";
import DynamicVisualization from "./view/pages/DynamicVisualization";
import EigenmodeVisualization from "./view/pages/EigenmodeVisualization";
import StaticVisualization from "./view/pages/StaticVisualization";
import KinematicVisualization from "./view/pages/KinematicVisualization";
import Welcome from "./view/pages/Welcome";
import { examples } from "./examples";
import { migrateSystemFile, SYSTEM_FILE_VERSION, type SystemFile } from "./models/systemFile";
import { useViewerStageStore } from "./store/viewerStageStore";
import { downloadThumbnail, toFilenameStem } from "./view/utils/thumbnail";

const EMPTY_SYSTEM: SystemFile = {
  version: SYSTEM_FILE_VERSION,
  name: 'My Structure',
  view: 'dynamic',
  nodes: [],
  elements: [],
  hinges: [],
  initialConditions: {},
  loads: { nodes: [], moments: [], elements: [] },
};

export default function App() {
  const [editMode, setEditMode]   = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(true);
  const [view,     setView]       = useState<'dynamic' | 'static'>('dynamic');
  const [subView,  setSubView]    = useState<'response' | 'eigenmodes'>('response');

  const [nodes, setNodes] = useState<NodeInput[]>(EMPTY_SYSTEM.nodes!);
  const [elements, setElements] = useState<ElementInput[]>(EMPTY_SYSTEM.elements!);
  const [hinges, setHinges] = useState<HingeInput[]>(EMPTY_SYSTEM.hinges!);
  const [initialConditions, setInitialConditions] = useState<InitialConditions>(EMPTY_SYSTEM.initialConditions!);
  const [loads, setLoads] = useState<Loads>(EMPTY_SYSTEM.loads!);


  const [systemName, setSystemName] = useState('My Structure');
  const [loadError, setLoadError] = useState<string | null>(null);

  const importRef = useRef<HTMLInputElement>(null);

  const viewerStage = useViewerStageStore(s => s.stage);

  const handleExport = () => {
    const json = JSON.stringify({ version: SYSTEM_FILE_VERSION, name: systemName.trim() || 'My Structure', view, nodes, elements, hinges, initialConditions, loads }, null, 2);
    const url  = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a    = document.createElement('a');
    const filename = systemName.trim() ? `${systemName.trim()}.json` : 'structure.json';
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleThumbnail = () => {
    if (viewerStage) downloadThumbnail(viewerStage, `${toFilenameStem(systemName)}.png`);
  };

  
  const loadSystem = (raw: SystemFile): boolean => {
    const migrated = migrateSystemFile(raw);
    if (!migrated.ok) {
      setLoadError(migrated.reason);
      return false;
    }

    const d = migrated.file;
    if (!Array.isArray(d.nodes) || d.nodes.length === 0 || !Array.isArray(d.elements)) {
      setLoadError('This file describes no nodes or elements.');
      return false;
    }

    applySystem(d);
    return true;
  };

  const applySystem = (d: SystemFile) => {
    setLoadError(null);
    setSystemName(d.name?.trim() || 'My Structure');
    setView(d.view === 'static' ? 'static' : 'dynamic');
    setNodes(d.nodes ?? []);
    setElements(d.elements ?? []);
    setHinges(d.hinges ?? []);
    setInitialConditions(d.initialConditions ?? {});
    setLoads({ nodes: [], moments: [], elements: [], ...d.loads });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        if (loadSystem(JSON.parse(ev.target?.result as string))) setGalleryOpen(false);
      } catch {
        setLoadError('This file is not valid JSON.');
      }
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
    applySystem(EMPTY_SYSTEM);
    setEditMode(true);
    setGalleryOpen(false);
  };

  const loadErrorAlert = loadError && (
    <Alert color="red" title="Could not load file" variant="light" m="md" withCloseButton onClose={() => setLoadError(null)}>
      <Text size="sm">{loadError}</Text>
    </Alert>
  );

  if (galleryOpen) {
    return (
      <MantineProvider>
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {loadErrorAlert}
        <Welcome
          examples={examples}
          onSelect={openExample}
          onStartFromScratch={startFromScratch}
          onImport={() => importRef.current?.click()}
        />
      </MantineProvider>
    );
  }

  return (
    <MantineProvider>
      <AppShell header={{ height: 50 }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap={6}>
              <Tooltip label="Back to examples and documentation">
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
          {loadErrorAlert}
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