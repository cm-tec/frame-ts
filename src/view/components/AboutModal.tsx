import { Blockquote, Code, Divider, List, Modal, Stack, Table, Text, Title } from '@mantine/core';

const MONO = { fontFamily: 'monospace' } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <Title order={4} mb={6}>{title}</Title>
            <Stack gap={8}>{children}</Stack>
        </div>
    );
}

export function AboutModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
    return (
        <Modal opened={opened} onClose={onClose} title="About FrameTS" size="lg">
            <Stack gap="lg">

                <Text size="sm">
                    An interactive tool for the analysis of plane (2D) frame and truss structures. Define a
                    structure in the editor and see its behaviour immediately: deformed shapes, internal force
                    diagrams, free-vibration animations, eigenmodes — and, for insufficiently supported systems,
                    the kinematic mechanism itself. Everything runs in the browser; no data leaves your machine.
                </Text>

                <Text size="sm" c="dimmed">
                    The underlying element is a full Euler–Bernoulli beam element. Truss members are the
                    special case obtained by releasing the moment at both member ends.
                </Text>

                <Divider />

                <Section title="The two modes">
                    <Table fz="sm" withTableBorder withColumnBorders>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th />
                                <Table.Th>Static</Table.Th>
                                <Table.Th>Dynamic</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            <Table.Tr>
                                <Table.Td fw={600}>Element</Table.Td>
                                <Table.Td>Beam element, moment-rigid unless a hinge is defined</Table.Td>
                                <Table.Td>Pin-jointed truss member (moment released at both ends)</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td fw={600}>Nodal DOFs</Table.Td>
                                <Table.Td style={MONO}>D1, D2, D3</Table.Td>
                                <Table.Td style={MONO}>D1, D2</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td fw={600}>Inputs</Table.Td>
                                <Table.Td>Nodal loads and moments, element loads, hinges, supports incl. rotation</Table.Td>
                                <Table.Td>Nodal masses, axial dampers, initial conditions</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td fw={600}>Results</Table.Td>
                                <Table.Td>Deformed shape, N/Q/M diagrams, displacements, reactions</Table.Td>
                                <Table.Td>Animated response, time histories, eigenfrequencies, damping ratios, mode shapes</Table.Td>
                            </Table.Tr>
                        </Table.Tbody>
                    </Table>
                    <Text size="xs" c="dimmed">
                        Rotational degrees of freedom and loading in Dynamic mode are planned.
                    </Text>
                </Section>

                <Section title="Theory and methods">
                    <Text size="sm">
                        The implementation follows the classical displacement (direct stiffness) method for
                        plane frames.
                    </Text>
                    <List size="sm" spacing={6}>
                        <List.Item>
                            <b>Discretisation.</b> Every node carries three degrees of freedom — horizontal
                            displacement <Code>D1</Code>, vertical displacement <Code>D2</Code> and
                            rotation <Code>D3</Code>. Nodes may additionally be given a rotation angle, which
                            rotates their local coordinate system and thus allows inclined supports and skewed
                            connections.
                        </List.Item>
                        <List.Item>
                            <b>Element.</b> Two-node Euler–Bernoulli beam element with axial
                            stiffness <Code>EA</Code> and bending stiffness <Code>EI</Code>, i.e. the standard
                            6×6 local stiffness matrix (<i>Grundelement 1</i>), transformed per element end into
                            global coordinates and assembled into the global matrices.
                        </List.Item>
                        <List.Item>
                            <b>Hinges.</b> Releases of the normal force, shear force and/or bending moment at an
                            element end are realised by static condensation of the released local
                            DOFs, <Code>K_rr − K_rc·K_cc⁻¹·K_cr</Code>. Fixed-end forces from element loads are
                            condensed consistently.
                        </List.Item>
                        <List.Item>
                            <b>Loads.</b> Nodal loads with magnitude and direction; nodal moments
                            (positive counter-clockwise); trapezoidal element
                            loads <Code>qᵢ</Code>/<Code>qⱼ</Code> converted into consistent fixed-end forces.
                        </List.Item>
                        <List.Item>
                            <b>Static solution.</b> LU solution of <Code>K₁₁·w₁ = f₁</Code> for the free DOFs;
                            support reactions from <Code>r₂ = K₁₂·w₁</Code>.
                        </List.Item>
                        <List.Item>
                            <b>Deformed shape.</b> Not straight lines between displaced nodes: along each member
                            the displacement field is evaluated as a cubic Hermite interpolation of the nodal DOFs
                            plus the analytical particular solution of the distributed load. At hinged ends the
                            true end slope is back-calculated from <Code>M = 0</Code>.
                        </List.Item>
                        <List.Item>
                            <b>Internal forces.</b> From the same field: <Code>N = EA/L·(uⱼ − uᵢ)</Code>, <Code>M = EI·v″</Code>, <Code>Q = dM/dx</Code>.
                        </List.Item>
                        <List.Item>
                            <b>Kinematic systems.</b> Zero eigenvalues of <Code>K₁₁</Code> identify mechanisms.
                            The app flags them and animates the corresponding kinematic modes.
                        </List.Item>
                    </List>
                </Section>

                <Section title="Damping and the dynamic solution">
                    <Text size="sm">
                        Mass is lumped per node. Each element may carry a viscous axial damper <Code>c</Code> —
                        a dashpot in parallel with the axial spring of the member. Element damping matrices are
                        condensed, rotated and assembled into a global damping matrix <Code>C</Code> exactly like
                        the stiffness matrices.
                    </Text>
                    <Text size="sm">
                        The damped equation of motion is solved in the <b>standard form of the damped eigenvalue
                        problem</b>: the second-order system is rewritten as a first-order state-space system
                        in <Code>[w, ẇ]</Code> with
                    </Text>
                    <Code block>{`A = [   0        I   ]
    [ −M⁻¹K   −M⁻¹C  ]`}</Code>
                    <Text size="sm">
                        whose complex eigenvalues <Code>λ = σ ± i·ω_d</Code> and eigenvectors give the free
                        response <Code>w(t) = Σ φ_r·c_r·e^(λ_r·t)</Code>. The coefficients <Code>c_r</Code> follow
                        from the initial displacements and velocities.
                    </Text>
                    <Table fz="sm" withTableBorder>
                        <Table.Tbody>
                            <Table.Tr>
                                <Table.Td>Undamped natural frequency</Table.Td>
                                <Table.Td style={MONO}>ω_n = |λ| = √(σ² + ω_d²)</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>Damped natural frequency</Table.Td>
                                <Table.Td style={MONO}>ω_d = Im λ</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>Damping ratio</Table.Td>
                                <Table.Td style={MONO}>ζ = −σ / ω_n</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>Period</Table.Td>
                                <Table.Td style={MONO}>T = 2π / ω_d</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>Resonance frequency</Table.Td>
                                <Table.Td style={MONO}>ω_r = ω_n·√(1 − 2ζ²)&nbsp;&nbsp;(only for ζ &lt; 1/√2)</Table.Td>
                            </Table.Tr>
                        </Table.Tbody>
                    </Table>
                    <Blockquote fz="sm" p="sm">
                        The damping formulation follows <i>Structural Dynamics</i>, section 8.2.3.2 —
                        “The standard form of the damped eigenvalue problem”.
                    </Blockquote>
                </Section>

                <Section title="Sign conventions">
                    <List size="sm" spacing={4}>
                        <List.Item><Code>x</Code> horizontal (positive to the right), <Code>z</Code> vertical (positive upwards)</List.Item>
                        <List.Item><Code>D3</Code> (rotation) counter-clockwise, in radians</List.Item>
                        <List.Item>Nodal load angle: <Code>0°</Code> = downwards, <Code>90°</Code> = to the right</List.Item>
                        <List.Item>Element load angle: <Code>0°</Code> = perpendicular to the member axis, <Code>90°</Code> = along the axis</List.Item>
                        <List.Item><Code>N &gt; 0</Code> tension, <Code>M &gt; 0</Code> sagging, <Code>Q = dM/dx</Code></List.Item>
                    </List>
                    <Text size="sm">
                        The tool is unit-agnostic and performs no conversion — use any consistent set of units
                        (e.g. m, kN, kNm², kg, s).
                    </Text>
                </Section>

                <Section title="Working with the app">
                    <List size="sm" spacing={4}>
                        <List.Item><b>Edit</b> switches between the editor and the analysis views.</List.Item>
                        <List.Item>In the Static view, click an element or a node to inspect it in the side panel; click a diagram to enlarge it.</List.Item>
                        <List.Item>Deformation and diagram scales are adjusted with the sliders in the bottom bar.</List.Item>
                        <List.Item><b>Export</b> / <b>Import</b> saves and reloads the complete system as a named JSON file.</List.Item>
                    </List>
                </Section>

                <Section title="Limitations">
                    <List size="sm" spacing={4}>
                        <List.Item>Dynamic mode: free vibration from initial conditions; forced response and rotational DOFs are planned.</List.Item>
                        <List.Item>Every free node in Dynamic mode needs a non-zero mass — a zero mass makes the mass matrix singular.</List.Item>
                        <List.Item>Geometrically and materially linear analysis only: no buckling, plasticity, temperature or prestress loading.</List.Item>
                    </List>
                </Section>

                <Divider />

                <Text size="xs" c="dimmed">
                    Developed by Christoph Markefka.
                </Text>

            </Stack>
        </Modal>
    );
}
