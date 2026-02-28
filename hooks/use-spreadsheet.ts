"use client"

import { useState, useCallback, useRef } from "react"

export const ROWS = 50
export const COLS = 26

export type CellStyle = {
  bold: boolean
  italic: boolean
  underline: boolean
  align: "left" | "center" | "right"
  fontSize: number
  bgColor: string
  textColor: string
}

export type CellData = {
  value: string
  formula: string
  style: CellStyle
}

type HistoryEntry = {
  cells: Record<string, CellData>
}

const defaultStyle: CellStyle = {
  bold: false,
  italic: false,
  underline: false,
  align: "left",
  fontSize: 13,
  bgColor: "",
  textColor: "",
}

function getColLetter(col: number): string {
  return String.fromCharCode(65 + col)
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z])(\d+)$/)
  if (!match) return null
  return { col: match[1].charCodeAt(0) - 65, row: parseInt(match[2]) - 1 }
}

function parseRange(range: string): { row: number; col: number }[] {
  const [start, end] = range.split(":")
  const s = parseCellRef(start)
  const e = parseCellRef(end)
  if (!s || !e) return []
  const cells: { row: number; col: number }[] = []
  for (let r = Math.min(s.row, e.row); r <= Math.max(s.row, e.row); r++) {
    for (let c = Math.min(s.col, e.col); c <= Math.max(s.col, e.col); c++) {
      cells.push({ row: r, col: c })
    }
  }
  return cells
}

function getCellKey(row: number, col: number): string {
  return `${getColLetter(col)}${row + 1}`
}

