"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Plus, Trash2, ChevronDown, ChevronRight, X,
  TableIcon, FolderPlus, Calculator, Target,
  ArrowRightLeft, Info, Pencil, Check, GripVertical,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  Tooltip, TooltipContent,
  TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type {
  Category, CategoryItem, OperationType, ComparisonOperator,
  ComparisonScope, ExternalComparison,
} from "@/hooks/use-categories"
import {
  computeResult, computeItemHorizontalResult,
  evaluateComparison, getComparisonTarget,
} from "@/hooks/use-categories"

// ─── Types ───────────────────────────────────────────────────────────────────
type CategoryPanelProps = {
  categories: Category[]
  onAddCategory: (name: string) => void
  onRemoveCategory: (id: string) => void
  onSetOperation: (id: string, op: OperationType) => void
  onAddItem: (categoryId: string, name: string, raw: string) => void
  onRemoveItem: (categoryId: string, itemId: string) => void
  onUpdateItem: (categoryId: string, itemId: string, name: string, raw: string) => void
  onSendToGrid: (category: Category) => void
  onAddComparison: (
    categoryId: string, label: string, refValue: number,
    operator: ComparisonOperator, scope: ComparisonScope,
    labelTrue: string, labelFalse: string, colorPass: string, colorFail: string
  ) => void
  onUpdateComparison: (categoryId: string, compId: string, updates: Partial<ExternalComparison>) => void
  onRemoveComparison: (categoryId: string, compId: string) => void
  isOpen: boolean
  onToggle: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────
const OPERATIONS: { value: OperationType; label: string; group: string; desc: string }[] = [
  { value: "SOMA",             label: "Soma",             group: "Vertical",   desc: "Soma todos os valores da lista" },
  { value: "MEDIA",            label: "Média",            group: "Vertical",   desc: "Calcula a média de todos os valores" },
  { value: "CONTAR",           label: "Contar",           group: "Vertical",   desc: "Conta quantos itens existem" },
  { value: "MAX",              label: "Máximo",           group: "Vertical",   desc: "Retorna o maior valor" },
  { value: "MIN",              label: "Mínimo",           group: "Vertical",   desc: "Retorna o menor valor" },
  { value: "HORIZONTAL_SOMA",  label: "↔ Soma por linha",  group: "Horizontal", desc: "Soma os valores de cada linha. Ex: 7, 8, 9 → 24" },
  { value: "HORIZONTAL_MEDIA", label: "↔ Média por linha", group: "Horizontal", desc: "Média dos valores de cada linha. Ex: 7, 8, 9 → 8,0" },
  { value: "HORIZONTAL_MAX",   label: "↔ Máx por linha",   group: "Horizontal", desc: "Maior valor de cada linha" },
  { value: "HORIZONTAL_MIN",   label: "↔ Mín por linha",   group: "Horizontal", desc: "Menor valor de cada linha" },
]

const COMPARISON_OPS: { value: ComparisonOperator; label: string; desc: string }[] = [
  { value: ">",  label: ">",  desc: "Maior que" },
  { value: ">=", label: "≥",  desc: "Maior ou igual a" },
  { value: "<",  label: "<",  desc: "Menor que" },
  { value: "<=", label: "≤",  desc: "Menor ou igual a" },
  { value: "==", label: "=",  desc: "Igual a" },
  { value: "!=", label: "≠",  desc: "Diferente de" },
]

const MIN_PANEL_WIDTH = 260
const MAX_PANEL_WIDTH = 600
const DEFAULT_PANEL_WIDTH = 288 // ~w-72

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("pt-BR")
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isH(op: OperationType) { return op.startsWith("HORIZONTAL_") }

function Tip({ children, text, side = "left" }: {
  children: React.ReactNode; text: string; side?: "left" | "right" | "top" | "bottom"
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-[230px] text-xs leading-relaxed">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Inline editable item row ─────────────────────────────────────────────────
function ItemRow({
  item,
  idx,
  horizontal,
  operation,
  categoryColor,
  onRemove,
  onUpdate,
}: {
  item: CategoryItem
  idx: number
  horizontal: boolean
  operation: OperationType
  categoryColor: string
  onRemove: () => void
  onUpdate: (name: string, raw: string) => void
}) {
  const [editing,   setEditing]   = useState(false)
  const [editName,  setEditName]  = useState(item.name)
  const [editValue, setEditValue] = useState(item.rawValueInput ?? item.value.toString())
  const nameRef = useRef<HTMLInputElement>(null)

  const rowResult = horizontal ? computeItemHorizontalResult(item, operation) : null

  const startEdit = () => {
    setEditName(item.name)
    setEditValue(item.rawValueInput ?? item.value.toString())
    setEditing(true)
    setTimeout(() => nameRef.current?.focus(), 30)
  }

  const commitEdit = () => {
    const name = editName.trim()
    const raw  = editValue.trim()
    if (name && raw) onUpdate(name, raw)
    setEditing(false)
  }

  const cancelEdit = () => {
    setEditName(item.name)
    setEditValue(item.rawValueInput ?? item.value.toString())
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit() }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit() }
  }

  if (editing) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 border-b border-border/30 last:border-0 ring-1 ring-primary/40 ring-inset z-10 relative ${
          idx % 2 === 0 ? "bg-primary/5" : "bg-primary/5"
        }`}
      >
        <span className="text-[10px] text-muted-foreground w-5 shrink-0 text-right">{idx + 1}.</span>
        <Input
          ref={nameRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 text-xs flex-1 min-w-0 px-1.5"
          placeholder="Nome"
        />
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 text-xs w-20 font-mono px-1.5"
          placeholder={horizontal ? "7, 8, 9" : "Valor"}
        />
        <Tip text="Confirmar (Enter)" side="left">
          <button
            onClick={commitEdit}
            className="w-5 h-5 rounded flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Check size={11} />
          </button>
        </Tip>
        <Tip text="Cancelar (Esc)" side="left">
          <button
            onClick={cancelEdit}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0"
          >
            <X size={11} />
          </button>
        </Tip>
      </div>
    )
  }

  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1.5 text-xs border-b border-border/30 last:border-0 cursor-default ${
        idx % 2 === 0 ? "bg-card" : "bg-muted/10"
      } hover:bg-primary/5 transition-colors`}
      onDoubleClick={startEdit}
      title="Clique duplo para editar"
    >
      <span className="text-[10px] text-muted-foreground w-5 shrink-0 text-right">{idx + 1}.</span>
      <span className="flex-1 truncate text-foreground font-medium">{item.name}</span>

      {horizontal ? (
        <>
          <div className="w-20 text-center">
            <span className="font-mono text-[10px] text-muted-foreground">
              {item.values?.length ? item.values.map(fmt).join(", ") : fmt(item.value)}
            </span>
          </div>
          <span className="font-mono font-bold w-14 text-right text-xs shrink-0" style={{ color: categoryColor }}>
            {rowResult !== null ? fmt(rowResult) : "—"}
          </span>
        </>
      ) : (
        <span className="font-mono font-medium w-16 text-right text-foreground shrink-0">
          {fmt(item.value)}
        </span>
      )}

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Tip text="Editar item" side="left">
          <button
            onClick={startEdit}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <Pencil size={10} />
          </button>
        </Tip>
        <Tip text={`Remover "${item.name}"`} side="left">
          <button
            onClick={onRemove}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={10} />
          </button>
        </Tip>
      </div>
    </div>
  )
}

