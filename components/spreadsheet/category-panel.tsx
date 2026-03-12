"use client"

import { useState, useRef, useMemo, useCallback } from "react"
import {
  Plus, Trash2, ChevronDown, ChevronRight, X, TableIcon,
  Target, Info, Pencil, Check, Columns, ListOrdered,
  BarChart2, Settings2, FlaskConical, TrendingUp, Award, RotateCcw,
  AlertTriangle, UserCheck, Hash, Zap, BookOpen, GraduationCap, Lock,
  ClipboardCheck, Ruler, TrendingDown, CheckCircle2, XCircle, Clock,
  Layers, FileText, ChevronUp, Minus, Users, CalendarDays, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type {
  Category, CategoryItem, OperationType,
  ComparisonOperator, ComparisonScope, ExternalComparison,
  GradeBand, CategoryLogic, ScaleType,
} from "@/hooks/use-categories"
import {
  computeItemSubDivResult, computeRegraDeTres, computeGabaritoItemScore,
  evaluateComparison, getComparisonTarget, computeCategoryResult,
  computeItemScores, computeClassStats, computeRanks, getBand,
  applyRound, SCALE_PRESETS, generateId, evalCustomFormula,
} from "@/hooks/use-categories"

// ─── Boletim types ───────────────────────────────────────────────────────────
export type PeriodGroup = {
  id: string
  label: string
  categoryIds: string[]
  weight: number
}

export type SituationRule = {
  passThreshold: number
  recoveryThreshold: number
  attendanceMin: number
  attendanceCategoryId: string | null
}

export type BoletimConfig = {
  periods: PeriodGroup[]
  rule: SituationRule
  finalAverageMode: "simple" | "weighted"
}

export function makeDefaultBoletimConfig(): BoletimConfig {
  return {
    periods: [
      { id: "b1", label: "B1", categoryIds: [], weight: 1 },
      { id: "b2", label: "B2", categoryIds: [], weight: 1 },
      { id: "b3", label: "B3", categoryIds: [], weight: 1 },
      { id: "b4", label: "B4", categoryIds: [], weight: 1 },
    ],
    rule: { passThreshold: 6, recoveryThreshold: 5, attendanceMin: 75, attendanceCategoryId: null },
    finalAverageMode: "simple",
  }
}

export type SchoolTemplate = {
  id: string; label: string; description: string; icon: string
  categories: {
    name: string
    operation: import("@/hooks/use-categories").OperationType
    subDivisions?: { name: string; weight?: number; isRecovery?: boolean; recoveryFor?: string; isAbsenceCol?: boolean }[]
    logicPatch?: Partial<import("@/hooks/use-categories").CategoryLogic>
    comparisons?: Omit<import("@/hooks/use-categories").ExternalComparison, "id">[]
  }[]
  periods: { label: string; categoryNames: string[]; weight: number }[]
  rule: SituationRule
}

export const SCHOOL_TEMPLATES: SchoolTemplate[] = [
  {
    id: "fundamental", label: "Fundamental", description: "4 bimestres · média ≥ 6 · presença 75%", icon: "📚",
    categories: [
      {
        name: "B1 — Notas", operation: "MEDIA",
        subDivisions: [
          { name: "Prova 1", weight: 1 }, { name: "Prova 2", weight: 1 },
          { name: "Trabalho", weight: 1 }, { name: "Participação", weight: 1 },
        ],
        logicPatch: { maxScore: 10 },
        comparisons: [
          { label: "Aprovado B1", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓ Aprovado", labelFalse: "✗ Reprovado", colorPass: "#16a34a", colorFail: "#dc2626" },
        ],
      },
      {
        name: "B2 — Notas", operation: "MEDIA",
        subDivisions: [
          { name: "Prova 1", weight: 1 }, { name: "Prova 2", weight: 1 },
          { name: "Trabalho", weight: 1 }, { name: "Participação", weight: 1 },
        ],
        logicPatch: { maxScore: 10 },
        comparisons: [
          { label: "Aprovado B2", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓ Aprovado", labelFalse: "✗ Reprovado", colorPass: "#16a34a", colorFail: "#dc2626" },
        ],
      },
      {
        name: "B3 — Notas", operation: "MEDIA",
        subDivisions: [
          { name: "Prova 1", weight: 1 }, { name: "Prova 2", weight: 1 },
          { name: "Trabalho", weight: 1 }, { name: "Participação", weight: 1 },
        ],
        logicPatch: { maxScore: 10 },
        comparisons: [
          { label: "Aprovado B3", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓ Aprovado", labelFalse: "✗ Reprovado", colorPass: "#16a34a", colorFail: "#dc2626" },
        ],
      },
      {
        name: "B4 — Notas", operation: "MEDIA",
        subDivisions: [
          { name: "Prova 1", weight: 1 }, { name: "Prova 2", weight: 1 },
          { name: "Trabalho", weight: 1 }, { name: "Participação", weight: 1 },
        ],
        logicPatch: { maxScore: 10 },
        comparisons: [
          { label: "Aprovado B4", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓ Aprovado", labelFalse: "✗ Reprovado", colorPass: "#16a34a", colorFail: "#dc2626" },
        ],
      },
      {
        name: "Frequência", operation: "FREQUENCIA",
        subDivisions: Array.from({ length: 20 }, (_, i) => ({ name: `Aula ${i + 1}`, isAbsenceCol: true })),
        logicPatch: { attendanceWarningThreshold: 75 },
        comparisons: [
          { label: "Freq. regular", refValue: 75, operator: ">=", scope: "each", labelTrue: "✓ Regular", labelFalse: "⚠ Em risco", colorPass: "#16a34a", colorFail: "#f97316" },
        ],
      },
    ],
    periods: [
      { label: "B1", categoryNames: ["B1 — Notas"], weight: 1 },
      { label: "B2", categoryNames: ["B2 — Notas"], weight: 1 },
      { label: "B3", categoryNames: ["B3 — Notas"], weight: 1 },
      { label: "B4", categoryNames: ["B4 — Notas"], weight: 1 },
    ],
    rule: { passThreshold: 6, recoveryThreshold: 5, attendanceMin: 75, attendanceCategoryId: null },
  },
  {
    id: "medio_ponderado", label: "Médio Ponderado", description: "4 bimestres com pesos diferentes", icon: "🎓",
    categories: [
      {
        name: "B1 — P1", operation: "MEDIA_PONDERADA",
        subDivisions: [{ name: "Prova", weight: 6 }, { name: "Trabalho", weight: 4 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Meta B1-P1", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "B1 — P2", operation: "MEDIA_PONDERADA",
        subDivisions: [{ name: "Prova", weight: 6 }, { name: "Trabalho", weight: 4 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Meta B1-P2", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "B2 — P1", operation: "MEDIA_PONDERADA",
        subDivisions: [{ name: "Prova", weight: 6 }, { name: "Trabalho", weight: 4 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Meta B2-P1", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "B2 — P2", operation: "MEDIA_PONDERADA",
        subDivisions: [{ name: "Prova", weight: 6 }, { name: "Trabalho", weight: 4 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Meta B2-P2", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "B3 — P1", operation: "MEDIA_PONDERADA",
        subDivisions: [{ name: "Prova", weight: 6 }, { name: "Trabalho", weight: 4 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Meta B3-P1", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "B3 — P2", operation: "MEDIA_PONDERADA",
        subDivisions: [{ name: "Prova", weight: 6 }, { name: "Trabalho", weight: 4 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Meta B3-P2", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "B4 — P1", operation: "MEDIA_PONDERADA",
        subDivisions: [{ name: "Prova", weight: 6 }, { name: "Trabalho", weight: 4 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Meta B4-P1", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "B4 — P2", operation: "MEDIA_PONDERADA",
        subDivisions: [{ name: "Prova", weight: 6 }, { name: "Trabalho", weight: 4 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Meta B4-P2", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "Frequência", operation: "FREQUENCIA",
        subDivisions: Array.from({ length: 20 }, (_, i) => ({ name: `Aula ${i + 1}`, isAbsenceCol: true })),
        logicPatch: { attendanceWarningThreshold: 75 },
        comparisons: [{ label: "Freq. regular", refValue: 75, operator: ">=", scope: "each", labelTrue: "✓ Regular", labelFalse: "⚠ Em risco", colorPass: "#16a34a", colorFail: "#f97316" }],
      },
    ],
    periods: [
      { label: "B1", categoryNames: ["B1 — P1", "B1 — P2"], weight: 2 },
      { label: "B2", categoryNames: ["B2 — P1", "B2 — P2"], weight: 2 },
      { label: "B3", categoryNames: ["B3 — P1", "B3 — P2"], weight: 3 },
      { label: "B4", categoryNames: ["B4 — P1", "B4 — P2"], weight: 3 },
    ],
    rule: { passThreshold: 6, recoveryThreshold: 5, attendanceMin: 75, attendanceCategoryId: null },
  },
  {
    id: "gabarito", label: "Provas Gabarito", description: "Correção automática por gabarito", icon: "📝",
    categories: [
      {
        name: "Prova 1", operation: "GABARITO",
        subDivisions: Array.from({ length: 10 }, (_, i) => ({ name: `Q${i + 1}` })),
        logicPatch: { normalise: true, normaliseTarget: 10 },
        comparisons: [{ label: "Aprovado Prova 1", refValue: 60, operator: ">=", scope: "each", labelTrue: "✓ Aprovado", labelFalse: "✗ Reprovado", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "Prova 2", operation: "GABARITO",
        subDivisions: Array.from({ length: 10 }, (_, i) => ({ name: `Q${i + 1}` })),
        logicPatch: { normalise: true, normaliseTarget: 10 },
        comparisons: [{ label: "Aprovado Prova 2", refValue: 60, operator: ">=", scope: "each", labelTrue: "✓ Aprovado", labelFalse: "✗ Reprovado", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "Prova 3", operation: "GABARITO",
        subDivisions: Array.from({ length: 10 }, (_, i) => ({ name: `Q${i + 1}` })),
        logicPatch: { normalise: true, normaliseTarget: 10 },
        comparisons: [{ label: "Aprovado Prova 3", refValue: 60, operator: ">=", scope: "each", labelTrue: "✓ Aprovado", labelFalse: "✗ Reprovado", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "Trabalho", operation: "MEDIA",
        subDivisions: [{ name: "Conteúdo", weight: 5 }, { name: "Apresentação", weight: 3 }, { name: "Criatividade", weight: 2 }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Aprovado Trabalho", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "Frequência", operation: "FREQUENCIA",
        subDivisions: Array.from({ length: 20 }, (_, i) => ({ name: `Aula ${i + 1}`, isAbsenceCol: true })),
        logicPatch: { attendanceWarningThreshold: 75 },
        comparisons: [{ label: "Freq. regular", refValue: 75, operator: ">=", scope: "each", labelTrue: "✓ Regular", labelFalse: "⚠ Em risco", colorPass: "#16a34a", colorFail: "#f97316" }],
      },
    ],
    periods: [
      { label: "1º Sem", categoryNames: ["Prova 1", "Trabalho"], weight: 1 },
      { label: "2º Sem", categoryNames: ["Prova 2", "Prova 3"], weight: 1 },
    ],
    rule: { passThreshold: 6, recoveryThreshold: 5, attendanceMin: 75, attendanceCategoryId: null },
  },
  {
    id: "simples", label: "Registro Simples", description: "Média de provas sem bimestres", icon: "📋",
    categories: [
      {
        name: "P1", operation: "MEDIA",
        subDivisions: [{ name: "Nota" }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Aprovado P1", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "P2", operation: "MEDIA",
        subDivisions: [{ name: "Nota" }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Aprovado P2", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "P3", operation: "MEDIA",
        subDivisions: [{ name: "Nota" }],
        logicPatch: { maxScore: 10 },
        comparisons: [{ label: "Aprovado P3", refValue: 6, operator: ">=", scope: "each", labelTrue: "✓", labelFalse: "✗", colorPass: "#16a34a", colorFail: "#dc2626" }],
      },
      {
        name: "Recuperação", operation: "MEDIA",
        subDivisions: [{ name: "Nota", isRecovery: false }],
        logicPatch: { maxScore: 10 },
      },
    ],
    periods: [{ label: "Ano", categoryNames: ["P1", "P2", "P3"], weight: 1 }],
    rule: { passThreshold: 6, recoveryThreshold: 5, attendanceMin: 75, attendanceCategoryId: null },
  },
]

// ─── Boletim computation ──────────────────────────────────────────────────────

type StudentSituation = {
  itemId: string
  name: string
  periodAverages: Record<string, number | null>
  finalAverage: number | null
  attendance: number | null
  situation: "aprovado" | "recuperacao" | "reprovado" | "pendente"
  failedPeriods: string[]
}

function rnd(n: number, d = 2) { return Math.round(n * 10 ** d) / 10 ** d }

function computeStudentSituations(
  categories: import("@/hooks/use-categories").Category[],
  roster: { id: string; name: string }[],
  config: BoletimConfig,
): StudentSituation[] {
  const { periods, rule, finalAverageMode } = config
  const scoreMaps = new Map<string, Map<string, number>>()
  categories.forEach(cat => scoreMaps.set(cat.id, computeItemScores(cat)))

  return roster.map(student => {
    const periodAverages: Record<string, number | null> = {}
    for (const period of periods) {
      const vals: number[] = []
      for (const catId of period.categoryIds) {
        const score = scoreMaps.get(catId)?.get(student.id)
        if (score !== undefined) vals.push(score)
      }
      periodAverages[period.id] = vals.length > 0 ? rnd(vals.reduce((a, b) => a + b, 0) / vals.length) : null
    }

    let finalAverage: number | null = null
    const validPeriods = periods.filter(p => periodAverages[p.id] !== null)
    if (validPeriods.length > 0) {
      if (finalAverageMode === "weighted") {
        const totalWeight = validPeriods.reduce((s, p) => s + p.weight, 0)
        if (totalWeight > 0)
          finalAverage = rnd(validPeriods.reduce((s, p) => s + (periodAverages[p.id]! * p.weight), 0) / totalWeight)
      } else {
        finalAverage = rnd(validPeriods.reduce((s, p) => s + periodAverages[p.id]!, 0) / validPeriods.length)
      }
    }

    let attendance: number | null = null
    if (rule.attendanceCategoryId)
      attendance = scoreMaps.get(rule.attendanceCategoryId)?.get(student.id) ?? null

    const failedPeriods = periods
      .filter(p => { const avg = periodAverages[p.id]; return avg !== null && avg < rule.passThreshold })
      .map(p => p.label)

    let situation: StudentSituation["situation"] = "pendente"
    const absentFail = attendance !== null && attendance < rule.attendanceMin
    if (absentFail) {
      situation = "reprovado"
    } else if (finalAverage !== null) {
      if (finalAverage >= rule.passThreshold)        situation = "aprovado"
      else if (finalAverage >= rule.recoveryThreshold) situation = "recuperacao"
      else                                           situation = "reprovado"
    }

    return { itemId: student.id, name: student.name, periodAverages, finalAverage, attendance, situation, failedPeriods }
  })
}

// ─── Boletim sub-components ───────────────────────────────────────────────────

function SituationBadge({ sit, compact = false }: { sit: StudentSituation["situation"]; compact?: boolean }) {
  const cfg = {
    aprovado:    { icon: CheckCircle2, label: "Aprovado",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700/50" },
    recuperacao: { icon: Clock,        label: "Recuperação", cls: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700/50" },
    reprovado:   { icon: XCircle,      label: "Reprovado",   cls: "bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700/50" },
    pendente:    { icon: Minus,        label: "Pendente",    cls: "bg-muted/50 text-muted-foreground border-border/60" },
  }[sit]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 font-bold border rounded-lg ${compact ? "text-[9px] px-1 py-0" : "text-[10px] px-1.5 py-0.5"} ${cfg.cls}`}>
      <Icon size={compact ? 8 : 9} />
      {compact ? cfg.label.slice(0, 4) : cfg.label}
    </span>
  )
}

function ScorePill({ value, pass, recovery }: { value: number | null; pass: number; recovery: number }) {
  if (value === null) return <span className="text-muted-foreground/25 text-xs font-mono">—</span>
  const cls = value >= pass ? "text-emerald-700 dark:text-emerald-400 font-bold"
    : value >= recovery    ? "text-amber-600 dark:text-amber-400 font-semibold"
    :                        "text-red-600 dark:text-red-400 font-bold"
  return <span className={`text-xs font-mono tabular-nums ${cls}`}>{rnd(value, 1)}</span>
}

// ─── BoletimTab ───────────────────────────────────────────────────────────────
function BoletimTab({
  categories, roster, config, onConfigChange, onApplyTemplate,
}: {
  categories: import("@/hooks/use-categories").Category[]
  roster: { id: string; name: string }[]
  config: BoletimConfig
  onConfigChange: (c: BoletimConfig) => void
  onApplyTemplate: (t: SchoolTemplate) => void
}) {
  const [showConfig, setShowConfig] = useState(false)
  const [sortBy, setSortBy] = useState<"name" | "final" | "sit">("name")
  const [showTemplates, setShowTemplates] = useState(false)

  const situations = useMemo(
    () => computeStudentSituations(categories, roster, config),
    [categories, roster, config]
  )

  const sorted = useMemo(() => [...situations].sort((a, b) => {
    if (sortBy === "final") return (b.finalAverage ?? -1) - (a.finalAverage ?? -1)
    if (sortBy === "sit") {
      const order = { reprovado: 0, recuperacao: 1, aprovado: 2, pendente: 3 }
      return order[a.situation] - order[b.situation]
    }
    return a.name.localeCompare(b.name, "pt-BR")
  }), [situations, sortBy])

  const stats = useMemo(() => {
    const all = situations.filter(s => s.finalAverage !== null)
    if (!all.length) return null
    const avgs = all.map(s => s.finalAverage!)
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length
    return {
      total: roster.length,
      aprovado:    situations.filter(s => s.situation === "aprovado").length,
      recuperacao: situations.filter(s => s.situation === "recuperacao").length,
      reprovado:   situations.filter(s => s.situation === "reprovado").length,
      pendente:    situations.filter(s => s.situation === "pendente").length,
      mean: rnd(mean),
      max: rnd(Math.max(...avgs)),
      min: rnd(Math.min(...avgs)),
    }
  }, [situations, roster])

  const updateRule = (patch: Partial<SituationRule>) =>
    onConfigChange({ ...config, rule: { ...config.rule, ...patch } })

  const updatePeriod = (id: string, patch: Partial<PeriodGroup>) =>
    onConfigChange({ ...config, periods: config.periods.map(p => p.id === id ? { ...p, ...patch } : p) })

  const togglePeriodCat = (periodId: string, catId: string) =>
    onConfigChange({
      ...config,
      periods: config.periods.map(p => {
        if (p.id !== periodId) return p
        const has = p.categoryIds.includes(catId)
        return { ...p, categoryIds: has ? p.categoryIds.filter(c => c !== catId) : [...p.categoryIds, catId] }
      }),
    })

  const addPeriod = () => {
    const n = config.periods.length + 1
    const newId = Math.random().toString(36).slice(2, 7)
    onConfigChange({ ...config, periods: [...config.periods, { id: newId, label: `B${n}`, categoryIds: [], weight: 1 }] })
  }

  const removePeriod = (id: string) =>
    onConfigChange({ ...config, periods: config.periods.filter(p => p.id !== id) })

  const hasData = roster.length > 0 && config.periods.some(p => p.categoryIds.length > 0)

  if (!hasData && categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6 px-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner">
          <GraduationCap size={34} className="text-primary/60" />
        </div>
        <div>
          <p className="text-base font-bold tracking-tight">Diário de classe digital</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
            Comece com um template pronto ou crie suas categorias manualmente.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
          {SCHOOL_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => onApplyTemplate(t)}
              className="flex flex-col items-start gap-1.5 p-4 rounded-2xl border border-border/60 bg-muted/10 hover:bg-primary/[0.04] hover:border-primary/25 transition-all text-left group">
              <span className="text-xl">{t.icon}</span>
              <p className="text-sm font-bold group-hover:text-primary transition-colors">{t.label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {categories.length > 0 && !config.periods.some(p => p.categoryIds.length > 0) && (
        <div className="shrink-0 mx-6 mt-4 p-3 rounded-xl border border-primary/20 bg-primary/[0.04] flex items-center gap-3">
          <Sparkles size={14} className="text-primary shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">Configure os períodos para ver a situação dos alunos, ou use um template.</p>
          <button onClick={() => setShowConfig(true)}
            className="text-xs font-bold text-primary hover:underline shrink-0">Configurar</button>
        </div>
      )}

      {stats && (
        <div className="shrink-0 grid grid-cols-4 gap-0 border-b border-t border-border mt-4 mx-6 rounded-2xl overflow-hidden">
          {[
            { label: "Aprovados",   value: stats.aprovado,    pct: rnd((stats.aprovado / Math.max(stats.total, 1)) * 100, 0), color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50/70 dark:bg-emerald-950/20" },
            { label: "Recuperação", value: stats.recuperacao, pct: rnd((stats.recuperacao / Math.max(stats.total, 1)) * 100, 0), color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50/70 dark:bg-amber-950/20" },
            { label: "Reprovados",  value: stats.reprovado,   pct: rnd((stats.reprovado / Math.max(stats.total, 1)) * 100, 0), color: "text-red-600 dark:text-red-400",         bg: "bg-red-50/70 dark:bg-red-950/20" },
            { label: "Média final", value: stats.mean,        pct: null,                                                       color: "text-primary",                          bg: "bg-primary/[0.04]" },
          ].map(({ label, value, pct, color, bg }) => (
            <div key={label} className={`flex flex-col items-center py-3.5 px-2 border-r last:border-r-0 border-border/50 ${bg}`}>
              <span className={`text-xl font-bold font-mono tabular-nums ${color}`}>{value}</span>
              {pct !== null && <span className="text-[9px] text-muted-foreground font-medium">{pct}%</span>}
              <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="shrink-0 flex items-center gap-2 px-6 py-2.5 border-b border-border">
        <div className="flex items-center gap-3 flex-1 text-xs">
          <span className="text-muted-foreground">Aprovação: <strong className="text-emerald-600">≥ {config.rule.passThreshold}</strong></span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">Recuperação: <strong className="text-amber-600">≥ {config.rule.recoveryThreshold}</strong></span>
          {config.rule.attendanceCategoryId && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground">Presença mín: <strong className="text-blue-600">{config.rule.attendanceMin}%</strong></span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name" className="text-xs">Nome A→Z</SelectItem>
              <SelectItem value="final" className="text-xs">Média ↓</SelectItem>
              <SelectItem value="sit" className="text-xs">Situação</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => setShowConfig(v => !v)}
            className={`h-7 px-2.5 rounded-lg border text-xs font-semibold transition-all ${showConfig ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            Configurar
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="shrink-0 border-b border-border bg-muted/5 px-6 py-4 flex flex-col gap-5 max-h-[50vh] overflow-y-auto">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">Templates rápidos</p>
              <button onClick={() => setShowTemplates(v => !v)} className="text-[10px] text-primary hover:underline font-semibold">
                {showTemplates ? "Ocultar" : "Ver templates"}
              </button>
            </div>
            {showTemplates && (
              <div className="grid grid-cols-4 gap-2">
                {SCHOOL_TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => { onApplyTemplate(t); setShowTemplates(false) }}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/[0.04] transition-all text-center">
                    <span className="text-lg">{t.icon}</span>
                    <p className="text-[10px] font-bold leading-tight">{t.label}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold">Regras de aprovação</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Nota aprovação:</span>
                <input type="number" value={config.rule.passThreshold} min={0} max={100} step={0.5}
                  onChange={e => updateRule({ passThreshold: parseFloat(e.target.value) || 6 })}
                  className="w-14 h-7 px-1.5 font-mono text-center rounded-lg border border-border bg-background outline-none focus:border-primary/50 text-xs" />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Nota recuperação:</span>
                <input type="number" value={config.rule.recoveryThreshold} min={0} max={100} step={0.5}
                  onChange={e => updateRule({ recoveryThreshold: parseFloat(e.target.value) || 5 })}
                  className="w-14 h-7 px-1.5 font-mono text-center rounded-lg border border-border bg-background outline-none focus:border-primary/50 text-xs" />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Presença mínima:</span>
                <input type="number" value={config.rule.attendanceMin} min={0} max={100} step={5}
                  onChange={e => updateRule({ attendanceMin: parseFloat(e.target.value) || 75 })}
                  className="w-14 h-7 px-1.5 font-mono text-center rounded-lg border border-border bg-background outline-none focus:border-primary/50 text-xs" />
                <span className="text-muted-foreground">%</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Categoria de presença:</span>
                <Select value={config.rule.attendanceCategoryId ?? "__none__"}
                  onValueChange={v => updateRule({ attendanceCategoryId: v === "__none__" ? null : v })}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">Nenhuma</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Média final:</span>
                <Select value={config.finalAverageMode}
                  onValueChange={v => onConfigChange({ ...config, finalAverageMode: v as any })}>
                  <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple" className="text-xs">Simples</SelectItem>
                    <SelectItem value="weighted" className="text-xs">Ponderada</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">Períodos / Bimestres</p>
              <button onClick={addPeriod} className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5">
                <Plus size={10} />Adicionar
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {config.periods.map(period => (
                <div key={period.id} className="border border-border/60 rounded-xl p-3 bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    <input value={period.label} onChange={e => updatePeriod(period.id, { label: e.target.value })}
                      className="text-xs font-bold w-16 h-6 px-2 rounded-lg border border-border bg-background outline-none focus:border-primary/50" />
                    <span className="text-[10px] text-muted-foreground">Peso:</span>
                    <input type="number" value={period.weight} min={0.1} max={10} step={0.5}
                      onChange={e => updatePeriod(period.id, { weight: parseFloat(e.target.value) || 1 })}
                      className="w-10 h-6 px-1 text-xs font-mono text-center rounded-lg border border-border bg-background outline-none" />
                    <span className="ml-auto text-[10px] text-muted-foreground">Categorias:</span>
                    <button onClick={() => removePeriod(period.id)} className="ml-1 text-muted-foreground/50 hover:text-destructive transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => {
                      const active = period.categoryIds.includes(cat.id)
                      return (
                        <button key={cat.id} onClick={() => togglePeriodCat(period.id, cat.id)}
                          className={`text-[10px] px-2 py-1 rounded-lg font-medium border transition-all ${active ? "border-transparent text-white shadow-sm" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
                          style={active ? { backgroundColor: cat.color } : {}}>
                          {cat.name}
                        </button>
                      )
                    })}
                    {categories.length === 0 && <span className="text-[10px] text-muted-foreground/40 italic">Crie categorias primeiro</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {roster.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
          <Users size={28} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Adicione alunos nas categorias para ver o boletim</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            <div
              className="grid gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider pb-2 border-b border-border mb-1"
              style={{ gridTemplateColumns: `minmax(120px,1fr) repeat(${config.periods.length},3.5rem) 4rem 6.5rem` }}>
              <div className="pl-2">Aluno</div>
              {config.periods.map(p => <div key={p.id} className="text-center">{p.label}</div>)}
              <div className="text-center">Média</div>
              <div className="text-center">Situação</div>
            </div>

            <div className="flex flex-col gap-0.5">
              {sorted.map(s => {
                const rowAccent = s.situation === "aprovado"    ? "border-l-emerald-400 dark:border-l-emerald-600"
                               : s.situation === "recuperacao"  ? "border-l-amber-400 dark:border-l-amber-500"
                               : s.situation === "reprovado"    ? "border-l-red-400 dark:border-l-red-500"
                               : "border-l-transparent"
                const rowHover = s.situation === "aprovado"    ? "hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
                              : s.situation === "recuperacao"  ? "hover:bg-amber-50/40 dark:hover:bg-amber-950/10"
                              : s.situation === "reprovado"    ? "hover:bg-red-50/40 dark:hover:bg-red-950/10"
                              : "hover:bg-muted/30"
                return (
                  <div key={s.itemId}
                    className={`grid gap-1 items-center py-2 px-2 rounded-xl transition-colors border-l-2 ${rowAccent} ${rowHover}`}
                    style={{ gridTemplateColumns: `minmax(120px,1fr) repeat(${config.periods.length},3.5rem) 4rem 6.5rem` }}>
                    <div className="flex items-center gap-2 min-w-0 pl-1">
                      <div className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0 uppercase">
                        {s.name[0]}
                      </div>
                      <span className="text-xs font-medium truncate">{s.name}</span>
                      {s.failedPeriods.length > 0 && (
                        <span title={`Abaixo da meta: ${s.failedPeriods.join(", ")}`}>
                          <AlertTriangle size={9} className="text-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>
                    {config.periods.map(p => (
                      <div key={p.id} className="text-center">
                        <ScorePill value={s.periodAverages[p.id]} pass={config.rule.passThreshold} recovery={config.rule.recoveryThreshold} />
                      </div>
                    ))}
                    <div className="text-center">
                      {s.finalAverage !== null ? (
                        <span className={`text-xs font-mono font-bold tabular-nums ${
                          s.finalAverage >= config.rule.passThreshold       ? "text-emerald-700 dark:text-emerald-400"
                          : s.finalAverage >= config.rule.recoveryThreshold ? "text-amber-600 dark:text-amber-400"
                          :                                                   "text-red-600 dark:text-red-400"}`}>
                          {rnd(s.finalAverage, 1)}
                        </span>
                      ) : <span className="text-muted-foreground/25 text-xs font-mono">—</span>}
                    </div>
                    <div className="flex justify-center">
                      <SituationBadge sit={s.situation} />
                    </div>
                  </div>
                )
              })}
            </div>

            {stats && roster.length >= 2 && (
              <div className="mt-5 pt-3 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{roster.length} alunos</span>
                <span>Média da turma: <strong className="font-mono text-primary">{stats.mean}</strong></span>
                <span>Maior: <strong className="font-mono text-emerald-600">{stats.max}</strong></span>
                <span>Menor: <strong className="font-mono text-red-600">{stats.min}</strong></span>
                {stats.total > 0 && <span>Taxa de aprovação: <strong>{Math.round((stats.aprovado / stats.total) * 100)}%</strong></span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type CategoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  roster?: { id: string; name: string }[]
  onAddCategory: (name: string) => void
  onRemoveCategory: (id: string) => void
  onSetOperation: (id: string, op: OperationType) => void
  onAddItem: (categoryId: string, name: string, raw: string) => void
  onRemoveItem: (categoryId: string, itemId: string) => void
  onUpdateItem: (categoryId: string, itemId: string, name: string, raw: string) => void
  onUpdateItemMeta: (categoryId: string, itemId: string, updates: Partial<Pick<CategoryItem, "absent" | "exempt">>) => void
  onSendToGrid: (category: Category) => void
  onAddComparison: (categoryId: string, label: string, refValue: number, operator: ComparisonOperator, scope: ComparisonScope, labelTrue: string, labelFalse: string, colorPass: string, colorFail: string) => void
  onUpdateComparison: (categoryId: string, compId: string, updates: Partial<ExternalComparison>) => void
  onRemoveComparison: (categoryId: string, compId: string) => void
  onToggleSubDivisions: (categoryId: string, enabled: boolean) => void
  onAddSubDivision: (categoryId: string, name: string) => void
  onRemoveSubDivision: (categoryId: string, sdId: string) => void
  onRenameSubDivision: (categoryId: string, sdId: string, name: string) => void
  onSetSubDivisionValue: (categoryId: string, sdId: string, itemId: string, value: number | string | null) => void
  onUpdateLogic: (categoryId: string, patch: Partial<CategoryLogic>) => void
  onUpdateGlobalLogic?: (patch: Partial<CategoryLogic>) => void
  onUpdateBands: (categoryId: string, bands: GradeBand[]) => void
  onApplyScalePreset: (categoryId: string, scaleType: ScaleType) => void
  onUpdateSubDivision?: (categoryId: string, sdId: string, updates: any) => void
  onOpenChart?: (categoryId?: string) => void
  boletimConfig: BoletimConfig
  onBoletimConfigChange: (c: BoletimConfig) => void
  onApplyTemplate: (t: SchoolTemplate) => void
}

// ─── Operations catalog ───────────────────────────────────────────────────────
const OPERATIONS: { value: OperationType; label: string; group: string; desc: string }[] = [
  { value: "MEDIA",           label: "Média",          group: "Básico",      desc: "Média aritmética dos valores" },
  { value: "MEDIA_PONDERADA", label: "Média ponderada",group: "Básico",      desc: "Cada coluna tem um peso configurável" },
  { value: "SOMA",            label: "Soma",           group: "Básico",      desc: "Soma de todos os valores" },
  { value: "MAX",             label: "Maior nota",     group: "Básico",      desc: "Maior valor entre os itens" },
  { value: "MIN",             label: "Menor nota",     group: "Básico",      desc: "Menor valor entre os itens" },
  { value: "MEDIANA",         label: "Mediana",        group: "Estatística", desc: "Valor central quando ordenados" },
  { value: "MODA",            label: "Moda",           group: "Estatística", desc: "Valor que aparece com mais frequência" },
  { value: "DESVIO_PADRAO",   label: "Desvio padrão",  group: "Estatística", desc: "Dispersão dos valores" },
  { value: "VARIANCIA",       label: "Variância",      group: "Estatística", desc: "Quadrado do desvio padrão" },
  { value: "AMPLITUDE",       label: "Amplitude",      group: "Estatística", desc: "Maior menos menor valor" },
  { value: "CONTAR",          label: "Contar itens",   group: "Contagem",    desc: "Quantos itens têm valor" },
  { value: "CONTAR_ACIMA",    label: "Acima da meta",  group: "Contagem",    desc: "Conta itens ≥ limiar configurável" },
  { value: "CONTAR_ABAIXO",   label: "Abaixo da meta", group: "Contagem",    desc: "Conta itens < limiar configurável" },
  { value: "PERCENTUAL",      label: "Soma %",         group: "Contagem",    desc: "Soma total como percentual de acertos" },
  { value: "FREQUENCIA",      label: "Frequência %",   group: "Presença",    desc: "% de aulas com presença marcada" },
  { value: "GABARITO",        label: "Gabarito",       group: "Educacional", desc: "Compara respostas com gabarito → % de acertos" },
  { value: "REGRA_DE_TRES",   label: "Regra de três",  group: "Educacional", desc: "Proporcional: (valor ÷ referência) × escala" },
]

const COMPARISON_OPS: { value: ComparisonOperator; label: string }[] = [
  { value: ">",  label: ">" }, { value: ">=", label: "≥" },
  { value: "<",  label: "<" }, { value: "<=", label: "≤" },
  { value: "==", label: "=" }, { value: "!=", label: "≠" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2): string {
  if (Number.isInteger(n)) return n.toLocaleString("pt-BR")
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

function Tip({ children, text, side = "top" }: {
  children: React.ReactNode; text: string; side?: "left" | "right" | "top" | "bottom"
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function LogicToggle({
  checked, onChecked, label, desc, icon: Icon, children, extra,
}: {
  checked: boolean
  onChecked: (v: boolean) => void
  label: string
  desc?: string
  icon?: React.ElementType
  children?: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-2 p-4 rounded-2xl border transition-all ${
      checked
        ? "border-primary/25 bg-primary/[0.04]"
        : "border-border/60 bg-muted/10 opacity-80"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              checked ? "bg-primary/15" : "bg-muted/50"
            }`}>
              <Icon size={13} className={checked ? "text-primary" : "text-muted-foreground/50"} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">{label}</p>
            {desc && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {extra}
          <Switch checked={checked} onCheckedChange={onChecked} />
        </div>
      </div>
      {checked && children && (
        <div className="mt-1 pt-3 border-t border-primary/10">
          {children}
        </div>
      )}
    </div>
  )
}

function NumInput({ label, value, onChange, min = 0, max = 100, step = 1, suffix = "" }: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; suffix?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground min-w-0 flex-1">{label}</label>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-20 h-8 px-2 text-sm font-mono text-right rounded-xl border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

function InlineText({ value, onCommit, className = "" }: {
  value: string; onCommit: (v: string) => void; className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => { const v = draft.trim(); if (v) onCommit(v); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }
  if (editing) return (
    <input value={draft} autoFocus onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel() }}
      onBlur={commit}
      className={`bg-transparent border-b-2 border-primary outline-none font-medium w-full min-w-0 ${className}`}
    />
  )
  return (
    <span
      className={`cursor-text select-none font-medium hover:text-primary transition-colors ${className}`}
      onDoubleClick={() => { setDraft(value); setEditing(true) }}
      title="Duplo clique para renomear"
    >{value}</span>
  )
}

// ─── LOGIC TAB ────────────────────────────────────────────────────────────────
function LogicTab({
  category, onUpdateLogic, onUpdateGlobalLogic, onUpdateBands, onApplyScalePreset,
}: {
  category: Category
  onUpdateLogic: (patch: Partial<CategoryLogic>) => void
  onUpdateGlobalLogic?: (patch: Partial<CategoryLogic>) => void
  onUpdateBands: (bands: GradeBand[]) => void
  onApplyScalePreset: (scaleType: ScaleType) => void
}) {
  const { logic } = category
  const [bandDraft, setBandDraft] = useState<GradeBand | null>(null)
  const [newBandLabel, setNewBandLabel] = useState("")
  const [newBandMin,   setNewBandMin]   = useState("")
  const [newBandColor, setNewBandColor] = useState("#2563eb")

  const addBand = () => {
    const label = newBandLabel.trim()
    const min   = parseFloat(newBandMin)
    if (!label || isNaN(min)) return
    onUpdateBands([...logic.bands, { id: generateId(), label, minScore: min, color: newBandColor }]
      .sort((a, b) => a.minScore - b.minScore))
    setNewBandLabel(""); setNewBandMin(""); setNewBandColor("#2563eb")
  }

  const removeBand = (id: string) => onUpdateBands(logic.bands.filter(b => b.id !== id))

  const updateBand = (id: string, updates: Partial<GradeBand>) =>
    onUpdateBands(logic.bands.map(b => b.id === id ? { ...b, ...updates } : b)
      .sort((a, b) => a.minScore - b.minScore))

  const roundLabels: Record<string, string> = {
    none: "Sem arredondamento", half: "Meia unidade (0.5)", integer: "Inteiro", up: "Sempre acima", down: "Sempre abaixo",
  }

  const activeCount = [
    logic.dropLowest, logic.dropHighest, logic.countAbsencesAsZero,
    logic.normalise, logic.useBands, logic.showRank, logic.showDelta,
    logic.showZScore, logic.applyRecovery, logic.allowExemption,
    logic.showProgress, logic.useCustomFormula,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col gap-6 p-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <BookOpen size={15} className="text-primary" />
          <p className="text-sm font-bold">Escala de notas</p>
          <span className="ml-auto text-xs text-muted-foreground">Atalho para configurar tudo de uma vez</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(SCALE_PRESETS) as ScaleType[]).map(scale => {
            const preset = SCALE_PRESETS[scale]
            const active = logic.scaleType === scale
            return (
              <button
                key={scale}
                onClick={() => onApplyScalePreset(scale)}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border text-center transition-all ${
                  active
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <span className="text-lg">
                  {scale === "decimal_10" ? "🔢" : scale === "decimal_100" ? "💯" : scale === "percent" ? "%" : scale === "letter" ? "🅰" : "✏️"}
                </span>
                <span className={`text-xs font-semibold ${active ? "text-primary" : ""}`}>{preset.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-primary" />
          <p className="text-sm font-bold">Processamento de notas</p>
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px] px-2 py-0.5 font-bold">{activeCount} ativos</Badge>
          )}
        </div>

        <LogicToggle
          checked={logic.dropLowest}
          onChecked={v => onUpdateLogic({ dropLowest: v })}
          label="Descartar menor(es) nota(s)"
          desc="Remove as N menores notas antes de calcular — útil para ignorar um dia ruim"
          icon={TrendingUp}
        >
          <NumInput label="Quantas notas descartar" value={logic.dropLowestN}
            onChange={v => onUpdateLogic({ dropLowestN: Math.max(1, v) })} min={1} max={10} />
        </LogicToggle>

        <LogicToggle
          checked={logic.dropHighest}
          onChecked={v => onUpdateLogic({ dropHighest: v })}
          label="Descartar maior(es) nota(s)"
          desc="Remove as N maiores — pode ser útil para análises de dispersão"
          icon={TrendingUp}
        >
          <NumInput label="Quantas notas descartar" value={logic.dropHighestN}
            onChange={v => onUpdateLogic({ dropHighestN: Math.max(1, v) })} min={1} max={10} />
        </LogicToggle>

        <LogicToggle
          checked={logic.countAbsencesAsZero}
          onChecked={v => onUpdateLogic({ countAbsencesAsZero: v })}
          label="Falta = zero"
          desc="Células vazias são tratadas como 0. Se desligado, células vazias são ignoradas"
          icon={UserCheck}
        />

        <LogicToggle
          checked={logic.allowExemption}
          onChecked={v => onUpdateLogic({ allowExemption: v })}
          label="Permitir isenção"
          desc="Itens marcados como 'isento' são excluídos do cálculo final"
          icon={Lock}
        />

        <LogicToggle
          checked={logic.applyRecovery}
          onChecked={v => onUpdateLogic({ applyRecovery: v })}
          label="Recuperação substitui nota"
          desc="Colunas marcadas como 'recuperação' substituem a nota original se for maior"
          icon={RotateCcw}
        />

        <div className="flex flex-col gap-2 p-4 rounded-2xl border border-border/60 bg-muted/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Teto de nota</p>
            {onUpdateGlobalLogic && logic.maxScore !== null && (
              <button
                onClick={() => onUpdateGlobalLogic({ maxScore: logic.maxScore })}
                className="text-[10px] font-semibold text-primary/70 hover:text-primary bg-primary/8 hover:bg-primary/15 px-2 py-0.5 rounded-lg transition-colors"
              >Aplicar a todas</button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Limita cada nota individual a um valor máximo</p>
          <div className="flex items-center gap-3 mt-1">
            <Switch
              checked={logic.maxScore !== null}
              onCheckedChange={v => onUpdateLogic({ maxScore: v ? 10 : null })}
            />
            {logic.maxScore !== null && (
              <NumInput label="Valor máximo por nota" value={logic.maxScore}
                onChange={v => onUpdateLogic({ maxScore: v })} min={0} max={1000} step={0.5} />
            )}
          </div>
        </div>

        {(category.operation === "CONTAR_ACIMA" || category.operation === "CONTAR_ABAIXO") && (
          <div className="p-4 rounded-2xl border border-primary/20 bg-primary/[0.03]">
            <NumInput label="Limiar para contagem" value={logic.thresholdValue}
              onChange={v => onUpdateLogic({ thresholdValue: v })} min={0} max={100} step={0.5} />
            <p className="text-xs text-muted-foreground mt-2">
              {category.operation === "CONTAR_ACIMA"
                ? `Conta itens com nota ≥ ${logic.thresholdValue}`
                : `Conta itens com nota < ${logic.thresholdValue}`}
            </p>
          </div>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Hash size={14} className="text-primary" />
          <p className="text-sm font-bold">Normalização e arredondamento</p>
        </div>

        <LogicToggle
          checked={logic.normalise}
          onChecked={v => onUpdateLogic({ normalise: v })}
          label="Normalizar resultado"
          desc="Converte o resultado para uma escala alvo (ex: notas em pontos → escala 0–10)"
          icon={Zap}
          extra={onUpdateGlobalLogic && logic.normalise ? (
            <button
              onClick={() => onUpdateGlobalLogic({ normalise: true, normaliseTarget: logic.normaliseTarget })}
              className="text-[10px] font-semibold text-primary/70 hover:text-primary bg-primary/8 hover:bg-primary/15 px-2 py-0.5 rounded-lg transition-colors"
            >Aplicar a todas</button>
          ) : undefined}
        >
          <NumInput label="Escala alvo" value={logic.normaliseTarget}
            onChange={v => onUpdateLogic({ normaliseTarget: v })} min={1} max={1000} step={1} />
        </LogicToggle>

        <div className="p-4 rounded-2xl border border-border/60 bg-muted/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Arredondamento</p>
            {onUpdateGlobalLogic && (
              <button
                onClick={() => onUpdateGlobalLogic({ roundMode: logic.roundMode, roundDecimals: logic.roundDecimals })}
                className="text-[10px] font-semibold text-primary/70 hover:text-primary bg-primary/8 hover:bg-primary/15 px-2 py-0.5 rounded-lg transition-colors"
              >Aplicar a todas</button>
            )}
          </div>
          <div className="flex gap-3">
            <Select value={logic.roundMode} onValueChange={v => onUpdateLogic({ roundMode: v as any })}>
              <SelectTrigger className="h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(roundLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-sm">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {logic.roundMode === "none" && (
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs text-muted-foreground">Casas:</label>
                <input
                  type="number" value={logic.roundDecimals} min={0} max={6}
                  onChange={e => onUpdateLogic({ roundDecimals: parseInt(e.target.value) || 0 })}
                  className="w-14 h-9 px-2 text-sm font-mono text-center rounded-xl border border-border bg-background outline-none focus:border-primary/50"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Award size={14} className="text-primary" />
          <p className="text-sm font-bold">Faixas de conceito</p>
        </div>

        <LogicToggle
          checked={logic.useBands}
          onChecked={v => onUpdateLogic({ useBands: v })}
          label="Exibir conceito junto à nota"
          desc="Mostra um rótulo colorido (Aprovado, B, etc.) ao lado do resultado numérico"
          icon={GraduationCap}
        >
          {logic.bands.length > 0 && (
            <div className="flex flex-col divide-y divide-border/40 rounded-xl overflow-hidden border border-border/50 mb-3">
              {[...logic.bands]
                .sort((a, b) => a.minScore - b.minScore)
                .map(band => (
                <div key={band.id} className="flex items-center gap-3 px-4 py-2.5 bg-background group">
                  <input type="color" value={band.color}
                    onChange={e => updateBand(band.id, { color: e.target.value })}
                    className="w-7 h-7 rounded-lg border border-border cursor-pointer shrink-0" />
                  <input
                    value={band.label} onChange={e => updateBand(band.id, { label: e.target.value })}
                    className="text-sm font-semibold bg-transparent outline-none flex-1 min-w-0"
                    style={{ color: band.color }}
                  />
                  <input
                    type="number" value={band.minScore} min={0} max={1000} step={0.5}
                    onChange={e => updateBand(band.id, { minScore: parseFloat(e.target.value) || 0 })}
                    className="w-16 h-7 px-2 text-xs font-mono text-right rounded-lg border border-border bg-muted/20 outline-none focus:border-primary/50 shrink-0"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">mín</span>
                  <button onClick={() => removeBand(band.id)}
                    className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="color" value={newBandColor} onChange={e => setNewBandColor(e.target.value)}
              className="w-8 h-9 rounded-xl border border-border cursor-pointer shrink-0" />
            <Input value={newBandLabel} onChange={e => setNewBandLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addBand() }}
              placeholder="Rótulo (ex: Aprovado)" className="h-9 text-sm flex-1" />
            <Input value={newBandMin} onChange={e => setNewBandMin(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addBand() }}
              type="number" placeholder="Mín" className="h-9 text-sm w-20 font-mono" />
            <Button size="sm" onClick={addBand}
              disabled={!newBandLabel.trim() || isNaN(parseFloat(newBandMin))}
              className="h-9 w-9 p-0 shrink-0">
              <Plus size={13} />
            </Button>
          </div>
        </LogicToggle>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-primary" />
          <p className="text-sm font-bold">Exibição estatística por aluno</p>
          <span className="text-xs text-muted-foreground ml-1">(aparece na lista de itens)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { key: "showRank",   label: "Ranking",     desc: "Posição na turma (1º, 2º…)",  icon: "🏆" },
            { key: "showDelta",  label: "Δ Média",      desc: "Diferença da média da turma", icon: "Δ" },
            { key: "showZScore", label: "Z-Score",      desc: "Desvios padrão da média",     icon: "σ" },
          ].map(({ key, label, desc, icon }) => {
            const on = !!(logic as any)[key]
            return (
              <button
                key={key}
                onClick={() => onUpdateLogic({ [key]: !on } as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                  on ? "border-primary/30 bg-primary/[0.05]" : "border-border/60 hover:border-primary/20"
                }`}
              >
                <span className="text-lg leading-none w-6 text-center shrink-0">{icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${on ? "text-primary" : ""}`}>{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <div className={`ml-auto w-4 h-4 rounded-full border-2 shrink-0 ${on ? "bg-primary border-primary" : "border-muted-foreground/30"}`} />
              </button>
            )
          })}
        </div>

        <LogicToggle
          checked={logic.showProgress}
          onChecked={v => onUpdateLogic({ showProgress: v })}
          label="Barra de progresso até meta"
          desc="Exibe uma barra visual do progresso em direção a uma nota-alvo"
          icon={TrendingUp}
        >
          <NumInput label="Nota-alvo" value={logic.targetScore ?? 10}
            onChange={v => onUpdateLogic({ targetScore: v })} min={0} max={1000} step={0.5} />
        </LogicToggle>
      </section>

      <Separator />

      {category.operation === "FREQUENCIA" && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <UserCheck size={14} className="text-primary" />
              <p className="text-sm font-bold">Frequência</p>
            </div>
            <div className="p-4 rounded-2xl border border-border/60 bg-muted/10">
              <NumInput label="Alerta de frequência abaixo de (%)" value={logic.attendanceWarningThreshold}
                onChange={v => onUpdateLogic({ attendanceWarningThreshold: v })} min={0} max={100} step={5} suffix="%" />
              <p className="text-xs text-muted-foreground mt-2">
                Itens com frequência abaixo deste valor exibem um ícone de aviso ⚠️
              </p>
            </div>
          </section>
          <Separator />
        </>
      )}

      {category.operation === "PERCENTUAL" && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-primary" />
              <p className="text-sm font-bold">Percentual</p>
            </div>
            <div className="p-4 rounded-2xl border border-border/60 bg-muted/10 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Calcula a <strong>porcentagem de aproveitamento</strong> de cada aluno em relação ao total possível.
              </p>
              <NumInput label="Nota máxima por coluna (total possível)" value={logic.maxScore ?? 100}
                onChange={v => onUpdateLogic({ maxScore: v })} min={1} max={10000} step={1} />
              <div className="p-3 rounded-xl bg-primary/[0.05] border border-primary/15 text-xs text-primary/80">
                💡 Dica: vá para a aba <strong>Comparar</strong> e adicione um critério como{" "}
                <code className="bg-primary/10 px-1.5 rounded font-mono">{"≥ 60"}</code> com rótulos
                "Aprovado" / "Reprovado" para classificar automaticamente.
              </div>
            </div>
          </section>
          <Separator />
        </>
      )}

      {category.operation === "REGRA_DE_TRES" && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Ruler size={14} className="text-primary" />
              <p className="text-sm font-bold">Regra de três</p>
            </div>
            <div className="p-4 rounded-2xl border border-border/60 bg-muted/10 flex flex-col gap-3">
              <NumInput label="Valor de referência (ex: total de questões)" value={logic.regraRef}
                onChange={v => onUpdateLogic({ regraRef: v })} min={0.01} max={100000} step={1} />
              <NumInput label="Escala alvo (ex: 10 pontos)" value={logic.regraTarget}
                onChange={v => onUpdateLogic({ regraTarget: v })} min={0.01} max={100000} step={0.5} />
              <div className="flex items-center gap-3 pt-1">
                <Switch checked={logic.regraInverse} onCheckedChange={v => onUpdateLogic({ regraInverse: v })} />
                <div>
                  <p className="text-sm font-semibold">Proporção inversa</p>
                  <p className="text-xs text-muted-foreground">
                    {logic.regraInverse
                      ? "Inversa: resultado = (ref × escala) ÷ valor"
                      : "Direta: resultado = (valor ÷ ref) × escala"}
                  </p>
                </div>
              </div>
              {category.items.length > 0 && (
                <div className="mt-1 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Prévia:</p>
                  {category.items.slice(0, 4).map(item => {
                    const result = logic.regraRef > 0
                      ? logic.regraInverse
                        ? (logic.regraRef * logic.regraTarget) / item.value
                        : (item.value / logic.regraRef) * logic.regraTarget
                      : null
                    return (
                      <div key={item.id} className="flex items-center gap-2 text-xs py-0.5">
                        <span className="text-muted-foreground flex-1 truncate">{item.name}</span>
                        <span className="font-mono text-muted-foreground/60">{item.value} →</span>
                        <span className="font-mono font-bold" style={{ color: category.color }}>
                          {result !== null && isFinite(result) ? result.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
          <Separator />
        </>
      )}

      {category.operation === "GABARITO" && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={14} className="text-primary" />
              <p className="text-sm font-bold">Gabarito</p>
            </div>
            <div className="p-4 rounded-2xl border border-border/60 bg-muted/10 flex flex-col gap-3">
              <NumInput label="Escala de resultado (ex: 10 → notas 0–10)" value={logic.gabaritoScale}
                onChange={v => onUpdateLogic({ gabaritoScale: v })} min={1} max={1000} step={1} />
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Modo de comparação</p>
                <div className="flex gap-2">
                  {(["exact", "contains"] as const).map(mode => (
                    <button key={mode}
                      onClick={() => onUpdateLogic({ gabaritoAnswerMode: mode })}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        logic.gabaritoAnswerMode === mode
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/20"
                      }`}>
                      {mode === "exact" ? "Exato (A = A)" : "Contém (AB aceita A)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <Separator />
        </>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-primary" />
          <p className="text-sm font-bold">Fórmula personalizada</p>
          <Badge variant="outline" className="text-[10px] px-2 font-semibold">Avançado</Badge>
        </div>

        <LogicToggle
          checked={logic.useCustomFormula}
          onChecked={v => onUpdateLogic({ useCustomFormula: v })}
          label="Usar fórmula própria"
          desc="Substitui o cálculo padrão. Use os nomes das colunas como variáveis (ex: P1, P2)"
          icon={FlaskConical}
        >
          <div className="flex flex-col gap-2">
            <Input
              value={logic.customFormula}
              onChange={e => onUpdateLogic({ customFormula: e.target.value })}
              placeholder="Ex: (P1 * 4 + P2 * 6) / 10"
              className="h-9 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis:{" "}
              {category.subDivisions.length > 0
                ? category.subDivisions.map(sd => (
                    <code key={sd.id} className="bg-muted px-1 py-0.5 rounded text-[11px] mr-1">
                      {sd.name.replace(/\s+/g, "")}
                    </code>
                  ))
                : <span className="italic">adicione colunas na aba Dados</span>}
            </p>
            {logic.customFormula.trim() && category.items.length > 0 && category.useSubDivisions && (
              <div className="mt-1 p-3 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Prévia para os primeiros alunos:</p>
                {category.items.slice(0, 3).map(item => {
                  const varMap: Record<string, number> = {}
                  category.subDivisions.forEach(sd => {
                    const key = sd.name.replace(/\s+/g, "")
                    varMap[key] = category.subDivisionValues[sd.id]?.[item.id] ?? 0
                  })
                  const res = evalCustomFormula(logic.customFormula, varMap)
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground flex-1 truncate">{item.name}</span>
                      <span className="font-mono font-bold" style={{ color: category.color }}>
                        {res !== null ? fmt(res) : "Erro"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </LogicToggle>
      </section>
    </div>
  )
}

// ─── SubDivisionGrid ──────────────────────────────────────────────────────────
function SubDivisionGrid({
  category, onSetValue, onRenameSubDivision, onRemoveSubDivision,
  onAddSubDivision, onAddItem, onRemoveItem, onUpdateItemName,
  onUpdateSubDivision,
}: {
  category: Category
  onSetValue: (sdId: string, itemId: string, value: number | null) => void
  onRenameSubDivision: (sdId: string, name: string) => void
  onRemoveSubDivision: (sdId: string) => void
  onAddSubDivision: (name: string) => void
  onAddItem: (name: string) => void
  onRemoveItem: (itemId: string) => void
  onUpdateItemName: (itemId: string, name: string) => void
  onUpdateSubDivision?: (sdId: string, updates: any) => void
  onOpenChart?: () => void
}) {
  const [newSdName,   setNewSdName]   = useState("")
  const [newItemName, setNewItemName] = useState("")
  const { items, subDivisions, subDivisionValues, operation, logic } = category
  const opInfo = OPERATIONS.find(o => o.value === operation)

  const getVal = (sdId: string, itemId: string) => subDivisionValues[sdId]?.[itemId]

  const handleCellChange = (sdId: string, itemId: string, raw: string) => {
    const v = raw.trim()
    if (v === "" || v === "-") { onSetValue(sdId, itemId, null); return }
    if (operation === "GABARITO") { onSetValue(sdId, itemId, v); return }
    const n = parseFloat(v)
    if (!isNaN(n)) onSetValue(sdId, itemId, n)
  }

  const computeColTotal = (sdId: string): number | null => {
    const numVals = items.map(item => getVal(sdId, item.id)).filter((v): v is number => typeof v === "number")
    if (!numVals.length) return null
    switch (operation) {
      case "SOMA":      return numVals.reduce((a, b) => a + b, 0)
      case "PERCENTUAL": {
        const sum = numVals.reduce((a, b) => a + b, 0)
        const max = logic.maxScore ?? 100
        return (sum / (numVals.length * max)) * 100
      }
      case "MEDIA":     return numVals.reduce((a, b) => a + b, 0) / numVals.length
      case "CONTAR":    return numVals.length
      case "MAX":       return Math.max(...numVals)
      case "MIN":       return Math.min(...numVals)
      default:          return numVals.reduce((a, b) => a + b, 0)
    }
  }

  // ── CORREÇÃO DE SCROLL: sticky só funciona com position sticky no th/td ──
  // Não usamos classes "sticky" do Tailwind aqui pois o container tem overflow:auto
  // Em vez disso aplicamos position:sticky diretamente via style inline
  const hasData = subDivisions.length > 0 || items.length > 0
  const scores  = computeItemScores(category)

  const colW  = category.operation === "GABARITO" ? 100 : 120
  const nameW = 180
  const resW  = 110

  return (
    <div className="flex flex-col gap-3">

      {/* Add column bar */}
      <div className="flex gap-2">
        <Input placeholder="Nova coluna — ex: Janeiro, Prova 1, Turma A…" value={newSdName}
          onChange={e => setNewSdName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && newSdName.trim()) { onAddSubDivision(newSdName.trim()); setNewSdName("") } }}
          className="h-9 text-sm" />
        <Button onClick={() => { if (newSdName.trim()) { onAddSubDivision(newSdName.trim()); setNewSdName("") } }}
          disabled={!newSdName.trim()} size="sm" className="h-9 gap-1.5 px-4 shrink-0">
          <Plus size={13} />Coluna
        </Button>
      </div>

      {!hasData && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 rounded-2xl border-2 border-dashed border-border">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
            <Columns size={22} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sem colunas nem itens</p>
          <p className="text-xs text-muted-foreground">Colunas = meses ou provas · Itens = alunos</p>
        </div>
      )}

      {hasData && (() => {
        const minW = Math.max(520, nameW + subDivisions.length * colW + resW + 40)
        return (
          // ── CORREÇÃO PRINCIPAL: overflow:auto + position:relative ──
          // Remover width:100% da <table> para ela crescer além do container
          <div
            className="rounded-2xl border border-border"
            style={{
              overflow: "auto",
              maxHeight: 500,
              WebkitOverflowScrolling: "touch",
              position: "relative",
            }}
          >
            <table
              className="text-sm"
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
                tableLayout: "fixed",
                minWidth: minW,
                // NÃO colocar width:"100%" aqui — impede o scroll horizontal
              }}
            >
              <thead>
                <tr>
                  {/* Coluna nome — sticky left */}
                  <th
                    style={{
                      width: nameW,
                      minWidth: nameW,
                      position: "sticky",
                      top: 0,
                      left: 0,
                      zIndex: 31,
                      backgroundColor: "hsl(var(--card))",
                    }}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-b border-r border-border"
                  >
                    Aluno / Item
                  </th>

                  {/* Colunas de subdivisão */}
                  {subDivisions.map(sd => (
                    <th
                      key={sd.id}
                      style={{
                        minWidth: colW,
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
                        backgroundColor: "hsl(var(--card))",
                      }}
                      className="px-3 py-3 border-b border-r border-border"
                    >
                      <div className="flex flex-col gap-1 group/th">
                        <div className="flex items-center gap-1.5">
                          {sd.isRecovery && <Tip text="Coluna de recuperação"><RotateCcw size={10} className="text-orange-500 shrink-0" /></Tip>}
                          {sd.isBonus    && <Tip text="Ponto extra (bônus)"><Award size={10} className="text-yellow-500 shrink-0" /></Tip>}
                          {sd.isAbsenceCol && <Tip text="Coluna de presença"><UserCheck size={10} className="text-blue-500 shrink-0" /></Tip>}
                          <InlineText value={sd.name} onCommit={n => onRenameSubDivision(sd.id, n)}
                            className="text-xs font-bold text-foreground uppercase tracking-wide flex-1 truncate" />
                          <button onClick={() => onRemoveSubDivision(sd.id)}
                            className="w-5 h-5 rounded-lg flex items-center justify-center opacity-0 group-hover/th:opacity-100 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0">
                            <X size={10} />
                          </button>
                        </div>
                        {onUpdateSubDivision && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(["isBonus", "isRecovery", "isAbsenceCol"] as const).map(prop => (
                              <button key={prop}
                                onClick={() => onUpdateSubDivision(sd.id, { [prop]: !sd[prop] })}
                                className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold transition-colors ${
                                  sd[prop] ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/50 hover:text-muted-foreground"
                                }`}>
                                {prop === "isBonus" ? "+Bônus" : prop === "isRecovery" ? "↩Recup" : "✓Pres"}
                              </button>
                            ))}
                            {operation === "MEDIA_PONDERADA" && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground">Peso:</span>
                                <input type="number" value={sd.weight ?? 1} min={0} max={100} step={0.5}
                                  onChange={e => onUpdateSubDivision(sd.id, { weight: parseFloat(e.target.value) || 1 })}
                                  className="w-10 h-4 px-1 text-[10px] font-mono rounded border border-border bg-background outline-none" />
                              </div>
                            )}
                          </div>
                        )}
                        {operation === "GABARITO" && (
                          <input
                            value={sd.correctAnswer ?? ""}
                            onChange={e => onUpdateSubDivision && onUpdateSubDivision(sd.id, { correctAnswer: e.target.value })}
                            placeholder="Gabarito"
                            className="mt-1 w-full h-6 px-1.5 text-[10px] font-mono rounded-lg border border-primary/30 bg-primary/[0.04] outline-none focus:border-primary/60 text-primary font-semibold uppercase"
                          />
                        )}
                      </div>
                    </th>
                  ))}

                  {/* Coluna resultado — sticky right */}
                  {subDivisions.length > 0 && (
                    <th
                      style={{
                        width: resW,
                        minWidth: resW,
                        position: "sticky",
                        top: 0,
                        right: 0,
                        zIndex: 31,
                        backgroundColor: "hsl(var(--card))",
                      }}
                      className="px-3 py-3 text-right border-b border-l border-border"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: category.color }}>
                        {opInfo?.label ?? operation}
                      </span>
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {items.map((item, idx) => {
                  const rowResult = subDivisions.length > 0 ? computeItemSubDivResult(item, category) : null
                  const rowBg     = idx % 2 === 1 ? "hsl(var(--muted)/0.12)" : "hsl(var(--background))"
                  const band      = logic.useBands && rowResult !== null ? getBand(rowResult, logic.bands) : null
                  const isAbsent  = !!item.absent
                  const isExempt  = !!item.exempt && logic.allowExemption
                  const score     = scores.get(item.id)
                  const isWarning = operation === "FREQUENCIA" && score !== undefined && score < logic.attendanceWarningThreshold

                  return (
                    <tr key={item.id} className="group/row">
                      {/* Nome — sticky left */}
                      <td
                        style={{
                          width: nameW,
                          minWidth: nameW,
                          maxWidth: nameW,
                          position: "sticky",
                          left: 0,
                          zIndex: 10,
                          backgroundColor: idx % 2 === 1 ? "hsl(var(--card))" : "hsl(var(--background))",
                        }}
                        className="px-3 py-2 border-b border-r border-border/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground/40 w-4 tabular-nums shrink-0 text-right">{idx + 1}</span>
                          <InlineText value={item.name} onCommit={n => onUpdateItemName(item.id, n)}
                            className={`text-sm flex-1 min-w-0 truncate ${isAbsent ? "line-through opacity-50" : ""} ${isExempt ? "italic opacity-60" : ""}`} />
                          <div className="flex items-center gap-1 ml-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                            {logic.allowExemption && (
                              <Tip text={isExempt ? "Remover isenção" : "Marcar como isento"}>
                                <button onClick={() => {}}
                                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${isExempt ? "bg-purple-100 text-purple-600" : "bg-muted text-muted-foreground/50"}`}>
                                  isen
                                </button>
                              </Tip>
                            )}
                            <button onClick={() => onRemoveItem(item.id)}
                              className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                              <X size={10} />
                            </button>
                          </div>
                          {isWarning && <AlertTriangle size={12} className="text-orange-500 shrink-0" />}
                          {isExempt  && <span className="text-[10px] text-purple-500 font-semibold shrink-0">ISENTO</span>}
                        </div>
                      </td>

                      {/* Células de valor */}
                      {subDivisions.map(sd => {
                        const existing = getVal(sd.id, item.id)
                        const isPresence = operation === "FREQUENCIA" || sd.isAbsenceCol
                        return (
                          <td key={sd.id} className="px-1.5 py-1 border-b border-r border-border/40 last:border-r-0" style={{ minWidth: 90 }}>
                            {isPresence ? (
                              <button
                                onClick={() => onSetValue(sd.id, item.id, existing && existing > 0 ? 0 : 1)}
                                className={`w-full h-8 rounded-xl text-xs font-bold transition-all ${
                                  existing && existing > 0
                                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                                    : "bg-muted/40 text-muted-foreground/50 border border-border/40 hover:bg-muted/60"
                                }`}
                              >
                                {existing && existing > 0 ? "✓" : "—"}
                              </button>
                            ) : operation === "GABARITO" ? (
                              <input
                                defaultValue={existing !== undefined ? String(existing) : ""}
                                placeholder="—"
                                onBlur={e => handleCellChange(sd.id, item.id, e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" || e.key === "Tab") (e.target as HTMLInputElement).blur() }}
                                className="w-full h-8 px-2 text-xs font-mono uppercase rounded-xl border border-transparent bg-transparent focus:border-primary/40 focus:bg-primary/[0.03] outline-none text-center placeholder:text-muted-foreground/25 transition-all hover:bg-muted/30"
                              />
                            ) : (
                              <input type="number" step="any"
                                defaultValue={existing !== undefined && typeof existing === "number" ? existing : ""}
                                placeholder="—"
                                onBlur={e => handleCellChange(sd.id, item.id, e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" || e.key === "Tab") (e.target as HTMLInputElement).blur() }}
                                className="w-full h-8 px-3 text-sm font-mono rounded-xl border border-transparent bg-transparent focus:border-primary/40 focus:bg-primary/[0.03] outline-none text-right placeholder:text-muted-foreground/25 transition-all hover:bg-muted/30"
                              />
                            )}
                          </td>
                        )
                      })}

                      {/* Resultado — sticky right */}
                      {subDivisions.length > 0 && (
                        <td
                          style={{
                            width: resW,
                            minWidth: resW,
                            position: "sticky",
                            right: 0,
                            zIndex: 10,
                            backgroundColor: idx % 2 === 1 ? "hsl(var(--card))" : "hsl(var(--background))",
                          }}
                          className="px-3 py-2 text-right border-b border-l border-border/60"
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            {rowResult !== null ? (
                              <>
                                <span className="text-sm font-bold tabular-nums" style={{ color: band?.color ?? category.color }}>
                                  {fmt(rowResult)}
                                </span>
                                {band && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                                    style={{ backgroundColor: band.color + "20", color: band.color }}>
                                    {band.emoji ? `${band.emoji} ` : ""}{band.label}
                                  </span>
                                )}
                                {logic.showProgress && logic.targetScore !== null && (
                                  <div className="w-16 h-1.5 bg-muted/40 rounded-full overflow-hidden mt-0.5">
                                    <div className="h-full rounded-full transition-all" style={{
                                      width: String(Math.min(100, (rowResult / logic.targetScore) * 100)) + "%",
                                      backgroundColor: band?.color ?? category.color,
                                    }} />
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground/25 text-sm">—</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}

                {/* Linha de totais por coluna */}
                {subDivisions.length > 0 && items.length > 0 && (
                  <tr>
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 10,
                        backgroundColor: "hsl(var(--muted))",
                      }}
                      className="px-4 py-3 border-t-2 border-r border-border font-semibold"
                    >
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{opInfo?.label ?? operation}</span>
                    </td>
                    {subDivisions.map(sd => {
                      const total = computeColTotal(sd.id)
                      return (
                        <td key={sd.id} className="px-4 py-3.5 text-right border-t-2 border-r border-border/70 last:border-r-0 bg-muted/20">
                          {total !== null
                            ? <span className="text-sm font-bold tabular-nums" style={{ color: category.color }}>{fmt(total)}</span>
                            : <span className="text-muted-foreground/25 text-sm">—</span>}
                        </td>
                      )
                    })}
                    <td
                      style={{
                        position: "sticky",
                        right: 0,
                        zIndex: 10,
                        backgroundColor: "hsl(var(--muted))",
                      }}
                      className="px-4 py-3 text-right border-t-2 border-l border-border"
                    >
                      {(() => {
                        const r = computeCategoryResult(category)
                        return r !== null
                          ? <span className="text-base font-black tabular-nums" style={{ color: category.color }}>{fmt(r)}</span>
                          : <span className="text-muted-foreground/25">—</span>
                      })()}
                    </td>
                  </tr>
                )}

                {/* Linha de estatísticas da turma */}
                {items.length >= 3 && subDivisions.length > 0 && (() => {
                  const stats = computeClassStats(scores)
                  if (stats.mean === null) return null
                  return (
                    <tr className="border-t border-dashed border-border/50">
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 10,
                          backgroundColor: "hsl(var(--card))",
                        }}
                        className="px-4 py-2 border-r border-border/40"
                      >
                        <span className="text-[11px] text-muted-foreground/70 font-medium">Estatísticas da turma</span>
                      </td>
                      <td colSpan={subDivisions.length} className="px-4 py-2 bg-muted/10" />
                      <td
                        style={{
                          position: "sticky",
                          right: 0,
                          zIndex: 10,
                          backgroundColor: "hsl(var(--card))",
                        }}
                        className="px-4 py-2 border-l border-border/40"
                      >
                        <div className="text-[10px] text-muted-foreground text-right space-y-0.5">
                          <div>Média: <span className="font-mono font-semibold">{fmt(stats.mean)}</span></div>
                          {stats.median !== null && <div>Mediana: <span className="font-mono font-semibold">{fmt(stats.median)}</span></div>}
                          {stats.stddev !== null && <div>DP: <span className="font-mono font-semibold">{fmt(stats.stddev)}</span></div>}
                        </div>
                      </td>
                    </tr>
                  )
                })()}

                {/* Linha para adicionar item */}
                <tr>
                  <td colSpan={subDivisions.length + 2} className="px-3 py-2.5 border-t border-dashed border-border/50" style={{ minWidth: 280 }}>
                    <div className="flex gap-2">
                      <Input placeholder="Novo aluno — Enter para adicionar" value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && newItemName.trim()) { onAddItem(newItemName.trim()); setNewItemName("") } }}
                        className="h-8 text-sm border-dashed min-w-0 flex-1" />
                      <Button size="sm"
                        onClick={() => { if (newItemName.trim()) { onAddItem(newItemName.trim()); setNewItemName("") } }}
                        disabled={!newItemName.trim()} className="h-8 w-8 p-0 shrink-0">
                        <Plus size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })()}

      {hasData && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 flex-wrap">
          <span>💡 Duplo clique num nome para renomear · Tab avança entre células</span>
          {subDivisions.length > 4 && <span className="ml-auto font-medium">← role para ver mais →</span>}
        </div>
      )}

      {/* GABARITO: resumo dinâmico */}
      {operation === "GABARITO" && items.length > 0 && subDivisions.length > 0 && (() => {
        const keyedSds = subDivisions.filter(sd => sd.correctAnswer && sd.correctAnswer.trim() !== "")
        if (keyedSds.length === 0) return (
          <div className="p-4 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] text-center">
            <ClipboardCheck size={20} className="text-primary/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-primary/70">Defina o gabarito</p>
            <p className="text-xs text-muted-foreground mt-1">
              Preencha a resposta correta no campo <strong>Gabarito</strong> no cabeçalho de cada coluna acima.
            </p>
          </div>
        )

        const qAccuracy = keyedSds.map(sd => {
          let correct = 0
          items.forEach(item => {
            const ans = String(subDivisionValues[sd.id]?.[item.id] ?? "").trim().toUpperCase()
            const key = sd.correctAnswer!.trim().toUpperCase()
            const match = logic.gabaritoAnswerMode === "exact" ? ans === key : (ans.includes(key) || key.includes(ans))
            if (ans && key && match) correct++
          })
          return { sd, correct, pct: items.length > 0 ? (correct / items.length) * 100 : 0 }
        })

        const studentScores = items.map(item => {
          let correct = 0
          keyedSds.forEach(sd => {
            const ans = String(subDivisionValues[sd.id]?.[item.id] ?? "").trim().toUpperCase()
            const key = sd.correctAnswer!.trim().toUpperCase()
            const match = logic.gabaritoAnswerMode === "exact" ? ans === key : (ans.includes(key) || key.includes(ans))
            if (ans && key && match) correct++
          })
          const nota = (correct / keyedSds.length) * logic.gabaritoScale
          return { item, correct, total: keyedSds.length, nota }
        }).sort((a, b) => b.nota - a.nota)

        const classMean = studentScores.reduce((s, x) => s + x.nota, 0) / studentScores.length
        const above = studentScores.filter(x => x.nota >= logic.gabaritoScale * 0.6).length

        return (
          <div className="flex flex-col gap-4 p-4 rounded-2xl border border-primary/20 bg-primary/[0.03]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardCheck size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Resultado do Gabarito</p>
                <p className="text-xs text-muted-foreground">
                  {keyedSds.length} questão(ões) · escala 0–{logic.gabaritoScale} ·{" "}
                  {above}/{items.length} alunos ≥ {(logic.gabaritoScale * 0.6).toFixed(1)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black tabular-nums" style={{ color: "hsl(var(--primary))" }}>
                  {classMean.toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground">média da turma</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Taxa de acerto por questão</p>
              <div className="flex flex-col gap-1.5">
                {qAccuracy.map(({ sd, correct, pct }) => (
                  <div key={sd.id} className="flex items-center gap-3">
                    <span className="text-xs font-semibold w-24 truncate shrink-0">{sd.name}</span>
                    <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden relative">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: String(pct) + "%", backgroundColor: pct >= 60 ? "hsl(var(--primary))" : pct >= 40 ? "#f59e0b" : "#ef4444" }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white mix-blend-multiply">
                        {correct}/{items.length}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold w-10 text-right shrink-0"
                      style={{ color: pct >= 60 ? "hsl(var(--primary))" : pct >= 40 ? "#f59e0b" : "#ef4444" }}>
                      {pct.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 w-5 font-mono text-center bg-muted/50 rounded px-1">
                      {sd.correctAnswer}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Ranking de alunos</p>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {studentScores.map((s, rank) => {
                  const pct = (s.correct / s.total) * 100
                  const color = pct >= 60 ? "hsl(var(--primary))" : pct >= 40 ? "#f59e0b" : "#ef4444"
                  return (
                    <div key={s.item.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${rank % 2 === 0 ? "bg-muted/20" : ""}`}>
                      <span className="text-xs font-mono text-muted-foreground/50 w-4 text-right shrink-0">{rank + 1}</span>
                      <span className="text-sm font-medium flex-1 min-w-0 truncate">{s.item.name}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {keyedSds.map(sd => {
                          const ans = String(subDivisionValues[sd.id]?.[s.item.id] ?? "").trim().toUpperCase()
                          const key = sd.correctAnswer!.trim().toUpperCase()
                          const match = logic.gabaritoAnswerMode === "exact" ? ans === key : (ans.includes(key) || key.includes(ans))
                          const hasAns = ans !== ""
                          return (
                            <span key={sd.id} title={`${sd.name}: você=${ans || "—"} gabarito=${key}`}
                              className="w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center"
                              style={{
                                backgroundColor: !hasAns ? "hsl(var(--muted)/0.5)" : match ? "hsl(var(--primary)/0.15)" : "#fecaca",
                                color: !hasAns ? "hsl(var(--muted-foreground)/0.4)" : match ? "hsl(var(--primary))" : "#ef4444",
                              }}>
                              {!hasAns ? "·" : match ? "✓" : "✗"}
                            </span>
                          )
                        })}
                      </div>
                      <span className="text-xs text-muted-foreground/60 shrink-0 w-8 text-right font-mono">{s.correct}/{s.total}</span>
                      <span className="text-sm font-black tabular-nums shrink-0 w-10 text-right" style={{ color }}>{s.nota.toFixed(1)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* REGRA DE TRÊS: prévia */}
      {operation === "REGRA_DE_TRES" && items.length > 0 && (() => {
        const { regraRef, regraTarget, regraInverse, roundDecimals } = logic
        const convert = (v: number) => {
          if (!regraRef) return null
          const r = regraInverse ? (regraRef * regraTarget) / v : (v / regraRef) * regraTarget
          return isFinite(r) ? r : null
        }
        const results = items.map(item => ({ item, result: convert(item.value) }))
        const valid = results.filter(r => r.result !== null)
        const mean = valid.length ? valid.reduce((s, r) => s + r.result!, 0) / valid.length : null
        return (
          <div className="flex flex-col gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/[0.03]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Ruler size={15} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Prévia — Regra de Três</p>
                <p className="text-xs text-muted-foreground">
                  {regraInverse ? "Inversa" : "Direta"}: valor ÷ {regraRef} × {regraTarget}
                  {mean !== null && <> · média da turma: <strong>{mean.toFixed(2)}</strong></>}
                </p>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
              {results.map(({ item, result }, i) => (
                <div key={item.id} className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                  <span className="flex-1 font-medium truncate">{item.name}</span>
                  <span className="font-mono text-muted-foreground">{item.value}</span>
                  <span className="text-muted-foreground/50">→</span>
                  <span className="font-mono font-bold" style={{ color: "hsl(var(--primary))" }}>
                    {result !== null ? result.toFixed(roundDecimals) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* FREQUÊNCIA: resumo */}
      {operation === "FREQUENCIA" && items.length > 0 && subDivisions.length > 0 && (() => {
        const presCols = subDivisions.filter(sd => sd.isAbsenceCol)
        const cols = presCols.length ? presCols : subDivisions
        const { attendanceWarningThreshold } = logic

        const studentFreqs = items.map(item => {
          const present = cols.filter(sd => Number(subDivisionValues[sd.id]?.[item.id] ?? 0) > 0).length
          return { item, present, total: cols.length, pct: cols.length > 0 ? (present / cols.length) * 100 : 0 }
        }).sort((a, b) => b.pct - a.pct)

        const atRisk = studentFreqs.filter(s => s.pct < attendanceWarningThreshold)

        return (
          <div className="flex flex-col gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/[0.03]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UserCheck size={15} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Resumo de Frequência</p>
                <p className="text-xs text-muted-foreground">
                  {cols.length} aulas · alerta abaixo de {attendanceWarningThreshold}%
                  {atRisk.length > 0 && <span className="ml-2 text-orange-500 font-semibold">⚠ {atRisk.length} em risco</span>}
                </p>
              </div>
            </div>
            <div className="max-h-44 overflow-y-auto flex flex-col gap-1">
              {studentFreqs.map(({ item, present, total, pct }, i) => (
                <div key={item.id} className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                  <span className="flex-1 font-medium truncate">{item.name}</span>
                  <div className="w-24 h-2 bg-muted/40 rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full" style={{
                      width: String(pct) + "%",
                      backgroundColor: pct >= attendanceWarningThreshold ? "hsl(var(--primary))" : "#f97316"
                    }} />
                  </div>
                  <span className="font-mono text-muted-foreground/60 w-10 text-right shrink-0">{present}/{total}</span>
                  <span className="font-mono font-bold w-10 text-right shrink-0"
                    style={{ color: pct >= attendanceWarningThreshold ? "hsl(var(--primary))" : "#f97316" }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────
function ItemRow({
  item, idx, operation, category, onRemove, onUpdate, onUpdateMeta,
}: {
  item: CategoryItem; idx: number; operation: OperationType
  category: Category; onRemove: () => void; onUpdate: (name: string, raw: string) => void
  onUpdateMeta?: (updates: Partial<Pick<CategoryItem, "absent" | "exempt">>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName,  setEditName]  = useState(item.name)
  const [editValue, setEditValue] = useState(item.rawValueInput ?? item.value.toString())
  const nameRef = useRef<HTMLInputElement>(null)

  const { logic } = category
  const scores    = computeItemScores(category)
  const ranks     = logic.showRank   ? computeRanks(category.items, category) : null
  const stats     = (logic.showDelta || logic.showZScore) ? computeClassStats(scores) : null

  const itemScore = scores.get(item.id) ?? item.value
  const band      = logic.useBands && itemScore !== null ? getBand(itemScore, logic.bands) : null
  const rank      = ranks?.get(item.id)
  const delta     = stats != null && stats.mean != null && itemScore != null ? itemScore - stats.mean : null
  const zScore    = stats != null && stats.mean != null && stats.stddev != null && stats.stddev > 0 && itemScore != null ? (itemScore - stats.mean) / stats.stddev : null

  const isAbsent = !!item.absent
  const isExempt = !!item.exempt && logic.allowExemption
  const isWarning = operation === "FREQUENCIA" && itemScore !== null && itemScore < logic.attendanceWarningThreshold

  const startEdit = () => {
    setEditName(item.name); setEditValue(item.rawValueInput ?? item.value.toString())
    setEditing(true); setTimeout(() => nameRef.current?.focus(), 20)
  }
  const commit = () => { const n = editName.trim(), r = editValue.trim(); if (n && r) onUpdate(n, r); setEditing(false) }
  const cancel = () => setEditing(false)

  if (editing) return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 bg-primary/[0.04] ring-1 ring-primary/20 ring-inset">
      <span className="text-xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
      <Input ref={nameRef} value={editName} onChange={e => setEditName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel() }}
        className="h-8 text-sm flex-1" placeholder="Nome" />
      <Input value={editValue} onChange={e => setEditValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel() }}
        className="h-8 text-sm w-32 font-mono" placeholder="Valor" />
      <button onClick={commit}
        className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0">
        <Check size={12} />
      </button>
      <button onClick={cancel}
        className="w-7 h-7 rounded-lg hover:bg-muted/80 flex items-center justify-center text-muted-foreground transition-colors shrink-0">
        <X size={12} />
      </button>
    </div>
  )

  return (
    <div
      className={`group flex items-center gap-2.5 px-5 py-2.5 cursor-default hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? "bg-muted/[0.12]" : ""} ${isAbsent ? "opacity-60" : ""}`}
      onDoubleClick={startEdit}
    >
      <span className="text-xs font-mono text-muted-foreground/35 w-5 text-right tabular-nums shrink-0">{idx + 1}</span>

      {rank && (
        <span className={`text-[10px] font-black w-5 text-center shrink-0 ${
          rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-amber-600" : "text-muted-foreground/30"
        }`}>
          {rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : `#${rank}`}
        </span>
      )}

      <span className={`flex-1 truncate text-sm font-medium ${isExempt ? "italic opacity-60" : ""} ${isAbsent ? "line-through" : ""}`}>
        {item.name}
        {isExempt && <span className="ml-1.5 text-[10px] text-purple-500 font-semibold not-italic">ISENTO</span>}
        {isWarning && <AlertTriangle size={11} className="inline ml-1.5 text-orange-500" />}
      </span>

      <div className="flex flex-col items-end shrink-0">
        <span className="font-mono font-semibold text-sm tabular-nums" style={{ color: band?.color ?? category.color }}>
          {itemScore !== null ? fmt(itemScore) : fmt(item.value)}
        </span>
        {band && <span className="text-[10px] font-semibold" style={{ color: band.color }}>{band.emoji} {band.label}</span>}
      </div>

      {(delta !== null || zScore !== null) && (
        <div className="flex items-center gap-1.5 shrink-0">
          {delta !== null && logic.showDelta && (
            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md ${
              delta >= 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"
            }`}>
              {delta >= 0 ? "+" : ""}{fmt(delta)}
            </span>
          )}
          {zScore !== null && logic.showZScore && (
            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md ${
              zScore >= 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"
            }`}>
              z{zScore >= 0 ? "+" : ""}{fmt(zScore, 1)}
            </span>
          )}
        </div>
      )}

      {logic.showProgress && logic.targetScore !== null && itemScore !== null && (
        <div className="w-16 h-1.5 bg-muted/40 rounded-full overflow-hidden shrink-0">
          <div className="h-full rounded-full transition-all" style={{
            width: String(Math.min(100, (itemScore / logic.targetScore) * 100)) + "%",
            backgroundColor: band?.color ?? category.color,
          }} />
        </div>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={startEdit}
          className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
          <Pencil size={11} />
        </button>
        {onUpdateMeta && logic.allowExemption && (
          <button onClick={() => onUpdateMeta({ exempt: !item.exempt })}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isExempt ? "bg-purple-100 text-purple-600" : "text-muted-foreground hover:bg-purple-50 hover:text-purple-500"}`}>
            <Lock size={10} />
          </button>
        )}
        {onUpdateMeta && (
          <button onClick={() => onUpdateMeta({ absent: !item.absent })}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isAbsent ? "bg-red-100 text-red-600" : "text-muted-foreground hover:bg-red-50 hover:text-red-500"}`}>
            <UserCheck size={10} />
          </button>
        )}
        <button onClick={onRemove}
          className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <X size={11} />
        </button>
      </div>
    </div>
  )
}

// ─── ComparisonForm ───────────────────────────────────────────────────────────
function ComparisonForm({ items, initial, onSave, onCancel }: {
  items: CategoryItem[]
  initial?: Partial<ExternalComparison>
  onSave: (d: Omit<ExternalComparison, "id" | "colorPass" | "colorFail">) => void
  onCancel: () => void
}) {
  const [label,      setLabel]      = useState(initial?.label ?? "")
  const [refValue,   setRefValue]   = useState(initial?.refValue?.toString() ?? "")
  const [operator,   setOperator]   = useState<ComparisonOperator>(initial?.operator ?? ">=")
  const [scope,      setScope]      = useState<ComparisonScope>(initial?.scope ?? "each")
  const [labelTrue,  setLabelTrue]  = useState(initial?.labelTrue ?? "Aprovado")
  const [labelFalse, setLabelFalse] = useState(initial?.labelFalse ?? "Reprovado")
  const canSave = label.trim() && !isNaN(parseFloat(refValue))

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-5 flex flex-col gap-4">
      <p className="text-sm font-semibold">{initial?.label ? "Editar comparação" : "Nova comparação"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome</label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Nota mínima" className="h-9 text-sm" autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Condição</label>
          <div className="flex gap-2">
            <Select value={operator} onValueChange={v => setOperator(v as ComparisonOperator)}>
              <SelectTrigger className="h-9 w-16 shrink-0 text-sm font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPARISON_OPS.map(op => <SelectItem key={op.value} value={op.value} className="text-sm font-mono">{op.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={refValue} onChange={e => setRefValue(e.target.value)} type="number" step="any"
              placeholder="Valor" className="h-9 text-sm font-mono flex-1" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aplicar a</label>
        <Select value={scope} onValueChange={v => setScope(v as ComparisonScope)}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="each" className="text-sm">Cada item</SelectItem>
            <SelectItem value="total" className="text-sm">Total da categoria</SelectItem>
            {items.length > 0 && <><Separator className="my-1" />{items.map(i =>
              <SelectItem key={i.id} value={`item:${i.id}`} className="text-sm">{i.name}</SelectItem>
            )}</>}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">✓ Verdadeiro</label>
          <Input value={labelTrue} onChange={e => setLabelTrue(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-red-500 uppercase tracking-wide">✗ Falso</label>
          <Input value={labelFalse} onChange={e => setLabelFalse(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-9 px-4">Cancelar</Button>
        <Button size="sm"
          onClick={() => onSave({ label: label.trim(), refValue: parseFloat(refValue), operator, scope, labelTrue, labelFalse })}
          disabled={!canSave} className="h-9 px-5">
          {initial?.label ? "Salvar" : "Adicionar"}
        </Button>
      </div>
    </div>
  )
}

function ComparisonBadge({ comp, category, onRemove, onUpdate }: {
  comp: ExternalComparison; category: Category
  onRemove: () => void; onUpdate: (u: Partial<ExternalComparison>) => void
}) {
  const [editing, setEditing] = useState(false)
  const catResult  = computeCategoryResult(category)
  const opSymbol   = COMPARISON_OPS.find(o => o.value === comp.operator)?.label ?? comp.operator
  const previewRows = comp.scope === "total"
    ? [{ name: "Total", result: catResult, applies: true }]
    : category.items.map(item => {
        const r = getComparisonTarget(comp, item, catResult, category.operation, category.logic)
        return { name: item.name, result: r, applies: r !== null }
      })
  const applicable  = previewRows.filter(r => r.applies)
  const passCount   = applicable.filter(r => r.result !== null && evaluateComparison(r.result!, comp)).length

  if (editing) return (
    <ComparisonForm items={category.items} initial={comp}
      onSave={d => { onUpdate(d); setEditing(false) }}
      onCancel={() => setEditing(false)} />
  )

  return (
    <div className="rounded-2xl border border-border overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
      onClick={() => setEditing(true)}>
      <div className="flex items-center gap-3 px-5 py-4 bg-muted/20">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Target size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{comp.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">resultado <span className="font-mono">{opSymbol}</span> {fmt(comp.refValue)}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xl font-black leading-none tabular-nums">
              <span className="text-blue-500">{passCount}</span>
              <span className="text-muted-foreground/30 text-base font-normal">/{applicable.length}</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">passaram</p>
          </div>
          <button onClick={e => { e.stopPropagation(); onRemove() }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>
      {applicable.length > 0 && (
        <div className="border-t border-border/50 divide-y divide-border/30">
          {applicable.slice(0, 5).map((row, i) => {
            const passed = row.result !== null ? evaluateComparison(row.result!, comp) : null
            const color  = passed === null ? "#94a3b8" : passed ? comp.colorPass : comp.colorFail
            return (
              <div key={i} className={`flex items-center gap-3 px-5 py-2.5 text-sm ${i % 2 === 1 ? "bg-muted/[0.12]" : ""}`}>
                <span className="flex-1 truncate text-muted-foreground">{row.name}</span>
                {row.result !== null && <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmt(row.result)}</span>}
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ color, backgroundColor: color + "20" }}>
                  {passed === null ? "—" : passed ? comp.labelTrue : comp.labelFalse}
                </span>
              </div>
            )
          })}
          {applicable.length > 5 && <div className="px-5 py-2 text-xs text-muted-foreground/60">+{applicable.length - 5} mais…</div>}
        </div>
      )}
      <div className="flex items-center gap-4 px-5 py-2.5 bg-muted/10 border-t border-border/40">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: comp.colorPass }} />{comp.labelTrue}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: comp.colorFail }} />{comp.labelFalse}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground/50 italic">clique para editar</span>
      </div>
    </div>
  )
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────
function CategoryCard({
  category, onRemove, onSetOperation, onAddItem, onRemoveItem, onUpdateItem, onUpdateItemMeta,
  onSendToGrid, onAddComparison, onUpdateComparison, onRemoveComparison,
  onToggleSubDivisions, onAddSubDivision, onRemoveSubDivision, onRenameSubDivision,
  onSetSubDivisionValue, onUpdateLogic, onUpdateGlobalLogic, onUpdateBands, onApplyScalePreset, onUpdateSubDivision,
}: {
  category: Category
  onRemove: () => void
  onSetOperation: (op: OperationType) => void
  onAddItem: (name: string, raw: string) => void
  onRemoveItem: (id: string) => void
  onUpdateItem: (id: string, name: string, raw: string) => void
  onUpdateItemMeta: (itemId: string, updates: Partial<Pick<CategoryItem, "absent" | "exempt">>) => void
  onSendToGrid: () => void
  onAddComparison: (label: string, refValue: number, operator: ComparisonOperator, scope: ComparisonScope, labelTrue: string, labelFalse: string, colorPass: string, colorFail: string) => void
  onUpdateComparison: (id: string, updates: Partial<ExternalComparison>) => void
  onRemoveComparison: (id: string) => void
  onToggleSubDivisions: (enabled: boolean) => void
  onAddSubDivision: (name: string) => void
  onRemoveSubDivision: (sdId: string) => void
  onRenameSubDivision: (sdId: string, name: string) => void
  onSetSubDivisionValue: (sdId: string, itemId: string, value: number | null) => void
  onUpdateLogic: (patch: Partial<CategoryLogic>) => void
  onUpdateGlobalLogic?: (patch: Partial<CategoryLogic>) => void
  onUpdateBands: (bands: GradeBand[]) => void
  onApplyScalePreset: (scaleType: ScaleType) => void
  onUpdateSubDivision?: (sdId: string, updates: any) => void
  onOpenChart?: () => void
}) {
  const [expanded,   setExpanded]   = useState(true)
  const [activeTab,  setActiveTab]  = useState<"dados" | "comparar" | "logica">("dados")
  const [addingComp, setAddingComp] = useState(false)
  const [itemName,   setItemName]   = useState("")
  const [itemValue,  setItemValue]  = useState("")

  const result     = computeCategoryResult(category)
  const opInfo     = OPERATIONS.find(o => o.value === category.operation)
  const totalItems = category.items.length
  const { logic }  = category

  const activeLogicCount = [
    logic.dropLowest, logic.dropHighest, logic.countAbsencesAsZero,
    logic.normalise, logic.useBands, logic.showRank, logic.showDelta,
    logic.showZScore, logic.applyRecovery, logic.allowExemption,
    logic.showProgress, logic.useCustomFormula,
  ].filter(Boolean).length

  const scores = totalItems >= 2 ? computeItemScores(category) : null
  const stats  = scores ? computeClassStats(scores) : null

  const bandDist = logic.useBands && logic.bands.length > 0 && scores
    ? logic.bands.map(band => ({
        band,
        count: Array.from(scores.values()).filter(s => {
          const b = getBand(s, logic.bands)
          return b?.id === band.id
        }).length,
      }))
    : null

  const handleAddFlatItem = () => {
    const n = itemName.trim(), v = itemValue.trim()
    if (!n || !v) return
    onAddItem(n, v); setItemName(""); setItemValue("")
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 cursor-pointer select-none hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base leading-tight truncate">{category.name}</span>
            {category.useSubDivisions && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1 font-semibold">
                <Columns size={9} />{category.subDivisions.length} colunas
              </Badge>
            )}
            {activeLogicCount > 0 && (
              <Badge className="text-[10px] px-2 py-0.5 gap-1 font-semibold bg-primary/15 text-primary border-primary/20">
                <Settings2 size={9} />{activeLogicCount} regras
              </Badge>
            )}
            {category.comparisons.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 font-semibold border-primary/25 text-primary">
                <Target size={9} />{category.comparisons.length}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {totalItems} {totalItems === 1 ? "item" : "itens"} · {opInfo?.label ?? category.operation}
            {stats?.mean !== null && stats ? ` · média ${fmt(stats.mean)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {result !== null && (() => {
            const band = logic.useBands ? getBand(result, logic.bands) : null
            return (
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-xl text-sm font-black tabular-nums"
                  style={{ backgroundColor: (band?.color ?? category.color) + "18", color: band?.color ?? category.color }}>
                  {fmt(result)}
                </div>
                {band && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg"
                    style={{ backgroundColor: band.color + "20", color: band.color }}>
                    {band.emoji} {band.label}
                  </span>
                )}
              </div>
            )
          })()}
          {expanded ? <ChevronDown size={16} className="text-muted-foreground/60" /> : <ChevronRight size={16} className="text-muted-foreground/60" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {/* Tab strip */}
          <div className="flex border-b border-border bg-muted/10">
            {(["dados", "comparar", "logica"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`relative flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-t-full" style={{ backgroundColor: category.color }} />
                )}
                {tab === "dados" ? "Dados"
                  : tab === "comparar" ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      Comparar
                      {category.comparisons.length > 0 && (
                        <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">{category.comparisons.length}</span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 justify-center">
                      Lógica
                      {activeLogicCount > 0 && (
                        <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">{activeLogicCount}</span>
                      )}
                    </span>
                  )}
              </button>
            ))}
          </div>

          {/* ══ DADOS TAB ══ */}
          {activeTab === "dados" && (
            <div>
              <div className="flex items-center gap-3 px-6 py-3.5 bg-muted/10 border-b border-border/50">
                <Select value={category.operation} onValueChange={v => onSetOperation(v as OperationType)}>
                  <SelectTrigger className="h-9 text-sm bg-background flex-1 max-w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Básico","Estatística","Contagem","Presença","Educacional"].map(group => (
                      <div key={group}>
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{group}</div>
                        {OPERATIONS.filter(o => o.group === group).map(op => (
                          <SelectItem key={op.value} value={op.value} className="text-sm">
                            <span>{op.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">{op.desc}</span>
                          </SelectItem>
                        ))}
                        <Separator className="my-1" />
                      </div>
                    ))}
                  </SelectContent>
                </Select>

                {opInfo && <Tip text={opInfo.desc}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center cursor-help hover:bg-muted transition-colors shrink-0">
                    <Info size={14} className="text-muted-foreground/60" />
                  </div>
                </Tip>}

                <div className="flex-1" />

                <Tip text={category.useSubDivisions ? "Desativar modo colunas" : "Ativar colunas nomeadas (provas, meses…)"}>
                  <button
                    onClick={() => onToggleSubDivisions(!category.useSubDivisions)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      category.useSubDivisions
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}>
                    <Columns size={14} />
                    {category.useSubDivisions ? "Colunas ativo" : "Modo colunas"}
                  </button>
                </Tip>
              </div>

              {/* Flat list */}
              {!category.useSubDivisions && (
                <>
                  {category.items.length > 0 && (
                    <div className="border-b border-border/50">
                      <div className="flex items-center gap-2.5 px-5 py-2 bg-muted/30 border-b border-border/50 sticky top-0 z-10">
                        <span className="w-5 shrink-0" />
                        {logic.showRank && <span className="w-5 shrink-0" />}
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex-1">Nome</span>
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-24 text-right">Resultado</span>
                        <span className="w-14 shrink-0" />
                      </div>
                      <div style={{ overflowY: "auto", overflowX: "auto", maxHeight: "min(360px, 48vh)", WebkitOverflowScrolling: "touch" }}>
                        <div style={{ minWidth: 420 }} className="divide-y divide-border/30">
                          {category.items.map((item, idx) => (
                            <ItemRow key={item.id} item={item} idx={idx}
                              operation={category.operation} category={category}
                              onRemove={() => onRemoveItem(item.id)}
                              onUpdate={(n, r) => onUpdateItem(item.id, n, r)}
                              onUpdateMeta={u => onUpdateItemMeta(item.id, u)} />
                          ))}
                        </div>
                      </div>

                      {bandDist && bandDist.some(b => b.count > 0) && (
                        <div className="px-5 py-3 bg-muted/10 border-t border-border/40">
                          <div className="flex items-center gap-2 h-5 rounded-full overflow-hidden">
                            {bandDist.filter(b => b.count > 0).map(({ band, count }) => (
                              <Tip key={band.id} text={`${band.label}: ${count}`}>
                                <div className="h-full transition-all" style={{
                                  backgroundColor: band.color,
                                  width: String((count / totalItems) * 100) + "%",
                                  minWidth: count > 0 ? "4px" : "0",
                                }} />
                              </Tip>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {bandDist.filter(b => b.count > 0).map(({ band, count }) => (
                              <span key={band.id} className="flex items-center gap-1 text-xs">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: band.color }} />
                                <span className="text-muted-foreground">{band.label}:</span>
                                <span className="font-semibold">{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {category.items.length === 0 && (
                    <div className="flex flex-col items-center py-12 gap-3 text-center border-b border-border/40">
                      <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                        <ListOrdered size={20} className="text-muted-foreground/35" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Sem itens — adicione alunos abaixo</p>
                    </div>
                  )}

                  <div className="px-6 py-4 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input placeholder="Nome do aluno" value={itemName} onChange={e => setItemName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAddFlatItem() }} className="h-9 text-sm flex-1" />
                      <Input placeholder="Valor" value={itemValue}
                        onChange={e => setItemValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAddFlatItem() }}
                        className="h-9 text-sm w-28 font-mono" />
                      <Button onClick={handleAddFlatItem} disabled={!itemName.trim() || !itemValue.trim()}
                        className="h-9 w-9 p-0 shrink-0"><Plus size={15} /></Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">💡 Duplo clique num item para editar</p>
                  </div>
                </>
              )}

              {/* Subdivision grid — overflow-hidden garante que o scroll fique contido */}
              {category.useSubDivisions && (
                <div className="p-6 overflow-hidden">
                  <SubDivisionGrid category={category}
                    onSetValue={onSetSubDivisionValue}
                    onRenameSubDivision={onRenameSubDivision}
                    onRemoveSubDivision={onRemoveSubDivision}
                    onAddSubDivision={onAddSubDivision}
                    onAddItem={name => onAddItem(name, "0")}
                    onRemoveItem={onRemoveItem}
                    onUpdateItemName={(id, name) => onUpdateItem(id, name, "0")}
                    onUpdateSubDivision={onUpdateSubDivision} />
                </div>
              )}

              {/* Summary bar */}
              <div className="flex items-center gap-4 px-6 py-4 border-t border-border/50 bg-muted/10">
                {totalItems > 0 && result !== null && (
                  <>
                    <span className="text-sm text-muted-foreground">{opInfo?.label} · {totalItems} itens</span>
                    <span className="text-lg font-black tabular-nums ml-2" style={{ color: category.color }}>{fmt(result)}</span>
                    {stats?.mean !== null && stats && (
                      <span className="text-xs text-muted-foreground/70">
                        · média {fmt(stats.mean)} · DP {fmt(stats.stddev ?? 0)}
                      </span>
                    )}
                  </>
                )}
                <div className="flex-1" />
                <Tip text={totalItems === 0 ? "Adicione itens primeiro" : "Exporta para a planilha"}>
                  <Button variant="outline" size="sm" onClick={onSendToGrid} disabled={totalItems === 0}
                    className="h-9 gap-2 text-sm font-medium px-5">
                    <TableIcon size={14} />Inserir na planilha
                  </Button>
                </Tip>
                <Tip text="Excluir categoria">
                  <Button variant="ghost" size="sm" onClick={onRemove}
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 size={14} />
                  </Button>
                </Tip>
              </div>
            </div>
          )}

          {/* ══ COMPARAR TAB ══ */}
          {activeTab === "comparar" && (
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2"><Target size={14} className="text-primary" />Comparações</p>
                  <p className="text-xs text-muted-foreground mt-1">Metas, notas mínimas e critérios que viram colunas na planilha.</p>
                </div>
                {!addingComp && (
                  <Button variant="outline" size="sm" onClick={() => setAddingComp(true)} className="h-9 gap-1.5 text-sm shrink-0">
                    <Plus size={13} />Nova
                  </Button>
                )}
              </div>
              {addingComp && (
                <ComparisonForm items={category.items}
                  onSave={d => { onAddComparison(d.label, d.refValue, d.operator, d.scope, d.labelTrue, d.labelFalse, "#2563eb", "#dc2626"); setAddingComp(false) }}
                  onCancel={() => setAddingComp(false)} />
              )}
              {category.comparisons.map(comp => (
                <ComparisonBadge key={comp.id} comp={comp} category={category}
                  onRemove={() => onRemoveComparison(comp.id)}
                  onUpdate={u => onUpdateComparison(comp.id, u)} />
              ))}
              {!addingComp && category.comparisons.length === 0 && (
                <button onClick={() => setAddingComp(true)}
                  className="flex flex-col items-center gap-3 py-12 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/[0.02] transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Target size={20} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground group-hover:text-foreground">Adicionar comparação</p>
                  <p className="text-xs text-muted-foreground/60">Ex: Nota mínima 6, meta de frequência 75%…</p>
                </button>
              )}
            </div>
          )}

          {/* ══ LÓGICA TAB ══ */}
          {activeTab === "logica" && (
            <LogicTab category={category}
              onUpdateLogic={onUpdateLogic}
              onUpdateGlobalLogic={onUpdateGlobalLogic}
              onUpdateBands={onUpdateBands}
              onApplyScalePreset={onApplyScalePreset} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── CategoryDialog ───────────────────────────────────────────────────────────
export function CategoryDialog({
  open, onOpenChange,
  categories, roster,
  onAddCategory, onRemoveCategory, onSetOperation,
  onAddItem, onRemoveItem, onUpdateItem, onUpdateItemMeta, onSendToGrid,
  onAddComparison, onUpdateComparison, onRemoveComparison,
  onToggleSubDivisions, onAddSubDivision, onRemoveSubDivision, onRenameSubDivision, onSetSubDivisionValue,
  onUpdateLogic, onUpdateGlobalLogic, onUpdateBands, onApplyScalePreset, onUpdateSubDivision,
  onOpenChart,
  boletimConfig, onBoletimConfigChange, onApplyTemplate,
}: CategoryDialogProps) {
  const [newCategoryName, setNewCategoryName] = useState("")
  const [creatingNew,     setCreatingNew]     = useState(false)
  const [mainTab,         setMainTab]         = useState<"categorias" | "boletim">("categorias")
  const inputRef = useRef<HTMLInputElement>(null)

  const rosterSize = roster?.length ?? (categories[0]?.items.length ?? 0)

  const handleCreate = () => {
    if (!newCategoryName.trim()) return
    onAddCategory(newCategoryName.trim()); setNewCategoryName(""); setCreatingNew(false)
  }
  const startCreating = () => { setCreatingNew(true); setTimeout(() => inputRef.current?.focus(), 50) }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden"
        style={{ maxWidth: "min(1000px, 98vw)", maxHeight: "min(94vh, 1000px)", height: "94svh", width: "98vw" }}>

        <DialogHeader className="shrink-0 border-b border-border bg-muted/10">
          <div className="flex items-center justify-between px-7 pt-5 pb-0">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap size={22} className="text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold leading-none tracking-tight">Diário de Classe</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {rosterSize > 0
                    ? `${rosterSize} ${rosterSize === 1 ? "aluno" : "alunos"} · ${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`
                    : "Gerencie notas, presenças e situação dos alunos"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {mainTab === "categorias" && (
                creatingNew ? (
                  <div className="flex items-center gap-2">
                    <Input ref={inputRef} value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreatingNew(false); setNewCategoryName("") } }}
                      placeholder="Nome da categoria…" className="h-9 text-sm w-60" autoFocus />
                    <Button onClick={handleCreate} disabled={!newCategoryName.trim()} className="h-9 px-5 text-sm">Criar</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setCreatingNew(false); setNewCategoryName("") }} className="h-9 w-9 p-0">
                      <X size={15} />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={startCreating} className="h-9 gap-2 px-5 text-sm">
                    <Plus size={15} />Nova categoria
                  </Button>
                )
              )}
            </div>
          </div>
          <div className="flex px-7 pt-3 gap-0">
            {([
              { id: "categorias", label: "Categorias", icon: Layers },
              { id: "boletim",    label: "Boletim",    icon: FileText },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setMainTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                  mainTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <Icon size={14} />{label}
                {id === "boletim" && rosterSize > 0 && (
                  <span className="ml-0.5 bg-primary/15 text-primary px-1.5 rounded-full text-[9px] font-bold">{rosterSize}</span>
                )}
              </button>
            ))}
          </div>
        </DialogHeader>

        {mainTab === "boletim" ? (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <BoletimTab
              categories={categories}
              roster={roster ?? []}
              config={boletimConfig}
              onConfigChange={onBoletimConfigChange}
              onApplyTemplate={onApplyTemplate}
            />
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="p-7 flex flex-col gap-5">
              {categories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-7 text-center">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-inner">
                    <GraduationCap size={40} className="text-primary/50" />
                  </div>
                  <div className="max-w-sm">
                    <p className="text-lg font-bold tracking-tight">Nenhuma categoria ainda</p>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Crie grupos para turmas, provas, notas bimestrais ou registro de frequência.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {SCHOOL_TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => { onApplyTemplate(t); setMainTab("boletim") }}
                        className="flex flex-col items-start gap-1.5 p-4 rounded-2xl border border-border/60 bg-muted/10 hover:bg-primary/[0.04] hover:border-primary/25 transition-all text-left group">
                        <span className="text-xl">{t.icon}</span>
                        <p className="text-sm font-bold group-hover:text-primary transition-colors">{t.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug">{t.description}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    {!creatingNew && (
                      <Button onClick={startCreating} variant="outline" size="lg" className="h-11 text-sm gap-2 px-8">
                        <Plus size={16} />Categoria em branco
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {categories.map(cat => (
                <CategoryCard key={cat.id} category={cat}
                  onRemove={() => onRemoveCategory(cat.id)}
                  onSetOperation={op => onSetOperation(cat.id, op)}
                  onAddItem={(n, r) => onAddItem(cat.id, n, r)}
                  onRemoveItem={id => onRemoveItem(cat.id, id)}
                  onUpdateItem={(id, n, r) => onUpdateItem(cat.id, id, n, r)}
                  onUpdateItemMeta={(id, u) => onUpdateItemMeta(cat.id, id, u)}
                  onSendToGrid={() => { onSendToGrid(cat); onOpenChange(false) }}
                  onAddComparison={(l, r, op, sc, lt, lf, cp, cf) => onAddComparison(cat.id, l, r, op, sc, lt, lf, cp, cf)}
                  onUpdateComparison={(id, u) => onUpdateComparison(cat.id, id, u)}
                  onRemoveComparison={id => onRemoveComparison(cat.id, id)}
                  onToggleSubDivisions={e => onToggleSubDivisions(cat.id, e)}
                  onAddSubDivision={n => onAddSubDivision(cat.id, n)}
                  onRemoveSubDivision={id => onRemoveSubDivision(cat.id, id)}
                  onRenameSubDivision={(id, n) => onRenameSubDivision(cat.id, id, n)}
                  onSetSubDivisionValue={(sdId, iId, v) => onSetSubDivisionValue(cat.id, sdId, iId, v)}
                  onUpdateLogic={patch => onUpdateLogic(cat.id, patch)}
                  onUpdateGlobalLogic={onUpdateGlobalLogic}
                  onUpdateBands={bands => onUpdateBands(cat.id, bands)}
                  onApplyScalePreset={scale => onApplyScalePreset(cat.id, scale)}
                  onUpdateSubDivision={onUpdateSubDivision
                    ? (sdId, updates) => onUpdateSubDivision!(cat.id, sdId, updates)
                    : undefined}
                  onOpenChart={onOpenChart ? () => onOpenChart(cat.id) : undefined}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}