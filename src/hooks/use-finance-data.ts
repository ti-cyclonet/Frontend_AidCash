"use client"

import { useState, useEffect, useCallback } from "react"
import {
  debtsApi,
  fixedExpensesApi,
  savingsApi,
  extraIncomesApi,
  impulseApi,
  userApi,
} from "@/lib/api-client"
import { Debt, FixedExpense, ExtraIncome, ImpulseExpense, ImpulseCategory, IncomeFrequency } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface SavingsEntry {
  id: string
  periodo: string
  monto: number
  tipo: 'ahorro' | 'sin_ahorro'
  created_at: string
}

export interface UserProfile {
  nombre: string
  correo: string
  ingreso_base: number
  frecuencia_ingreso: IncomeFrequency
  onboarding_done: boolean
  meta_ahorro_global: number
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapDebt(row: Record<string, unknown>): Debt {
  return {
    id: row.id as string,
    userId: (row.userId ?? row.user_id) as string,
    nombre: row.nombre as string,
    montoTotal: Number(row.montoTotal ?? row.monto_total ?? 0),
    saldoRestante: Number(row.saldoRestante ?? row.saldo_restante ?? row.montoTotal ?? 0),
    cuotaPeriodo: Number(row.cuotaPeriodo ?? row.cuota_periodo ?? 0),
    montoPagadoEstePeriodo: row.montoPagadoEstePeriodo != null ? Number(row.montoPagadoEstePeriodo) : (row.monto_pagado_este_periodo != null ? Number(row.monto_pagado_este_periodo) : null),
    tasaInteres: row.tasaInteres != null ? Number(row.tasaInteres) : (row.tasa_interes != null ? Number(row.tasa_interes) : null),
    acreedor: (row.acreedor as string) ?? '',
    frecuenciaPago: ((row.frecuenciaPago ?? row.frecuencia_pago) as Debt["frecuenciaPago"]) ?? 'mensual',
    diasPago: (row.diasPago ?? row.dias_pago ?? '1') as string,
    pagadoEstePeriodo: (row.pagadoEstePeriodo ?? row.pagado_este_periodo ?? false) as boolean,
    estado: (row.estado as Debt["estado"]) ?? 'activa',
    prioridad: (row.prioridad as Debt["prioridad"]) ?? 'media',
    pagoAutomatico: (row.pagoAutomatico ?? row.pago_automatico ?? false) as boolean,
  }
}

function mapFixed(row: Record<string, unknown>): FixedExpense {
  return {
    id: row.id as string,
    userId: (row.userId ?? row.user_id) as string,
    nombre: row.nombre as string,
    monto: Number(row.monto ?? 0),
    categoria: ((row.categoria as FixedExpense['categoria']) ?? 'otro'),
    fechaCorte: (row.fechaCorte ?? row.fecha_corte) as string,
    frecuencia: ((row.frecuencia as FixedExpense['frecuencia']) ?? 'mensual'),
    metodoPago: (row.metodoPago ?? row.metodo_pago) as string | null ?? null,
    renovacionAuto: (row.renovacionAuto ?? row.renovacion_auto ?? false) as boolean,
    pagadoEstePeriodo: (row.pagadoEstePeriodo ?? row.pagado_este_periodo ?? false) as boolean,
    pagoAutomatico: (row.pagoAutomatico ?? row.pago_automatico ?? false) as boolean,
  }
}

function mapSavings(row: Record<string, unknown>): SavingsEntry {
  return {
    id: row.id as string,
    periodo: row.periodo as string,
    monto: Number(row.monto ?? 0),
    tipo: (row.tipo as SavingsEntry['tipo']) ?? 'ahorro',
    created_at: (row.createdAt ?? row.created_at) as string,
  }
}

function mapExtraIncome(row: Record<string, unknown>): ExtraIncome {
  return {
    id: row.id as string,
    userId: (row.userId ?? row.user_id) as string,
    nombre: row.nombre as string,
    monto: Number(row.monto ?? 0),
    temporalidad: (row.temporalidad as ExtraIncome['temporalidad']) ?? 'una_vez',
    mesesRestantes: (row.mesesRestantes ?? row.meses_restantes) as number | null,
  }
}

function mapImpulse(row: Record<string, unknown>): ImpulseExpense {
  return {
    id: row.id as string,
    userId: (row.userId ?? row.user_id) as string,
    nombre: row.nombre as string,
    monto: Number(row.monto ?? 0),
    categoria: ((row.categoria as ImpulseCategory) ?? 'otro'),
    periodo: row.periodo as string,
    createdAt: (row.createdAt ?? row.created_at) as string,
  }
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useFinanceData() {
  const { user: authUser } = useAuth()
  const userId = authUser?.id ?? null

  const [debts, setDebts] = useState<Debt[]>([])
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [savingsHistory, setSavingsHistory] = useState<SavingsEntry[]>([])
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([])
  const [impulseExpenses, setImpulseExpenses] = useState<ImpulseExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    setDbError(null)
    try {
      const [debtsRes, fixedRes, savingsRes, extraRes, impulseRes] = await Promise.all([
        debtsApi.list(),
        fixedExpensesApi.list(),
        savingsApi.list(),
        extraIncomesApi.list(),
        impulseApi.list(),
      ])

      const firstError = debtsRes.error || fixedRes.error || savingsRes.error || extraRes.error || impulseRes.error
      if (firstError) {
        setDbError(firstError)
      } else {
        setDebts((debtsRes.data?.debts ?? []).map(mapDebt))
        setFixedExpenses((fixedRes.data?.fixedExpenses ?? []).map(mapFixed))
        setSavingsHistory((savingsRes.data?.history ?? []).map(mapSavings))
        setExtraIncomes((extraRes.data?.extraIncomes ?? []).map(mapExtraIncome))
        setImpulseExpenses((impulseRes.data?.expenses ?? []).map(mapImpulse))
      }
    } catch (err) {
      setDbError('Error de conexión con el servidor')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Perfil de usuario ──────────────────────────────────────────────────────

  const fetchUserProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!userId) return null
    const { data, error } = await userApi.getProfile()
    if (error || !data) return null
    const u = data.user
    return {
      nombre:             (u.nombre as string) ?? "",
      correo:             (u.correo as string) ?? "",
      ingreso_base:       Number(u.ingresoBase ?? 0),
      frecuencia_ingreso: (u.frecuenciaIngreso as IncomeFrequency) ?? 'mensual',
      onboarding_done:    (u.onboardingDone as boolean) ?? false,
      meta_ahorro_global: Number(u.metaAhorroGlobal ?? 5000),
    }
  }, [userId])

