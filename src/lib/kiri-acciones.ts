"use client"

import { useCallback, useEffect, useState } from "react"
import {
  api, budgetCategoriesApi, savingsPocketsApi, hogarApi, externalLoansApi, userApi,
  debtsApi, fixedExpensesApi,
  type BudgetCategory, type SavingsPocket, type ExternalLoan, type HogarCategoria,
} from "@/lib/api-client"
import { useFinanceData } from "@/hooks/use-finance-data"

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
  bolsilloId?: string | null
  cuota?: number | null
  diaPago?: number | null
  tasaMensual?: number | null
  esTarjeta?: boolean | null
  frecuencia?: "mensual" | "quincenal" | "semanal" | "anual" | null
  icono?: string | null
  persona?: string | null
  fechaCompromiso?: string | null
  meDebenId?: string | null
  faltan: string[]
}

/** Destinos que el usuario puede elegir para un monto (el "¿a dónde va?"). */
export const DESTINOS: { tipo: TipoAccion; label: string; emoji: string; ayuda: string }[] = [
  { tipo: "gasto", label: "Gasto", emoji: "🧾", ayuda: "Algo que compraste o pagaste" },
  { tipo: "pago_obligacion", label: "Pago de obligación", emoji: "🏦", ayuda: "Cuota de una deuda o gasto fijo" },
  { tipo: "ingreso", label: "Ingreso", emoji: "💰", ayuda: "Plata que te entró" },
  { tipo: "ahorro", label: "Ahorro", emoji: "🐷", ayuda: "Depósito a un bolsillo" },
  { tipo: "me_deben", label: "Le presté", emoji: "🤝", ayuda: "Me deben" },
  { tipo: "abono_me_deben", label: "Me pagaron un préstamo", emoji: "↩️", ayuda: "Abono de alguien que te debe" },
  { tipo: "crear_deuda", label: "Deuda nueva", emoji: "💳", ayuda: "Préstamo o tarjeta nueva" },
  { tipo: "crear_gasto_fijo", label: "Gasto fijo nuevo", emoji: "📅", ayuda: "Pago que se repite" },
  { tipo: "crear_bolsillo", label: "Meta de ahorro nueva", emoji: "🎯", ayuda: "Bolsillo nuevo" },
  { tipo: "crear_categoria", label: "Categoría nueva", emoji: "🏷️", ayuda: "Categoría de presupuesto" },
]

export const etiquetaTipo = (t: TipoAccion) => DESTINOS.find(d => d.tipo === t) ?? { tipo: t, label: "¿A dónde va?", emoji: "❓", ayuda: "Elige a qué corresponde" }

/** ¿Qué le falta a esta acción para poder guardarse? (se recalcula al editar) */
export function faltantes(a: Accion): string[] {
  const f: string[] = []
  if (a.tipo === "sin_destino") f.push("Elige a dónde va este monto")
  if (!(a.monto > 0) && a.tipo !== "crear_categoria") f.push("Escribe el monto")
  if (!a.nombre.trim() && a.tipo !== "sin_destino") f.push("Escribe un nombre")
  if (a.tipo === "pago_obligacion" && !a.obligacionId) f.push("Elige qué obligación pagaste")
  if (a.tipo === "ahorro" && !a.bolsilloId) f.push("Elige el bolsillo")
  if (a.tipo === "crear_deuda" && !(Number(a.cuota) > 0)) f.push("Escribe la cuota")
  if (a.tipo === "me_deben" && !a.persona?.trim()) f.push("¿A quién le prestaste?")
  if (a.tipo === "abono_me_deben" && !a.meDebenId) f.push("Elige quién te pagó")
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
      setHogar(h.data?.conectado && h.data.habilitado !== false ? { pareja: h.data.pareja?.nombre.split(" ")[0] ?? "tu pareja", categorias: h.data.categorias ?? [] } : null)
      setCargando(false)
    })
    return () => { vivo = false }
  }, [activo, n])

  return { categorias, bolsillos, meDeben, hogar, cargando, recargar: () => setN(x => x + 1) }
}

// ─── Ejecutar (solo tras confirmar) ───────────────────────────────────────────

