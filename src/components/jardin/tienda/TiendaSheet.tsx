"use client"

/**
 * Tienda del árbol 3D: habitantes de la isla, especies, colores de hojas,
 * accesorios, cofres y paquetes de monedas. Los precios, el saldo, la oferta del
 * día y lo que el usuario tiene vienen del servidor (GET /gamification/jardin/tienda);
 * aquí solo se muestran. Comprar y equipar también pasan por el servidor, que
 * descuenta y valida.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Apple, Bird, Bug, Check, Clock, Coins, Crown, Droplets, Fence, Flame, Flower2, Gem, Gift, Loader2, Lock, Palette, PiggyBank, Sparkles,
  Sprout, Store, Tag, TreeDeciduous, TreePalm, TreePine,
} from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { gamificationApi, type ArticuloTienda, type EstadoTienda, type RanuraCosmetico, type TipoCosmetico } from "@/lib/api-client"
import { tr } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { ACCESORIOS, COLORES_HOJA, ESPECIES, type ClaveColor, type ClaveEspecie } from "@/components/jardin/arbol3d/motor/especies"
import { comprarEnTienda, comprasDisponibles, preciosTienda } from "@/lib/nativo"

export type PestanaTienda = "habitantes" | "arboles" | "colores" | "accesorios" | "cofres" | "monedas"
export type TipoCofre = "comun" | "raro" | "legendario"

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0")
const fmt = (n: number) => n.toLocaleString("es-CO")

/** Los habitantes de la isla: qué hacen y con qué parte de tus finanzas reaccionan. */
export const HABITANTES: Record<string, { nombre: string; icono: LucideIcon; color: string; hace: string }> = {
  chanchito: { nombre: "Chanchito", icono: PiggyBank, color: "#f3a1b4", hace: "Engorda con tu ahorro del mes. Cada vez que ahorras le cae una moneda." },
  gnomo: { nombre: "Don Gnomo", icono: Flame, color: "#d8463a", hace: "Carga tu racha en un cartel y baila cuando sube. Si la racha llega a cero, se duerme." },
  pajaros: { nombre: "Casita de pájaros", icono: Bird, color: "#4da3e0", hace: "Cuando registras un ingreso, los pájaros vuelan cantando alrededor de tu árbol." },
}

