
class Element {
    

    def __init__(
    self,
    node_i,
    node_k,
    f,
    q_z = 0,
    q_x = 0,
    EI = 1,
    EA = 1,
):
        self.node_i = node_i
        self.node_k = node_k
        self.EI = EI
        self.EA = EA

        self.q_z = q_z
        self.q_x = q_x

        self.dof_x_i, self.dof_y_i, self.dof_phi_i = f(node_i)
        self.dof_x_k, self.dof_y_k, self.dof_phi_k = f(node_k)

    @property
    def length(self):
        x1, y1 = self.node_i.x, self.node_i.y
        x2, y2 = self.node_k.x, self.node_k.y
    length = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

        return length

@property
    def element_vector(self):
return (
    self.node_k.x - self.node_i.x,
    self.node_k.y - self.node_i.y,
        )

@property
    def k(self):
l = self.length

return self.EA / l * np.array(
    [
        [1, 0, 0, -1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [-1, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
    ]
) + 2 * self.EI / l ** 3 * np.array(
    [
        [0, 0, 0, 0, 0, 0],
        [0, 6, -3 * l, 0, -6, -3 * l],
        [0, -3 * l, 2 * l ** 2, 0, 3 * l, l ** 2],
        [0, 0, 0, 0, 0, 0],
        [0, -6, 3 * l, 0, 6, 3 * l],
        [0, -3 * l, l ** 2, 0, 3 * l, 2 * l ** 2],
    ]
)

    def delta_k(
    self,
    delta_EA = 0,
    delta_EI = 0,
    delta_l = 0,
):
EA = self.EA + delta_EA
EI = self.EI + delta_EI
l = self.length + delta_l

return EA / l * np.array(
    [
        [1, 0, 0, -1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [-1, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
    ]
) + 2 * EI / l ** 3 * np.array(
    [
        [0, 0, 0, 0, 0, 0],
        [0, 6, -3 * l, 0, -6, -3 * l],
        [0, -3 * l, 2 * l ** 2, 0, 3 * l, l ** 2],
        [0, 0, 0, 0, 0, 0],
        [0, -6, 3 * l, 0, 6, 3 * l],
        [0, -3 * l, l ** 2, 0, 3 * l, 2 * l ** 2],
    ]
)

    def delta_k_global(
    self,
    delta_EA = 0,
    delta_EI = 0,
    delta_l = 0,
):
tau = self.get_tau()
return tau.T.dot(
    self.delta_k(
        delta_EA = delta_EA,
        delta_EI = delta_EI,
        delta_l = delta_l,
    )
).dot(tau)

@property
    def F_0(self):
q_x, q_z = self.local_surface_load
return (
    -q_x * self.length / 2,
    -q_z * self.length / 2,
    q_z * self.length ** 2 / 12,
    -q_x * self.length / 2,
    -q_z * self.length / 2,
    -q_z * self.length ** 2 / 12,
        )

    def F_0_delta(
        self,
        delta_l = 0,
        delta_q_x = 0,
        delta_q_z = 0,
    ):
q_x_local, q_z_local = np.dot(
    self.get_tau_of_element(),
    (self.q_x + delta_q_x, self.q_z + delta_q_z),
)
l = self.length + delta_l

return np.array(
    (
        -q_x_local * l / 2,
        -q_z_local * l / 2,
        q_z_local * l ** 2 / 12,
        -q_x_local * l / 2,
        -q_z_local * l / 2,
        -q_z_local * l ** 2 / 12,
            )
)

    def F_0_delta_global(
    self,
    delta_l = 0,
    delta_q_x = 0,
    delta_q_z = 0,
):
return self.get_tau().T.dot(
    self.F_0_delta(
        delta_l = delta_l,
        delta_q_x = delta_q_x,
        delta_q_z = delta_q_z,
    )
)

    def F_0_derived(self, p_value):
        # Settings / Constants
delta_p = Settings.delta_p

        # Delta Input for derivation calculation
        forward_delta_input = tuple(
    delta_p / 2 if p.value == p_value else 0 for p in DesignParameterElement
)
    backward_delta_input = tuple(-x for x in forward_delta_input)

    F_0_d1 = self.F_0_delta(* backward_delta_input[2: 6])[0: 6]
F_0_d2 = self.F_0_delta(* forward_delta_input[2: 6])[0: 6]

F_0_derivation = (F_0_d2 - F_0_d1) / delta_p

return F_0_derivation

    def F_0_derived_global(self, p_value):
return self.get_tau().T.dot(self.F_0_derived(p_value = p_value))

    def k_derived(self, p_value):
        # Settings / Constants
delta_p = Settings.delta_p

        # Delta Input for derivation calculation
        d2 = tuple(
    delta_p / 2 if p.value == p_value else 0 for p in DesignParameterElement
)
    d1 = tuple(-x for x in d2)

    K_d1 = self.delta_k(* d1[0: 3])
K_d2 = self.delta_k(* d2[0: 3])

K_derived = (K_d2 - K_d1) / delta_p

return K_derived

    def k_derived_global(self, p_value):
tau = self.get_tau()
return tau.T.dot(self.k_derived(p_value = p_value)).dot(tau)

@property
    def F_0_global(self):
return self.get_tau().T.dot(self.F_0)

    def get_tau(self):
elementVector = self.element_vector

cosine = np.dot(elementVector, xAxis) / self.length
sine = np.dot(elementVector, yAxis) / self.length

return np.array(
    [
        [cosine, -sine, 0, 0, 0, 0],
        [sine, cosine, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, cosine, -sine, 0],
        [0, 0, 0, sine, cosine, 0],
        [0, 0, 0, 0, 0, 1],
    ],
    dtype = float,
)

    def get_tau_of_element(self):
elementVector = self.element_vector

cosine = np.dot(elementVector, xAxis) / self.length
sine = np.dot(elementVector, yAxis) / self.length

return np.array(
    [
        [cosine, -sine],
        [sine, cosine],
    ],
    dtype = float,
)

@property
    def k_global(self):
tau = self.get_tau()
return tau.T.dot(self.k).dot(tau)

@property
    def degrees_of_freedom(self):
return [
    self.dof_x_i,
    self.dof_y_i,
    self.dof_phi_i,
    self.dof_x_k,
    self.dof_y_k,
    self.dof_phi_k,
]

@property
    def displacements(self):
return (
    self.node_i.displacement_x,
    self.node_i.displacement_y,
    self.node_i.displacement_phi,
    self.node_k.displacement_x,
    self.node_k.displacement_y,
    self.node_k.displacement_phi,
        )

@property
    def local_displacements(self):
return np.dot(self.get_tau(), self.displacements)

@property
    def internal_forces(self):
return (
    self.N_i,
    self.V_i,
    self.M_i,
    self.N_k,
    self.V_k,
    self.M_k,
        )

@property
    def local_surface_load(self):
return np.dot(
    self.get_tau_of_element(),
    (self.q_x, self.q_z),
)
}