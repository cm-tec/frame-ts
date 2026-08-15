// A polynomial in the element coordinate xi, 0 at node i to 1 at node j.
// coeffs[k] is the factor of xi^k, so [3, 4] is 3 + 4*xi.
export class Polynomial {
    readonly coeffs: readonly number[];

    constructor(coeffs: readonly number[]) {
        let last = coeffs.length;
        while (last > 0 && coeffs[last - 1] === 0) last--;

        this.coeffs = coeffs.slice(0, last);
    }

    static readonly ZERO = new Polynomial([]);

    static constant(q: number): Polynomial {
        return new Polynomial([q]);
    }

    static linear(q_i: number, q_j: number): Polynomial {
        return new Polynomial([q_i, q_j - q_i]);
    }

    get degree(): number {
        return this.coeffs.length - 1;
    }

    get isZero(): boolean {
        return this.coeffs.length === 0;
    }

    at(xi: number): number {
        let value = 0;
        for (let k = this.coeffs.length - 1; k >= 0; k--) {
            value = value * xi + this.coeffs[k];
        }
        return value;
    }

    plus(other: Polynomial): Polynomial {
        const n = Math.max(this.coeffs.length, other.coeffs.length);
        const sum = new Array<number>(n).fill(0);

        for (let k = 0; k < n; k++) {
            sum[k] = (this.coeffs[k] ?? 0) + (other.coeffs[k] ?? 0);
        }
        return new Polynomial(sum);
    }

    scaled(factor: number): Polynomial {
        return new Polynomial(this.coeffs.map(c => c * factor));
    }

    times(other: Polynomial): Polynomial {
        if (this.isZero || other.isZero) return Polynomial.ZERO;

        const product = new Array<number>(this.coeffs.length + other.coeffs.length - 1).fill(0);

        this.coeffs.forEach((a, i) => {
            other.coeffs.forEach((b, j) => {
                product[i + j] += a * b;
            });
        });
        return new Polynomial(product);
    }

    // Constant of integration is zero, so the result vanishes at node i.
    // Callers add the one they know: the end shear for V, the end moment for M.
    antiderivative(): Polynomial {
        const integrated = [0];
        this.coeffs.forEach((c, k) => integrated.push(c / (k + 1)));

        return new Polynomial(integrated);
    }

    integral(from: number = 0, to: number = 1): number {
        const F = this.antiderivative();
        return F.at(to) - F.at(from);
    }
}
