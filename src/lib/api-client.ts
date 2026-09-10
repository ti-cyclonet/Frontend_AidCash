"use client"

/**
 * Cliente HTTP centralizado para comunicarse con el backend Kiri.
 * Reemplaza todas las llamadas directas a Supabase.
 *
 * Maneja:
 * - Bearer token en cada request
 * - Auto-refresh cuando el token expira
 * - Almacenamiento seguro de tokens en localStorage
 * - Tipado de respuestas
 */

import type { MissionsResponse, RewardResult, SocialUser, FriendsGardenResponse, ConnectionSharedResponse, SharedDebt } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  accessToken: 'kiri_access_token',
  refreshToken: 'kiri_refresh_token',
  userId: 'kiri_user_id',
} as const

// ─── Token Management ─────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.accessToken)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.refreshToken)
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.userId)
}

export function setTokens(access: string, refresh: string, userId: string) {
  localStorage.setItem(STORAGE_KEYS.accessToken, access)
  localStorage.setItem(STORAGE_KEYS.refreshToken, refresh)
  localStorage.setItem(STORAGE_KEYS.userId, userId)
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
  localStorage.removeItem(STORAGE_KEYS.userId)
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

// ─── Refresh Logic ────────────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      clearTokens()
      return false
    }

    const data = await res.json()
    const userId = getUserId()
    if (data.accessToken && data.refreshToken && userId) {
      setTokens(data.accessToken, data.refreshToken, userId)
      return true
    }

    clearTokens()
    return false
  } catch {
    clearTokens()
    return false
  }
}

// ─── Core Fetch Wrapper ───────────────────────────────────────────────────────

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  skipAuth?: boolean
}

export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
  status: number
}

export async function api<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { body, skipAuth = false, headers: customHeaders, ...rest } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  }

  if (!skipAuth) {
    const token = getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const config: RequestInit = {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }

  try {
    let res = await fetch(`${API_URL}${endpoint}`, config)

    // Si el token expiró, intentar refresh y reintentar
    if (res.status === 401 && !skipAuth) {
      const errorData = await res.json().catch(() => ({}))

      if (errorData.code === 'TOKEN_EXPIRED') {
        // Evita múltiples refreshes simultáneos
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }

        const refreshed = await refreshPromise
        if (refreshed) {
          // Reintentar con el nuevo token
          headers['Authorization'] = `Bearer ${getAccessToken()}`
          config.headers = headers
          res = await fetch(`${API_URL}${endpoint}`, config)
        } else {
          return { data: null, error: 'Sesión expirada', status: 401 }
        }
      } else {
        return { data: null, error: errorData.error || 'No autorizado', status: 401 }
      }
    }

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        data: null,
        error: data?.error || `Error ${res.status}`,
        status: res.status,
      }
    }

    return { data: data as T, error: null, status: res.status }
  } catch (err) {
    return {
      data: null,
      error: 'Error de conexión con el servidor',
      status: 0,
    }
  }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  nombre: string
  correo: string
  onboardingDone: boolean
}

export interface LoginResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export const authApi = {
  async register(nombre: string, correo: string, password: string, documentType?: string, documentNumber?: string, firstName?: string, secondName?: string, firstSurname?: string, secondSurname?: string) {
    const res = await api<LoginResponse>('/auth/register', {
      method: 'POST',
      body: { nombre, correo, password, documentType, documentNumber, firstName, secondName, firstSurname, secondSurname },
      skipAuth: true,
    })
    if (res.data) {
      setTokens(res.data.accessToken, res.data.refreshToken, res.data.user.id)
    }
    return res
  },

  async login(correo: string, password: string) {
    const res = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { correo, password },
      skipAuth: true,
    })
    if (res.data) {
      setTokens(res.data.accessToken, res.data.refreshToken, res.data.user.id)
    }
    return res
  },

  async logout() {
    const refreshToken = getRefreshToken()
    await api('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    })
    clearTokens()
  },

  async me() {
    return api<{ user: Record<string, unknown> }>('/auth/me')
  },
}

// ─── User Profile API ─────────────────────────────────────────────────────────

