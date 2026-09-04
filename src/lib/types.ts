export type IncomeFrequency = 'quincenal' | 'mensual';
export type ExtraIncomeTemporality = 'una_vez' | 'definido' | 'indefinido';

// ─── Phase 3: Social ──────────────────────────────────────────────────────────

export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type ConnectionRole = 'FRIEND' | 'FAMILY' | 'PARTNER';
export type LoanStatus = 'PENDING_APPROVAL' | 'PENDING_BORROWER_CONFIRMATION' | 'ACTIVE' | 'REJECTED' | 'PAID';
export type LoanPaymentStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED';

export interface SocialUser {
  id: string;
  nombre: string;
  correo?: string; // el buscador de usuarios nunca lo devuelve — opcional a propósito
  username?: string;
  avatarUrl?: string | null;
}

export interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  role: ConnectionRole;
  /** Rol propuesto por roleChangeRequestedBy, esperando que la OTRA persona
   * lo apruebe — null cuando no hay ninguna solicitud de cambio pendiente. */
  pendingRole?: ConnectionRole | null;
  roleChangeRequestedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  requester?: SocialUser;
  addressee?: SocialUser;
}

// ─── Fase 4: Social gamificado (racha entre amigos, jardines vecinos, riego) ──

export interface FriendGardenEntry {
  connectionId: string;
  peer: SocialUser;
  streak: number;
  streakMejor: number;
  badgesCount: number;
  health: number;
  wateredByMeToday: boolean;
}

export interface FriendsGardenResponse {
  friends: FriendGardenEntry[];
  friendsWhoWateredYouToday: number;
  you: { streak: number; streakMejor: number; badgesCount: number; health: number };
}

export interface SharedPocketContribution {
  [userId: string]: number;
}

export interface ConnectionSharedPocket {
  id: string;
  nombre: string;
  balance: number;
  meta: number;
  deadline: string | null;
  members: { id: string; nombre: string; role: string }[];
  recentDeposits: SharedDeposit[];
  contributions: SharedPocketContribution;
}

export interface ConnectionSharedLoan {
  id: string;
  amount: number;
  remainingAmount: number;
  status: LoanStatus;
  descripcion?: string | null;
  lenderId: string;
  borrowerId: string;
  createdAt: string;
  recentPayments: LoanPayment[];
}

export interface ConnectionSharedResponse {
  connection: {
    id: string; role: ConnectionRole; createdAt: string;
    pendingRole?: ConnectionRole | null; roleChangeRequestedBy?: string | null;
  };
  peer: SocialUser;
  pockets: ConnectionSharedPocket[];
  loans: ConnectionSharedLoan[];
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
  /** Tasa de interés que el prestamista propuso (0-100). Solo tiene sentido
   * junto con montoOriginal mientras el préstamo espera confirmación del
   * deudor (PENDING_BORROWER_CONFIRMATION). */
  tasaInteres?: number | null;
  /** Monto original solicitado, antes de sumarle el interés propuesto. */
  montoOriginal?: number | null;
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
  fechaRecepcion?: string | null;
}

export type DebtPriority = 'alta' | 'media' | 'baja';
export type DebtStatus = 'activa' | 'saldada' | 'vencida';
export type DebtFrequency = 'mensual' | 'quincenal';
export type FixedExpenseCategory = 'vivienda' | 'servicios' | 'internet' | 'transporte' | 'educacion' | 'salud' | 'suscripciones' | 'otro';
export type FixedExpenseFrequency = 'mensual' | 'quincenal' | 'semanal' | 'anual';

export type DebtType = 'PRESTAMO' | 'TARJETA_CREDITO';

export interface Debt {
  id: string;
  userId: string;
  nombre: string;
  tipoDeuda: DebtType;
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

// ─── Fase 3: Misiones diarias/semanales ────────────────────────────────────────

export type MissionKey =
  | 'gasto_hormiga' | 'pagar_obligacion' | 'categorizar' | 'racha_semanal'
  | 'registrar_obligacion' | 'registrar_ingreso_real' | 'registrar_ahorro' | 'invitar_amigo';
export type RewardType = 'xp' | 'boost';

export interface Mission {
  key: MissionKey;
  title: string;
  desc: string;
  icon: string;
  target: number;
  progress: number;
  claimed: boolean;
}

export interface MissionsResponse {
  daily: Mission[];
  weekly: Mission;
  onboarding: Mission[];
}

export interface RewardResult {
  type: RewardType;
  amount: number;
  label: string;
  icon: string;
}
