import React, { useState } from 'react';
import { Table, TextInput, Button, Group } from '@mantine/core';

type Node = {
    id: number;
    x: number;
    z: number; // keep as string for simple inline editing
};

export default function Editor() {
    const [rows, setRows] = useState<Node[]>([
        { id: 1, x: 1, z: 0 },
        { id: 2, x: 2, z: 1 },
    ]);

    const updateCell = (id: number, key: keyof Omit<Node, 'id'>, value: string) => {
        setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    };

    const addRow = () => {
        const nextId = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
        setRows((r) => [...r, { id: nextId, x: 0, z: 0 }]);
    };

    return (
        <>




            <Table highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Id</Table.Th>
                        <Table.Th>x</Table.Th>
                        <Table.Th>z</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {
                        rows.map((row) => (
                            <Table.Tr key={row.id}>
                                <Table.Td>{row.id}</Table.Td>
                                <Table.Td>
                                    <TextInput
                                        value={row.x}
                                        onChange={(e) => updateCell(row.id, 'x', e.currentTarget.value)}
                                        placeholder="Name"
                                        variant="unstyled"
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <TextInput
                                        value={row.z}
                                        onChange={(e) => updateCell(row.id, 'z', e.currentTarget.value)}
                                        placeholder="Age"
                                        variant="unstyled"
                                    />
                                </Table.Td>
                            </Table.Tr>
                        ))
                    }
                </Table.Tbody>
            </Table>
            <Button onClick={addRow}>Add row</Button>

        </>
    );
}
