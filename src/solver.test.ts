/*

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


test('initial conditions', () => {
    // Initial conditions are [-1, 1, 0, 0]
    let ic = matrix([1, 0]);

    let vs = matrix([
        [1, 1],
        [complex(0, -1), complex(0, 1)]
    ])

    expect(solveInitalConditions(vs, ic)).toStrictEqual(matrix([[complex(0.5, 0)], [complex(0.5, 0)]]));

})


test('get w', () => {
    let t = 1;

    let eigenvalues = matrix(
        [1, 2, 3, 4]
    )

    let coefficients = matrix(
        [0, 1, 2, 3]
    )

    let e = eigenvalues.map((value, i) => {
        return exp(multiply(t, value));
    });

    let ec = dotMultiply(coefficients, e);

    //w = multiply(eigenvectors, ec);

    //console.log(e);
    //console.log(ec);
})



test('system', () => {
    let NDOF = 2;

    let m1 = 80.0;
    let m2 = 8.0;
    let k1 = 200.0;
    let k2 = 125.0;
    let c1 = 0.0;
    let c2 = 0.6;

    let m = matrix([
        [m1, 0],
        [0, m2]
    ]);

    let c = matrix([
        [c1, -c1],
        [-c1, c1 + c2]
    ]);

    let k = matrix([
        [k1, -k1],
        [-k1, k1 + k2]
    ])

    let initialConditions = matrix([
        [complex(-1, 0)],
        [complex(1, 0)],
        [0],
        [0]
    ]);




    let m_inv = inv(m);

    let a11 = zeros([NDOF, NDOF]);
    let a12 = identity(NDOF);
    let a21 = multiply(-1, multiply(m_inv, k));
    let a22 = multiply(-1, multiply(m_inv, c));

    let a = merge(a11, a12, a21, a22);



    let eigenVectors = getEigenvectors(a);
    let eigenValues = getEigenvalues(a);

    let coefficients = solveInitalConditions(eigenVectors, initialConditions);


    let w = get_ws(eigenVectors, eigenValues, coefficients);

    console.log(w);

})

*/

