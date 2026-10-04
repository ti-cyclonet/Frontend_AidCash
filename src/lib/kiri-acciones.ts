"use client"

import { useCallback, useEffect, useState } from "react"
import {
  api, budgetCategoriesApi, savingsPocketsApi, hogarApi, externalLoansApi, userApi,
  debtsApi, fixedExpensesApi,
  type BudgetCategory, type SavingsPocket, type ExternalLoan, type HogarCategoria,
} from "@/lib/api-client"
import { useFinanceData } from "@/hooks/use-finance-data"
import { tr } from "@/lib/i18n"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Acciones de Kiri Coach (chat, dictado por voz y escáner de recibos)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * La IA (backend, lib/ai/acciones.ts) propone movimientos; aquí se muestran en
 * tarjetas editables (components/coach/AccionesReview.tsx) y, SOLO cuando el
 * usuario confirma, se ejecutan con las mismas funciones que usan los
 * formularios de cada módulo — así un gasto dictado dispara lo mismo que uno
 * escrito: alerta de su categoría, aviso a la pareja si es del hogar, rayo del
 * gasto hormiga, lluvia al ahorrar, sol al registrar un ingreso…
 */

export type TipoAccion =
  | "gasto" | "ingreso" | "pago_obligacion" | "ahorro" | "crear_categoria" | "crear_deuda"
  | "crear_gasto_fijo" | "crear_bolsillo" | "me_deben" | "abono_me_deben" | "sin_destino"

export interface Accion {
  id: string
  tipo: TipoAccion
  nombre: string
  monto: number
  categoriaId?: string | null
  categoriaNueva?: string | null
  esHormiga?: boolean | null
  hogarCategoriaId?: string | null
  tipoIngreso?: "salario" | "extra" | null
  obligacionId?: string | null
  obligacionTipo?: "deuda" | "fijo" | null
  /** Pago de obligación por un valor distinto a la cuota: "con este valor quedó pagada" */
  cuotaCompleta?: boolean | null
  bolsilloId?: string | null
  cuota?: number | null
  diaPago?: number | null
  tasaMensual?: number | null
  esTarjeta?: boolean | null
  /** Addi, Sistecrédito, Brilla… (cupo como una tarjeta) */
  esCreditoCompras?: boolean | null
  /** Cupo total de la tarjeta o crédito de compras */
  cupo?: number | null
  frecuencia?: "mensual" | "quincenal" | "semanal" | "anual" | null
  icono?: string | null
  persona?: string | null
  fechaCompromiso?: string | null
  meDebenId?: string | null
  faltan: string[]
}

/** Destinos que el usuario puede elegir para un monto (el "¿a dónde va?"). */
export const DESTINOS: { tipo: TipoAccion; label: string; emoji: string; ayuda: string }[] = [
  { tipo: "gasto", label: tr("Gasto"), emoji: "🧾", ayuda: tr("Algo que compraste o pagaste") },
  { tipo: "pago_obligacion", label: tr("Pago de obligación"), emoji: "🏦", ayuda: tr("Cuota de una deuda o gasto fijo") },
  { tipo: "ingreso", label: tr("Ingreso"), emoji: "💰", ayuda: tr("Plata que te entró") },
  { tipo: "ahorro", label: tr("Ahorro"), emoji: "🐷", ayuda: tr("Depósito a un bolsillo") },
  { tipo: "me_deben", label: tr("Le presté"), emoji: "🤝", ayuda: tr("Me deben") },
  { tipo: "abono_me_deben", label: tr("Me pagaron un préstamo"), emoji: "↩️", ayuda: tr("Abono de alguien que te debe") },
  { tipo: "crear_deuda", label: tr("Deuda nueva"), emoji: "💳", ayuda: tr("Préstamo o tarjeta nueva") },
  { tipo: "crear_gasto_fijo", label: tr("Gasto fijo nuevo"), emoji: "📅", ayuda: tr("Pago que se repite") },
  { tipo: "crear_bolsillo", label: tr("Meta de ahorro nueva"), emoji: "🎯", ayuda: tr("Bolsillo nuevo") },
  { tipo: "crear_categoria", label: tr("Categoría nueva"), emoji: "🏷️", ayuda: tr("Categoría de presupuesto") },
]

