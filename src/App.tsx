import { SystemSolver } from "./SystemSolver";
import SolutionVisualization from "./SolutionVisualization";




export default function App() {

  const systemSolver = new SystemSolver()

  return (
    <>
      <SolutionVisualization systemSolution={systemSolver.solve()} />
    </>
  );
}
