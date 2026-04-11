import { concat, eigs, flatten, matrix, reshape, type Matrix } from "mathjs";


export function getEigenvectors(m: Matrix): Matrix {
    let ncols = m.size().at(1)!;

    let eigen = eigs(m).eigenvectors;

    let r = reshape(eigen.at(0)!.vector as Matrix, [ncols, 1]) as Matrix;

    for (let i = 1; i < ncols; i++) {
        r = concat(r, reshape(eigen.at(i)!.vector as Matrix, [ncols, 1])) as Matrix;
    }

    return r;
}


export function getEigenvalues(m: Matrix): Matrix {
    let nrows = m.size().at(0)!;

    let eigen = eigs(m).eigenvectors;

    const values = eigen.slice(0, nrows).map(e => e.value as number);
    return reshape(matrix(values), [nrows, 1]) as Matrix;
}


export function merge(a11: Matrix, a12: Matrix, a21: Matrix, a22: Matrix): Matrix {
    const top = concat(a11, a12, 1);
    const bottom = concat(a21, a22, 1);

    const total = concat(top, bottom, 0);
    // Vertical concatenation
    return total as Matrix;
}


function haveSameDimensions(m1: Matrix, m2: Matrix): boolean {
    const s1 = m1.size();
    const s2 = m2.size();

    return s1.length === s2.length && s1.every((val, i) => val === s2[i]);
}

export function isMultiple(m1: Matrix, m2: Matrix): boolean {
    if (!haveSameDimensions(m1, m2)) {
        return false;
    }

    const d1 = flatten(m1.toArray());
    const d2 = flatten(m2.toArray());

    let ratio: number | null = null;

    for (let i = 0; i < d1.length; i++) {
        const a = d1[i];
        const b = d2[i];

        // If both are zero, they are technically multiples at this position
        if (a === 0 && b === 0) continue;

        // If one is zero but the other isn't, they can't be multiples
        if (a === 0 || b === 0) return false;

        const currentRatio = (a as number) / (b as number);

        if (ratio === null) {
            ratio = currentRatio;
        } else {
            // Check for ratio consistency (with small epsilon for float safety)
            if (Math.abs(currentRatio - ratio) > 1e-12) {
                return false;
            }
        }
    }

    return true;
}