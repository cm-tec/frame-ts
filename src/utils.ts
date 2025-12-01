import { concat, eigs, zeros, type Matrix } from "mathjs";


export function getEigenvectors(m: Matrix): Matrix {
    let ncols = m.size().at(1)!;

    let eigen = eigs(m).eigenvectors;

    let r = eigen.at(0)?.vector.reshape([ncols, 1]);

    for (let i = 1; i < ncols; i++) {
        r = concat(r, eigen.at(i)?.vector.reshape([ncols, 1]),);
    }

    return r;
}


export function getEigenvalues(m: Matrix): Matrix {
    let nrows = m.size().at(0)!;

    let eigen = eigs(m).eigenvectors;

    let r = zeros(nrows);

    return r.map((v, i) => {
        return eigen.at(i)?.value;
    }).reshape([nrows, 1])
}


export function merge(a11: Matrix, a12: Matrix, a21: Matrix, a22: Matrix): Matrix {
    const top = concat(a11, a12, 1);
    const bottom = concat(a21, a22, 1);

    const total = concat(top, bottom, 0);
    // Vertical concatenation
    return total as Matrix;
}