export const userApi = {
  async getProfile() {
    return api<{ user: Record<string, unknown> }>('/auth/me')
  },

  async updateProfile(data: Record<string, unknown>) {
    return api<{ user: Record<string, unknown> }>('/users/profile', {
      method: 'PATCH',
      body: data,
    })
  },

  async updateBalance(monto: number, tipo: 'ingreso' | 'reset') {
    return api<{ cashBalance: number }>('/users/balance', {
      method: 'PATCH',
      body: { monto, tipo },
    })
  },

  async getDashboardSummary() {
    return api<{
      user: Record<string, unknown>
      debts: Record<string, unknown>[]
      fixedExpenses: Record<string, unknown>[]
      savingsHistory: Record<string, unknown>[]
      extraIncomes: Record<string, unknown>[]
      impulseExpenses: Record<string, unknown>[]
    }>('/users/dashboard-summary')
  },

  // ─── Wallet API ─────────────────────────────────────────────────────────────

  async getWallet() {
    return api<{ wallet: WalletState }>('/users/wallet')
  },

  async walletIncome(monto: number, tipo: 'salario' | 'extra') {
    return api<{ record: Record<string, unknown>; wallet: WalletState }>('/users/wallet/income', {
      method: 'POST',
      body: { monto, tipo },
    })
  },

  async walletDeduct(monto: number, bolsillo: 'obligaciones' | 'libre' | 'ahorro') {
    return api<{ wallet: WalletState }>('/users/wallet/deduct', {
      method: 'POST',
      body: { monto, bolsillo },
    })
  },

  async walletWithdraw(monto: number, bolsillo: 'obligaciones' | 'libre' | 'ahorro' | 'endeudamiento') {
    return api<{ withdrawn: number; wallet: WalletState }>('/users/wallet/withdraw', {
      method: 'POST',
      body: { monto, bolsillo },
    })
  },

  async walletReset() {
    return api<{ wallet: WalletState }>('/users/wallet/reset', {
      method: 'POST',
    })
  },

  // ─── Búsqueda de usuarios (Social) — coincidencia exacta únicamente ────────

  async searchUser(method: 'username' | 'correo', value: string) {
    return api<{ user: SocialUser | null }>(`/users/search?method=${method}&value=${encodeURIComponent(value)}`)
  },
}

export interface WalletState {
  cashBalance: number
  ahorro: number
  obligaciones: number
  libre: number
  endeudamiento: number
}

// ─── Debts API ────────────────────────────────────────────────────────────────

export const debtsApi = {
  async list(estado = 'activa') {
    return api<{ debts: Record<string, unknown>[] }>(`/debts?estado=${estado}`)
  },

  async create(data: { nombre: string; montoTotal: number; saldoRestante?: number; cuotaPeriodo: number; acreedor?: string; frecuenciaPago?: string; diasPago?: string; tasaInteres?: number; prioridad?: string; bankEntityId?: string | null; tipoDeuda?: 'PRESTAMO' | 'TARJETA_CREDITO'; yaPagoEstePeriodo?: boolean; budgetCategoryId?: string | null; esCompartida?: boolean; connectionId?: string; montoParticipanteA?: number; montoParticipanteB?: number }) {
    return api<{ debt: Record<string, unknown> }>('/debts', {
      method: 'POST',
      body: data,
    })
  },

  async listShared() {
    return api<{ debts: SharedDebt[] }>('/debts/shared')
  },

  async update(id: string, data: Record<string, unknown>) {
    return api<{ debt: Record<string, unknown> }>(`/debts/${id}`, {
      method: 'PATCH',
      body: data,
    })
  },

  async pay(id: string, monto?: number) {
    return api<{ debt: Record<string, unknown>; pagado: number; saldoNuevo: number; liquidada: boolean }>(`/debts/${id}/pay`, {
      method: 'POST',
      body: monto ? { monto } : {},
    })
  },

  async delete(id: string) {
    return api(`/debts/${id}`, { method: 'DELETE' })
  },

  async undoPay(id: string) {
    return api<{ debt: Record<string, unknown>; montoDevuelto: number; revertidoDeTarjeta: { tarjetaId: string; monto: number }[] | null; wallet: WalletState }>(`/debts/${id}/undo-pay`, {
      method: 'POST',
    })
  },

  async payWithCard(data: { tarjetaId: string; monto: number; cuotas: number; sourceType: 'debt' | 'fixed'; sourceId: string }) {
    return api<{ success: boolean; tarjeta: { id: string; nombre: string; saldoRestante: number; cuotaPeriodo: number } | null; cuotasAgregadas: number; incrementoCuota: number; montoTotalAgregado: number }>('/debts/pay-with-card', {
      method: 'POST',
      body: data,
    })
  },
}

// ─── Fixed Expenses API ───────────────────────────────────────────────────────

export const fixedExpensesApi = {
  async list() {
    return api<{ fixedExpenses: Record<string, unknown>[] }>('/fixed-expenses')
  },

  async create(data: { nombre: string; monto: number; fechaCorte: string; categoria?: string; frecuencia?: string; metodoPago?: string; renovacionAuto?: boolean; pagoAutomatico?: boolean; yaPagoEstePeriodo?: boolean; tarjetaVinculadaId?: string | null; budgetCategoryId?: string | null }) {
    return api<{ fixedExpense: Record<string, unknown> }>('/fixed-expenses', {
      method: 'POST',
      body: data,
    })
  },

  async update(id: string, data: Record<string, unknown>) {
    return api<{ fixedExpense: Record<string, unknown> }>(`/fixed-expenses/${id}`, {
      method: 'PATCH',
      body: data,
    })
  },

  async pay(id: string, monto?: number) {
    return api<{ fixedExpense: Record<string, unknown>; pagoConTarjeta: boolean; tarjetaNombre?: string; nuevoSaldoTarjeta?: number }>(`/fixed-expenses/${id}/pay`, {
      method: 'PATCH',
      body: monto ? { monto } : {},
    })
  },

  async delete(id: string) {
    return api(`/fixed-expenses/${id}`, { method: 'DELETE' })
  },

  async undoPay(id: string) {
    return api<{ fixedExpense: Record<string, unknown>; montoDevuelto: number; revertidoDeTarjeta: { tarjetaId: string; monto: number }[] | null; wallet: WalletState }>(`/fixed-expenses/${id}/undo-pay`, {
      method: 'POST',
    })
  },
}

