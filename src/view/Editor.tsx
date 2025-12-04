import "./Editor.css";

import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'


const data = [
    { id: 1, x: 2, z: 2, m: 3 },
    { id: 2, x: 0, z: 0, m: 3 }
]

const columns = [
    { accessorKey: 'id', header: 'Id' },
    { accessorKey: 'x', header: 'x' },
    { accessorKey: 'z', header: 'z' },
    { accessorKey: 'm', header: 'Mass' },
]


export default function Chart() {

    const table = useReactTable({
        data, columns, getCoreRowModel: getCoreRowModel(),
        enableColumnResizing: false,
        columnResizeMode: 'onChange',
    })

    return (
        <table>
            <thead>
                {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                        {headerGroup.headers.map(header => {
                            return (
                                <th
                                    key={header.id}
                                    colSpan={header.colSpan}
                                    style={{ position: 'relative', width: header.getSize() }}
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                    {header.column.getCanResize() && (
                                        <div
                                            onMouseDown={header.getResizeHandler()}
                                            onTouchStart={header.getResizeHandler()}
                                            className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                                        ></div>
                                    )}
                                </th>
                            )
                        })}
                    </tr>
                ))}
            </thead>
            <tbody>
                {table.getRowModel().rows.map(row => {
                    return (
                        <tr key={row.id}>
                            {row.getVisibleCells().map(cell => {
                                return (
                                    <td key={cell.id} style={{ width: cell.column.getSize() }}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </td>
                                )
                            })}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
} 