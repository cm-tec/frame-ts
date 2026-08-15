import { expect, test } from "vitest";
import { Polynomial } from "./Polynomial";

const ACC = 12;

// Hermite cubic shape functions
const N_1 = new Polynomial([1, 0, -3, 2]);
const N_2 = new Polynomial([0, 1, -2, 1]);
const N_3 = new Polynomial([0, 0, 3, -2]);
const N_4 = new Polynomial([0, 0, -1, 1]);

test('at — evaluates by Horner', () => {
    const p = new Polynomial([3, 4]);

    expect(p.at(0)).toBeCloseTo(3, ACC);
    expect(p.at(0.5)).toBeCloseTo(5, ACC);
    expect(p.at(1)).toBeCloseTo(7, ACC);
});

test('trailing zeros are stripped', () => {
    expect(new Polynomial([3, 0, 0]).degree).toBe(0);
    expect(new Polynomial([0, 0]).isZero).toBe(true);
    expect(Polynomial.ZERO.degree).toBe(-1);
    expect(Polynomial.ZERO.at(0.7)).toBe(0);
});

test('linear — a trapezoidal load hits its ordinates at both ends', () => {
    const q = Polynomial.linear(5, 11);

    expect(q.at(0)).toBeCloseTo(5, ACC);
    expect(q.at(1)).toBeCloseTo(11, ACC);
    expect(q.at(0.5)).toBeCloseTo(8, ACC);
    expect(q.at(0.2)).toBeCloseTo(6.2, ACC);
});

test('plus — superposition of two loads on one element', () => {
    const sum = Polynomial.constant(3).plus(Polynomial.linear(0, 10));

    expect(sum.at(0)).toBeCloseTo(3, ACC);
    expect(sum.at(1)).toBeCloseTo(13, ACC);
});

test('times — (1 + xi)(1 - xi) = 1 - xi^2', () => {
    const product = new Polynomial([1, 1]).times(new Polynomial([1, -1]));

    expect(product.coeffs).toEqual([1, 0, -1]);
});

test('antiderivative — vanishes at node i and differentiates back', () => {
    const q = new Polynomial([3, 4]);
    const Q = q.antiderivative();

    expect(Q.coeffs).toEqual([0, 3, 2]);
    expect(Q.at(0)).toBe(0);
    expect(Q.at(1)).toBeCloseTo(5, ACC);
});

test('integral - total load of a trapezoid is the mean ordinate', () => {
    expect(Polynomial.constant(7).integral()).toBeCloseTo(7, ACC);
    expect(Polynomial.linear(4, 10).integral()).toBeCloseTo(7, ACC);
    expect(Polynomial.linear(0, 10).integral(0, 0.5)).toBeCloseTo(1.25, ACC);
});

test('degree grows as the chain q -> V -> M -> v is integrated', () => {
    const q = Polynomial.linear(3, 9);

    expect(q.degree).toBe(1);
    expect(q.antiderivative().degree).toBe(2);
    expect(q.antiderivative().antiderivative().degree).toBe(3);
});

test('shape function integrals reproduce the closed-form fixed-end forces', () => {
    const [q_i, q_j] = [13, 29];
    const q = Polynomial.linear(q_i, q_j);

    expect(q.times(N_1).integral()).toBeCloseTo((7 * q_i + 3 * q_j) / 20, ACC);
    expect(q.times(N_2).integral()).toBeCloseTo((3 * q_i + 2 * q_j) / 60, ACC);
    expect(q.times(N_3).integral()).toBeCloseTo((3 * q_i + 7 * q_j) / 20, ACC);
    expect(q.times(N_4).integral()).toBeCloseTo(-(2 * q_i + 3 * q_j) / 60, ACC);
});

test('shape function integrals stay exact for a quadratic load', () => {
    const q = new Polynomial([0, 0, 1]);

    expect(q.times(N_1).integral()).toBeCloseTo(1 / 15, ACC);
    expect(q.times(N_3).integral()).toBeCloseTo(4 / 15, ACC);
    expect(q.times(N_1).integral() + q.times(N_3).integral()).toBeCloseTo(1 / 3, ACC);
});