// ─── Savings API ──────────────────────────────────────────────────────────────

export const savingsApi = {
  async list(limit = 12) {
    return api<{ history: Record<string, unknown>[]; totalAhorrado: number }>(`/savings?limit=${limit}`)
  },

  async create(monto: number, tipo: 'ahorro' | 'sin_ahorro', periodo?: string) {
    return api<{ entry: Record<string, unknown> }>('/savings', {
      method: 'POST',
      body: { monto, tipo, periodo },
    })
  },
}

// ─── Extra Incomes API ────────────────────────────────────────────────────────

export const extraIncomesApi = {
  async list() {
    return api<{ extraIncomes: Record<string, unknown>[] }>('/extra-incomes')
  },

  async create(data: { nombre: string; monto: number; temporalidad: string; mesesRestantes?: number | null; fechaRecepcion?: string }) {
    return api<{ extraIncome: Record<string, unknown> }>('/extra-incomes', {
      method: 'POST',
      body: data,
    })
  },

  async update(id: string, data: Record<string, unknown>) {
    return api<{ extraIncome: Record<string, unknown> }>(`/extra-incomes/${id}`, {
      method: 'PATCH',
      body: data,
    })
  },

  async delete(id: string) {
    return api(`/extra-incomes/${id}`, { method: 'DELETE' })
  },
}

// ─── Impulse Expenses API ─────────────────────────────────────────────────────

export const impulseApi = {
  async list(limit = 50) {
    return api<{ expenses: Record<string, unknown>[]; totalThisPeriod: number; currentPeriodo: string }>(`/impulse-expenses?limit=${limit}`)
  },

  async create(data: { nombre: string; monto: number; categoria: string; tarjetaId?: string; cuotas?: number }) {
    return api<{ expense: Record<string, unknown> }>('/impulse-expenses', {
      method: 'POST',
      body: data,
    })
  },

  async delete(id: string) {
    return api(`/impulse-expenses/${id}`, { method: 'DELETE' })
  },

  async topConsumos(params?: { categoria?: string; limit?: number; periodo?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.categoria) searchParams.set('categoria', params.categoria)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.periodo) searchParams.set('periodo', params.periodo)
    const qs = searchParams.toString()
    return api<TopConsumosResponse>(`/impulse-expenses/top-consumos${qs ? `?${qs}` : ''}`)
  },
}

export interface TopConsumoItem {
  nombre: string
  totalGastado: number
  cantidad: number
  porcentaje: number
}

export interface TopConsumosResponse {
  items: TopConsumoItem[]
  totalGastado: number
  periodo: string
}

// ─── Emergency Fund API ───────────────────────────────────────────────────────

export const emergencyFundApi = {
  async get() {
    return api<{ fondoActual: number; history: Record<string, unknown>[] }>('/emergency-fund')
  },

  async transaction(monto: number, tipo: 'aporte' | 'retiro', nota?: string) {
    return api<{ fondoActual: number; message: string }>('/emergency-fund/transaction', {
      method: 'POST',
      body: { monto, tipo, nota },
    })
  },
}

// ─── Gamification API ─────────────────────────────────────────────────────────

export const gamificationApi = {
  async getStatus() {
    return api<{ streak: { actual: number; mejor: number; ultimoCheck: string | null }; badges: Record<string, unknown>[]; xpFromMissions: number; xpFromWatering: number }>('/gamification/status')
  },

  async updateStreak(streakActual: number, streakMejor?: number) {
    return api<{ streak: Record<string, unknown> }>('/gamification/streak', {
      method: 'PATCH',
      body: { streakActual, streakMejor },
    })
  },

  async unlockBadge(badgeId: string) {
    return api<{ badge: Record<string, unknown> }>('/gamification/badges', {
      method: 'POST',
      body: { badgeId },
    })
  },

  async getBadges() {
    return api<{ badges: Record<string, unknown>[] }>('/gamification/badges')
  },
}

// ─── Missions API (Fase 3) ─────────────────────────────────────────────────────

export const missionsApi = {
  async getMissions() {
    return api<MissionsResponse>('/missions')
  },

  async claim(missionKey: string) {
    return api<{ reward: RewardResult }>(`/missions/${missionKey}/claim`, {
      method: 'POST',
    })
  },
}

// ─── Support API ────────────────────────────────────────────────────────────

