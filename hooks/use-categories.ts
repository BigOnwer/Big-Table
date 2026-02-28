"use client"

import { useState, useCallback } from "react"

export type CategoryItem = {
  id: string
  name: string
  value: number
}

export type OperationType = "SOMA" | "MEDIA" | "CONTAR" | "MAX" | "MIN"

export type Category = {
  id: string
  name: string
  color: string
  operation: OperationType
  items: CategoryItem[]
}

const CATEGORY_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#ea580c", // orange
  "#9333ea", // purple
  "#0891b2", // cyan
  "#ca8a04", // yellow
  "#db2777", // pink
]

let colorIndex = 0

function getNextColor(): string {
  const color = CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length]
  colorIndex++
  return color
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function computeResult(items: CategoryItem[], operation: OperationType): number | null {
  const values = items.map((i) => i.value)
  if (values.length === 0) return null

  switch (operation) {
    case "SOMA":
      return values.reduce((a, b) => a + b, 0)
    case "MEDIA":
      return values.reduce((a, b) => a + b, 0) / values.length
    case "CONTAR":
      return values.length
    case "MAX":
      return Math.max(...values)
    case "MIN":
      return Math.min(...values)
    default:
      return null
  }
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])

  const addCategory = useCallback((name: string) => {
    const newCategory: Category = {
      id: generateId(),
      name,
      color: getNextColor(),
      operation: "SOMA",
      items: [],
    }
    setCategories((prev) => [...prev, newCategory])
    return newCategory.id
  }, [])

  const removeCategory = useCallback((categoryId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId))
  }, [])

  const renameCategory = useCallback((categoryId: string, name: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, name } : c))
    )
  }, [])

  const setOperation = useCallback((categoryId: string, operation: OperationType) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, operation } : c))
    )
  }, [])

  const addItem = useCallback((categoryId: string, name: string, value: number) => {
    const newItem: CategoryItem = {
      id: generateId(),
      name,
      value,
    }
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId ? { ...c, items: [...c.items, newItem] } : c
      )
    )
  }, [])

  const removeItem = useCallback((categoryId: string, itemId: string) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
          : c
      )
    )
  }, [])

  const updateItem = useCallback(
    (categoryId: string, itemId: string, updates: Partial<Pick<CategoryItem, "name" | "value">>) => {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                items: c.items.map((i) =>
                  i.id === itemId ? { ...i, ...updates } : i
                ),
              }
            : c
        )
      )
    },
    []
  )

  const getResult = useCallback(
    (categoryId: string): number | null => {
      const category = categories.find((c) => c.id === categoryId)
      if (!category) return null
      return computeResult(category.items, category.operation)
    },
    [categories]
  )

  return {
    categories,
    addCategory,
    removeCategory,
    renameCategory,
    setOperation,
    addItem,
    removeItem,
    updateItem,
    getResult,
  }
}
