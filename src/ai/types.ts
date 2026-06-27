/**
 * Tipos públicos de los flows de IA.
 * Importar desde aquí en componentes cliente para evitar
 * arrastrar código servidor (ai.defineFlow) al bundle del cliente.
 */

// ─── Coach proactivo ──────────────────────────────────────────────────────────

export interface ProactiveCoachInput {
  nombreUsuario:   string
  ingresoActual:   number
  frecuencia:      string
  obligacionesPct: number
  ahorroPct:       number
  capacidadLibre:  number
  metaAhorro:      number
  ahorroAcumulado: number
  streakSemanas:   number
  historial: {
    mes:               string
    ingresoTotal:      number
    totalObligaciones: number
    totalAhorro:       number
    gastoLibre:        number
    deudasActivas:     number
  }[]
  deudasActivas: {
    nombre:         string
    montoTotal:     number
    cuotaPeriodo:   number
    mesesRestantes: number
  }[]
  mensajeUsuario?: string
  historialChat?: {
    rol:     'usuario' | 'coach'
    mensaje: string
  }[]
}

export interface ProactiveCoachOutput {
  respuesta:       string
  patronDetectado?: string | null
  accionSugerida?:  string | null
  impactoEstimado?: string | null
}

// ─── Escáner de recibos ───────────────────────────────────────────────────────

export interface ReceiptScannerInput {
  imageBase64: string
  mimeType:    string
}

export interface ReceiptScannerOutput {
  establecimiento: string
  fecha:           string
  montoTotal:      number
  categoria:       'gasto_fijo' | 'gasto_libre' | 'deuda' | 'ahorro' | 'otro'
  categoriaRazon:  string
  items?: { descripcion: string; monto: number }[]
  confianza:       'alta' | 'media' | 'baja'
}