export const supportApi = {
  /** `imagenesBase64` acepta hasta 3 imágenes — el backend las adjunta todas
   * al correo de soporte. */
  async create(data: { titulo: string; descripcion: string; imagenesBase64?: string[] }) {
    return api<{ message: string }>('/support', {
      method: 'POST',
      body: data,
    })
  },
}

// ─── Reports API ──────────────────────────────────────────────────────────────

export type Timeframe = 'week' | 'month' | 'year' | 'all' | 'custom'

export interface BalanceReport {
  timeframe: Timeframe
  from: string
  to: string
  summary: {
    totalIngreso: number
    totalEgreso: number
    ingresoBase: number
    totalIngresosHistorico: number
    totalEgresosHistorico: number
    totalExtra: number
    totalDebts: number
    totalFixed: number
    totalFixedPaid: number
    totalImpulse: number
    totalSaved: number
    cashBalance: number
    frecuenciaIngreso: string
    totalInteresPagado: number
    totalCapitalAbonado: number
    totalPagosDeuda: number
    totalInteresHistorico: number
    totalCapitalHistorico: number
    interesEvitado: number
  }
  categoryDistribution: { name: string; value: number; color: string }[]
  monthlySeries: { month: string; ingresos: number; egresos: number }[]
  impulseExpenses: Record<string, unknown>[]
  savingsHistory: Record<string, unknown>[]
  extraIncomes: Record<string, unknown>[]
  debts: Record<string, unknown>[]
  fixedExpenses: Record<string, unknown>[]
  incomeRecords: Record<string, unknown>[]
  debtPayments: Record<string, unknown>[]
  fixedExpensePayments: Record<string, unknown>[]
}

// ─── Movimiento unificado — Balance/Historial ─────────────────────────────────
// Forma compartida de "un renglón" del historial financiero, sin importar si es
// un pago de deuda, un gasto fijo, un gasto hormiga, un ingreso o un ahorro.

export type MovementType = "deudas" | "gastos_fijos" | "hormiga" | "ingresos" | "ahorros"

export interface Movement {
  id: string
  fecha: string
  nombre: string
  tipo: MovementType
  tipoLabel: string
  monto: number
  estado: "pagado" | "pendiente" | "parcial"
  // Desglose de amortización — solo presente para tipo === "deudas"
  abonoCapital?: number
  pagoInteres?: number
  saldoAnterior?: number
  saldoPosterior?: number
  tasaInteres?: string
  acreedor?: string
  /** Si el pago se hizo con tarjeta de crédito, el nombre de esa tarjeta —
   * null/undefined significa que salió del disponible en efectivo. */
  tarjetaNombre?: string | null
  /** 'entrada' para movimientos que devuelven dinero al saldo disponible (ej.
   * retirar de un bolsillo de ahorro) aunque su `tipo` no sea "ingresos" —
   * sin esto se mostrarían en rojo como un gasto, cuando en realidad el
   * dinero está volviendo a estar disponible. */
  direccion?: 'entrada' | 'salida'
}

