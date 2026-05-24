import unittest

import numpy as np

from element_test import create_element
from example_static_systems import (
    create_beam_on_two_supports_with_cantilever_arm,
    create_bernoulli_beam_with_area_load,
    create_cantilever_arm,
    create_cantilever_arm_with_diagonal_support,
    create_cantilever_arm_with_support,
    create_frame,
)
from helper_functions import (
    delete_columns_from_matrix,
    delete_rows_and_columns_from_matrix,
    delete_rows_from_matrix,
)
from models.design_parameter import DesignParameterElement
from models.response_variable import (
    ResponseVariableDisplacement,
    ResponseVariableInternalForce,
)
from static_system_solver import StaticSystemSolver

from numpy.testing import assert_array_equal, assert_allclose

from static_system import StaticSystem
from static_system_test import create_bernoulli_beam
from utilities import get_derived_k_global_of_element, get_k
from vector import vector


def assert_size_of_k_equal_essential_ndofs(static_system, essential_ndof):
    solver = StaticSystemSolver(static_system)

    assert_array_equal(
        np.shape(solver.get_k()),
        (essential_ndof, essential_ndof),
    )


class TestStaticSystemSolver(unittest.TestCase):

    def test_size_of_k_equal_reduced_ndofs(self):
        assert_size_of_k_equal_essential_ndofs(create_bernoulli_beam(), 9)

        assert_size_of_k_equal_essential_ndofs(
            create_beam_on_two_supports_with_cantilever_arm(), 9
        )

        assert_size_of_k_equal_essential_ndofs(create_frame(), 13)

        assert_size_of_k_equal_essential_ndofs(create_cantilever_arm_with_support(), 10)

    def test_get_k_of_static_system(self):
        static_system = create_bernoulli_beam()

        solver = StaticSystemSolver(static_system)

        # Create an empty 3x3 matrix
        k = np.zeros((9, 9))

        k_element = get_k()
        # Add elements from matrix k to result
        k[0:6, 0:6] += k_element
        k[3:9, 3:9] += k_element

        assert_array_equal(solver.get_k(), k)

        static_system = create_beam_on_two_supports_with_cantilever_arm(
            l=7, c=3, EA=13, EI=21
        )
        solver = StaticSystemSolver(static_system)

        # Create an empty 3x3 matrix
        k = np.zeros((9, 9))

        k_element_1 = get_k(l=7, EA=13, EI=21)
        k_element_2 = get_k(l=3, EA=13, EI=21)
        # Add elements from matrix k to result
        k[0:6, 0:6] += k_element_1
        k[3:9, 3:9] += k_element_2

        assert_array_equal(solver.get_k(), k)

    def test_get_non_restrained_k_of_static_system(self):
        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        k = np.zeros((9, 9))

        k_element = get_k()
        # Add elements from matrix k to result
        k[0:6, 0:6] += k_element
        k[3:9, 3:9] += k_element

        non_restrained_k = delete_rows_and_columns_from_matrix(
            k, indices_to_delete=[0, 1, 10 - 3]
        )
        assert_array_equal(solver.get_non_restrained_k(), non_restrained_k)

        static_system = create_beam_on_two_supports_with_cantilever_arm(
            l=7, c=3, EA=13, EI=21
        )
        solver = StaticSystemSolver(static_system)

        # Create an empty 3x3 matrix
        k = np.zeros((9, 9))

        k_element_1 = get_k(l=7, EA=13, EI=21)
        k_element_2 = get_k(l=3, EA=13, EI=21)
        # Add elements from matrix k to result
        k[0:6, 0:6] += k_element_1
        k[3:9, 3:9] += k_element_2

        non_restrained_k = delete_rows_and_columns_from_matrix(
            k, indices_to_delete=[0, 1, 4]
        )

        assert_array_equal(solver.get_non_restrained_k(), non_restrained_k)

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)

        k_element = get_k()

        k = np.array(
            [
                [4, 6, 0, 2, 0, 0, 0, 0, 0],
                [6, 13, 0, 6, -1, 0, 0, 0, 0],
                [0, 0, 13, -6, 0, -12, -6, 0, 0],
                [2, 6, -6, 8, 0, 6, 2, 0, 0],
                [0, -1, 0, 0, 13, 0, 0, 6, 6],
                [0, 0, -12, 6, 0, 13, 6, 0, 0],
                [0, 0, -6, 2, 0, 6, 4, 0, 0],
                [0, 0, 0, 0, 6, 0, 0, 4, 2],
                [0, 0, 0, 0, 6, 0, 0, 2, 4],
            ]
        )

        assert_array_equal(solver.get_non_restrained_k(), k)

    def test_get_mix_k_of_static_system(self):
        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        k = np.zeros((9, 9))

        k_element = get_k()
        # Add elements from matrix k to result
        k[0:6, 0:6] += k_element
        k[3:9, 3:9] += k_element

        mix_k = delete_columns_from_matrix(k, indices_to_delete=[0, 1, 10 - 3])
        mix_k = delete_rows_from_matrix(mix_k, indices_to_delete=[2, 3, 4, 5, 6, 8])

        assert_array_equal(solver.get_mix_k(), mix_k)

    def test_get_force_vector(self):
        static_system = create_bernoulli_beam()

        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(9)
        force_vector[4] = 2

        assert_array_equal(solver.get_force_vector(), force_vector)

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(9)
        force_vector[7] = 1

        assert_array_equal(solver.get_force_vector(), force_vector)

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(13)
        force_vector[3] = 1
        force_vector[4] = 1

        assert_array_equal(solver.get_force_vector(), force_vector)

    def test_get_non_restrained_force_vector(self):
        static_system = create_bernoulli_beam()

        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(9)
        force_vector[4] = 2

        non_restrained_force_vector = np.delete(force_vector, [0, 1, 10 - 3])

        assert_array_equal(
            solver.get_non_restrained_force_vector(), non_restrained_force_vector
        )

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(9)
        force_vector[7] = 1

        non_restrained_force_vector = np.delete(force_vector, [0, 1, 4])

        assert_array_equal(
            solver.get_non_restrained_force_vector(), non_restrained_force_vector
        )

    def test_get_displacements(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        u = np.zeros(6)
        u[2] = -1 / 24
        u[5] = 1 / 24

        assert_allclose(solver.get_displacements(), u, rtol=1e-5, atol=1e-5)

        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        u = np.zeros(9)
        u[2] = -0.5
        u[4] = 0.33333
        u[8] = 0.5

        assert_allclose(solver.get_displacements(), u, rtol=1e-5, atol=1e-5)

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        u = (2 / 3 + 1 / 2 - 1 / 6) * 1 / 1

        self.assertAlmostEqual(solver.get_displacements()[-2], u)

        u = [
            0,
            0,
            -1.833333333,
            1.666666667,
            0,
            -1.333333333,
            1.666666667,
            1,
            -0.833333333,
            -1.666666667,
            0,
            0,
            -1.666666667,
        ]

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)
        assert_allclose(solver.get_displacements(), u, rtol=1e-5, atol=1e-5)

        static_system = create_cantilever_arm_with_support(q_z=1)
        solver = StaticSystemSolver(static_system)

        u = [
            0,
            0,
            0,
            0,
            3 / 32,
            -23 / 192,
            0,
            0,
            0,
            0,
        ]

        assert_allclose(solver.get_displacements(), u, rtol=1e-5, atol=1e-5)

    def test_get_external_forces(self):
        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        S = np.zeros(9)
        S[1] = -1
        S[7] = -1

        assert_allclose(solver.get_external_forces(), S, rtol=1e-5, atol=1e-5)

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        S = np.zeros(9)
        S[1] = 1 / 2
        S[4] = -(1 + 1 / 2) * 1

        assert_allclose(solver.get_external_forces(), S, rtol=1e-5, atol=1e-5)

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)

        S = [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0]

        assert_allclose(solver.get_external_forces(), S, rtol=1e-5, atol=1e-5)

        static_system = create_cantilever_arm_with_support(q_z=1)
        solver = StaticSystemSolver(static_system)

        self.assertAlmostEqual(solver.get_external_forces()[2], 13 / 32)

    def test_get_internal_forces_of_element(self):
        static_system = create_bernoulli_beam_with_area_load()
        solver = StaticSystemSolver(static_system)

        S = vector(0, 0.5, 0, 0, -0.5, 0)
        assert_allclose(
            solver.get_internal_forces_of_element(id=1), S, rtol=1e-5, atol=1e-5
        )

        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        S = vector(0, 1, 0, 0, 1, 1)
        assert_allclose(
            solver.get_internal_forces_of_element(id=1), S, rtol=1e-5, atol=1e-5
        )

        S = vector(0, -1, 1, 0, -1, 0)
        assert_allclose(
            solver.get_internal_forces_of_element(id=2), S, rtol=1e-5, atol=1e-5
        )

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        S = vector(0, -1 / 2, 0, 0, -1 / 2, -1)
        assert_allclose(
            solver.get_internal_forces_of_element(id=1), S, rtol=1e-5, atol=1e-5
        )

        S = vector(0, 1, -1, 0, 1, 0)
        assert_allclose(
            solver.get_internal_forces_of_element(id=2), S, rtol=1e-5, atol=1e-5
        )

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)

        S = [0, 1, 0, 0, 1, 1]
        assert_allclose(
            solver.get_internal_forces_of_element(id=1), S, rtol=1e-5, atol=1e-5
        )

        S = [0, -1, 1, 0, -1, 0]
        assert_allclose(
            solver.get_internal_forces_of_element(id=2), S, rtol=1e-5, atol=1e-5
        )

        S = [-1, 0, 0, -1, 0, 0]
        assert_allclose(
            solver.get_internal_forces_of_element(id=3), S, rtol=1e-5, atol=1e-5
        )

    def test_get_derived_k(self):
        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        dx = "l"
        # Create an empty 3x3 matrix
        k = np.zeros((9, 9))

        e = create_element()

        # Add elements from matrix k to result
        k[0:6, 0:6] += get_derived_k_global_of_element(e, dx=dx)

        assert_array_equal(solver.get_derived_k(param_id=1, dx=dx), k)

        static_system = create_beam_on_two_supports_with_cantilever_arm(
            l=7, c=3, EA=13, EI=21
        )
        solver = StaticSystemSolver(static_system)
        dx = "EI"

        # Create an empty 3x3 matrix
        k = np.zeros((9, 9))

        e = create_element(p_i=vector(0, 0), p_k=vector(3, 0), EA=13, EI=21)
        # Add elements from matrix k to result
        k[3:9, 3:9] += get_derived_k_global_of_element(e, dx=dx)

        assert_array_equal(solver.get_derived_k(param_id=2, dx=dx), k)

    def test_get_derived_force_vector(self):
        static_system = create_bernoulli_beam_with_area_load()

        solver = StaticSystemSolver(static_system)

        force_vector = vector(
            0,
            1 / 2,
            -1 / 6,
            0,
            1 / 2,
            1 / 6,
        )

        assert_allclose(
            solver.get_derived_force_vector(param_id=1, dx="l"),
            force_vector,
            rtol=1e-5,
            atol=1e-5,
        )

        static_system = create_bernoulli_beam()

        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(9)
        assert_array_equal(
            solver.get_derived_force_vector(param_id=2, dx="EA"), force_vector
        )

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(9)
        assert_array_equal(
            solver.get_derived_force_vector(param_id=1, dx="EI"), force_vector
        )

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(13)
        assert_array_equal(
            solver.get_derived_force_vector(param_id=1, dx="l"), force_vector
        )

    def test_get_derived_restrained_force_vector(self):
        static_system = create_bernoulli_beam_with_area_load()

        solver = StaticSystemSolver(static_system)

        force_vector = vector(
            0,
            1 / 2,
            1 / 2,
        )

        assert_allclose(
            solver.get_derived_restrained_force_vector(id=1, dx="l"),
            force_vector,
            rtol=1e-5,
            atol=1e-5,
        )

    def test_get_derived_non_restrained_k_of_static_sytem(self):
        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        dx = "l"
        # Create an empty 3x3 matrix
        k = np.zeros((9, 9))

        e = create_element()

        # Add elements from matrix k to result
        k[0:6, 0:6] += get_derived_k_global_of_element(e, dx=dx)

        non_restrained_k = delete_rows_and_columns_from_matrix(
            k, indices_to_delete=[0, 1, 10 - 3]
        )
        assert_array_equal(
            solver.get_derived_non_restrained_k(id=1, dx=dx),
            non_restrained_k,
        )

        static_system = create_beam_on_two_supports_with_cantilever_arm(
            l=7, c=3, EA=13, EI=21
        )
        solver = StaticSystemSolver(static_system)
        dx = "EI"

        # Create an empty 3x3 matrix
        k = np.zeros((9, 9))

        e = create_element(p_i=vector(0, 0), p_k=vector(3, 0), EA=13, EI=21)

        # Add elements from matrix k to result
        k[3:9, 3:9] += get_derived_k_global_of_element(e, dx=dx)
        non_restrained_k = delete_rows_and_columns_from_matrix(
            k, indices_to_delete=[0, 1, 4]
        )
        assert_array_equal(
            solver.get_derived_non_restrained_k(id=2, dx=dx),
            non_restrained_k,
        )

    def test_get_derived_mix_k_of_static_sytem(self):
        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        dx = "l"
        # Create an empty 3x3 matrix
        k = np.zeros((9, 9))

        e = create_element()

        # Add elements from matrix k to result
        k[0:6, 0:6] += get_derived_k_global_of_element(e, dx=dx)

        mix_k = delete_columns_from_matrix(k, indices_to_delete=[0, 1, 10 - 3])
        mix_k = delete_rows_from_matrix(mix_k, indices_to_delete=[2, 3, 4, 5, 6, 8])

        assert_array_equal(
            solver.get_derived_mix_k(id=1, dx=dx),
            mix_k,
        )

    def test_get_derived_non_restrained_force_vector(self):
        static_system = create_bernoulli_beam_with_area_load()
        solver = StaticSystemSolver(static_system)

        force_vector = vector(
            -1 / 6,
            0,
            1 / 6,
        )

        assert_allclose(
            solver.get_derived_non_restrained_force_vector(id=1, dx="l"),
            force_vector,
            rtol=1e-5,
            atol=1e-5,
        )

        static_system = create_bernoulli_beam()

        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(6)
        assert_array_equal(
            solver.get_derived_non_restrained_force_vector(id=2, dx="EA"),
            force_vector,
        )

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(6)
        assert_array_equal(
            solver.get_derived_non_restrained_force_vector(id=1, dx="EI"),
            force_vector,
        )

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(9)
        assert_array_equal(
            solver.get_derived_non_restrained_force_vector(id=1, dx="l"),
            force_vector,
        )

        static_system = create_cantilever_arm_with_support(q_z=1)
        solver = StaticSystemSolver(static_system)

        force_vector = np.zeros(5)
        force_vector[1] = 1 / 2
        force_vector[2] = 1 / 6

        assert_allclose(
            solver.get_derived_non_restrained_force_vector(id=1, dx="l"),
            force_vector,
            rtol=1e-5,
            atol=1e-5,
        )

    def test_get_derived_non_restrained_displacements(self):
        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        self.assertAlmostEqual(
            solver.get_derived_non_restrained_displacements(id=1, dx="EA")[2], 0
        )

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        derived_u = (1 / 3) * 1 / 1
        self.assertAlmostEqual(
            solver.get_derived_non_restrained_displacements(id=1, dx="l")[-2],
            derived_u,
            places=4,
        )

        derived_u = 4 / 3 + 3 / 2 - 3 / 6
        self.assertAlmostEqual(
            solver.get_derived_non_restrained_displacements(id=2, dx="l")[-2],
            derived_u,
            places=2,
        )

        derived_u = 4 / 3 + 3 / 2 - 3 / 6
        self.assertAlmostEqual(
            solver.get_derived_non_restrained_displacements(id=2, dx="EA")[-2], 0
        )

    def test_get_derived_displacements(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        u = np.zeros(6)
        u[2] = -3 / 24
        u[5] = 3 / 24

        id = 1
        dx = "l"

        assert_allclose(
            solver.get_derived_displacements(id=id, dx=dx),
            u,
            rtol=1e-5,
            atol=1e-5,
        )

        static_system = create_bernoulli_beam()
        solver = StaticSystemSolver(static_system)

        self.assertAlmostEqual(solver.get_derived_displacements(id=1, dx="EA")[4], 0)

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        solver = StaticSystemSolver(static_system)

        derived_u = (1 / 3) * 1 / 1
        self.assertAlmostEqual(
            solver.get_derived_displacements(id=1, dx="l")[-2], derived_u, places=4
        )

        derived_u = 4 / 3 + 3 / 2 - 3 / 6
        self.assertAlmostEqual(
            solver.get_derived_displacements(id=2, dx="l")[-2], derived_u, places=2
        )

        derived_u = 4 / 3 + 3 / 2 - 3 / 6
        self.assertAlmostEqual(solver.get_derived_displacements(id=2, dx="EA")[-2], 0)

        static_system = create_cantilever_arm_with_support(q_z=1)
        solver = StaticSystemSolver(static_system)

        id = 1
        dx = "EA"

        derived_u = [
            0,
            0,
            0,
            0,
            39 / 128,
            -65 / 256,
            0,
            0,
            0,
            0,
        ]

        derived_u = np.zeros(10)

        assert_allclose(
            solver.get_derived_displacements(id=id, dx=dx),
            derived_u,
            rtol=1e-5,
            atol=1e-5,
        )

        id = 2
        dx = "EI"

        derived_u = np.zeros(10)

        assert_allclose(
            solver.get_derived_displacements(id=id, dx=dx),
            derived_u,
            rtol=1e-5,
            atol=1e-5,
        )

        id = 1
        dx = "l"

        derived_u = np.zeros(10)
        derived_u[4] = 39 / 128
        derived_u[5] = -65 / 256

        assert_allclose(
            solver.get_derived_displacements(id=id, dx=dx),
            derived_u,
            rtol=1e-5,
            atol=1e-5,
        )

    def test_get_derived_restrained_external_forces(self):

        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        id = 1
        dx = "l"

        external_forces_sensa = vector(0, -1 / 2, -1 / 2)

        assert_allclose(
            solver.get_derived_restrained_external_forces(id=id, dx=dx),
            external_forces_sensa,
            rtol=1e-5,
            atol=1e-5,
        )

        static_system = create_cantilever_arm_with_support(q_z=1)
        solver = StaticSystemSolver(static_system)

        id = 1
        dx = "l"

        derived_m_y_i = 77 / 128

        self.assertAlmostEqual(
            solver.get_derived_restrained_external_forces(id=id, dx=dx)[2],
            derived_m_y_i,
            places=4,
        )

        id = 2
        dx = "EA"

        derived_m_y_i = -9 / 128

        self.assertAlmostEqual(
            solver.get_derived_restrained_external_forces(id=id, dx=dx)[2],
            derived_m_y_i,
            places=4,
        )

    def test_get_f_star(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        id = 1
        dx = "l"

        f_star = solver.get_derived_force_vector(
            param_id=id, dx=dx
        ) - solver.get_derived_k(param_id=id, dx=dx).dot(solver.get_displacements())

        assert_allclose(
            solver.get_f_star(param_id=id, dx=dx),
            f_star,
            rtol=1e-5,
            atol=1e-5,
        )

    def test_size_of_to_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        to_restrained = np.array(
            [
                [1, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 0, 0],
                [0, 0, 0, 1, 0, 0],
            ]
        )

        self.assertEqual(np.shape(solver.get_to_restrained()), np.shape(to_restrained))

    def test_get_to_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        to_restrained = np.array(
            [
                [1, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 1, 0],
            ]
        )

        assert_array_equal(solver.get_to_restrained(), to_restrained)

    def test_to_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        u = np.zeros(3)

        assert_allclose(
            solver.get_to_restrained().dot(solver.get_displacements()),
            u,
            rtol=1e-5,
            atol=1e-5,
        )

    def test_size_of_to_non_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        to_non_restrained = np.array(
            [
                [0, 0, 1, 0, 0, 0],
                [0, 0, 0, 1, 0, 0],
                [0, 0, 0, 0, 0, 1],
            ]
        )

        self.assertEqual(
            np.shape(solver.get_to_non_restrained()), np.shape(to_non_restrained)
        )

    def test_to_non_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        u = np.zeros(3)
        u[0] = -1 / 24
        u[2] = 1 / 24

        assert_allclose(
            solver.get_to_non_restrained().dot(solver.get_displacements()),
            u,
            rtol=1e-5,
            atol=1e-5,
        )

    def test_get_to_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        to_non_restrained = np.array(
            [
                [0, 0, 1, 0, 0, 0],
                [0, 0, 0, 1, 0, 0],
                [0, 0, 0, 0, 0, 1],
            ]
        )

        assert_array_equal(solver.get_to_non_restrained(), to_non_restrained)

    def test_size_of_to_element(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        id = 1

        self.assertEqual(np.shape(solver.get_to_element(id=id)), (6, 6))

    def test_get_to_element(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        to_element = np.eye(6)
        id = 1

        assert_array_equal(solver.get_to_element(id=id), to_element)

        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        to_element = np.eye(6)
        id = 1

        assert_array_equal(solver.get_to_element(id=id), to_element)

    def test_get_derived_internal_forces_of_element(self):
        with self.subTest("Bernoulli beam with area load"):
            static_system = create_bernoulli_beam_with_area_load(q_z=1)
            solver = StaticSystemSolver(static_system)

            id = 1
            dx = "l"

            external_forces_sensa = vector(0, 1 / 2, 0, 0, -1 / 2, 0)

            assert_allclose(
                solver.get_derived_internal_forces_of_element(
                    id=id, param_id=id, dx=dx
                ),
                external_forces_sensa,
                rtol=1e-5,
                atol=1e-5,
            )

        with self.subTest("Cantilever arm with diagonal support"):
            static_system = create_cantilever_arm_with_diagonal_support(q_z=1)
            solver = StaticSystemSolver(static_system)

            id = 2
            param_id = 1
            dx = "q_z"

            external_forces_sensa = vector(0, 0, 0, 0)

            result = solver.get_derived_internal_forces_of_element(
                id=id, param_id=param_id, dx=dx
            )

            assert_allclose(
                [value for i, value in enumerate(result) if i not in (0, 3)],
                external_forces_sensa,
                rtol=1e-5,
                atol=1e-5,
            )

    def test_size_of_expand_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        self.assertEqual(np.shape(solver.get_expand_restrained()), (6, 3))

    def test_get_expand_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        extend_restrained = np.array(
            [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 1],
                [0, 0, 0],
            ]
        )

        assert_array_equal(solver.get_expand_restrained(), extend_restrained)

    def test_size_of_expand_non_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        self.assertEqual(np.shape(solver.get_expand_non_restrained()), (6, 3))

    def test_get_expand_non_restrained(self):
        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        expand_non_restrained = np.array(
            [
                [0, 0, 0],
                [0, 0, 0],
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 0],
                [0, 0, 1],
            ]
        )

        assert_array_equal(solver.get_expand_non_restrained(), expand_non_restrained)

    def test_get_displacements_of_element(self):
        u = [
            0,
            0,
            -1.833333333,
            1.666666667,
            0,
            -1.333333333,
        ]

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)
        assert_allclose(solver.get_displacements_of_element(1), u, rtol=1e-5, atol=1e-5)

    def test_get_local_displacements_of_element(self):
        u = [
            0,
            0,
            -1.833333333,
            0,
            1.666666667,
            -1.333333333,
        ]

        static_system = create_frame()
        solver = StaticSystemSolver(static_system)
        assert_allclose(
            solver.get_local_displacements_of_element(1), u, rtol=1e-5, atol=1e-5
        )

    def test_get_adjoint_sensa(self):
        # Bernoulli beam

        static_system = create_bernoulli_beam_with_area_load(q_z=1)
        solver = StaticSystemSolver(static_system)

        result = solver.get_adjoint_sensa(
            id=1, response_parameter=ResponseVariableDisplacement.PHI_I
        )

        # phi_i_1
        self.assertAlmostEqual(result[1]["l"], -1 / 8)
        self.assertAlmostEqual(result[1]["EA"], 0)
        self.assertAlmostEqual(result[1]["EI"], 1 / 24)
        self.assertAlmostEqual(result[1]["q_x"], 0)
        self.assertAlmostEqual(result[1]["q_z"], -1 / 24)

        result = solver.get_adjoint_sensa(
            id=1, response_parameter=ResponseVariableDisplacement.W_I
        )

        # w_i_1
        self.assertAlmostEqual(result[1]["l"], 0)
        self.assertAlmostEqual(result[1]["EA"], 0)
        self.assertAlmostEqual(result[1]["EI"], 0)
        self.assertAlmostEqual(result[1]["q_x"], 0)
        self.assertAlmostEqual(result[1]["q_z"], 0)

        result = solver.get_adjoint_sensa(
            id=1, response_parameter=ResponseVariableDisplacement.W_K
        )
        # w_k_1
        self.assertAlmostEqual(result[1]["l"], 0)
        self.assertAlmostEqual(result[1]["EA"], 0)
        self.assertAlmostEqual(result[1]["EI"], 0)
        self.assertAlmostEqual(result[1]["q_x"], 0)
        self.assertAlmostEqual(result[1]["q_z"], 0)

        static_system = create_cantilever_arm(q_z=1)
        solver = StaticSystemSolver(static_system)

        result = solver.get_adjoint_sensa(
            id=1, response_parameter=ResponseVariableDisplacement.W_K
        )

        # w_k_1
        self.assertAlmostEqual(result[1]["l"], 1 / 2)
        self.assertAlmostEqual(result[1]["EA"], 0)
        self.assertAlmostEqual(result[1]["EI"], -1 / 8)
        self.assertAlmostEqual(result[1]["q_x"], 0)
        self.assertAlmostEqual(result[1]["q_z"], 1 / 8)

        # Beam on two supports with cantilever arm continous load

        static_system = create_beam_on_two_supports_with_cantilever_arm(
            F_right=0, q_z_1=1, q_z_2=1
        )
        solver = StaticSystemSolver(static_system)

        result = solver.get_adjoint_sensa(
            id=2, response_parameter=ResponseVariableDisplacement.W_K
        )
        # w_k_2
        self.assertAlmostEqual(result[1]["l"], -1 / 3)
        self.assertAlmostEqual(result[2]["l"], 7 / 6)

        # Beam on two supports with cantilever arm load only on left bar

        static_system = create_beam_on_two_supports_with_cantilever_arm(
            F_right=0, q_z_1=1
        )
        solver = StaticSystemSolver(static_system)

        result = solver.get_adjoint_sensa(
            id=2, response_parameter=ResponseVariableDisplacement.W_K
        )
        # w_k_2
        self.assertAlmostEqual(result[1]["q_z"], -1 / 3)
        self.assertAlmostEqual(result[1]["l"], -1 / 2)
        self.assertAlmostEqual(result[2]["l"], -1 / 3)

        # Internal Forces

        # Bernoulli beam

        static_system = create_bernoulli_beam_with_area_load(q_z=7)
        solver = StaticSystemSolver(static_system)

        result = solver.get_adjoint_sensa(
            id=1, response_parameter=ResponseVariableInternalForce.V_K
        )

        # phi_i_1
        self.assertAlmostEqual(result[1]["q_z"], -1 / 2)
        self.assertAlmostEqual(result[1]["l"], -7 / 2)

    def test_get_direct_sensa(self):
        with self.subTest("Bernoulli beam with area load"):
            static_system = create_bernoulli_beam_with_area_load(q_z=1)
            solver = StaticSystemSolver(static_system)

            internal_forces_sensa = vector(0, 1 / 2, 0, 0, -1 / 2, 0)

            assert_allclose(
                solver.get_direct_sensa(
                    id=1, design_parameter=DesignParameterElement.LENGTH
                )[1],
                internal_forces_sensa,
                rtol=1e-5,
                atol=1e-5,
            )

        with self.subTest("Cantilever arm with diagonal support"):
            static_system = create_cantilever_arm_with_diagonal_support(q_z=1)
            solver = StaticSystemSolver(static_system)

            internal_forces_sensa = vector(0, 0, 0, 0)

            result = solver.get_direct_sensa(
                id=1, design_parameter=DesignParameterElement.QZ
            )

            assert_allclose(
                [value for i, value in enumerate(result[2]) if i not in (0, 3)],
                internal_forces_sensa,
                rtol=1e-5,
                atol=1e-5,
            )
