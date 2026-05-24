import numpy as np
from element import Element
from node import Node
from utilities import get_dofs_of_element
from vector import vector


class StaticSystem:

    def __init__(self):
        self.elements = []
        self.restrained_dofs = set()
        self.boundary_conditions = {}

    @classmethod
    def from_node_and_element_tables(cls, node_table, element_table):
        static_system = cls()

        for i, e in enumerate(element_table):
            element_id = i + 1
            node_i = node_table[e["node_i"] - 1]
            node_k = node_table[e["node_k"] - 1]

            if "dofs_x" not in node_i:
                node_i["dofs_x"] = []
                node_i["dofs_z"] = []
                node_i["dofs_phi"] = []

            if "dofs_x" not in node_k:
                node_k["dofs_x"] = []
                node_k["dofs_z"] = []
                node_k["dofs_phi"] = []

            (
                dof_x_i,
                dof_z_i,
                dof_phi_i,
                dof_x_k,
                dof_z_k,
                dof_phi_k,
            ) = get_dofs_of_element(element_id)

            node_i["dofs_x"].append(dof_x_i)
            node_i["dofs_z"].append(dof_z_i)

            node_k["dofs_x"].append(dof_x_k)
            node_k["dofs_z"].append(dof_z_k)

            if e["connection_type_i"] == "stiff":
                node_i["dofs_phi"].append(dof_phi_i)
            if e["connection_type_k"] == "stiff":
                node_k["dofs_phi"].append(dof_phi_k)

            static_system.create_element(
                vector(node_i["x"], node_i["z"]),
                vector(node_k["x"], node_k["z"]),
                EA=e["EA"],
                EI=e["EI"],
                q_x=e["q_x"],
                q_z=e["q_z"],
                f_x_i=e["f_x_i"],
                f_z_i=e["f_z_i"],
                m_y_i=e["m_y_i"],
                f_x_k=e["f_x_k"],
                f_z_k=e["f_z_k"],
                m_y_k=e["m_y_k"],
            )

        for n in node_table:
            dofs_x = n["dofs_x"]
            if len(dofs_x) > 0:
                dof_x = dofs_x.pop(0)

                if n["restrained_x"]:
                    static_system.set_restrained_dof(dof_x)

                for dof in dofs_x:
                    static_system.set_boundary_condition(
                        dof, times=1, is_equal_to_dof=dof_x
                    )

            dofs_z = n["dofs_z"]
            if len(dofs_z) > 0:
                dof_z = dofs_z.pop(0)

                if n["restrained_z"]:
                    static_system.set_restrained_dof(dof_z)

                for dof in dofs_z:
                    static_system.set_boundary_condition(
                        dof, times=1, is_equal_to_dof=dof_z
                    )

            dofs_phi = n["dofs_phi"]
            if len(dofs_phi) > 0:
                dof_phi = dofs_phi.pop(0)

                if n["restrained_phi"]:
                    static_system.set_restrained_dof(dof_phi)

                for dof in dofs_phi:
                    static_system.set_boundary_condition(
                        dof, times=1, is_equal_to_dof=dof_phi
                    )

        return static_system

    def get_elements(self):
        return self.elements

    def get_element(self, id):
        return self.elements[id - 1]

    def create_element(
        self,
        p_i,
        p_k,
        EA=1,
        EI=1,
        f_x_i=0,
        f_z_i=0,
        m_y_i=0,
        f_x_k=0,
        f_z_k=0,
        m_y_k=0,
        q_x=0,
        q_z=0,
        at_index=None,
    ):
        e = Element(p_i=p_i, p_k=p_k, EA=EA, EI=EI)

        e.f_x_i = f_x_i
        e.f_z_i = f_z_i
        e.m_y_i = m_y_i
        e.f_x_k = f_x_k
        e.f_z_k = f_z_k
        e.m_y_k = m_y_k
        e.q_x = q_x
        e.q_z = q_z

        if at_index is None:
            self.elements.append(e)
        else:
            self.restrained_dofs = set(
                dof for dof in self.restrained_dofs if dof <= (at_index) * 6
            ) | set(dof + 6 for dof in self.restrained_dofs if dof > (at_index) * 6)

            self.elements.insert(at_index, e)

    def delete_element(self, id):
        self.restrained_dofs = set(
            dof for dof in self.restrained_dofs if dof <= (id - 1) * 6
        ) | set(dof - 6 for dof in self.restrained_dofs if dof > (id) * 6)

        del self.elements[id - 1]

    def update_element(self, id, p_i, p_k, EA, EI):
        e = self.get_element(id=id)

        e.p_i = p_i
        e.p_k = p_k
        e.EA = EA
        e.EI = EI

    def set_restrained_dof(self, dof):
        if dof not in self.get_dofs():
            raise RestrainedDoFsMustBeSubsetOfDoFs()

        self.restrained_dofs.add(dof)

    def get_dofs(self):
        return np.arange(1, 6 * len(self.elements) + 1)

    def get_restrained_dofs(self):
        return self.restrained(self.get_dofs())

    def get_non_restrained_dofs(self):
        return self.non_restrained(self.get_dofs())

    def get_essential_dofs(self):
        return self.essential(self.get_dofs())

    def get_essential_non_restrained_dofs(self):
        return self.non_restrained(self.get_essential_dofs())

    def get_essential_restrained_dofs(self):
        return self.restrained(self.get_essential_dofs())

    def set_boundary_condition(self, dof, times, is_equal_to_dof):
        if dof == is_equal_to_dof:
            raise BoundaryDoFsMustNotBeEqual()

        if dof not in self.get_dofs() or is_equal_to_dof not in self.get_dofs():
            raise BoundaryDoFsMustBeSubsetOfDoFs()
        self.boundary_conditions[dof] = (times, is_equal_to_dof)

    def get_boundary_conditions(self):
        return self.boundary_conditions

    def get_essential_dof_index(self, dof):
        dofs = list(self.get_essential_dofs())
        reduced_dof = dof if dof in dofs else self.get_boundary_conditions()[dof][1]

        return dofs.index(reduced_dof)

    def get_essential_dof_indices(self, dofs):
        return [self.get_essential_dof_index(dof) for dof in dofs]

    def essential(self, dofs):
        return np.array(
            sorted([dof for dof in dofs if dof not in self.boundary_conditions.keys()])
        )

    def restrained(self, dofs):
        return np.array(sorted([dof for dof in dofs if dof in self.restrained_dofs]))

    def non_restrained(self, dofs):
        return np.array(
            sorted([dof for dof in dofs if dof not in self.restrained_dofs])
        )

    def __eq__(self, other):
        return (
            np.array_equal(self.elements, other.elements)
            and self.restrained_dofs == other.restrained_dofs
            and self.boundary_conditions == other.boundary_conditions
        )


class RestrainedDoFsMustBeSubsetOfDoFs(Exception):
    pass


class BoundaryDoFsMustBeSubsetOfDoFs(Exception):
    pass


class BoundaryDoFsMustNotBeEqual(Exception):
    pass