export const reportsApi = {
  /** `range` permite pedir un rango de fechas exacto (timeframe='custom') —
   * usado por la exportación de PDF por mes elegido, que antes no tenía
   * forma de pedirle al backend otro periodo que no fuera "el actual". */
  async getBalance(timeframe: Timeframe = 'month', range?: { from: string; to: string }) {
    const qs = timeframe === 'custom' && range
      ? `timeframe=custom&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      : `timeframe=${timeframe}`
    return api<BalanceReport>(`/reports/balance?${qs}`)
  },

  async deleteIncomeRecord(id: string) {
    return api(`/reports/income-records/${id}`, { method: 'DELETE' })
  },

  async deleteSavingsRecord(id: string) {
    return api(`/savings/${id}`, { method: 'DELETE' })
  },
}

// ─── Social: Connections API ──────────────────────────────────────────────────

export const connectionsApi = {
  async list() {
    return api<{
      accepted:        Record<string, unknown>[]
      pendingReceived: Record<string, unknown>[]
      pendingSent:     Record<string, unknown>[]
    }>('/connections')
  },
  async invite(method: 'username' | 'correo', value: string, role?: 'FRIEND' | 'FAMILY' | 'PARTNER') {
    return api<{ connection: Record<string, unknown>; addressee: Record<string, unknown> }>('/connections/invite', {
      method: 'POST', body: { method, value, role },
    })
  },
  async accept(connectionId: string) {
    return api<{ connection: Record<string, unknown> }>('/connections/accept', {
      method: 'POST', body: { connectionId },
    })
  },
  async reject(connectionId: string) {
    return api<{ connection: Record<string, unknown> }>('/connections/reject', {
      method: 'POST', body: { connectionId },
    })
  },
  async remove(id: string) {
    return api(`/connections/${id}`, { method: 'DELETE' })
  },
  /** Propone cambiar el rol de la conexión — NO aplica al instante, queda
   * pendiente hasta que la otra persona lo aprueba (ver `respondRole`). */
  async requestRole(id: string, role: 'FRIEND' | 'FAMILY' | 'PARTNER') {
    return api<{ connection: Record<string, unknown> }>(`/connections/${id}/role-request`, {
      method: 'POST', body: { role },
    })
  },
  async respondRole(id: string, accept: boolean) {
    return api<{ connection: Record<string, unknown> }>(`/connections/${id}/role-respond`, {
      method: 'POST', body: { accept },
    })
  },
  async getShared(connectionId: string) {
    return api<ConnectionSharedResponse>(`/connections/${connectionId}/shared`)
  },

  // ─── Fase 4: racha entre amigos, jardines vecinos, riego ───────────────────

  async getFriendsGarden() {
    return api<FriendsGardenResponse>('/connections/friends-garden')
  },
  async water(connectionId: string) {
    return api<{ watered: boolean; xpGiven: number }>(`/connections/${connectionId}/water`, { method: 'POST' })
  },
}

// ─── Social: Shared Pockets API ───────────────────────────────────────────────

export const sharedPocketsApi = {
  async list() {
    return api<{ pockets: Record<string, unknown>[] }>('/shared-pockets')
  },
  async create(partnerIds: string[], nombre: string, meta?: number) {
    return api<{ pocket: Record<string, unknown> }>('/shared-pockets', {
      method: 'POST', body: { partnerIds, nombre, meta },
    })
  },
  async deposit(pocketId: string, monto: number, nota?: string, tipo?: 'aporte' | 'retiro') {
    return api<{ deposit: Record<string, unknown>; requiresApproval: boolean }>(`/shared-pockets/${pocketId}/deposit`, {
      method: 'POST', body: { monto, nota, tipo: tipo ?? 'aporte' },
    })
  },
  async approveDeposit(pocketId: string, depositId: string) {
    return api<{ newBalance: number }>(`/shared-pockets/${pocketId}/deposit/${depositId}/approve`, {
      method: 'POST',
    })
  },
  async rejectDeposit(pocketId: string, depositId: string) {
    return api<{ message: string }>(`/shared-pockets/${pocketId}/deposit/${depositId}/reject`, {
      method: 'POST',
    })
  },
  async remove(pocketId: string) {
    return api<{ message: string; immediate: boolean; expiresAt?: string }>(`/shared-pockets/${pocketId}`, {
      method: 'DELETE',
    })
  },
  async splitCalculator(partnerId: string, gasto: number) {
    return api<{
      gasto: number
      userA: Record<string, unknown>
      userB: Record<string, unknown>
    }>(`/shared-pockets/split-calculator?partnerId=${partnerId}&gasto=${gasto}`)
  },
}

// ─── Social: Loans API ────────────────────────────────────────────────────────

export const loansApi = {
  async list() {
    return api<{ loans: Record<string, unknown>[] }>('/loans')
  },
  async request(data: { lenderId: string; amount: number; descripcion?: string; dueDate?: string }) {
    return api<{ loan: Record<string, unknown> }>('/loans/request', {
      method: 'POST', body: data,
    })
  },
  async approve(loanId: string, tasaInteres?: number) {
    return api<{ loan: Record<string, unknown>; requiresConfirmation?: boolean }>('/loans/approve', {
      method: 'POST', body: { loanId, tasaInteres: tasaInteres ?? 0 },
    })
  },
  async borrowerConfirm(loanId: string, accept: boolean) {
    return api<{ loan: Record<string, unknown>; accepted: boolean }>('/loans/borrower-confirm', {
      method: 'POST', body: { loanId, accept },
    })
  },
  async reject(loanId: string) {
    return api<{ loan: Record<string, unknown> }>('/loans/reject', {
      method: 'POST', body: { loanId },
    })
  },
  async cancel(loanId: string) {
    return api<{ message: string }>('/loans/cancel', {
      method: 'POST', body: { loanId },
    })
  },
  async payment(loanId: string, monto: number, nota?: string) {
    return api<{ payment: Record<string, unknown> }>('/loans/payment', {
      method: 'POST', body: { loanId, monto, nota },
    })
  },
  async confirmPayment(paymentId: string) {
    return api<{ payment: Record<string, unknown>; loan: Record<string, unknown> }>('/loans/payment/confirm', {
      method: 'POST', body: { paymentId },
    })
  },
  async rejectPayment(paymentId: string) {
    return api<{ payment: Record<string, unknown> }>('/loans/payment/reject', {
      method: 'POST', body: { paymentId },
    })
  },
}

// ─── AI API ───────────────────────────────────────────────────────────────────

export const aiApi = {
  async coach(body: Record<string, unknown>) {
    return api<{ respuesta: string; patronDetectado: string | null; accionSugerida: string | null; impactoEstimado: string | null }>('/ai/coach', {
      method: 'POST',
      body,
    })
  },

  async budgetInsight(body: Record<string, unknown>) {
    return api<{ explicacion: string }>('/ai/budget-insight', {
      method: 'POST',
      body,
    })
  },

  async scanReceipt(imageBase64: string, mimeType: string) {
    return api<{ items: unknown[]; total: number; categoria: string }>('/ai/scan-receipt', {
      method: 'POST',
      body: { imageBase64, mimeType },
    })
  },
}


// ─── Home Budget API (Presupuesto de Pareja) ──────────────────────────────────

export const homeBudgetApi = {
  async get() {
    return api<{
      budget: {
        ingresoTotal: number
        ingresoUser1: number
        ingresoUser2: number
        obligacionesTotal: number
        obligacionesUser1: number
        obligacionesUser2: number
        ahorro: number
        ahorroPct: number
        libre: number
        librePct: number
        capacidadEndeudamiento: number
        capacidadPct: number
        obligacionesPct: number
        isOverloaded: boolean
      }
      partnerId: string
    }>('/home-budget')
  },
}

// ─── Savings Pockets API (Bolsillos de Ahorro Personales) ─────────────────────

export interface SavingsPocket {
  id: string
  userId: string
  nombre: string
  meta: number
  montoActual: number
  color: string
  icono: string
  descripcion?: string | null
  pagoAutomatico: boolean
  tipoMeta: 'libre' | 'fecha'
  fechaLimite?: string | null
  createdAt: string
  updatedAt: string
}

export const savingsPocketsApi = {
  /** Listar todos los bolsillos del usuario autenticado */
  async list() {
    return api<{ pockets: SavingsPocket[] }>('/savings-pockets')
  },

  /** Crear un nuevo bolsillo de ahorro */
  async create(data: { nombre: string; meta?: number; montoActual?: number; color?: string; icono?: string; descripcion?: string; pagoAutomatico?: boolean; tipoMeta?: 'libre' | 'fecha'; fechaLimite?: string }) {
    return api<{ pocket: SavingsPocket }>('/savings-pockets', {
      method: 'POST',
      body: data,
    })
  },

  /** Actualizar un bolsillo existente */
  async update(id: string, data: Partial<Omit<SavingsPocket, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
    return api<{ pocket: SavingsPocket }>(`/savings-pockets/${id}`, {
      method: 'PATCH',
      body: data,
    })
  },

  /** Eliminar un bolsillo — si tenía saldo, el backend lo devuelve a la billetera antes de borrar */
  async delete(id: string) {
    return api<{ message: string; devuelto: number }>(`/savings-pockets/${id}`, { method: 'DELETE' })
  },

  /** Aportar al bolsillo — descuenta la billetera y suma el bolsillo, atómico en el backend */
  async deposit(id: string, monto: number) {
    return api<{ pocket: SavingsPocket }>(`/savings-pockets/${id}/deposit`, {
      method: 'POST',
      body: { monto },
    })
  },

  /** Retirar del bolsillo — devuelve el dinero a la billetera, atómico en el backend */
  async withdraw(id: string, monto: number) {
    return api<{ pocket: SavingsPocket }>(`/savings-pockets/${id}/withdraw`, {
      method: 'POST',
      body: { monto },
    })
  },

  /** Bulk insert — usado en la migración desde localStorage */
  async bulkCreate(pockets: { nombre: string; meta?: number; montoActual?: number; color?: string; icono?: string; descripcion?: string; pagoAutomatico?: boolean; tipoMeta?: 'libre' | 'fecha'; fechaLimite?: string }[]) {
    return api<{ count: number; message: string }>('/savings-pockets/bulk', {
      method: 'POST',
      body: { pockets },
    })
  },
}

// ─── Budget Categories API (Categorías de Presupuesto) ────────────────────────

export interface BudgetCategory {
  id: string
  userId: string
  nombre: string
  icono: string
  color: string
  tipo: 'gasto' | 'ingreso' | 'ahorro'
  montoLimite: number
  linkedFixedExpenseIds: string[]
}

export const budgetCategoriesApi = {
  /** Listar categorías del usuario (opcionalmente filtra por tipo) */
  async list(tipo?: 'gasto' | 'ingreso' | 'ahorro') {
    const qs = tipo ? `?tipo=${tipo}` : ''
    return api<{ categories: BudgetCategory[] }>(`/budget-categories${qs}`)
  },

  /** Crear una nueva categoría */
  async create(data: { nombre: string; icono?: string; color?: string; tipo?: 'gasto' | 'ingreso' | 'ahorro'; montoLimite?: number; linkedFixedExpenseIds?: string[] }) {
    return api<{ category: BudgetCategory }>('/budget-categories', {
      method: 'POST',
      body: data,
    })
  },

  /** Actualizar una categoría existente */
  async update(id: string, data: Partial<Omit<BudgetCategory, 'id' | 'userId'>>) {
    return api<{ category: BudgetCategory }>(`/budget-categories/${id}`, {
      method: 'PATCH',
      body: data,
    })
  },

  /** Eliminar una categoría */
  async delete(id: string) {
    return api(`/budget-categories/${id}`, { method: 'DELETE' })
  },

  /** Bulk insert — usado en la migración desde localStorage */
  async bulkCreate(categories: { nombre: string; icono?: string; color?: string; tipo?: 'gasto' | 'ingreso' | 'ahorro' }[]) {
    return api<{ count: number; message: string }>('/budget-categories/bulk', {
      method: 'POST',
      body: { categories },
    })
  },
}

// ─── Sincronización localStorage → Base de Datos ──────────────────────────────

const SYNC_FLAG_KEY = 'kiri_local_data_synced'
// OJO: la página de Ahorro siempre guardó sus bolsillos bajo "kiri_saving_pockets"
// (singular) — esta constante decía "kiri_savings_pockets" (plural) por error, así
// que esta migración nunca encontraba nada real que migrar. Debe apuntar a la
// llave que el frontend REALMENTE escribe, no a la que "debería" ser.
const LS_POCKETS_KEY = 'kiri_saving_pockets'
const LS_CATEGORIES_KEY = 'kiri_budget_categories'

/**
 * syncLocalDataToDB()
 *
 * Lee los bolsillos de ahorro y categorías de presupuesto almacenados en
 * localStorage, los envía al backend mediante bulk insert, y limpia el
 * localStorage para evitar duplicidades.
 *
 * Debe llamarse UNA SOLA VEZ tras el primer login exitoso post-migración.
 * Usa un flag (kiri_local_data_synced) para no repetir la operación entre
 * sesiones — pero ese flag solo se escribe al TERMINAR, así que si dos
 * llamadas caen casi al mismo tiempo dentro de la misma pestaña (p. ej. el
 * doble-render de Strict Mode en desarrollo), ambas lo verían todavía sin
 * poner y duplicarían el bulk-insert. `syncInFlight` cierra esa ventana:
 * la segunda llamada reutiliza la promesa de la primera en vez de repetir
 * el trabajo, sin sacrificar el reintento en una sesión futura si la
 * primera falló de verdad.
 */
let syncInFlight: Promise<{ pocketsSynced: number; categoriesSynced: number }> | null = null

export async function syncLocalDataToDB(): Promise<{ pocketsSynced: number; categoriesSynced: number }> {
  if (syncInFlight) return syncInFlight
  syncInFlight = syncLocalDataToDBImpl().finally(() => { syncInFlight = null })
  return syncInFlight
}

async function syncLocalDataToDBImpl(): Promise<{ pocketsSynced: number; categoriesSynced: number }> {
  if (typeof window === 'undefined') return { pocketsSynced: 0, categoriesSynced: 0 }

  // Si ya se sincronizó previamente, no repetir
  if (localStorage.getItem(SYNC_FLAG_KEY) === 'true') {
    return { pocketsSynced: 0, categoriesSynced: 0 }
  }

  let pocketsSynced = 0
  let categoriesSynced = 0

  try {
    // ─── Migrar Bolsillos de Ahorro ─────────────────────────────────────────
    const rawPockets = localStorage.getItem(LS_POCKETS_KEY)
    if (rawPockets) {
      const localPockets = JSON.parse(rawPockets) as Array<{
        name?: string; nombre?: string; goal?: number; meta?: number;
        // "acumulado" es el nombre real que usa (y siempre usó) la página de
        // Ahorro — currentAmount/montoActual son alias de compatibilidad.
        acumulado?: number; currentAmount?: number; montoActual?: number;
        color?: string; icon?: string; icono?: string;
        descripcion?: string; pagoAutomatico?: boolean;
        tipoMeta?: 'libre' | 'fecha'; fechaLimite?: string
      }>

      if (localPockets.length > 0) {
        const pocketsPayload = localPockets.map(p => ({
          nombre: p.nombre || p.name || 'Sin nombre',
          meta: p.meta ?? p.goal ?? 0,
          montoActual: p.acumulado ?? p.montoActual ?? p.currentAmount ?? 0,
          color: p.color || '#10B981',
          icono: p.icono || p.icon || 'piggy-bank',
          descripcion: p.descripcion,
          pagoAutomatico: p.pagoAutomatico,
          tipoMeta: p.tipoMeta,
          fechaLimite: p.fechaLimite,
        }))

        const res = await savingsPocketsApi.bulkCreate(pocketsPayload)
        if (!res.error) {
          pocketsSynced = res.data?.count ?? 0
          localStorage.removeItem(LS_POCKETS_KEY)
        }
      }
    }

    // ─── Migrar Categorías de Presupuesto ───────────────────────────────────
    const rawCategories = localStorage.getItem(LS_CATEGORIES_KEY)
    if (rawCategories) {
      const localCategories = JSON.parse(rawCategories) as Array<{
        name?: string; nombre?: string; icon?: string; icono?: string;
        color?: string; type?: string; tipo?: string
      }>

      if (localCategories.length > 0) {
        const categoriesPayload = localCategories.map(c => ({
          nombre: c.nombre || c.name || 'Sin nombre',
          icono: c.icono || c.icon || 'tag',
          color: c.color || '#6366F1',
          tipo: (c.tipo || c.type || 'gasto') as 'gasto' | 'ingreso' | 'ahorro',
        }))

        const res = await budgetCategoriesApi.bulkCreate(categoriesPayload)
        if (!res.error) {
          categoriesSynced = res.data?.count ?? 0
          localStorage.removeItem(LS_CATEGORIES_KEY)
        }
      }
    }

    // Marcar como sincronizado para no repetir
    localStorage.setItem(SYNC_FLAG_KEY, 'true')
  } catch (error) {
    console.error('[syncLocalDataToDB] Error durante la migración:', error)
  }

  return { pocketsSynced, categoriesSynced }
}

// ─── Open Banking API (Belvo) ─────────────────────────────────────────────────

export interface BelvoLinkAccount {
  id: string
  nombre: string
  tipo: string
  numero: string | null
  moneda: string
  balanceActual: number
  balanceDisponible: number | null
}

export interface BelvoLink {
  id: string
  userId: string
  linkId: string
  institution: string
  institutionType: string
  accessMode: string
  status: string
  lastSyncAt: string | null
  createdAt: string
  updatedAt: string
  accounts: BelvoLinkAccount[]
}

export interface BelvoTransaction {
  id: string
  belvoLinkId: string
  transactionId: string
  accountId: string
  fecha: string
  monto: number
  tipo: 'INFLOW' | 'OUTFLOW'
  categoria: string | null
  descripcion: string | null
  comercio: string | null
  status: string
  createdAt: string
}

export const openBankingApi = {
  /** Verifica si Belvo está configurado en el backend */
  async getStatus() {
    return api<{ configured: boolean; provider: string; message: string }>('/open-banking/status')
  },

  /** Obtiene un token de acceso para el Connect Widget de Belvo */
  async getWidgetToken(linkId?: string) {
    const qs = linkId ? `?linkId=${linkId}` : ''
    return api<{ token: string }>(`/open-banking/widget-token${qs}`)
  },

  /** Registra un link tras la conexión exitosa en el widget */
  async registerLink(data: { linkId: string; institution: string; institutionType?: string; accessMode?: string }) {
    return api<{ link: BelvoLink; message: string }>('/open-banking/links', {
      method: 'POST',
      body: data,
    })
  },

  /** Lista los bancos conectados del usuario con sus cuentas */
  async listLinks() {
    return api<{ links: BelvoLink[] }>('/open-banking/links')
  },

  /** Sincroniza cuentas y transacciones de un link */
  async syncLink(id: string, dateFrom?: string, dateTo?: string) {
    return api<{ message: string; accountsSynced: number; transactionsSynced: number; dateFrom: string; dateTo: string }>(
      `/open-banking/links/${id}/sync`,
      { method: 'POST', body: { dateFrom, dateTo } }
    )
  },

  /** Desconecta un banco */
  async deleteLink(id: string) {
    return api(`/open-banking/links/${id}`, { method: 'DELETE' })
  },

  /** Lista transacciones sincronizadas */
  async listTransactions(params?: { limit?: number; offset?: number; tipo?: 'INFLOW' | 'OUTFLOW' }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    if (params?.tipo) searchParams.set('tipo', params.tipo)
    const qs = searchParams.toString()
    return api<{ transactions: BelvoTransaction[]; total: number; limit: number; offset: number }>(
      `/open-banking/transactions${qs ? `?${qs}` : ''}`
    )
  },
}

// ─── Projections API (Análisis predictivo de gasto) ───────────────────────────

export interface SpendingProjection {
  walletLibre: number
  gastoPromediodiario7d: number
  gastoPromediodiario30d: number
  diasRestantes: number
  diasHastaPago: number
  presupuestoDiarioRecomendado: number
  diferencia: number
  tendencia: 'estable' | 'creciente' | 'decreciente'
  riesgo: 'bajo' | 'medio' | 'alto' | 'critico'
  recomendacion: string
  stats: {
    gastoSemanaActual: number
    gastoSemanaAnterior: number
    gastoMes: number
    transaccionesSemana: number
    transaccionesMes: number
  }
}

export const projectionsApi = {
  /** Obtiene la proyección de gasto actual del usuario */
  async getSpending() {
    return api<{ projection: SpendingProjection }>('/projections/spending')
  },
}

// ─── Notificaciones (campana) — persistidas en el backend ─────────────────────
// `event`/`data` tienen la misma forma que espera KiriNotification en
// socket-context.tsx, para no tener que reescribir cómo se arma cada tipo.

export interface StoredNotification {
  id: string
  event: string
  data: Record<string, unknown>
  read: boolean
  createdAt: string
}

export const notificationsApi = {
  async list() {
    return api<{ notifications: StoredNotification[] }>('/notifications')
  },
  async markAllRead() {
    return api('/notifications/read-all', { method: 'POST' })
  },
  async clear() {
    return api('/notifications', { method: 'DELETE' })
  },
}
