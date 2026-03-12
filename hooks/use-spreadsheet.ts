"use client"

import { useState, useCallback, useRef } from "react"

export const ROWS = 200
export const COLS = 52

// ── Types ─────────────────────────────────────────────────────────────────────
export type CellStyle = {
  bold: boolean; italic: boolean; underline: boolean
  align: "left" | "center" | "right"
  fontSize: number; bgColor: string; textColor: string
}

export type EmbeddedChart = {
  id: string
  svgContent: string   // full <svg>…</svg> string
  title: string
  anchorRow: number
  anchorCol: number
  spanRows: number     // visual height in rows (default 14)
  spanCols: number     // visual width in cols (default 7)
}

export type CellData = {
  formula: string
  value: string
  style: CellStyle
  chartAnchor?: string   // chart id if this cell is the top-left anchor
}

const DEFAULT_STYLE: CellStyle = {
  bold: false, italic: false, underline: false,
  align: "left", fontSize: 13, bgColor: "", textColor: "",
}

// ── Column helpers ────────────────────────────────────────────────────────────
export function colIndexToLetter(idx: number): string {
  let s = ""; let n = idx + 1
  while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26) }
  return s
}
export function colLetterToIndex(s: string): number {
  let n = 0
  for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

// ── Formula Engine (PT-BR + EN, 60+ functions) ───────────────────────────────
type CellReader = (row: number, col: number) => string

function parseCellRef(ref: string) {
  const m = ref.trim().match(/^\$?([A-Za-z]+)\$?(\d+)$/)
  if (!m) return null
  return { col: colLetterToIndex(m[1]), row: parseInt(m[2]) - 1 }
}
function rangeToNums(arg: string, read: CellReader): number[] {
  const parts = arg.trim().split(":")
  if (parts.length === 1) {
    const c = parseCellRef(parts[0]); if (!c) return []
    const v = parseFloat(read(c.row, c.col)); return isNaN(v) ? [] : [v]
  }
  const s = parseCellRef(parts[0]), e = parseCellRef(parts[1])
  if (!s || !e) return []
  const nums: number[] = []
  for (let r = Math.min(s.row, e.row); r <= Math.max(s.row, e.row); r++)
    for (let c = Math.min(s.col, e.col); c <= Math.max(s.col, e.col); c++) {
      const v = parseFloat(read(r, c)); if (!isNaN(v)) nums.push(v)
    }
  return nums
}
function rangeToStrings(arg: string, read: CellReader): string[] {
  const parts = arg.trim().split(":")
  if (parts.length === 1) {
    const c = parseCellRef(parts[0]); if (!c) return []; return [read(c.row, c.col)]
  }
  const s = parseCellRef(parts[0]), e = parseCellRef(parts[1])
  if (!s || !e) return []
  const out: string[] = []
  for (let r = Math.min(s.row, e.row); r <= Math.max(s.row, e.row); r++)
    for (let c = Math.min(s.col, e.col); c <= Math.max(s.col, e.col); c++)
      out.push(read(r, c))
  return out
}
function splitArgs(s: string): string[] {
  const args: string[] = []; let depth = 0; let cur = ""
  for (const ch of s) {
    if (ch === "(") depth++; else if (ch === ")") depth--
    else if ((ch === ";" || ch === ",") && depth === 0) { args.push(cur.trim()); cur = ""; continue }
    cur += ch
  }
  if (cur.trim()) args.push(cur.trim()); return args
}
function parseCriterion(crit: string): (v: string) => boolean {
  const s = crit.replace(/^["']|["']$/g, "").trim()
  const m = s.match(/^([><=!]{1,2})\s*(-?[\d.]+)$/)
  if (m) {
    const [, op, ns] = m; const n = parseFloat(ns)
    return v => {
      const x = parseFloat(v); if (isNaN(x)) return false
      if (op === ">") return x > n; if (op === ">=") return x >= n
      if (op === "<") return x < n; if (op === "<=") return x <= n
      if (op === "=" || op === "==") return x === n
      if (op === "<>" || op === "!=") return x !== n; return false
    }
  }
  const lower = s.toLowerCase(); return v => v.trim().toLowerCase() === lower
}
const meanOf = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
const medianOf = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m] }
const modeOf = (v: number[]) => { const f: Record<number, number> = {}; v.forEach(x => { f[x] = (f[x] ?? 0) + 1 }); return +Object.entries(f).sort((a, b) => b[1] - a[1])[0][0] }
const stddevOf = (v: number[], sample = true) => { if (v.length < 2) return 0; const m = meanOf(v); return Math.sqrt(v.map(x => (x - m) ** 2).reduce((a, b) => a + b, 0) / (sample ? v.length - 1 : v.length)) }
const varOf = (v: number[], sample = true) => { if (v.length < 2) return 0; const m = meanOf(v); return v.map(x => (x - m) ** 2).reduce((a, b) => a + b, 0) / (sample ? v.length - 1 : v.length) }
function percentileOf(v: number[], p: number) { const s = [...v].sort((a, b) => a - b); const idx = (p / 100) * (s.length - 1); const lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo) }
function erf(x: number) { const t = 1 / (1 + 0.5 * Math.abs(x)); const tau = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087294))))))))); return x >= 0 ? 1 - tau : tau - 1 }

