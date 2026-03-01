"use client"

import { useState, useCallback } from "react"

export type CategoryItem = {
  id: string
  name: string
  value: number
  values?: number[]
  rawValueInput?: string
}

export type OperationType =
  | "SOMA"
  | "MEDIA"
  | "CONTAR"
  | "MAX"
  | "MIN"
  | "HORIZONTAL_SOMA"
  | "HORIZONTAL_MEDIA"
  | "HORIZONTAL_MAX"
  | "HORIZONTAL_MIN"

export type ComparisonOperator = ">" | ">=" | "<" | "<=" | "==" | "!="

/**
 * scope:
 *   "total"   → compara contra o resultado agregado de toda a categoria
 *   "each"    → compara contra o resultado de cada item individualmente
 *   "item:<id>" → compara contra um item específico pelo id
 */
export type ComparisonScope = "total" | "each" | `item:${string}`

export type ExternalComparison = {
  id: string
  label: string            // nome da comparação, vira cabeçalho de coluna na planilha
  refValue: number         // valor de referência externo
  operator: ComparisonOperator
  scope: ComparisonScope   // o que comparar
  labelTrue: string        // texto quando passa  (ex: "Aprovado", "Atingiu meta")
  labelFalse: string       // texto quando falha  (ex: "Reprovado", "Abaixo da meta")
  colorPass: string
  colorFail: string
}

export type Category = {
  id: string
  name: string
  color: string
  operation: OperationType
  items: CategoryItem[]
  comparisons: ExternalComparison[]
}

const CATEGORY_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#ea580c",
  "#9333ea", "#0891b2", "#ca8a04", "#db2777",
]
let colorIndex = 0
function getNextColor() {
  return CATEGORY_COLORS[colorIndex++ % CATEGORY_COLORS.length]
}
function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

export function parseValueInput(raw: string): { values: number[]; isMultiple: boolean } {
  const parts = raw.split(",").map((s) => s.trim())
  if (parts.length > 1) {
    const nums = parts.map(parseFloat).filter((n) => !isNaN(n))
    return { values: nums, isMultiple: true }
  }
  const single = parseFloat(raw)
  return { values: isNaN(single) ? [] : [single], isMultiple: false }
}

export function computeResult(items: CategoryItem[], operation: OperationType): number | null {
  const isH = operation.startsWith("HORIZONTAL_")
  if (isH) {
    if (!items.length) return null
    const rows = items.map((item) => computeItemHorizontalResult(item, operation))
    const valid = rows.filter((r): r is number => r !== null)
    return valid.length ? valid.reduce((a, b) => a + b, 0) : null
  }
  const vals = items.map((i) => i.value)
  if (!vals.length) return null
  switch (operation) {
    case "SOMA":   return vals.reduce((a, b) => a + b, 0)
    case "MEDIA":  return vals.reduce((a, b) => a + b, 0) / vals.length
    case "CONTAR": return vals.length
    case "MAX":    return Math.max(...vals)
    case "MIN":    return Math.min(...vals)
    default:       return null
  }
}

export function computeItemHorizontalResult(item: CategoryItem, operation: OperationType): number | null {
  const vals = item.values?.length ? item.values : [item.value]
  if (!vals.length) return null
  switch (operation) {
    case "HORIZONTAL_SOMA":  return vals.reduce((a, b) => a + b, 0)
    case "HORIZONTAL_MEDIA": return vals.reduce((a, b) => a + b, 0) / vals.length
    case "HORIZONTAL_MAX":   return Math.max(...vals)
    case "HORIZONTAL_MIN":   return Math.min(...vals)
    default:                 return item.value
  }
}

export function evaluateComparison(result: number, comp: ExternalComparison): boolean {
  switch (comp.operator) {
    case ">":  return result > comp.refValue
    case ">=": return result >= comp.refValue
    case "<":  return result < comp.refValue
    case "<=": return result <= comp.refValue
    case "==": return result === comp.refValue
    case "!=": return result !== comp.refValue
    default:   return false
  }
}

/**
 * Retorna o resultado que deve ser comparado para um dado item/escopo.
 * null significa "não se aplica a este item".
 */
