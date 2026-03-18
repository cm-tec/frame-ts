import SolutionVisualization from "./view/SolutionVisualization";
import Editor from "./view/Editor";

import '@mantine/core/styles.css';

import { Button, MantineProvider } from '@mantine/core';
import { useState } from "react";

import { type Node, type Element } from "./models/models";
import { StructuralSystem } from "./solver/StructuralSystem";


export default function App() {

  const [editMode, setEditMode] = useState<boolean>(false);

  const toggleMode = (setEditMode: React.Dispatch<React.SetStateAction<boolean>>) => {
    setEditMode(prev => !prev);
  };

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
      <div style={{ position: 'relative' }}>

        <Button
          onClick={() => toggleMode(setEditMode)}
          style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}
          variant="filled"
        >
          {editMode ? 'Analyze' : 'Edit'}
        </Button>
        {editMode ? (
          <Editor
            nodes={nodes}
            setNodes={setNodes}
            elements={elements}
            setElements={setElements} />
        )
          : (
            <SolutionVisualization structuralSystem={new StructuralSystem(nodes, elements)} />
          )
        }
      </div>


    </MantineProvider>
  );
}
