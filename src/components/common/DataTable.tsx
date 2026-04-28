import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Array<Column<T>>
  data: T[]
  emptyText?: string
}

export function DataTable<T>({ columns, data, emptyText = 'Aucune donnée' }: DataTableProps<T>) {
  if (!data.length) {
    return <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">{emptyText}</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="divide-y divide-zinc-200 md:hidden">
        {data.map((row, rowIndex) => (
          <article key={rowIndex} className="space-y-2 p-3">
            {columns.map((column) => (
              <div key={column.key} className="grid grid-cols-[120px_1fr] items-start gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{column.header}</p>
                <div className="text-sm text-zinc-700">{column.render(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full">
          <thead className="bg-zinc-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-zinc-200">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-sm text-zinc-700">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
