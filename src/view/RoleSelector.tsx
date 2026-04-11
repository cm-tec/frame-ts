import { Select } from "@mantine/core";
import { Support } from "./Support";

export default function SupportSelector({ currentValue, onChange }: { currentValue: Support, onChange: (newValue: Support) => void }) {

    return (
        <Select
            data={Object.values(Support)}
            value={currentValue.toString()}
            onChange={(v) => { if (v !== null) onChange(Support[v as keyof typeof Support]); }}
        />
    );
}