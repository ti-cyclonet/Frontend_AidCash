"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
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
    tipoDeuda: ((row.tipoDeuda ?? row.tipo_deuda) as Debt["tipoDeuda"]) ?? 'PRESTAMO',
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
    budgetCategoryId: (row.budgetCategoryId ?? row.budget_category_id ?? null) as string | null,
    esCompartida: (row.esCompartida ?? row.es_compartida ?? false) as boolean,
    connectionId: (row.connectionId ?? row.connection_id ?? null) as string | null,
    montoParticipanteA: row.montoParticipanteA != null ? Number(row.montoParticipanteA) : null,
    montoParticipanteB: row.montoParticipanteB != null ? Number(row.montoParticipanteB) : null,
    nombreParticipanteB: (row.nombreParticipanteB ?? null) as string | null,
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
    montoPagadoEstePeriodo: row.montoPagadoEstePeriodo != null ? Number(row.montoPagadoEstePeriodo) : (row.monto_pagado_este_periodo != null ? Number(row.monto_pagado_este_periodo) : null),
    pagoAutomatico: (row.pagoAutomatico ?? row.pago_automatico ?? false) as boolean,
    tarjetaVinculadaId: (row.tarjetaVinculadaId ?? row.tarjeta_vinculada_id ?? null) as string | null,
    budgetCategoryId: (row.budgetCategoryId ?? row.budget_category_id ?? null) as string | null,
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
    tarjetaId: (row.tarjetaId ?? row.tarjeta_id ?? null) as string | null,
  }
}

// ─── Hook interno — un solo dueño del estado, ver FinanceDataProvider más abajo ─

