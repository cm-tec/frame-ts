import SolutionVisualization from "./view/SolutionVisualization";
import Editor from "./view/Editor";

import '@mantine/core/styles.css';

import { Button, MantineProvider } from '@mantine/core';
import { useState } from "react";

import { type Node, type Element } from "./models/models";
import { StructuralSystem } from "./StructuralSystem";


export default function App() {

  const [editMode, setEditMode] = useState<boolean>(false);

  const toggleMode = (setEditMode: React.Dispatch<React.SetStateAction<boolean>>) => {
    setEditMode(prev => !prev);
  };

  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, x: 0, z: 0, mass: 0, restrained_u: true, restrained_v: true, restrained_phi: true },
    { id: 2, x: 15, z: 0, mass: 8, restrained_u: false, restrained_v: true, restrained_phi: true },
    { id: 3, x: 30, z: 0, mass: 80, restrained_u: false, restrained_v: true, restrained_phi: true },
  ]);

  const [elements, setElements] = useState<Element[]>([
    { id: 1, node_i: 1, node_j: 2, ea: 125, ei: 1, c: 0.6 },
    { id: 2, node_i: 2, node_j: 3, ea: 200, ei: 1, c: 0 },
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
