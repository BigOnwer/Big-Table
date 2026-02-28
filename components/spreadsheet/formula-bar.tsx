"use client"

import { useRef, useEffect, useState } from "react"

type FormulaBarProps = {
  cellRef: string
  value: string
  formula: string
  onValueChange: (value: string) => void
}

export function FormulaBar({ cellRef, value, formula, onValueChange }: FormulaBarProps) {
  const [editValue, setEditValue] = useState(formula || value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(formula || value)
  }, [formula, value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onValueChange(editValue)
      inputRef.current?.blur()
    }
    if (e.key === "Escape") {
      setEditValue(formula || value)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="flex items-center border-b border-border bg-card">
      <div className="flex items-center justify-center w-16 h-9 border-r border-border bg-cell-header shrink-0">
        <span className="text-xs font-mono font-medium text-cell-header-foreground">
          {cellRef || "A1"}
        </span>
      </div>
      <div className="flex items-center px-2 h-9 flex-1">
        <span className="text-xs text-muted-foreground italic mr-2 shrink-0">fx</span>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (editValue !== (formula || value)) {
              onValueChange(editValue)
            }
          }}
          className="w-full h-full text-sm font-mono bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          placeholder="Digite um valor ou formula (ex: =SOMA(A1:A5))"
        />
      </div>
    </div>
  )
}
