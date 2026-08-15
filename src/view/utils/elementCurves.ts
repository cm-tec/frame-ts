import type { ElementDisplacementField } from "../../solver/displacementField";
import type { ElementForceField } from "../../solver/internalForces";
import type { StructuralElement } from "../../solver/StructuralSystem";

const N_CURVE_POINTS = 20;
const N_DIAGRAM_POINTS = 31;

// Turns the solver's polynomials into the point lists the canvas draws.
//
// The solver works per element in local coordinates; everything here is the view's own
// business: rotating into global coordinates, exaggerating by a display scale, and
// choosing how densely to sample.

export function deformedElementPoints(
    element: StructuralElement,
    field: ElementDisplacementField,
    scale: number,
    nPoints = N_CURVE_POINTS,
): Array<{ x: number; z: number }> {
    const c = Math.cos(element.angle);
    const s = Math.sin(element.angle);

    return Array.from({ length: nPoints }, (_, k) => {
        const xi = k / (nPoints - 1);
        const along = xi * element.L + scale * field.u.at(xi);
        const across = scale * field.v.at(xi);

        return {
            x: element.n_i.x + c * along - s * across,
            z: element.n_i.y + s * along + c * across,
        };
    });
}

export function sampleForces(
    field: ElementForceField,
    nPoints = N_DIAGRAM_POINTS,
): Array<{ xi: number; N: number; V: number; M: number }> {
    return Array.from({ length: nPoints }, (_, k) => {
        const xi = k / (nPoints - 1);
        return { xi, N: field.N.at(xi), V: field.V.at(xi), M: field.M.at(xi) };
    });
}

export function sampleDisplacements(
    element: StructuralElement,
    field: ElementDisplacementField,
    nPoints = N_DIAGRAM_POINTS,
): Array<{ xi: number; x: number; u: number; v: number }> {
    return Array.from({ length: nPoints }, (_, k) => {
        const xi = k / (nPoints - 1);
        return { xi, x: xi * element.L, u: field.u.at(xi), v: field.v.at(xi) };
    });
}