const hoyMasDia = (dia: number | null | undefined) => {
  const now = new Date()
  const d = Math.min(Math.max(dia ?? now.getDate(), 1), 28)
  const f = new Date(now.getFullYear(), now.getMonth() + (dia && dia < now.getDate() ? 1 : 0), d)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`
}

export function useEjecutarAcciones() {
  const { addImpulseExpense, addDebt, addFixedExpense, refetch } = useFinanceData()

  const ejecutarUna = useCallback(async (a: Accion): Promise<string | null> => {
    const nombre = a.nombre.trim()
    switch (a.tipo) {
      case "gasto": {
        let categoriaId = a.categoriaId ?? null
        if (!categoriaId && a.categoriaNueva?.trim()) {
          const { data, error } = await budgetCategoriesApi.create({ nombre: a.categoriaNueva.trim(), tipo: "gasto", icono: "more", montoLimite: 0 })
          if (error || !data) return `No se pudo crear la categoría ${a.categoriaNueva}`
          categoriaId = data.category.id
        }
        const r = await addImpulseExpense({
          nombre, monto: a.monto, categoria: "otro",
          esHormiga: a.esHormiga ?? undefined,
          budgetCategoryId: categoriaId,
          sharedCategoryId: a.hogarCategoriaId ?? null,
        })
        return r ? null : `No se pudo registrar el gasto "${nombre}"`
      }
      case "ingreso": {
        const { error } = await userApi.walletIncome(a.monto, a.tipoIngreso === "salario" ? "salario" : "extra")
        return error ? `No se pudo registrar el ingreso: ${error}` : null
      }
      case "pago_obligacion": {
        if (!a.obligacionId) return "Falta elegir la obligación"
        const { error } = a.obligacionTipo === "fijo"
          ? await fixedExpensesApi.pay(a.obligacionId, a.monto)
          : await debtsApi.pay(a.obligacionId, a.monto)
        return error ? `No se pudo pagar "${nombre}": ${error}` : null
      }
      case "ahorro": {
        if (!a.bolsilloId) return "Falta elegir el bolsillo"
        const { error } = await savingsPocketsApi.deposit(a.bolsilloId, a.monto)
        return error ? `No se pudo ahorrar: ${error}` : null
      }
      case "crear_categoria": {
        const { error } = await budgetCategoriesApi.create({ nombre, tipo: "gasto", icono: a.icono ?? "more", montoLimite: a.monto || 0 })
        return error ? `No se pudo crear la categoría: ${error}` : null
      }
      case "crear_deuda": {
        const saved = await addDebt({
          nombre, montoTotal: a.monto, saldoRestante: a.monto, cuotaPeriodo: Number(a.cuota),
          diasPago: String(a.diaPago ?? 1), tasaInteres: a.tasaMensual ?? undefined,
          tipoDeuda: a.esTarjeta ? "TARJETA_CREDITO" : "PRESTAMO",
          frecuenciaPago: a.frecuencia === "quincenal" ? "quincenal" : "mensual",
          nuevaProximoPeriodo: true,
        })
        return saved ? null : `No se pudo crear la deuda "${nombre}"`
      }
      case "crear_gasto_fijo": {
        const saved = await addFixedExpense({ nombre, monto: a.monto, fechaCorte: hoyMasDia(a.diaPago), frecuencia: a.frecuencia ?? "mensual", nuevaProximoPeriodo: true })
        return saved ? null : `No se pudo crear el gasto fijo "${nombre}"`
      }
      case "crear_bolsillo": {
        const { error } = await savingsPocketsApi.create({ nombre, meta: a.monto, icono: "piggy-bank", color: "#10B981" })
        return error ? `No se pudo crear el bolsillo: ${error}` : null
      }
      case "me_deben": {
        const { error } = await externalLoansApi.create({ persona: a.persona?.trim() || nombre, monto: a.monto, fechaCompromiso: a.fechaCompromiso ?? null, salioDeBilletera: true })
        return error ? `No se pudo registrar el préstamo: ${error}` : null
      }
      case "abono_me_deben": {
        if (!a.meDebenId) return "Falta elegir quién te pagó"
        const { error } = await externalLoansApi.abono(a.meDebenId, { monto: a.monto, entraABilletera: true })
        return error ? `No se pudo registrar el abono: ${error}` : null
      }
      default:
        return "Elige a dónde va este monto"
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

export interface RespuestaCoach { respuesta: string; acciones: Accion[]; sugerencias: string[]; ir: { ruta: string; etiqueta: string } | null; uso?: UsoIA }
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
    "/jardin": "Árbol Kiri", "/dashboard": "Inicio", "/gestion": "Gestión", "/obligaciones": "Obligaciones",
    "/balance": "Balance", "/ahorro": "Ahorro", "/social": "Social", "/misiones": "Misiones", "/perfil": "Perfil",
  }
  const base = Object.keys(mapa).find(k => pathname.startsWith(k))
  const tab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null
  return base ? `${mapa[base]}${tab ? ` › ${tab}` : ""}` : pathname
}