function evalExpr(expr: string, read: CellReader, depth = 0): number | string | null {
  if (depth > 20) return null
  const t = expr.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1)
  const cr = parseCellRef(t); if (cr) { const v = read(cr.row, cr.col); const n = parseFloat(v); return isNaN(n) ? v : n }
  const fnm = t.match(/^([A-Za-zÀ-ÿ_.]+)\s*\(([\s\S]*)\)$/)
  if (fnm) return callFn(fnm[1].toUpperCase(), fnm[2], read, depth)
  const n = parseFloat(t); if (!isNaN(n)) return n
  // Arithmetic with cell refs
  const withNums = t.replace(/\$?[A-Za-z]+\$?\d+/g, m => { const c = parseCellRef(m); if (!c) return "0"; const v = parseFloat(read(c.row, c.col)); return isNaN(v) ? "0" : String(v) })
  if (/^[\d\s+\-*/%().]+$/.test(withNums)) { try { return Function(`"use strict";return(${withNums})`)() as number } catch { return null } }
  return null
}

function callFn(name: string, argsRaw: string, read: CellReader, depth: number): number | string | null {
  const args = splitArgs(argsRaw)
  const nums = () => args.flatMap(a => rangeToNums(a, read))
  const e = (i: number) => evalExpr(args[i] ?? "", read, depth + 1)
  // Normalize accented names
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  switch (n) {
    // Aggregation
    case "SOMA": case "SUM":          return nums().reduce((a, b) => a + b, 0)
    case "MEDIA": case "AVERAGE":     { const v = nums(); return v.length ? meanOf(v) : null }
    case "MED": case "MEDIAN":        { const v = nums(); return v.length ? medianOf(v) : null }
    case "MODO": case "MODE":         { const v = nums(); return v.length ? modeOf(v) : null }
    case "MAXIMO": case "MAX":        { const v = nums(); return v.length ? Math.max(...v) : null }
    case "MINIMO": case "MIN":        { const v = nums(); return v.length ? Math.min(...v) : null }
    case "DESVPAD": case "STDEV": case "STDEV.S":  return stddevOf(nums(), true)
    case "DESVPAD.P": case "DESVPADP": case "STDEV.P": return stddevOf(nums(), false)
    case "VAR": case "VAR.S":         return varOf(nums(), true)
    case "VAR.P": case "VARP":        return varOf(nums(), false)
    case "AMPLITUDE":                 { const v = nums(); return v.length ? Math.max(...v) - Math.min(...v) : null }
    case "PERCENTIL": case "PERCENTILE": { const v = rangeToNums(args[0] ?? "", read); const p = parseFloat(args[1] ?? "50"); return v.length && !isNaN(p) ? percentileOf(v, p) : null }
    case "QUARTIL": case "QUARTILE":  { const v = rangeToNums(args[0] ?? "", read); const map: Record<number, number> = { 0: 0, 1: 25, 2: 50, 3: 75, 4: 100 }; const qi = parseInt(args[1] ?? "2"); return v.length && map[qi] !== undefined ? percentileOf(v, map[qi]) : null }
    case "MAIOR": case "LARGE":       { const v = rangeToNums(args[0] ?? "", read).sort((a, b) => b - a); const k = parseInt(args[1] ?? "1"); return v[k - 1] ?? null }
    case "MENOR": case "SMALL":       { const v = rangeToNums(args[0] ?? "", read).sort((a, b) => a - b); const k = parseInt(args[1] ?? "1"); return v[k - 1] ?? null }
    case "CLASSIFICACAO": case "RANK": case "RANK.EQ": { const val = e(0); const rv = rangeToNums(args[1] ?? "", read).sort((a, b) => b - a); return typeof val === "number" ? rv.indexOf(val) + 1 : null }
    // Counting
    case "CONT.VALORES": case "COUNTA": return args.flatMap(a => rangeToStrings(a, read)).filter(v => v.trim() !== "").length
    case "CONT.NUM": case "COUNT":    return args.flatMap(a => rangeToStrings(a, read)).filter(v => !isNaN(parseFloat(v))).length
    case "CONTAR.VAZIO": case "COUNTBLANK": return args.flatMap(a => rangeToStrings(a, read)).filter(v => v.trim() === "").length
    case "CONT.SE": case "COUNTIF":   if (args.length < 2) return null; return rangeToStrings(args[0], read).filter(parseCriterion(args[1])).length
    case "CONT.SES": case "COUNTIFS": {
      if (args.length < 2 || args.length % 2 !== 0) return null
      const base = rangeToStrings(args[0], read)
      const pairs = []; for (let i = 0; i < args.length; i += 2) pairs.push({ vals: rangeToStrings(args[i], read), fn: parseCriterion(args[i + 1]) })
      return base.filter((_, i) => pairs.every((p: any) => p.fn(p.vals[i] ?? ""))).length
    }
    // Conditional aggregation
    case "SOMASE": case "SUMIF": {
      if (args.length < 2) return null
      const rng = rangeToStrings(args[0], read), crit = parseCriterion(args[1]), sums = args[2] ? rangeToNums(args[2], read) : rangeToNums(args[0], read)
      return rng.reduce((s, v, i) => crit(v) ? s + (sums[i] ?? 0) : s, 0)
    }
    case "SOMASES": case "SUMIFS": {
      if (args.length < 3) return null
      const sv = rangeToNums(args[0], read); const pairs2: any[] = []; for (let i = 1; i < args.length; i += 2) pairs2.push({ vals: rangeToStrings(args[i], read), fn: parseCriterion(args[i + 1]) })
      return sv.reduce((s, v, i) => pairs2.every((p: any) => p.fn(p.vals[i] ?? "")) ? s + v : s, 0)
    }
    case "MEDIASE": case "AVERAGEIF": {
      if (args.length < 2) return null
      const rv = rangeToNums(args[0], read), crit2 = parseCriterion(args[1]), sv2 = args[2] ? rangeToNums(args[2], read) : rv
      const m = rv.map((_, i) => crit2(String(rv[i])) ? sv2[i] : null).filter((v): v is number => v !== null)
      return m.length ? meanOf(m) : null
    }
    case "MEDIASES": case "AVERAGEIFS": {
      if (args.length < 3) return null
      const av = rangeToNums(args[0], read); const pairs3: any[] = []; for (let i = 1; i < args.length; i += 2) pairs3.push({ vals: rangeToStrings(args[i], read), fn: parseCriterion(args[i + 1]) })
      const matched = av.filter((_, i) => pairs3.every((p: any) => p.fn(p.vals[i] ?? "")))
      return matched.length ? meanOf(matched) : null
    }
    case "MAXSE": case "MAXIFS": {
      const mv = rangeToNums(args[0], read); const pc: any[] = []; for (let i = 1; i < args.length; i += 2) pc.push({ vals: rangeToStrings(args[i], read), fn: parseCriterion(args[i + 1]) })
      const filtered = mv.filter((_, i) => pc.every((p: any) => p.fn(p.vals[i] ?? "")))
      return filtered.length ? Math.max(...filtered) : null
    }
    case "MINSE": case "MINIFS": {
      const mv2 = rangeToNums(args[0], read); const pc2: any[] = []; for (let i = 1; i < args.length; i += 2) pc2.push({ vals: rangeToStrings(args[i], read), fn: parseCriterion(args[i + 1]) })
      const filtered2 = mv2.filter((_, i) => pc2.every((p: any) => p.fn(p.vals[i] ?? "")))
      return filtered2.length ? Math.min(...filtered2) : null
    }
    // Math
    case "ABS":                return typeof e(0) === "number" ? Math.abs(e(0) as number) : null
    case "RAIZ": case "SQRT":  return typeof e(0) === "number" ? Math.sqrt(e(0) as number) : null
    case "ARRED": case "ROUND": { const v = e(0), d = parseInt(args[1] ?? "0"); return typeof v === "number" ? Math.round(v * 10 ** d) / 10 ** d : null }
    case "ARREDONDAR.PARA.CIMA": case "ROUNDUP": { const v = e(0), d2 = parseInt(args[1] ?? "0"); return typeof v === "number" ? Math.ceil(v * 10 ** d2) / 10 ** d2 : null }
    case "ARREDONDAR.PARA.BAIXO": case "ROUNDDOWN": { const v = e(0), d3 = parseInt(args[1] ?? "0"); return typeof v === "number" ? Math.floor(v * 10 ** d3) / 10 ** d3 : null }
    case "INT": case "TRUNCAR": case "TRUNC": { const v = e(0); return typeof v === "number" ? Math.trunc(v) : null }
    case "TETO": case "CEILING": { const v = e(0); return typeof v === "number" ? Math.ceil(v) : null }
    case "PISO": case "FLOOR":   { const v = e(0); return typeof v === "number" ? Math.floor(v) : null }
    case "POTENCIA": case "POWER": { const b = e(0), ex = e(1); return typeof b === "number" && typeof ex === "number" ? Math.pow(b, ex) : null }
    case "LOG":    { const v = e(0), base = args[1] ? parseFloat(args[1]) : 10; return typeof v === "number" ? Math.log(v) / Math.log(base) : null }
    case "LOG10":  { const v = e(0); return typeof v === "number" ? Math.log10(v) : null }
    case "LN":     { const v = e(0); return typeof v === "number" ? Math.log(v) : null }
    case "EXP":    { const v = e(0); return typeof v === "number" ? Math.exp(v) : null }
    case "MOD":    { const a = e(0), b = e(1); return typeof a === "number" && typeof b === "number" ? a % b : null }
    case "PI":     return Math.PI
    case "SINAL": case "SIGN": { const v = e(0); return typeof v === "number" ? Math.sign(v) : null }
    case "FATORIAL": case "FACT": { const v = e(0); if (typeof v !== "number" || v < 0) return null; let f = 1; for (let i = 2; i <= v; i++) f *= i; return f }
    case "COMBINACAO": case "COMBIN": { const nn = e(0), kk = e(1); if (typeof nn !== "number" || typeof kk !== "number") return null; let r = 1; for (let i = 0; i < kk; i++) { r = r * (nn - i) / (i + 1) } return Math.round(r) }
    case "ALEATORIO": case "RAND": return Math.random()
    case "ALEA.ENTRE": case "RANDBETWEEN": { const lo = e(0), hi = e(1); return typeof lo === "number" && typeof hi === "number" ? Math.floor(Math.random() * (hi - lo + 1)) + lo : null }
    // Statistics
    case "PADRONIZAR": case "STANDARDIZE": { const x = e(0), m2 = e(1), s = e(2); return typeof x === "number" && typeof m2 === "number" && typeof s === "number" && s !== 0 ? (x - m2) / s : null }
    case "CORRELACAO": case "CORREL": {
      const x = rangeToNums(args[0] ?? "", read), y = rangeToNums(args[1] ?? "", read)
      if (x.length !== y.length || x.length < 2) return null
      const mx = meanOf(x), my = meanOf(y)
      const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0)
      const den = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0) * y.reduce((s, yi) => s + (yi - my) ** 2, 0))
      return den === 0 ? null : num / den
    }
    case "COVAR": case "COVARIANCE.S": case "COVARIANCE.P": {
      const x = rangeToNums(args[0] ?? "", read), y = rangeToNums(args[1] ?? "", read)
      if (x.length !== y.length || x.length < 2) return null
      const mx = meanOf(x), my = meanOf(y), nn = x.length
      return x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / (n.includes(".P") ? nn : nn - 1)
    }
    case "DIST.NORM": case "NORMDIST": case "NORM.DIST": {
      const x = e(0), m3 = e(1), s2 = e(2); if (typeof x !== "number" || typeof m3 !== "number" || typeof s2 !== "number") return null
      const z = (x - m3) / s2; return 0.5 * (1 + erf(z / Math.SQRT2))
    }
    case "INV.NORM": case "NORMINV": case "NORM.INV": {
      const p2 = e(0), m4 = e(1), s3 = e(2); if (typeof p2 !== "number" || typeof m4 !== "number" || typeof s3 !== "number") return null
      // Rational approx
      const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637]
      const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833]
      const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209, 0.0276438810333863, 0.0038405729373609, 0.0003951896511349, 0.0000321767881768, 0.0000002888167364, 0.0000003960315187]
      const q = p2 - 0.5; let r
      if (Math.abs(q) <= 0.42) { r = q * q; r = q * (((a[3]*r+a[2])*r+a[1])*r+a[0]) / ((((b[3]*r+b[2])*r+b[1])*r+b[0])*r+1) }
      else { r = p2 < 0.5 ? p2 : 1 - p2; r = Math.sqrt(-Math.log(r)); r = (((((((c[8]*r+c[7])*r+c[6])*r+c[5])*r+c[4])*r+c[3])*r+c[2])*r+c[1])*r+c[0]; if (q < 0) r = -r }
      return m4 + s3 * r
    }
    case "PORCENTAGEM": case "PERCENTUAL": { const v = e(0), t = e(1); return typeof v === "number" && typeof t === "number" && t !== 0 ? (v / t) * 100 : null }
    case "VARIACAO": { const old = e(0), nw = e(1); return typeof old === "number" && typeof nw === "number" && old !== 0 ? ((nw - old) / Math.abs(old)) * 100 : null }
    // Logical
    case "SE": case "IF": { const cond = e(0); return (typeof cond === "number" ? cond !== 0 : Boolean(cond)) ? e(1) : e(2) }
    case "SEERRO": case "IFERROR": { try { const v = e(0); return v !== null ? v : e(1) } catch { return e(1) } }
    case "EVITAR.ERRO": case "IFNA": { try { const v = e(0); return v === "#N/D" ? e(1) : v } catch { return e(1) } }
    case "OU": case "OR": return args.some(a => { const v = evalExpr(a, read, depth + 1); return typeof v === "number" ? v !== 0 : Boolean(v) }) ? 1 : 0
    case "E": case "AND": return args.every(a => { const v = evalExpr(a, read, depth + 1); return typeof v === "number" ? v !== 0 : Boolean(v) }) ? 1 : 0
    case "NAO": case "NOT": { const v = e(0); return typeof v === "number" ? (v === 0 ? 1 : 0) : null }
    case "XOU": case "XOR": { let t2 = false; args.forEach(a => { const v = evalExpr(a, read, depth + 1); if (typeof v === "number" ? v !== 0 : Boolean(v)) t2 = !t2 }); return t2 ? 1 : 0 }
    case "ESCOLHER": case "CHOOSE": { const idx2 = e(0); return typeof idx2 === "number" ? e(Math.round(idx2)) : null }
    case "PROCV": case "VLOOKUP": {
      const val = e(0), col2 = parseInt(args[2] ?? "1")
      const rows2 = rangeToStrings(args[1] ?? "", read)
      const ncols2 = (() => { const p = args[1]?.trim().split(":"); if (!p || p.length < 2) return 1; const s2 = parseCellRef(p[0]), e2 = parseCellRef(p[1]); return s2 && e2 ? Math.abs(e2.col - s2.col) + 1 : 1 })()
      for (let i = 0; i < rows2.length; i += ncols2) {
        if (String(rows2[i]).toLowerCase() === String(val).toLowerCase()) return rows2[i + col2 - 1] ?? null
      }; return "#N/D"
    }
    // Text
    case "CONCATENAR": case "CONCAT": return args.map((_, i) => { const r = e(i); return r !== null ? String(r) : "" }).join("")
    case "MAIUSCULA": case "UPPER": { const v = e(0); return v !== null ? String(v).toUpperCase() : null }
    case "MINUSCULA": case "LOWER": { const v = e(0); return v !== null ? String(v).toLowerCase() : null }
    case "PRI.MAIUSCULA": case "PROPER": { const v = e(0); return v !== null ? String(v).replace(/\b\w/g, c => c.toUpperCase()) : null }
    case "NUM.CARACT": case "LEN": { const v = e(0); return v !== null ? String(v).length : null }
    case "ARRUMAR": case "TRIM": { const v = e(0); return v !== null ? String(v).trim() : null }
    case "ESQUERDA": case "LEFT": { const v = e(0), n2 = parseInt(args[1] ?? "1"); return v !== null ? String(v).slice(0, n2) : null }
    case "DIREITA": case "RIGHT": { const v = e(0), n3 = parseInt(args[1] ?? "1"); return v !== null ? String(v).slice(-n3) : null }
    case "EXT.TEXTO": case "MID": { const v = e(0), start2 = parseInt(args[1] ?? "1") - 1, len2 = parseInt(args[2] ?? "1"); return v !== null ? String(v).slice(start2, start2 + len2) : null }
    case "SUBSTITUIR": case "SUBSTITUTE": { const v = e(0), old2 = e(1), new2 = e(2); return v !== null && old2 !== null && new2 !== null ? String(v).replaceAll(String(old2), String(new2)) : null }
    case "LOCALIZAR": case "FIND": { const needle = e(0), hay = e(1); if (needle === null || hay === null) return null; const i = String(hay).toLowerCase().indexOf(String(needle).toLowerCase()); return i === -1 ? "#VALOR!" : i + 1 }
    case "TEXTO": case "TEXT": { const v = e(0); return v !== null ? String(v) : null }
    case "VALOR": case "VALUE": { const v = e(0); if (v === null) return null; const num = parseFloat(String(v)); return isNaN(num) ? null : num }
    case "REPT": case "REPETIR": { const v = e(0), t3 = parseInt(args[1] ?? "1"); return v !== null ? String(v).repeat(t3) : null }
    case "NULO": case "NA": return "#N/D"
    default: return null
  }
}

