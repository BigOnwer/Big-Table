"use client"

import { useState, useCallback, useRef } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CategoryItem = {
  id: string
  name: string
  value: number
  values?: number[]
  rawValueInput?: string
  absent?: boolean
  exempt?: boolean
  tags?: string[]
}

export type SubDivision = {
  id: string
  name: string
  weight?: number
  isRecovery?: boolean
  recoveryFor?: string
  isBonus?: boolean
  maxScore?: number
  isAbsenceCol?: boolean
  // Gabarito: the correct answer for this question column
  correctAnswer?: string
}

export type OperationType =
  // ── Basic aggregation ─────────────────────────────────────────────────────
  | "SOMA"               // sum of all item values
  | "MEDIA"              // arithmetic mean
  | "MEDIA_PONDERADA"    // weighted mean (weight per SubDivision)
  | "MEDIANA"            // median
  | "MODA"               // mode
  | "MAX"                // maximum
  | "MIN"                // minimum
  // ── Statistical ───────────────────────────────────────────────────────────
  | "DESVIO_PADRAO"      // population std-deviation
  | "VARIANCIA"          // population variance
  | "AMPLITUDE"          // max − min
  // ── Counting ──────────────────────────────────────────────────────────────
  | "CONTAR"             // count items with value present
  | "CONTAR_ACIMA"       // count items >= thresholdValue
  | "CONTAR_ABAIXO"      // count items <  thresholdValue
  | "PERCENTUAL"         // sum used as raw percentage
  // ── Attendance ────────────────────────────────────────────────────────────
  | "FREQUENCIA"         // % of columns with presence mark
  // ── Scoring templates ─────────────────────────────────────────────────────
  | "GABARITO"           // each column has a correct answer; count matches → %
  | "REGRA_DE_TRES"      // proportional: (value / reference) * target

export type ComparisonOperator = ">" | ">=" | "<" | "<=" | "==" | "!="
export type ComparisonScope    = "total" | "each" | `item:${string}`

export type ExternalComparison = {
  id: string
  label: string
  refValue: number
  operator: ComparisonOperator
  scope: ComparisonScope
  labelTrue: string
  labelFalse: string
  colorPass: string
  colorFail: string
}

export type GradeBand = {
  id: string
  label: string
  minScore: number
  maxScore?: number
  color: string
  emoji?: string
}

export type RoundMode = "none" | "half" | "integer" | "up" | "down"
export type ScaleType = "decimal_10" | "decimal_100" | "percent" | "letter" | "custom"

export type CategoryLogic = {
  // ── Score processing ──────────────────────────────────────────────────────
  dropLowest: boolean
  dropLowestN: number
  dropHighest: boolean
  dropHighestN: number
  countAbsencesAsZero: boolean
  maxScore: number | null

  // ── Normalisation ─────────────────────────────────────────────────────────
  normalise: boolean
  normaliseTarget: number

  // ── Rounding ──────────────────────────────────────────────────────────────
  roundMode: RoundMode
  roundDecimals: number

  // ── Grade bands ───────────────────────────────────────────────────────────
  useBands: boolean
  bands: GradeBand[]

  // ── Statistics display ────────────────────────────────────────────────────
  showRank: boolean
  showDelta: boolean
  showZScore: boolean

  // ── Attendance ────────────────────────────────────────────────────────────
  attendanceWarningThreshold: number

  // ── Recovery ─────────────────────────────────────────────────────────────
  applyRecovery: boolean

  // ── Threshold ops ─────────────────────────────────────────────────────────
  thresholdValue: number

  // ── Exemption ─────────────────────────────────────────────────────────────
  allowExemption: boolean

  // ── Progress / target ─────────────────────────────────────────────────────
  showProgress: boolean
  targetScore: number | null

  // ── Scale preset ──────────────────────────────────────────────────────────
  scaleType: ScaleType

  // ── Regra de três ─────────────────────────────────────────────────────────
  regraRef: number       // the reference value (e.g. total questions = 20)
  regraTarget: number    // target scale (e.g. 10)
  regraInverse: boolean  // direct (false) or inverse (true) proportion

  // ── Gabarito answer key (stored per-column in SubDivision.correctAnswer) ──
  gabaritoAnswerMode: "exact" | "contains"  // "exact" = full match, "contains" = substring

  // ── Custom formula (advanced) ─────────────────────────────────────────────
  useCustomFormula: boolean
  customFormula: string
}

