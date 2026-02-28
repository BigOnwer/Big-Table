"use client"

import { useMemo } from "react"
import type { CellData } from "@/hooks/use-spreadsheet"

type StatusBarProps = {
  cells: Record<string, CellData>
  selectionRange: {
    start: { row: number; col: number }
    end: { row: number; col: number }
  } | null
  getCell: (row: number, col: number) => CellData
}

export function StatusBar({ cells, selectionRange, getCell }: StatusBarProps) {
  const stats = useMemo(() => {
    if (!selectionRange) return null

    const { start, end } = selectionRange
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    const values: number[] = []
    let count = 0

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = getCell(r, c)
        if (cell.value) {
          count++
          const num = parseFloat(cell.value)
          if (!isNaN(num)) values.push(num)
        }
      }
    }

    if (values.length === 0) return { count, sum: 0, avg: 0 }

    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length

    return { count, sum, avg }
  }, [selectionRange, getCell])

  const cellCount = Object.keys(cells).filter((k) => cells[k].value).length

  return (
    <div className="flex items-center justify-between px-3 h-7 bg-cell-header border-t border-border text-xs text-muted-foreground shrink-0">
      <div className="flex items-center gap-4">
        <span>{cellCount} celulas preenchidas</span>
      </div>
      {stats && stats.count > 0 && (
        <div className="flex items-center gap-4">
          <span>
            Contagem: <strong className="text-foreground">{stats.count}</strong>
          </span>
          {stats.sum !== 0 && (
            <span>
              Soma: <strong className="text-foreground">{stats.sum.toFixed(2)}</strong>
            </span>
          )}
          {stats.avg !== 0 && (
            <span>
              Media: <strong className="text-foreground">{stats.avg.toFixed(2)}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
