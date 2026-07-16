export type IncomeFrequency = 'quincenal' | 'mensual';
export type ExtraIncomeTemporality = 'una_vez' | 'definido' | 'indefinido';

// ─── Phase 3: Social ──────────────────────────────────────────────────────────

export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type LoanStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'PAID';
export type LoanPaymentStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED';

export interface SocialUser {
  id: string;
  nombre: string;
  correo: string;
}

export interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  requester?: SocialUser;
  addressee?: SocialUser;
}

export interface SharedDeposit {
  id: string;
  sharedPocketId: string;
  userId: string;
  monto: number;
  nota?: string;
  createdAt: string;
}

export interface SharedPocket {
  id: string;
  nombre: string;
  userAId: string;
  userBId: string;
  balance: number;
  meta: number;
  createdAt: string;
  updatedAt: string;
  userA?: SocialUser;
  userB?: SocialUser;
  deposits?: SharedDeposit[];
}

export interface LoanPayment {
  id: string;
  loanId: string;
  userId: string;
  monto: number;
  nota?: string;
  status: LoanPaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  lenderId: string;
  borrowerId: string;
  amount: number;
  remainingAmount: number;
  descripcion?: string;
  dueDate?: string;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
  lender?: SocialUser;
  borrower?: SocialUser;
  payments?: LoanPayment[];
}

export interface User {
  id: string;
  nombre: string;
  correo: string;
  frecuencia_ingreso: IncomeFrequency;
  saldo_ahorro_total: number;
  /** Ingreso fijo por periodo. Migrado desde localStorage. */
  ingreso_base: number;
  /** true cuando el usuario completó el wizard de onboarding. */
  onboarding_done: boolean;
  /** Meta de ahorro total que el usuario quiere alcanzar. Default 5000. */
  meta_ahorro_global: number;
}

export interface ExtraIncome {
  id: string;
  userId: string;
  nombre: string;
  monto: number;
  temporalidad: ExtraIncomeTemporality;
  mesesRestantes: number | null; // null = indefinido o una_vez ya registrado
}

export type DebtPriority = 'alta' | 'media' | 'baja';
export type DebtStatus = 'activa' | 'saldada' | 'vencida';
export type DebtFrequency = 'mensual' | 'quincenal';
export type FixedExpenseCategory = 'vivienda' | 'servicios' | 'internet' | 'transporte' | 'educacion' | 'salud' | 'suscripciones' | 'otro';
export type FixedExpenseFrequency = 'mensual' | 'quincenal' | 'semanal' | 'anual';

export interface Debt {
  id: string;
  userId: string;
  nombre: string;
  montoTotal: number;
  saldoRestante: number;
  cuotaPeriodo: number;
  montoPagadoEstePeriodo?: number | null; // Monto REAL pagado (puede diferir de cuotaPeriodo)
  tasaInteres?: number | null;
  acreedor: string;
  frecuenciaPago: DebtFrequency;
  diasPago: string; // "15" o "15,30"
  pagadoEstePeriodo: boolean;
  estado: DebtStatus;
  prioridad: DebtPriority;
  pagoAutomatico?: boolean;
}

export interface FixedExpense {
  id: string;
  userId: string;
  nombre: string;
  monto: number;
  categoria: FixedExpenseCategory;
  fechaCorte: string;
  frecuencia: FixedExpenseFrequency;
  metodoPago?: string | null;
  renovacionAuto: boolean;
  pagadoEstePeriodo: boolean;
  pagoAutomatico?: boolean;
}

export type ImpulseCategory = 'cafe' | 'comida' | 'transporte' | 'antojo' | 'salida' | 'otro';

export interface ImpulseExpense {
  id: string;
  userId: string;
  nombre: string;
  monto: number;
  categoria: ImpulseCategory;
  periodo: string;
  createdAt: string;
}

export interface BudgetAllocation {
  // Bloque 1: Deudas y Gastos Fijos
  obligationsAmount: number;
  obligationsPct: number;

  // Bloque 2: Ahorro
  savingsAmount: number;
  savingsPct: number;

  // Bloque 3: Libre Inversión (total)
  freeInvestmentAmount: number;
  freeInvestmentPct: number;

  // Bloque 3a: Gasto Libre (blindado, mínimo vital)
  dailyFreeAmount: number;
  dailyFreePct: number;

  // Bloque 3b: Capacidad de Endeudamiento (remanente)
  debtCapacityAmount: number;
  debtCapacityPct: number;

  // Meta
  totalIncome: number;
  isOverloaded: boolean;   // obligaciones > ingreso
  isTight: boolean;        // obligaciones > 70% del ingreso
}
