"use client"

import { useState } from "react"
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Send,
  FolderPlus,
  Calculator,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type {
  Category,
  OperationType,
} from "@/hooks/use-categories"
import { computeResult } from "@/hooks/use-categories"

type CategoryPanelProps = {
  categories: Category[]
  onAddCategory: (name: string) => void
  onRemoveCategory: (id: string) => void
  onSetOperation: (id: string, op: OperationType) => void
  onAddItem: (categoryId: string, name: string, value: number) => void
  onRemoveItem: (categoryId: string, itemId: string) => void
  onSendToGrid: (category: Category) => void
  isOpen: boolean
  onToggle: () => void
}

const OPERATIONS: { value: OperationType; label: string }[] = [
  { value: "SOMA", label: "Soma" },
  { value: "MEDIA", label: "Media" },
  { value: "CONTAR", label: "Contar" },
  { value: "MAX", label: "Maximo" },
  { value: "MIN", label: "Minimo" },
]

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("pt-BR")
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function CategoryCard({
  category,
  onRemove,
  onSetOperation,
  onAddItem,
  onRemoveItem,
  onSendToGrid,
}: {
  category: Category
  onRemove: () => void
  onSetOperation: (op: OperationType) => void
  onAddItem: (name: string, value: number) => void
  onRemoveItem: (itemId: string) => void
  onSendToGrid: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [itemName, setItemName] = useState("")
  const [itemValue, setItemValue] = useState("")

  const result = computeResult(category.items, category.operation)

  const handleAddItem = () => {
    const name = itemName.trim()
    const value = parseFloat(itemValue)
    if (!name || isNaN(value)) return
    onAddItem(name, value)
    setItemName("")
    setItemValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddItem()
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
      >
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: category.color }}
        />
        {expanded ? (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {category.name}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {category.items.length} {category.items.length === 1 ? "item" : "itens"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Operation selector + result */}
          <div className="px-3 py-2 flex items-center gap-2 bg-muted/30">
            <Select
              value={category.operation}
              onValueChange={(v) => onSetOperation(v as OperationType)}
            >
              <SelectTrigger className="h-7 text-xs w-24 bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONS.map((op) => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 text-right">
              <span className="text-xs text-muted-foreground mr-1">Resultado:</span>
              <span
                className="text-sm font-bold"
                style={{ color: category.color }}
              >
                {result !== null ? formatNumber(result) : "--"}
              </span>
            </div>
          </div>

          <Separator />

          {/* Items list */}
          {category.items.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              {category.items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                    idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                    {idx + 1}.
                  </span>
                  <span className="flex-1 truncate text-foreground">{item.name}</span>
                  <span className="font-mono text-xs font-medium text-foreground shrink-0">
                    {formatNumber(item.value)}
                  </span>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-0.5 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="Remover item"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {category.items.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum item cadastrado
              </p>
            </div>
          )}

          <Separator />

          {/* Add item form */}
          <div className="px-3 py-2 flex gap-1.5">
            <Input
              placeholder="Nome"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs flex-1 min-w-0"
            />
            <Input
              placeholder="Valor"
              type="number"
              step="any"
              value={itemValue}
              onChange={(e) => setItemValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs w-20"
            />
            <Button
              size="sm"
              onClick={handleAddItem}
              disabled={!itemName.trim() || !itemValue || isNaN(parseFloat(itemValue))}
              className="h-7 px-2 shrink-0"
            >
              <Plus size={14} />
            </Button>
          </div>

          {/* Actions */}
          <div className="px-3 py-2 flex gap-1.5 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={onSendToGrid}
              disabled={category.items.length === 0}
              className="h-7 text-xs flex-1 gap-1"
            >
              <Send size={12} />
              Enviar para planilha
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CategoryPanel({
  categories,
  onAddCategory,
  onRemoveCategory,
  onSetOperation,
  onAddItem,
  onRemoveItem,
  onSendToGrid,
  isOpen,
  onToggle,
}: CategoryPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const handleCreateCategory = () => {
    const name = newCategoryName.trim()
    if (!name) return
    onAddCategory(name)
    setNewCategoryName("")
    setDialogOpen(false)
  }

  if (!isOpen) {
    return (
      <div data-category-panel className="flex flex-col items-center py-3 px-1 border-l border-border bg-card shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0"
          title="Abrir categorias"
        >
          <FolderPlus size={16} className="text-muted-foreground" />
        </Button>
      </div>
    )
  }

  return (
    <div data-category-panel className="w-72 xl:w-80 border-l border-border bg-card flex flex-col shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Calculator size={14} className="text-primary" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Categorias
          </h2>
          {categories.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
              {categories.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-6 px-2 text-[10px] gap-1"
          >
            <Plus size={12} />
            Nova
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-6 w-6 p-0"
          >
            <X size={14} className="text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Categories list */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-2 flex flex-col gap-2">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <FolderPlus size={20} className="text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Nenhuma categoria
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Crie uma categoria para cadastrar
                  <br />
                  itens por nome e valor
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialogOpen(true)}
                className="h-7 text-xs gap-1"
              >
                <Plus size={12} />
                Criar categoria
              </Button>
            </div>
          ) : (
            categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onRemove={() => onRemoveCategory(category.id)}
                onSetOperation={(op) => onSetOperation(category.id, op)}
                onAddItem={(name, value) => onAddItem(category.id, name, value)}
                onRemoveItem={(itemId) => onRemoveItem(category.id, itemId)}
                onSendToGrid={() => onSendToGrid(category)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create category dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
            <DialogDescription>
              Crie uma categoria para agrupar itens por nome e valor.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Nome da categoria
              </label>
              <Input
                placeholder="Ex: Despesas, Receitas, Estoque..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCategory()
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setNewCategoryName("")
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim()}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
