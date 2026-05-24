import unittest

import numpy as np

from element import Element
from element_test import create_element
from example_static_systems import (
    create_beam_on_two_supports_with_cantilever_arm,
    create_bernoulli_beam,
)
from node import Node
from static_system import (
    BoundaryDoFsMustBeSubsetOfDoFs,
    BoundaryDoFsMustNotBeEqual,
    RestrainedDoFsMustBeSubsetOfDoFs,
    StaticSystem,
)
from vector import vector

from numpy.testing import assert_array_equal


def contains_duplicates(list):
    return len(list) != len(set(list))


class TestStaticSystem(unittest.TestCase):

    def test_elements_equality(self):
        system1 = StaticSystem()
        system2 = StaticSystem()
        system1.elements = [1, 2, 3]
        system2.elements = [1, 2, 3]
        self.assertEqual(system1, system2)

    def test_restrained_dofs_equality(self):
        system1 = StaticSystem()
        system2 = StaticSystem()
        system1.restrained_dofs = {1, 2}
        system2.restrained_dofs = {1, 2}
        self.assertEqual(system1, system2)

    def test_boundary_conditions_equality(self):
        system1 = StaticSystem()
        system2 = StaticSystem()
        system1.boundary_conditions = {"a": 1, "b": 2}
        system2.boundary_conditions = {"a": 1, "b": 2}
        self.assertEqual(system1, system2)

    def test_elements_inequality(self):
        system1 = StaticSystem()
        system2 = StaticSystem()
        system1.elements = [1, 2, 3]
        system2.elements = [4, 5, 6]
        self.assertNotEqual(system1, system2)

    def test_restrained_dofs_inequality(self):
        system1 = StaticSystem()
        system2 = StaticSystem()
        system1.restrained_dofs = {1, 2}
        system2.restrained_dofs = {3, 4}
        self.assertNotEqual(system1, system2)

    def test_boundary_conditions_inequality(self):
        system1 = StaticSystem()
        system2 = StaticSystem()
        system1.boundary_conditions = {"a": 1, "b": 2}
        system2.boundary_conditions = {"c": 3, "d": 4}
        self.assertNotEqual(system1, system2)

    def create_elements(self, static_system, n=10):
        for i in range(0, n):
            static_system.create_element(
                p_i=vector(i, 0),
                p_k=vector(i + 1, 0),
                f_z_i=1,
            )

    def create_basic_static_system(self, n=10):
        static_system = StaticSystem()

        self.create_elements(static_system, n=n)

        return static_system

    def test_create_element(self):
        static_system = self.create_basic_static_system()

        for i, e in enumerate(static_system.get_elements()):
            self.assertEqual(
                e,
                create_element(
                    p_i=vector(i, 0),
                    p_k=vector(i + 1, 0),
                    f_z_i=1,
                ),
            )

        static_system.create_element(
            p_i=vector(10, 0),
            p_k=vector(11, 0),
            EA=7,
            EI=13,
            f_x_i=2,
            f_z_i=7,
            m_y_i=9,
            f_x_k=13,
            f_z_k=21,
            m_y_k=37,
            q_x=23,
            q_z=-2,
        )

        e = static_system.get_elements()[-1]
        self.assertEqual(
            e,
            create_element(
                p_i=vector(10, 0),
                p_k=vector(11, 0),
                EA=7,
                EI=13,
                f_x_i=2,
                f_z_i=7,
                m_y_i=9,
                f_x_k=13,
                f_z_k=21,
                m_y_k=37,
                q_x=23,
                q_z=-2,
            ),
        )

    def test_get_elements(self):
        static_system = StaticSystem()

        assert_array_equal(static_system.get_elements(), vector())

    def test_get_element(self):
        static_system = self.create_basic_static_system()

        self.assertEqual(
            static_system.get_element(id=5),
            create_element(p_i=(4, 0), p_k=(5, 0), f_z_i=1),
        )

    def test_create_element_at_specific_index(self):
        static_system = self.create_basic_static_system()

        static_system.create_element(p_i=vector(5, 0), p_k=vector(5, 2), at_index=5)

        for i, e in enumerate(static_system.get_elements()):
            j = i

            if i == 5:
                assert_array_equal(e.p_i, vector(5, 0))
                assert_array_equal(e.p_k, vector(5, 2))
                return
            elif i > 5:
                j += 1

            assert_array_equal(e.p_i, vector(j, 0))
            assert_array_equal(e.p_k, vector(j + 1, 0))

    def test_delete_element(self):
        static_system = self.create_basic_static_system()

        static_system.delete_element(5)

        for i, e in enumerate(static_system.get_elements()):

            if i > 3:
                j = i + 1
            else:
                j = i

            assert_array_equal(e.p_i, vector(j, 0))
            assert_array_equal(e.p_k, vector(j + 1, 0))

    def test_update_element(self):
        static_system = self.create_basic_static_system()

        static_system.update_element(
            id=6,
            p_i=vector(5, 0),
            p_k=vector(5, 2),
            EA=7,
            EI=13,
        )

        for i, e in enumerate(static_system.get_elements()):
            if i == 5:
                self.assertEqual(
                    e,
                    create_element(
                        p_i=vector(5, 0),
                        p_k=vector(5, 2),
                        EA=7,
                        EI=13,
                        f_z_i=1,
                    ),
                )
                return

            self.assertEqual(
                e,
                create_element(
                    p_i=vector(i, 0),
                    p_k=vector(i + 1, 0),
                    f_z_i=1,
                ),
            )

    def test_get_dofs(self):
        static_system = self.create_basic_static_system(n=1)

        assert_array_equal(static_system.get_dofs(), vector(1, 2, 3, 4, 5, 6))

    def test_get_restrained_dofs(self):
        static_system = self.create_basic_static_system(n=2)

        assert_array_equal(static_system.get_restrained_dofs(), vector())

    def test_set_restrained_dof(self):
        static_system = self.create_basic_static_system(n=2)

        static_system.set_restrained_dof(1)
        static_system.set_restrained_dof(5)

        assert_array_equal(static_system.get_restrained_dofs(), vector(1, 5))

        static_system = self.create_basic_static_system(n=2)

        static_system.set_restrained_dof(5)
        static_system.set_restrained_dof(1)
        static_system.set_restrained_dof(3)
        static_system.set_restrained_dof(6)
        static_system.set_restrained_dof(2)

        assert_array_equal(static_system.get_restrained_dofs(), vector(1, 2, 3, 5, 6))

    def test_restrained_dofs_are_adjoint_when_creating_element(self):
        static_system = self.create_basic_static_system(n=2)

        static_system.set_restrained_dof(5)
        static_system.set_restrained_dof(6)
        static_system.set_restrained_dof(7)
        static_system.set_restrained_dof(11)
        static_system.set_restrained_dof(12)

        static_system.create_element(p_i=vector(5, 0), p_k=vector(5, 2), at_index=1)

        assert_array_equal(
            static_system.get_restrained_dofs(), vector(5, 6, 7 + 6, 11 + 6, 12 + 6)
        )

    def test_restrained_dofs_are_adjoint_when_deleting_element(self):
        static_system = self.create_basic_static_system(n=3)

        static_system.set_restrained_dof(5)
        static_system.set_restrained_dof(6)
        static_system.set_restrained_dof(7)
        static_system.set_restrained_dof(11)
        static_system.set_restrained_dof(12)
        static_system.set_restrained_dof(13)
        static_system.set_restrained_dof(17)

        static_system.delete_element(2)

        assert_array_equal(
            static_system.get_restrained_dofs(), vector(5, 6, 13 - 6, 17 - 6)
        )

    def test_restrained_dofs_must_be_subset_of_dofs(self):
        static_system = self.create_basic_static_system(n=2)

        static_system.set_restrained_dof(1)
        static_system.set_restrained_dof(12)

        self.assertRaises(
            RestrainedDoFsMustBeSubsetOfDoFs,
            lambda: static_system.set_restrained_dof(13),
        )

        self.assertRaises(
            RestrainedDoFsMustBeSubsetOfDoFs,
            lambda: static_system.set_restrained_dof(0),
        )

    def test_get_boundary_conditions(self):
        static_system = self.create_basic_static_system(n=2)

        self.assertEqual(static_system.get_boundary_conditions(), {})

    def test_set_boundary_condition(self):
        static_system = self.create_basic_static_system(n=2)

        static_system.set_boundary_condition(dof=1, times=1, is_equal_to_dof=2)

        self.assertEqual(static_system.get_boundary_conditions(), {1: (1, 2)})

        static_system.set_boundary_condition(dof=1, times=0.7, is_equal_to_dof=4)

        self.assertEqual(static_system.get_boundary_conditions(), {1: (0.7, 4)})

    def test_boundary_dofs_must_be_subset_of_dofs(self):
        static_system = self.create_basic_static_system(n=2)

        static_system.set_boundary_condition(dof=12, times=1, is_equal_to_dof=1)
        static_system.set_boundary_condition(dof=1, times=4, is_equal_to_dof=12)

        self.assertRaises(
            BoundaryDoFsMustBeSubsetOfDoFs,
            lambda: static_system.set_boundary_condition(
                dof=13, times=1, is_equal_to_dof=1
            ),
        )
        self.assertRaises(
            BoundaryDoFsMustBeSubsetOfDoFs,
            lambda: static_system.set_boundary_condition(
                dof=1, times=1, is_equal_to_dof=13
            ),
        )

        self.assertRaises(
            BoundaryDoFsMustBeSubsetOfDoFs,
            lambda: static_system.set_boundary_condition(
                dof=0, times=1, is_equal_to_dof=12
            ),
        )

        self.assertRaises(
            BoundaryDoFsMustBeSubsetOfDoFs,
            lambda: static_system.set_boundary_condition(
                dof=1, times=1, is_equal_to_dof=0
            ),
        )

    def test_boundary_dofs_must_not_be_equal(self):
        static_system = self.create_basic_static_system(n=2)

        self.assertRaises(
            BoundaryDoFsMustNotBeEqual,
            lambda: static_system.set_boundary_condition(
                dof=2, times=1, is_equal_to_dof=2
            ),
        )

        self.assertRaises(
            BoundaryDoFsMustNotBeEqual,
            lambda: static_system.set_boundary_condition(
                dof=7, times=1, is_equal_to_dof=7
            ),
        )

    def test_get_non_restrained_dofs(self):
        static_system = self.create_basic_static_system(n=2)

        assert_array_equal(
            static_system.get_non_restrained_dofs(),
            vector(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
        )

    def test_get_essential_dofs(self):
        static_system = create_bernoulli_beam()

        assert_array_equal(
            static_system.get_essential_dofs(), vector(1, 2, 3, 4, 5, 6, 10, 11, 12)
        )

    def test_get_essential_non_restrained_dofs(self):
        static_system = create_bernoulli_beam()

        assert_array_equal(
            static_system.get_essential_non_restrained_dofs(),
            vector(3, 4, 5, 6, 10, 12),
        )

    def test_get_essential_restrained_dofs(self):
        static_system = create_bernoulli_beam()

        assert_array_equal(
            static_system.get_essential_restrained_dofs(),
            vector(1, 2, 11),
        )

    def test_get_essential_dof_index(self):
        static_system = create_bernoulli_beam()

        indices = [0, 1, 2, 3, 4, 5, 3, 4, 5, 6, 7, 8]

        for i, dof in enumerate(static_system.get_dofs()):
            self.assertEqual(
                static_system.get_essential_dof_index(dof),
                indices[i],
            )

        static_system = create_beam_on_two_supports_with_cantilever_arm()
        indices = [0, 1, 2, 3, 4, 5, 3, 4, 5, 6, 7, 8]

        for i, dof in enumerate(static_system.get_dofs()):
            self.assertEqual(
                static_system.get_essential_dof_index(dof),
                indices[i],
            )

    def test_get_essential_dof_indices(self):
        static_system = create_bernoulli_beam()

        dofs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        indices = [0, 1, 2, 3, 4, 5, 3, 4, 5, 6, 7, 8]

        assert_array_equal(static_system.get_essential_dof_indices(dofs), indices)

        static_system = create_beam_on_two_supports_with_cantilever_arm()

        dofs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        indices = [0, 1, 2, 3, 4, 5, 3, 4, 5, 6, 7, 8]

        assert_array_equal(static_system.get_essential_dof_indices(dofs), indices)
