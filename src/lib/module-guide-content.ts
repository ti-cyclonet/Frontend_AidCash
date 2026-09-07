/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Contenido de la guía de módulos (fuente compartida)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * `GuiaKiri.tsx` (la guía completa en /guia-kiri) y `TutorialSlider.tsx` (el popup
 * de primera vez por módulo) mostraban el mismo contenido escrito dos veces, con
 * el tiempo se fue desincronizando (ej. Balance seguía describiendo "5 pestañas"
 * y export a "Excel" mucho después de que ambas cosas dejaran de existir). Vive
 * acá una sola vez.
 *
 * Los colores usan siempre el par claro/oscuro (`-600 dark:-400`) — un color
 * "-400" solo (pensado para fondo oscuro) pierde casi todo el contraste sobre
 * fondo claro.
 */

import type { LucideIcon } from "lucide-react"
import { Sprout, Wallet, Building2, BarChart3, Users, PiggyBank, Mic } from "lucide-react"

export interface GuideItem {
  icon: string
  title: string
  description: string
}

export interface ModuleGuideData {
  id: string
  number: number
  title: string
  Icon: LucideIcon
  /** Línea corta para el nav lateral de /guia-kiri */
  navBlurb: string
  /** Línea de marketing bajo el título */
  subtitle: string
  /** Párrafo explicativo, usado en la guía completa y en el popup del tutorial */
  description: string
  /** Par tema-seguro para texto/ícono, ej. "text-emerald-600 dark:text-emerald-400" */
  textColor: string
  /** Color sólido para el círculo numerado — nunca translúcido, para que el número blanco siempre tenga contraste */
  badgeSolid: string
  /** Fondo degradado translúcido para tarjetas grandes (el texto encima siempre usa colores de tema, así que funciona en ambos modos) */
  bgGradient: string
  borderColor: string
  items: GuideItem[]
}

