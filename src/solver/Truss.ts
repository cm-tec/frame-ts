

/*
The displacement field of a single truss is approximated by the following shape functions:

N_1 = 1-zeta/L 
N_2 = 1 - 3 (zeta/L)^2 + 2 (zeta/L)^3
N_3 = zeta (1-zeta/L)^2

N_4 = zeta/L
N_5 = 3 (zeta/L)^2 - 2 (zeta/L)^3
N_6 = zeta ((zeta/L)^2 - zeta/L)

*/

import { add, matrix, multiply } from "mathjs";


export function k_element(EA: number, EI: number, l: number) {
    const k_axial = multiply(EA / l, matrix(
        [
            [1, 0, 0, -1, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [-1, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ]
    ));

    const k_flexural = multiply(EI / l ** 3, matrix(
        [
            [0, 0, 0, 0, 0, 0],
            [0, 12, 6 * l, 0, -12, 6 * l],
            [0, 6 * l, 4 * l ** 2, 0, -6 * l, 2 * l ** 2],
            [0, 0, 0, 0, 0, 0],
            [0, -12, -6 * l, 0, 12, -6 * l],
            [0, 6 * l, 2 * l ** 2, 0, -6 * l, 4 * l ** 2],
        ]
    ));

    return add(k_axial, k_flexural);
}