  const updateUserProfile = useCallback(async (
    patch: Partial<Pick<UserProfile, 'nombre' | 'ingreso_base' | 'frecuencia_ingreso' | 'onboarding_done' | 'meta_ahorro_global'>> & { diasPago?: number[] }
  ): Promise<{ error: string | null }> => {
    if (!userId) return { error: 'Sin sesión activa' }
    const apiPatch: Record<string, unknown> = {}
    if (patch.nombre             !== undefined) apiPatch.nombre             = patch.nombre
    if (patch.ingreso_base       !== undefined) apiPatch.ingresoBase        = patch.ingreso_base
    if (patch.frecuencia_ingreso !== undefined) apiPatch.frecuenciaIngreso  = patch.frecuencia_ingreso
    if (patch.onboarding_done    !== undefined) apiPatch.onboardingDone     = patch.onboarding_done
    if (patch.meta_ahorro_global !== undefined) apiPatch.metaAhorroGlobal   = patch.meta_ahorro_global
    if (patch.diasPago           !== undefined) apiPatch.diasPago           = patch.diasPago

    const { error } = await userApi.updateProfile(apiPatch)
    return { error }
  }, [userId])

  // ─── Deudas ─────────────────────────────────────────────────────────────────

  const addDebt = async (data: { nombre: string; montoTotal: number; cuotaPeriodo: number; acreedor?: string; frecuenciaPago?: string; diasPago?: string; tasaInteres?: number; prioridad?: string; saldoRestante?: number }) => {
    if (!userId) return
    await debtsApi.create({
      nombre: data.nombre,
      montoTotal: data.montoTotal,
      saldoRestante: data.saldoRestante,
      cuotaPeriodo: data.cuotaPeriodo,
      acreedor: data.acreedor,
      frecuenciaPago: data.frecuenciaPago as 'mensual' | 'quincenal' | undefined,
      diasPago: data.diasPago,
      tasaInteres: data.tasaInteres,
      prioridad: data.prioridad as 'alta' | 'media' | 'baja' | undefined,
    })
    await fetchAll()
  }

  const updateDebt = async (
    debtId: string,
    data: Partial<Pick<Debt, 'nombre' | 'montoTotal' | 'cuotaPeriodo' | 'diasPago' | 'pagoAutomatico'>>
  ) => {
    await debtsApi.update(debtId, data)
    setDebts(prev => prev.map(d => d.id === debtId ? { ...d, ...data } : d))
  }

