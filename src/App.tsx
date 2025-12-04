import { SystemSolver } from "./SystemSolver";
import SolutionVisualization from "./SolutionVisualization";
import Editor from "./view/Editor";

export default function App() {

  const systemSolver = new SystemSolver()

  return (
    <>
      {/*  <SolutionVisualization systemSolution={systemSolver.solve()} />*/}
      <Editor />
    </>
  );
}