export function getComparisonTarget(
  comp: ExternalComparison,
  item: CategoryItem,
  categoryResult: number | null,
  operation: OperationType
): number | null {
  if (comp.scope === "total") return categoryResult
  if (comp.scope === "each") {
    return operation.startsWith("HORIZONTAL_")
      ? computeItemHorizontalResult(item, operation)
      : item.value
  }
  // "item:<id>"
  const targetId = comp.scope.replace("item:", "")
  if (item.id !== targetId) return null
  return operation.startsWith("HORIZONTAL_")
    ? computeItemHorizontalResult(item, operation)
    : item.value
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])

  const addCategory = useCallback((name: string) => {
    const cat: Category = {
      id: generateId(), name,
      color: getNextColor(),
      operation: "SOMA",
      items: [], comparisons: [],
    }
    setCategories((p) => [...p, cat])
    return cat.id
  }, [])

  const removeCategory = useCallback((id: string) => {
    setCategories((p) => p.filter((c) => c.id !== id))
  }, [])

  const renameCategory = useCallback((id: string, name: string) => {
    setCategories((p) => p.map((c) => c.id === id ? { ...c, name } : c))
  }, [])

  const setOperation = useCallback((id: string, operation: OperationType) => {
    setCategories((p) => p.map((c) => c.id === id ? { ...c, operation } : c))
  }, [])

  const addItem = useCallback((categoryId: string, name: string, rawValueInput: string) => {
    const { values, isMultiple } = parseValueInput(rawValueInput)
    const item: CategoryItem = {
      id: generateId(), name,
      value: values[0] ?? 0,
      values: isMultiple ? values : undefined,
      rawValueInput,
    }
    setCategories((p) => p.map((c) => c.id === categoryId ? { ...c, items: [...c.items, item] } : c))
  }, [])

  const removeItem = useCallback((categoryId: string, itemId: string) => {
    setCategories((p) =>
      p.map((c) => c.id === categoryId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c)
    )
  }, [])

  const updateItem = useCallback((
    categoryId: string,
    itemId: string,
    updates: Partial<Pick<CategoryItem, "name" | "value" | "rawValueInput">>
  ) => {
    setCategories((p) =>
      p.map((c) => c.id === categoryId ? {
        ...c,
        items: c.items.map((i) => {
          if (i.id !== itemId) return i
          const raw = updates.rawValueInput ?? i.rawValueInput ?? ""
          const { values, isMultiple } = parseValueInput(raw)
          return { ...i, ...updates, value: values[0] ?? i.value, values: isMultiple ? values : undefined }
        }),
      } : c)
    )
  }, [])

  const addComparison = useCallback((
    categoryId: string,
    label: string,
    refValue: number,
    operator: ComparisonOperator = ">=",
    scope: ComparisonScope = "each",
    labelTrue = "Sim",
    labelFalse = "Não",
    colorPass = "#16a34a",
    colorFail = "#dc2626"
  ) => {
    const comp: ExternalComparison = {
      id: generateId(), label, refValue, operator, scope,
      labelTrue, labelFalse, colorPass, colorFail,
    }
    setCategories((p) =>
      p.map((c) => c.id === categoryId ? { ...c, comparisons: [...c.comparisons, comp] } : c)
    )
  }, [])

  const updateComparison = useCallback((
    categoryId: string,
    compId: string,
    updates: Partial<ExternalComparison>
  ) => {
    setCategories((p) =>
      p.map((c) => c.id === categoryId ? {
        ...c,
        comparisons: c.comparisons.map((comp) => comp.id === compId ? { ...comp, ...updates } : comp),
      } : c)
    )
  }, [])

  const removeComparison = useCallback((categoryId: string, compId: string) => {
    setCategories((p) =>
      p.map((c) => c.id === categoryId
        ? { ...c, comparisons: c.comparisons.filter((comp) => comp.id !== compId) }
        : c)
    )
  }, [])

  const getResult = useCallback((categoryId: string): number | null => {
    const cat = categories.find((c) => c.id === categoryId)
    return cat ? computeResult(cat.items, cat.operation) : null
  }, [categories])

  return {
    categories,
    addCategory, removeCategory, renameCategory,
    setOperation,
    addItem, removeItem, updateItem,
    addComparison, updateComparison, removeComparison,
    getResult,
  }
}