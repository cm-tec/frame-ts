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

createRoot(document.getElementById('root')!).render(
  <StrictMode>

    <StructuralSystemViewer structuralSystem={structuralSystem} />
  </StrictMode>,
)


//     <MinimalNetwork />