import { AspectRatio, Badge, Button, Card, Center, Code, Container, Group, Image, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconFileImport, IconInfoCircle, IconPencilPlus, IconPhotoOff } from '@tabler/icons-react';

import type { Example } from '../../examples';
import type { SystemFile } from '../../models/systemFile';

interface WelcomeProps {
    examples: Example[];
    onSelect: (data: SystemFile) => void;
    onStartFromScratch: () => void;
    onImport: () => void;
    onAbout: () => void;
}

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

export default function Welcome({ examples, onSelect, onStartFromScratch, onImport, onAbout }: WelcomeProps) {
    return (
        <Container size="lg" py={60}>
            <Stack gap={4} mb="xl">
                <Group gap="xs" align="baseline">
                    <Title order={1}>FrameTS</Title>
                    <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconInfoCircle size={16} />} onClick={onAbout}>
                        About
                    </Button>
                </Group>
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
        </Container>
    );
}
