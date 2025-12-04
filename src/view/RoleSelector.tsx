import { Combobox, Input, InputBase, ScrollArea, Select, useCombobox } from "@mantine/core";
import { useState } from "react";
import { Support } from "./Support";

export default function SupportSelector({ currentValue, onChange }: { currentValue: Support, onChange: (newValue: Support) => void }) {

    return (
        <Select
            data={Object.values(Support)}
            value={currentValue.toString()}
            onChange={(v) => onChange(Support[v])}
        />
    );
}