  const deleteDebt = async (debtId: string) => {
    await debtsApi.delete(debtId)
    setDebts(prev => prev.filter(d => d.id !== debtId))
  }

  const markPaid = async (debtId: string, montoPagado?: number) => {
    const debt = debts.find(d => d.id === debtId)
    if (!debt) return

    // montoPagado: si no se especifica, se paga la cuota completa
    const realPaid = montoPagado ?? debt.cuotaPeriodo

    // Acumular pagos parciales del periodo
    const prevPaid = debt.montoPagadoEstePeriodo ?? 0
    const totalPaidThisPeriod = prevPaid + realPaid
    const cuotaCubierta = totalPaidThisPeriod >= debt.cuotaPeriodo

    // Llamar al backend que resta del saldoRestante y guarda montoPagadoEstePeriodo
    const { data } = await debtsApi.pay(debtId, realPaid)
    if (!data) return

    // Deducir del sueldo real (cashBalance) el monto REAL pagado
    await userApi.walletDeduct(realPaid, 'obligaciones')

    // Actualizar estado local con datos del backend
    const nuevoSaldo = data.saldoNuevo ?? Math.max(0, debt.saldoRestante - realPaid)
    const liquidada = data.liquidada ?? nuevoSaldo <= 0

    setDebts(prev => prev.map(d =>
      d.id === debtId ? {
        ...d,
        saldoRestante: nuevoSaldo,
        pagadoEstePeriodo: cuotaCubierta, // Solo marcar si se cubrió la cuota completa
        montoPagadoEstePeriodo: totalPaidThisPeriod,
        estado: liquidada ? 'saldada' : 'activa',
      } : d
    ))
  }

  const undoPayDebt = async (debtId: string) => {
    const { data } = await debtsApi.undoPay(debtId)
    if (!data) return
    // Actualizar estado local con los datos que devolvió el backend
    setDebts(prev => prev.map(d =>
      d.id === debtId ? {
        ...d,
        saldoRestante: Number((data.debt as Record<string, unknown>).saldoRestante ?? d.saldoRestante),
        pagadoEstePeriodo: false,
        estado: 'activa' as const,
      } : d
    ))
    return data.wallet
  }

  // ─── Gastos fijos ────────────────────────────────────────────────────────────

  const addFixedExpense = async (data: Omit<FixedExpense, "id" | "userId" | "pagadoEstePeriodo" | "renovacionAuto" | "frecuencia" | "categoria" | "metodoPago"> & { categoria?: string; frecuencia?: string; metodoPago?: string; renovacionAuto?: boolean }) => {
    if (!userId) return
    await fixedExpensesApi.create({
      nombre: data.nombre,
      monto: data.monto,
      fechaCorte: data.fechaCorte,
      categoria: data.categoria as 'vivienda' | 'servicios' | 'internet' | 'transporte' | 'educacion' | 'salud' | 'suscripciones' | 'otro' | undefined,
      frecuencia: data.frecuencia as 'mensual' | 'quincenal' | 'semanal' | 'anual' | undefined,
      metodoPago: data.metodoPago,
      renovacionAuto: data.renovacionAuto,
    })
    await fetchAll()
  }