export const etiquetaTipo = (t: TipoAccion) => DESTINOS.find(d => d.tipo === t) ?? { tipo: t, label: tr("¿A dónde va?"), emoji: "❓", ayuda: tr("Elige a qué corresponde") }

/** ¿Qué le falta a esta acción para poder guardarse? (se recalcula al editar) */
export function faltantes(a: Accion): string[] {
  const f: string[] = []
  if (a.tipo === "sin_destino") f.push(tr("Elige a dónde va este monto"))
  const lineaSinUsar = a.tipo === "crear_deuda" && !!(a.esTarjeta || a.esCreditoCompras) && Number(a.cupo) > 0
  if (!(a.monto > 0) && a.tipo !== "crear_categoria" && !lineaSinUsar) f.push(tr("Escribe el monto"))
  if (!a.nombre.trim() && a.tipo !== "sin_destino") f.push(tr("Escribe un nombre"))
  if (a.tipo === "pago_obligacion" && !a.obligacionId) f.push(tr("Elige qué obligación pagaste"))
  if (a.tipo === "ahorro" && !a.bolsilloId) f.push(tr("Elige el bolsillo"))
  // En una tarjeta o crédito de compras sin usar ($0 ocupado) no hay cuota
  if (a.tipo === "crear_deuda" && !(Number(a.cuota) > 0) && a.monto > 0) f.push(tr("Escribe la cuota"))
  if (a.tipo === "crear_deuda" && (a.esTarjeta || a.esCreditoCompras) && !(a.monto > 0) && !(Number(a.cupo) > 0)) f.push(tr("Escribe el cupo"))
  if (a.tipo === "me_deben" && !a.persona?.trim()) f.push(tr("¿A quién le prestaste?"))
  if (a.tipo === "abono_me_deben" && !a.meDebenId) f.push(tr("Elige quién te pagó"))
  return f
}

// ─── Datos para los selectores ────────────────────────────────────────────────

export interface Destinos {
  categorias: BudgetCategory[]
  bolsillos: SavingsPocket[]
  meDeben: ExternalLoan[]
  hogar: { pareja: string; categorias: HogarCategoria[] } | null
  cargando: boolean
  recargar: () => void
}

export function useDestinos(activo = true): Destinos {
  const [categorias, setCategorias] = useState<BudgetCategory[]>([])
  const [bolsillos, setBolsillos] = useState<SavingsPocket[]>([])
  const [meDeben, setMeDeben] = useState<ExternalLoan[]>([])
  const [hogar, setHogar] = useState<Destinos["hogar"]>(null)
  const [cargando, setCargando] = useState(false)
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!activo) return
    let vivo = true
    setCargando(true)
    Promise.all([budgetCategoriesApi.list("gasto"), savingsPocketsApi.list(), externalLoansApi.list(), hogarApi.resumen()]).then(([c, b, l, h]) => {
      if (!vivo) return
      setCategorias(c.data?.categories ?? [])
      setBolsillos(b.data?.pockets ?? [])
      setMeDeben((l.data?.loans ?? []).filter(x => x.estado === "activo"))
      setHogar(h.data?.conectado && h.data.habilitado !== false ? { pareja: h.data.pareja?.nombre.split(" ")[0] ?? tr("tu pareja"), categorias: h.data.categorias ?? [] } : null)
      setCargando(false)
    })
    return () => { vivo = false }
  }, [activo, n])

  return { categorias, bolsillos, meDeben, hogar, cargando, recargar: () => setN(x => x + 1) }
}

// ─── Ejecutar (solo tras confirmar) ───────────────────────────────────────────

/** Día de pago que dijo el usuario, dentro de 1–31 (sin día: hoy). */
const diaDelMes = (dia: number | null | undefined) => String(Math.min(Math.max(Math.round(dia ?? new Date().getDate()), 1), 31))

