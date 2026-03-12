"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FolderPlus, BarChart2, GraduationCap } from "lucide-react"
import { useSpreadsheet, ROWS, COLS } from "@/hooks/use-spreadsheet"
import {
  useCategories, type Category,
  evaluateComparison, computeCategoryResult, computeItemSubDivResult, computeRegraDeTres,
  operationToSummaryFormula, rowAggFormula, computeItemScores,
} from "@/hooks/use-categories"
import { Button } from "@/components/ui/button"
import { Toolbar } from "./toolbar"
import { FormulaBar } from "./formula-bar"
import { Grid } from "./grid"
import { StatusBar } from "./status-bar"
import { CategoryDialog, makeDefaultBoletimConfig, type BoletimConfig, type SchoolTemplate } from "./category-panel"
import { ChartDialog } from "./chart-dialog"

export function Spreadsheet() {
  const {
    cells, charts, selectedCell, setSelectedCell, selectionRange, setSelectionRange,
    editingCell, setEditingCell, getCell, setCellValue, setCellStyle,
    setStyleForSelection, addChart, removeChart,
    undo, redo, copy, paste, deleteSelection,
    getSelectedCellRef, getSelectedValues, applyFunctionToSelection, getColLetter,
  } = useSpreadsheet()

  const {
    roster, categories, addCategory, addCategoryFull, removeCategory, setOperation,
    addItem, removeItem, updateItem, getResult,
    addComparison, updateComparison, removeComparison,
    toggleSubDivisions, addSubDivision, removeSubDivision, renameSubDivision,
    setSubDivisionValue, updateSubDivision,
    updateLogic, updateGlobalLogic, updateBands, applyScalePreset,
  } = useCategories()

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [chartDialogOpen,    setChartDialogOpen]    = useState(false)
  const [boletimConfig, setBoletimConfig] = useState<BoletimConfig>(makeDefaultBoletimConfig)
  const categoryAnchorRef = useRef<Record<string, { row: number; col: number }>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const currentCellData = selectedCell ? getCell(selectedCell.row, selectedCell.col) : null

  // ── Cell handlers ────────────────────────────────────────────────────────
  const handleCellSelect      = useCallback((row: number, col: number) => { setSelectedCell({ row, col }); setEditingCell(null) }, [setSelectedCell, setEditingCell])
  const handleCellEdit        = useCallback((row: number, col: number) => { setEditingCell({ row, col }) }, [setEditingCell])
  const handleFormulaBarChange = useCallback((v: string) => { if (selectedCell) setCellValue(selectedCell.row, selectedCell.col, v) }, [selectedCell, setCellValue])
  const handleInsertFormula   = useCallback((formula: string) => {
    if (!selectedCell) return
    setEditingCell(selectedCell)
    setTimeout(() => { const input = document.querySelector<HTMLInputElement>(`[data-grid-container] input`); if (input) { input.value = formula; input.focus(); input.setSelectionRange(formula.length, formula.length) } }, 50)
  }, [selectedCell, setEditingCell])
  const handleApplyFunction = useCallback((fn: string) => {
    if (!selectionRange && !selectedCell) return
    let rangeRef = "", baseRow = 0, baseCol = 0
    if (selectionRange) {
      const { start, end } = selectionRange
      const r1 = Math.min(start.row, end.row), r2 = Math.max(start.row, end.row), c1 = Math.min(start.col, end.col), c2 = Math.max(start.col, end.col)
      rangeRef = `${getColLetter(c1)}${r1 + 1}:${getColLetter(c2)}${r2 + 1}`; baseRow = r2; baseCol = c1
    } else if (selectedCell) { rangeRef = `${getColLetter(selectedCell.col)}${selectedCell.row + 1}`; baseRow = selectedCell.row; baseCol = selectedCell.col }
    let targetRow = baseRow + 1
    for (let r = baseRow + 1; r < Math.min(ROWS, baseRow + 50); r++) { if (!getCell(r, baseCol).value) { targetRow = r; break } }
    setCellValue(targetRow, baseCol, `=${fn}(${rangeRef})`); setSelectedCell({ row: targetRow, col: baseCol }); setSelectionRange(null)
  }, [selectionRange, selectedCell, getCell, getColLetter, setCellValue, setSelectedCell, setSelectionRange])

  // ── Write category data to grid ──────────────────────────────────────────
  const writeCategoryToGrid = useCallback((category: Category, startRow: number, startCol: number) => {
    const catResult = computeCategoryResult(category)
    const op = category.operation, logic = category.logic
    const fmtN = (n: number) => String(Math.round(n * 100) / 100)

    const styleHdr = (r: number, c: number) => setCellStyle(r, c, { bold: true, bgColor: category.color, textColor: "#ffffff" })
    const styleCat = (r: number, c: number) => setCellStyle(r, c, { bold: true, bgColor: category.color + "33", textColor: category.color })

    if (category.useSubDivisions && category.subDivisions.length > 0) {
      const sds = category.subDivisions
      const totalCol = startCol + 1 + sds.length
      const firstComp = totalCol + 1
      const nItems = category.items.length

      // Header row
      setCellValue(startRow, startCol, category.name); styleCat(startRow, startCol)
      sds.forEach((sd, si) => {
        const col = startCol + 1 + si; if (col >= COLS) return
        const label = op === "GABARITO" && sd.correctAnswer ? `${sd.name} [${sd.correctAnswer}]`
          : (op === "MEDIA_PONDERADA" && sd.weight !== undefined) ? `${sd.name} (×${sd.weight})` : sd.name
        setCellValue(startRow, col, label); styleHdr(startRow, col)
      })
      if (totalCol < COLS) { setCellValue(startRow, totalCol, "Resultado"); styleHdr(startRow, totalCol) }
      category.comparisons.forEach((comp, ci) => { const col = firstComp + ci; if (col >= COLS) return; setCellValue(startRow, col, comp.label); styleHdr(startRow, col) })

      // Data rows
      const scores = computeItemScores(category)
      category.items.forEach((item, idx) => {
        const row = startRow + 1 + idx; if (row >= ROWS) return
        setCellValue(row, startCol, item.name)
        sds.forEach((sd, si) => {
          const col = startCol + 1 + si; if (col >= COLS) return
          const val = category.subDivisionValues[sd.id]?.[item.id]
          if (val !== undefined && val !== null) setCellValue(row, col, String(val))
        })
        if (totalCol < COLS) {
          const ir = computeItemSubDivResult(item, category)
          if (op === "GABARITO" || op === "REGRA_DE_TRES" || logic.useCustomFormula) {
            if (ir !== null) { setCellValue(row, totalCol, fmtN(ir)); setCellStyle(row, totalCol, { bold: true }) }
          } else {
            const fc = getColLetter(startCol + 1), lc = getColLetter(startCol + sds.length), rr = (row + 1).toString()
            const formula = rowAggFormula(op, `${fc}${rr}:${lc}${rr}`)
            setCellValue(row, totalCol, formula); setCellStyle(row, totalCol, { bold: true })
          }
        }
        category.comparisons.forEach((comp, ci) => {
          const col = firstComp + ci; if (col >= COLS) return
          if (comp.scope !== "each") return
          const ir2 = computeItemSubDivResult(item, category); if (ir2 === null) return
          const passed = evaluateComparison(ir2, comp)
          setCellValue(row, col, passed ? comp.labelTrue : comp.labelFalse)
          setCellStyle(row, col, { textColor: passed ? comp.colorPass : comp.colorFail, bold: true })
        })
      })

      // Summary row
      const sumRow = startRow + 1 + nItems
      if (sumRow < ROWS && nItems > 0) {
        setCellValue(sumRow, startCol, `${op}:`); setCellStyle(sumRow, startCol, { bold: true })
        sds.forEach((sd, si) => {
          const col = startCol + 1 + si; if (col >= COLS) return
          if (op === "GABARITO") {
            let correct = 0
            category.items.forEach(item => {
              const val = String(category.subDivisionValues[sd.id]?.[item.id] ?? "").trim().toUpperCase()
              const key = (sd.correctAnswer ?? "").trim().toUpperCase()
              if (val && key && (logic.gabaritoAnswerMode === "exact" ? val === key : val.includes(key) || key.includes(val))) correct++
            })
            setCellValue(sumRow, col, `${correct}/${nItems}`); setCellStyle(sumRow, col, { bold: true })
          } else {
            const colL = getColLetter(col), range = `${colL}${startRow + 2}:${colL}${startRow + 1 + nItems}`
            const formula = operationToSummaryFormula(op, range, logic)
            if (formula) { setCellValue(sumRow, col, formula); setCellStyle(sumRow, col, { bold: true }) }
          }
        })
        if (totalCol < COLS) {
          const tl = getColLetter(totalCol), range = `${tl}${startRow + 2}:${tl}${startRow + 1 + nItems}`
          const formula = operationToSummaryFormula("MEDIA", range, logic)
          if (formula) { setCellValue(sumRow, totalCol, formula); setCellStyle(sumRow, totalCol, { bold: true, textColor: category.color }) }
          else if (catResult !== null) { setCellValue(sumRow, totalCol, fmtN(catResult)); setCellStyle(sumRow, totalCol, { bold: true, textColor: category.color }) }
        }
        category.comparisons.forEach((comp, ci) => {
          if (comp.scope !== "total") return
          const col = firstComp + ci; if (col >= COLS) return
          const passed = catResult !== null ? evaluateComparison(catResult, comp) : null
          if (passed === null) return
          setCellValue(sumRow, col, passed ? comp.labelTrue : comp.labelFalse)
          setCellStyle(sumRow, col, { textColor: passed ? comp.colorPass : comp.colorFail, bold: true })
        })

        // Class stats block (2 rows below summary)
        const statsRow = sumRow + 2
        if (statsRow + 6 < ROWS) {
          const scores2 = computeItemScores(category)
          const vals = Array.from(scores2.values())
          if (vals.length >= 2) {
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length
            const sorted = [...vals].sort((a, b) => a - b)
            const median = sorted.length % 2 === 0 ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : sorted[Math.floor(sorted.length/2)]
            const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1)
            const stddev = Math.sqrt(variance)
            setCellValue(statsRow,     startCol, "Estatísticas da turma"); setCellStyle(statsRow, startCol, { bold: true, italic: true })
            const statData = [["Média", fmtN(mean)], ["Mediana", fmtN(median)], ["Desvio padrão", fmtN(stddev)], ["Variância", fmtN(variance)], ["Máximo", fmtN(Math.max(...vals))], ["Mínimo", fmtN(Math.min(...vals))], ["Amplitude", fmtN(Math.max(...vals) - Math.min(...vals))]]
            statData.forEach(([label, val], i) => {
              if (statsRow + 1 + i >= ROWS) return
              setCellValue(statsRow + 1 + i, startCol, label)
              setCellValue(statsRow + 1 + i, startCol + 1, val); setCellStyle(statsRow + 1 + i, startCol + 1, { bold: true })
            })
          }
        }
      }
      return
    }

    // ── Flat mode ────────────────────────────────────────────────────────────
    const isRegra = op === "REGRA_DE_TRES"
    const firstCompCol = startCol + (isRegra ? 3 : 2)
    setCellValue(startRow, startCol, category.name); styleCat(startRow, startCol)
    setCellValue(startRow, startCol + 1, isRegra ? "Valor original" : "Valor"); styleHdr(startRow, startCol + 1)
    if (isRegra && startCol + 2 < COLS) { setCellValue(startRow, startCol + 2, `→ ×${logic.regraTarget}/${logic.regraRef}`); styleHdr(startRow, startCol + 2) }
    category.comparisons.forEach((comp, ci) => { const col = firstCompCol + ci; if (col >= COLS) return; setCellValue(startRow, col, comp.label); styleHdr(startRow, col) })

    category.items.forEach((item, idx) => {
      const row = startRow + 1 + idx; if (row >= ROWS) return
      setCellValue(row, startCol, item.name)
      setCellValue(row, startCol + 1, String(item.value))
      if (isRegra && startCol + 2 < COLS) {
        const conv = computeRegraDeTres(item.value, logic)
        if (conv !== null) { setCellValue(row, startCol + 2, fmtN(conv)); setCellStyle(row, startCol + 2, { bold: true }) }
      }
      category.comparisons.forEach((comp, ci) => {
        const col = firstCompCol + ci; if (col >= COLS) return
        const target = comp.scope === "total" ? catResult : item.value
        if (target === null) return
        const passed = evaluateComparison(target, comp)
        setCellValue(row, col, passed ? comp.labelTrue : comp.labelFalse)
        setCellStyle(row, col, { textColor: passed ? comp.colorPass : comp.colorFail, bold: true })
      })
    })

    const resRow = startRow + 1 + category.items.length
    if (resRow < ROWS && category.items.length > 0) {
      const nItems = category.items.length
      setCellValue(resRow, startCol, `${op}:`); setCellStyle(resRow, startCol, { bold: true })
      const valCol = startCol + 1
      const valRange = `${getColLetter(valCol)}${startRow + 2}:${getColLetter(valCol)}${startRow + 1 + nItems}`
      const valFormula = operationToSummaryFormula(op, valRange, logic)
      if (valFormula) { setCellValue(resRow, valCol, valFormula); setCellStyle(resRow, valCol, { bold: true, textColor: category.color }) }
      else if (catResult !== null) { setCellValue(resRow, valCol, fmtN(catResult)); setCellStyle(resRow, valCol, { bold: true, textColor: category.color }) }
      if (isRegra && startCol + 2 < COLS) {
        const cCol = startCol + 2, cRange = `${getColLetter(cCol)}${startRow + 2}:${getColLetter(cCol)}${startRow + 1 + nItems}`
        setCellValue(resRow, cCol, `=MÉDIA(${cRange})`); setCellStyle(resRow, cCol, { bold: true })
      }
      category.comparisons.forEach((comp, ci) => {
        if (comp.scope !== "total") return
        const col = firstCompCol + ci; if (col >= COLS) return
        const passed = catResult !== null ? evaluateComparison(catResult, comp) : null
        if (passed === null) return
        setCellValue(resRow, col, passed ? comp.labelTrue : comp.labelFalse)
        setCellStyle(resRow, col, { textColor: passed ? comp.colorPass : comp.colorFail, bold: true })
      })
    }
  }, [setCellValue, setCellStyle, getColLetter])

  // ── "Inserir na planilha" from CategoryPanel ──────────────────────────────
  const handleSendToGrid = useCallback((category: Category) => {
    const startRow = selectedCell?.row ?? 0, startCol = selectedCell?.col ?? 0
    categoryAnchorRef.current[category.id] = { row: startRow, col: startCol }
    writeCategoryToGrid(category, startRow, startCol)
    setSelectedCell({ row: startRow, col: startCol })
  }, [selectedCell, writeCategoryToGrid, setSelectedCell])

  // ── Insert chart SVG into grid (floating overlay) ──────────────────────────
  const handleInsertChart = useCallback((svgContent: string, title: string, spanRows: number, spanCols: number) => {
    const anchorRow = selectedCell?.row ?? 0, anchorCol = selectedCell?.col ?? 0
    addChart({ svgContent, title, anchorRow, anchorCol, spanRows, spanCols })
  }, [selectedCell, addChart])

  // ── Insert data table rows into grid ──────────────────────────────────────
  const handleInsertData = useCallback((rows: string[][], label: string) => {
    const startRow = selectedCell?.row ?? 0, startCol = selectedCell?.col ?? 0
    setCellValue(startRow, startCol, label); setCellStyle(startRow, startCol, { bold: true })
    rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        const r = startRow + 1 + ri, c = startCol + ci
        if (r >= ROWS || c >= COLS) return
        setCellValue(r, c, cell)
        if (ri === 0) setCellStyle(r, c, { bold: true })
      })
    })
    setSelectedCell({ row: startRow, col: startCol })
  }, [selectedCell, setCellValue, setCellStyle, setSelectedCell])

  // ── Auto-sync changed categories ──────────────────────────────────────────
  const prevCategoriesRef = useRef<Category[]>([])
  useEffect(() => {
    const prev = prevCategoriesRef.current
    categories.forEach(cat => {
      const anchor = categoryAnchorRef.current[cat.id]; if (!anchor) return
      const prevCat = prev.find(c => c.id === cat.id); if (!prevCat) return
      const changed = JSON.stringify(cat.items) !== JSON.stringify(prevCat.items)
        || JSON.stringify(cat.subDivisionValues) !== JSON.stringify(prevCat.subDivisionValues)
        || JSON.stringify(cat.comparisons) !== JSON.stringify(prevCat.comparisons)
        || cat.operation !== prevCat.operation
        || JSON.stringify(cat.logic) !== JSON.stringify(prevCat.logic)
      if (changed) writeCategoryToGrid(cat, anchor.row, anchor.col)
    })
    prevCategoriesRef.current = categories
  }, [categories, writeCategoryToGrid])

  // ── Sync grid edits BACK to category (planilha → categoria) ───────────────
  // When a user edits a cell that falls inside a category's grid block,
  // propagate the new value back into the category state.
  const handleCellValueChange = useCallback((r: number, c: number, v: string) => {
    setCellValue(r, c, v)

    // Check if this cell belongs to any anchored category
    for (const cat of categories) {
      const anchor = categoryAnchorRef.current[cat.id]
      if (!anchor) continue

      const startRow = anchor.row
      const startCol = anchor.col

      if (cat.useSubDivisions && cat.subDivisions.length > 0) {
        // SubDivision grid: header row = startRow, data rows = startRow+1..
        // cols: name=startCol, sd[0]=startCol+1, sd[1]=startCol+2, ...
        const sdCount = cat.subDivisions.length
        const colMin = startCol + 1
        const colMax = startCol + sdCount
        const rowMin = startRow + 1
        const rowMax = startRow + cat.items.length

        if (r >= rowMin && r <= rowMax && c >= colMin && c <= colMax) {
          const itemIdx = r - rowMin
          const sdIdx   = c - colMin
          const item = cat.items[itemIdx]
          const sd   = cat.subDivisions[sdIdx]
          if (item && sd) {
            const parsed = parseFloat(v)
            setSubDivisionValue(cat.id, sd.id, item.id, isNaN(parsed) ? (v || null) : parsed)
          }
          return
        }
      } else {
        // Flat mode: name=startCol, value=startCol+1, data rows=startRow+1..
        if (c === startCol + 1 && r >= startRow + 1 && r <= startRow + cat.items.length) {
          const itemIdx = r - startRow - 1
          const item = cat.items[itemIdx]
          if (item) {
            updateItem(cat.id, item.id, { rawValueInput: v })
          }
          return
        }
      }
    }
  }, [categories, setCellValue, setSubDivisionValue, updateItem])

  const handleUpdateItem = useCallback((categoryId: string, itemId: string, name: string, raw: string) => { updateItem(categoryId, itemId, { name, rawValueInput: raw }) }, [updateItem])
  const handleUpdateItemMeta = useCallback((categoryId: string, itemId: string, updates: Partial<{ absent: boolean; exempt: boolean }>) => { updateItem(categoryId, itemId, updates) }, [updateItem])

  // Apply a school template: create all categories with subDivisions, logic and comparisons atomically
  const handleApplyTemplate = useCallback((template: SchoolTemplate) => {
    const createdIds: Record<string, string> = {}
    template.categories.forEach(({ name, operation, subDivisions = [], logicPatch = {}, comparisons = [] }) => {
      const id = addCategoryFull(name, operation, subDivisions, logicPatch, comparisons)
      createdIds[name] = id
    })
    // Build boletim config from template periods
    const periods = template.periods.map((p, i) => ({
      id: `p_${i}_${Math.random().toString(36).slice(2, 6)}`,
      label: p.label,
      weight: p.weight,
      categoryIds: p.categoryNames.map(n => createdIds[n]).filter(Boolean),
    }))
    const freqCat = template.categories.find(c => c.operation === "FREQUENCIA")
    const attendanceCategoryId = freqCat ? (createdIds[freqCat.name] ?? null) : null
    setBoletimConfig({
      periods,
      rule: { ...template.rule, attendanceCategoryId },
      finalAverageMode: "simple",
    })
    setCategoryDialogOpen(true)
  }, [addCategoryFull])
  const hasNumericSelection = getSelectedValues().length > 0

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
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
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler)
  }, [undo, redo, copy, paste, deleteSelection])

  return (
    <div ref={containerRef} data-spreadsheet-container className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
        <span className="text-sm font-semibold text-foreground mr-2">Planilha</span>
        <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)} className="h-7 text-xs gap-1.5">
          <GraduationCap size={14} />Diário de Classe
          {categories.length > 0 && <span className="ml-0.5 bg-primary/15 text-primary px-1.5 rounded-full text-[10px] font-bold">{categories.length}</span>}
        </Button>
        {categories.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setChartDialogOpen(true)} className="h-7 text-xs gap-1.5">
            <BarChart2 size={14} />Gráficos
          </Button>
        )}
      </div>

      <Toolbar
        currentStyle={currentCellData?.style || { bold: false, italic: false, underline: false, align: "left", fontSize: 13, bgColor: "", textColor: "" }}
        onStyleChange={setStyleForSelection} onUndo={undo} onRedo={redo} onCopy={copy} onPaste={paste} onDelete={deleteSelection}
        onInsertFormula={handleInsertFormula} onApplyFunction={handleApplyFunction} hasSelection={hasNumericSelection}
      />
      <FormulaBar cellRef={getSelectedCellRef()} value={currentCellData?.value || ""} formula={currentCellData?.formula || ""} onValueChange={handleFormulaBarChange} />

      <div className="flex flex-1 min-h-0">
        <Grid
          getCell={getCell} charts={charts} onRemoveChart={removeChart}
          selectedCell={selectedCell} selectionRange={selectionRange} editingCell={editingCell}
          onCellSelect={handleCellSelect} onSelectionChange={setSelectionRange}
          onCellEdit={handleCellEdit} onCellValueChange={handleCellValueChange}
          onStopEditing={() => setEditingCell(null)} getColLetter={getColLetter}
        />
        <CategoryDialog
          open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen} categories={categories}
          roster={roster}
          onAddCategory={addCategory} onRemoveCategory={removeCategory} onSetOperation={setOperation}
          onAddItem={addItem} onRemoveItem={removeItem} onUpdateItem={handleUpdateItem}
          onSendToGrid={handleSendToGrid}
          onAddComparison={addComparison} onUpdateComparison={updateComparison} onRemoveComparison={removeComparison}
          onToggleSubDivisions={toggleSubDivisions} onAddSubDivision={addSubDivision}
          onRemoveSubDivision={removeSubDivision} onRenameSubDivision={renameSubDivision}
          onSetSubDivisionValue={setSubDivisionValue} onUpdateItemMeta={handleUpdateItemMeta}
          onUpdateLogic={updateLogic} onUpdateGlobalLogic={updateGlobalLogic}
          onUpdateBands={updateBands} onApplyScalePreset={applyScalePreset}
          onUpdateSubDivision={updateSubDivision}
          onOpenChart={() => setChartDialogOpen(true)}
          boletimConfig={boletimConfig}
          onBoletimConfigChange={setBoletimConfig}
          onApplyTemplate={handleApplyTemplate}
        />
      </div>

      <ChartDialog
        open={chartDialogOpen} onOpenChange={setChartDialogOpen} categories={categories}
        onInsertChart={handleInsertChart}
        onInsertData={handleInsertData}
      />

      <StatusBar cells={cells} selectionRange={selectionRange} getCell={getCell} />
    </div>
  )
}