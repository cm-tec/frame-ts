import { AspectRatio, Badge, Button, Card, Center, Code, Container, Divider, Group, Image, List, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconFileImport, IconPencilPlus, IconPhotoOff } from '@tabler/icons-react';

import type { Example } from '../../examples';
import type { SystemFile } from '../../models/systemFile';

interface WelcomeProps {
    examples: Example[];
    onSelect: (data: SystemFile) => void;
    onStartFromScratch: () => void;
    onImport: () => void;
}

const MONO = { fontFamily: 'monospace' } as const;

// Falls back to a description of the structure when the file carries no `description`.
function summarise({ nodes = [], elements = [], hinges = [], loads }: SystemFile): string {
    const parts = [
        `${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'}`,
        `${elements.length} ${elements.length === 1 ? 'element' : 'elements'}`,
    ];
    if (hinges.length > 0) parts.push(`${hinges.length} ${hinges.length === 1 ? 'hinge' : 'hinges'}`);

    const loadCount = (loads?.nodes.length ?? 0) + (loads?.elements.length ?? 0);
    if (loadCount > 0) parts.push(`${loadCount} ${loadCount === 1 ? 'load' : 'loads'}`);

    return parts.join(' · ');
}

function ExampleCard({ example, onSelect }: { example: Example; onSelect: () => void }) {
    const { data } = example;

    return (
        <Card
            withBorder
            radius="md"
            padding="md"
            onClick={onSelect}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
        >
            <Card.Section withBorder>
                <AspectRatio ratio={16 / 10} bg="var(--mantine-color-gray-0)">
                    {example.thumbnail
                        ? <Image src={example.thumbnail} alt="" fit="contain" />
                        : (
                            <Center>
                                <Stack align="center" gap={4}>
                                    <IconPhotoOff size={22} color="var(--mantine-color-gray-5)" />
                                    <Text size="xs" c="dimmed">No thumbnail</Text>
                                </Stack>
                            </Center>
                        )}
                </AspectRatio>
            </Card.Section>

            <Group justify="space-between" wrap="nowrap" mt="sm" mb={4}>
                <Text fw={600} lineClamp={1}>{example.name}</Text>
                <Badge variant="light" color={data.view === 'static' ? 'blue' : 'grape'} size="sm">
                    {data.view === 'static' ? 'Static' : 'Dynamic'}
                </Badge>
            </Group>

            <Text size="sm" c="dimmed" lineClamp={2}>
                {example.description ?? summarise(data)}
            </Text>
        </Card>
    );
}

function EmptyState() {
    return (
        <Card withBorder radius="md" padding="xl">
            <Stack gap="xs">
                <Text fw={600}>No examples yet</Text>
                <Text size="sm" c="dimmed">
                    Build a structure in the editor, then save it twice: <b>Export</b> for the data and the
                    <b> camera button</b> for the picture. Drop both files into <Code>src/examples/</Code> using
                    the same base name — <Code>warren-truss.json</Code> and <Code>warren-truss.png</Code> — and
                    it shows up here.
                </Text>
            </Stack>
        </Card>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <Title order={2} mb="sm">{title}</Title>
            <Stack gap="sm">{children}</Stack>
        </div>
    );
}