export function useEjecutarAcciones() {
  const { addImpulseExpense, addDebt, addFixedExpense, refetch } = useFinanceData()

  const ejecutarUna = useCallback(async (a: Accion): Promise<string | null> => {
    const nombre = a.nombre.trim()
    switch (a.tipo) {
      case "gasto": {
        let categoriaId = a.categoriaId ?? null
        if (!categoriaId && a.categoriaNueva?.trim()) {
          const { data, error } = await budgetCategoriesApi.create({ nombre: a.categoriaNueva.trim().slice(0, 50), tipo: "gasto", icono: "more", montoLimite: 0 })
          if (error || !data) return tr("No se pudo crear la categoría {0}", [a.categoriaNueva])
          categoriaId = data.category.id
        }
        const r = await addImpulseExpense({
          nombre, monto: a.monto, categoria: "otro",
          esHormiga: a.esHormiga ?? undefined,
          budgetCategoryId: categoriaId,
          sharedCategoryId: a.hogarCategoriaId ?? null,
        })
        return r ? null : tr("No se pudo registrar el gasto \"{0}\"", [nombre])
      }
      case "ingreso": {
        const { error } = await userApi.walletIncome(a.monto, a.tipoIngreso === "salario" ? "salario" : "extra")
        return error ? tr("No se pudo registrar el ingreso: {0}", [error]) : null
      }
      case "pago_obligacion": {
        if (!a.obligacionId) return tr("Falta elegir la obligación")
        const cuotaCompleta = !!a.cuotaCompleta
        const { error } = a.obligacionTipo === "fijo"
          ? await fixedExpensesApi.pay(a.obligacionId, a.monto, undefined, cuotaCompleta)
          : await debtsApi.pay(a.obligacionId, a.monto, undefined, cuotaCompleta ? { cuotaCompleta } : {})
        return error ? tr("No se pudo pagar \"{0}\": {1}", [nombre, error]) : null
      }
      case "ahorro": {
        if (!a.bolsilloId) return tr("Falta elegir el bolsillo")
        const { error } = await savingsPocketsApi.deposit(a.bolsilloId, a.monto)
        return error ? tr("No se pudo ahorrar: {0}", [error]) : null
      }
      case "crear_categoria": {
        // Las categorías admiten 50 letras; la IA a veces propone nombres más largos
        const { error } = await budgetCategoriesApi.create({ nombre: nombre.slice(0, 50), tipo: "gasto", icono: a.icono ?? "more", montoLimite: a.monto || 0, frecuenciaLimite: a.frecuencia === "quincenal" ? "quincenal" : "mensual" })
        return error ? tr("No se pudo crear la categoría: {0}", [error]) : null
      }
      case "crear_deuda": {
        const esLinea = !!(a.esTarjeta || a.esCreditoCompras)
        const saved = await addDebt({
          nombre, montoTotal: a.monto, saldoRestante: a.monto, cuotaPeriodo: Number(a.cuota) || 0,
          // Tarjeta sin día: fin de mes
          diasPago: a.diaPago ? diaDelMes(a.diaPago) : esLinea ? "31" : "1", tasaInteres: a.tasaMensual ?? undefined,
          tipoDeuda: a.esCreditoCompras ? "CREDITO_COMPRAS" : a.esTarjeta ? "TARJETA_CREDITO" : "PRESTAMO",
          cupoTotal: esLinea && Number(a.cupo) > 0 ? Number(a.cupo) : null,
          frecuenciaPago: !esLinea && a.frecuencia === "quincenal" ? "quincenal" : "mensual",
          nuevaProximoPeriodo: true,
        })
        return saved ? null : tr("No se pudo crear la deuda \"{0}\"", [nombre])
      }
      case "crear_gasto_fijo": {
        // El día tal cual ("30"), como lo guarda el formulario: la fecha que se
        // mandaba antes topaba el día en 28 (el arriendo del 30 quedaba el 28)
        const saved = await addFixedExpense({ nombre, monto: a.monto, fechaCorte: diaDelMes(a.diaPago), frecuencia: a.frecuencia ?? "mensual", nuevaProximoPeriodo: true })
        return saved ? null : tr("No se pudo crear el gasto fijo \"{0}\"", [nombre])
      }
      case "crear_bolsillo": {
        const { error } = await savingsPocketsApi.create({ nombre, meta: a.monto, icono: "piggy-bank", color: "#10B981" })
        return error ? tr("No se pudo crear el bolsillo: {0}", [error]) : null
      }
      case "me_deben": {
        const { error } = await externalLoansApi.create({ persona: a.persona?.trim() || nombre, monto: a.monto, fechaCompromiso: a.fechaCompromiso ?? null, salioDeBilletera: true })
        return error ? tr("No se pudo registrar el préstamo: {0}", [error]) : null
      }
      case "abono_me_deben": {
        if (!a.meDebenId) return tr("Falta elegir quién te pagó")
        const { error } = await externalLoansApi.abono(a.meDebenId, { monto: a.monto, entraABilletera: true })
        return error ? tr("No se pudo registrar el abono: {0}", [error]) : null
      }
      default:
        return tr("Elige a dónde va este monto")
    }
  }, [addImpulseExpense, addDebt, addFixedExpense])

  /** Ejecuta en orden (las categorías nuevas antes que los gastos). Devuelve los errores. */
  const ejecutar = useCallback(async (acciones: Accion[]): Promise<{ ok: number; errores: { id: string; mensaje: string }[] }> => {
    const orden = [...acciones].sort((x, y) => Number(y.tipo === "crear_categoria") - Number(x.tipo === "crear_categoria"))
    const errores: { id: string; mensaje: string }[] = []
    let ok = 0
    for (const a of orden) {
      const e = await ejecutarUna(a)
      if (e) errores.push({ id: a.id, mensaje: e })
      else ok++
    }
    await refetch()
    window.dispatchEvent(new Event("kiri:wallet-updated"))
    window.dispatchEvent(new Event("kiri:hogar-updated"))
    window.dispatchEvent(new Event("kiri:acciones-guardadas"))
    return { ok, errores }
  }, [ejecutarUna, refetch])

  return { ejecutar }
}

