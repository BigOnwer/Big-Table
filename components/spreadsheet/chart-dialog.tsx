"use client"

import { useState, useMemo, useCallback } from "react"
import { BarChart2, TrendingUp, PieChart as PieIcon, Activity, Circle, TableIcon, Info, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, ReferenceLine,
} from "recharts"
import type { Category } from "@/hooks/use-categories"
import { computeItemScores, computeCategoryResult, computeClassStats, evaluateComparison, gabaritoMatch } from "@/hooks/use-categories"

// ── Types ─────────────────────────────────────────────────────────────────────
type ChartType = "bar" | "line" | "area" | "pie" | "radar" | "scatter" | "histogram"

export type ChartDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: Category[]
  onInsertChart?: (svgContent: string, title: string, spanRows: number, spanCols: number) => void
  onInsertData?: (rows: string[][], label: string) => void
}

// ── Palette ───────────────────────────────────────────────────────────────────
const PAL = ["#2563eb","#dc2626","#ea580c","#9333ea","#0891b2","#ca8a04","#db2777","#65a30d","#0f766e","#7c3aed"]
const r = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

// ── SVG Generator (pure JS, no recharts — for embedding in grid) ──────────────
// Fully self-contained SVG so it renders correctly when injected as innerHTML
function buildSvg(
  type: "bar" | "line" | "pie" | "stacked" | "area",
  data: { name: string; value?: number; pass?: number; fail?: number; pct?: number }[],
  opts: { color?: string; title?: string; width?: number; height?: number; mean?: number; stddev?: number } = {}
): string {
  const W = opts.width ?? 560, H = opts.height ?? 300
  const pad = { t: 36, r: 20, b: 72, l: 50 }
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b
  const color = opts.color ?? "#2563eb"
  const titleSvg = opts.title
    ? `<text x="${W / 2}" y="20" text-anchor="middle" font-size="11" font-weight="bold" fill="#374151" font-family="system-ui,sans-serif">${opts.title.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</text>`
    : ""

  function yAxis(maxVal: number) {
    let svg = ""
    for (let t = 0; t <= 4; t++) {
      const v = (maxVal / 4) * t, y = r(pad.t + iH - (v / maxVal) * iH)
      svg += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="#f3f4f6" stroke-width="1"/>`
      svg += `<text x="${pad.l - 4}" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#9ca3af" font-family="system-ui,sans-serif">${r(v, 1)}</text>`
    }
    return svg
  }
  function axes() {
    return `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + iH}" stroke="#e5e7eb" stroke-width="1"/>
    <line x1="${pad.l}" y1="${pad.t + iH}" x2="${W - pad.r}" y2="${pad.t + iH}" stroke="#e5e7eb" stroke-width="1"/>`
  }
  function xLabel(x: number, name: string) {
    const safe = (name.length > 9 ? name.slice(0, 8) + "…" : name).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    return `<text x="${r(x)}" y="${pad.t + iH + 12}" text-anchor="end" transform="rotate(-38,${r(x)},${pad.t + iH + 12})" font-size="9" fill="#6b7280" font-family="system-ui,sans-serif">${safe}</text>`
  }

  if (type === "pie") {
    const total = data.reduce((s, d) => s + (d.value ?? 0), 0) || 1
    const cx = W * 0.42, cy = H * 0.5, rad = Math.min(iW, iH) * 0.42
    let angle = -Math.PI / 2, slices = "", legend = ""
    data.forEach((d, i) => {
      const slice = ((d.value ?? 0) / total) * 2 * Math.PI
      const x1 = cx + rad * Math.cos(angle), y1 = cy + rad * Math.sin(angle)
      angle += slice
      const x2 = cx + rad * Math.cos(angle), y2 = cy + rad * Math.sin(angle)
      const large = slice > Math.PI ? 1 : 0
      const mx = cx + rad * 0.65 * Math.cos(angle - slice / 2), my = cy + rad * 0.65 * Math.sin(angle - slice / 2)
      const pct = r((d.value ?? 0) / total * 100, 0)
      const col = PAL[i % PAL.length]
      if (slice > 0.001) slices += `<path d="M${r(cx)},${r(cy)} L${r(x1)},${r(y1)} A${r(rad)},${r(rad)} 0 ${large} 1 ${r(x2)},${r(y2)} Z" fill="${col}" stroke="white" stroke-width="1.5" opacity="0.9"/>`
      if (slice > 0.2) slices += `<text x="${r(mx)}" y="${r(my)}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="bold" fill="white" font-family="system-ui,sans-serif">${pct}%</text>`
      const lx = W * 0.87, ly = 44 + i * 17
      const ln = (d.name.length > 12 ? d.name.slice(0, 11) + "…" : d.name).replace(/&/g,"&amp;")
      legend += `<rect x="${lx - 10}" y="${ly - 7}" width="9" height="9" fill="${col}" rx="2"/>
      <text x="${lx + 2}" y="${ly + 1}" font-size="9" fill="#374151" font-family="system-ui,sans-serif">${ln}</text>`
    })
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;border-radius:8px;font-family:system-ui,sans-serif">${titleSvg}${slices}${legend}</svg>`
  }

  if (type === "stacked") {
    const maxVal = Math.max(...data.map(d => (d.pass ?? 0) + (d.fail ?? 0)), 1)
    const barW = Math.max(8, Math.min(52, iW / data.length - 6))
    const gap = (iW - barW * data.length) / (data.length + 1)
    let bars = "", xlabels = ""
    data.forEach((d, i) => {
      const x = r(pad.l + gap + i * (barW + gap))
      const pH = r(((d.pass ?? 0) / maxVal) * iH), fH = r(((d.fail ?? 0) / maxVal) * iH)
      const yBase = r(pad.t + iH)
      if (fH > 0) bars += `<rect x="${x}" y="${r(yBase - pH - fH)}" width="${barW}" height="${fH}" fill="#dc2626" rx="2" opacity="0.85"/>`
      if (pH > 0) bars += `<rect x="${x}" y="${r(yBase - pH)}" width="${barW}" height="${pH}" fill="#2563eb" rx="2" opacity="0.85"/>`
      const tot = (d.pass ?? 0) + (d.fail ?? 0) || 1
      bars += `<text x="${r(x + barW / 2)}" y="${r(yBase - pH - fH - 3)}" text-anchor="middle" font-size="9" fill="#374151" font-family="system-ui,sans-serif">${r((d.pass ?? 0) / tot * 100, 0)}%</text>`
      xlabels += xLabel(x + barW / 2, d.name)
    })
    const legend = `<rect x="${W - 85}" y="${pad.t + 4}" width="9" height="9" fill="#2563eb" rx="2"/>
    <text x="${W - 73}" y="${pad.t + 12}" font-size="9" fill="#374151" font-family="system-ui,sans-serif">Passou</text>
    <rect x="${W - 85}" y="${pad.t + 18}" width="9" height="9" fill="#dc2626" rx="2"/>
    <text x="${W - 73}" y="${pad.t + 26}" font-size="9" fill="#374151" font-family="system-ui,sans-serif">Não passou</text>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;border-radius:8px">${titleSvg}${yAxis(maxVal)}${axes()}${bars}${xlabels}${legend}</svg>`
  }

  // bar, line, area
  const maxVal = Math.max(...data.map(d => d.value ?? 0), 0.001) * 1.08
  const meanSvg = opts.mean !== undefined
    ? `<line x1="${pad.l}" y1="${r(pad.t + iH - (opts.mean / maxVal) * iH)}" x2="${W - pad.r}" y2="${r(pad.t + iH - (opts.mean / maxVal) * iH)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5,3"/>
    <text x="${W - pad.r + 2}" y="${r(pad.t + iH - (opts.mean / maxVal) * iH + 3)}" font-size="9" fill="#f59e0b" font-family="system-ui,sans-serif">μ=${r(opts.mean, 1)}</text>`
    : ""

  if (type === "bar") {
    const barW = Math.max(6, Math.min(52, iW / data.length - 5))
    const gap2 = (iW - barW * data.length) / (data.length + 1)
    let bars2 = "", xlabels2 = ""
    data.forEach((d, i) => {
      const x = r(pad.l + gap2 + i * (barW + gap2))
      const bH = r(((d.value ?? 0) / maxVal) * iH)
      const y = r(pad.t + iH - bH)
      bars2 += `<rect x="${x}" y="${y}" width="${barW}" height="${bH}" fill="${color}" rx="2" opacity="0.88"/>`
      bars2 += `<text x="${r(x + barW / 2)}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#6b7280" font-family="system-ui,sans-serif">${r(d.value ?? 0, 1)}</text>`
      xlabels2 += xLabel(x + barW / 2, d.name)
    })
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;border-radius:8px">${titleSvg}${yAxis(maxVal)}${axes()}${meanSvg}${bars2}${xlabels2}</svg>`
  }

  // line / area
  const pts = data.map((d, i) => ({
    x: r(pad.l + (i / Math.max(data.length - 1, 1)) * iW),
    y: r(pad.t + iH - ((d.value ?? 0) / maxVal) * iH),
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  const areaD = pts.length > 0 ? `M${pts[0].x},${pad.t + iH} ${pts.map(p => `L${p.x},${p.y}`).join(" ")} L${pts[pts.length - 1].x},${pad.t + iH}Z` : ""
  const dots = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"/>`).join("")
  const xlabels3 = data.map((d, i) => xLabel(pts[i].x, d.name)).join("")
  const fill = type === "area" ? `<path d="${areaD}" fill="${color}" opacity="0.12"/>` : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;border-radius:8px">${titleSvg}${yAxis(maxVal)}${axes()}${meanSvg}${fill}<path d="${pathD}" stroke="${color}" stroke-width="2" fill="none"/>${dots}${xlabels3}</svg>`
}

// ── Per-operation chart source definitions ────────────────────────────────────
type ChartSource = {
  id: string
  label: string
  description: string
  recommendedChart: ChartType
  allowedCharts: ChartType[]
}

const OP_SOURCES: Record<string, ChartSource[]> = {
  MEDIA: [
    { id: "scores",       label: "Notas por aluno",         description: "Nota final de cada aluno pela média",    recommendedChart: "bar",       allowedCharts: ["bar","line","area","radar","scatter","pie"] },
    { id: "distribution", label: "Distribuição de notas",   description: "Histograma de frequência das notas",     recommendedChart: "histogram", allowedCharts: ["histogram","bar"] },
    { id: "cols",         label: "Média por coluna/prova",  description: "Média da turma em cada coluna/avaliação",recommendedChart: "line",      allowedCharts: ["line","bar","area"] },
  ],
  MEDIA_PONDERADA: [
    { id: "scores",       label: "Notas ponderadas",        description: "Nota final ponderada de cada aluno",     recommendedChart: "bar",       allowedCharts: ["bar","line","area","radar","scatter","pie"] },
    { id: "distribution", label: "Distribuição",             description: "Histograma das notas ponderadas",        recommendedChart: "histogram", allowedCharts: ["histogram","bar"] },
    { id: "weights",      label: "Pesos das colunas",       description: "Peso configurado para cada coluna",      recommendedChart: "pie",       allowedCharts: ["pie","bar"] },
  ],
  SOMA: [
    { id: "scores",       label: "Total por aluno",         description: "Soma total de cada aluno",               recommendedChart: "bar",       allowedCharts: ["bar","line","area","pie"] },
    { id: "cols",         label: "Soma por coluna",         description: "Soma acumulada em cada coluna/período",  recommendedChart: "bar",       allowedCharts: ["bar","line","area"] },
  ],
  MEDIANA: [
    { id: "scores",       label: "Valores por aluno",       description: "Valor de cada aluno vs mediana",         recommendedChart: "scatter",   allowedCharts: ["scatter","bar","line"] },
    { id: "distribution", label: "Distribuição + mediana",  description: "Histograma com linha de mediana",        recommendedChart: "histogram", allowedCharts: ["histogram","bar"] },
  ],
  MODA: [
    { id: "distribution", label: "Distribuição de valores", description: "Mostra o valor mais frequente (moda)",   recommendedChart: "histogram", allowedCharts: ["histogram","bar"] },
    { id: "scores",       label: "Valores por aluno",       description: "Valor de cada aluno",                    recommendedChart: "bar",       allowedCharts: ["bar","scatter"] },
  ],
  DESVIO_PADRAO: [
    { id: "scores",       label: "Valores + média ± DP",    description: "Dispersão dos valores em relação à média",recommendedChart: "scatter",   allowedCharts: ["scatter","bar"] },
    { id: "distribution", label: "Distribuição normal",     description: "Histograma com curva normal aproximada", recommendedChart: "histogram", allowedCharts: ["histogram","bar"] },
  ],
  VARIANCIA: [
    { id: "scores",       label: "Valores + variância",     description: "Dispersão quadrática dos valores",       recommendedChart: "scatter",   allowedCharts: ["scatter","bar"] },
    { id: "distribution", label: "Distribuição",            description: "Histograma dos valores",                 recommendedChart: "histogram", allowedCharts: ["histogram"] },
  ],
  AMPLITUDE: [
    { id: "scores",       label: "Valores (máx-mín)",       description: "Amplitude dos valores por aluno",        recommendedChart: "bar",       allowedCharts: ["bar","scatter","line"] },
    { id: "cols",         label: "Amplitude por coluna",    description: "Amplitude (máx-mín) de cada coluna",     recommendedChart: "bar",       allowedCharts: ["bar","line"] },
  ],
  MAX: [
    { id: "scores",       label: "Maiores valores",         description: "Maior valor de cada aluno",              recommendedChart: "bar",       allowedCharts: ["bar","line","area"] },
    { id: "cols",         label: "Máximo por coluna",       description: "Valor máximo de cada coluna",            recommendedChart: "bar",       allowedCharts: ["bar","line"] },
  ],
  MIN: [
    { id: "scores",       label: "Menores valores",         description: "Menor valor de cada aluno",              recommendedChart: "bar",       allowedCharts: ["bar","line","area"] },
    { id: "cols",         label: "Mínimo por coluna",       description: "Valor mínimo de cada coluna",            recommendedChart: "bar",       allowedCharts: ["bar","line"] },
  ],
  CONTAR: [
    { id: "scores",       label: "Contagem por aluno",      description: "Número de valores inseridos por aluno",  recommendedChart: "bar",       allowedCharts: ["bar","pie"] },
  ],
  CONTAR_ACIMA: [
    { id: "comparison",   label: "Acima/abaixo do limiar",  description: "Quantos estão acima do valor configurado",recommendedChart: "bar",       allowedCharts: ["bar","pie"] },
    { id: "scores",       label: "Valores vs limiar",       description: "Cada valor comparado ao limiar",          recommendedChart: "scatter",   allowedCharts: ["scatter","bar"] },
  ],
  CONTAR_ABAIXO: [
    { id: "comparison",   label: "Abaixo/acima do limiar",  description: "Quantos estão abaixo do valor configurado",recommendedChart: "bar",      allowedCharts: ["bar","pie"] },
    { id: "scores",       label: "Valores vs limiar",       description: "Cada valor comparado ao limiar",          recommendedChart: "scatter",   allowedCharts: ["scatter","bar"] },
  ],
  PERCENTUAL: [
    { id: "scores",       label: "Aproveitamento por aluno",description: "Percentual de aproveitamento de cada aluno",recommendedChart:"bar",      allowedCharts: ["bar","line","area","scatter"] },
    { id: "comparison",   label: "Passou/Não passou",       description: "Baseado nos critérios configurados",      recommendedChart: "bar",       allowedCharts: ["bar","pie"] },
    { id: "distribution", label: "Distribuição %",          description: "Histograma de aproveitamentos",           recommendedChart: "histogram", allowedCharts: ["histogram"] },
  ],
  FREQUENCIA: [
    { id: "scores",       label: "Frequência por aluno",    description: "% de presença de cada aluno",            recommendedChart: "bar",       allowedCharts: ["bar","line","scatter"] },
    { id: "comparison",   label: "Acima/abaixo do mínimo",  description: "Quem está em risco de reprovação",        recommendedChart: "bar",       allowedCharts: ["bar","pie"] },
    { id: "distribution", label: "Distribuição de presença",description: "Histograma das frequências",             recommendedChart: "histogram", allowedCharts: ["histogram","bar"] },
  ],
  GABARITO: [
    { id: "questions",    label: "Acerto por questão",      description: "% de acerto da turma em cada questão",   recommendedChart: "bar",       allowedCharts: ["bar","line","area","radar"] },
    { id: "scores",       label: "Nota final por aluno",    description: "Nota calculada de cada aluno",            recommendedChart: "bar",       allowedCharts: ["bar","line","scatter","pie"] },
    { id: "distribution", label: "Distribuição de notas",   description: "Histograma das notas finais",            recommendedChart: "histogram", allowedCharts: ["histogram","bar"] },
    { id: "comparison",   label: "Aprovados/Reprovados",    description: "Baseado nos critérios configurados",      recommendedChart: "bar",       allowedCharts: ["bar","pie"] },
    { id: "heatmap",      label: "Respostas × Gabarito",    description: "Mapa de acertos e erros por questão",    recommendedChart: "bar",       allowedCharts: ["bar"] },
  ],
  REGRA_DE_TRES: [
    { id: "scores",       label: "Valor convertido",        description: "Cada aluno: valor original → convertido", recommendedChart: "bar",       allowedCharts: ["bar","line","area"] },
    { id: "comparison",   label: "Antes × Depois",          description: "Comparação valor original vs convertido", recommendedChart: "bar",       allowedCharts: ["bar","line"] },
  ],
}

// ── Recharts CustomTooltip ─────────────────────────────────────────────────────
function CT({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold truncate max-w-[140px] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          {p.name !== "value" && <span className="text-muted-foreground">{p.name}</span>}
          <span className="font-mono font-bold text-primary ml-auto">{typeof p.value === "number" ? r(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Data builders ──────────────────────────────────────────────────────────────
function buildData(cat: Category, sourceId: string) {
  const scores = computeItemScores(cat)

  if (sourceId === "questions" && cat.operation === "GABARITO") {
    return cat.subDivisions.filter(sd => sd.correctAnswer?.trim()).map(sd => {
      let correct = 0
      cat.items.forEach(it => { if (gabaritoMatch(String(cat.subDivisionValues[sd.id]?.[it.id] ?? ""), sd.correctAnswer!, cat.logic.gabaritoAnswerMode)) correct++ })
      return { name: sd.name, value: cat.items.length > 0 ? r((correct / cat.items.length) * 100) : 0 }
    })
  }

  if (sourceId === "comparison") {
    return cat.comparisons.map(comp => {
      let pass = 0
      cat.items.forEach(it => { if (evaluateComparison(scores.get(it.id) ?? it.value, comp)) pass++ })
      return { name: comp.label, pass, fail: cat.items.length - pass, value: pass }
    })
  }

  if (sourceId === "distribution" || sourceId === "histogram") {
    const vals = Array.from(scores.values())
    if (!vals.length) return []
    const mn = Math.floor(Math.min(...vals)), mx = Math.ceil(Math.max(...vals))
    const bs = Math.max(0.5, (mx - mn) / 7)
    const buckets: Record<string, number> = {}
    for (let b = mn; b < mx + bs; b += bs) buckets[`${r(b,1)}-${r(b+bs,1)}`] = 0
    vals.forEach(v => { const b2 = Math.floor((v - mn) / bs) * bs + mn; const k = `${r(b2,1)}-${r(b2+bs,1)}`; if (k in buckets) buckets[k]++ })
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }

  if (sourceId === "cols" && cat.useSubDivisions) {
    return cat.subDivisions.map(sd => {
      const vals = cat.items.map(it => cat.subDivisionValues[sd.id]?.[it.id]).filter((v): v is number => typeof v === "number")
      return { name: sd.name, value: vals.length ? r(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 }
    })
  }

  if (sourceId === "weights" && cat.useSubDivisions) {
    return cat.subDivisions.map(sd => ({ name: sd.name, value: sd.weight ?? 1 }))
  }

  if (sourceId === "comparison_before_after" || sourceId === "comparison") {
    return cat.items.map(it => ({
      name: it.name, value: r(scores.get(it.id) ?? it.value),
      original: r(it.value),
    }))
  }

  // Default: scores
  return cat.items.map(it => ({ name: it.name, value: r(scores.get(it.id) ?? it.value) }))
}

function buildAllCats(cats: Category[]) {
  return cats.map(c => ({ name: c.name, value: r(computeCategoryResult(c) ?? 0), color: c.color }))
}

const CHART_TYPE_DEFS = [
  { value: "bar" as ChartType,       label: "Barras",     icon: BarChart2  },
  { value: "line" as ChartType,      label: "Linha",      icon: TrendingUp },
  { value: "area" as ChartType,      label: "Área",       icon: Activity   },
  { value: "pie" as ChartType,       label: "Pizza",      icon: PieIcon    },
  { value: "radar" as ChartType,     label: "Radar",      icon: Circle     },
  { value: "scatter" as ChartType,   label: "Dispersão",  icon: Circle     },
  { value: "histogram" as ChartType, label: "Histograma", icon: BarChart2  },
]

// ── Main ──────────────────────────────────────────────────────────────────────
export function ChartDialog({ open, onOpenChange, categories, onInsertChart, onInsertData }: ChartDialogProps) {
  const [catId,       setCatId]       = useState("__all__")
  const [sourceId,    setSourceId]    = useState("scores")
  const [chartType,   setChartType]   = useState<ChartType>("bar")
  const [showLabels,  setShowLabels]  = useState(false)
  const [multiSeries, setMultiSeries] = useState(false)

  const cat = catId === "__all__" ? null : categories.find(c => c.id === catId) ?? null

  const sources = cat ? (OP_SOURCES[cat.operation] ?? OP_SOURCES.MEDIA) : []
  const currentSource = sources.find(s => s.id === sourceId) ?? sources[0]
  const allowedCharts = currentSource?.allowedCharts ?? CHART_TYPE_DEFS.map(t => t.value)

  const { data, isStacked } = useMemo(() => {
    if (multiSeries && catId === "__all__") return { data: buildAllCats(categories), isStacked: false }
    if (!cat) return { data: buildAllCats(categories), isStacked: false }
    const d = buildData(cat, currentSource?.id ?? "scores")
    const stacked = currentSource?.id === "comparison" && d.some((row: any) => "pass" in row)
    return { data: d, isStacked: stacked }
  }, [cat, catId, currentSource, multiSeries, categories])

  const stats = useMemo(() => {
    const nums = data.map((d: any) => typeof d.value === "number" ? d.value : 0).filter((n: number) => !isNaN(n))
    if (!nums.length) return null
    const mean = nums.reduce((a: number, b: number) => a + b, 0) / nums.length
    const sorted = [...nums].sort((a: number, b: number) => a - b)
    const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)]
    const variance = nums.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / Math.max(nums.length - 1, 1)
    return { mean: r(mean), median: r(median), max: Math.max(...nums), min: Math.min(...nums), stddev: r(Math.sqrt(variance)), count: nums.length }
  }, [data])

  const hasData = data.length > 0
  const color = cat?.color ?? PAL[0]
  const chartLabel = cat ? `${cat.name} — ${currentSource?.label ?? ""}` : "Todas as categorias"

  // ── Recharts render ──────────────────────────────────────────────────────
  const axStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" }
  const gridSt  = { strokeDasharray: "3 3", stroke: "hsl(var(--border))" }
  const margin  = { top: 10, right: 28, bottom: data.length > 7 ? 68 : 44, left: 10 }
  const xAng    = data.length > 8 ? -38 : 0
  const xAnch   = data.length > 8 ? "end" : "middle"
  const refLine = stats ? <ReferenceLine y={stats.mean} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: `μ=${stats.mean}`, fontSize: 10, fill: "#f59e0b", position: "insideTopRight" }} /> : null

  const renderChart = () => {
    if (!hasData) return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <BarChart2 size={32} className="text-muted-foreground/25" />
        <p className="text-sm text-muted-foreground">Sem dados — adicione itens à categoria</p>
      </div>
    )

    if (isStacked) return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin}>
          <CartesianGrid {...gridSt} vertical={false} />
          <XAxis dataKey="name" tick={axStyle} angle={xAng} textAnchor={xAnch} interval={0} />
          <YAxis tick={axStyle} />
          <Tooltip content={<CT />} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="pass" name="Passou"     stackId="a" fill="#2563eb" maxBarSize={56} radius={[4,4,0,0]} />
          <Bar dataKey="fail" name="Não passou" stackId="a" fill="#dc2626" maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    )

    if (chartType === "pie") {
      const pd = data.map((d: any, i: number) => ({ name: d.name, value: typeof d.value === "number" ? d.value : 0, fill: PAL[i % PAL.length] }))
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pd} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="68%" innerRadius="28%"
              label={({ name, percent }) => percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ""} labelLine={false}>
              {pd.map((d: any, i: number) => <Cell key={i} fill={d.fill} stroke="hsl(var(--card))" strokeWidth={2} />)}
            </Pie>
            <Tooltip content={<CT />} /><Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === "radar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Radar name={cat?.name ?? "Valor"} dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
            <Tooltip content={<CT />} />
          </RadarChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === "scatter") {
      const sd = data.map((d: any, i: number) => ({ x: i + 1, y: typeof d.value === "number" ? d.value : 0, name: d.name }))
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={margin}>
            <CartesianGrid {...gridSt} /><XAxis type="number" dataKey="x" tick={axStyle} /><YAxis type="number" dataKey="y" tick={axStyle} />
            {refLine}
            <Tooltip content={({ active, payload }) => { if (!active || !payload?.length) return null; const d = payload[0]?.payload; return <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow"><p className="font-bold">{d?.name}</p><p className="font-mono text-primary">{r(d?.y)}</p></div> }} />
            <Scatter data={sd} fill={color} fillOpacity={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={margin}>
            <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3}/><stop offset="95%" stopColor={color} stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid {...gridSt} vertical={false} /><XAxis dataKey="name" tick={axStyle} angle={xAng} textAnchor={xAnch} interval={0} /><YAxis tick={axStyle} />
            {refLine}<Tooltip content={<CT />} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#cg)" dot={{ r: 3 }} name={cat?.name ?? "Valor"} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={margin}>
            <CartesianGrid {...gridSt} /><XAxis dataKey="name" tick={axStyle} angle={xAng} textAnchor={xAnch} interval={0} /><YAxis tick={axStyle} />
            {refLine}<Tooltip content={<CT />} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color, strokeWidth: 0 }} activeDot={{ r: 6 }} name={cat?.name ?? "Valor"}>
              {showLabels && <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: color }} formatter={(v: number) => String(r(v, 1))} />}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      )
    }

    // bar / histogram
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin} barCategoryGap="20%">
          <CartesianGrid {...gridSt} vertical={false} /><XAxis dataKey="name" tick={axStyle} angle={xAng} textAnchor={xAnch} interval={0} /><YAxis tick={axStyle} />
          {refLine}<Tooltip content={<CT />} />
          <Bar dataKey="value" fill={color} maxBarSize={56} radius={[4,4,0,0]} name={cat?.name ?? "Valor"}>
            {showLabels && <LabelList dataKey="value" position="top" style={{ fontSize: 10 }} formatter={(v: number) => String(r(v, 1))} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // ── Generate SVG for grid embedding ──────────────────────────────────────
  const generateSvg = useCallback((): string => {
    if (!hasData) return ""
    const simpleData = data.map((d: any) => ({ name: String(d.name), value: typeof d.value === "number" ? d.value : 0, pass: d.pass, fail: d.fail }))
    const svgType = isStacked ? "stacked" : (chartType === "area" ? "area" : chartType === "line" ? "line" : "bar")
    return buildSvg(svgType as any, simpleData, {
      color,
      title: chartLabel,
      width: 560,
      height: 300,
      mean: stats?.mean,
    })
  }, [data, chartType, isStacked, color, chartLabel, stats, hasData])

  // ── Insert chart into grid ────────────────────────────────────────────────
  const handleInsertChart = useCallback(() => {
    if (!onInsertChart || !hasData) return
    const svg = generateSvg()
    if (!svg) return
    onInsertChart(svg, chartLabel, 13, 7)
    onOpenChange(false)
  }, [generateSvg, onInsertChart, hasData, chartLabel, onOpenChange])

  // ── Insert data table ─────────────────────────────────────────────────────
  const handleInsertData = useCallback(() => {
    if (!onInsertData || !hasData) return
    const rows: string[][] = []

    if (cat) {
      // Section header
      rows.push([cat.name, cat.operation])
      rows.push([])

      // Main data
      if (isStacked) {
        rows.push(["Critério", "Passou", "Não passou", "% Passou"])
        data.forEach((d: any) => {
          const tot = (d.pass ?? 0) + (d.fail ?? 0) || 1
          rows.push([String(d.name), String(d.pass ?? 0), String(d.fail ?? 0), String(r(((d.pass ?? 0) / tot) * 100)) + "%"])
        })
      } else {
        rows.push(["Nome", "Valor"])
        data.forEach((d: any) => rows.push([String(d.name), String(d.value ?? "")]))
      }

      // Statistics block
      if (stats) {
        rows.push([])
        rows.push(["── Estatísticas", ""])
        rows.push(["Média",          String(stats.mean)])
        rows.push(["Mediana",        String(stats.median)])
        rows.push(["Desvio padrão",  String(stats.stddev)])
        rows.push(["Variância",      String(r(Math.pow(Number(stats.stddev), 2)))])
        rows.push(["Máximo",         String(stats.max)])
        rows.push(["Mínimo",         String(stats.min)])
        rows.push(["Amplitude",      String(r(stats.max - stats.min))])
        rows.push(["Contagem",       String(stats.count)])
        if (stats.count > 0) rows.push(["Coef. de variação", r((Number(stats.stddev) / Number(stats.mean)) * 100) + "%"])
      }

      // Logic config
      const lg = cat.logic
      rows.push([])
      rows.push(["── Configurações", ""])
      rows.push(["Operação", cat.operation])
      if (lg.maxScore !== null) rows.push(["Nota máxima", String(lg.maxScore)])
      if (lg.roundMode !== "none") rows.push(["Arredondamento", lg.roundMode])
      if (lg.dropLowest) rows.push(["Descarta menores", String(lg.dropLowestN)])
      if (lg.dropHighest) rows.push(["Descarta maiores", String(lg.dropHighestN)])
      if (lg.normalise) rows.push(["Normalizado para", String(lg.normaliseTarget)])
      if (cat.operation === "REGRA_DE_TRES") {
        rows.push(["Referência", String(lg.regraRef)])
        rows.push(["Alvo", String(lg.regraTarget)])
        rows.push(["Inverso", lg.regraInverse ? "Sim" : "Não"])
      }
      if (cat.operation === "GABARITO") {
        rows.push(["Modo de comparação", lg.gabaritoAnswerMode])
      }
      if (lg.thresholdValue && ["CONTAR_ACIMA","CONTAR_ABAIXO","FREQUENCIA"].includes(cat.operation))
        rows.push(["Limiar", String(lg.thresholdValue)])

      // Bands
      if (lg.useBands && lg.bands.length > 0) {
        rows.push([])
        rows.push(["── Faixas de conceito", ""])
        rows.push(["Faixa", "A partir de", "Cor"])
        lg.bands.forEach(b => rows.push([b.label, String(b.minScore), b.color]))
      }

      // Comparisons
      if (cat.comparisons.length > 0) {
        rows.push([])
        rows.push(["── Critérios de comparação", ""])
        rows.push(["Critério", "Operador", "Valor", "Verdadeiro", "Falso"])
        const scores2 = computeItemScores(cat)
        cat.comparisons.forEach(comp => {
          rows.push([comp.label, comp.operator, String(comp.refValue), comp.labelTrue, comp.labelFalse])
          // Per-item results
          cat.items.forEach(it => {
            const s = scores2.get(it.id) ?? it.value
            const passed = evaluateComparison(s, comp)
            rows.push(["  " + it.name, String(r(s)), "", passed ? comp.labelTrue : comp.labelFalse, ""])
          })
        })
      }

      // SubDivision detail for GABARITO
      if (cat.operation === "GABARITO" && cat.subDivisions.length > 0) {
        rows.push([])
        rows.push(["── Gabarito — detalhe por questão", ""])
        const header = ["Aluno", ...cat.subDivisions.map(sd => sd.name), "Nota"]
        const gabRow = ["Gabarito", ...cat.subDivisions.map(sd => sd.correctAnswer ?? ""), ""]
        rows.push(header); rows.push(gabRow)
        const scs = computeItemScores(cat)
        cat.items.forEach(it => {
          const answers = cat.subDivisions.map(sd => String(cat.subDivisionValues[sd.id]?.[it.id] ?? ""))
          rows.push([it.name, ...answers, String(r(scs.get(it.id) ?? 0))])
        })
        // Per-question stats
        rows.push([])
        rows.push(["── Acerto por questão (%)", ""])
        cat.subDivisions.filter(sd => sd.correctAnswer?.trim()).forEach(sd => {
          let correct = 0
          cat.items.forEach(it => { if (gabaritoMatch(String(cat.subDivisionValues[sd.id]?.[it.id] ?? ""), sd.correctAnswer!, cat.logic.gabaritoAnswerMode)) correct++ })
          const pct = cat.items.length > 0 ? r((correct / cat.items.length) * 100) : 0
          rows.push([sd.name, `${correct}/${cat.items.length}`, `${pct}%`])
        })
      }

      // Frequency detail
      if (cat.operation === "FREQUENCIA" && cat.subDivisions.length > 0) {
        rows.push([])
        rows.push(["── Presença por aluno", ""])
        rows.push(["Aluno", "Presença (%)", "Status"])
        const scs2 = computeItemScores(cat)
        cat.items.forEach(it => {
          const pct = r(scs2.get(it.id) ?? 0)
          const status = pct >= cat.logic.attendanceWarningThreshold ? "Regular" : "⚠ Em risco"
          rows.push([it.name, String(pct) + "%", status])
        })
      }

    } else {
      // All categories
      rows.push(["Categoria", "Resultado", "Operação"])
      categories.forEach(c => rows.push([c.name, String(r(computeCategoryResult(c) ?? 0)), c.operation]))
    }

    onInsertData(rows, cat?.name ?? "Categorias")
  }, [data, isStacked, stats, cat, categories, onInsertData, hasData])

  // ── Change cat → auto-set recommended source and chart ───────────────────
  const handleCatChange = (id: string) => {
    setCatId(id)
    if (id === "__all__") { setSourceId("scores"); setChartType("bar"); return }
    const c2 = categories.find(c => c.id === id)
    if (!c2) return
    const srcs = OP_SOURCES[c2.operation] ?? OP_SOURCES.MEDIA
    const first = srcs[0]
    setSourceId(first.id)
    setChartType(first.recommendedChart)
  }

  const handleSourceChange = (id: string) => {
    setSourceId(id)
    const src = sources.find(s => s.id === id)
    if (src) setChartType(src.recommendedChart)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden" style={{ maxWidth: "min(980px,98vw)", height: "min(92vh,820px)" }}>

        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border bg-muted/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><BarChart2 size={18} className="text-primary" /></div>
            <div className="flex-1">
              <DialogTitle className="text-base font-bold">Gráficos & Exportação</DialogTitle>
              <p className="text-xs text-muted-foreground">Visualize, analise e insira na planilha</p>
            </div>
            <div className="flex items-center gap-2">
              {hasData && onInsertData && (
                <Button variant="outline" size="sm" onClick={handleInsertData} className="h-8 gap-1.5 text-xs">
                  <TableIcon size={13} />Dados & Estatísticas
                </Button>
              )}
              {hasData && onInsertChart && (
                <Button size="sm" onClick={handleInsertChart} className="h-8 gap-1.5 text-xs">
                  <BarChart2 size={13} />Inserir Gráfico
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Controls */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border bg-muted/5">
          {/* Chart type — only show allowed */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-xl p-1 flex-wrap">
            {CHART_TYPE_DEFS.filter(ct => !cat || allowedCharts.includes(ct.value) || isStacked).map(ct => {
              const Icon = ct.icon; const active = chartType === ct.value
              return (
                <button key={ct.value} onClick={() => setChartType(ct.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}>
                  <Icon size={12} />{ct.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select value={catId} onValueChange={handleCatChange}>
              <SelectTrigger className="h-8 text-xs w-52 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">🗂️ Todas as categorias</SelectItem>
                <Separator className="my-1" />
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />{c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {cat && sources.length > 1 && (
              <Select value={sourceId} onValueChange={handleSourceChange}>
                <SelectTrigger className="h-8 text-xs w-56 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sources.map(s => <SelectItem key={s.id} value={s.id} className="text-xs"><div><div className="font-medium">{s.label}</div><div className="text-muted-foreground text-[10px]">{s.description}</div></div></SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {catId === "__all__" && (
              <button onClick={() => setMultiSeries(v => !v)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-all ${multiSeries ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"}`}>
                <Layers size={12} className="inline mr-1" />Séries
              </button>
            )}
            <button onClick={() => setShowLabels(v => !v)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-all ${showLabels ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"}`}>
              Rótulos
            </button>
          </div>
        </div>

        {/* Info banner */}
        {cat && currentSource && (
          <div className="shrink-0 flex items-center gap-2 px-5 py-1.5 bg-muted/15 border-b border-border/40 text-xs text-muted-foreground">
            <Info size={11} className="text-primary/60 shrink-0" />
            <span>
              <strong className="text-foreground">{cat.operation.replace(/_/g," ")}</strong>
              <span className="mx-1.5">·</span>
              {currentSource.description}
              {cat.comparisons.length > 0 && <span className="ml-1.5">· {cat.comparisons.length} critério(s)</span>}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground/50">Linha amarela = média da turma</span>
          </div>
        )}

        {/* Chart area */}
        <div className="flex-1 min-h-0 p-4">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <BarChart2 size={32} className="text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground">Crie categorias para gerar gráficos</p>
            </div>
          ) : renderChart()}
        </div>

        {/* Stats footer */}
        {stats && (
          <div className="shrink-0 border-t border-border px-5 py-2.5 bg-muted/5 flex items-center gap-4 flex-wrap text-xs">
            <span className="text-muted-foreground">N: <strong className="font-mono text-foreground">{stats.count}</strong></span>
            <span className="text-muted-foreground">Média: <strong className="font-mono text-foreground">{stats.mean}</strong></span>
            <span className="text-muted-foreground">Mediana: <strong className="font-mono text-foreground">{stats.median}</strong></span>
            <span className="text-muted-foreground">DP: <strong className="font-mono text-foreground">{stats.stddev}</strong></span>
            <span className="text-muted-foreground">Máx: <strong className="font-mono text-primary">{stats.max}</strong></span>
            <span className="text-muted-foreground">Mín: <strong className="font-mono text-destructive">{stats.min}</strong></span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}