export type Category = {
  id: string
  name: string
  color: string
  operation: OperationType
  items: CategoryItem[]
  subDivisions: SubDivision[]
  subDivisionValues: Record<string, Record<string, number | string>>
  useSubDivisions: boolean
  comparisons: ExternalComparison[]
  logic: CategoryLogic
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_LOGIC: CategoryLogic = {
  dropLowest: false, dropLowestN: 1,
  dropHighest: false, dropHighestN: 1,
  countAbsencesAsZero: false,
  maxScore: null,
  normalise: false, normaliseTarget: 10,
  roundMode: "none", roundDecimals: 2,
  useBands: false, bands: [],
  showRank: false, showDelta: false, showZScore: false,
  attendanceWarningThreshold: 75,
  applyRecovery: false,
  thresholdValue: 6,
  allowExemption: false,
  showProgress: false, targetScore: null,
  scaleType: "decimal_10",
  regraRef: 100, regraTarget: 10, regraInverse: false,
  gabaritoAnswerMode: "exact",
  useCustomFormula: false, customFormula: "",
}

export const SCALE_PRESETS: Record<ScaleType, {
  bands: GradeBand[]; maxScore: number; normaliseTarget: number; label: string
}> = {
  decimal_10: {
    label: "Decimal 0–10", maxScore: 10, normaliseTarget: 10,
    bands: [
      { id: "d1", label: "Reprovado",   minScore: 0, color: "#dc2626", emoji: "✗" },
      { id: "d2", label: "Recuperação", minScore: 5, color: "#f97316", emoji: "⚠" },
      { id: "d3", label: "Aprovado",    minScore: 6, color: "#16a34a", emoji: "✓" },
      { id: "d4", label: "Destaque",    minScore: 9, color: "#2563eb", emoji: "★" },
    ],
  },
  decimal_100: {
    label: "Decimal 0–100", maxScore: 100, normaliseTarget: 100,
    bands: [
      { id: "c1", label: "Reprovado",   minScore: 0,  color: "#dc2626", emoji: "✗" },
      { id: "c2", label: "Recuperação", minScore: 50, color: "#f97316", emoji: "⚠" },
      { id: "c3", label: "Aprovado",    minScore: 60, color: "#16a34a", emoji: "✓" },
      { id: "c4", label: "Destaque",    minScore: 90, color: "#2563eb", emoji: "★" },
    ],
  },
  percent: {
    label: "Percentual %", maxScore: 100, normaliseTarget: 100,
    bands: [
      { id: "p1", label: "< 50%",  minScore: 0,  color: "#dc2626" },
      { id: "p2", label: "50–69%", minScore: 50, color: "#f97316" },
      { id: "p3", label: "70–89%", minScore: 70, color: "#16a34a" },
      { id: "p4", label: "≥ 90%",  minScore: 90, color: "#2563eb" },
    ],
  },
  letter: {
    label: "Conceitos A–F", maxScore: 100, normaliseTarget: 100,
    bands: [
      { id: "l1", label: "F", minScore: 0,  color: "#dc2626" },
      { id: "l2", label: "D", minScore: 50, color: "#f97316" },
      { id: "l3", label: "C", minScore: 60, color: "#ca8a04" },
      { id: "l4", label: "B", minScore: 75, color: "#16a34a" },
      { id: "l5", label: "A", minScore: 90, color: "#2563eb" },
    ],
  },
  custom: {
    label: "Personalizado", maxScore: 10, normaliseTarget: 10, bands: [],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR POOL
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  "#2563eb","#16a34a","#dc2626","#ea580c","#9333ea","#0891b2","#ca8a04","#db2777",
]
// colorIndex lives in module scope but is only incremented on user action (addCategory),
// never on render — so StrictMode double-invoke of the component body doesn't affect it.
// However to be fully safe we'll manage it inside the hook via useRef.
export function _getColorForIndex(i: number) { return CATEGORY_COLORS[i % CATEGORY_COLORS.length] }
export function generateId() { return Math.random().toString(36).substring(2, 9) }

// ─────────────────────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function parseValueInput(raw: string): { values: number[]; isMultiple: boolean } {
  const parts = raw.split(",").map(s => s.trim())
  if (parts.length > 1) {
    const nums = parts.map(parseFloat).filter(n => !isNaN(n))
    return { values: nums, isMultiple: true }
  }
  const single = parseFloat(raw)
  return { values: isNaN(single) ? [] : [single], isMultiple: false }
}

export function applyRound(n: number, mode: RoundMode, decimals = 2): number {
  switch (mode) {
    case "integer": return Math.round(n)
    case "half":    return Math.round(n * 2) / 2
    case "up":      return Math.ceil(n)
    case "down":    return Math.floor(n)
    default: { const f = Math.pow(10, decimals); return Math.round(n * f) / f }
  }
}

export function medianOf(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

export function modaOf(vals: number[]): number {
  const freq: Record<number, number> = {}
  vals.forEach(v => { freq[v] = (freq[v] ?? 0) + 1 })
  return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
}

export function stddevOf(vals: number[]): number {
  if (vals.length < 2) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  // Use sample stddev (n-1) for 2+ values so 2-item sets give non-zero result
  const n = vals.length > 1 ? vals.length - 1 : vals.length
  return Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / n)
}

export function getBand(score: number, bands: GradeBand[]): GradeBand | null {
  if (!bands.length) return null
  return [...bands].sort((a, b) => b.minScore - a.minScore).find(b => score >= b.minScore) ?? null
}

function applyDropRules(vals: number[], logic: CategoryLogic): number[] {
  if (vals.length < 2) return vals  // nothing to drop — always keep at least 1
  let v = [...vals]
  // Never drop more than (n-1) items so at least 1 always remains
  if (logic.dropLowest && logic.dropLowestN > 0) {
    const canDrop = Math.min(logic.dropLowestN, v.length - 1)
    const sorted = [...v].sort((a, b) => a - b)
    sorted.slice(0, canDrop).forEach(low => { const i = v.indexOf(low); if (i !== -1) v.splice(i, 1) })
  }
  if (logic.dropHighest && logic.dropHighestN > 0) {
    const canDrop = Math.min(logic.dropHighestN, v.length - 1)
    const sorted = [...v].sort((a, b) => b - a)
    sorted.slice(0, canDrop).forEach(high => { const i = v.indexOf(high); if (i !== -1) v.splice(i, 1) })
  }
  return v
}

function applyLogicToVals(vals: number[], logic: CategoryLogic): number[] {
  let v = [...vals]
  if (logic.maxScore !== null) v = v.map(x => Math.min(x, logic.maxScore!))
  return applyDropRules(v, logic)
}

function aggregate(vals: number[], op: OperationType, logic?: CategoryLogic): number | null {
  if (!vals.length) return null
  switch (op) {
    case "SOMA":       return vals.reduce((a, b) => a + b, 0)
    case "PERCENTUAL": return vals.reduce((a, b) => a + b, 0)
    case "MEDIA":      return vals.reduce((a, b) => a + b, 0) / vals.length
    case "MEDIANA":    return medianOf(vals)
    case "MODA":       return modaOf(vals)
    case "DESVIO_PADRAO": return stddevOf(vals)
    case "VARIANCIA":  return Math.pow(stddevOf(vals), 2)
    case "CONTAR":     return vals.length
    case "CONTAR_ACIMA":  return vals.filter(v => v >= (logic?.thresholdValue ?? 6)).length
    case "CONTAR_ABAIXO": return vals.filter(v => v < (logic?.thresholdValue ?? 6)).length
    case "MAX":        return Math.max(...vals)
    case "MIN":        return Math.min(...vals)
    case "AMPLITUDE":  return Math.max(...vals) - Math.min(...vals)
    default:           return vals.reduce((a, b) => a + b, 0)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GABARITO HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the raw string answer stored for an item in a column (gabarito mode) */
export function getGabaritoAnswer(
  category: Category,
  sdId: string,
  itemId: string,
): string {
  const v = category.subDivisionValues[sdId]?.[itemId]
  return v === undefined || v === null ? "" : String(v).trim()
}

/** Check if student answer matches the correct answer */
export function gabaritoMatch(
  studentAnswer: string,
  correctAnswer: string,
  mode: "exact" | "contains",
): boolean {
  const s = studentAnswer.trim().toUpperCase()
  const c = correctAnswer.trim().toUpperCase()
  if (!s || !c) return false
  return mode === "exact" ? s === c : s.includes(c) || c.includes(s)
}

/**
 * Compute gabarito score for one item:
 * counts how many columns have matching answers → returns percentage (0–100).
 */
export function computeGabaritoItemScore(
  item: CategoryItem,
  category: Category,
): number | null {
  const { subDivisions, logic } = category
  const activeSds = subDivisions.filter(sd => sd.correctAnswer !== undefined && sd.correctAnswer !== "")
  if (!activeSds.length) return null
  let correct = 0
  activeSds.forEach(sd => {
    const studentAns = getGabaritoAnswer(category, sd.id, item.id)
    if (gabaritoMatch(studentAns, sd.correctAnswer!, logic.gabaritoAnswerMode)) correct++
  })
  return (correct / activeSds.length) * 100
}

// ─────────────────────────────────────────────────────────────────────────────
// REGRA DE TRÊS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Direct:  result = (value / regraRef) * regraTarget
 * Inverse: result = (regraRef * regraTarget) / value
 */
export function computeRegraDeTres(
  value: number,
  logic: CategoryLogic,
): number | null {
  if (!logic.regraRef || logic.regraRef === 0) return null
  if (logic.regraInverse) {
    if (value === 0) return null
    return (logic.regraRef * logic.regraTarget) / value
  }
  return (value / logic.regraRef) * logic.regraTarget
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM FORMULA EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────

export function evalCustomFormula(
  formula: string,
  varMap: Record<string, number>,
): number | null {
  try {
    let expr = formula
    const keys = Object.keys(varMap).sort((a, b) => b.length - a.length)
    for (const k of keys) expr = expr.replaceAll(k, String(varMap[k]))
    if (!/^[\d\s+\-*/().,^%]+$/.test(expr)) return null
    expr = expr.replace(/\^/g, "**")
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)()
    return typeof result === "number" && isFinite(result) ? result : null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOVERY RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function resolveRecovery(
  sdVals: { sdId: string; value: number | string | undefined }[],
  sds: SubDivision[],
): { sdId: string; value: number | string | undefined }[] {
  const out = sdVals.map(x => ({ ...x }))
  sds.forEach(sd => {
    if (!sd.isRecovery || !sd.recoveryFor) return
    const rec  = out.find(x => x.sdId === sd.id)
    const orig = out.find(x => x.sdId === sd.recoveryFor)
    if (!rec || !orig) return
    const rv = typeof rec.value  === "number" ? rec.value  : parseFloat(String(rec.value  ?? ""))
    const ov = typeof orig.value === "number" ? orig.value : parseFloat(String(orig.value ?? ""))
    if (!isNaN(rv)) {
      if (isNaN(ov) || rv > ov) orig.value = rv
    }
    rec.value = undefined
  })
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE COMPUTE — per item using SubDivision grid
// ─────────────────────────────────────────────────────────────────────────────

export function computeItemSubDivResult(item: CategoryItem, category: Category): number | null {
  if (item.exempt && category.logic.allowExemption) return null
  if (item.absent) return 0

  const { subDivisions, subDivisionValues, operation, logic } = category

  // ── Gabarito mode ─────────────────────────────────────────────────────────
  if (operation === "GABARITO") {
    const pct = computeGabaritoItemScore(item, category)
    if (pct === null) return null
    // optionally convert to another scale
    const scaled = logic.normalise
      ? (pct / 100) * logic.normaliseTarget
      : pct
    return applyRound(scaled, logic.roundMode, logic.roundDecimals)
  }

  let sdVals = subDivisions.map(sd => ({
    sdId: sd.id,
    value: subDivisionValues[sd.id]?.[item.id] as number | string | undefined,
  }))

  if (logic.applyRecovery) sdVals = resolveRecovery(sdVals, subDivisions)
  const calcSds = subDivisions.filter(sd => !(logic.applyRecovery && sd.isRecovery))

  // ── Attendance mode ───────────────────────────────────────────────────────
  if (operation === "FREQUENCIA") {
    const absCols = calcSds.filter(sd => sd.isAbsenceCol)
    const cols    = absCols.length ? absCols : calcSds
    const total   = cols.length
    if (!total) return null
    const present = cols.filter(sd => {
      const v = sdVals.find(x => x.sdId === sd.id)?.value
      return v !== undefined && v !== null && Number(v) > 0
    }).length
    return applyRound((present / total) * 100, logic.roundMode, logic.roundDecimals)
  }

  // ── Custom formula ────────────────────────────────────────────────────────
  if (logic.useCustomFormula && logic.customFormula.trim()) {
    const varMap: Record<string, number> = {}
    calcSds.forEach(sd => {
      const key = sd.name.replace(/\s+/g, "")
      const raw = sdVals.find(x => x.sdId === sd.id)?.value
      const v   = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""))
      varMap[key] = isNaN(v) ? (logic.countAbsencesAsZero ? 0 : NaN) : v
    })
    if (!logic.countAbsencesAsZero && Object.values(varMap).some(isNaN)) return null
    const cleanMap: Record<string, number> = {}
    Object.entries(varMap).forEach(([k, v]) => { if (!isNaN(v)) cleanMap[k] = v })
    const res = evalCustomFormula(logic.customFormula, cleanMap)
    if (res === null) return null
    const capped = logic.maxScore !== null ? Math.min(res, logic.maxScore) : res
    const normed = logic.normalise ? (capped / (logic.maxScore ?? logic.normaliseTarget)) * logic.normaliseTarget : capped
    return applyRound(normed, logic.roundMode, logic.roundDecimals)
  }

  // ── Standard numeric modes ────────────────────────────────────────────────
  let pairs: { value: number; weight: number; isBonus: boolean }[] = []
  for (const sd of calcSds) {
    if (sd.isAbsenceCol) continue
    const raw = sdVals.find(x => x.sdId === sd.id)?.value
    let v     = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""))
    if (isNaN(v)) {
      if (logic.countAbsencesAsZero) v = 0
      else continue
    }
    if (sd.maxScore && sd.maxScore > 0) v = (v / sd.maxScore) * (logic.normaliseTarget || 10)
    pairs.push({ value: v, weight: sd.weight ?? 1, isBonus: sd.isBonus ?? false })
  }
  if (!pairs.length) return null

  const bonusSum  = pairs.filter(p => p.isBonus).reduce((s, p) => s + p.value, 0)
  const mainPairs = pairs.filter(p => !p.isBonus)
  if (!mainPairs.length) return bonusSum > 0 ? bonusSum : null

  let vals    = mainPairs.map(p => p.value)
  let weights = mainPairs.map(p => p.weight)
  if (logic.maxScore !== null) vals = vals.map(x => Math.min(x, logic.maxScore!))

  const isWeighted = operation === "MEDIA_PONDERADA"
  let result: number

  if (isWeighted) {
    let wPairs = mainPairs.map((p, i) => ({ value: vals[i], weight: weights[i] }))
    if (logic.dropLowest  && wPairs.length > logic.dropLowestN)
      wPairs = [...wPairs].sort((a, b) => a.value - b.value).slice(logic.dropLowestN)
    if (logic.dropHighest && wPairs.length > logic.dropHighestN)
      wPairs = [...wPairs].sort((a, b) => b.value - a.value).slice(logic.dropHighestN)
    const totalW = wPairs.reduce((s, p) => s + p.weight, 0)
    if (!totalW) return null
    result = wPairs.reduce((s, p) => s + p.value * p.weight, 0) / totalW
  } else {
    result = aggregate(applyDropRules(vals, logic), operation, logic) ?? 0
  }

  result += bonusSum
  if (logic.maxScore !== null) result = Math.min(result, logic.maxScore)
  if (logic.normalise) result = (result / (logic.maxScore ?? logic.normaliseTarget)) * logic.normaliseTarget
  return applyRound(result, logic.roundMode, logic.roundDecimals)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTE — category-level (flat item list)
// ─────────────────────────────────────────────────────────────────────────────

export function computeResult(
  items: CategoryItem[],
  operation: OperationType,
  logic: CategoryLogic,
): number | null {
  const activeItems = logic.allowExemption ? items.filter(i => !i.exempt) : items
  let vals: number[]

  if (operation === "REGRA_DE_TRES") {
    // Regra de três over the single item value
    vals = activeItems
      .map(i => computeRegraDeTres(i.value, logic))
      .filter((v): v is number => v !== null)
  } else {
    vals = activeItems.map(i => i.value)
  }
  if (!vals.length) return null

  const isWeighted = operation === "MEDIA_PONDERADA"
  let result: number | null
  if (isWeighted) {
    result = vals.reduce((a, b) => a + b, 0) / vals.length
  } else {
    result = aggregate(applyLogicToVals(vals, logic), operation, logic)
  }
  if (result === null) return null
  if (logic.maxScore !== null) result = Math.min(result, logic.maxScore)
  if (logic.normalise) result = (result / (logic.maxScore ?? logic.normaliseTarget)) * logic.normaliseTarget
  return applyRound(result, logic.roundMode, logic.roundDecimals)
}

export function computeCategoryResult(category: Category): number | null {
  if (!category.useSubDivisions)
    return computeResult(category.items, category.operation, category.logic)

  const activeItems = category.logic.allowExemption
    ? category.items.filter(i => !i.exempt)
    : category.items

  const vals = activeItems
    .map(item => computeItemSubDivResult(item, category))
    .filter((v): v is number => v !== null)
  if (!vals.length) return null

  const isWeighted = category.operation === "MEDIA_PONDERADA"
  let result: number | null
  if (isWeighted) {
    result = vals.reduce((a, b) => a + b, 0) / vals.length
  } else {
    result = aggregate(applyLogicToVals(vals, category.logic), category.operation, category.logic)
  }
  if (result === null) return null
  if (category.logic.maxScore !== null) result = Math.min(result, category.logic.maxScore)
  return applyRound(result, category.logic.roundMode, category.logic.roundDecimals)
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

export function computeItemScores(category: Category): Map<string, number> {
  const map = new Map<string, number>()
  category.items.forEach(item => {
    if (item.exempt && category.logic.allowExemption) return
    const v = category.useSubDivisions
      ? computeItemSubDivResult(item, category)
      : category.operation === "REGRA_DE_TRES"
        ? computeRegraDeTres(item.value, category.logic)
        : item.value
    if (v !== null) map.set(item.id, v)
  })
  return map
}

export function computeClassStats(scores: Map<string, number>) {
  const vals = Array.from(scores.values())
  if (!vals.length) return { mean: null, stddev: null, median: null, min: null, max: null, count: 0 }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  return { mean, stddev: stddevOf(vals), median: medianOf(vals), min: Math.min(...vals), max: Math.max(...vals), count: vals.length }
}

export function computeRanks(items: CategoryItem[], category: Category): Map<string, number> {
  const pairs = items
    .filter(item => !(item.exempt && category.logic.allowExemption))
    .map(item => ({
      id: item.id,
      score: category.useSubDivisions
        ? computeItemSubDivResult(item, category)
        : category.operation === "REGRA_DE_TRES"
          ? computeRegraDeTres(item.value, category.logic)
          : item.value,
    }))
    .filter((p): p is { id: string; score: number } => p.score !== null)

  pairs.sort((a, b) => b.score - a.score)
  const map = new Map<string, number>()
  pairs.forEach((p, i) => map.set(p.id, i + 1))
  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPARISON
// ─────────────────────────────────────────────────────────────────────────────

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

export function getComparisonTarget(
  comp: ExternalComparison,
  item: CategoryItem,
  categoryResult: number | null,
  operation: OperationType,
  logic?: CategoryLogic,
): number | null {
  if (comp.scope === "total") return categoryResult
  const score = operation === "REGRA_DE_TRES" && logic
    ? computeRegraDeTres(item.value, logic)
    : item.value
  if (comp.scope === "each") return score
  const targetId = comp.scope.replace("item:", "")
  return item.id === targetId ? score : null
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID EXPORT FORMULAS (PT-BR spreadsheet formulas matching JS computation)
// ─────────────────────────────────────────────────────────────────────────────

export function operationToSummaryFormula(
  op: OperationType,
  rangeRef: string,
  logic: CategoryLogic,
): string | null {
  switch (op) {
    case "SOMA":              return `=SOMA(${rangeRef})`
    case "PERCENTUAL":        return `=SOMA(${rangeRef})`
    case "MEDIA":
    case "MEDIA_PONDERADA":   return `=MÉDIA(${rangeRef})`
    case "MEDIANA":           return `=MED(${rangeRef})`
    case "MODA":              return `=MODO(${rangeRef})`
    case "DESVIO_PADRAO":     return `=DESVPAD(${rangeRef})`
    case "VARIANCIA":         return `=VAR(${rangeRef})`
    case "AMPLITUDE":         return `=MÁXIMO(${rangeRef})-MÍNIMO(${rangeRef})`
    case "MAX":               return `=MÁXIMO(${rangeRef})`
    case "MIN":               return `=MÍNIMO(${rangeRef})`
    case "CONTAR":            return `=CONT.VALORES(${rangeRef})`
    case "CONTAR_ACIMA":      return `=CONT.SE(${rangeRef};">=${logic.thresholdValue}")`
    case "CONTAR_ABAIXO":     return `=CONT.SE(${rangeRef};"<${logic.thresholdValue}")`
    case "FREQUENCIA":        return `=MÉDIA(${rangeRef})`
    // No native spreadsheet equivalent — caller writes pre-computed numeric value
    case "GABARITO":
    case "REGRA_DE_TRES":     return null
    default:                  return `=MÉDIA(${rangeRef})`
  }
}

export function rowAggFormula(op: OperationType, rangeRef: string): string {
  switch (op) {
    case "SOMA":
    case "PERCENTUAL":        return `=SOMA(${rangeRef})`
    case "MEDIA":
    case "MEDIA_PONDERADA":   return `=MÉDIA(${rangeRef})`
    case "MAX":               return `=MÁXIMO(${rangeRef})`
    case "MIN":               return `=MÍNIMO(${rangeRef})`
    case "MEDIANA":           return `=MED(${rangeRef})`
    default:                  return `=MÉDIA(${rangeRef})`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK STATE  (single combined state to avoid nested-setState duplication)
// ─────────────────────────────────────────────────────────────────────────────

type HookState = {
  roster: { id: string; name: string }[]
  categories: Category[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useCategories() {
  // Single combined state — prevents React StrictMode from running
  // setCategories inside a setRoster updater, which caused duplication.
  const [state, setState] = useState<HookState>({ roster: [], categories: [] })
  const { roster, categories } = state

  // Color index stored in a ref so it survives re-renders but is stable
  const colorIndexRef = useRef(0)
  const nextColor = () => _getColorForIndex(colorIndexRef.current++)

  // Convenience updaters
  const setRoster     = useCallback((fn: (r: HookState["roster"])     => HookState["roster"])     => setState(s => ({ ...s, roster:     fn(s.roster)     })), [])
  const setCategories = useCallback((fn: (c: HookState["categories"]) => HookState["categories"]) => setState(s => ({ ...s, categories: fn(s.categories) })), [])

  // ── Category management ───────────────────────────────────────────────────

  const addCategory = useCallback((name: string, operation: OperationType = "MEDIA") => {
    const catId = generateId()
    const color = nextColor()
    // Single setState call — reads roster from current state snapshot, no nesting
    setState(prev => {
      const items: CategoryItem[] = prev.roster.map(r => ({
        id: r.id, name: r.name, value: 0, rawValueInput: "0",
      }))
      const cat: Category = {
        id: catId, name, color, operation,
        items, subDivisions: [], subDivisionValues: {},
        useSubDivisions: false, comparisons: [],
        logic: { ...DEFAULT_LOGIC },
      }
      return { ...prev, categories: [...prev.categories, cat] }
    })
    return catId
  }, [])

  /**
   * Creates a category with subDivisions, logicPatch and comparisons in ONE setState call.
   * Use this for templates so everything is applied atomically without race conditions.
   */
  const addCategoryFull = useCallback((
    name: string,
    operation: OperationType,
    subDivisions: Omit<SubDivision, "id">[],
    logicPatch: Partial<CategoryLogic>,
    comparisons: Omit<ExternalComparison, "id">[],
  ) => {
    const catId = generateId()
    const color = nextColor()
    setState(prev => {
      const items: CategoryItem[] = prev.roster.map(r => ({
        id: r.id, name: r.name, value: 0, rawValueInput: "0",
      }))
      const builtSds: SubDivision[] = subDivisions.map(sd => ({ ...sd, id: generateId() }))
      const builtComps: ExternalComparison[] = comparisons.map(c => ({ ...c, id: generateId() }))
      const cat: Category = {
        id: catId, name, color, operation,
        items,
        subDivisions: builtSds,
        subDivisionValues: {},
        useSubDivisions: builtSds.length > 0,
        comparisons: builtComps,
        logic: { ...DEFAULT_LOGIC, ...logicPatch },
      }
      return { ...prev, categories: [...prev.categories, cat] }
    })
    return catId
  }, [])

  const removeCategory = useCallback((id: string) =>
    setCategories(p => p.filter(c => c.id !== id)), [])

  const renameCategory = useCallback((id: string, name: string) =>
    setCategories(p => p.map(c => c.id === id ? { ...c, name } : c)), [])

  const setOperation = useCallback((id: string, operation: OperationType) =>
    setCategories(p => p.map(c => c.id === id ? { ...c, operation } : c)), [])

  const updateLogic = useCallback((categoryId: string, patch: Partial<CategoryLogic>) =>
    setCategories(p => p.map(c =>
      c.id === categoryId ? { ...c, logic: { ...c.logic, ...patch } } : c
    )), [])

  // Apply a logic patch to ALL categories (e.g. nota máxima global, arredondamento global)
  const updateGlobalLogic = useCallback((patch: Partial<CategoryLogic>) =>
    setCategories(p => p.map(c => ({ ...c, logic: { ...c.logic, ...patch } }))), [])

  const updateBands = useCallback((categoryId: string, bands: GradeBand[]) =>
    setCategories(p => p.map(c =>
      c.id === categoryId ? { ...c, logic: { ...c.logic, bands } } : c
    )), [])

  const applyScalePreset = useCallback((categoryId: string, scaleType: ScaleType) => {
    const preset = SCALE_PRESETS[scaleType]
    setCategories(p => p.map(c =>
      c.id === categoryId ? {
        ...c,
        logic: {
          ...c.logic, scaleType,
          maxScore: preset.maxScore,
          normaliseTarget: preset.normaliseTarget,
          bands: preset.bands.map(b => ({ ...b, id: generateId() })),
          useBands: preset.bands.length > 0,
          normalise: scaleType !== "custom",
        },
      } : c
    ))
  }, [])

  // ── Items — global roster sync ────────────────────────────────────────────
  // addItem: adds student to roster (if new) + to every category.
  // The value/raw only applies to the target categoryId; others get 0.
  const addItem = useCallback((categoryId: string, name: string, rawValueInput: string) => {
    const { values, isMultiple } = parseValueInput(rawValueInput)
    const trimmedName = name.trim()

    // Single combined setState — no nested calls, safe in StrictMode
    setState(prev => {
      const existing = prev.roster.find(
        r => r.name.trim().toLowerCase() === trimmedName.toLowerCase()
      )

      if (existing) {
        // Already in roster — just update value in target category
        return {
          ...prev,
          categories: prev.categories.map(cat => {
            if (cat.id !== categoryId) return cat
            return {
              ...cat,
              items: cat.items.map(i => i.id !== existing.id ? i : {
                ...i,
                value: values[0] ?? 0,
                rawValueInput,
                values: isMultiple ? values : undefined,
              }),
            }
          }),
        }
      }

      // New student — add to roster + all categories
      const newId = generateId()
      return {
        roster: [...prev.roster, { id: newId, name: trimmedName }],
        categories: prev.categories.map(cat => {
          const isTarget = cat.id === categoryId
          const item: CategoryItem = {
            id: newId, name: trimmedName,
            value:         isTarget ? (values[0] ?? 0) : 0,
            rawValueInput: isTarget ? rawValueInput     : "0",
            values:        isTarget && isMultiple ? values : undefined,
          }
          return { ...cat, items: [...cat.items, item] }
        }),
      }
    })
  }, [])

  // removeItem: removes student from roster AND all categories
  const removeItem = useCallback((_categoryId: string, itemId: string) => {
    setState(prev => ({
      roster: prev.roster.filter(r => r.id !== itemId),
      categories: prev.categories.map(cat => {
        const newSdv = { ...cat.subDivisionValues }
        Object.keys(newSdv).forEach(sdId => {
          const row = { ...newSdv[sdId] }; delete row[itemId]; newSdv[sdId] = row
        })
        return { ...cat, items: cat.items.filter(i => i.id !== itemId), subDivisionValues: newSdv }
      }),
    }))
  }, [])

  const updateItem = useCallback((
    categoryId: string,
    itemId: string,
    updates: Partial<Pick<CategoryItem, "name" | "value" | "rawValueInput" | "absent" | "exempt" | "tags">>,
  ) => {
    if (updates.name !== undefined) {
      // Rename → propagate to roster + all categories (single setState)
      setState(prev => ({
        roster: prev.roster.map(r => r.id === itemId ? { ...r, name: updates.name! } : r),
        categories: prev.categories.map(cat => ({
          ...cat,
          items: cat.items.map(i => {
            if (i.id !== itemId) return i
            if (cat.id !== categoryId) return { ...i, name: updates.name! }
            const raw = updates.rawValueInput ?? i.rawValueInput ?? ""
            const { values, isMultiple } = parseValueInput(raw)
            return { ...i, ...updates, value: values[0] ?? i.value, values: isMultiple ? values : undefined }
          }),
        })),
      }))
    } else {
      // Value/absent/exempt change — only this category
      setCategories(p => p.map(c => c.id !== categoryId ? c : {
        ...c,
        items: c.items.map(i => {
          if (i.id !== itemId) return i
          const raw = updates.rawValueInput ?? i.rawValueInput ?? ""
          const { values, isMultiple } = parseValueInput(raw)
          return { ...i, ...updates, value: values[0] ?? i.value, values: isMultiple ? values : undefined }
        }),
      }))
    }
  }, [])

  // ── SubDivisions ─────────────────────────────────────────────────────────
  const toggleSubDivisions = useCallback((categoryId: string, enabled: boolean) =>
    setCategories(p => p.map(c =>
      c.id === categoryId ? { ...c, useSubDivisions: enabled } : c
    )), [])

  const addSubDivision = useCallback((categoryId: string, name: string) => {
    const sd: SubDivision = { id: generateId(), name, weight: 1 }
    setCategories(p => p.map(c =>
      c.id === categoryId
        ? { ...c, subDivisions: [...c.subDivisions, sd], useSubDivisions: true }
        : c
    ))
    return sd.id
  }, [])

  const removeSubDivision = useCallback((categoryId: string, sdId: string) => {
    setCategories(p => p.map(c => {
      if (c.id !== categoryId) return c
      const newSdv = { ...c.subDivisionValues }
      delete newSdv[sdId]
      return { ...c, subDivisions: c.subDivisions.filter(sd => sd.id !== sdId), subDivisionValues: newSdv }
    }))
  }, [])

  const renameSubDivision = useCallback((categoryId: string, sdId: string, name: string) =>
    setCategories(p => p.map(c =>
      c.id === categoryId
        ? { ...c, subDivisions: c.subDivisions.map(sd => sd.id === sdId ? { ...sd, name } : sd) }
        : c
    )), [])

  const updateSubDivision = useCallback((categoryId: string, sdId: string, updates: Partial<SubDivision>) =>
    setCategories(p => p.map(c =>
      c.id === categoryId
        ? { ...c, subDivisions: c.subDivisions.map(sd => sd.id === sdId ? { ...sd, ...updates } : sd) }
        : c
    )), [])

  const setSubDivisionValue = useCallback((
    categoryId: string, sdId: string, itemId: string, value: number | string | null,
  ) => {
    setCategories(p => p.map(c => {
      if (c.id !== categoryId) return c
      const sdRow = { ...(c.subDivisionValues[sdId] ?? {}) }
      if (value === null || value === "") delete sdRow[itemId]
      else sdRow[itemId] = value
      return { ...c, subDivisionValues: { ...c.subDivisionValues, [sdId]: sdRow } }
    }))
  }, [])

  // ── Comparisons ──────────────────────────────────────────────────────────
  const addComparison = useCallback((
    categoryId: string, label: string, refValue: number,
    operator: ComparisonOperator = ">=",
    scope: ComparisonScope = "each",
    labelTrue = "Sim", labelFalse = "Não",
    colorPass = "#16a34a", colorFail = "#dc2626",
  ) => {
    const comp: ExternalComparison = {
      id: generateId(), label, refValue, operator, scope,
      labelTrue, labelFalse, colorPass, colorFail,
    }
    setCategories(p => p.map(c =>
      c.id === categoryId ? { ...c, comparisons: [...c.comparisons, comp] } : c
    ))
  }, [])

  const updateComparison = useCallback((
    categoryId: string, compId: string, updates: Partial<ExternalComparison>,
  ) =>
    setCategories(p => p.map(c =>
      c.id === categoryId
        ? { ...c, comparisons: c.comparisons.map(comp => comp.id === compId ? { ...comp, ...updates } : comp) }
        : c
    )), [])

  const removeComparison = useCallback((categoryId: string, compId: string) =>
    setCategories(p => p.map(c =>
      c.id === categoryId
        ? { ...c, comparisons: c.comparisons.filter(comp => comp.id !== compId) }
        : c
    )), [])

  const getResult = useCallback((categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat ? computeCategoryResult(cat) : null
  }, [categories])

  return {
    roster,
    categories,
    addCategory, addCategoryFull, removeCategory, renameCategory, setOperation,
    updateLogic, updateGlobalLogic, updateBands, applyScalePreset,
    addItem, removeItem, updateItem,
    toggleSubDivisions, addSubDivision, removeSubDivision,
    renameSubDivision, updateSubDivision, setSubDivisionValue,
    addComparison, updateComparison, removeComparison,
    getResult,
  }
}