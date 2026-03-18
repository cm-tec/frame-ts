import { matrix, multiply, abs, subtract, subset, index, range, sum, eigs, complex, Matrix, equal, norm, divide } from 'mathjs';
import { getEigenvalues, getEigenvectors, isMultiple, merge } from './utils';
import { expect, test } from 'vitest';




test('isMultiple', () => {
    let m1 = matrix([[0]]);
    let m2 = matrix([[0, 0]]);

    expect(isMultiple(m1, m2)).toBe(false);

    m1 = matrix([[1, 0]]);
    m2 = matrix([[1, 0]]);

    expect(isMultiple(m1, m2)).toBe(true);

    m1 = matrix([[1, 0]]);
    m2 = matrix([[0, 0]]);

    expect(isMultiple(m1, m2)).toBe(false);
});


test('eigenvectors should satisfy the identity Av = λv', () => {
    // A simple symmetric matrix with known properties
    const A = matrix([[2, 0], [0, 5]]);

    const values = getEigenvalues(A);    // Expected [[2], [5]] or vice versa
    const vectors = getEigenvectors(A);  // Expected columns [[1,0], [0,1]]

    const dim = A.size()[0];

    for (let i = 0; i < dim; i++) {
        const lambda = values.get([i, 0]);
        // Extract column i
        const v = subset(vectors, index(range(0, dim), i));

        const LeftSide = multiply(A, v);
        const RightSide = multiply(lambda, v);

        // Difference should be near zero
        const diff = subtract(LeftSide, RightSide);
        // Sum of absolute differences
        const error = sum(abs(diff));

        expect(error).toBeLessThan(1e-10);
    }
});

test('merge', () => {
    let a11 = matrix([[0]]);
    let a12 = matrix([[1]]);
    let a21 = matrix([[2]]);
    let a22 = matrix([[3]]);

    let a = matrix([
        [0, 1],
        [2, 3]
    ])


    expect(merge(a11, a12, a21, a22)).toStrictEqual(a)
})


test('eigenvectors', () => {

    let m = matrix([
        [0.0, -1.0],
        [1.0, 0.0]
    ]);

    let eigen = eigs(m);
    let V = eigen.eigenvectors;

    expect(V.length).toBe(2);

    let e1 = V[0].value;
    let v1 = V[0].vector as Matrix;

    let e2 = V[1].value;
    let v2 = V[1].vector as Matrix;

    // Eigenvalue 1 should be equal to: e = i;
    expect(e1).toStrictEqual(complex(0, 1));
    // Eigenvector 1 should be a multiple of: v = [1, -i];
    expect(isMultiple(v1, matrix([complex(1, 0), complex(0, -1)]))).toBe(true);

    // Eigenvalue 2 should be equal to: e = -i;
    expect(e2).toStrictEqual(complex(0, -1));
    // Eigenvector 2 should be a multiple of: v = [1, i];
    expect(isMultiple(v2, matrix([complex(1, 0), complex(0, 1)]))).toBe(true);
})

test('getEigenvectors', () => {
    let m = matrix([
        [0.0, -1.0],
        [1.0, 0.0]
    ]);

    expect(getEigenvectors(m)).toStrictEqual(matrix([
        [complex(-1, 0), complex(-1, 0)],
        [complex(0, 1), complex(0, -1)]
    ]))
})


test('getEigenvalues', () => {
    let m = matrix([
        [0.0, -1.0],
        [1.0, 0.0]
    ]);

    expect(getEigenvalues(m)).toStrictEqual(matrix([
        [complex(0, 1)],
        [complex(0, -1)]
    ]))
})