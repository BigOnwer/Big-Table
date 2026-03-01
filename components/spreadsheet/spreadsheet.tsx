"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FolderPlus } from "lucide-react"
import { useSpreadsheet, ROWS, COLS } from "@/hooks/use-spreadsheet"
import {
  useCategories, type Category,
  computeItemHorizontalResult, evaluateComparison,
  getComparisonTarget, computeResult,
} from "@/hooks/use-categories"
import { Button } from "@/components/ui/button"
import { Toolbar } from "./toolbar"
import { FormulaBar } from "./formula-bar"
import { Grid } from "./grid"
import { StatusBar } from "./status-bar"
import { CategoryPanel } from "./category-panel"

export function Spreadsheet() {
  const {
    cells, selectedCell, setSelectedCell, selectionRange, setSelectionRange,
    editingCell, setEditingCell, getCell, setCellValue, setCellStyle,
    setStyleForSelection, undo, redo, copy, paste, deleteSelection,
    getSelectedCellRef, getSelectedValues, applyFunctionToSelection, getColLetter,
  } = useSpreadsheet()

  const {
    categories, addCategory, removeCategory, setOperation,
    addItem, removeItem, updateItem, getResult,
    addComparison, updateComparison, removeComparison,
  } = useCategories()

  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false)

  // Track which grid anchor each category was sent to, so updates can re-render
  // in-place without requiring a manual "Inserir na planilha" click.
  const categoryAnchorRef = useRef<Record<string, { row: number; col: number }>>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const currentCellData = selectedCell ? getCell(selectedCell.row, selectedCell.col) : null

  // ─── Cell handlers ────────────────────────────────────────────────────────
  const handleCellSelect     = useCallback((row: number, col: number) => { setSelectedCell({ row, col }); setEditingCell(null) }, [setSelectedCell, setEditingCell])
  const handleCellEdit       = useCallback((row: number, col: number) => { setEditingCell({ row, col }) }, [setEditingCell])
  const handleCellValueChange = useCallback((r: number, c: number, v: string) => { setCellValue(r, c, v) }, [setCellValue])
  const handleFormulaBarChange = useCallback((v: string) => { if (selectedCell) setCellValue(selectedCell.row, selectedCell.col, v) }, [selectedCell, setCellValue])
  const handleInsertFormula  = useCallback((formula: string) => {
    if (!selectedCell) return
    setEditingCell(selectedCell)
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(`input[class*="font-mono"]`)
      if (input) { input.value = formula; input.focus(); input.setSelectionRange(formula.length, formula.length) }
    }, 50)
  }, [selectedCell, setEditingCell])
  const handleApplyFunction  = useCallback((fn: string) => { applyFunctionToSelection(fn) }, [applyFunctionToSelection])

  // ─── Core grid writer ────────────────────────────────────────────────────
  // Extracted so both "first send" and "auto-sync on edit" call the same logic.
  const writeCategoryToGrid = useCallback((
    category: Category,
    startRow: number,
    startCol: number
  ) => {
    const isHorizontal = category.operation.startsWith("HORIZONTAL_")
    const catResult    = computeResult(category.items, category.operation)

    const styleHeader = (row: number, col: number) => {
      setCellStyle(row, col, { bold: true, bgColor: category.color, textColor: "#ffffff" })
    }

    const formulaMap: Record<string, string> = {
      SOMA: "SOMA", MEDIA: "MEDIA", CONTAR: "CONTAR", MAX: "MAX", MIN: "MIN",
    }
    const hFormulaMap: Record<string, string> = {
      HORIZONTAL_SOMA: "SOMA", HORIZONTAL_MEDIA: "MEDIA",
      HORIZONTAL_MAX: "MAX",   HORIZONTAL_MIN: "MIN",
    }

    if (!isHorizontal) {
      // ── VERTICAL ────────────────────────────────────────────────────────
      setCellValue(startRow, startCol, category.name); styleHeader(startRow, startCol)
      setCellValue(startRow, startCol + 1, "Valor");   styleHeader(startRow, startCol + 1)

      category.comparisons.forEach((comp, ci) => {
        const col = startCol + 2 + ci; if (col >= COLS) return
        setCellValue(startRow, col, comp.label); styleHeader(startRow, col)
      })

      category.items.forEach((item, idx) => {
        const row = startRow + 1 + idx; if (row >= ROWS) return
        setCellValue(row, startCol, item.name)
        setCellValue(row, startCol + 1, item.value.toString())
        category.comparisons.forEach((comp, ci) => {
          const col = startCol + 2 + ci; if (col >= COLS) return
          const target = getComparisonTarget(comp, item, catResult, category.operation)
          if (target === null) return
          const passed = evaluateComparison(target, comp)
          setCellValue(row, col, passed ? comp.labelTrue : comp.labelFalse)
          setCellStyle(row, col, { textColor: passed ? comp.colorPass : comp.colorFail, bold: true })
        })
      })

      const resultRow = startRow + 1 + category.items.length
      if (resultRow < ROWS) {
        const fn  = formulaMap[category.operation] ?? category.operation
        const rs  = getColLetter(startCol + 1) + (startRow + 2)
        const re  = getColLetter(startCol + 1) + (startRow + 1 + category.items.length)
        setCellValue(resultRow, startCol, `${category.operation}:`)
        setCellStyle(resultRow, startCol, { bold: true })
        setCellValue(resultRow, startCol + 1, `=${fn}(${rs}:${re})`)
        setCellStyle(resultRow, startCol + 1, { bold: true })
        category.comparisons.forEach((comp, ci) => {
          if (comp.scope !== "total") return
          const col = startCol + 2 + ci; if (col >= COLS) return
          const passed = catResult !== null ? evaluateComparison(catResult, comp) : null
          if (passed === null) return
          setCellValue(resultRow, col, passed ? comp.labelTrue : comp.labelFalse)
          setCellStyle(resultRow, col, { textColor: passed ? comp.colorPass : comp.colorFail, bold: true })
        })
      }
    } else {
      // ── HORIZONTAL ──────────────────────────────────────────────────────
      const maxValues    = category.items.reduce((mx, item) => Math.max(mx, item.values?.length ?? 1), 1)
      const resultCol    = startCol + 1 + maxValues
      const firstCompCol = resultCol + 1

      setCellValue(startRow, startCol, category.name); styleHeader(startRow, startCol)
      for (let v = 0; v < maxValues; v++) {
        const col = startCol + 1 + v; if (col >= COLS) break
        setCellValue(startRow, col, `Valor ${v + 1}`); styleHeader(startRow, col)
      }
      if (resultCol < COLS) { setCellValue(startRow, resultCol, "Resultado"); styleHeader(startRow, resultCol) }
      category.comparisons.forEach((comp, ci) => {
        const col = firstCompCol + ci; if (col >= COLS) return
        setCellValue(startRow, col, comp.label); styleHeader(startRow, col)
      })

      category.items.forEach((item, idx) => {
        const row = startRow + 1 + idx; if (row >= ROWS) return
        setCellValue(row, startCol, item.name)
        const vals = item.values?.length ? item.values : [item.value]
        vals.forEach((v, vi) => { const col = startCol + 1 + vi; if (col < COLS) setCellValue(row, col, v.toString()) })
        if (resultCol < COLS && vals.length > 0) {
          const fn   = hFormulaMap[category.operation] ?? "SOMA"
          const fc   = getColLetter(startCol + 1)
          const lc   = getColLetter(startCol + vals.length)
          const rr   = (row + 1).toString()
          setCellValue(row, resultCol, `=${fn}(${fc}${rr}:${lc}${rr})`)
          setCellStyle(row, resultCol, { bold: true })
        }
        category.comparisons.forEach((comp, ci) => {
          const col = firstCompCol + ci; if (col >= COLS) return
          const target = getComparisonTarget(comp, item, catResult, category.operation)
          if (target === null) return
          const passed = evaluateComparison(target, comp)
          setCellValue(row, col, passed ? comp.labelTrue : comp.labelFalse)
          setCellStyle(row, col, { textColor: passed ? comp.colorPass : comp.colorFail, bold: true })
        })
      })

      const summaryRow = startRow + 1 + category.items.length
      if (summaryRow < ROWS) {
        const labels: Record<string, string> = { HORIZONTAL_SOMA: "Soma:", HORIZONTAL_MEDIA: "Média:", HORIZONTAL_MAX: "Máximo:", HORIZONTAL_MIN: "Mínimo:" }
        setCellValue(summaryRow, startCol, labels[category.operation] ?? "Total:")
        setCellStyle(summaryRow, startCol, { bold: true })
        if (resultCol < COLS && category.items.length > 0) {
          const fn = hFormulaMap[category.operation] ?? "SOMA"
          const rl = getColLetter(resultCol)
          setCellValue(summaryRow, resultCol, `=${fn}(${rl}${startRow + 2}:${rl}${startRow + 1 + category.items.length})`)
          setCellStyle(summaryRow, resultCol, { bold: true })
        }
        category.comparisons.forEach((comp, ci) => {
          if (comp.scope !== "total") return
          const col = firstCompCol + ci; if (col >= COLS) return
          const passed = catResult !== null ? evaluateComparison(catResult, comp) : null
          if (passed === null) return
          setCellValue(summaryRow, col, passed ? comp.labelTrue : comp.labelFalse)
          setCellStyle(summaryRow, col, { textColor: passed ? comp.colorPass : comp.colorFail, bold: true })
        })
      }
    }
  }, [setCellValue, setCellStyle, getColLetter])

  // ─── "Inserir na planilha" (manual) ──────────────────────────────────────
  const handleSendToGrid = useCallback((category: Category) => {
    const startRow = selectedCell?.row ?? 0
    const startCol = selectedCell?.col ?? 0
    categoryAnchorRef.current[category.id] = { row: startRow, col: startCol }
    writeCategoryToGrid(category, startRow, startCol)
    setSelectedCell({ row: startRow, col: startCol })
  }, [selectedCell, writeCategoryToGrid, setSelectedCell])

  // ─── Auto-sync when a category's items change ─────────────────────────────
  // We keep a prev-categories ref to detect which category changed, then
  // re-write only that category to its last known anchor.
  const prevCategoriesRef = useRef<Category[]>([])
  useEffect(() => {
    const prev = prevCategoriesRef.current
    categories.forEach((cat) => {
      const anchor = categoryAnchorRef.current[cat.id]
      if (!anchor) return // never been sent to grid — skip
      const prevCat = prev.find((c) => c.id === cat.id)
      if (!prevCat) return
      // Simple deep-compare: check if items changed
      const itemsChanged = JSON.stringify(cat.items) !== JSON.stringify(prevCat.items)
      const compsChanged = JSON.stringify(cat.comparisons) !== JSON.stringify(prevCat.comparisons)
      const opChanged    = cat.operation !== prevCat.operation
      if (itemsChanged || compsChanged || opChanged) {
        writeCategoryToGrid(cat, anchor.row, anchor.col)
      }
    })
    prevCategoriesRef.current = categories
  }, [categories, writeCategoryToGrid])

  // ─── Item update handler ──────────────────────────────────────────────────
  const handleUpdateItem = useCallback((categoryId: string, itemId: string, name: string, raw: string) => {
    updateItem(categoryId, itemId, { name, rawValueInput: raw })
    // Auto-sync is handled by the useEffect above
  }, [updateItem])

  const hasNumericSelection = (() => getSelectedValues().length > 0)()

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" && !target.closest("[data-spreadsheet-container]")) return
      if (target.closest("[data-category-panel]")) return
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") { e.preventDefault(); copy() }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") { e.preventDefault(); paste() }
      if ((e.key === "Delete" || e.key === "Backspace") && target.tagName !== "INPUT") { e.preventDefault(); deleteSelection() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [undo, redo, copy, paste, deleteSelection])

  return (
    <div ref={containerRef} data-spreadsheet-container className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
        <span className="text-sm font-semibold text-foreground mr-2">Planilha</span>
        <Button
          variant={categoryPanelOpen ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryPanelOpen(!categoryPanelOpen)}
          className="h-7 text-xs gap-1.5"
        >
          <FolderPlus size={14} />
          Categorias
          {categories.length > 0 && (
            <span className="ml-0.5 bg-primary-foreground/20 text-primary-foreground px-1.5 py-0 rounded-full text-[10px] font-bold">
              {categories.length}
            </span>
          )}
        </Button>
      </div>

      <Toolbar
        currentStyle={currentCellData?.style || { bold: false, italic: false, underline: false, align: "left", fontSize: 13, bgColor: "", textColor: "" }}
        onStyleChange={setStyleForSelection}
        onUndo={undo} onRedo={redo} onCopy={copy} onPaste={paste} onDelete={deleteSelection}
        onInsertFormula={handleInsertFormula} onApplyFunction={handleApplyFunction}
        hasSelection={hasNumericSelection}
      />

      <FormulaBar
        cellRef={getSelectedCellRef()}
        value={currentCellData?.value || ""}
        formula={currentCellData?.formula || ""}
        onValueChange={handleFormulaBarChange}
      />

      <div className="flex flex-1 min-h-0">
        <Grid
          getCell={getCell} selectedCell={selectedCell} selectionRange={selectionRange}
          editingCell={editingCell} onCellSelect={handleCellSelect}
          onSelectionChange={setSelectionRange} onCellEdit={handleCellEdit}
          onCellValueChange={handleCellValueChange}
          onStopEditing={() => {
            setEditingCell(null)
            if (selectedCell) setSelectedCell({ row: selectedCell.row + 1, col: selectedCell.col })
          }}
          getColLetter={getColLetter}
        />
        <CategoryPanel
          categories={categories}
          onAddCategory={addCategory}
          onRemoveCategory={removeCategory}
          onSetOperation={setOperation}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={handleUpdateItem}
          onSendToGrid={handleSendToGrid}
          onAddComparison={addComparison}
          onUpdateComparison={updateComparison}
          onRemoveComparison={removeComparison}
          isOpen={categoryPanelOpen}
          onToggle={() => setCategoryPanelOpen(!categoryPanelOpen)}
        />
      </div>

      <StatusBar cells={cells} selectionRange={selectionRange} getCell={getCell} />
    </div>
  )
}