  const updateFixedExpense = async (
    id: string,
    data: Partial<Pick<FixedExpense, 'nombre' | 'monto' | 'fechaCorte' | 'frecuencia' | 'categoria' | 'metodoPago' | 'renovacionAuto' | 'pagoAutomatico'>>
  ) => {
    await fixedExpensesApi.update(id, data)
    setFixedExpenses(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
  }

  const deleteFixedExpense = async (id: string) => {
    await fixedExpensesApi.delete(id)
    setFixedExpenses(prev => prev.filter(f => f.id !== id))
  }

  const markFixedPaid = async (id: string, montoPagado?: number) => {
    const fe = fixedExpenses.find(f => f.id === id)
    if (!fe) return

    // Si es quincenal, el monto por periodo es la mitad del total
    const montoPorPeriodo = (fe as any).frecuencia === "quincenal" ? Math.round(fe.monto / 2) : fe.monto
    const realPaid = montoPagado ?? montoPorPeriodo

    // Usar el endpoint /pay que maneja la lógica de tarjeta vinculada correctamente
    const { data: payResult } = await fixedExpensesApi.pay(id, realPaid)

    // Si NO se pagó con tarjeta, deducir del cashBalance
    if (!payResult?.pagoConTarjeta) {
      await userApi.walletDeduct(realPaid, 'obligaciones')
    }

    // Acumular pagos parciales para el estado local
    const prevPaid = (fe as any).montoPagadoEstePeriodo ?? 0
    const totalPaid = prevPaid + realPaid
    const isFullyPaid = totalPaid >= fe.monto

    setFixedExpenses(prev => prev.map(f => f.id === id ? {
      ...f,
      pagadoEstePeriodo: isFullyPaid,
      montoPagadoEstePeriodo: totalPaid,
    } as any : f))
  }

  const undoPayFixed = async (id: string) => {
    const { data } = await fixedExpensesApi.undoPay(id)
    if (!data) return
    setFixedExpenses(prev => prev.map(f => f.id === id ? { ...f, pagadoEstePeriodo: false, montoPagadoEstePeriodo: null } : f))
    return data.wallet
  }

  // ─── Ingresos extra ──────────────────────────────────────────────────────────

  const addExtraIncome = async (data: Omit<ExtraIncome, 'id' | 'userId'>) => {
    if (!userId) return
    await extraIncomesApi.create({
      nombre: data.nombre,
      monto: data.monto,
      temporalidad: data.temporalidad,
      mesesRestantes: data.mesesRestantes,
      fechaRecepcion: data.fechaRecepcion || undefined,
    })
    await fetchAll()
  }

  const updateExtraIncome = async (
    id: string,
    data: Partial<Pick<ExtraIncome, 'nombre' | 'monto' | 'temporalidad' | 'mesesRestantes'>>
  ) => {
    await extraIncomesApi.update(id, data as Record<string, unknown>)
    setExtraIncomes(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }

  const removeExtraIncome = async (id: string) => {
    await extraIncomesApi.delete(id)
    setExtraIncomes(prev => prev.filter(e => e.id !== id))
  }

  // ─── Ahorro ──────────────────────────────────────────────────────────────────

  const addSavingsEntry = async (monto: number, tipo: SavingsEntry['tipo'], skipWalletDeduct = false) => {
    if (!userId) return
    await savingsApi.create(monto, tipo)
    // Si es ahorro real y no se pidió omitir la deducción (para evitar doble deducción)
    if (tipo === 'ahorro' && monto > 0 && !skipWalletDeduct) {
      await userApi.walletDeduct(monto, 'ahorro')
    }
    await fetchAll()
  }

  // ─── Gastos hormiga ───────────────────────────────────────────────────────────

  const addImpulseExpense = async (data: { nombre: string; monto: number; categoria: ImpulseCategory }) => {
    if (!userId) return null
    const { data: result } = await impulseApi.create({
      nombre: data.nombre,
      monto: data.monto,
      categoria: data.categoria,
    })
    if (result?.expense) {
      const mapped = mapImpulse(result.expense)
      setImpulseExpenses(prev => [mapped, ...prev])
      // Deducir del bolsillo "libre"
      await userApi.walletDeduct(data.monto, 'libre')
      return mapped
    }
    return null
  }

  const removeImpulseExpense = async (id: string) => {
    await impulseApi.delete(id)
    setImpulseExpenses(prev => prev.filter(e => e.id !== id))
  }

  // Total de gastos hormiga del periodo actual
  // El backend ya filtra por el periodo actual (quincena o mes según frecuencia del usuario).
  // impulseExpenses contiene SOLO los del periodo vigente.
  const impulseThisPeriod = impulseExpenses
  const totalImpulseThisPeriod = impulseThisPeriod.reduce((acc, e) => acc + e.monto, 0)

  // ─── Derivados ───────────────────────────────────────────────────────────────

  const totalAhorrado = savingsHistory
    .filter(e => e.tipo === 'ahorro')
    .reduce((acc, e) => acc + e.monto, 0)

  const totalExtraIncome = extraIncomes.reduce((acc, e) => acc + e.monto, 0)

  return {
    debts, fixedExpenses, savingsHistory, totalAhorrado,
    extraIncomes, totalExtraIncome,
    loading, dbError,

    impulseExpenses, impulseThisPeriod, totalImpulseThisPeriod,
    addImpulseExpense, removeImpulseExpense,

    fetchUserProfile,
    updateUserProfile,

    addDebt, updateDebt, deleteDebt, markPaid, undoPayDebt,

    addFixedExpense, updateFixedExpense, deleteFixedExpense, markFixedPaid, undoPayFixed,

    addExtraIncome, updateExtraIncome, removeExtraIncome,

    addSavingsEntry,

    refetch: fetchAll,
  }
}
