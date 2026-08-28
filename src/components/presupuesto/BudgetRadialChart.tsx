"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Utensils, Car, Home, Zap, Film, HeartPulse, ShoppingBag, MoreHorizontal,
  Pencil, X, GraduationCap, PawPrint, Dumbbell, Plane, Gamepad2, Wifi,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppContext } from "@/lib/app-context"
import { getCategoryInsight } from "@/lib/budget-insights"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BudgetRadialChart — Gráfico radial interactivo de presupuesto
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Reemplaza la donut + tabla de categorías + vista detalle.
 * - Hover: muestra vistazo rápido en el centro (nombre, gastado, %)
 * - Click spoke: expande detalle inline (ring, presupuesto, consejo, desglose)
 * - Click centro: expande lista "Todas las categorías"
 * - Solo un panel expandido a la vez
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadialCategory {
  id: string
  name: string
  spent: number
  limit: number
  color: string
  icon: string
  items: { emoji: string; name: string; amount: number }[]
}

interface Props {
  categories: RadialCategory[]
  onEdit: (catId: string) => void
  incomeFrequency: 'mensual' | 'quincenal'
  /** Callback cuando se selecciona una categoría o el centro. null = nada seleccionado */
  onSelectionChange?: (selection: { type: 'category'; index: number } | { type: 'all' } | null) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

function statusFor(ratio: number) {
  if (ratio >= 1) return { label: 'Límite superado', color: '#f97362' }
  if (ratio >= 0.85) return { label: 'Cerca del límite', color: '#fbbf24' }
  return { label: 'Dentro del presupuesto', color: '#22c55e' }
}

function insightFor(cat: RadialCategory, frequency: 'mensual' | 'quincenal') {
  const insight = getCategoryInsight(cat.name, cat.limit, cat.spent, frequency)
  return insight.message
}

// Icon resolver — reutiliza el mapeo existente del proyecto
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {
  utensils: Utensils, car: Car, home: Home, wifi: Wifi, gamepad: Gamepad2,
  heart: HeartPulse, shopping: ShoppingBag, education: GraduationCap,
  paw: PawPrint, dumbbell: Dumbbell, plane: Plane, more: MoreHorizontal,
  tools: Zap, gift: Film, baby: Film,
}

function resolveIcon(iconKey: string) {
  return ICON_MAP[iconKey] || MoreHorizontal
}

// Emoji por nombre de gasto
function getItemEmoji(nombre: string): string {
  const l = nombre.toLowerCase()
  if (l.includes("pizza") || l.includes("hamburguesa")) return "🍕"
  if (l.includes("mercado") || l.includes("éxito") || l.includes("d1")) return "🛒"
  if (l.includes("café") || l.includes("cafe")) return "☕"
  if (l.includes("uber") || l.includes("taxi")) return "🚕"
  if (l.includes("gas") || l.includes("gasolina")) return "⛽"
  if (l.includes("netflix") || l.includes("cine")) return "🎬"
  if (l.includes("rappi") || l.includes("domicilio")) return "🛵"
  if (l.includes("cerveza") || l.includes("bar")) return "🍺"
  if (l.includes("arriendo")) return "🏠"
  if (l.includes("internet") || l.includes("claro")) return "📶"
  if (l.includes("energia") || l.includes("epm")) return "💡"
  return "💸"
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RingProgress({ ratio, color, size = 130 }: { ratio: number; color: string; size?: number }) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(ratio, 1))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={9} strokeOpacity={0.3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
    </svg>
  )
}