// ─── Llamadas a la IA (backend, con login) ────────────────────────────────────

/** Escenario que Kiri Coach quiere simular (las cifras las calcula el frontend). */
export interface SimulacionIA {
  tipo: "ahorro_futuro" | "ahorro_meta" | "compra_cuotas"
  nombre: string | null
  monto: number | null
  aporte: number | null
  meses: number | null
  fecha: string | null
  inicial: number | null
  tasaAnual: number | null
}
export interface RespuestaCoach { respuesta: string; acciones: Accion[]; sugerencias: string[]; ir: { ruta: string; etiqueta: string } | null; simulacion?: SimulacionIA | null; uso?: UsoIA }
export interface RespuestaDictado { resumen: string; acciones: Accion[]; confianza: "alta" | "media" | "baja"; uso?: UsoIA }
export interface RespuestaRecibo {
  esRecibo: boolean; establecimiento: string; fecha: string | null; total: number
  items: { descripcion: string; monto: number }[]; nombreClaro: boolean; confianza: "alta" | "media" | "baja"; acciones: Accion[]
  uso?: UsoIA
}

/** Cuánto se lleva de cada cuota mensual de IA (se renueva el día 1). */
export interface UsoIA { usados: number; limite: number; ilimitado?: boolean; restantes: number | null }
export interface UsoIAMes { periodo: string; plan: string; tier: string; coach: UsoIA; dictado: UsoIA; escaneo: UsoIA }

export const iaApi = {
  estado: () => api<{ activa: boolean }>("/ai/estado"),
  uso: () => api<UsoIAMes>("/ai/uso"),
  coach: (mensaje: string, historial: { rol: "usuario" | "coach"; texto: string }[], pantalla?: string) =>
    api<RespuestaCoach>("/ai/coach", { method: "POST", body: { mensaje, historial, ...(pantalla ? { pantalla } : {}) } }),
  dictado: (transcripcion: string) => api<RespuestaDictado>("/ai/dictado", { method: "POST", body: { transcripcion } }),
  recibo: (imageBase64: string, mimeType: string) => api<RespuestaRecibo>("/ai/recibo", { method: "POST", body: { imageBase64, mimeType } }),
}

/** Nombre legible de la pantalla actual, para que el coach sepa dónde está el usuario. */
export function pantallaActual(pathname: string): string {
  const mapa: Record<string, string> = {
    "/jardin": tr("Árbol Kiri"), "/dashboard": tr("Inicio"), "/gestion": tr("Gestión"), "/obligaciones": tr("Obligaciones"),
    "/balance": tr("Balance"), "/ahorro": tr("Ahorro"), "/social": tr("Social"), "/misiones": tr("Misiones"), "/perfil": tr("Perfil"),
  }
  const base = Object.keys(mapa).find(k => pathname.startsWith(k))
  const tab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null
  return base ? `${mapa[base]}${tab ? ` › ${tab}` : ""}` : pathname
}