const ICONO_ESPECIE: Record<ClaveEspecie, LucideIcon> = { kiri: TreeDeciduous, palmera: TreePalm, cerezo: Flower2, pino: TreePine, bonsai: Sprout }
type Grupo = "hormiguero" | "cerca" | "regadera" | "frutos"
const ICONO_GRUPO: Record<Grupo, LucideIcon> = { hormiguero: Bug, cerca: Fence, regadera: Droplets, frutos: Apple }
export const COFRE_INFO: Record<TipoCofre, { nombre: string; icono: LucideIcon; tono: string; como: string }> = {
  comun: { nombre: "Cofre común", icono: Gift, tono: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15", como: "Se gana al saldar una deuda por completo" },
  raro: { nombre: "Cofre raro", icono: Gem, tono: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/15", como: "Se gana al subir de nivel" },
  legendario: { nombre: "Cofre legendario", icono: Crown, tono: "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-500/15", como: "Solo se compra con monedas" },
}
const TITULO_GRUPO: Record<Grupo, string> = {
  hormiguero: "Hormiguero", cerca: "Cerca del fondo de emergencia", regadera: "Regadera", frutos: "Frutos",
}

/** Nombre visible de un artículo ("Pino", "Sakura", "Michi"...). */
export function nombreArticulo(tipo: TipoCosmetico, clave: string): string {
  if (tipo === "especie") return tr(ESPECIES[clave as ClaveEspecie]?.nombre ?? clave)
  if (tipo === "color") return clave === "auto" ? tr("Original") : tr(COLORES_HOJA[clave as ClaveColor]?.nombre ?? clave)
  if (tipo === "habitante") return tr(HABITANTES[clave]?.nombre ?? clave)
  const g = ACCESORIOS[tipo] as Record<string, { nombre: string }>
  return tr(g[clave]?.nombre ?? clave)
}

/** Cómo se lee el premio de un cofre: "el árbol Pino", "el color Sakura"... */
export function premioArticulo(tipo: TipoCosmetico, clave: string): string {
  const n = nombreArticulo(tipo, clave)
  switch (tipo) {
    case "especie": return tr("el árbol {0}", [n])
    case "color": return tr("el color {0}", [n])
    case "hormiguero": return tr("el hormiguero {0}", [n])
    case "cerca": return tr("la cerca {0}", [n])
    case "regadera": return tr("la regadera {0}", [n])
    case "frutos": return tr("los frutos {0}", [n])
    case "habitante": return tr("un nuevo habitante: {0}", [n])
  }
}

/** Muestra de color para la tarjeta: degradado de las hojas o el color del accesorio. */
function muestra(tipo: TipoCosmetico, clave: string, especie: ClaveEspecie): string {
  if (tipo === "habitante") { const c = HABITANTES[clave]?.color ?? "#7dc45a"; return `linear-gradient(135deg, ${c}, ${c}cc)` }
  if (tipo === "especie" || tipo === "color") {
    const k = tipo === "especie" ? ESPECIES[clave as ClaveEspecie]?.paleta : clave === "auto" ? ESPECIES[especie].paleta : clave as ClaveColor
    const P = COLORES_HOJA[k ?? "verde"] ?? COLORES_HOJA.verde
    return `linear-gradient(135deg, ${P.c[0]}, ${P.c[1]})`
  }
  const a = (ACCESORIOS[tipo] as Record<string, { a?: number; b?: number; c?: number; d?: number }>)[clave] ?? {}
  if (tipo === "hormiguero") return `linear-gradient(135deg, ${hex(a.a ?? 0xc98d4f)}, ${hex(a.b ?? 0x9a6233)})`
  if (tipo === "regadera") return `linear-gradient(135deg, ${hex(a.b ?? 0x3aa0c0)}, ${hex(a.d ?? 0x2a7a96)})`
  if (tipo === "frutos" && clave === "auto") return hex(ESPECIES[especie].fruta.color)
  return hex(a.c ?? 0xf1e4c8)
}

function iconoDe(tipo: TipoCosmetico, clave: string): LucideIcon | null {
  if (tipo === "especie") return ICONO_ESPECIE[clave as ClaveEspecie] ?? TreeDeciduous
  if (tipo === "habitante") return HABITANTES[clave]?.icono ?? Sparkles
  if (tipo === "color") return null
  return ICONO_GRUPO[tipo]
}

/** Lo que falta para la medianoche, cuando cambia la oferta ("5 h 20 min"). */
function hastaMedianoche(): string {
  const a = new Date(), m = new Date(a); m.setHours(24, 0, 0, 0)
  const min = Math.max(0, Math.round((m.getTime() - a.getTime()) / 60000))
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
}

interface Props {
  abierta: boolean
  onAbierta: (v: boolean) => void
  pestana: PestanaTienda
  onPestana: (p: PestanaTienda) => void
  estado: EstadoTienda | null
  onEstado: (e: EstadoTienda) => void
  /** Cierra la tienda y deja ese cofre listo en la isla para abrirlo */
  onVerCofre: (tipo: TipoCofre) => void
  onError: (mensaje: string) => void
  /** Volver a pedir el estado (las monedas compradas las abona el servidor unos segundos después) */
  onRecargar: () => Promise<unknown>
  onAviso: (mensaje: string) => void
}

export function TiendaSheet({ abierta, onAbierta, pestana, onPestana, estado, onEstado, onVerCofre, onError, onRecargar, onAviso }: Props) {
  /* "tipo:clave" del artículo que se está comprando/equipando; la compra pide un segundo toque para confirmar */
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [reloj, setReloj] = useState(hastaMedianoche)
  useEffect(() => {
    if (!confirmar) return
    const t = window.setTimeout(() => setConfirmar(null), 3500)
    return () => window.clearTimeout(t)
  }, [confirmar])
  useEffect(() => {
    if (!abierta) { setConfirmar(null); return }
    setReloj(hastaMedianoche())
    const t = window.setInterval(() => setReloj(hastaMedianoche()), 30000)
    return () => window.clearInterval(t)
  }, [abierta])

  const monedas = estado?.monedas ?? 0
  /* En la app nativa los paquetes se compran con la tienda (App Store / Google Play) */
  const conTienda = comprasDisponibles()
  const [precios, setPrecios] = useState<Record<string, string>>({})
  const userId = typeof window !== "undefined" ? (() => { try { return localStorage.getItem("kiri_user_id") ?? "" } catch { return "" } })() : ""
  useEffect(() => {
    if (!abierta || !conTienda || !estado || !userId) return
    preciosTienda(userId, estado.paquetes.map(p => p.producto)).then(setPrecios)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, conTienda, userId, estado?.paquetes.length])
  async function comprarPaquete(producto: string) {
    if (!userId) return
    setOcupado(producto)
    const r = await comprarEnTienda(userId, producto)
    if (r === "ok") {
      onAviso(tr("¡Compra lista! Tus monedas llegan en unos segundos"))
      // El webhook de la tienda abona las monedas: se revisa un par de veces
      for (const espera of [2500, 4000, 7000]) { await new Promise(res => window.setTimeout(res, espera)); await onRecargar() }
    } else if (r === "error") onError(tr("No se pudo completar la compra en la tienda"))
    setOcupado(null)
  }
  const especie = (estado?.equipado.especie ?? "kiri") as ClaveEspecie
  const oferta = estado?.oferta ?? null
  const precioDe = (tipo: TipoCosmetico, a: ArticuloTienda) => oferta && oferta.tipo === tipo && oferta.clave === a.clave ? oferta.precio : a.precio
  const enIsla = (clave: string) => estado?.equipado.habitantes.includes(clave) ?? false
  const estaPuesto = (tipo: TipoCosmetico, clave: string) => tipo === "habitante" ? enIsla(clave) : estado?.equipado[tipo as RanuraCosmetico] === clave

  async function equipar(tipo: TipoCosmetico, clave: string) {
    if (!estado) return
    const id = `${tipo}:${clave}`
    setOcupado(id)
    const { data, error } = await gamificationApi.equipar(tipo, clave)
    setOcupado(null)
    if (data) onEstado({ ...estado, equipado: data.equipado })
    else onError(error ?? tr("No se pudo equipar"))
  }

  async function comprar(tipo: TipoCosmetico | "cofre", clave: string) {
    const id = `${tipo}:${clave}`
    if (confirmar !== id) { setConfirmar(id); return }
    setConfirmar(null); setOcupado(id)
    const { data, error } = await gamificationApi.comprar(tipo, clave)
    setOcupado(null)
    if (!data) { onError(error ?? tr("No se pudo completar la compra")); return }
    onEstado(data.tienda)
    if (data.cofre) onVerCofre("legendario")
  }

  function BotonPrecio({ id, precio, normal, onClick }: { id: string; precio: number; normal?: number; onClick: () => void }) {
    const falta = precio - monedas, cargando = ocupado === id, confirmando = confirmar === id
    if (falta > 0) return (
      <span className="flex h-8 items-center justify-center gap-1 rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground" title={tr("Te faltan {0} monedas", [fmt(falta)])}>
        <Lock className="h-3 w-3" /><Coins className="h-3.5 w-3.5 text-amber-500" />{fmt(precio)}
      </span>
    )
    return (
      <button
        type="button" disabled={!!ocupado} onClick={onClick}
        className={cn("flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-extrabold disabled:opacity-60",
          confirmando ? "bg-emerald-600 text-white" : "bg-amber-400 text-amber-950 hover:bg-amber-300")}
      >
        {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirmando ? null : <Coins className="h-3.5 w-3.5" />}
        {confirmando ? tr("¿Comprar por {0}?", [fmt(precio)]) : fmt(precio)}
        {!confirmando && normal && normal > precio && <s className="ml-0.5 text-[10px] font-semibold opacity-60">{fmt(normal)}</s>}
      </button>
    )
  }

  function Accion({ tipo, a }: { tipo: TipoCosmetico; a: ArticuloTienda }) {
    const id = `${tipo}:${a.clave}`, puesto = estaPuesto(tipo, a.clave), cargando = ocupado === id
    if (tipo === "habitante" && (a.tiene || a.incluido)) return (
      <button type="button" disabled={!!ocupado} onClick={() => equipar(tipo, a.clave)}
        className={cn("flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-bold disabled:opacity-60",
          puesto ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20" : "border border-border hover:bg-muted")}>
        {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : puesto ? <Check className="h-3.5 w-3.5" /> : null}
        {puesto ? tr("En tu isla · quitar") : tr("Ponerlo en la isla")}
      </button>
    )
    if (puesto) return <span className="flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" />{tr("Equipado")}</span>
    if (a.tiene || a.incluido) return (
      <button type="button" disabled={!!ocupado} onClick={() => equipar(tipo, a.clave)} className="flex h-8 items-center justify-center gap-1 rounded-lg border border-border text-xs font-bold hover:bg-muted disabled:opacity-60">
        {cargando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{tr("Equipar")}
      </button>
    )
    return <BotonPrecio id={id} precio={precioDe(tipo, a)} normal={a.precio} onClick={() => comprar(tipo, a.clave)} />
  }

  function Tarjeta({ tipo, a, descripcion }: { tipo: TipoCosmetico; a: ArticuloTienda; descripcion: string }) {
    const Icono = iconoDe(tipo, a.clave), puesto = estaPuesto(tipo, a.clave), enOferta = oferta?.tipo === tipo && oferta.clave === a.clave
    return (
      <div className={cn("relative flex flex-col gap-2 rounded-xl border bg-card p-2.5", puesto ? "border-emerald-500/60 ring-1 ring-emerald-500/30" : "border-border")}>
        {enOferta && !a.tiene && <span className="absolute right-2 top-2 z-10 rounded-full bg-rose-500 px-1.5 text-[10px] font-black leading-4 text-white">-30%</span>}
        <div className="flex h-14 items-center justify-center rounded-lg" style={{ background: muestra(tipo, a.clave, especie) }}>
          {Icono && <Icono className="h-7 w-7 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />}
        </div>
        <div className="min-h-[2.25rem]">
          <p className="text-[13px] font-bold leading-tight">{nombreArticulo(tipo, a.clave)}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{descripcion}</p>
        </div>
        <Accion tipo={tipo} a={a} />
      </div>
    )
  }

  const Rejilla = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{children}</div>
  const Nota = ({ children }: { children: React.ReactNode }) => <p className="pt-3 text-[11px] leading-snug text-muted-foreground">{children}</p>

  const pendientes = (t: TipoCofre) => estado?.cofres.filter(c => c.tipo === t).length ?? 0
  const pct = (p: number) => Math.round(p * 100)
  const porPlan = estado?.plan.porPlan ?? { PLUS: 150, PRO: 400 }

  return (
    <Sheet open={abierta} onOpenChange={onAbierta}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 rounded-t-2xl p-0">
        <SheetHeader className="shrink-0 space-y-1 border-b border-border px-4 pb-3 pt-4 text-left">
          <SheetTitle className="flex items-center gap-2 pr-8 text-base">
            <Store className="h-[18px] w-[18px] text-emerald-600" />{tr("Tienda del jardín")}
            <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-sm font-extrabold text-amber-700 dark:text-amber-300">
              <Coins className="h-4 w-4" />{fmt(monedas)}
            </span>
          </SheetTitle>
          <SheetDescription className="text-xs">{tr("Personaliza tu isla con las monedas que ganas al ahorrar y pagar a tiempo.")}</SheetDescription>
        </SheetHeader>

        {!estado ? (
          <div className="flex flex-1 items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs value={pestana} onValueChange={v => onPestana(v as PestanaTienda)} className="flex min-h-0 flex-1 flex-col">
            {/* Oferta del día: cambia a medianoche */}
            {oferta && (
              <div className="mx-4 mt-3 flex shrink-0 items-center gap-3 rounded-xl border border-rose-400/40 bg-gradient-to-r from-rose-500/10 to-amber-400/10 p-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: muestra(oferta.tipo, oferta.clave, especie) }}>
                  {(() => { const I = iconoDe(oferta.tipo, oferta.clave) ?? Palette; return <I className="h-6 w-6 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" /> })()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-400"><Tag className="h-3 w-3" />{tr("Oferta del día")} · -30%</p>
                  <p className="truncate text-[13px] font-bold">{nombreArticulo(oferta.tipo, oferta.clave)}</p>
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />{tr("Termina en {0}", [reloj])}</p>
                </div>
                <div className="w-28 shrink-0">
                  <BotonPrecio id={`${oferta.tipo}:${oferta.clave}`} precio={oferta.precio} normal={oferta.precioNormal} onClick={() => comprar(oferta.tipo, oferta.clave)} />
                </div>
              </div>
            )}
            <div className="shrink-0 overflow-x-auto px-4 pt-3">
              <TabsList className="h-9 w-max min-w-full justify-start gap-0.5">
                <TabsTrigger value="habitantes" className="gap-1 px-2.5 text-xs"><Sparkles className="h-3.5 w-3.5" />{tr("Habitantes")}</TabsTrigger>
                <TabsTrigger value="arboles" className="gap-1 px-2.5 text-xs"><TreeDeciduous className="h-3.5 w-3.5" />{tr("Árboles")}</TabsTrigger>
                <TabsTrigger value="colores" className="gap-1 px-2.5 text-xs"><Palette className="h-3.5 w-3.5" />{tr("Colores")}</TabsTrigger>
                <TabsTrigger value="accesorios" className="gap-1 px-2.5 text-xs"><Fence className="h-3.5 w-3.5" />{tr("Accesorios")}</TabsTrigger>
                <TabsTrigger value="cofres" className="gap-1 px-2.5 text-xs">
                  <Gift className="h-3.5 w-3.5" />{tr("Cofres")}
                  {estado.cofres.length > 0 && <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-black leading-4 text-white">{estado.cofres.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="monedas" className="gap-1 px-2.5 text-xs"><Coins className="h-3.5 w-3.5" />{tr("Monedas")}</TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
              <TabsContent value="habitantes" className="mt-0">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {estado.catalogo.habitante.map(a => {
                    const info = HABITANTES[a.clave], Icono = info?.icono ?? Sparkles, puesto = enIsla(a.clave), enOferta = oferta?.tipo === "habitante" && oferta.clave === a.clave
                    return (
                      <div key={a.clave} className={cn("relative flex gap-3 rounded-xl border bg-card p-3", puesto ? "border-emerald-500/60 ring-1 ring-emerald-500/30" : "border-border")}>
                        {enOferta && !a.tiene && <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-1.5 text-[10px] font-black leading-4 text-white">-30%</span>}
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: muestra("habitante", a.clave, especie) }}>
                          <Icono className="h-7 w-7 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div>
                            <p className="text-[13px] font-bold leading-tight">{nombreArticulo("habitante", a.clave)}{a.incluido && <span className="ml-1.5 text-[10px] font-semibold text-emerald-600">{tr("Incluido")}</span>}</p>
                            <p className="text-[11px] leading-snug text-muted-foreground">{tr(info?.hace ?? "")}</p>
                          </div>
                          <Accion tipo="habitante" a={a} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Nota>{tr("Los habitantes viven en tu isla y reaccionan a tus finanzas reales. Puedes tener varios a la vez. Tócalos en la isla para ver qué te dicen.")}</Nota>
              </TabsContent>

              <TabsContent value="arboles" className="mt-0">
                <Rejilla>
                  {estado.catalogo.especie.map(a => <Tarjeta key={a.clave} tipo="especie" a={a} descripcion={a.incluido ? tr("Incluido") : tr("Nueva especie")} />)}
                </Rejilla>
                <Nota>{tr("Cada especie crece por niveles igual que tu árbol: semilla, brote, planta joven y árbol adulto.")}</Nota>
              </TabsContent>

              <TabsContent value="colores" className="mt-0">
                <Rejilla>
                  {estado.catalogo.color.map(a => <Tarjeta key={a.clave} tipo="color" a={a} descripcion={a.clave === "auto" ? tr("El de cada especie") : tr("Color de hojas")} />)}
                </Rejilla>
                <Nota>{tr("Los colores sirven para cualquier especie.")}</Nota>
              </TabsContent>

              <TabsContent value="accesorios" className="mt-0 space-y-4">
                {(Object.keys(TITULO_GRUPO) as Grupo[]).map(g => (
                  <section key={g}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{tr(TITULO_GRUPO[g])}</h3>
                    <Rejilla>
                      {estado.catalogo[g].map(a => <Tarjeta key={a.clave} tipo={g} a={a} descripcion={a.incluido ? tr("Incluido") : tr("Aspecto")} />)}
                    </Rejilla>
                  </section>
                ))}
                <Nota>{tr("Los accesorios cambian el hormiguero, la cerca del fondo de emergencia, la regadera y los frutos.")}</Nota>
              </TabsContent>

              <TabsContent value="cofres" className="mt-0">
                <div className="space-y-2.5">
                  {estado.cofresInfo.map(c => {
                    const I = COFRE_INFO[c.tipo], n = pendientes(c.tipo), Icono = I.icono
                    const partes = [tr("{0}–{1} monedas", [fmt(c.monedasMin), fmt(c.monedasMax)])]
                    if (c.probAspecto >= 1) partes.push(tr("un aspecto seguro que no tengas"))
                    else if (c.probAspecto > 0) partes.push(tr("{0} % de un aspecto", [pct(c.probAspecto)]))
                    if (c.probColor > 0) partes.push(c.probAspecto > 0 ? tr("si no, {0} % de un color", [pct(c.probColor)]) : tr("{0} % de un color", [pct(c.probColor)]))
                    return (
                      <div key={c.tipo} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", I.tono)}><Icono className="h-[22px] w-[22px]" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold">{tr(I.nombre)}</p>
                          <p className="text-[11px] leading-snug">{partes.join(" · ")}</p>
                          <p className="text-[11px] text-muted-foreground">{tr(I.como)}</p>
                        </div>
                        <div className="flex w-28 shrink-0 flex-col gap-1.5">
                          {n > 0 && (
                            <button type="button" onClick={() => onVerCofre(c.tipo)} className="flex h-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500">
                              {tr("Abrir ({0})", [n])}
                            </button>
                          )}
                          {c.precio > 0 && <BotonPrecio id={`cofre:${c.tipo}`} precio={c.precio} onClick={() => comprar("cofre", c.tipo)} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Nota>{tr("Las probabilidades se muestran en cada cofre y el premio lo sortea el servidor. Ningún cofre se vende por dinero real.")}</Nota>
              </TabsContent>

              <TabsContent value="monedas" className="mt-0">
                {/* Monedas del plan: PLUS y PRO reciben un regalo cada mes */}
                <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-[12px] leading-relaxed">
                  {estado.plan.monedasMes > 0 ? (
                    <p className="flex items-center gap-1.5 font-semibold"><Crown className="h-4 w-4 text-amber-500" />{tr("Tu plan {0} te regala {1} monedas cada mes.", [estado.plan.tier, fmt(estado.plan.monedasMes)])}</p>
                  ) : (
                    <>
                      <p className="flex items-center gap-1.5 font-bold"><Crown className="h-4 w-4 text-amber-500" />{tr("Monedas cada mes con tu plan")}</p>
                      <p className="mt-0.5 text-muted-foreground">{tr("Con KIRI PLUS recibes {0} monedas al mes y con KIRI PRO {1}, además de todo lo que desbloquean.", [fmt(porPlan.PLUS ?? 150), fmt(porPlan.PRO ?? 400)])}</p>
                      <Link href="/mi-plan" onClick={() => onAbierta(false)} className="mt-2 inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500">{tr("Ver planes")}</Link>
                    </>
                  )}
                </div>
                {conTienda && estado.primeraCompraDoble && (
                  <p className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-3 py-2 text-[12px] font-bold text-amber-800 dark:text-amber-200"><Sparkles className="h-4 w-4" />{tr("Tu primera compra trae el doble de monedas")}</p>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  {estado.paquetes.map(p => (
                    <div key={p.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
                      <p className="flex items-center gap-1 text-sm font-extrabold"><Coins className="h-4 w-4 text-amber-500" />{fmt(p.monedas)}{conTienda && estado.primeraCompraDoble && <span className="text-[11px] font-black text-amber-600">×2</span>}</p>
                      <p className="text-[11px] text-muted-foreground">{p.bono ? tr("Bono +{0} %", [p.bono]) : tr("Paquete inicial")}</p>
                      {conTienda ? (
                        <button type="button" disabled={!!ocupado} onClick={() => comprarPaquete(p.producto)} className="mt-auto flex h-8 items-center justify-center gap-1 rounded-lg bg-amber-400 text-xs font-extrabold text-amber-950 hover:bg-amber-300 disabled:opacity-60">
                          {ocupado === p.producto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : precios[p.producto] ?? tr("Comprar")}
                        </button>
                      ) : (
                        <span className="mt-auto flex h-8 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                          {p.disponible ? `$${fmt(p.precioCop)} COP` : tr("Próximamente")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {conTienda && <p className="pt-2 text-[10px] leading-snug text-muted-foreground">{tr("El pago lo hace la tienda de tu celular. Las monedas son para la tienda del jardín y no se pueden cambiar por dinero.")}</p>}
                <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-[12px] leading-relaxed">
                  <p className="mb-1 font-bold">{tr("Cómo ganar monedas")}</p>
                  <ul className="space-y-0.5">
                    <li>{tr("Registrar un ahorro: +{0} (hasta {1} al día; hoy llevas {2})", [estado.abonos.ahorro.monedas, estado.abonos.ahorro.maxDia, estado.abonos.ahorro.hoy])}</li>
                    <li>{tr("Pagar una obligación: +{0} (hasta {1} al día; hoy llevas {2})", [estado.abonos.pago.monedas, estado.abonos.pago.maxDia, estado.abonos.pago.hoy])}</li>
                    <li>{tr("Saldar una deuda por completo: +{0} y un cofre común", [estado.abonos.deuda.monedas])}</li>
                    <li>{tr("Subir de nivel: un cofre raro")}</li>
                  </ul>
                  <p className="mt-1.5 text-muted-foreground">{tr("Regar, sacudir y cosechar dan XP a tu árbol, no monedas.")}</p>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