export default function Welcome({ examples, onSelect, onStartFromScratch, onImport }: WelcomeProps) {
    return (
        <Container size="lg" py={60}>
            <Stack gap={4} mb="xl">
                <Title order={1}>FrameTS</Title>
                <Text c="dimmed">
                    Static and dynamic analysis of plane frames. Pick an example to explore, or start your own.
                </Text>
            </Stack>

            {examples.length === 0
                ? <EmptyState />
                : (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {examples.map(example => (
                            <ExampleCard key={example.key} example={example} onSelect={() => onSelect(example.data)} />
                        ))}
                    </SimpleGrid>
                )}

            <Group mt="xl" gap="sm">
                <Button variant="default" leftSection={<IconPencilPlus size={16} />} onClick={onStartFromScratch}>
                    Start from scratch
                </Button>
                <Button variant="default" leftSection={<IconFileImport size={16} />} onClick={onImport}>
                    Import a file
                </Button>
            </Group>

            <Divider my={50} />

            <Stack gap={50}>

                <Section title="Capabilities">
                    <Text size="sm">
                        Plane (2D) frame and truss structures, analysed in the browser. No data leaves your
                        machine. The element is always a full Euler Bernoulli beam; a truss member is the
                        special case with the moment released at both ends.
                    </Text>

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Card withBorder radius="md" padding="md">
                            <Text fw={600} mb={6}>Static</Text>
                            <List size="sm" spacing={4}>
                                <List.Item>Deformed shape of the loaded structure</List.Item>
                                <List.Item>Normal force, shear force and bending moment diagrams</List.Item>
                                <List.Item>Nodal displacements and support reactions</List.Item>
                                <List.Item>Nodal loads and moments, distributed element loads, hinges</List.Item>
                            </List>
                        </Card>

                        <Card withBorder radius="md" padding="md">
                            <Text fw={600} mb={6}>Dynamic</Text>
                            <List size="sm" spacing={4}>
                                <List.Item>Animated free vibration from initial conditions</List.Item>
                                <List.Item>Displacement and velocity time histories per DOF</List.Item>
                                <List.Item>Eigenfrequencies, damping ratios and animated mode shapes</List.Item>
                                <List.Item>Nodal masses and viscous axial dampers</List.Item>
                            </List>
                        </Card>
                    </SimpleGrid>

                    <Text size="sm" c="dimmed">
                        Insufficiently supported systems are recognised as kinematic, and their mechanism is
                        animated instead of solved. Structures import and export as a single JSON file, and the
                        current view saves as a PNG.
                    </Text>
                </Section>

                <Section title="How to use?">
                    <List size="sm" spacing={6} type="ordered">
                        <List.Item>
                            Open an example above, or <b>Start from scratch</b> for an empty canvas.
                        </List.Item>
                        <List.Item>
                            Choose <b>Static</b> or <b>Dynamic</b> in the header. The mode decides which inputs
                            are shown and how the structure is modelled.
                        </List.Item>
                        <List.Item>
                            In <b>Edit</b>, fill the tables: node coordinates and supports <Code>D1</Code>/<Code>D2</Code>/<Code>D3</Code>,
                            elements with <Code>EA</Code>, <Code>EI</Code> and damper <Code>c</Code>, then hinges
                            and loads, or masses and initial conditions. The blueprint next to the tables updates
                            as you type.
                        </List.Item>
                        <List.Item>
                            Switch to <b>Analyze</b> for the results. In the static view, click a node or an
                            element to read it out in the side panel, and click any diagram to enlarge it.
                        </List.Item>
                        <List.Item>
                            Scale the deformation and the diagrams with the sliders in the bottom bar, and use
                            the toggles there to show or hide supports, loads and reactions.
                        </List.Item>
                        <List.Item>
                            <b>Export</b> writes the whole structure as JSON, <b>Import</b> reads it back, and the
                            camera button saves the current view as a picture.
                        </List.Item>
                    </List>
                </Section>

                <Section title="How it works?">
                    <Text size="sm">
                        A classical displacement (direct stiffness) method for plane frames, linear in both
                        geometry and material.
                    </Text>

                    <List size="sm" spacing={6}>
                        <List.Item>
                            <b>Coordinates and DOFs.</b> <Code>x</Code> points right, <Code>z</Code> upwards.
                            Every node carries three degrees of freedom: horizontal <Code>D1</Code>,
                            vertical <Code>D2</Code> and rotation <Code>D3</Code>, counterclockwise in radians.
                            The solver also gives every node its own rotation angle, which turns its local axes
                            and so allows inclined supports and skewed connections. The editor does not expose
                            that angle yet, so it is always zero.
                        </List.Item>
                        <List.Item>
                            <b>Element.</b> Euler Bernoulli beam with two nodes, axial stiffness <Code>EA</Code> and
                            bending stiffness <Code>EI</Code>, i.e. the standard 6×6 local stiffness matrix. It is
                            rotated per element end into global coordinates and assembled into the global matrices.
                        </List.Item>
                        <List.Item>
                            <b>Hinges.</b> A released normal force, shear force or moment at an element end is
                            removed by static condensation, <Code>K_rr − K_rc·K_cc⁻¹·K_cr</Code>. Fixed end forces
                            from element loads are condensed the same way.
                        </List.Item>
                        <List.Item>
                            <b>Shape functions.</b> The element rests on a linear axial and a cubic Hermite
                            bending ansatz, <Code>N₁ … N₄</Code> in the normalised coordinate <Code>ξ = x/L</Code>.
                            They are what produces the closed form stiffness matrix above, and they are also how
                            a distributed load is carried to the nodes.
                        </List.Item>
                        <List.Item>
                            <b>Loads.</b> Nodal forces with magnitude and direction, nodal moments (positive
                            counterclockwise), and trapezoidal element loads <Code>qᵢ</Code>/<Code>qⱼ</Code>.
                            The element loads are integrated against the shape functions over the member,
                            <Code>ξ</Code> running from 0 to 1, to give consistent fixed end
                            forces: <Code>f = L·∫ q(ξ)·N(ξ) dξ</Code> for the translational entries
                            and <Code>L²·∫ q(ξ)·N(ξ) dξ</Code> for the rotational ones.
                        </List.Item>
                        <List.Item>
                            <b>Static solution.</b> The system is partitioned into free and restrained DOFs;
                            <Code>K₁₁·w₁ = f₁</Code> is solved by LU decomposition, and the reactions
                            follow from <Code>r₂ = K₁₂·w₁</Code>. Zero eigenvalues of <Code>K₁₁</Code> mark a
                            kinematic system, and their eigenvectors are the mechanism.
                        </List.Item>
                        <List.Item>
                            <b>Internal forces and deformed shape.</b> Both are obtained by integrating along the
                            member, starting from the nodal results and the loads acting on it.
                        </List.Item>
                    </List>

                    <Text size="sm">
                        <b>Dynamics.</b> Mass is lumped per node, and each element may carry a viscous axial
                        dashpot in parallel with its axial spring, condensed and assembled just like the
                        stiffness. The damped equation of motion is rewritten as a state space system of first order
                        in <Code>[w, ẇ]</Code>,
                    </Text>

                    <Code block>{`A = [   0        I    ]
    [ −M⁻¹K   −M⁻¹C ]`}</Code>

                    <Text size="sm">
                        whose complex eigenvalues <Code>λ = σ ± i·ω_d</Code> and eigenvectors give the free
                        response <Code>w(t) = Σ φ_r·c_r·e^(λ_r·t)</Code>, with the coefficients <Code>c_r</Code>
                        fixed by the initial displacements and velocities.
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
                        </Table.Tbody>
                    </Table>

                    <Text size="sm" c="dimmed">
                        The tool converts no units at all, so use any consistent set, for example m, kN, kNm²,
                        kg and s. Dynamic mode covers free vibration from initial conditions; forced response,
                        rotational DOFs and nodal rotation angles in the editor are planned, every free node
                        needs a mass other than zero, and there is no buckling, plasticity, temperature or
                        prestress.
                    </Text>
                </Section>

            </Stack>

            <Divider my={40} />

            <Text size="xs" c="dimmed">Developed by Christoph Markefka.</Text>
        </Container>
    );
}
