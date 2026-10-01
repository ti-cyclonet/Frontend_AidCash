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
import { Sprout, Wallet, Building2, BarChart3, Users, PiggyBank, Mic, Crown } from "lucide-react"
import { tr } from "@/lib/i18n"

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
    title: tr("Árbol Kiri"),
    Icon: Sprout,
    navBlurb: tr("Tu punto de partida: la salud de tu jardín"),
    subtitle: tr("¡Tu punto de partida! El árbol crece —o se marchita— según tus decisiones financieras reales."),
    description: tr("Es lo primero que ves al entrar: un espejo vivo de tu salud financiera. Cada ingreso que registras, cada deuda que controlas y cada bolsillo de ahorro que llenas suman XP y hacen crecer tu árbol. Revísalo seguido para saber, de un vistazo, cómo vas."),
    textColor: "text-emerald-600 dark:text-emerald-400",
    badgeSolid: "bg-emerald-600",
    bgGradient: "from-emerald-500/10 to-emerald-900/5",
    borderColor: "border-emerald-500/20",
    items: [
      { icon: "🌳", title: tr("Nivel y salud del árbol"), description: tr("Sube de nivel (Semilla → Jardín próspero) acumulando XP; cada nivel pide más que el anterior. La salud (0-100%) depende de si registras ingresos, ahorras, controlas tus deudas y estás al día con tus pagos.") },
      { icon: "⛈️", title: tr("El clima reacciona"), description: tr("Ahorras → llueve. Registras tu ingreso → sale el sol y caen monedas. Un pago por vencer → nubes. Pagos vencidos → tormenta con rayos (y truenos, que puedes silenciar). Un gasto hormiga → cae un rayo.") },
      { icon: "☁️", title: tr("Toca las nubes"), description: tr("Te muestran qué obligaciones están vencidas y cuáles vencen en los próximos 7 días, con el monto de cada una.") },
      { icon: "🎯", title: tr("Misiones y racha"), description: tr("Completa las misiones diarias y la semanal, reclama cofres y mantén tu racha. Kiri te recuerda las misiones pendientes en la mañana y en la tarde.") },
      { icon: "💌", title: tr("Invita a Kiri"), description: tr("Con el botón Invitar compartes tu enlace (Amigo, Familia o Pareja). Quien se registre con él queda conectado contigo en Social y tiene 50% en su primer mes de KIRI PLUS (30% en PRO); cuando se suscriba, tú ganas 10 días de KIRI PLUS (hasta 3 amigos) y avanzas las misiones de invitar.") },
      { icon: "📊", title: tr("Tu progreso"), description: tr("Disponible frente a tu ingreso, avance de tus ahorros, cuánto llevas pagado de tus deudas y tu colchón de emergencia (meses de obligaciones que cubren tus ahorros).") },
    ],
  },
  {
    id: "gestion",
    number: 2,
    title: tr("Gestión"),
    Icon: Wallet,
    navBlurb: tr("Centro de mando de tus finanzas"),
    subtitle: tr("¡El centro de mando de tu dinero! Administra tus ingresos y decide exactamente a dónde va cada centavo."),
    description: tr("Piensa en este módulo como tu centro de mando financiero de alto nivel. Aquí es donde estableces el rumbo general de tus finanzas y visualizas el panorama completo."),
    textColor: "text-teal-600 dark:text-teal-400",
    badgeSolid: "bg-teal-600",
    bgGradient: "from-teal-500/10 to-teal-900/5",
    borderColor: "border-teal-500/20",
    items: [
      { icon: "💰", title: tr("Billetera"), description: tr("Registra tus ingresos, mira tu saldo real y activa pagos automáticos al recibir tu sueldo. Tu Sueldo Base es el planificado y el Sueldo Real se actualiza al pagar obligaciones. Con el lápiz eliges cómo recibes tu plata: sueldo fijo, quincenas con montos distintos o ingresos variables sin sueldo fijo.") },
      { icon: "📊", title: tr("Presupuesto"), description: tr("Crea categorías con límite, vincúlalas a tus gastos fijos y mira cuánto llevas en cada una — gastos hormiga incluidos. Toca una categoría para ver su detalle, editarla con el lápiz o registrar un gasto con el botón Gasto. Kiri sugiere la categoría según tu historial y te avisa al llegar al 80% y al 100%.") },
      { icon: "📈", title: tr("Proyecciones"), description: tr("Te muestra el día en que quedas libre de deudas y cuánto te ahorras en intereses. Mueve el \"aporte extra al mes\" (Kiri te sugiere uno que te cabe) y mira en vivo cómo se adelantan tus logros: cada deuda pagada, tu colchón de emergencia y tu patrimonio en positivo. Todo sale de tus promedios reales de los últimos 3 meses.") },
    ],
  },
  {
    id: "obligaciones",
    number: 3,
    title: tr("Obligaciones"),
    Icon: Building2,
    navBlurb: tr("Gestiona tus compromisos y deudas"),
    subtitle: tr("¡Mantén tus compromisos a raya sin estrés! Todo lo que debes pagar en un solo lugar."),
    description: tr("Este es el lugar dedicado a gestionar todos tus compromisos financieros fijos e ineludibles. Desde deudas hasta facturas mensuales y pagos de tarjeta de crédito."),
    textColor: "text-blue-600 dark:text-blue-400",
    badgeSolid: "bg-blue-600",
    bgGradient: "from-blue-500/10 to-blue-900/5",
    borderColor: "border-blue-500/20",
    items: [
      { icon: "🏠", title: tr("Registrar gastos fijos"), description: tr("Añade tus pagos recurrentes (renta, internet, servicios) y dales 'check' al pagarlos. Activa el pago automático ⚡.") },
      { icon: "💳", title: tr("Deudas y tarjetas"), description: tr("Registra deudas bancarias y tarjetas de crédito. Vincula cada tarjeta para controlar cuotas, intereses y fechas de corte automáticamente.") },
      { icon: "🧮", title: tr("Pagos con tarjeta de crédito"), description: tr("Al pagar una deuda, un gasto fijo o una compra con tu tarjeta, el interés se calcula igual que un pago en efectivo y la cuota de la tarjeta sube desde el próximo mes (como en el extracto) — y baja sola cuando esa cuota termina de pagarse.") },
      { icon: "🏦", title: tr("Saldo real del banco"), description: tr("Al pagar una cuota puedes escribir en cuánto quedó tu saldo según el banco: Kiri calcula el interés real que pagaste y ajusta la tasa para sus próximas estimaciones.") },
      { icon: "✅", title: tr("Cuota más baja"), description: tr("Si pagaste otro valor (ej. llegó $180.000 y no $182.000), marca \"Con este valor quedó pagada la cuota\" y no queda saldo pendiente ese periodo.") },
      { icon: "⏪", title: tr("Atrasos, adelantos y deshacer"), description: tr("Kiri marca las cuotas atrasadas de periodos anteriores, te deja adelantar la próxima y deshacer solo el último abono o todo el pago del periodo.") },
      { icon: "🤝", title: tr("Me deben"), description: tr("Registra plata que prestaste a personas que no usan Kiri: sale de tu disponible, registras sus abonos y le recuerdas por WhatsApp con un toque.") },
      { icon: "⚡", title: tr("Estrategias de deuda"), description: tr("Compara 'Bola de Nieve' y 'Avalancha' para decidir qué deuda pagar primero.") },
    ],
  },
  {
    id: "balance",
    number: 4,
    title: tr("Balance"),
    Icon: BarChart3,
    navBlurb: tr("Analiza tu historia financiera"),
    subtitle: tr("¡Tu máquina del tiempo financiera! Un solo lugar para auditar tu progreso con gráficos súper visuales."),
    description: tr("Tu historial financiero y tus reportes en un solo módulo: filtra por periodo, revisa tus indicadores clave, tus gráficos y cada movimiento real que has hecho en la app."),
    textColor: "text-purple-600 dark:text-purple-400",
    badgeSolid: "bg-purple-600",
    bgGradient: "from-purple-500/10 to-purple-900/5",
    borderColor: "border-purple-500/20",
    items: [
      { icon: "📊", title: tr("KPIs en vivo"), description: tr("6 indicadores animados: balance neto, total recibido, total gastado, ahorro del periodo, interés pagado e interés evitado por tus abonos extra.") },
      { icon: "📈", title: tr("Gráficos"), description: tr("Evolución del balance, ingresos vs. egresos y distribución de gastos por cada categoría que creaste en Presupuesto.") },
      { icon: "🔍", title: tr("Historial"), description: tr("Botón Historial: muestra tu periodo actual con buscador y filtros. Con \"Elegir mes\" ves meses anteriores dentro de la app (en quincenal, separados en Periodo 1 y Periodo 2).") },
      { icon: "🗑️", title: tr("Eliminar un gasto"), description: tr("Si registraste un gasto por error, elimínalo desde el historial: la plata vuelve a tu gasto libre (o a la tarjeta) y deja de contar en su categoría y en gastos hormiga.") },
      { icon: "📄", title: tr("Exportar a PDF"), description: tr("El botón PDF te pide elegir el mes antes de descargar el reporte.") },
    ],
  },
  {
    id: "social",
    number: 5,
    title: tr("Social"),
    Icon: Users,
    navBlurb: tr("Finanzas compartidas en equipo"),
    subtitle: tr("¡Mejorar tus finanzas es más divertido en equipo!"),
    description: tr("La dimensión social de tus finanzas. Conéctate con tus amigos, familia o pareja para ahorrar juntos, prestarse plata con fecha de pago y llevar el presupuesto del hogar en pareja."),
    textColor: "text-pink-600 dark:text-pink-400",
    badgeSolid: "bg-pink-600",
    bgGradient: "from-pink-500/10 to-pink-900/5",
    borderColor: "border-pink-500/20",
    items: [
      { icon: "🤝", title: tr("Conexiones"), description: tr("Busca a alguien por usuario o correo, o envíale tu enlace de invitación con Copiar o Compartir: al registrarse quedan conectados como amigo, familia o pareja.") },
      { icon: "🐷", title: tr("Bolsillos compartidos"), description: tr("Creen metas de ahorro juntos y usen la calculadora inteligente para aportar lo justo según sus ingresos.") },
      { icon: "💞", title: tr("Presupuesto del hogar"), description: tr("Con tu pareja crean categorías compartidas (Comida, Salidas, Viajes, Renta…) con un tope mensual o quincenal — cualquiera de los dos lo cambia. Ven cuánto lleva cada uno y cuánto les queda.") },
      { icon: "🧾", title: tr("Gastos del hogar"), description: tr("Registra un gasto con el botón Gasto de la categoría, o elige \"Del hogar\" al registrar cualquier gasto. Sale de tu billetera, suma al tope compartido y le avisa a tu pareja; si llegan al 80% o se pasan, les avisa a los dos.") },
      { icon: "🕰️", title: tr("Lo que ya existía"), description: tr("¿Se prestaron plata hace tiempo, ya tenían algo ahorrado o venían pagando una deuda? Regístralo sin mover tu billetera: \"Ya nos prestamos antes\" en Préstamos (el otro lo confirma), \"Ya tenemos algo ahorrado\" en Ahorros y \"Ya la venían pagando\" en Deudas.") },
      { icon: "💸", title: tr("Préstamos con fecha de pago"), description: tr("Pide prestado a un amigo con la fecha en que vas a pagar (en 1 semana, 15 días, fin de mes o la que elijas). Los dos ven cuántos días faltan, cualquiera puede cambiar la fecha y Kiri les recuerda el día antes, el día y si se atrasa.") },
      { icon: "🔔", title: tr("Avisos al celular"), description: tr("Solicitudes de amistad, invitaciones aceptadas, préstamos y gastos del hogar te llegan a la campana y, si los activas en Perfil, a la barra de notificaciones del celular.") },
    ],
  },
  {
    id: "ahorro",
    number: 6,
    title: tr("Ahorro"),
    Icon: PiggyBank,
    navBlurb: tr("Tus metas, tu futuro"),
    subtitle: tr("¡El lugar donde tus metas cobran vida!"),
    description: tr("Tu espacio dedicado a hacer crecer tu dinero. Gestiona tus bolsillos de ahorro personales y sigue tu progreso."),
    textColor: "text-amber-600 dark:text-amber-400",
    badgeSolid: "bg-amber-600",
    bgGradient: "from-amber-500/10 to-amber-900/5",
    borderColor: "border-amber-500/20",
    items: [
      { icon: "🎨", title: tr("Bolsillos de ahorro"), description: tr("Crea alcancías con colores e íconos para tus sueños y llénalas poco a poco.") },
      { icon: "💵", title: tr("Registrar depósitos"), description: tr("Añade dinero y mira cómo crecen tus metas. Estima el tiempo necesario para alcanzar cada objetivo.") },
      { icon: "🛡️", title: tr("Fondo de emergencia"), description: tr("Tu colchón para imprevistos: la meta mínima es cubrir 3 meses de tus gastos fijos y la ideal, 6.") },
      { icon: "👥", title: tr("Bolsillos compartidos"), description: tr("Los ahorros que crees en Social también aparecen aquí para que no los pierdas de vista.") },
    ],
  },
  {
    id: "registro-rapido",
    number: 7,
    title: tr("Registro Rápido"),
    Icon: Mic,
    navBlurb: tr("Voz y escáner: registra sin escribir"),
    subtitle: tr("¡Sin formularios! Habla, toma una foto o pídeselo a Kiri Coach."),
    description: tr("Desde el botón flotante de Kiri Coach 🌱 (o el + de la barra inferior en el celular) registras lo que sea hablando, con una foto o en el chat. Kiri te muestra cada movimiento en una tarjeta para que lo revises: nada se guarda sin que toques Confirmar."),
    textColor: "text-cyan-600 dark:text-cyan-400",
    badgeSolid: "bg-cyan-600",
    bgGradient: "from-cyan-500/10 to-cyan-900/5",
    borderColor: "border-cyan-500/20",
    items: [
      { icon: "🎙️", title: tr("Dictado por voz"), description: tr("Di algo como \"almorcé 18 mil, pagué el arriendo y ahorré 100 mil para el viaje\". Kiri separa cada cosa y la ubica: el gasto en su categoría, el pago en tu obligación, el ahorro en tu bolsillo. También entiende ingresos, préstamos (\"le presté 50 mil a Juan\"), deudas nuevas y categorías nuevas. Si prefieres, escríbelo.") },
      { icon: "📷", title: tr("Escáner de recibos"), description: tr("Toma o sube la foto de un recibo o factura: Kiri lee el comercio, el total y los productos. Puedes registrarlo todo en uno o separar por productos, y si reconoce una factura de tus gastos fijos (luz, internet…) la registra como pago. Si lee el valor pero no sabe a qué corresponde, tú eliges a dónde va.") },
      { icon: "💬", title: tr("Kiri Coach"), description: tr("Pregúntale lo que sea de la app (\"¿cómo funciona el presupuesto del hogar?\") o de tu plata (\"¿cómo voy este mes?\", \"¿qué deuda pago primero?\"). Conoce tus datos reales, te explica cada movimiento y también puede dejar listo un registro para que lo confirmes.") },
      { icon: "🔋", title: tr("Tu cuota de IA"), description: tr("Cada plan trae mensajes, dictados y escaneos al mes (FREE 10/10/3, PLUS 150/100/30, PRO 500/300/100). Kiri te muestra cuántos te quedan y se renuevan el día 1. Separar un recibo por productos es de KIRI PRO.") },
    ],
  },
  {
    id: "mi-plan",
    number: 8,
    title: tr("Tu plan Kiri"),
    Icon: Crown,
    navBlurb: tr("FREE, PLUS y PRO: qué incluye cada uno"),
    subtitle: tr("Empieza gratis y crece cuando lo necesites."),
    description: tr("En Mi plan (desde Perfil) ves Invita y gana, tu acceso a FactoNet para ver y pagar tus facturas con los mismos datos de Kiri, y cuánto llevas usado este mes. En \"Cambiar de plan\" están los tres planes con lo que trae cada uno y sus precios, mensual o anual; te cambias ahí mismo con tu contraseña de Kiri."),
    textColor: "text-amber-600 dark:text-amber-400",
    badgeSolid: "bg-amber-600",
    bgGradient: "from-amber-500/10 to-amber-900/5",
    borderColor: "border-amber-500/20",
    items: [
      { icon: "🌱", title: tr("KIRI FREE · $0"), description: tr("Registra gastos, ingresos y pagos sin límite, con árbol, misiones y fondo de emergencia. Incluye 5 categorías, 3 bolsillos, 5 deudas, 8 gastos fijos, 2 conexiones, 3 meses de historial y proyecciones a 3 meses.") },
      { icon: "✨", title: tr("KIRI PLUS · $14.900/mes"), description: tr("O $139.000 al año. 20 categorías, 10 bolsillos y deudas sin límite; préstamos y deudas compartidas, 3 bolsillos compartidos, proyecciones a 24 meses con recorte de gastos hormiga, 24 meses de historial y PDF.") },
      { icon: "👑", title: tr("KIRI PRO · $24.900/mes"), description: tr("O $229.000 al año. Todo sin límite, presupuesto del hogar en pareja, conexión con tu banco, escenarios guardados, historial completo, insignias exclusivas y soporte prioritario.") },
      { icon: "🎁", title: tr("Invita y gana"), description: tr("Tu amigo que llega con tu enlace tiene 50% en su primer mes de PLUS o 30% en PRO. Tú ganas 10 días de KIRI PLUS por cada amigo que se suscriba, hasta 3 amigos. Si llegas a un límite, Kiri te avisa y te lleva a Mi plan: nunca pierdes lo que ya registraste.") },
    ],
  },
]