export function useSpreadsheet() {
  const [cells, setCells] = useState<Record<string, CellData>>({})
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 })
  const [selectionRange, setSelectionRange] = useState<{
    start: { row: number; col: number }
    end: { row: number; col: number }
  } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [clipboard, setClipboard] = useState<{ key: string; data: CellData }[] | null>(null)

  const historyRef = useRef<HistoryEntry[]>([{ cells: {} }])
  const historyIndexRef = useRef(0)

  const pushHistory = useCallback((newCells: Record<string, CellData>) => {
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    newHistory.push({ cells: JSON.parse(JSON.stringify(newCells)) })
    if (newHistory.length > 100) newHistory.shift()
    historyRef.current = newHistory
    historyIndexRef.current = newHistory.length - 1
  }, [])

  const getCell = useCallback(
    (row: number, col: number): CellData => {
      const key = getCellKey(row, col)
      return cells[key] || { value: "", formula: "", style: { ...defaultStyle } }
    },
    [cells]
  )

  const evaluateFormula = useCallback(
    (formula: string, cellsData: Record<string, CellData>): string => {
      if (!formula.startsWith("=")) return formula

      const expr = formula.substring(1).toUpperCase()

      const funcMatch = expr.match(/^(SOMA|SUM|MEDIA|AVERAGE|AVG|CONTAR|COUNT|MAX|MIN|CONCATENAR|CONCAT)\((.+)\)$/i)
      if (funcMatch) {
        const func = funcMatch[1].toUpperCase()
        const args = funcMatch[2]

        const getValues = (argStr: string): number[] => {
          const values: number[] = []
          const parts = argStr.split(",").map((s) => s.trim())
          for (const part of parts) {
            if (part.includes(":")) {
              const rangeCells = parseRange(part)
              for (const cell of rangeCells) {
                const key = getCellKey(cell.row, cell.col)
                const cd = cellsData[key]
                const val = cd ? parseFloat(cd.value) : 0
                if (!isNaN(val)) values.push(val)
              }
            } else {
              const ref = parseCellRef(part)
              if (ref) {
                const key = getCellKey(ref.row, ref.col)
                const cd = cellsData[key]
                const val = cd ? parseFloat(cd.value) : 0
                if (!isNaN(val)) values.push(val)
              } else {
                const val = parseFloat(part)
                if (!isNaN(val)) values.push(val)
              }
            }
          }
          return values
        }

        const getStringValues = (argStr: string): string[] => {
          const values: string[] = []
          const parts = argStr.split(",").map((s) => s.trim())
          for (const part of parts) {
            if (part.startsWith('"') && part.endsWith('"')) {
              values.push(part.slice(1, -1))
            } else {
              const ref = parseCellRef(part)
              if (ref) {
                const key = getCellKey(ref.row, ref.col)
                const cd = cellsData[key]
                values.push(cd?.value || "")
              }
            }
          }
          return values
        }

        switch (func) {
          case "SOMA":
          case "SUM": {
            const vals = getValues(args)
            return vals.reduce((a, b) => a + b, 0).toString()
          }
          case "MEDIA":
          case "AVERAGE":
          case "AVG": {
            const vals = getValues(args)
            return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toString() : "0"
          }
          case "CONTAR":
          case "COUNT": {
            const vals = getValues(args)
            return vals.length.toString()
          }
          case "MAX": {
            const vals = getValues(args)
            return vals.length > 0 ? Math.max(...vals).toString() : "0"
          }
          case "MIN": {
            const vals = getValues(args)
            return vals.length > 0 ? Math.min(...vals).toString() : "0"
          }
          case "CONCATENAR":
          case "CONCAT": {
            const vals = getStringValues(args)
            return vals.join("")
          }
          default:
            return "#ERRO"
        }
      }

      // Simple arithmetic with cell references
      try {
        let evalExpr = expr
        const cellRefs = expr.match(/[A-Z]\d+/g) || []
        for (const ref of cellRefs) {
          const parsed = parseCellRef(ref)
          if (parsed) {
            const key = getCellKey(parsed.row, parsed.col)
            const cd = cellsData[key]
            const val = cd ? (parseFloat(cd.value) || 0) : 0
            evalExpr = evalExpr.replace(ref, val.toString())
          }
        }
        // Only allow safe math characters
        if (/^[0-9+\-*/().%\s]+$/.test(evalExpr)) {
          const result = new Function(`return (${evalExpr})`)()
          if (typeof result === "number" && !isNaN(result)) {
            return Number.isInteger(result) ? result.toString() : result.toFixed(2)
          }
        }
        return "#ERRO"
      } catch {
        return "#ERRO"
      }
    },
    []
  )

  const setCellValue = useCallback(
    (row: number, col: number, rawValue: string) => {
      setCells((prev) => {
        const key = getCellKey(row, col)
        const existing = prev[key] || { value: "", formula: "", style: { ...defaultStyle } }
        const isFormula = rawValue.startsWith("=")
        const newCells = {
          ...prev,
          [key]: {
            ...existing,
            formula: isFormula ? rawValue : "",
            value: isFormula ? evaluateFormula(rawValue, prev) : rawValue,
          },
        }
        // re-evaluate all formula cells
        for (const [k, cell] of Object.entries(newCells)) {
          if (cell.formula) {
            newCells[k] = { ...cell, value: evaluateFormula(cell.formula, newCells) }
          }
        }
        pushHistory(newCells)
        return newCells
      })
    },
    [evaluateFormula, pushHistory]
  )

  const setCellStyle = useCallback(
    (row: number, col: number, style: Partial<CellStyle>) => {
      setCells((prev) => {
        const key = getCellKey(row, col)
        const existing = prev[key] || { value: "", formula: "", style: { ...defaultStyle } }
        const newCells = {
          ...prev,
          [key]: {
            ...existing,
            style: { ...existing.style, ...style },
          },
        }
        pushHistory(newCells)
        return newCells
      })
    },
    [pushHistory]
  )

  const setStyleForSelection = useCallback(
    (style: Partial<CellStyle>) => {
      if (selectionRange) {
        const { start, end } = selectionRange
        const minRow = Math.min(start.row, end.row)
        const maxRow = Math.max(start.row, end.row)
        const minCol = Math.min(start.col, end.col)
        const maxCol = Math.max(start.col, end.col)
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            setCellStyle(r, c, style)
          }
        }
      } else if (selectedCell) {
        setCellStyle(selectedCell.row, selectedCell.col, style)
      }
    },
    [selectedCell, selectionRange, setCellStyle]
  )

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      setCells(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current].cells)))
    }
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      setCells(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current].cells)))
    }
  }, [])

  const copy = useCallback(() => {
    if (!selectedCell) return
    if (selectionRange) {
      const { start, end } = selectionRange
      const items: { key: string; data: CellData }[] = []
      for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
        for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
          items.push({ key: getCellKey(r, c), data: JSON.parse(JSON.stringify(getCell(r, c))) })
        }
      }
      setClipboard(items)
    } else {
      setClipboard([{ key: getCellKey(selectedCell.row, selectedCell.col), data: JSON.parse(JSON.stringify(getCell(selectedCell.row, selectedCell.col))) }])
    }
  }, [selectedCell, selectionRange, getCell])

  const paste = useCallback(() => {
    if (!selectedCell || !clipboard || clipboard.length === 0) return
    setCells((prev) => {
      const newCells = { ...prev }
      if (clipboard.length === 1) {
        const key = getCellKey(selectedCell.row, selectedCell.col)
        newCells[key] = JSON.parse(JSON.stringify(clipboard[0].data))
      } else {
        // figure out offset
        const firstRef = parseCellRef(clipboard[0].key)
        if (firstRef) {
          for (const item of clipboard) {
            const ref = parseCellRef(item.key)
            if (ref) {
              const newRow = selectedCell.row + (ref.row - firstRef.row)
              const newCol = selectedCell.col + (ref.col - firstRef.col)
              if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                const newKey = getCellKey(newRow, newCol)
                newCells[newKey] = JSON.parse(JSON.stringify(item.data))
              }
            }
          }
        }
      }
      pushHistory(newCells)
      return newCells
    })
  }, [selectedCell, clipboard, pushHistory])

  const deleteSelection = useCallback(() => {
    if (selectionRange) {
      setCells((prev) => {
        const newCells = { ...prev }
        const { start, end } = selectionRange
        for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
          for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
            delete newCells[getCellKey(r, c)]
          }
        }
        pushHistory(newCells)
        return newCells
      })
    } else if (selectedCell) {
      setCells((prev) => {
        const newCells = { ...prev }
        delete newCells[getCellKey(selectedCell.row, selectedCell.col)]
        pushHistory(newCells)
        return newCells
      })
    }
  }, [selectedCell, selectionRange, pushHistory])

  const getSelectedValues = useCallback((): number[] => {
    const values: number[] = []
    if (selectionRange) {
      const { start, end } = selectionRange
      const minRow = Math.min(start.row, end.row)
      const maxRow = Math.max(start.row, end.row)
      const minCol = Math.min(start.col, end.col)
      const maxCol = Math.max(start.col, end.col)
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const cell = getCell(r, c)
          if (cell.value) {
            const num = parseFloat(cell.value)
            if (!isNaN(num)) values.push(num)
          }
        }
      }
    } else if (selectedCell) {
      const cell = getCell(selectedCell.row, selectedCell.col)
      if (cell.value) {
        const num = parseFloat(cell.value)
        if (!isNaN(num)) values.push(num)
      }
    }
    return values
  }, [selectionRange, selectedCell, getCell])

  const getSelectionRangeRef = useCallback((): string => {
    if (selectionRange) {
      const { start, end } = selectionRange
      const minRow = Math.min(start.row, end.row)
      const maxRow = Math.max(start.row, end.row)
      const minCol = Math.min(start.col, end.col)
      const maxCol = Math.max(start.col, end.col)
      return `${getCellKey(minRow, minCol)}:${getCellKey(maxRow, maxCol)}`
    }
    if (selectedCell) {
      return getCellKey(selectedCell.row, selectedCell.col)
    }
    return ""
  }, [selectionRange, selectedCell])

  const applyFunctionToSelection = useCallback(
    (funcName: string): { result: string; targetRow: number; targetCol: number } | null => {
      const values = getSelectedValues()
      if (values.length === 0) return null

      let result: number
      switch (funcName) {
        case "SOMA":
        case "SUM":
          result = values.reduce((a, b) => a + b, 0)
          break
        case "MEDIA":
        case "AVERAGE":
        case "AVG":
          result = values.reduce((a, b) => a + b, 0) / values.length
          break
        case "CONTAR":
        case "COUNT":
          result = values.length
          break
        case "MAX":
          result = Math.max(...values)
          break
        case "MIN":
          result = Math.min(...values)
          break
        default:
          return null
      }

      // Find the target cell: row below the selection range, first column of the range
      let targetRow: number
      let targetCol: number

      if (selectionRange) {
        const { start, end } = selectionRange
        targetRow = Math.max(start.row, end.row) + 1
        targetCol = Math.min(start.col, end.col)
      } else if (selectedCell) {
        targetRow = selectedCell.row + 1
        targetCol = selectedCell.col
      } else {
        return null
      }

      if (targetRow >= ROWS) targetRow = ROWS - 1

      const rangeRef = getSelectionRangeRef()
      const formula = `=${funcName}(${rangeRef})`
      const resultStr = Number.isInteger(result) ? result.toString() : result.toFixed(2)

      // Set the formula in the target cell
      setCellValue(targetRow, targetCol, formula)

      // Select the target cell
      setSelectedCell({ row: targetRow, col: targetCol })
      setSelectionRange(null)

      return { result: resultStr, targetRow, targetCol }
    },
    [getSelectedValues, getSelectionRangeRef, selectionRange, selectedCell, setCellValue, setSelectedCell, setSelectionRange]
  )

  const getSelectedCellRef = useCallback(() => {
    if (!selectedCell) return ""
    return getCellKey(selectedCell.row, selectedCell.col)
  }, [selectedCell])

  return {
    cells,
    selectedCell,
    setSelectedCell,
    selectionRange,
    setSelectionRange,
    editingCell,
    setEditingCell,
    getCell,
    setCellValue,
    setCellStyle,
    setStyleForSelection,
    undo,
    redo,
    copy,
    paste,
    deleteSelection,
    getSelectedCellRef,
    getSelectedValues,
    applyFunctionToSelection,
    getColLetter,
    getCellKey,
  }
}

export { getColLetter, getCellKey }
