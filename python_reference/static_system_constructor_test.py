import unittest

from example_static_systems import create_bernoulli_beam_with_area_load, create_frame
from static_system import StaticSystem

from numpy.testing import assert_array_equal

from vector import vector


class TestStaticSystemConstructor(unittest.TestCase):

    def test_from_node_and_element_table_returns_static_system(self):
        static_system = StaticSystem.from_node_and_element_tables([], [])
        self.assertIsInstance(static_system, StaticSystem)

    def test_from_node_and_element_table_creates_n_elements(self):

        nodes = [
            {
                "x": 0,
                "z": 0,
                "restrained_x": True,
                "restrained_z": True,
                "restrained_phi": False,
            },
            {
                "x": 1,
                "z": 0,
                "restrained_x": False,
                "restrained_z": True,
                "restrained_phi": False,
            },
        ]

        elements = [
            {
                "node_i": 1,
                "node_k": 2,
                "connection_type_i": "stiff",
                "connection_type_k": "stiff",
                "EA": 1,
                "EI": 1,
                "q_x": 0,
                "q_z": 1,
                "f_x_i": 0,
                "f_z_i": 0,
                "m_y_i": 0,
                "f_x_k": 0,
                "f_z_k": 0,
                "m_y_k": 0,
            }
        ]

        static_system = StaticSystem.from_node_and_element_tables(nodes, elements)

        self.assertEqual(len(static_system.get_elements()), 1)

        nodes = [
            {
                "x": 0,
                "z": 0,
                "restrained_x": True,
                "restrained_z": True,
                "restrained_phi": False,
            },
            {
                "x": 1,
                "z": 0,
                "restrained_x": False,
                "restrained_z": False,
                "restrained_phi": False,
            },
            {
                "x": 2,
                "z": 0,
                "restrained_x": False,
                "restrained_z": True,
                "restrained_phi": False,
            },
        ]

        elements = [
            {
                "node_i": 1,
                "node_k": 2,
                "connection_type_i": "stiff",
                "connection_type_k": "stiff",
                "EA": 1,
                "EI": 1,
                "q_x": 0,
                "q_z": 0,
                "f_x_i": 0,
                "f_z_i": 0,
                "m_y_i": 0,
                "f_x_k": 0,
                "f_z_k": 0,
                "m_y_k": 0,
            },
            {
                "node_i": 2,
                "node_k": 3,
                "connection_type_i": "stiff",
                "connection_type_k": "stiff",
                "EA": 1,
                "EI": 1,
                "q_x": 0,
                "q_z": 0,
                "f_x_i": 0,
                "f_z_i": 0,
                "m_y_i": 0,
                "f_x_k": 0,
                "f_z_k": 0,
                "m_y_k": 0,
            },
        ]

        static_system = StaticSystem.from_node_and_element_tables(nodes, elements)

        self.assertEqual(len(static_system.get_elements()), 2)

    def test_from_node_and_element_table_creates_element_with_correct_attributes(self):
        nodes = [
            {
                "x": 1,
                "z": 1,
                "restrained_x": True,
                "restrained_z": True,
                "restrained_phi": False,
            },
            {
                "x": 2,
                "z": 1,
                "restrained_x": False,
                "restrained_z": True,
                "restrained_phi": False,
            },
        ]

        elements = [
            {
                "node_i": 1,
                "node_k": 2,
                "connection_type_i": "stiff",
                "connection_type_k": "stiff",
                "EA": 2,
                "EI": 3,
                "q_x": 4,
                "q_z": 5,
                "f_x_i": 6,
                "f_z_i": 7,
                "m_y_i": 8,
                "f_x_k": 9,
                "f_z_k": 10,
                "m_y_k": 11,
            }
        ]
        static_system = StaticSystem.from_node_and_element_tables(nodes, elements)

        e = static_system.get_element(1)
        self.assertEqual(e.EA, 2)
        self.assertEqual(e.EI, 3)
        self.assertEqual(e.q_x, 4)
        self.assertEqual(e.q_z, 5)
        self.assertEqual(e.f_x_i, 6)
        self.assertEqual(e.f_z_i, 7)
        self.assertEqual(e.m_y_i, 8)
        self.assertEqual(e.f_x_k, 9)
        self.assertEqual(e.f_z_k, 10)
        self.assertEqual(e.m_y_k, 11)

        assert_array_equal(e.p_i, vector(1, 1))
        assert_array_equal(e.p_k, vector(2, 1))

    def test_from_node_and_element_table_sets_restrained_dof(self):
        nodes = [
            {
                "x": 0,
                "z": 0,
                "restrained_x": True,
                "restrained_z": True,
                "restrained_phi": False,
            },
            {
                "x": 1,
                "z": 0,
                "restrained_x": False,
                "restrained_z": True,
                "restrained_phi": False,
            },
        ]

        elements = [
            {
                "node_i": 1,
                "node_k": 2,
                "connection_type_i": "stiff",
                "connection_type_k": "stiff",
                "EA": 1,
                "EI": 1,
                "q_x": 0,
                "q_z": 1,
                "f_x_i": 0,
                "f_z_i": 0,
                "m_y_i": 0,
                "f_x_k": 0,
                "f_z_k": 0,
                "m_y_k": 0,
            }
        ]
        static_system = StaticSystem.from_node_and_element_tables(nodes, elements)

        assert_array_equal(static_system.get_restrained_dofs(), [1, 2, 5])

    def test_from_node_and_element_table_create_bernoulli_beam_with_area_load(self):
        nodes = [
            {
                "x": 0,
                "z": 0,
                "restrained_x": True,
                "restrained_z": True,
                "restrained_phi": False,
            },
            {
                "x": 1,
                "z": 0,
                "restrained_x": False,
                "restrained_z": True,
                "restrained_phi": False,
            },
        ]

        elements = [
            {
                "node_i": 1,
                "node_k": 2,
                "connection_type_i": "stiff",
                "connection_type_k": "stiff",
                "EA": 1,
                "EI": 1,
                "q_x": 0,
                "q_z": 1,
                "f_x_i": 0,
                "f_z_i": 0,
                "m_y_i": 0,
                "f_x_k": 0,
                "f_z_k": 0,
                "m_y_k": 0,
            }
        ]

        static_system = StaticSystem.from_node_and_element_tables(nodes, elements)

        self.assertEqual(static_system, create_bernoulli_beam_with_area_load())

    def test_from_node_and_element_table_create_frame(self):
        nodes = [
            {
                "x": 0,
                "z": 0,
                "restrained_x": True,
                "restrained_z": True,
                "restrained_phi": False,
            },
            {
                "x": 0,
                "z": 1,
                "restrained_x": False,
                "restrained_z": False,
                "restrained_phi": False,
            },
            {
                "x": 1,
                "z": 1,
                "restrained_x": False,
                "restrained_z": False,
                "restrained_phi": False,
            },
            {
                "x": 1,
                "z": 0,
                "restrained_x": True,
                "restrained_z": True,
                "restrained_phi": False,
            },
        ]

        elements = [
            {
                "node_i": 1,
                "node_k": 2,
                "connection_type_i": "stiff",
                "connection_type_k": "stiff",
                "EA": 1,
                "EI": 1,
                "q_x": 0,
                "q_z": 0,
                "f_x_i": 0,
                "f_z_i": 0,
                "m_y_i": 0,
                "f_x_k": 1,
                "f_z_k": 0,
                "m_y_k": 0,
            },
            {
                "node_i": 2,
                "node_k": 3,
                "connection_type_i": "stiff",
                "connection_type_k": "moment_joint",
                "EA": 1,
                "EI": 1,
                "q_x": 0,
                "q_z": 0,
                "f_x_i": 0,
                "f_z_i": 1,
                "m_y_i": 0,
                "f_x_k": 0,
                "f_z_k": 0,
                "m_y_k": 0,
            },
            {
                "node_i": 3,
                "node_k": 4,
                "connection_type_i": "stiff",
                "connection_type_k": "stiff",
                "EA": 1,
                "EI": 1,
                "q_x": 0,
                "q_z": 0,
                "f_x_i": 0,
                "f_z_i": 0,
                "m_y_i": 0,
                "f_x_k": 0,
                "f_z_k": 0,
                "m_y_k": 0,
            },
        ]

        static_system = StaticSystem.from_node_and_element_tables(nodes, elements)

        self.assertEqual(static_system, create_frame())
