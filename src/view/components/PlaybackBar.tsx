import { useRef, useEffect } from "react";
import { ActionIcon, Checkbox, Divider, Group, NumberInput, Paper, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconRotateClockwise } from '@tabler/icons-react';
import { useAnimationStore } from "../../store/animationStore";

function TimeDisplay() {
    const ref = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        return useAnimationStore.subscribe(state => {
            if (ref.current) ref.current.textContent = `${state.time.toFixed(2)} s`;
        });
    }, []);
    return <Text ref={ref} fw={500} size="sm" w={60}>{useAnimationStore.getState().time.toFixed(2)} s</Text>;
}

interface PlaybackBarProps {
    speed: number;
    onSpeedChange: (v: number) => void;
    isRunning: boolean;
    onToggle: () => void;
    onRestart: () => void;
    showUndeformedSystem: boolean;
    onShowUndeformedChange: (v: boolean) => void;
    showNodes: boolean;
    onShowNodesChange: (v: boolean) => void;
    showBearings: boolean;
    onShowBearingsChange: (v: boolean) => void;
    leftExtra?: React.ReactNode;
}

export function PlaybackBar({
    speed, onSpeedChange,
    isRunning, onToggle, onRestart,
    showUndeformedSystem, onShowUndeformedChange,
    showNodes, onShowNodesChange,
    showBearings, onShowBearingsChange,
    leftExtra,
}: PlaybackBarProps) {
    return (
        <Paper px="xl" py="xs" shadow="xl" withBorder style={{ zIndex: 100, borderRadius: 0, flexShrink: 0 }}>
            <Group justify="space-between" align="center">

                <Group gap="xs" align="center">
                    <TimeDisplay />
                    <Divider orientation="vertical" color="gray.3" />
                    <Text size="sm">Speed</Text>
                    <NumberInput
                        value={speed}
                        onChange={(v) => onSpeedChange(Number(v) || 1)}
                        w={60}
                        size="sm"
                        step={0.1}
                        min={0.1}
                        hideControls
                    />
                    {leftExtra && <>
                        <Divider orientation="vertical" color="gray.3" />
                        {leftExtra}
                    </>}
                </Group>

                <Group gap="xs">
                    <ActionIcon
                        onClick={onToggle}
                        color={isRunning ? 'orange' : 'green'}
                        variant="light"
                        size="lg"
                        aria-label={isRunning ? "Pause" : "Resume"}
                    >
                        {isRunning ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}
                    </ActionIcon>
                    <ActionIcon onClick={onRestart} variant="default" size="lg" aria-label="Restart">
                        <IconRotateClockwise size={20} />
                    </ActionIcon>
                </Group>

                <Group gap="xs" align="center">
                    <Checkbox
                        label="Show Undeformed"
                        checked={showUndeformedSystem}
                        onChange={(e) => onShowUndeformedChange(e.currentTarget.checked)}
                        size="sm"
                    />
                    <Checkbox
                        label="Show Nodes"
                        checked={showNodes}
                        onChange={(e) => onShowNodesChange(e.currentTarget.checked)}
                        size="sm"
                    />
                    <Checkbox
                        label="Show Bearings"
                        checked={showBearings}
                        onChange={(e) => onShowBearingsChange(e.currentTarget.checked)}
                        size="sm"
                    />
                </Group>

            </Group>
        </Paper>
    );
}