export const MODULE_GUIDES: ModuleGuideData[] = [
  {
    id: "jardin",
    number: 1,
    title: "Árbol Kiri",
    Icon: Sprout,
    navBlurb: "Tu punto de partida: la salud de tu jardín",
    subtitle: "¡Tu punto de partida! El árbol crece —o se marchita— según tus decisiones financieras reales.",
    description: "Es lo primero que ves al entrar: un espejo vivo de tu salud financiera. Cada ingreso que registras, cada deuda que controlas y cada bolsillo de ahorro que llenas suman XP y hacen crecer tu árbol. Revísalo seguido para saber, de un vistazo, cómo vas.",
    textColor: "text-emerald-600 dark:text-emerald-400",
    badgeSolid: "bg-emerald-600",
    bgGradient: "from-emerald-500/10 to-emerald-900/5",
    borderColor: "border-emerald-500/20",
    items: [
      { icon: "🌳", title: "Nivel y salud del árbol", description: "Sube de nivel (Semilla → Jardín próspero) acumulando XP. Su salud (0-100%) depende de si registras ingresos, ahorras, controlas tus deudas y tienes presupuesto activo." },
      { icon: "⛅", title: "Clima financiero", description: "El clima sobre tu árbol reacciona en tiempo real: se nubla si tienes un pago próximo a vencer o vencido, y despeja apenas te pones al día." },
      { icon: "🎯", title: "Misiones y racha", description: "Desde aquí entras a Misiones: completa retos diarios y uno semanal, mantén tu racha activa y reclama cofres con recompensas sorpresa. A los 7, 30 y 100 días de racha desbloqueas premios especiales." },
      { icon: "💡", title: "Recomendación del día", description: "Kiri analiza tu situación y te sugiere la acción más importante que puedes hacer ahora mismo para mejorar tu salud financiera." },
    ],
  },
  {
    id: "gestion",
    number: 2,
    title: "Gestión",
    Icon: Wallet,
    navBlurb: "Centro de mando de tus finanzas",
    subtitle: "¡El centro de mando de tu dinero! Administra tus ingresos y decide exactamente a dónde va cada centavo.",
    description: "Piensa en este módulo como tu centro de mando financiero de alto nivel. Aquí es donde estableces el rumbo general de tus finanzas y visualizas el panorama completo.",
    textColor: "text-teal-600 dark:text-teal-400",
    badgeSolid: "bg-teal-600",
    bgGradient: "from-teal-500/10 to-teal-900/5",
    borderColor: "border-teal-500/20",
    items: [
      { icon: "💰", title: "Billetera", description: "Registra tus ingresos, mira tu saldo real y activa pagos automáticos al recibir tu sueldo. Tu Sueldo Base es el planificado y el Sueldo Real se actualiza al pagar obligaciones." },
      { icon: "📊", title: "Presupuesto", description: "Crea categorías con color e ícono propio, vincúlalas a tus gastos fijos y controla en tiempo real cuánto gastas en cada una — gastos hormiga incluidos." },
      { icon: "📈", title: "Proyecciones", description: "Simula distintos escenarios y proyecta tu futuro financiero a 3, 6, 12 o 24 meses." },
    ],
  },
  {
    id: "obligaciones",
    number: 3,
    title: "Obligaciones",
    Icon: Building2,
    navBlurb: "Gestiona tus compromisos y deudas",
    subtitle: "¡Mantén tus compromisos a raya sin estrés! Todo lo que debes pagar en un solo lugar.",
    description: "Este es el lugar dedicado a gestionar todos tus compromisos financieros fijos e ineludibles. Desde deudas hasta facturas mensuales y pagos de tarjeta de crédito.",
    textColor: "text-blue-600 dark:text-blue-400",
    badgeSolid: "bg-blue-600",
    bgGradient: "from-blue-500/10 to-blue-900/5",
    borderColor: "border-blue-500/20",
    items: [
      { icon: "🏠", title: "Registrar gastos fijos", description: "Añade tus pagos recurrentes (renta, internet, servicios) y dales 'check' al pagarlos. Activa el pago automático ⚡." },
      { icon: "💳", title: "Deudas y tarjetas", description: "Registra deudas bancarias y tarjetas de crédito. Vincula cada tarjeta para controlar cuotas, intereses y fechas de corte automáticamente." },
      { icon: "🧮", title: "Pagos con tarjeta de crédito", description: "Al pagar una deuda o gasto fijo con tu tarjeta, el interés se calcula igual que un pago en efectivo y la cuota de la tarjeta sube — y baja sola cuando esa cuota termina de pagarse." },
      { icon: "⚡", title: "Simular estrategias de deuda", description: "Usa 'Bola de Nieve' vs 'Avalancha' para comparar métodos y salir de deudas más rápido." },
    ],
  },
  {
    id: "balance",
    number: 4,
    title: "Balance",
    Icon: BarChart3,
    navBlurb: "Analiza tu historia financiera",
    subtitle: "¡Tu máquina del tiempo financiera! Un solo lugar para auditar tu progreso con gráficos súper visuales.",
    description: "Tu historial financiero y tus reportes en un solo módulo: filtra por periodo, revisa tus indicadores clave, tus gráficos y cada movimiento real que has hecho en la app.",
    textColor: "text-purple-600 dark:text-purple-400",
    badgeSolid: "bg-purple-600",
    bgGradient: "from-purple-500/10 to-purple-900/5",
    borderColor: "border-purple-500/20",
    items: [
      { icon: "📊", title: "KPIs en vivo", description: "6 indicadores animados: balance neto, total recibido, total gastado, ahorro del periodo, interés pagado e interés evitado por tus abonos extra." },
      { icon: "📈", title: "Gráficos", description: "Evolución del balance, ingresos vs. egresos y distribución de gastos por cada categoría que creaste en Presupuesto." },
      { icon: "🔍", title: "Historial unificado", description: "Busca y filtra cada movimiento de la app —ingresos, deudas, gastos fijos, gastos hormiga y ahorros— en una sola lista. Expande un pago de deuda para ver capital, interés, saldo y tasa." },
      { icon: "📄", title: "Exportar a PDF", description: "Descarga un reporte con tus KPIs, gráficos e historial del periodo actual, o elige varios meses a la vez." },
    ],
  },
  {
    id: "social",
    number: 5,
    title: "Social",
    Icon: Users,
    navBlurb: "Finanzas compartidas en equipo",
    subtitle: "¡Mejorar tus finanzas es más divertido en equipo!",
    description: "La dimensión social de tus finanzas. Conéctate con otros usuarios para compartir objetivos y gestionar presupuestos conjuntos.",
    textColor: "text-pink-600 dark:text-pink-400",
    badgeSolid: "bg-pink-600",
    bgGradient: "from-pink-500/10 to-pink-900/5",
    borderColor: "border-pink-500/20",
    items: [
      { icon: "🤝", title: "Conexiones", description: "Invita a tus amigos, familia o pareja enviándoles una invitación por correo electrónico." },
      { icon: "🐷", title: "Bolsillos compartidos", description: "Creen metas de ahorro juntos y usen la calculadora inteligente para aportar lo justo según sus ingresos." },
      { icon: "💸", title: "Préstamos P2P", description: "Pide prestado, aprueba solicitudes y lleva el registro exacto de cada abono hasta saldar la cuenta." },
    ],
  },
  {
    id: "ahorro",
    number: 6,
    title: "Ahorro",
    Icon: PiggyBank,
    navBlurb: "Tus metas, tu futuro",
    subtitle: "¡El lugar donde tus metas cobran vida!",
    description: "Tu espacio dedicado a hacer crecer tu dinero. Gestiona tus bolsillos de ahorro personales y sigue tu progreso.",
    textColor: "text-amber-600 dark:text-amber-400",
    badgeSolid: "bg-amber-600",
    bgGradient: "from-amber-500/10 to-amber-900/5",
    borderColor: "border-amber-500/20",
    items: [
      { icon: "🎨", title: "Bolsillos de ahorro", description: "Crea alcancías con colores e íconos para tus sueños y llénalas poco a poco." },
      { icon: "💵", title: "Registrar depósitos", description: "Añade dinero y mira cómo crecen tus metas. Estima el tiempo necesario para alcanzar cada objetivo." },
      { icon: "🛡️", title: "Fondo de emergencia", description: "Mantén tu colchón de seguridad. La app te guiará hasta alcanzar la meta ideal de 6 meses de gastos fijos." },
      { icon: "👥", title: "Bolsillos compartidos", description: "Los ahorros que crees en Social también aparecen aquí para que no los pierdas de vista." },
    ],
  },
  {
    id: "registro-rapido",
    number: 7,
    title: "Registro Rápido",
    Icon: Mic,
    navBlurb: "Voz y escáner: registra sin escribir",
    subtitle: "¡Sin formularios! Dicta o toma una foto y Kiri hace el resto.",
    description: "No siempre hay tiempo de abrir un formulario. Desde el botón flotante de Kiri Coach 🌱 (o el + de la barra inferior en el celular) puedes registrar lo que sea con solo hablar o tomar una foto.",
    textColor: "text-cyan-600 dark:text-cyan-400",
    badgeSolid: "bg-cyan-600",
    bgGradient: "from-cyan-500/10 to-cyan-900/5",
    borderColor: "border-cyan-500/20",
    items: [
      { icon: "🎙️", title: "Dictado por voz", description: "Toca el micrófono junto a Kiri Coach y di algo como \"gasté 20 mil en el almuerzo\" o \"me pagaron 2 millones\". Kiri entiende gastos, ingresos, deudas y ahorros, y los guarda cada uno en su lugar." },
      { icon: "📷", title: "Escáner de recibos", description: "Toca el ícono de escáner, toma o sube una foto de un recibo o factura, y Kiri extrae el monto y lo registra como gasto automáticamente." },
    ],
  },
]
