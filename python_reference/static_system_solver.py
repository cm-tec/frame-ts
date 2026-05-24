import numpy as np
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
from utilities import (
    get_dofs_of_element,
    get_derived_F_global_of_element,
    get_derived_k_global_of_element,
    get_k_global_of_element,
)


def contains_duplicates(list):
    return len(list) != len(set(list))


class StaticSystemSolver:

    def __init__(self, static_system):
        self.static_system = static_system

    def get_ndofs(self):
        return len(self.static_system.get_essential_dofs())

    def get_k(self):
        k = np.zeros((self.get_ndofs(), self.get_ndofs()))

        for id, e in enumerate(self.static_system.get_elements(), 1):
            k += self.expand_element_matrix(id, get_k_global_of_element(e))

        return k

    def get_non_restrained_k(self):
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_restrained_dofs()
        )

        return delete_rows_and_columns_from_matrix(
            self.get_k(), indices_to_delete=indices
        )

    def get_inv_non_restrained_k(self):
        return np.linalg.inv(self.get_non_restrained_k())

    def get_mix_k(self):
        restrained_indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_restrained_dofs()
        )
        non_restrained_indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_non_restrained_dofs()
        )

        mix_k = delete_rows_from_matrix(self.get_k(), non_restrained_indices)
        mix_k = delete_columns_from_matrix(mix_k, restrained_indices)

        return mix_k

    def get_derived_k(self, param_id, dx):
        e = self.static_system.get_element(param_id)
        return self.expand_element_matrix(
            param_id, get_derived_k_global_of_element(e, dx=dx)
        )

    def get_derived_non_restrained_k(self, id, dx):
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_restrained_dofs()
        )

        return delete_rows_and_columns_from_matrix(
            self.get_derived_k(param_id=id, dx=dx), indices_to_delete=indices
        )

    def get_derived_mix_k(self, id, dx):
        restrained_indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_restrained_dofs()
        )
        non_restrained_indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_non_restrained_dofs()
        )

        mix_k = delete_rows_from_matrix(
            self.get_derived_k(param_id=id, dx=dx), non_restrained_indices
        )
        mix_k = delete_columns_from_matrix(mix_k, restrained_indices)

        return mix_k

    def get_force_vector(self):
        force_vector = np.zeros(self.get_ndofs())

        for id, e in enumerate(self.static_system.get_elements(), 1):
            force_vector += self.expand_element_vector(id, e.get_force_vector())

        return force_vector

    def get_derived_restrained_force_vector(self, id, dx):
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_non_restrained_dofs()
        )

        return np.delete(self.get_derived_force_vector(param_id=id, dx=dx), indices)

    def get_derived_force_vector(self, param_id, dx):
        derived_force_vector = np.zeros(self.get_ndofs())

        e = self.static_system.get_element(param_id)

        derived_force_vector += self.expand_element_vector(
            param_id, get_derived_F_global_of_element(e, dx=dx)
        )

        return derived_force_vector

    def get_non_restrained_force_vector(self):
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_restrained_dofs()
        )

        return np.delete(self.get_force_vector(), indices)

    def get_derived_non_restrained_force_vector(self, id, dx):
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_restrained_dofs()
        )

        return np.delete(self.get_derived_force_vector(param_id=id, dx=dx), indices)

    def get_non_restrained_displacements(self):
        return self.get_inv_non_restrained_k().dot(
            self.get_non_restrained_force_vector()
        )

    def get_displacements(self):
        return self.expand_non_restrained_vector(
            self.get_non_restrained_displacements()
        )

    def get_displacements_of_element(self, id):
        indices = self.static_system.get_essential_dof_indices(get_dofs_of_element(id))

        return self.get_displacements()[indices]

    def get_local_displacements_of_element(self, id):
        e = self.static_system.get_element(id)

        return e.get_tau() @ self.get_displacements_of_element(id)

    def get_derived_non_restrained_displacements(self, id, dx):
        return self.get_inv_non_restrained_k().dot(
            self.get_derived_non_restrained_force_vector(id=id, dx=dx)
            - self.get_derived_non_restrained_k(id=id, dx=dx).dot(
                self.get_non_restrained_displacements()
            )
        )

    def get_derived_displacements(self, id, dx):
        return self.expand_non_restrained_vector(
            self.get_derived_non_restrained_displacements(id=id, dx=dx)
        )

    def get_external_forces(self):
        return -self.get_force_vector() + self.get_k().dot(self.get_displacements())

    def get_internal_forces_of_element(self, id):
        e = self.static_system.get_element(id)

        u_element = self.get_displacements_of_element(id)

        s_element = e.get_tau() @ (
            e.get_k().dot(u_element) - e.get_element_force_vector()
        )

        s_element[0:3] = -s_element[0:3]
        return s_element

    def expand_element_vector(self, id, input_vector):
        indices = self.static_system.get_essential_dof_indices(
            get_dofs_of_element(id=id)
        )

        return self.expand_vector(input_vector=input_vector, indices=indices)

    def expand_restrained_vector(self, input_vector):
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_essential_restrained_dofs()
        )

        return self.expand_vector(input_vector=input_vector, indices=indices)

    def expand_non_restrained_vector(self, input_vector):
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_essential_non_restrained_dofs()
        )
        return self.expand_vector(input_vector=input_vector, indices=indices)

    def expand_vector(self, input_vector, indices):
        v = np.zeros(self.get_ndofs())

        for i, value in enumerate(input_vector):
            v[indices[i]] = value

        return v

    def expand_element_matrix(self, id, input_matrix):
        indices = self.static_system.get_essential_dof_indices(
            get_dofs_of_element(id=id)
        )

        return self.expand_matrix(input_matrix, indices)

    def expand_matrix(self, input_matrix, indices):
        n = self.get_ndofs()

        B = np.zeros((len(indices), n))

        for i in range(6):
            B[i, indices[i]] = 1

        return B.T.dot(input_matrix).dot(B)

    def get_derived_restrained_external_forces(self, id, dx):
        return (
            -self.get_to_restrained()
            + self.get_mix_k().dot(
                self.get_inv_non_restrained_k().dot(self.get_to_non_restrained())
            )
        ).dot(self.get_f_star(param_id=id, dx=dx))

    def get_f_star(self, param_id, dx):
        return self.get_derived_force_vector(
            param_id=param_id, dx=dx
        ) - self.get_derived_k(param_id=param_id, dx=dx).dot(self.get_displacements())

    def get_f_star_of_element(self, id, param_id, dx):
        if param_id != id:
            return np.zeros(6)

        e = self.static_system.get_element(id)

        return get_derived_F_global_of_element(
            e, dx=dx
        ) - get_derived_k_global_of_element(
            e, dx=dx
        ) @ self.get_displacements_of_element(
            id
        )

    def get_to_restrained(self):
        ndofs = self.get_ndofs()
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_essential_restrained_dofs()
        )

        to_restrained = np.zeros((len(indices), ndofs))

        for i, v in enumerate(indices):
            to_restrained[i, v] = 1

        return to_restrained

    def get_to_non_restrained(self):
        ndofs = self.get_ndofs()
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_essential_non_restrained_dofs()
        )

        to_non_restrained = np.zeros((len(indices), ndofs))

        for i, v in enumerate(indices):
            to_non_restrained[i, v] = 1

        return to_non_restrained

    def get_to_element(self, id):
        ndofs = self.get_ndofs()
        e_dofs = np.arange(6 * (id - 1) + 1, 6 * id + 1)
        indices = self.static_system.get_essential_dof_indices(e_dofs)

        to_non_restrained = np.zeros((len(indices), ndofs))

        for i, v in enumerate(indices):
            to_non_restrained[i, v] = 1

        return to_non_restrained

    def get_derived_internal_forces_of_element(self, id, param_id, dx):
        e = self.static_system.get_element(id)
        f_star = self.get_f_star(param_id=param_id, dx=dx)

        zeta_0 = -self.get_f_star_of_element(id=id, param_id=param_id, dx=dx)
        zeta = (
            e.get_k()
            .dot(self.get_to_element(id=id))
            .dot(self.get_expand_non_restrained())
            .dot(self.get_inv_non_restrained_k())
            .dot(self.get_to_non_restrained())
        )

        derived_s = e.get_tau() @ (zeta_0 + (zeta) @ f_star)

        derived_s[0:3] = -derived_s[0:3]
        return derived_s

    def get_expand_restrained(self):
        ndofs = self.get_ndofs()
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_essential_restrained_dofs()
        )

        expand_restrained = np.zeros((ndofs, len(indices)))

        for i, v in enumerate(indices):
            expand_restrained[v, i] = 1

        return expand_restrained

    def get_expand_non_restrained(self):
        ndofs = self.get_ndofs()
        indices = self.static_system.get_essential_dof_indices(
            self.static_system.get_essential_non_restrained_dofs()
        )

        expand_restrained = np.zeros((ndofs, len(indices)))

        for i, v in enumerate(indices):
            expand_restrained[v, i] = 1

        return expand_restrained

    def get_non_restrained_f_star(self, id, dx):
        return self.get_derived_non_restrained_force_vector(
            id=id, dx=dx
        ) - self.get_derived_non_restrained_k(id=id, dx=dx).dot(
            self.get_non_restrained_displacements()
        )

    def get_direct_sensa(self, id, design_parameter):

        results = {}
        p_value = design_parameter.value
        a = 0
        b = 0
        c = 0

        c = (
            self.get_expand_non_restrained()
            @ self.get_inv_non_restrained_k()
            @ self.get_non_restrained_f_star(id=id, dx=p_value)
        )

        for i, _ in enumerate(self.static_system.get_elements()):
            element_id = i + 1
            e = self.static_system.get_element(element_id)

            a = -self.get_f_star_of_element(
                id=element_id,
                param_id=id,
                dx=p_value,
            )
            b = e.get_k() @ self.get_to_element(id=element_id)

            sensa = e.get_tau() @ (a + b @ c)

            sensa[0:3] = -sensa[0:3]

            results[element_id] = sensa

        return results

    def get_adjoint_sensa(self, id, response_parameter):

        results = {}

        a = 0
        b = 0
        c = 0

        if isinstance(response_parameter, ResponseVariableDisplacement):
            # Get the degree of freedom number of the selected displacement
            response_variable_dof = get_dofs_of_element(id)[
                list(ResponseVariableDisplacement).index(response_parameter)
            ]
            dof_index = self.static_system.get_essential_dof_indices(
                [response_variable_dof]
            )[0]

            b = (
                self.get_expand_non_restrained()[dof_index]
                @ self.get_inv_non_restrained_k()
            )

            for i, _ in enumerate(self.static_system.get_elements()):
                p_element_id = i + 1
                for parameter in DesignParameterElement:
                    p_value = parameter.value

                    c = self.get_non_restrained_f_star(id=p_element_id, dx=p_value)

                    sensa = a + b @ c

                    results.setdefault(p_element_id, {})[p_value] = sensa

        elif isinstance(response_parameter, ResponseVariableInternalForce):
            internal_force_index = list(ResponseVariableInternalForce).index(
                response_parameter
            )
            e = self.static_system.get_element(id)

            b = (
                e.get_tau()[internal_force_index]
                @ e.get_k()
                @ self.get_to_element(id=id)
                @ self.get_expand_non_restrained()
                @ self.get_inv_non_restrained_k()
            )

            for i, _ in enumerate(self.static_system.get_elements()):
                p_element_id = i + 1
                for parameter in DesignParameterElement:
                    p_value = parameter.value

                    a = -e.get_tau()[internal_force_index] @ self.get_f_star_of_element(
                        id=id,
                        param_id=p_element_id,
                        dx=p_value,
                    )
                    c = self.get_non_restrained_f_star(id=p_element_id, dx=p_value)

                    sensa = a + b @ c

                    if internal_force_index < 3:
                        sensa = -sensa

                    results.setdefault(p_element_id, {})[p_value] = sensa

        else:
            raise Exception()

        return results