function useFinanceDataInternal() {
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

  /**
   * Devuelve la deuda creada, o `null` si no se pudo guardar (sin sesión activa
   * todavía — puede pasar justo después de registrarse/iniciar sesión, antes de
   * que `useAuth()` termine de cargar — o error del servidor). Antes esto
   * resolvía "exitosamente" sin hacer nada si `userId` aún no estaba listo, así
   * que quien llamaba (ej. el onboarding) no tenía forma de saber que la deuda
   * nunca se guardó — revisa el valor de retorno.
   */
  const addDebt = async (data: { nombre: string; montoTotal: number; cuotaPeriodo: number; acreedor?: string; frecuenciaPago?: string; diasPago?: string; tasaInteres?: number; prioridad?: string; saldoRestante?: number; bankEntityId?: string | null; tipoDeuda?: 'PRESTAMO' | 'TARJETA_CREDITO'; yaPagoEstePeriodo?: boolean; budgetCategoryId?: string | null }) => {
    if (!userId) return null
    const { data: result, error } = await debtsApi.create({
      nombre: data.nombre,
      montoTotal: data.montoTotal,
      saldoRestante: data.saldoRestante,
      cuotaPeriodo: data.cuotaPeriodo,
      acreedor: data.acreedor,
      frecuenciaPago: data.frecuenciaPago as 'mensual' | 'quincenal' | undefined,
      diasPago: data.diasPago,
      tasaInteres: data.tasaInteres,
      prioridad: data.prioridad as 'alta' | 'media' | 'baja' | undefined,
      bankEntityId: data.bankEntityId,
      tipoDeuda: data.tipoDeuda,
      yaPagoEstePeriodo: data.yaPagoEstePeriodo,
      budgetCategoryId: data.budgetCategoryId,
    })
    if (error || !result) return null
    await fetchAll()
    return result.debt
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
    if (!debt) return null

    // montoPagado: si no se especifica, se paga la cuota completa
    const realPaid = montoPagado ?? debt.cuotaPeriodo

    // Llamar al backend — él se encarga de acumular montoPagadoEstePeriodo Y de
    // descontar la billetera, todo en una sola transacción atómica (antes era
    // una segunda llamada aparte que, si fallaba, dejaba la deuda "pagada" sin
    // que el saldo disponible bajara).
    const { data } = await debtsApi.pay(debtId, realPaid)
    if (!data) return null

    // Actualizar estado local DIRECTAMENTE con los datos del backend (fuente de verdad)
    const backendDebt = data.debt as Record<string, unknown>
    setDebts(prev => prev.map(d =>
      d.id === debtId ? {
        ...d,
        saldoRestante: Number(backendDebt.saldoRestante ?? d.saldoRestante),
        // Para una tarjeta, este pago pudo saldar un plan de cuotas y bajar la
        // cuota efectiva — el backend ya la recalcula, sin esto la tarjeta se
        // quedaba mostrando la cuota vieja hasta el próximo refetch completo.
        cuotaPeriodo: backendDebt.cuotaPeriodo != null ? Number(backendDebt.cuotaPeriodo) : d.cuotaPeriodo,
        pagadoEstePeriodo: (backendDebt.pagadoEstePeriodo ?? false) as boolean,
        montoPagadoEstePeriodo: backendDebt.montoPagadoEstePeriodo != null ? Number(backendDebt.montoPagadoEstePeriodo) : null,
        estado: (backendDebt.estado as 'activa' | 'saldada' | 'vencida') ?? d.estado,
      } : d
    ))

    // ═══ AUTO-VINCULAR A CATEGORÍA "DEUDAS" ═══
    // Antes esto creaba un gasto hormiga espejo (`[Deudas] ... (pago deuda)`)
    // cada vez que se cubría la cuota completa. Dos problemas: (1) si luego se
    // deshacía el pago, ese gasto fantasma nunca se borraba — quedaba contando
    // para siempre contra el presupuesto aunque el pago que lo originó ya no
    // existiera; (2) si la deuda YA estaba vinculada a la categoría por su
    // propio `budgetCategoryId`, el pago se contaba DOS veces (una vía el
    // gasto hormiga por coincidencia de texto, otra vía `computeCategorySpend`
    // sumando `montoPagadoEstePeriodo` directo). En vez de eso, vinculamos la
    // deuda a la categoría UNA sola vez por su `budgetCategoryId` real — el
    // mismo mecanismo que ya usan los gastos fijos (ver comentario en
    // `markFixedPaid`) — así `computeCategorySpend` sigue el pago real de cada
    // periodo sola, y deshacer el pago la vacía sola también, sin nada que limpiar.
    try {
      if (!debt.budgetCategoryId) {
        const { budgetCategoriesApi } = await import('@/lib/api-client')
        const { data: catsRes } = await budgetCategoriesApi.list()
        const debtCat = catsRes?.categories.find(c => c.nombre.toLowerCase() === 'deudas' || c.nombre.toLowerCase() === 'deuda')
        if (debtCat) {
          await debtsApi.update(debtId, { budgetCategoryId: debtCat.id })
          setDebts(prev => prev.map(d => d.id === debtId ? { ...d, budgetCategoryId: debtCat.id } : d))
        }
      }
    } catch { /* No bloquear */ }

    // Para que quien llama pueda festejar el momento exacto en que una deuda
    // queda saldada — antes esto se perdía silenciosamente: la tarjeta solo
    // se veía atenuada (opacity-40) y desaparecía del todo en el próximo
    // refetch, sin ningún "listo, terminaste de pagar esto".
    return { liquidada: backendDebt.estado === 'saldada', nombre: debt.nombre }
  }

  const undoPayDebt = async (debtId: string) => {
    const { data } = await debtsApi.undoPay(debtId)
    if (!data) return
    // Actualizar estado local DIRECTAMENTE con datos del backend (fuente de verdad)
    const backendDebt = data.debt as Record<string, unknown>
    setDebts(prev => prev.map(d =>
      d.id === debtId ? {
        ...d,
        saldoRestante: Number(backendDebt.saldoRestante ?? d.saldoRestante),
        // Deshacer este pago pudo revivir un plan de cuotas que ya estaba
        // saldado (se le devolvió su montoAbonado) — el backend ya recalcula
        // la cuota efectiva; sin esto la tarjeta se quedaba mostrando una
        // cuota más baja de lo real hasta el próximo refetch completo.
        cuotaPeriodo: backendDebt.cuotaPeriodo != null ? Number(backendDebt.cuotaPeriodo) : d.cuotaPeriodo,
        pagadoEstePeriodo: false,
        montoPagadoEstePeriodo: null,
        estado: 'activa' as const,
      } : d
    ))
    // Si el pago se hizo con tarjeta, el backend ya revirtió el saldo de esa
    // OTRA deuda (la tarjeta) — pero acá arriba solo tocamos `debtId`. Sin este
    // refetch, la tarjeta se queda mostrando el saldo inflado hasta recargar.
    if (data.revertidoDeTarjeta) {
      await fetchAll()
    }
    return data.wallet
  }

  // ─── Gastos fijos ────────────────────────────────────────────────────────────

  /** Devuelve el gasto fijo creado, o `null` si no se pudo guardar — ver nota en `addDebt`. */
  const addFixedExpense = async (data: Omit<FixedExpense, "id" | "userId" | "pagadoEstePeriodo" | "renovacionAuto" | "frecuencia" | "categoria" | "metodoPago"> & { categoria?: string; frecuencia?: string; metodoPago?: string; renovacionAuto?: boolean; pagoAutomatico?: boolean; yaPagoEstePeriodo?: boolean }) => {
    if (!userId) return null
    const { data: result, error } = await fixedExpensesApi.create({
      nombre: data.nombre,
      monto: data.monto,
      fechaCorte: data.fechaCorte,
      categoria: data.categoria as 'vivienda' | 'servicios' | 'internet' | 'transporte' | 'educacion' | 'salud' | 'suscripciones' | 'otro' | undefined,
      frecuencia: data.frecuencia as 'mensual' | 'quincenal' | 'semanal' | 'anual' | undefined,
      metodoPago: data.metodoPago,
      renovacionAuto: data.renovacionAuto,
      pagoAutomatico: data.pagoAutomatico,
      yaPagoEstePeriodo: data.yaPagoEstePeriodo,
      tarjetaVinculadaId: data.tarjetaVinculadaId,
      budgetCategoryId: data.budgetCategoryId,
    })
    if (error || !result) return null
    await fetchAll()
    return result.fixedExpense
  }

  const updateFixedExpense = async (
    id: string,
    data: Partial<Pick<FixedExpense, 'nombre' | 'monto' | 'fechaCorte' | 'frecuencia' | 'categoria' | 'metodoPago' | 'renovacionAuto' | 'pagoAutomatico' | 'tarjetaVinculadaId' | 'budgetCategoryId'>>
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

    // Usar el endpoint /pay — el backend maneja la acumulación Y, si NO se pagó
    // con tarjeta, el descuento de cashBalance, todo en una sola transacción
    // atómica (antes el descuento era una segunda llamada aparte que, si
    // fallaba, dejaba el gasto "pagado" sin que el saldo disponible bajara).
    const { data: payResult } = await fixedExpensesApi.pay(id, realPaid)

    // Actualizar estado local con datos del backend (fuente de verdad)
    if (payResult?.fixedExpense) {
      const be = payResult.fixedExpense as Record<string, unknown>
      setFixedExpenses(prev => prev.map(f => f.id === id ? {
        ...f,
        pagadoEstePeriodo: (be.pagadoEstePeriodo ?? f.pagadoEstePeriodo) as boolean,
        montoPagadoEstePeriodo: be.montoPagadoEstePeriodo != null ? Number(be.montoPagadoEstePeriodo) : null,
      } as any : f))
    }

    // ═══ AUTO-REGISTRO EN CATEGORÍA: Si el gasto fijo está vinculado a una categoría,
    // NO registrar impulseExpense — el PresupuestoTab ya lo contabiliza via linkedFixedIds.
    // Solo sugerir vinculación si NO está vinculado pero coincide con una categoría. ═══
    try {
      if (typeof window !== 'undefined') {
        const { budgetCategoriesApi } = await import('@/lib/api-client')
        const { data: catsRes } = await budgetCategoriesApi.list()
        const cats = (catsRes?.categories ?? []).map(c => ({
          id: c.id, name: c.nombre, budget: c.montoLimite, spent: 0, color: c.color, icon: c.icono, linkedFixedIds: c.linkedFixedExpenseIds,
        }))
        const linkedCat = cats.find(c => c.linkedFixedIds?.includes(id))
        if (!linkedCat) {
          // No está vinculado — sugerir categoría si coincide con alguna por keywords
          const { detectBudgetCategory } = await import('@/hooks/use-budget-categories')
          const suggested = detectBudgetCategory(fe.nombre, cats)
          if (suggested) {
            // Emitir evento para que el UI muestre sugerencia al usuario
            window.dispatchEvent(new CustomEvent('kiri:suggest-category-link', {
              detail: { fixedId: id, fixedName: fe.nombre, suggestedCategory: suggested, monto: realPaid }
            }))
          }
        }
      }
    } catch { /* No bloquear el flujo si falla la vinculación */ }
  }

  const undoPayFixed = async (id: string) => {
    const { data } = await fixedExpensesApi.undoPay(id)
    if (!data) return
    setFixedExpenses(prev => prev.map(f => f.id === id ? { ...f, pagadoEstePeriodo: false, montoPagadoEstePeriodo: null } : f))
    // Mismo caso que undoPayDebt: si se pagó con tarjeta, esa tarjeta (otra
    // Debt) ya se revirtió en el backend pero no en este estado local.
    if (data.revertidoDeTarjeta) {
      await fetchAll()
    }
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

  const addImpulseExpense = async (data: { nombre: string; monto: number; categoria: ImpulseCategory; tarjetaId?: string; cuotas?: number }) => {
    if (!userId) return null
    const { data: result } = await impulseApi.create({
      nombre: data.nombre,
      monto: data.monto,
      categoria: data.categoria,
      tarjetaId: data.tarjetaId,
      cuotas: data.cuotas,
    })
    if (result?.expense) {
      const mapped = mapImpulse(result.expense)
      setImpulseExpenses(prev => [mapped, ...prev])
      // Aviso para quien esté viendo el Árbol Kiri en ese momento (misma idea
      // que kiri:wallet-updated) — dispara la reacción de "tormenta" sin
      // acoplar este hook a la página del jardín.
      window.dispatchEvent(new CustomEvent("kiri:impulse-registered", { detail: { nombre: data.nombre } }))
      if (data.tarjetaId) {
        // Pagado con tarjeta: es un cupo de crédito consumido, no plata del
        // disponible — refrescamos todo para traer el saldo actualizado de la
        // tarjeta en vez de descontar del bolsillo "libre".
        await fetchAll()
      } else {
        // Deducir del bolsillo "libre"
        await userApi.walletDeduct(data.monto, 'libre')
      }
      return mapped
    }
    return null
  }

  const removeImpulseExpense = async (id: string) => {
    await impulseApi.delete(id)
    setImpulseExpenses(prev => prev.filter(e => e.id !== id))
    // El backend ya revirtió el saldo de la tarjeta (o del bolsillo "libre")
    // según cómo se pagó — sin este refetch, la tarjeta se queda mostrando el
    // saldo inflado hasta recargar (mismo caso que undoPayDebt/undoPayFixed).
    await fetchAll()
  }

  // Total de gastos hormiga del periodo actual
  // El backend ya filtra por el periodo actual (quincena o mes según frecuencia del usuario).
  // impulseExpenses contiene SOLO los del periodo vigente.
  const impulseThisPeriod = impulseExpenses
  // Solo los pagados en efectivo consumen el "disponible" — los pagados con
  // tarjeta (tarjetaId) no tocan cashBalance/walletLibre al crearse (ver
  // addImpulseExpense), así que incluirlos acá hacía ver el disponible más
  // bajo de lo real mientras existían, y "recuperar" plata que nunca salió
  // de la billetera al borrarlos.
  const totalImpulseThisPeriod = impulseThisPeriod.reduce((acc, e) => acc + (e.tarjetaId ? 0 : e.monto), 0)

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

// ─── Contexto compartido ────────────────────────────────────────────────────────
//
// useFinanceData() se llama de forma independiente en ~19 componentes de la app.
// Antes, cada llamada creaba su PROPIO estado y su PROPIO fetchAll() al montar —
// una página con varios de esos componentes a la vez disparaba la misma tanda de
// peticiones (deudas, gastos fijos, ahorro, ingresos extra, gastos hormiga) una
// vez POR COMPONENTE (confirmado: 8 peticiones duplicadas a /api/debts en una
// sola carga del dashboard). FinanceDataProvider corre el hook UNA sola vez y lo
// comparte via contexto — useFinanceData() ahora solo lee ese contexto, así que
// ningún componente que ya lo use necesita cambiar una sola línea.

type FinanceData = ReturnType<typeof useFinanceDataInternal>

const FinanceDataContext = createContext<FinanceData | null>(null)

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const value = useFinanceDataInternal()
  return (
    <FinanceDataContext.Provider value={value}>
      {children}
    </FinanceDataContext.Provider>
  )
}

export function useFinanceData(): FinanceData {
  const ctx = useContext(FinanceDataContext)
  if (!ctx) {
    throw new Error("useFinanceData() debe usarse dentro de <FinanceDataProvider> (ver src/app/(dashboard)/layout.tsx)")
  }
  return ctx
}
