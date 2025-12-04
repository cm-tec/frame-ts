import { SystemSolver } from "./SystemSolver";
import SolutionVisualization from "./SolutionVisualization";
import Editor from "./view/Editor";

import '@mantine/core/styles.css';

import { MantineProvider } from '@mantine/core';

export default function App() {

  const systemSolver = new SystemSolver()

  return (
    <MantineProvider>
      <Editor />
    </MantineProvider>
  );
  return (
    <>
      {/*  <SolutionVisualization systemSolution={systemSolver.solve()} />*/}

    </>
  );
}
