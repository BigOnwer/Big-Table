"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FolderPlus } from "lucide-react"
import { useSpreadsheet, ROWS, COLS } from "@/hooks/use-spreadsheet"
import { useCategories, type Category } from "@/hooks/use-categories"
import { Button } from "@/components/ui/button"
import { Toolbar } from "./toolbar"
import { FormulaBar } from "./formula-bar"
import { Grid } from "./grid"
import { StatusBar } from "./status-bar"
import { CategoryPanel } from "./category-panel"

export function Spreadsheet() {
  const {
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
  } = useSpreadsheet()

  const {
    categories,
    addCategory,
    removeCategory,
    setOperation,
    addItem,
    removeItem,
    getResult,
  } = useCategories()

  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const currentCellData = selectedCell ? getCell(selectedCell.row, selectedCell.col) : null

  const handleCellSelect = useCallback(
    (row: number, col: number) => {
      setSelectedCell({ row, col })
      setEditingCell(null)
    },
    [setSelectedCell, setEditingCell]
  )

  const handleCellEdit = useCallback(
    (row: number, col: number) => {
      setEditingCell({ row, col })
    },
    [setEditingCell]
  )

  const handleCellValueChange = useCallback(
    (row: number, col: number, value: string) => {
      setCellValue(row, col, value)
    },
    [setCellValue]
  )

  const handleFormulaBarChange = useCallback(
    (value: string) => {
      if (selectedCell) {
        setCellValue(selectedCell.row, selectedCell.col, value)
      }
    },
    [selectedCell, setCellValue]
  )

  const handleInsertFormula = useCallback(
    (formula: string) => {
      if (selectedCell) {
        setEditingCell(selectedCell)
        // We'll set the formula in the editing state - it will be applied on Enter
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>(
            `input[class*="font-mono"]`
          )
          if (input) {
            input.value = formula
            input.focus()
            input.setSelectionRange(formula.length, formula.length)
          }
        }, 50)
      }
    },
    [selectedCell, setEditingCell]
  )

  const handleApplyFunction = useCallback(
    (funcName: string) => {
      applyFunctionToSelection(funcName)
    },
    [applyFunctionToSelection]
  )

  // Send category data to the grid starting from the selected cell
  const handleSendToGrid = useCallback(
    (category: Category) => {
      const startRow = selectedCell ? selectedCell.row : 0
      const startCol = selectedCell ? selectedCell.col : 0

      // Write category name as header
      setCellValue(startRow, startCol, category.name)
      setCellValue(startRow, startCol + 1, "Valor")

      // Style the header
      setCellStyle(startRow, startCol, { bold: true, bgColor: category.color, textColor: "#ffffff" })
      setCellStyle(startRow, startCol + 1, { bold: true, bgColor: category.color, textColor: "#ffffff" })

      // Write items
      category.items.forEach((item, idx) => {
        const row = startRow + 1 + idx
        if (row < ROWS) {
          setCellValue(row, startCol, item.name)
          setCellValue(row, startCol + 1, item.value.toString())
        }
      })

      // Write result row
      const resultRow = startRow + 1 + category.items.length
      if (resultRow < ROWS) {
        setCellValue(resultRow, startCol, `${category.operation}:`)
        setCellStyle(resultRow, startCol, { bold: true })

        // Use a formula referencing the value range
        const rangeStart = getColLetter(startCol + 1) + (startRow + 2)
        const rangeEnd = getColLetter(startCol + 1) + (startRow + 1 + category.items.length)
        setCellValue(resultRow, startCol + 1, `=${category.operation}(${rangeStart}:${rangeEnd})`)
        setCellStyle(resultRow, startCol + 1, { bold: true })
      }

      // Select the first data cell
      setSelectedCell({ row: startRow, col: startCol })
    },
    [selectedCell, setCellValue, setCellStyle, setSelectedCell, getColLetter]
  )

  // Check if there are numeric values in the current selection
  const hasNumericSelection = (() => {
    const values = getSelectedValues()
    return values.length > 0
  })()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if we're typing in an input outside the grid or in the category panel
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" && !target.closest("[data-spreadsheet-container]")) return
      if (target.tagName === "INPUT" && target.closest("[data-category-panel]")) return

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
            return
          case "y":
            e.preventDefault()
            redo()
            return
          case "c":
            e.preventDefault()
            copy()
            return
          case "v":
            e.preventDefault()
            paste()
            return
          case "b":
            e.preventDefault()
            if (currentCellData) {
              setStyleForSelection({ bold: !currentCellData.style.bold })
            }
            return
          case "i":
            e.preventDefault()
            if (currentCellData) {
              setStyleForSelection({ italic: !currentCellData.style.italic })
            }
            return
          case "u":
            e.preventDefault()
            if (currentCellData) {
              setStyleForSelection({ underline: !currentCellData.style.underline })
            }
            return
        }
      }

      if (!editingCell && selectedCell) {
        switch (e.key) {
          case "ArrowUp":
            e.preventDefault()
            setSelectedCell({ row: Math.max(0, selectedCell.row - 1), col: selectedCell.col })
            setSelectionRange(null)
            break
          case "ArrowDown":
            e.preventDefault()
            setSelectedCell({ row: Math.min(ROWS - 1, selectedCell.row + 1), col: selectedCell.col })
            setSelectionRange(null)
            break
          case "ArrowLeft":
            e.preventDefault()
            setSelectedCell({ row: selectedCell.row, col: Math.max(0, selectedCell.col - 1) })
            setSelectionRange(null)
            break
          case "ArrowRight":
            e.preventDefault()
            setSelectedCell({ row: selectedCell.row, col: Math.min(COLS - 1, selectedCell.col + 1) })
            setSelectionRange(null)
            break
          case "Tab":
            e.preventDefault()
            setSelectedCell({ row: selectedCell.row, col: Math.min(COLS - 1, selectedCell.col + 1) })
            setSelectionRange(null)
            break
          case "Enter":
            e.preventDefault()
            setEditingCell(selectedCell)
            break
          case "Delete":
          case "Backspace":
            e.preventDefault()
            deleteSelection()
            break
          case "F2":
            e.preventDefault()
            setEditingCell(selectedCell)
            break
          default:
            // Start editing if user types a character
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              setEditingCell(selectedCell)
            }
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    selectedCell,
    editingCell,
    currentCellData,
    setSelectedCell,
    setSelectionRange,
    setEditingCell,
    undo,
    redo,
    copy,
    paste,
    deleteSelection,
    setStyleForSelection,
  ])

  return (
    <div
      ref={containerRef}
      data-spreadsheet-container
      className="flex flex-col h-screen bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-sm bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">P</span>
          </div>
          <h1 className="text-sm font-semibold text-foreground">Planilha</h1>
        </div>
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

      {/* Toolbar */}
      <Toolbar
        currentStyle={
          currentCellData?.style || {
            bold: false,
            italic: false,
            underline: false,
            align: "left",
            fontSize: 13,
            bgColor: "",
            textColor: "",
          }
        }
        onStyleChange={setStyleForSelection}
        onUndo={undo}
        onRedo={redo}
        onCopy={copy}
        onPaste={paste}
        onDelete={deleteSelection}
        onInsertFormula={handleInsertFormula}
        onApplyFunction={handleApplyFunction}
        hasSelection={hasNumericSelection}
      />

      {/* Formula Bar */}
      <FormulaBar
        cellRef={getSelectedCellRef()}
        value={currentCellData?.value || ""}
        formula={currentCellData?.formula || ""}
        onValueChange={handleFormulaBarChange}
      />

      {/* Grid + Category Panel */}
      <div className="flex flex-1 min-h-0">
        <Grid
          getCell={getCell}
          selectedCell={selectedCell}
          selectionRange={selectionRange}
          editingCell={editingCell}
          onCellSelect={handleCellSelect}
          onSelectionChange={setSelectionRange}
          onCellEdit={handleCellEdit}
          onCellValueChange={handleCellValueChange}
          onStopEditing={() => {
            setEditingCell(null)
            if (selectedCell) {
              setSelectedCell({ row: selectedCell.row + 1, col: selectedCell.col })
            }
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
          onSendToGrid={handleSendToGrid}
          isOpen={categoryPanelOpen}
          onToggle={() => setCategoryPanelOpen(!categoryPanelOpen)}
        />
      </div>

      {/* Status Bar */}
      <StatusBar cells={cells} selectionRange={selectionRange} getCell={getCell} />
    </div>
  )
}
