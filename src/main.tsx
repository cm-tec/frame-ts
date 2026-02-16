import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import StructuralSystemViewer from './view/StructuralSystemViewer.tsx'
import { StructuralSystem } from './StructuralSystem.ts'
import { type Node } from './models/models.ts';
import MinimalNetwork from './view/Test.tsx'
import SolutionVisualization from './view/SolutionVisualization.tsx'
import { SystemSolver } from './SystemSolver.ts'
import { MantineProvider } from '@mantine/core'
import { matrix, zeros } from 'mathjs'
import App from './App.tsx'

let structuralSystem = new StructuralSystem([
  { id: 1, x: 0, z: 0, mass: 1, restrained_u: true, restrained_v: true, restrained_phi: true },
  { id: 2, x: 1, z: 0, mass: 1, restrained_u: false, restrained_v: false, restrained_phi: false },
],
  [
    { id: 1, node_i: 1, node_j: 2, ea: 1, ei: 100, c: 0.1 },
  ]);





const solver = new SystemSolver(structuralSystem);

let initialConditions = matrix(zeros([2 * solver.non_restrained.length, 1]));
initialConditions.set([4, 0], 1);

const solution = solver.solve(initialConditions);


const getNodePosition = (nodeId: number, time: number): { x: number; z: number } => {
  const node = structuralSystem.nodes.find(n => n.id == nodeId)!;

  return {
    x: node.x + solution.get_w(node.u_dof, time),
    z: node.z + solution.get_w(node.v_dof, time)
  };
};

const getNodeState = (nodeId: number, time: number) => {
  const node = structuralSystem.nodes.find(n => n.id == nodeId)!;
  return {
    x: node.x,
    z: node.z,
    u: solution.get_w(node.u_dof, time),
    v: solution.get_w(node.v_dof, time),
    phi: solution.get_w(node.phi_dof, time)
  };
};

const getElementPositions = (elementId: number, time: number): Array<{ x: number; z: number }> => {
  const element = structuralSystem.elements.find(e => e.id == elementId)!;

  // 1. Get full state (pos + displacement) for both nodes
  const ni = getNodeState(element.node_i, time);
  const nj = getNodeState(element.node_j, time);

  // 2. Geometry basics
  const dx = nj.x - ni.x;
  const dz = nj.z - ni.z;
  const L = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);

  // 3. Project global displacements into local element coordinates
  // Local u is axial, Local v is transverse
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Local transverse displacements (v) and rotations (phi)
  const v_local_i = -ni.u * sinA + ni.v * cosA;
  const v_local_j = -nj.u * sinA + nj.v * cosA;
  const phi_i = ni.phi;
  const phi_j = nj.phi;

  // Local axial displacements (u)
  const u_local_i = ni.u * cosA + ni.v * sinA;
  const u_local_j = nj.u * cosA + nj.v * sinA;

  const N = 50; // 50 points is usually plenty for a smooth curve
  const points: Array<{ x: number; z: number }> = [];

  for (let step = 0; step <= N; step++) {
    const xi = step / N; // normalized distance 0 to 1
    const local_x_dist = xi * L;

    // Hermite Shape Functions
    const n1 = 1 - 3 * xi ** 2 + 2 * xi ** 3;
    const n2 = L * (xi - 2 * xi ** 2 + xi ** 3);
    const n3 = 3 * xi ** 2 - 2 * xi ** 3;
    const n4 = L * (- (xi ** 2) + xi ** 3);

    // Interpolate local displacements
    const local_v = n1 * v_local_i + n2 * phi_i + n3 * v_local_j + n4 * phi_j;
    const local_u = u_local_i * (1 - xi) + u_local_j * xi;

    // 4. Transform back to Global X, Z
    // Start at node_i, add axial component along beam, add transverse component perpendicular
    const finalX = ni.x + (local_x_dist + local_u) * cosA - local_v * sinA;
    const finalZ = ni.z + (local_x_dist + local_u) * sinA + local_v * cosA;

    points.push({ x: finalX, z: finalZ });
  }

  return points;
};




createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
/*
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
  */


//  <MinimalNetwork />
// <StructuralSystemViewer structuralSystem={structuralSystem} />  