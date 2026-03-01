"use client"

import { useRef, useCallback, useEffect, useState } from "react"
import { ROWS, COLS, type CellData } from "@/hooks/use-spreadsheet"

type GridProps = {
  getCell: (row: number, col: number) => CellData
  selectedCell: { row: number; col: number } | null
  selectionRange: {
    start: { row: number; col: number }
    end: { row: number; col: number }
  } | null
  editingCell: { row: number; col: number } | null
  onCellSelect: (row: number, col: number) => void
  onSelectionChange: (range: {
    start: { row: number; col: number }
    end: { row: number; col: number }
  } | null) => void
  onCellEdit: (row: number, col: number) => void
  onCellValueChange: (row: number, col: number, value: string) => void
  onStopEditing: () => void
  getColLetter: (col: number) => string
}

const COL_WIDTH     = 100
const ROW_HEIGHT    = 28
const HEADER_WIDTH  = 46
const HEADER_HEIGHT = 28

function CellComponent({
  row, col, cellData,
  isSelected, isInRange, isEditing,
  onSelect, onStartEdit, onValueChange, onStopEditing,
  onStartRangeSelect, pendingChar, onConfirmAndMove,
}: {
  row: number
  col: number
  cellData: CellData
  isSelected: boolean
  isInRange: boolean
  isEditing: boolean
  onSelect: () => void
  onStartEdit: () => void
  onValueChange: (value: string) => void
  onStopEditing: () => void
  onStartRangeSelect: (row: number, col: number) => void
  pendingChar: string | null
  onConfirmAndMove: (value: string, direction: "down" | "right" | "none") => void
}) {
  const inputRef    = useRef<HTMLInputElement>(null)
  const [editValue, setEditValue] = useState("")

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const initial = pendingChar !== null
        ? pendingChar
        : (cellData.formula || cellData.value)
      setEditValue(initial)
      inputRef.current.focus()
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = initial.length
          inputRef.current.selectionEnd   = initial.length
        }
      }, 0)
    }
  }, [isEditing])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onConfirmAndMove(editValue, "down")
    } else if (e.key === "Tab") {
      e.preventDefault()
      onConfirmAndMove(editValue, "right")
    } else if (e.key === "Escape") {
      onStopEditing()
    }
  }

  const style: React.CSSProperties = {
    fontWeight:      cellData.style.bold      ? "bold"      : "normal",
    fontStyle:       cellData.style.italic    ? "italic"    : "normal",
    textDecoration:  cellData.style.underline ? "underline" : "none",
    textAlign:       cellData.style.align,
    fontSize:        cellData.style.fontSize,
    backgroundColor: cellData.style.bgColor   || undefined,
    color:           cellData.style.textColor  || undefined,
  }

  return (
    <div
      className={`absolute border-r border-b border-border transition-none select-none ${
        isSelected ? "ring-2 ring-primary ring-inset z-10" : isInRange ? "bg-cell-selected" : ""
      }`}
      style={{
        left:   HEADER_WIDTH  + col * COL_WIDTH,
        top:    HEADER_HEIGHT + row * ROW_HEIGHT,
        width:  COL_WIDTH,
        height: ROW_HEIGHT,
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return
        if (isSelected) {
          // Already selected → single click opens editor (no move-to-next)
          onStartEdit()
        } else {
          onSelect()
          onStartRangeSelect(row, col)
        }
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onConfirmAndMove(editValue, "none")}
          className="w-full h-full px-1.5 text-foreground bg-card outline-none font-mono"
          style={{ fontSize: cellData.style.fontSize }}
        />
      ) : (
        <div
          className="w-full h-full px-1.5 flex items-center overflow-hidden whitespace-nowrap text-foreground"
          style={style}
        >
          <span className="truncate w-full" style={{ textAlign: cellData.style.align }}>
            {cellData.value}
          </span>
        </div>
      )}
    </div>
  )
}

