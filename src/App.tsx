import { SystemSolver } from "./SystemSolver";
import SolutionVisualization from "./SolutionVisualization";
import Editor from "./view/Editor";

import '@mantine/core/styles.css';

import { Button, MantineProvider } from '@mantine/core';
import { useState } from "react";

export default function App() {

  const systemSolver = new SystemSolver()

  const [editMode, setEditMode] = useState<boolean>(false);

  const toggleMode = (setEditMode: React.Dispatch<React.SetStateAction<boolean>>) => {
    setEditMode(prev => !prev);
  };

  return (
    <MantineProvider>
      <div style={{ position: 'relative', padding: '20px' }}>

        {/* The Button is styled to be absolutely positioned 
          in the top-right corner.
        */}
        <Button
          onClick={() => toggleMode(setEditMode)}
          style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}
          variant="filled" // Use Mantine's filled variant for visibility
        >
          {editMode ? 'Analyze' : 'Edit'}
        </Button>
        {editMode ? (
          <Editor />
        )
          : (
            <SolutionVisualization systemSolution={systemSolver.solve()} />
          )
        }
      </div>


    </MantineProvider>
  );
}
