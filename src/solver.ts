import { create, all, matrix, Matrix, inv, zeros, multiply, concat, eigs, lusolve, complex, exp, transpose } from "mathjs";


function nrows(m: Matrix): number {
    return m.size()[0];
}

// ---------- React Component ----------
function staticall_determinate(m: Matrix): number {
    return nrows(m); // TODO!!!
}

export function merge(a11: Matrix, a12: Matrix, a21: Matrix, a22: Matrix): Matrix {
    const top = concat(a11, a12, 1);
    const bottom = concat(a21, a22, 1);

    const total = concat(top, bottom, 0);
    // Vertical concatenation
    return total;
}


function get_u() {
    const NDOF = 1;

    const k = matrix([[1]]);

    const m = matrix([[1]]);

    const c = matrix([[1]]);

    let sd = 1; // statically_determinate(k);

    let m_inv = inv(m);


    let a11 = matrix(zeros(NDOF, NDOF));
    let a12 = matrix(zeros(NDOF, NDOF));
    let a21 = multiply(-m_inv, k);
    let a22 = multiply(-m_inv, c);

    let a = merge(a11, a12, a21, a22);

    let ans = eigs(a);
    const E = ans.eigenvectors.map(ev => ev.value);
    const vectors = ans.eigenvectors.map(ev => ev.vector); // array of columns
    const V = matrix(vectors[0].map((_, rowIndex) => vectors.map(col => col[rowIndex])));

    const initial_conditions = matrix([
        [complex(1, 0)],
    ]);

    const coefficients = lusolve(V, initial_conditions);



    const t_vec = Array.from({ length: 1000 }, (_, i) => 0.1 * i);

    // array to store real part of first DOF
    const z_real: number[] = [];

    for (const t of t_vec) {
        // e^(lambda_i * t) * coefficient_i
        const e_lambda_t = matrix(
            E.map((lambda, i) => multiply(coefficients[i], exp(multiply(lambda, t))))
        );



        // z = V^T * e_lambda_t
        const z = multiply(transpose(V), e_lambda_t);

        // store real part of first DOF
        z_real.push(z.get([0]).re); // assuming z is mathjs matrix of Complex
    }

    console.log(z_real);
}
