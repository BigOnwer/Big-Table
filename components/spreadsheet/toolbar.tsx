"use client"

import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  Trash2,
  Type,
  Paintbrush,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CellStyle } from "@/hooks/use-spreadsheet"
import { Separator } from "@/components/ui/separator"

type ToolbarProps = {
  currentStyle: CellStyle
  onStyleChange: (style: Partial<CellStyle>) => void
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onPaste: () => void
  onDelete: () => void
  onInsertFormula: (formula: string) => void
  onApplyFunction: (funcName: string) => void
  hasSelection: boolean
}

const fontSizes = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36]

const formulas = [
  { label: "SOMA", desc: "Soma os valores", formula: "=SOMA(" },
  { label: "MEDIA", desc: "Calcula a media", formula: "=MEDIA(" },
  { label: "CONTAR", desc: "Conta os valores", formula: "=CONTAR(" },
  { label: "MAX", desc: "Valor maximo", formula: "=MAX(" },
  { label: "MIN", desc: "Valor minimo", formula: "=MIN(" },
  { label: "CONCATENAR", desc: "Junta textos", formula: "=CONCATENAR(" },
]

const bgColors = [
  { label: "Nenhum", value: "" },
  { label: "Amarelo", value: "#FEF9C3" },
  { label: "Verde", value: "#DCFCE7" },
  { label: "Azul", value: "#DBEAFE" },
  { label: "Rosa", value: "#FCE7F3" },
  { label: "Laranja", value: "#FED7AA" },
  { label: "Cinza", value: "#F3F4F6" },
  { label: "Vermelho", value: "#FEE2E2" },
]

const textColors = [
  { label: "Padrao", value: "" },
  { label: "Vermelho", value: "#DC2626" },
  { label: "Verde", value: "#16A34A" },
  { label: "Azul", value: "#2563EB" },
  { label: "Laranja", value: "#EA580C" },
  { label: "Roxo", value: "#9333EA" },
  { label: "Cinza", value: "#6B7280" },
]

function ToolbarButton({
  onClick,
  active,
  tooltip,
  children,
}: {
  onClick: () => void
  active?: boolean
  tooltip: string
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`flex items-center justify-center h-8 w-8 rounded-sm transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function Toolbar({
  currentStyle,
  onStyleChange,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDelete,
  onInsertFormula,
  onApplyFunction,
  hasSelection,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-card border-b border-border overflow-x-auto">
      {/* Desfazer / Refazer */}
      <ToolbarButton onClick={onUndo} tooltip="Desfazer (Ctrl+Z)">
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={onRedo} tooltip="Refazer (Ctrl+Y)">
        <Redo2 size={16} />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1.5 h-6" />

      {/* Copiar / Colar / Apagar */}
      <ToolbarButton onClick={onCopy} tooltip="Copiar (Ctrl+C)">
        <Copy size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={onPaste} tooltip="Colar (Ctrl+V)">
        <ClipboardPaste size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={onDelete} tooltip="Apagar (Delete)">
        <Trash2 size={16} />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1.5 h-6" />

      {/* Tamanho da fonte */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <Type size={14} />
            {currentStyle.fontSize}
            <ChevronDown size={12} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {fontSizes.map((size) => (
            <DropdownMenuItem
              key={size}
              onClick={() => onStyleChange({ fontSize: size })}
              className={currentStyle.fontSize === size ? "bg-accent text-accent-foreground" : ""}
            >
              {size}px
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1.5 h-6" />

      {/* Negrito / Italico / Sublinhado */}
      <ToolbarButton
        onClick={() => onStyleChange({ bold: !currentStyle.bold })}
        active={currentStyle.bold}
        tooltip="Negrito (Ctrl+B)"
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onStyleChange({ italic: !currentStyle.italic })}
        active={currentStyle.italic}
        tooltip="Italico (Ctrl+I)"
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onStyleChange({ underline: !currentStyle.underline })}
        active={currentStyle.underline}
        tooltip="Sublinhado (Ctrl+U)"
      >
        <Underline size={16} />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1.5 h-6" />

      {/* Alinhamento */}
      <ToolbarButton
        onClick={() => onStyleChange({ align: "left" })}
        active={currentStyle.align === "left"}
        tooltip="Alinhar a esquerda"
      >
        <AlignLeft size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onStyleChange({ align: "center" })}
        active={currentStyle.align === "center"}
        tooltip="Centralizar"
      >
        <AlignCenter size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onStyleChange({ align: "right" })}
        active={currentStyle.align === "right"}
        tooltip="Alinhar a direita"
      >
        <AlignRight size={16} />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1.5 h-6" />

      {/* Cor de fundo */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <Paintbrush size={14} />
            <span className="hidden sm:inline">Fundo</span>
            <ChevronDown size={12} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {bgColors.map((color) => (
            <DropdownMenuItem
              key={color.label}
              onClick={() => onStyleChange({ bgColor: color.value })}
              className="gap-2"
            >
              <span
                className="w-4 h-4 rounded-sm border border-border"
                style={{ backgroundColor: color.value || "transparent" }}
              />
              {color.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cor do texto */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <span className="font-bold text-sm" style={{ color: currentStyle.textColor || undefined }}>
              A
            </span>
            <span className="hidden sm:inline">Texto</span>
            <ChevronDown size={12} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {textColors.map((color) => (
            <DropdownMenuItem
              key={color.label}
              onClick={() => onStyleChange({ textColor: color.value })}
              className="gap-2"
            >
              <span
                className="font-bold text-sm"
                style={{ color: color.value || "inherit" }}
              >
                A
              </span>
              {color.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1.5 h-6" />

      {/* Formulas */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 font-mono"
          >
            <span className="text-sm italic">fx</span>
            <span className="hidden sm:inline">Funcoes</span>
            <ChevronDown size={12} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {hasSelection && (
            <div className="px-2 py-1.5 mb-1 border-b border-border">
              <span className="text-xs text-primary font-medium">
                Celulas selecionadas - clique para aplicar
              </span>
            </div>
          )}
          {formulas.map((f) => (
            <DropdownMenuItem
              key={f.label}
              onClick={() => {
                if (hasSelection) {
                  onApplyFunction(f.label)
                } else {
                  onInsertFormula(f.formula)
                }
              }}
              className="flex flex-col items-start gap-0.5"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-mono text-sm font-medium">{f.label}</span>
                {hasSelection && (
                  <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-medium">
                    Aplicar
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{f.desc}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
