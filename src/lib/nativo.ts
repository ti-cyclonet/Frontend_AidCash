"use client"

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Kiri Finance — Puente con la app nativa (Capacitor: Play Store y App Store)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * La app nativa carga esta misma web (capacitor.config.ts) y Capacitor le inyecta
 * su puente. Aquí se usa: barra de estado, pantalla de inicio, botón atrás de
 * Android, vibración en el juego, enlaces externos en el navegador de la app y
 * compras dentro de la app (RevenueCat). En el navegador normal todo esto no hace
 * nada (o usa el equivalente web), así que se puede llamar sin preguntar.
 *
 * Los plugins se cargan bajo demanda: no pesan en la web.
 */

type Plataforma = "ios" | "android" | "web"
interface CapacitorGlobal { isNativePlatform?: () => boolean; getPlatform?: () => string }
const cap = (): CapacitorGlobal | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor)

export const esNativo = (): boolean => !!cap()?.isNativePlatform?.()
export const plataforma = (): Plataforma => {
  const p = cap()?.getPlatform?.()
  return p === "ios" || p === "android" ? p : "web"
}

let iniciado = false
/** Se llama una vez al cargar la app (NativoInit). */
export async function iniciarNativo(navegar: { back: () => void; push: (ruta: string) => void }) {
  if (iniciado || !esNativo()) return
  iniciado = true
  const [{ SplashScreen }, { StatusBar, Style }, { App }, { Browser }] = await Promise.all([
    import("@capacitor/splash-screen"), import("@capacitor/status-bar"), import("@capacitor/app"), import("@capacitor/browser"),
  ])
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  if (plataforma() === "android") StatusBar.setBackgroundColor({ color: "#1B4332" }).catch(() => {})
  SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {})

  /* botón atrás de Android: vuelve de pantalla; en el inicio minimiza en vez de cerrar */
  App.addListener("backButton", ({ canGoBack }) => {
    const enInicio = ["/dashboard", "/login", "/"].includes(window.location.pathname)
    if (canGoBack && !enInicio) navegar.back()
    else App.minimizeApp().catch(() => {})
  })
  /* enlaces kiri.cyclonet.com.co/... (invitaciones) abren la pantalla dentro de la app */
  App.addListener("appUrlOpen", ({ url }) => {
    try { const u = new URL(url); if (u.pathname) navegar.push(u.pathname + u.search) } catch { /* url rara */ }
  })
  /* lo externo (FactoNet, WhatsApp, ayuda) se abre en el navegador de la app, no reemplaza a Kiri */
  const abrirOriginal = window.open.bind(window)
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const s = url?.toString() ?? ""
    if (/^https?:\/\//.test(s) && !s.includes(window.location.host)) { Browser.open({ url: s }).catch(() => abrirOriginal(s, target, features)); return null }
    return abrirOriginal(url, target, features)
  }) as typeof window.open
}

/** Vibración corta para el juego: "toque" (tocar el árbol), "fuerte" (sacudida), "logro" (cofre, nivel). */
export function vibrar(tipo: "toque" | "fuerte" | "logro" = "toque") {
  if (esNativo()) {
    import("@capacitor/haptics").then(({ Haptics, ImpactStyle, NotificationType }) => {
      if (tipo === "logro") Haptics.notification({ type: NotificationType.Success }).catch(() => {})
      else Haptics.impact({ style: tipo === "fuerte" ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {})
    }).catch(() => {})
    return
  }
  // Web en Android: vibración del navegador (iOS Safari no la tiene)
  try { navigator.vibrate?.(tipo === "logro" ? [12, 40, 18] : tipo === "fuerte" ? 22 : 8) } catch { /* sin vibración */ }
}

/* ─────────────────────────────── Compras dentro de la app ─────────────────────────────
 * Monedas y planes se venden con el sistema de cada tienda (lo exigen Apple y Google
 * para bienes digitales), a través de RevenueCat. Lo que se compra lo abona el
 * backend cuando RevenueCat avisa al webhook (POST /api/pagos/revenuecat): el
 * celular nunca suma monedas por su cuenta.
 *   NEXT_PUBLIC_REVENUECAT_IOS / NEXT_PUBLIC_REVENUECAT_ANDROID: claves públicas del SDK.
 */
const claveCompras = () => plataforma() === "ios" ? process.env.NEXT_PUBLIC_REVENUECAT_IOS : plataforma() === "android" ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID : undefined

/** IDs de producto en las tiendas (iguales en App Store Connect, Play Console y RevenueCat). */
export const PRODUCTOS = {
  monedas: { monedas_250: "kiri_monedas_250", monedas_600: "kiri_monedas_600", monedas_1300: "kiri_monedas_1300", monedas_2800: "kiri_monedas_2800" } as Record<string, string>,
  planes: { PLUS: "kiri_plus_mensual", PRO: "kiri_pro_mensual" } as Record<string, string>,
}

export const comprasDisponibles = (): boolean => esNativo() && !!claveCompras()

let configurado: string | null = null
async function compras(userId: string) {
  const { Purchases } = await import("@revenuecat/purchases-capacitor")
  if (configurado !== userId) {
    await Purchases.configure({ apiKey: claveCompras()!, appUserID: userId })
    configurado = userId
  }
  return Purchases
}

/** Precio local de cada producto según la tienda ("$4.900", "US$1.99"…). */
export async function preciosTienda(userId: string, ids: string[]): Promise<Record<string, string>> {
  if (!comprasDisponibles() || !ids.length) return {}
  try {
    const P = await compras(userId)
    const { products } = await P.getProducts({ productIdentifiers: ids })
    return Object.fromEntries(products.map(p => [p.identifier, p.priceString]))
  } catch { return {} }
}

export type ResultadoCompra = "ok" | "cancelada" | "error"
/** Compra un producto con la tienda. "ok" = la tienda cobró; las monedas o el plan los abona el servidor. */
export async function comprarEnTienda(userId: string, productId: string): Promise<ResultadoCompra> {
  if (!comprasDisponibles()) return "error"
  try {
    const P = await compras(userId)
    const { products } = await P.getProducts({ productIdentifiers: [productId] })
    if (!products[0]) return "error"
    await P.purchaseStoreProduct({ product: products[0] })
    return "ok"
  } catch (e) {
    return (e as { userCancelled?: boolean; code?: string })?.userCancelled || (e as { code?: string })?.code === "1" ? "cancelada" : "error"
  }
}

/** Restaurar compras (Apple lo exige para las suscripciones). */
export async function restaurarCompras(userId: string): Promise<boolean> {
  if (!comprasDisponibles()) return false
  try { const P = await compras(userId); await P.restorePurchases(); return true } catch { return false }
}
