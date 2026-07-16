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

interface ApiResponse<T = unknown> {
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
  async register(nombre: string, correo: string, password: string) {
    const res = await api<LoginResponse>('/auth/register', {
      method: 'POST',
      body: { nombre, correo, password },
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

  async create(data: { nombre: string; montoTotal: number; saldoRestante?: number; cuotaPeriodo: number; acreedor?: string; frecuenciaPago?: string; diasPago?: string; tasaInteres?: number; prioridad?: string }) {
    return api<{ debt: Record<string, unknown> }>('/debts', {
      method: 'POST',
      body: data,
    })
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
    return api<{ debt: Record<string, unknown>; montoDevuelto: number; wallet: WalletState }>(`/debts/${id}/undo-pay`, {
      method: 'POST',
    })
  },
}

// ─── Fixed Expenses API ───────────────────────────────────────────────────────

export const fixedExpensesApi = {
  async list() {
    return api<{ fixedExpenses: Record<string, unknown>[] }>('/fixed-expenses')
  },

  async create(data: { nombre: string; monto: number; fechaCorte: string; categoria?: string; frecuencia?: string; metodoPago?: string; renovacionAuto?: boolean }) {
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

  async delete(id: string) {
    return api(`/fixed-expenses/${id}`, { method: 'DELETE' })
  },

  async undoPay(id: string) {
    return api<{ fixedExpense: Record<string, unknown>; montoDevuelto: number; wallet: WalletState }>(`/fixed-expenses/${id}/undo-pay`, {
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

  async create(data: { nombre: string; monto: number; temporalidad: string; mesesRestantes?: number | null }) {
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

  async create(data: { nombre: string; monto: number; categoria: string }) {
    return api<{ expense: Record<string, unknown> }>('/impulse-expenses', {
      method: 'POST',
      body: data,
    })
  },

  async delete(id: string) {
    return api(`/impulse-expenses/${id}`, { method: 'DELETE' })
  },
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
    return api<{ streak: { actual: number; mejor: number; ultimoCheck: string | null }; badges: Record<string, unknown>[] }>('/gamification/status')
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

// ─── Reports API ──────────────────────────────────────────────────────────────

export type Timeframe = 'week' | 'month' | 'year' | 'all'

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
}

export const reportsApi = {
  async getBalance(timeframe: Timeframe = 'month') {
    return api<BalanceReport>(`/reports/balance?timeframe=${timeframe}`)
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
  async invite(correo: string, role?: 'FRIEND' | 'FAMILY' | 'PARTNER') {
    return api<{ connection: Record<string, unknown>; addressee: Record<string, unknown> }>('/connections/invite', {
      method: 'POST', body: { correo, role },
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
  async updateRole(id: string, role: 'FRIEND' | 'FAMILY' | 'PARTNER') {
    return api<{ connection: Record<string, unknown> }>(`/connections/${id}/role`, {
      method: 'PATCH', body: { role },
    })
  },
  async getShared(connectionId: string) {
    return api<{
      connection: { id: string; role: string; createdAt: string }
      peer: { id: string; nombre: string; correo: string }
      pockets: Record<string, unknown>[]
      loans: Record<string, unknown>[]
    }>(`/connections/${connectionId}/shared`)
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
