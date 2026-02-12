import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import StructuralSystemViewer from './view/StructuralSystemViewer.tsx'
import { StructuralSystem } from './StructuralSystem.ts'
import { type Node } from './models/models.ts';
import MinimalNetwork from './view/Test.tsx'
import SolutionVisualization from './SolutionVisualization.tsx'
import { SystemSolver } from './SystemSolver.ts'
import { MantineProvider } from '@mantine/core'
import { matrix, zeros } from 'mathjs'

let structuralSystem = new StructuralSystem([
  { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, restrained_phi: true },
  { id: 2, x: 1, z: 0, mass: 1, restrained_u: false, restrained_v: false, restrained_phi: false },
  { id: 3, x: 2, z: 0, mass: 2, restrained_u: true, restrained_v: false, restrained_phi: false },
],
  [
    { id: 1, node_i: 1, node_j: 2, ea: 100, ei: 1, c: 1 },
    { id: 2, node_i: 2, node_j: 3, ea: 100, ei: 1, c: 1 },
  ]);





const solver = new SystemSolver(structuralSystem);

let initialConditions = matrix(zeros([2 * solver.non_restrained.length, 1]));
initialConditions.set([0, 0], -0.1);

const solution = solver.solve(initialConditions);


const getNodePosition = (nodeId: number, time: number): { x: number; z: number } => {
  const node = structuralSystem.nodes.find(n => n.id == nodeId)!;

  return {
    x: node.x + solution.get_w(node.u_dof, time),
    z: node.z + solution.get_w(node.v_dof, time)
  };
};


const getElementPositions = (elementId: number, time: number): Array<{ x: number; z: number }> => {
  const element = structuralSystem.elements.find(e => e.id == elementId)!;

  const node_i = structuralSystem.nodes.find(n => n.id == element.node_i)!;
  const node_j = structuralSystem.nodes.find(n => n.id == element.node_j)!;

  const N = 200;

  const { x: x_i, z: z_i } = getNodePosition(node_i.id, time);
  const { x: x_j, z: z_j } = getNodePosition(node_j.id, time);

  return [{ x: x_i, z: z_i }, { x: x_i + (x_j - x_i) / 2, z: z_i + (z_j - z_i) / 2 }, { x: x_j, z: z_j }];
};




createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

function App() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let frame: number;
    const move = () => {
      setTime(prev => prev + 0.01);
      frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div>
      <input
        type="range"
        min="0" max="10" step="0.1"
        value={time}
        onChange={(e) => setTime(parseFloat(e.target.value))}
      />
      <StructuralSystemViewer
        structuralSystem={structuralSystem}
        getNodePosition={getNodePosition}
        getElementPositions={getElementPositions}
        time={time}
      />

    </div>
  );
}


//  <MinimalNetwork />
// <StructuralSystemViewer structuralSystem={structuralSystem} />  