export function Grid({
  getCell, selectedCell, selectionRange, editingCell,
  onCellSelect, onSelectionChange, onCellEdit, onCellValueChange,
  onStopEditing, getColLetter,
}: GridProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const [scrollPos,   setScrollPos]   = useState({ top: 0, left: 0 })
  const [isDragging,  setIsDragging]  = useState(false)
  const [pendingChar, setPendingChar] = useState<string | null>(null)
  const dragStartRef  = useRef<{ row: number; col: number } | null>(null)

  // Keep a ref to selectedCell so keydown handler always has fresh value
  const selectedCellRef = useRef(selectedCell)
  useEffect(() => { selectedCellRef.current = selectedCell }, [selectedCell])
  const editingCellRef = useRef(editingCell)
  useEffect(() => { editingCellRef.current = editingCell }, [editingCell])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollPos({ top: containerRef.current.scrollTop, left: containerRef.current.scrollLeft })
    }
  }, [])

  const visibleStartRow = Math.max(0, Math.floor(scrollPos.top  / ROW_HEIGHT) - 2)
  const visibleEndRow   = Math.min(ROWS, visibleStartRow + Math.ceil((containerRef.current?.clientHeight || 800)  / ROW_HEIGHT) + 4)
  const visibleStartCol = Math.max(0, Math.floor(scrollPos.left / COL_WIDTH)  - 1)
  const visibleEndCol   = Math.min(COLS, visibleStartCol + Math.ceil((containerRef.current?.clientWidth  || 1200) / COL_WIDTH)  + 2)

  const isInRange = useCallback((row: number, col: number) => {
    if (!selectionRange) return false
    const { start, end } = selectionRange
    return row >= Math.min(start.row, end.row) && row <= Math.max(start.row, end.row)
        && col >= Math.min(start.col, end.col) && col <= Math.max(start.col, end.col)
  }, [selectionRange])

  // ── Confirm edit and optionally move selection ────────────────────────────
  const handleConfirmAndMove = useCallback((
    row: number, col: number, value: string, direction: "down" | "right" | "none"
  ) => {
    onCellValueChange(row, col, value)
    onStopEditing()
    if (direction === "down")  onCellSelect(Math.min(ROWS - 1, row + 1), col)
    if (direction === "right") onCellSelect(row, Math.min(COLS - 1, col + 1))
    // "none" (blur) → stay on same cell, no move
  }, [onCellValueChange, onStopEditing, onCellSelect])

  // ── Mouse drag ────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + containerRef.current.scrollLeft - HEADER_WIDTH
    const y = e.clientY - rect.top  + containerRef.current.scrollTop  - HEADER_HEIGHT
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_WIDTH)))
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor(y / ROW_HEIGHT)))
    onSelectionChange({ start: dragStartRef.current, end: { row, col } })
  }, [isDragging, onSelectionChange])

  const handleMouseUp = useCallback(() => { setIsDragging(false); dragStartRef.current = null }, [])

  useEffect(() => {
    const up = () => { setIsDragging(false); dragStartRef.current = null }
    window.addEventListener("mouseup", up)
    return () => window.removeEventListener("mouseup", up)
  }, [])

  const startRangeSelect = useCallback((row: number, col: number) => {
    dragStartRef.current = { row, col }
    setIsDragging(true)
    onSelectionChange(null)
  }, [onSelectionChange])

  // ── Global keyboard handler ───────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Ignore if focus is inside category panel or another unrelated input
      if (target.closest("[data-category-panel]")) return
      if (target.tagName === "INPUT" && !target.closest("[data-grid-container]")) return

      const cell    = selectedCellRef.current
      const editing = editingCellRef.current

      if (!cell) return

      // ── While editing: only Escape is handled here; Enter/Tab are in CellComponent ──
      if (editing) return

      // ── Arrow keys: navigate ──────────────────────────────────────────────
      if (e.key === "ArrowUp")    { e.preventDefault(); onCellSelect(Math.max(0, cell.row - 1), cell.col); onSelectionChange(null); return }
      if (e.key === "ArrowDown")  { e.preventDefault(); onCellSelect(Math.min(ROWS - 1, cell.row + 1), cell.col); onSelectionChange(null); return }
      if (e.key === "ArrowLeft")  { e.preventDefault(); onCellSelect(cell.row, Math.max(0, cell.col - 1)); onSelectionChange(null); return }
      if (e.key === "ArrowRight") { e.preventDefault(); onCellSelect(cell.row, Math.min(COLS - 1, cell.col + 1)); onSelectionChange(null); return }

      // ── Enter / F2: open editor keeping existing value ────────────────────
      if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault()
        setPendingChar(null)
        onCellEdit(cell.row, cell.col)
        return
      }

      // ── Delete / Backspace: clear cell ────────────────────────────────────
      if (e.key === "Delete" || e.key === "Backspace") {
        // handled by spreadsheet.tsx (deleteSelection) — don't duplicate
        return
      }

      // ── Printable char: open editor replacing existing value ──────────────
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setPendingChar(e.key)
        onCellEdit(cell.row, cell.col)
        return
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onCellSelect, onCellEdit, onSelectionChange]) // stable refs — no selectedCell/editingCell

  useEffect(() => { if (!editingCell) setPendingChar(null) }, [editingCell])

  // ── Headers ───────────────────────────────────────────────────────────────
  const colHeaders = []
  for (let c = visibleStartCol; c < visibleEndCol; c++) {
    const active = selectedCell?.col === c
    colHeaders.push(
      <div key={`ch-${c}`}
        className={`absolute flex items-center justify-center border-r border-b border-border text-xs font-medium select-none ${active ? "bg-primary/10 text-primary" : "bg-cell-header text-cell-header-foreground"}`}
        style={{ left: HEADER_WIDTH + c * COL_WIDTH, top: 0, width: COL_WIDTH, height: HEADER_HEIGHT }}
      >
        {getColLetter(c)}
      </div>
    )
  }

  const rowHeaders = []
  for (let r = visibleStartRow; r < visibleEndRow; r++) {
    const active = selectedCell?.row === r
    rowHeaders.push(
      <div key={`rh-${r}`}
        className={`absolute flex items-center justify-center border-r border-b border-border text-xs font-medium select-none ${active ? "bg-primary/10 text-primary" : "bg-cell-header text-cell-header-foreground"}`}
        style={{ left: 0, top: HEADER_HEIGHT + r * ROW_HEIGHT, width: HEADER_WIDTH, height: ROW_HEIGHT }}
      >
        {r + 1}
      </div>
    )
  }

  // ── Cells ─────────────────────────────────────────────────────────────────
  const cellComponents = []
  for (let r = visibleStartRow; r < visibleEndRow; r++) {
    for (let c = visibleStartCol; c < visibleEndCol; c++) {
      const isThisEditing = editingCell?.row === r && editingCell?.col === c
      cellComponents.push(
        <CellComponent
          key={`${r}-${c}`}
          row={r} col={c}
          cellData={getCell(r, c)}
          isSelected={selectedCell?.row === r && selectedCell?.col === c}
          isInRange={isInRange(r, c)}
          isEditing={isThisEditing}
          onSelect={() => onCellSelect(r, c)}
          onStartEdit={() => { setPendingChar(null); onCellEdit(r, c) }}
          onValueChange={(val) => onCellValueChange(r, c, val)}
          onStopEditing={onStopEditing}
          onStartRangeSelect={startRangeSelect}
          pendingChar={isThisEditing ? pendingChar : null}
          onConfirmAndMove={(val, dir) => handleConfirmAndMove(r, c, val, dir)}
        />
      )
    }
  }

  return (
    <div
      ref={containerRef}
      data-grid-container
      className="flex-1 overflow-auto relative bg-card"
      onScroll={handleScroll}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div style={{ width: HEADER_WIDTH + COLS * COL_WIDTH, height: HEADER_HEIGHT + ROWS * ROW_HEIGHT, position: "relative" }}>
        <div className="absolute bg-cell-header border-r border-b border-border z-20"
          style={{ left: 0, top: 0, width: HEADER_WIDTH, height: HEADER_HEIGHT }} />
        <div className="sticky top-0 z-10" style={{ height: HEADER_HEIGHT, position: "sticky", top: 0 }}>
          <div className="absolute bg-cell-header border-r border-b border-border z-20"
            style={{ left: 0, top: 0, width: HEADER_WIDTH, height: HEADER_HEIGHT }} />
          {colHeaders}
        </div>
        {rowHeaders}
        {cellComponents}
      </div>
    </div>
  )
}