export function CategoryDetail({ cat, onEdit, frequency }: { cat: RadialCategory & { ratio: number }; onEdit: () => void; frequency: 'mensual' | 'quincenal' }) {
  const status = statusFor(cat.ratio)
  const totalItems = cat.items.reduce((s, it) => s + it.amount, 0) || 1
  const IconComp = resolveIcon(cat.icon)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cat.color}22` }}>
          <IconComp size={18} color={cat.color} />
        </div>
        <div className="flex-1">
          <p className="text-foreground text-base font-bold">{cat.name}</p>
          <p className="text-muted-foreground text-xs">Presupuesto de esta categoría</p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <Pencil size={14} /> Editar
        </button>
      </div>

      {/* Ring + Stats */}
      <div className="flex gap-5 items-center">
        <div className="relative shrink-0">
          <RingProgress ratio={cat.ratio} color={cat.color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-foreground text-lg font-bold">{Math.round(cat.ratio * 100)}%</span>
            <span className="text-[9px] font-semibold leading-tight text-center" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground text-xs">Presupuesto asignado</span><span className="text-foreground text-sm font-bold">{cop(cat.limit)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground text-xs">Gastado</span><span className="text-foreground text-sm font-bold">{cop(cat.spent)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground text-xs">Disponible</span><span className="text-kiri-emerald text-sm font-bold">{cop(Math.max(cat.limit - cat.spent, 0))}</span></div>
        </div>
      </div>

      {/* Consejo Kiri */}
      <div className="p-3 rounded-xl bg-muted/20 text-muted-foreground text-xs leading-relaxed">
        📍 <strong className="text-foreground">Consejo Kiri:</strong> {insightFor(cat, frequency)}
      </div>

      {/* Desglose */}
      {cat.items.length > 0 && (
        <div>
          <p className="text-foreground text-sm font-bold mb-2">Desglose de gastos</p>
          <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
            {cat.items.map((it, idx) => {
              const pct = Math.round((it.amount / totalItems) * 100)
              return (
                <div key={idx} className="flex items-center gap-2.5">
                  <span className="text-base">{it.emoji || getItemEmoji(it.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground mb-1">{it.name}</p>
                    <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-foreground">{cop(it.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">{pct}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function AllCategoriesList({ categories, onPick, onEdit, totalLimit }: {
  categories: (RadialCategory & { ratio: number })[]
  onPick: (i: number) => void
  onEdit: (id: string) => void
  totalLimit: number
}) {
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-foreground text-base font-bold">Tus categorías</p>
        <p className="text-muted-foreground text-xs">Edita los límites máximos de gasto por categoría.</p>
      </div>
      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
        {categories.map((c, i) => {
          const share = totalLimit ? Math.round((c.limit / totalLimit) * 100) : 0
          const IconComp = resolveIcon(c.icon)
          return (
            <div key={c.id} className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <button onClick={() => onPick(i)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 hover:scale-110 transition-transform" style={{ background: `${c.color}22` }}>
                  <IconComp size={14} color={c.color} />
                </button>
                <button onClick={() => onPick(i)} className="flex-1 text-left min-w-0">
                  <p className="text-foreground text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-muted-foreground text-[10px]">{share}% del total</p>
                </button>
                <div className="text-right shrink-0">
                  <p className="text-foreground text-sm font-semibold">{cop(c.limit)}</p>
                  <p className="text-muted-foreground text-[10px]">{cop(c.spent)} gastado</p>
                </div>
                <button onClick={() => onEdit(c.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil size={13} />
                </button>
              </div>
              <div className="h-[5px] rounded-full bg-muted/20 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(c.ratio, 1) * 100}%`, background: c.color }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground">
        <span>Total asignado <strong className="text-foreground">{cop(totalLimit)}</strong></span>
        <span>Total gastado <strong className="text-foreground">{cop(totalSpent)}</strong></span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BudgetRadialChart({ categories, onEdit, incomeFrequency, onSelectionChange }: Props) {
  const { formatAmount } = useAppContext()
  const [hovered, setHovered] = useState<number | null>(null)
  const [view, setView] = useState<null | 'all' | number>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Chart dimensions — responsive via viewBox
  const size = 380
  const center = 190
  const hubR = 64
  const minLen = 76
  const maxLen = 140
  const n = categories.length

  if (n === 0) return null

  const startAngle = -90
  const total = categories.reduce((s, c) => s + c.spent, 0)
  const totalLimit = categories.reduce((s, c) => s + c.limit, 0)
  const pct = totalLimit ? Math.round((total / totalLimit) * 100) : 0

  const spokes = categories.map((c, i) => {
    const angle = startAngle + (360 / n) * i
    const rad = (angle * Math.PI) / 180
    const ratio = Math.min(c.spent / (c.limit || 1), 1)
    const len = minLen + ratio * (maxLen - minLen)
    const x2 = center + Math.cos(rad) * len
    const y2 = center + Math.sin(rad) * len
    const ix = center + Math.cos(rad) * (len + 22)
    const iy = center + Math.sin(rad) * (len + 22)
    const lineLen = Math.hypot(x2 - center, y2 - center)
    return { ...c, ratio, x2, y2, ix, iy, lineLen }
  })

  const shown = hovered !== null ? spokes[hovered] : null

  const handlePick = (i: number) => {
    const newView = view === i ? null : i
    setView(newView)
    onSelectionChange?.(newView !== null ? { type: 'category', index: newView as number } : null)
  }
  const handleCenter = () => {
    const newView = view === 'all' ? null : 'all'
    setView(newView)
    onSelectionChange?.(newView === 'all' ? { type: 'all' } : null)
  }

  const panel = view === 'all' ? (
    <AllCategoriesList categories={spokes} onPick={handlePick} onEdit={onEdit} totalLimit={totalLimit} />
  ) : view !== null && typeof view === 'number' ? (
    <CategoryDetail cat={spokes[view]} onEdit={() => onEdit(spokes[view].id)} frequency={incomeFrequency} />
  ) : null

  return (
    <div className="space-y-0">
      {/* Card principal */}
      <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-kiri-emerald/5 blur-3xl pointer-events-none" />

        <h3 className="text-foreground text-lg font-bold relative">Distribución actual</h3>

        {/* SVG Chart */}
        <div className="relative w-full max-w-[380px] mx-auto aspect-square mt-1">
          <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
            {/* Guide circles */}
            {[minLen, (minLen + maxLen) / 2, maxLen].map((r, i) => (
              <circle key={i} cx={center} cy={center} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={1} strokeOpacity={0.3} />
            ))}

            {/* Spokes */}
            {spokes.map((s, i) => {
              const isHovered = hovered === i
              const isSelected = view === i
              const dim = (hovered !== null && !isHovered) || (view !== null && view !== 'all' && !isSelected)
              const IconComp = resolveIcon(s.icon)

              return (
                <g
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.name}, ${Math.round(s.ratio * 100)}% de ${cop(s.limit)}`}
                  style={{ cursor: 'pointer', outline: 'none' }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handlePick(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePick(i) }}
                >
                  <line
                    x1={center} y1={center} x2={s.x2} y2={s.y2}
                    stroke={s.color}
                    strokeWidth={isHovered || isSelected ? 7 : 5}
                    strokeLinecap="round"
                    opacity={dim ? 0.28 : 1}
                    strokeDasharray={s.lineLen}
                    strokeDashoffset={mounted ? 0 : s.lineLen}
                    style={{ transition: `stroke-dashoffset .8s cubic-bezier(.22,1,.36,1) ${i * 55}ms, stroke-width .25s ease, opacity .3s ease` }}
                  />
                  <circle
                    cx={s.ix} cy={s.iy} r={isHovered || isSelected ? 18 : 15}
                    fill="hsl(var(--card))" stroke={s.color} strokeWidth={2}
                    opacity={mounted ? (dim ? 0.28 : 1) : 0}
                    style={{ transition: `opacity .4s ease ${i * 55 + 300}ms` }}
                  />
                  <foreignObject
                    x={s.ix - 10} y={s.iy - 10} width={20} height={20}
                    style={{ pointerEvents: 'none', opacity: mounted ? (dim ? 0.28 : 1) : 0, transition: `opacity .4s ease ${i * 55 + 300}ms` }}
                  >
                    <div className="flex items-center justify-center w-full h-full">
                      <IconComp size={12} color={s.color} />
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Hub */}
            <circle
              cx={center} cy={center} r={hubR}
              fill="hsl(var(--card))" stroke="#22c55e" strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={handleCenter}
              role="button"
              tabIndex={0}
              aria-label="Ver todas las categorías"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCenter() }}
            />
          </svg>

          {/* Center text overlay */}
          <div
            onClick={handleCenter}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center cursor-pointer flex flex-col items-center justify-center gap-0.5"
            style={{ width: hubR * 1.6 }}
          >
            {!shown ? (
              <>
                <span className="text-muted-foreground text-[10px]">Total gastado</span>
                <span className="text-foreground text-base font-bold">{cop(total)}</span>
                <span className="text-kiri-emerald text-xs font-semibold">{pct}% usado</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground text-[10px]">{shown.name}</span>
                <span className="text-foreground text-sm font-bold">{cop(shown.spent)}</span>
                <span className="text-xs font-semibold" style={{ color: shown.color }}>{Math.round(shown.ratio * 100)}% del límite</span>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-2">Toca una categoría o el centro para ver el detalle</p>
      </div>
    </div>
  )
}