export function evaluateFormula(raw: string, read: CellReader): string {
  if (!raw.trim().startsWith("=")) return raw
  try {
    const result = evalExpr(raw.trim().slice(1).trim(), read)
    if (result === null) return "#ERRO!"
    if (typeof result === "number") { if (isNaN(result)) return "#NÚM!"; if (!isFinite(result)) return "#DIV/0!"; return String(Math.round(result * 1e10) / 1e10) }
    return String(result)
  } catch { return "#ERRO!" }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
type CellMap = Record<string, CellData>
const cellKey = (r: number, c: number) => `${r}:${c}`
const newCell = (): CellData => ({ formula: "", value: "", style: { ...DEFAULT_STYLE } })

export function useSpreadsheet() {
  const [cells, setCells]   = useState<CellMap>({})
  const [charts, setCharts] = useState<EmbeddedChart[]>([])
  const [selectedCell, setSelectedCell]     = useState<{ row: number; col: number } | null>(null)
  const [selectionRange, setSelectionRange] = useState<{ start: { row: number; col: number }; end: { row: number; col: number } } | null>(null)
  const [editingCell, setEditingCell]       = useState<{ row: number; col: number } | null>(null)
  const histRef  = useRef<CellMap[]>([])
  const futRef   = useRef<CellMap[]>([])
  const clipRef  = useRef<{ value: string; style: CellStyle }[][]>([])

  const getCell = useCallback((r: number, c: number): CellData => cells[cellKey(r, c)] ?? newCell(), [cells])

  const makeReader = useCallback((snapshot: CellMap): CellReader => {
    const cache: Record<string, string> = {}
    const read = (r: number, c: number): string => {
      const k = cellKey(r, c); if (k in cache) return cache[k]
      const cell = snapshot[k]; if (!cell) return ""
      if (!cell.formula.startsWith("=")) { cache[k] = cell.formula; return cell.formula }
      cache[k] = "0"; const result = evaluateFormula(cell.formula, read); cache[k] = result; return result
    }; return read
  }, [])

  const recompute = useCallback((snap: CellMap): CellMap => {
    const read = makeReader(snap); const next: CellMap = {}
    for (const [k, cell] of Object.entries(snap)) next[k] = cell.formula.startsWith("=") ? { ...cell, value: read(...(k.split(":").map(Number) as [number, number])) } : { ...cell, value: cell.formula }
    return next
  }, [makeReader])

  const setCellValue = useCallback((r: number, c: number, v: string) => {
    setCells(prev => { histRef.current.push(prev); futRef.current = []; const k = cellKey(r, c); const ex = prev[k] ?? newCell(); return recompute({ ...prev, [k]: { ...ex, formula: v, value: v } }) })
  }, [recompute])

  const setCellStyle = useCallback((r: number, c: number, s: Partial<CellStyle>) => {
    setCells(prev => { const k = cellKey(r, c); const ex = prev[k] ?? newCell(); return { ...prev, [k]: { ...ex, style: { ...ex.style, ...s } } } })
  }, [])

  const setStyleForSelection = useCallback((s: Partial<CellStyle>) => {
    setCells(prev => {
      histRef.current.push(prev); futRef.current = []; const next = { ...prev }
      const apply = (r: number, c: number) => { const k = cellKey(r, c); const ex = prev[k] ?? newCell(); next[k] = { ...ex, style: { ...ex.style, ...s } } }
      if (selectionRange) { const { start, end } = selectionRange; for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) apply(r, c) }
      else if (selectedCell) apply(selectedCell.row, selectedCell.col)
      return next
    })
  }, [selectionRange, selectedCell])

  // ── Charts ────────────────────────────────────────────────────────────────
  const addChart = useCallback((chart: Omit<EmbeddedChart, "id">): string => {
    const id = Math.random().toString(36).slice(2, 9)
    const ec: EmbeddedChart = { ...chart, id }
    setCharts(prev => [...prev.filter(c => !(c.anchorRow === chart.anchorRow && c.anchorCol === chart.anchorCol)), ec])
    setCells(prev => { const k = cellKey(chart.anchorRow, chart.anchorCol); const ex = prev[k] ?? newCell(); return { ...prev, [k]: { ...ex, chartAnchor: id, value: `[Gráfico: ${chart.title}]`, formula: `[Gráfico: ${chart.title}]` } } })
    return id
  }, [])

  const removeChart = useCallback((id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id))
    setCells(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { if (next[k].chartAnchor === id) next[k] = { ...next[k], chartAnchor: undefined, value: "", formula: "" } }); return next })
  }, [])

  const undo = useCallback(() => { const p = histRef.current.pop(); if (p) setCells(c => { futRef.current.push(c); return p }) }, [])
  const redo = useCallback(() => { const n = futRef.current.pop(); if (n) setCells(c => { histRef.current.push(c); return n }) }, [])
  const copy = useCallback(() => {
    if (!selectionRange && !selectedCell) return
    const { start, end } = selectionRange ?? { start: selectedCell!, end: selectedCell! }
    const r1 = Math.min(start.row, end.row), r2 = Math.max(start.row, end.row), c1 = Math.min(start.col, end.col), c2 = Math.max(start.col, end.col)
    clipRef.current = []; for (let r = r1; r <= r2; r++) { const row = []; for (let c = c1; c <= c2; c++) { const cell = cells[cellKey(r, c)]; row.push({ value: cell?.formula ?? "", style: cell?.style ?? { ...DEFAULT_STYLE } }) }; clipRef.current.push(row) }
  }, [cells, selectionRange, selectedCell])
  const paste = useCallback(() => {
    if (!selectedCell || !clipRef.current.length) return
    setCells(prev => { histRef.current.push(prev); futRef.current = []; const next = { ...prev }; clipRef.current.forEach((row, ri) => row.forEach((cell, ci) => { const k = cellKey(selectedCell.row + ri, selectedCell.col + ci); const ex = prev[k] ?? newCell(); next[k] = { ...ex, formula: cell.value, value: cell.value, style: { ...cell.style } } })); return recompute(next) })
  }, [selectedCell, recompute])
  const deleteSelection = useCallback(() => {
    setCells(prev => { histRef.current.push(prev); futRef.current = []; const next = { ...prev }; const del = (r: number, c: number) => { const k = cellKey(r, c); if (prev[k]) next[k] = { ...prev[k], formula: "", value: "" } }; if (selectionRange) { const { start, end } = selectionRange; for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) del(r, c) } else if (selectedCell) del(selectedCell.row, selectedCell.col); return recompute(next) })
  }, [selectionRange, selectedCell, recompute])

  const getColLetter = useCallback((col: number) => colIndexToLetter(col), [])
  const getSelectedCellRef = useCallback(() => selectedCell ? `${getColLetter(selectedCell.col)}${selectedCell.row + 1}` : "", [selectedCell, getColLetter])
  const getSelectedValues = useCallback((): number[] => {
    if (!selectionRange && !selectedCell) return []
    const { start, end } = selectionRange ?? { start: selectedCell!, end: selectedCell! }
    const nums: number[] = []
    for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) { const v = parseFloat(cells[cellKey(r, c)]?.value ?? ""); if (!isNaN(v)) nums.push(v) }
    return nums
  }, [cells, selectionRange, selectedCell])
  const applyFunctionToSelection = useCallback((fn: string) => {
    if (!selectionRange && !selectedCell) return
    const { start, end } = selectionRange ?? { start: selectedCell!, end: selectedCell! }
    const r1 = Math.min(start.row, end.row), r2 = Math.max(start.row, end.row), c1 = Math.min(start.col, end.col), c2 = Math.max(start.col, end.col)
    const rangeRef = `${getColLetter(c1)}${r1 + 1}:${getColLetter(c2)}${r2 + 1}`
    let targetRow = r2 + 1; for (let r = r2 + 1; r < Math.min(ROWS, r2 + 50); r++) { if (!cells[cellKey(r, c1)]?.value) { targetRow = r; break } }
    setCellValue(targetRow, c1, `=${fn}(${rangeRef})`); setSelectedCell({ row: targetRow, col: c1 }); setSelectionRange(null)
  }, [selectionRange, selectedCell, getColLetter, cells, setCellValue, setSelectedCell, setSelectionRange])

  return {
    cells, charts, selectedCell, setSelectedCell, selectionRange, setSelectionRange,
    editingCell, setEditingCell, getCell, setCellValue, setCellStyle, setStyleForSelection,
    addChart, removeChart, undo, redo, copy, paste, deleteSelection,
    getColLetter, getSelectedCellRef, getSelectedValues, applyFunctionToSelection,
  }
}