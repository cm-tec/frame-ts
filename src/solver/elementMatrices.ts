import { det, index, inv, matrix, multiply, subset, subtract, zeros, type Matrix } from "mathjs";
import type { Releases } from "./StructuralSystem";
/*
    Closed-form element matrices for the two-node Euler-Bernoulli beam element, in the
    local DOF order [D1_i, D2_i, D3_i, D1_j, D2_j, D3_j].
*/






export function k_element(EA: number, EI: number, l: number): Matrix {
    return matrix([
        [ EA/l,  0,            0,           -EA/l,  0,            0          ],
        [ 0,     12*EI/l**3,   6*EI/l**2,    0,    -12*EI/l**3,   6*EI/l**2  ],
        [ 0,     6*EI/l**2,    4*EI/l,       0,    -6*EI/l**2,    2*EI/l     ],
        [-EA/l,  0,            0,            EA/l,  0,            0          ],
        [ 0,    -12*EI/l**3,  -6*EI/l**2,    0,     12*EI/l**3,  -6*EI/l**2  ],
        [ 0,     6*EI/l**2,    2*EI/l,       0,    -6*EI/l**2,    4*EI/l     ]
    ]);
}

export function c_element(c: number): Matrix {
    return matrix([
        [ c,  0,  0,  -c,  0,  0 ],
        [ 0,  0,  0,   0,  0,  0 ],
        [ 0,  0,  0,   0,  0,  0 ],
        [-c,  0,  0,   c,  0,  0 ],
        [ 0,  0,  0,   0,  0,  0 ],
        [ 0,  0,  0,   0,  0,  0 ]
    ]);
}


// Transformation from global to local element coordinates.
export function get_rotation_matrix_of_element(theta_element: number, angle_i: number, angle_j: number): Matrix {
    const b_i = theta_element - angle_i;
    const b_j = theta_element - angle_j;

    const ci = Math.cos(b_i), si = Math.sin(b_i);
    const cj = Math.cos(b_j), sj = Math.sin(b_j);

    return matrix([
        [ ci,  si,  0,   0,   0,  0],
        [-si,  ci,  0,   0,   0,  0],
        [  0,   0,  1,   0,   0,  0],
        [  0,   0,  0,  cj,  sj,  0],
        [  0,   0,  0, -sj,  cj,  0],
        [  0,   0,  0,   0,   0,  1]
    ]);
}

// Local DOF indices: D1_i=0, D2_i=1, D3_i=2, D1_j=3, D2_j=4, D3_j=5.
const LOCAL_DOFS = [0, 1, 2, 3, 4, 5];

/**
 * Condenses the released local DOFs out of `a`.
 *
 * `a` is the quantity being condensed - an element matrix (6x6) or a load vector (6x1) -
 * and `k` is the stiffness that couples the released DOFs to the kept ones (the element
 * matrix itself, when that is what is being condensed). Columns of `a` count as local
 * DOFs only when there are six of them, so a matrix is condensed on both axes while a
 * vector is condensed on its rows alone.
 *
 * The result keeps the full six rows with zeros in the cut positions, so it drops
 * straight into the assembly pipeline.
 */
export function condenseReleases(a: Matrix, k: Matrix, releases_i: Releases, releases_j: Releases): Matrix {
    const n_cols = a.size()[1];

    const all_i_released = releases_i.D1 && releases_i.D2 && releases_i.D3;
    const all_j_released = releases_j.D1 && releases_j.D2 && releases_j.D3;
    if (all_i_released || all_j_released) return matrix(zeros([LOCAL_DOFS.length, n_cols])) as Matrix;

    const released = [releases_i.D1, releases_i.D2, releases_i.D3, releases_j.D1, releases_j.D2, releases_j.D3];
    const cut = LOCAL_DOFS.filter(dof => released[dof]);

    if (cut.length === 0) return a;

    const keep = LOCAL_DOFS.filter(dof => !released[dof]);
    const cols = n_cols === LOCAL_DOFS.length ? keep : LOCAL_DOFS.slice(0, n_cols);

    const K_cc = subset(k, index(cut, cut)) as Matrix;
    const a_keep = subset(a, index(keep, cols)) as Matrix;

    let condensed: Matrix;

    if (Math.abs(det(K_cc)) < 1e-12) {
        // If the cut DOFs carry no stiffness of their own (like the bending rows of the
        // damping matrix), there is nothing to condense out; the kept block is the answer.
        condensed = a_keep;
    } else {
        const K_kc = subset(k, index(keep, cut)) as Matrix;
        const a_cut = subset(a, index(cut, cols)) as Matrix;

        condensed = subtract(a_keep, multiply(K_kc, multiply(inv(K_cc), a_cut))) as Matrix;
    }

    // Scatter back into the full shape, leaving zeros in the cut positions.
    const result = matrix(zeros([LOCAL_DOFS.length, n_cols])) as Matrix;
    keep.forEach((r, i) => cols.forEach((c, j) => result.set([r, c], condensed.get([i, j]))));

    return result;
}
