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

const COL_WIDTH = 100
const ROW_HEIGHT = 28
const HEADER_WIDTH = 46
const HEADER_HEIGHT = 28

function CellComponent({
  row,
  col,
  cellData,
  isSelected,
  isInRange,
  isEditing,
  onSelect,
  onDoubleClick,
  onValueChange,
  onStopEditing,
  onStartRangeSelect,
}: {
  row: number
  col: number
  cellData: CellData
  isSelected: boolean
  isInRange: boolean
  isEditing: boolean
  onSelect: () => void
  onDoubleClick: () => void
  onValueChange: (value: string) => void
  onStopEditing: () => void
  onStartRangeSelect: (row: number, col: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editValue, setEditValue] = useState("")

  useEffect(() => {
    if (isEditing && inputRef.current) {
      setEditValue(cellData.formula || cellData.value)
      inputRef.current.focus()
    }
  }, [isEditing, cellData.formula, cellData.value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onValueChange(editValue)
      onStopEditing()
    }
    if (e.key === "Escape") {
      onStopEditing()
    }
    if (e.key === "Tab") {
      e.preventDefault()
      onValueChange(editValue)
      onStopEditing()
    }
  }

  const style: React.CSSProperties = {
    fontWeight: cellData.style.bold ? "bold" : "normal",
    fontStyle: cellData.style.italic ? "italic" : "normal",
    textDecoration: cellData.style.underline ? "underline" : "none",
    textAlign: cellData.style.align,
    fontSize: cellData.style.fontSize,
    backgroundColor: cellData.style.bgColor || undefined,
    color: cellData.style.textColor || undefined,
  }

  return (
    <div
      className={`absolute border-r border-b border-border transition-none select-none ${
        isSelected
          ? "ring-2 ring-primary ring-inset z-10"
          : isInRange
          ? "bg-cell-selected"
          : ""
      }`}
      style={{
        left: HEADER_WIDTH + col * COL_WIDTH,
        top: HEADER_HEIGHT + row * ROW_HEIGHT,
        width: COL_WIDTH,
        height: ROW_HEIGHT,
      }}
      onMouseDown={(e) => {
        if (e.button === 0) {
          onSelect()
          onStartRangeSelect(row, col)
        }
      }}
      onDoubleClick={onDoubleClick}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            onValueChange(editValue)
            onStopEditing()
          }}
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
  getCell,
  selectedCell,
  selectionRange,
  editingCell,
  onCellSelect,
  onSelectionChange,
  onCellEdit,
  onCellValueChange,
  onStopEditing,
  getColLetter,
}: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ row: number; col: number } | null>(null)

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollPos({
        top: containerRef.current.scrollTop,
        left: containerRef.current.scrollLeft,
      })
    }
  }, [])

  // Determine visible rows/cols based on scroll
  const visibleStartRow = Math.max(0, Math.floor(scrollPos.top / ROW_HEIGHT) - 2)
  const visibleEndRow = Math.min(
    ROWS,
    visibleStartRow + Math.ceil((containerRef.current?.clientHeight || 800) / ROW_HEIGHT) + 4
  )
  const visibleStartCol = Math.max(0, Math.floor(scrollPos.left / COL_WIDTH) - 1)
  const visibleEndCol = Math.min(
    COLS,
    visibleStartCol + Math.ceil((containerRef.current?.clientWidth || 1200) / COL_WIDTH) + 2
  )

  const isInRange = useCallback(
    (row: number, col: number) => {
      if (!selectionRange) return false
      const { start, end } = selectionRange
      const minRow = Math.min(start.row, end.row)
      const maxRow = Math.max(start.row, end.row)
      const minCol = Math.min(start.col, end.col)
      const maxCol = Math.max(start.col, end.col)
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    },
    [selectionRange]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + containerRef.current.scrollLeft - HEADER_WIDTH
      const y = e.clientY - rect.top + containerRef.current.scrollTop - HEADER_HEIGHT
      const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_WIDTH)))
      const row = Math.max(0, Math.min(ROWS - 1, Math.floor(y / ROW_HEIGHT)))
      onSelectionChange({ start: dragStartRef.current, end: { row, col } })
    },
    [isDragging, onSelectionChange]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }
    window.addEventListener("mouseup", handleGlobalMouseUp)
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp)
  }, [])

  const startRangeSelect = useCallback(
    (row: number, col: number) => {
      dragStartRef.current = { row, col }
      setIsDragging(true)
      onSelectionChange(null)
    },
    [onSelectionChange]
  )

  // Column headers
  const colHeaders = []
  for (let c = visibleStartCol; c < visibleEndCol; c++) {
    const isSelectedCol = selectedCell?.col === c
    colHeaders.push(
      <div
        key={`ch-${c}`}
        className={`absolute flex items-center justify-center border-r border-b border-border text-xs font-medium select-none ${
          isSelectedCol
            ? "bg-primary/10 text-primary"
            : "bg-cell-header text-cell-header-foreground"
        }`}
        style={{
          left: HEADER_WIDTH + c * COL_WIDTH,
          top: 0,
          width: COL_WIDTH,
          height: HEADER_HEIGHT,
        }}
      >
        {getColLetter(c)}
      </div>
    )
  }

  // Row headers
  const rowHeaders = []
  for (let r = visibleStartRow; r < visibleEndRow; r++) {
    const isSelectedRow = selectedCell?.row === r
    rowHeaders.push(
      <div
        key={`rh-${r}`}
        className={`absolute flex items-center justify-center border-r border-b border-border text-xs font-medium select-none ${
          isSelectedRow
            ? "bg-primary/10 text-primary"
            : "bg-cell-header text-cell-header-foreground"
        }`}
        style={{
          left: 0,
          top: HEADER_HEIGHT + r * ROW_HEIGHT,
          width: HEADER_WIDTH,
          height: ROW_HEIGHT,
        }}
      >
        {r + 1}
      </div>
    )
  }

  // Cells
  const cellComponents = []
  for (let r = visibleStartRow; r < visibleEndRow; r++) {
    for (let c = visibleStartCol; c < visibleEndCol; c++) {
      const cellData = getCell(r, c)
      cellComponents.push(
        <CellComponent
          key={`${r}-${c}`}
          row={r}
          col={c}
          cellData={cellData}
          isSelected={selectedCell?.row === r && selectedCell?.col === c}
          isInRange={isInRange(r, c)}
          isEditing={editingCell?.row === r && editingCell?.col === c}
          onSelect={() => onCellSelect(r, c)}
          onDoubleClick={() => onCellEdit(r, c)}
          onValueChange={(val) => onCellValueChange(r, c, val)}
          onStopEditing={onStopEditing}
          onStartRangeSelect={startRangeSelect}
        />
      )
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto relative bg-card"
      onScroll={handleScroll}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        style={{
          width: HEADER_WIDTH + COLS * COL_WIDTH,
          height: HEADER_HEIGHT + ROWS * ROW_HEIGHT,
          position: "relative",
        }}
      >
        {/* Top-left corner */}
        <div
          className="absolute bg-cell-header border-r border-b border-border z-20"
          style={{
            left: 0,
            top: 0,
            width: HEADER_WIDTH,
            height: HEADER_HEIGHT,
          }}
        />

        {/* Column headers - sticky top */}
        <div
          className="sticky top-0 z-10"
          style={{ height: HEADER_HEIGHT, position: "sticky", top: 0 }}
        >
          <div
            className="absolute bg-cell-header border-r border-b border-border z-20"
            style={{
              left: 0,
              top: 0,
              width: HEADER_WIDTH,
              height: HEADER_HEIGHT,
            }}
          />
          {colHeaders}
        </div>

        {/* Row headers */}
        {rowHeaders.map((rh) => rh)}

        {/* Cells */}
        {cellComponents}
      </div>
    </div>
  )
}
