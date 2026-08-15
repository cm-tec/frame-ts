import type { StructuralElement } from "./StructuralSystem";


// Returns the internal forces of a specified element at the position xi; xi in [0, 1]
export function elementInternalForces(
    element: StructuralElement,
    xi: number,
    getDof: (dof: number) => number,
    load?: { qi: number; qj: number; angle?: number },
    nPoints = 30,
):  { N: number; V: number; M: number; } {

    return { N: 0, V: 0, M: 0}

}