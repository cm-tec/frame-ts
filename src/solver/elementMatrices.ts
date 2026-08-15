import { det, index, inv, matrix, multiply, subset, subtract, zeros, type Matrix } from "mathjs";
import type { Releases } from "./StructuralSystem";
/*
    Closed-form element matrices for the two-node Euler-Bernoulli beam element, in the
    local DOF order [u_i, v_i, theta_i, u_j, v_j, theta_j].
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

/**
 * Condenses the released local DOFs out of an element matrix.
 *
 * The result is returned as a full 6x6 with zeros in the cut positions, so it drops
 * straight into the assembly pipeline.
 */
export function applyStaticCondensation(k_elem: Matrix, releases_i: Releases, releases_j: Releases): Matrix {
    const all_i_released = releases_i.u && releases_i.v && releases_i.theta;
    const all_j_released = releases_j.u && releases_j.v && releases_j.theta;

    if (all_i_released || all_j_released) {
        return matrix(zeros([6, 6]));
    }


    // Array of local DOF indices to condense (0 to 5)
    // u_i=0, v_i=1, theta_i=2, u_j=3, v_j=4, theta_j=5
    const cutIdx: number[] = [];
    if (releases_i.u) cutIdx.push(0);
    if (releases_i.v) cutIdx.push(1);
    if (releases_i.theta) cutIdx.push(2);
    if (releases_j.u) cutIdx.push(3);
    if (releases_j.v) cutIdx.push(4);
    if (releases_j.theta) cutIdx.push(5);

    if (cutIdx.length === 0) return k_elem;


    const keepIdx = [0, 1, 2, 3, 4, 5].filter(idx => !cutIdx.includes(idx));

    // Split the element matrix into Sub-matrices
    const K_rr = subset(k_elem, index(keepIdx, keepIdx));
    const K_rc = subset(k_elem, index(keepIdx, cutIdx));
    const K_cr = subset(k_elem, index(cutIdx, keepIdx));
    const K_cc = subset(k_elem, index(cutIdx, cutIdx));

    let K_condensed: Matrix;

    if (Math.abs(det(K_cc)) < 1e-12) {
        // If the cut properties are already pure zero (like in the damping matrix),
        // there is nothing to condense out; K_rr is already the answer.
        K_condensed = K_rr;
    } else {
        K_condensed = subtract(K_rr, multiply(K_rc, multiply(inv(K_cc), K_cr)));
    }

    // Reconstruct a full 6x6 matrix with zeros in the cut positions
    // so it perfectly fits your existing assembly pipeline
    let k_final = matrix(zeros([6, 6]));
    keepIdx.forEach((r, i) => {
        keepIdx.forEach((c, j) => {
            k_final.set([r, c], K_condensed.get([i, j]));
        });
    });

    return k_final;
}