// ─── Comparison Form ──────────────────────────────────────────────────────────
function ComparisonForm({
  items, initial, onSave, onCancel,
}: {
  items: Category["items"]
  initial?: Partial<ExternalComparison>
  onSave: (data: Omit<ExternalComparison, "id" | "colorPass" | "colorFail">) => void
  onCancel: () => void
}) {
  const [label,      setLabel]      = useState(initial?.label      ?? "")
  const [refValue,   setRefValue]   = useState(initial?.refValue?.toString() ?? "")
  const [operator,   setOperator]   = useState<ComparisonOperator>(initial?.operator  ?? ">=")
  const [scope,      setScope]      = useState<ComparisonScope>(initial?.scope ?? "each")
  const [labelTrue,  setLabelTrue]  = useState(initial?.labelTrue  ?? "Sim")
  const [labelFalse, setLabelFalse] = useState(initial?.labelFalse ?? "Não")

  const canSave = label.trim() && !isNaN(parseFloat(refValue))

  const scopeLabel = (s: ComparisonScope) => {
    if (s === "total") return "Total da categoria"
    if (s === "each")  return "Cada item individualmente"
    const id = s.replace("item:", "")
    return items.find((i) => i.id === id)?.name ?? "Item específico"
  }

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome da comparação</label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Média da Escola, Meta de Vendas…" className="h-7 text-xs" autoFocus />
        <p className="text-[10px] text-muted-foreground">Este nome vira cabeçalho de coluna na planilha.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Condição</label>
        <div className="flex gap-1.5 items-center">
          <span className="text-[11px] text-muted-foreground shrink-0">Valor</span>
          <Select value={operator} onValueChange={(v) => setOperator(v as ComparisonOperator)}>
            <SelectTrigger className="h-7 text-xs w-16 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPARISON_OPS.map((op) => (
                <SelectItem key={op.value} value={op.value} className="text-xs">
                  <span className="font-mono mr-1.5">{op.label}</span>
                  <span className="text-muted-foreground">{op.desc}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={refValue} onChange={(e) => setRefValue(e.target.value)} placeholder="Valor externo" type="number" step="any" className="h-7 text-xs flex-1 font-mono" onKeyDown={(e) => { if (e.key === "Enter" && canSave) onSave({ label: label.trim(), refValue: parseFloat(refValue), operator, scope, labelTrue, labelFalse }) }} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aplicar a</label>
        <Select value={scope} onValueChange={(v) => setScope(v as ComparisonScope)}>
          <SelectTrigger className="h-7 text-xs w-full"><SelectValue>{scopeLabel(scope)}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="each" className="text-xs">
              <span className="font-medium">Cada item individualmente</span>
              <span className="text-muted-foreground ml-1">— uma coluna por linha</span>
            </SelectItem>
            <SelectItem value="total" className="text-xs">
              <span className="font-medium">Total da categoria</span>
              <span className="text-muted-foreground ml-1">— comparar o resultado geral</span>
            </SelectItem>
            {items.length > 0 && (
              <>
                <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-1.5">Item específico</div>
                {items.map((item) => (
                  <SelectItem key={item.id} value={`item:${item.id}`} className="text-xs">{item.name}</SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {scope === "total" && "O resultado agregado da categoria é comparado ao valor externo."}
          {scope === "each"  && "Cada item é comparado individualmente. Uma coluna aparece na planilha para cada linha."}
          {scope.startsWith("item:") && `Somente "${scopeLabel(scope)}" é comparado.`}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Texto na planilha</label>
        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">✓ Quando verdadeiro</span>
            <Input value={labelTrue} onChange={(e) => setLabelTrue(e.target.value)} placeholder="Aprovado" className="h-7 text-xs border-green-200 dark:border-green-800" />
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-[10px] text-red-500 dark:text-red-400 font-semibold">✗ Quando falso</span>
            <Input value={labelFalse} onChange={(e) => setLabelFalse(e.target.value)} placeholder="Reprovado" className="h-7 text-xs border-red-200 dark:border-red-800" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">Estes textos aparecem nas células da coluna "<span className="italic">{label || "…"}</span>" na planilha.</p>
      </div>

      <div className="flex gap-1.5 justify-end pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs px-3">Cancelar</Button>
        <Button size="sm" onClick={() => onSave({ label: label.trim(), refValue: parseFloat(refValue), operator, scope, labelTrue, labelFalse })} disabled={!canSave} className="h-7 text-xs px-3">
          {initial?.label ? "Salvar alterações" : "Adicionar comparação"}
        </Button>
      </div>
    </div>
  )
}

// ─── Comparison Badge ─────────────────────────────────────────────────────────
function ComparisonBadge({ comp, category, onRemove, onUpdate }: {
  comp: ExternalComparison
  category: Category
  onRemove: () => void
  onUpdate: (updates: Partial<ExternalComparison>) => void
}) {
  const [editing, setEditing] = useState(false)
  const catResult = computeResult(category.items, category.operation)
  const opLabel   = COMPARISON_OPS.find((o) => o.value === comp.operator)?.label ?? comp.operator
  const isTotalScope = comp.scope === "total"
  const previewRows = isTotalScope
    ? [{ name: "Total", result: catResult, applies: true }]
    : category.items.map((item) => {
        const val = getComparisonTarget(comp, item, catResult, category.operation)
        return { name: item.name, result: val, applies: val !== null }
      })
  const passCount    = previewRows.filter((r) => r.applies && r.result !== null && evaluateComparison(r.result, comp)).length
  const totalApplies = previewRows.filter((r) => r.applies).length

  if (editing) {
    return (
      <ComparisonForm
        items={category.items}
        initial={comp}
        onSave={(data) => { onUpdate(data); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden cursor-pointer hover:shadow-sm transition-all" onClick={() => setEditing(true)} title="Clique para editar">
      <div className="flex items-center gap-2 px-2.5 py-2 bg-muted/30">
        <Target size={12} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{comp.label}</p>
          <p className="text-[10px] text-muted-foreground">
            valor {opLabel} {fmt(comp.refValue)} · {isTotalScope ? "total" : comp.scope === "each" ? "cada item" : `item: ${category.items.find(i => i.id === comp.scope.replace("item:", ""))?.name ?? "—"}`}
          </p>
        </div>
        <div className="text-[10px] font-bold shrink-0 tabular-nums">
          <span className="text-green-600 dark:text-green-400">{passCount}</span>
          <span className="text-muted-foreground">/{totalApplies}</span>
        </div>
        <Tip text="Remover esta comparação" side="left">
          <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X size={12} />
          </button>
        </Tip>
      </div>
      {previewRows.some((r) => r.applies) && (
        <div className="border-t border-border/50">
          {previewRows.filter((r) => r.applies).slice(0, 5).map((row, i) => {
            const passed = row.result !== null ? evaluateComparison(row.result, comp) : null
            const color  = passed === null ? "#6b7280" : passed ? comp.colorPass : comp.colorFail
            const text   = passed === null ? "—" : passed ? comp.labelTrue : comp.labelFalse
            return (
              <div key={i} className={`flex items-center gap-2 px-2.5 py-1 text-xs ${i % 2 === 0 ? "bg-card" : "bg-muted/10"}`}>
                <span className="flex-1 truncate text-muted-foreground">{row.name}</span>
                {row.result !== null && <span className="font-mono text-[10px] text-muted-foreground">{fmt(row.result)}</span>}
                <span className="font-semibold shrink-0 text-[11px] px-1.5 py-0.5 rounded" style={{ color, backgroundColor: color + "18" }}>{text}</span>
              </div>
            )
          })}
          {previewRows.filter((r) => r.applies).length > 5 && (
            <p className="px-2.5 py-1 text-[10px] text-muted-foreground border-t border-border/30">+{previewRows.filter((r) => r.applies).length - 5} itens…</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 px-2.5 py-1.5 bg-muted/20 border-t border-border/50">
        <span className="text-[10px]"><span className="font-semibold" style={{ color: comp.colorPass }}>✓</span><span className="text-muted-foreground ml-1">{comp.labelTrue}</span></span>
        <span className="text-[10px]"><span className="font-semibold" style={{ color: comp.colorFail }}>✗</span><span className="text-muted-foreground ml-1">{comp.labelFalse}</span></span>
        <span className="text-[10px] text-muted-foreground ml-auto italic">clique para editar</span>
      </div>
    </div>
  )
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────
function CategoryCard({
  category, onRemove, onSetOperation, onAddItem, onRemoveItem, onUpdateItem,
  onSendToGrid, onAddComparison, onUpdateComparison, onRemoveComparison,
}: {
  category: Category
  onRemove: () => void
  onSetOperation: (op: OperationType) => void
  onAddItem: (name: string, raw: string) => void
  onRemoveItem: (id: string) => void
  onUpdateItem: (id: string, name: string, raw: string) => void
  onSendToGrid: () => void
  onAddComparison: (label: string, refValue: number, operator: ComparisonOperator, scope: ComparisonScope, labelTrue: string, labelFalse: string, colorPass: string, colorFail: string) => void
  onUpdateComparison: (id: string, updates: Partial<ExternalComparison>) => void
  onRemoveComparison: (id: string) => void
}) {
  const [expanded,        setExpanded]        = useState(true)
  const [showComparisons, setShowComparisons] = useState(false)
  const [addingComp,      setAddingComp]      = useState(false)
  const [itemName,        setItemName]        = useState("")
  const [itemValue,       setItemValue]       = useState("")

  const result     = computeResult(category.items, category.operation)
  const horizontal = isH(category.operation)
  const opInfo     = OPERATIONS.find((o) => o.value === category.operation)

  const handleAddItem = () => {
    const name = itemName.trim(); const raw = itemValue.trim()
    if (!name || !raw) return
    onAddItem(name, raw)
    setItemName(""); setItemValue("")
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
        {expanded ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
        <span className="text-sm font-medium text-foreground truncate flex-1">{category.name}</span>
        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">
          {category.items.length} {category.items.length === 1 ? "item" : "itens"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* ── Operation + Result ── */}
          <div className="px-3 py-2 flex items-center gap-2 bg-muted/30">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Select value={category.operation} onValueChange={(v) => onSetOperation(v as OperationType)}>
                <SelectTrigger className="h-7 text-xs bg-card border-border flex-1 min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">↕ Vertical</div>
                  {OPERATIONS.filter((o) => o.group === "Vertical").map((op) => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                  ))}
                  <Separator className="my-1" />
                  <div className="px-2 pt-1 pb-0.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">↔ Horizontal</div>
                  {OPERATIONS.filter((o) => o.group === "Horizontal").map((op) => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {opInfo && (
                <Tip text={opInfo.desc} side="top">
                  <div className="cursor-help p-1 shrink-0"><Info size={12} className="text-muted-foreground" /></div>
                </Tip>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-muted-foreground block">Total</span>
              <span className="text-sm font-bold" style={{ color: category.color }}>{result !== null ? fmt(result) : "—"}</span>
            </div>
          </div>

          {/* ── Horizontal banner ── */}
          {horizontal && (
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border-y border-blue-200 dark:border-blue-800/60">
              <div className="flex items-start gap-2">
                <ArrowRightLeft size={12} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Modo horizontal ativo</p>
                  <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                    Insira múltiplos valores separados por vírgula. Ex: <strong className="font-mono">7, 8, 9</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* ── Items list ── */}
          {category.items.length > 0 && (
            <div className="max-h-56 overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/60 border-b border-border sticky top-0 z-10">
                <span className="w-5 shrink-0" />
                <span className="text-[10px] font-semibold text-muted-foreground flex-1">Nome</span>
                {horizontal ? (
                  <>
                    <span className="text-[10px] font-semibold text-muted-foreground w-20 text-center">Valores</span>
                    <span className="text-[10px] font-semibold text-muted-foreground w-14 text-right">Resultado</span>
                  </>
                ) : (
                  <span className="text-[10px] font-semibold text-muted-foreground w-16 text-right">Valor</span>
                )}
                <span className="w-10 shrink-0" />
              </div>

              {category.items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  idx={idx}
                  horizontal={horizontal}
                  operation={category.operation}
                  categoryColor={category.color}
                  onRemove={() => onRemoveItem(item.id)}
                  onUpdate={(name, raw) => onUpdateItem(item.id, name, raw)}
                />
              ))}
            </div>
          )}

          {category.items.length === 0 && (
            <div className="px-3 py-5 text-center">
              <p className="text-xs text-muted-foreground">Nenhum item ainda</p>
            </div>
          )}

          <Separator />

          {/* ── Add item ── */}
          <div className="px-3 py-2 flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <Input
                placeholder="Nome do item"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem() }}}
                className="h-7 text-xs flex-1 min-w-0"
              />
              <Input
                placeholder={horizontal ? "Ex: 7, 8, 9" : "Valor"}
                value={itemValue}
                onChange={(e) => setItemValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem() }}}
                className="h-7 text-xs w-24 font-mono"
              />
              <Tip text="Adicionar item" side="left">
                <Button size="sm" onClick={handleAddItem} disabled={!itemName.trim() || !itemValue.trim()} className="h-7 w-7 p-0 shrink-0">
                  <Plus size={13} />
                </Button>
              </Tip>
            </div>
            <p className="text-[10px] text-muted-foreground px-0.5">
              {horizontal
                ? "💡 Separe múltiplos valores por vírgula: 7, 8, 9 · Clique duplo em qualquer item para editar"
                : "💡 Clique duplo em qualquer item para editá-lo"}
            </p>
          </div>

          {/* ── Actions ── */}
          <div className="px-3 pb-3 pt-1 flex gap-1.5">
            <Tip
              text={category.items.length === 0 ? "Adicione itens antes de inserir na planilha" : "Copia os dados para a planilha a partir da célula selecionada. Edições nos itens são sincronizadas automaticamente enquanto a janela está aberta."}
              side="top"
            >
              <Button variant="outline" size="sm" onClick={onSendToGrid} disabled={category.items.length === 0} className="h-8 text-xs flex-1 gap-1.5 font-medium">
                <TableIcon size={13} />
                Inserir na planilha
              </Button>
            </Tip>
            <Tip
              text={showComparisons ? "Fechar painel de comparações" : "Comparar resultados com valores externos. O resultado aparece como coluna na planilha com os textos que você definir."}
              side="top"
            >
              <Button variant={showComparisons ? "default" : "outline"} size="sm" onClick={() => setShowComparisons(!showComparisons)} className="h-8 text-xs gap-1.5 shrink-0">
                <Target size={13} />
                Comparar
                {category.comparisons.length > 0 && (
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full leading-none ${showComparisons ? "bg-white/20 text-white" : "bg-primary/15 text-primary"}`}>
                    {category.comparisons.length}
                  </span>
                )}
              </Button>
            </Tip>
            <Tip text="Excluir esta categoria" side="top">
              <Button variant="outline" size="sm" onClick={onRemove} className="h-8 px-2 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">
                <Trash2 size={13} />
              </Button>
            </Tip>
          </div>

          {/* ── Comparisons ── */}
          {showComparisons && (
            <>
              <Separator />
              <div className="px-3 py-3 flex flex-col gap-2.5 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Target size={12} className="text-primary" />
                    <p className="text-xs font-semibold text-foreground">Comparações externas</p>
                  </div>
                  {!addingComp && (
                    <button onClick={() => setAddingComp(true)} className="flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary transition-colors">
                      <Plus size={11} />Nova
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Define uma referência externa e escolhe se compara o <strong>total</strong>, <strong>cada item</strong> ou um <strong>item específico</strong>. O resultado aparece como coluna na planilha.
                </p>
                {category.comparisons.map((comp) => (
                  <ComparisonBadge key={comp.id} comp={comp} category={category} onRemove={() => onRemoveComparison(comp.id)} onUpdate={(updates) => onUpdateComparison(comp.id, updates)} />
                ))}
                {addingComp && (
                  <ComparisonForm
                    items={category.items}
                    onSave={(data) => { onAddComparison(data.label, data.refValue, data.operator, data.scope, data.labelTrue, data.labelFalse, "#16a34a", "#dc2626"); setAddingComp(false) }}
                    onCancel={() => setAddingComp(false)}
                  />
                )}
                {!addingComp && category.comparisons.length === 0 && (
                  <button onClick={() => setAddingComp(true)} className="flex items-center justify-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors py-3 border border-dashed border-border rounded-lg hover:border-primary/40 hover:bg-primary/5">
                    <Plus size={13} />Adicionar primeira comparação
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CategoryPanel (with resize) ─────────────────────────────────────────────
export function CategoryPanel({
  categories, onAddCategory, onRemoveCategory, onSetOperation,
  onAddItem, onRemoveItem, onUpdateItem, onSendToGrid,
  onAddComparison, onUpdateComparison, onRemoveComparison,
  isOpen, onToggle,
}: CategoryPanelProps) {
  const [dialogOpen,      setDialogOpen]      = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [panelWidth,      setPanelWidth]      = useState(DEFAULT_PANEL_WIDTH)
  const [isDragging,      setIsDragging]      = useState(false)
  const dragStartX  = useRef(0)
  const dragStartW  = useRef(DEFAULT_PANEL_WIDTH)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartW.current = panelWidth
    setIsDragging(true)
  }, [panelWidth])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      // Panel is on the right, so dragging LEFT (smaller clientX) = wider
      const delta = dragStartX.current - e.clientX
      const newW  = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, dragStartW.current + delta))
      setPanelWidth(newW)
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [isDragging])

  const handleCreate = () => {
    if (!newCategoryName.trim()) return
    onAddCategory(newCategoryName.trim())
    setNewCategoryName(""); setDialogOpen(false)
  }

  if (!isOpen) {
    return (
      <div data-category-panel className="flex flex-col items-center py-3 px-1 border-l border-border bg-card shrink-0">
        <Tip text="Abrir painel de categorias" side="left">
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0">
            <FolderPlus size={16} className="text-muted-foreground" />
          </Button>
        </Tip>
      </div>
    )
  }

  return (
    <div
      data-category-panel
      className="border-l border-border bg-card flex flex-row shrink-0"
      style={{ width: panelWidth }}
    >
      {/* ── Drag handle ── */}
      <div
        onMouseDown={handleDragStart}
        className={`w-1.5 shrink-0 flex items-center justify-center cursor-col-resize group transition-colors hover:bg-primary/20 ${isDragging ? "bg-primary/30" : ""}`}
        title="Arraste para redimensionar"
      >
        <div className={`w-0.5 h-8 rounded-full transition-colors ${isDragging ? "bg-primary" : "bg-border group-hover:bg-primary/50"}`} />
      </div>

      {/* ── Panel content ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <Calculator size={14} className="text-primary shrink-0" />
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide truncate">Categorias</h2>
            {categories.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">{categories.length}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" onClick={() => setDialogOpen(true)} className="h-6 px-2 text-[10px] gap-1">
              <Plus size={11} />
              Nova categoria
            </Button>
            <Tip text="Fechar painel" side="left">
              <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0">
                <X size={14} className="text-muted-foreground" />
              </Button>
            </Tip>
          </div>
        </div>

        {/* Width indicator while dragging */}
        {isDragging && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-2 py-0.5 text-[10px] font-mono text-muted-foreground shadow z-50 pointer-events-none">
            {panelWidth}px
          </div>
        )}

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-2 flex flex-col gap-2">
            {categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Calculator size={22} className="text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Nenhuma categoria</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[200px]">
                    Agrupe dados, calcule resultados e compare com metas ou referências externas.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)} className="h-7 text-xs gap-1">
                  <Plus size={12} />Criar primeira categoria
                </Button>
              </div>
            ) : (
              categories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  onRemove={() => onRemoveCategory(cat.id)}
                  onSetOperation={(op) => onSetOperation(cat.id, op)}
                  onAddItem={(name, raw) => onAddItem(cat.id, name, raw)}
                  onRemoveItem={(itemId) => onRemoveItem(cat.id, itemId)}
                  onUpdateItem={(itemId, name, raw) => onUpdateItem(cat.id, itemId, name, raw)}
                  onSendToGrid={() => onSendToGrid(cat)}
                  onAddComparison={(label, ref, op, scope, lt, lf, cp, cf) => onAddComparison(cat.id, label, ref, op, scope, lt, lf, cp, cf)}
                  onUpdateComparison={(compId, updates) => onUpdateComparison(cat.id, compId, updates)}
                  onRemoveComparison={(compId) => onRemoveComparison(cat.id, compId)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
              <DialogDescription>Dê um nome que identifique o grupo. Ex: Notas dos Alunos, Despesas do Mês, Estoque.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Nome da categoria…" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }} autoFocus />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setNewCategoryName("") }}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!newCategoryName.trim()}>Criar categoria</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}