"use client"

import { useRef, useCallback, useEffect, useState } from "react"
import { X } from "lucide-react"
import { ROWS, COLS, type CellData, type EmbeddedChart } from "@/hooks/use-spreadsheet"

const COL_WIDTH     = 100
const ROW_HEIGHT    = 28
const HEADER_WIDTH  = 46
const HEADER_HEIGHT = 28

export { COL_WIDTH, ROW_HEIGHT, HEADER_WIDTH, HEADER_HEIGHT }

type GridProps = {
  getCell: (row: number, col: number) => CellData
  charts: EmbeddedChart[]
  onRemoveChart: (id: string) => void
  selectedCell: { row: number; col: number } | null
  selectionRange: { start: { row: number; col: number }; end: { row: number; col: number } } | null
  editingCell: { row: number; col: number } | null
  onCellSelect: (row: number, col: number) => void
  onSelectionChange: (range: { start: { row: number; col: number }; end: { row: number; col: number } } | null) => void
  onCellEdit: (row: number, col: number) => void
  onCellValueChange: (row: number, col: number, value: string) => void
  onStopEditing: () => void
  getColLetter: (col: number) => string
}

// ── Cell ──────────────────────────────────────────────────────────────────────
function CellComponent({ row, col, cellData, isSelected, isInRange, isEditing, onSelect, onStartEdit, onStopEditing, onStartRangeSelect, pendingChar, onConfirmAndMove }: {
  row: number; col: number; cellData: CellData; isSelected: boolean; isInRange: boolean; isEditing: boolean
  onSelect: () => void; onStartEdit: () => void; onStopEditing: () => void
  onStartRangeSelect: (r: number, c: number) => void; pendingChar: string | null
  onConfirmAndMove: (v: string, dir: "down" | "right" | "none") => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editVal, setEditVal] = useState("")

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const init = pendingChar ?? (cellData.formula || cellData.value)
      setEditVal(init); inputRef.current.focus()
      setTimeout(() => { if (inputRef.current) inputRef.current.setSelectionRange(init.length, init.length) }, 0)
    }
  }, [isEditing])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); onConfirmAndMove(editVal, "down") }
    else if (e.key === "Tab") { e.preventDefault(); onConfirmAndMove(editVal, "right") }
    else if (e.key === "Escape") onStopEditing()
  }

  const s: React.CSSProperties = {
    fontWeight: cellData.style.bold ? "bold" : "normal", fontStyle: cellData.style.italic ? "italic" : "normal",
    textDecoration: cellData.style.underline ? "underline" : "none", textAlign: cellData.style.align,
    fontSize: cellData.style.fontSize, backgroundColor: cellData.style.bgColor || undefined, color: cellData.style.textColor || undefined,
  }

  return (
    <div className={`absolute border-r border-b border-border transition-none select-none ${isSelected ? "ring-2 ring-primary ring-inset z-10" : isInRange ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
      style={{ left: HEADER_WIDTH + col * COL_WIDTH, top: HEADER_HEIGHT + row * ROW_HEIGHT, width: COL_WIDTH, height: ROW_HEIGHT }}
      onMouseDown={e => { if (e.button !== 0) return; if (isSelected) onStartEdit(); else { onSelect(); onStartRangeSelect(row, col) } }}>
      {isEditing ? (
        <input ref={inputRef} value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={handleKeyDown}
          onBlur={() => onConfirmAndMove(editVal, "none")}
          className="w-full h-full px-1.5 text-foreground bg-card outline-none font-mono" style={{ fontSize: cellData.style.fontSize }} />
      ) : (
        <div className="w-full h-full px-1.5 flex items-center overflow-hidden whitespace-nowrap text-foreground" style={s}>
          <span className="truncate w-full" style={{ textAlign: cellData.style.align }}>{cellData.value}</span>
        </div>
      )}
    </div>
  )
}

// ── Embedded chart overlay ────────────────────────────────────────────────────
function ChartOverlay({ chart, onRemove }: { chart: EmbeddedChart; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false)
  const left   = HEADER_WIDTH  + chart.anchorCol * COL_WIDTH
  const top    = HEADER_HEIGHT + chart.anchorRow * ROW_HEIGHT
  const width  = chart.spanCols * COL_WIDTH
  const height = chart.spanRows * ROW_HEIGHT

  return (
    <div className="absolute z-20 pointer-events-auto"
      style={{ left, top, width, height }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* White bg + border */}
      <div className="w-full h-full rounded-xl border border-border shadow-lg bg-white overflow-hidden"
        style={{ padding: 0 }}>
        {/* SVG fills entire area */}
        <div className="w-full h-full" style={{ lineHeight: 0 }}
          dangerouslySetInnerHTML={{ __html: chart.svgContent
            .replace(/width="[\d]+"/, `width="${width}"`)
            .replace(/height="[\d]+"/, `height="${height}"`) }} />
      </div>
      {/* Hover controls */}
      {hovered && (
        <div className="absolute top-1 right-1 flex items-center gap-1">
          <div className="bg-card/90 backdrop-blur rounded-lg border border-border px-2 py-0.5">
            <span className="text-[10px] font-semibold text-foreground/70 truncate max-w-[120px] inline-block">{chart.title}</span>
          </div>
          <button onClick={e => { e.stopPropagation(); onRemove() }}
            className="w-5 h-5 rounded-md bg-destructive/90 flex items-center justify-center text-white hover:bg-destructive transition-colors shadow">
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Grid ──────────────────────────────────────────────────────────────────────
export function Grid({ getCell, charts, onRemoveChart, selectedCell, selectionRange, editingCell, onCellSelect, onSelectionChange, onCellEdit, onCellValueChange, onStopEditing, getColLetter }: GridProps) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ top: 0, left: 0 })
  const [isDrag, setIsDrag] = useState(false)
  const [pendingChar, setPendingChar] = useState<string | null>(null)
  const dragStartRef = useRef<{ row: number; col: number } | null>(null)
  const selCellRef   = useRef(selectedCell); useEffect(() => { selCellRef.current = selectedCell }, [selectedCell])
  const editRef      = useRef(editingCell);  useEffect(() => { editRef.current = editingCell }, [editingCell])

  const handleScroll = useCallback(() => { if (containerRef.current) setScroll({ top: containerRef.current.scrollTop, left: containerRef.current.scrollLeft }) }, [])

  const vsr = Math.max(0, Math.floor(scroll.top  / ROW_HEIGHT) - 2)
  const ver = Math.min(ROWS, vsr + Math.ceil((containerRef.current?.clientHeight || 800) / ROW_HEIGHT) + 4)
  const vsc = Math.max(0, Math.floor(scroll.left / COL_WIDTH) - 1)
  const vec = Math.min(COLS, vsc + Math.ceil((containerRef.current?.clientWidth  || 1200) / COL_WIDTH) + 2)

  const inRange = useCallback((r: number, c: number) => {
    if (!selectionRange) return false
    const { start, end } = selectionRange
    return r >= Math.min(start.row, end.row) && r <= Math.max(start.row, end.row) && c >= Math.min(start.col, end.col) && c <= Math.max(start.col, end.col)
  }, [selectionRange])

  const confirmAndMove = useCallback((r: number, c: number, v: string, dir: "down" | "right" | "none") => {
    onCellValueChange(r, c, v); onStopEditing()
    if (dir === "down")  onCellSelect(Math.min(ROWS - 1, r + 1), c)
    if (dir === "right") onCellSelect(r, Math.min(COLS - 1, c + 1))
  }, [onCellValueChange, onStopEditing, onCellSelect])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrag || !dragStartRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + containerRef.current.scrollLeft - HEADER_WIDTH
    const y = e.clientY - rect.top  + containerRef.current.scrollTop  - HEADER_HEIGHT
    const c = Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_WIDTH)))
    const r = Math.max(0, Math.min(ROWS - 1, Math.floor(y / ROW_HEIGHT)))
    onSelectionChange({ start: dragStartRef.current, end: { row: r, col: c } })
  }, [isDrag, onSelectionChange])

  useEffect(() => { const up = () => { setIsDrag(false); dragStartRef.current = null }; window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-category-panel]")) return
      if (target.tagName === "INPUT" && !target.closest("[data-grid-container]")) return
      const cell = selCellRef.current; const editing = editRef.current; if (!cell) return; if (editing) return
      const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
      if (arrows[e.key]) { e.preventDefault(); const [dr, dc] = arrows[e.key]; onCellSelect(Math.max(0, Math.min(ROWS-1, cell.row+dr)), Math.max(0, Math.min(COLS-1, cell.col+dc))); onSelectionChange(null); return }
      if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); setPendingChar(null); onCellEdit(cell.row, cell.col); return }
      if ((e.key === "Delete" || e.key === "Backspace") && target.tagName !== "INPUT") return
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setPendingChar(e.key); onCellEdit(cell.row, cell.col) }
    }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey)
  }, [onCellSelect, onCellEdit, onSelectionChange])

  useEffect(() => { if (!editingCell) setPendingChar(null) }, [editingCell])

  // Chart-covered cells — skip rendering
  const covered = new Set<string>()
  charts.forEach(ch => { for (let r = ch.anchorRow; r < ch.anchorRow + ch.spanRows; r++) for (let c = ch.anchorCol; c < ch.anchorCol + ch.spanCols; c++) covered.add(`${r}:${c}`) })

  const colHeaders = [], rowHeaders = [], cells2 = []
  for (let c = vsc; c < vec; c++) {
    const active = selectedCell?.col === c
    colHeaders.push(<div key={`ch${c}`} className={`absolute flex items-center justify-center border-r border-b border-border text-xs font-medium select-none ${active ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground"}`} style={{ left: HEADER_WIDTH + c * COL_WIDTH, top: 0, width: COL_WIDTH, height: HEADER_HEIGHT }}>{getColLetter(c)}</div>)
  }
  for (let r = vsr; r < ver; r++) {
    const active = selectedCell?.row === r
    rowHeaders.push(<div key={`rh${r}`} className={`absolute flex items-center justify-center border-r border-b border-border text-xs font-medium select-none ${active ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground"}`} style={{ left: 0, top: HEADER_HEIGHT + r * ROW_HEIGHT, width: HEADER_WIDTH, height: ROW_HEIGHT }}>{r + 1}</div>)
  }
  for (let r = vsr; r < ver; r++) for (let c = vsc; c < vec; c++) {
    if (covered.has(`${r}:${c}`)) continue
    const isEdit = editingCell?.row === r && editingCell?.col === c
    cells2.push(<CellComponent key={`${r}-${c}`} row={r} col={c} cellData={getCell(r, c)}
      isSelected={selectedCell?.row === r && selectedCell?.col === c} isInRange={inRange(r, c)} isEditing={isEdit}
      onSelect={() => onCellSelect(r, c)} onStartEdit={() => { setPendingChar(null); onCellEdit(r, c) }}
      onStopEditing={onStopEditing} onStartRangeSelect={(row, col) => { dragStartRef.current = { row, col }; setIsDrag(true); onSelectionChange(null) }}
      pendingChar={isEdit ? pendingChar : null} onConfirmAndMove={(v, dir) => confirmAndMove(r, c, v, dir)} />)
  }

  return (
    <div ref={containerRef} data-grid-container className="flex-1 overflow-auto relative bg-card"
      onScroll={handleScroll} onMouseMove={handleMouseMove}>
      <div style={{ width: HEADER_WIDTH + COLS * COL_WIDTH, height: HEADER_HEIGHT + ROWS * ROW_HEIGHT, position: "relative" }}>
        <div style={{ position: "sticky", top: 0, height: HEADER_HEIGHT, zIndex: 15 }}>
          <div className="absolute bg-muted/40 border-r border-b border-border" style={{ left: 0, top: 0, width: HEADER_WIDTH, height: HEADER_HEIGHT }} />
          {colHeaders}
        </div>
        {rowHeaders}{cells2}
        {charts.map(ch => <ChartOverlay key={ch.id} chart={ch} onRemove={() => onRemoveChart(ch.id)} />)}
      </div>
    </div>
  )
}