import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StructuralSystemViewer from './view/StructuralSystemViewer.tsx'
import { StructuralSystem } from './StructuralSystem.ts'
import { type Node } from './models/models.ts';
import MinimalNetwork from './view/Test.tsx'

let structuralSystem = new StructuralSystem([
  { id: 1, x: 0, z: 0, mass: 0, restrained_u: false, restrained_v: false, restrained_phi: false },
  { id: 2, x: 1, z: 0, mass: 0, restrained_u: false, restrained_v: false, restrained_phi: false },
  { id: 3, x: 3, z: 0, mass: 0, restrained_u: false, restrained_v: false, restrained_phi: false },
],
  [
    { id: 1, node_i: 1, node_j: 2, ea: 1, c: 0 },
    { id: 2, node_i: 2, node_j: 3, ea: 1, c: 0 }
  ]);


const getNodePosition = (nodeId: number, time: number): { x: number; z: number } => {
  const node = structuralSystem.nodes.find(n => n.id == nodeId)!;

  return {
    x: node.x,
    z: node.z
  };
};


const getElementPositions = (elementId: number, time: number): Array<{ x: number; z: number }> => {
  const element = structuralSystem.elements.find(e => e.id == elementId)!;

  const node_i = structuralSystem.nodes.find(n => n.id == element.node_i)!;
  const node_j = structuralSystem.nodes.find(n => n.id == element.node_j)!;

  const N = 200;

  return [{ x: node_i.x, z: node_i.z }, { x: node_i.x + (node_j.x - node_i.x) / 2, z: node_i.z + (node_j.x - node_i.x) / 2 + 2 }, { x: node_j.x, z: node_j.z }];
};


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StructuralSystemViewer
      structuralSystem={structuralSystem}
      getNodePosition={getNodePosition}
      getElementPositions={getElementPositions}
    />
  </StrictMode>,
)


//  <MinimalNetwork />
// <StructuralSystemViewer structuralSystem={structuralSystem} />  