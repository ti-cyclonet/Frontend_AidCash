"use client"

/**
 * Regalar un cofre a un amigo de Social. Se usa desde la tienda del jardín
 * (eligiendo a quién) y desde la tarjeta de presentación de una conexión (ya
 * con el amigo elegido). El servidor cobra las monedas al que regala, valida
 * que sean conexiones y le avisa al amigo; el premio lo sortea al abrirlo él.
 */
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Check, Coins, Crown, Gem, Gift, Loader2, Lock, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { connectionsApi, gamificationApi, type EstadoTienda } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { tr } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type TipoCofre = "comun" | "raro" | "legendario"
interface Amigo { id: string; nombre: string }

const COFRES: Record<TipoCofre, { nombre: string; icono: LucideIcon; tono: string }> = {
  comun: { nombre: "Cofre común", icono: Gift, tono: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15" },
  raro: { nombre: "Cofre raro", icono: Gem, tono: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/15" },
  legendario: { nombre: "Cofre legendario", icono: Crown, tono: "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-500/15" },
}
const fmt = (n: number) => n.toLocaleString("es-CO")

export function RegalarCofre({ abierto, onAbierto, amigo: amigoFijo, tipoInicial, onHecho }: {
  abierto: boolean
  onAbierto: (v: boolean) => void
  /** Si viene, se le regala a esa persona (tarjeta de Social); si no, se elige de la lista */
  amigo?: Amigo | null
  tipoInicial?: TipoCofre
  onHecho?: (tienda: EstadoTienda) => void
}) {
  const { toast } = useToast()
  const [tienda, setTienda] = useState<EstadoTienda | null>(null)
  const [amigos, setAmigos] = useState<Amigo[] | null>(null)
  const [amigo, setAmigo] = useState<Amigo | null>(amigoFijo ?? null)
  const [tipo, setTipo] = useState<TipoCofre>(tipoInicial ?? "comun")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setAmigo(amigoFijo ?? null); setTipo(tipoInicial ?? "comun")
    gamificationApi.tienda().then(({ data }) => { if (data) setTienda(data) })
    if (!amigoFijo) {
      const yo = (() => { try { return localStorage.getItem("kiri_user_id") ?? "" } catch { return "" } })()
      connectionsApi.list().then(({ data }) => {
        const lista = (data?.accepted ?? []).map(c => {
          const r = c.requester as { id: string; nombre: string } | undefined, a = c.addressee as { id: string; nombre: string } | undefined
          const otro = c.requesterId === yo ? a : r
          return otro ? { id: otro.id, nombre: otro.nombre } : null
        }).filter((x): x is Amigo => !!x)
        setAmigos(lista)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, amigoFijo?.id, tipoInicial])

  const precio = (t: TipoCofre) => tienda?.cofresInfo.find(c => c.tipo === t)?.precio ?? 0
  const monedas = tienda?.monedas ?? 0
  const alcanza = monedas >= precio(tipo)

  async function regalar() {
    if (!amigo || !alcanza) return
    setEnviando(true)
    const { data, error } = await gamificationApi.regalarCofre(amigo.id, tipo)
    setEnviando(false)
    if (!data) { toast({ title: tr("No se pudo regalar el cofre"), description: error ?? undefined, variant: "destructive" }); return }
    toast({ title: tr("Le regalaste un {0} a {1}", [tr(COFRES[tipo].nombre).toLowerCase(), data.regalo.para]), description: tr("Le avisamos para que lo abra en su jardín.") })
    onHecho?.(data.tienda)
    onAbierto(false)
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbierto}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-rose-500" />{amigoFijo ? tr("Regalarle un cofre a {0}", [amigoFijo.nombre.split(" ")[0]]) : tr("Regalar un cofre")}</DialogTitle>
          <DialogDescription>{tr("Se paga con tus monedas. Tu amigo lo abre en su jardín y el premio es para él.")}</DialogDescription>
        </DialogHeader>

        {!amigoFijo && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground">{tr("¿A quién?")}</p>
            {amigos === null ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : amigos.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground"><Users className="h-4 w-4" />{tr("Aún no tienes conexiones en Social. Agrega a un amigo para regalarle cofres.")}</p>
            ) : (
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {amigos.map(a => (
                  <button key={a.id} type="button" onClick={() => setAmigo(a)}
                    className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      amigo?.id === a.id ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-border hover:bg-muted")}>
                    {amigo?.id === a.id && <Check className="h-3 w-3" />}{a.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">{tr("¿Qué cofre?")}</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(COFRES) as TipoCofre[]).map((t, i) => {
              const C = COFRES[t], Icono = C.icono, elegido = tipo === t, falta = precio(t) > monedas
              return (
                <motion.button key={t} type="button" onClick={() => setTipo(t)}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, scale: elegido ? 1.03 : 1 }} transition={{ delay: i * 0.05 }}
                  className={cn("flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-center", elegido ? "border-rose-500 bg-rose-500/5" : "border-border")}>
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", C.tono)}><Icono className="h-5 w-5" /></span>
                  <span className="text-[11px] font-bold leading-tight">{tr(C.nombre)}</span>
                  <span className={cn("flex items-center gap-0.5 text-[11px] font-extrabold", falta ? "text-muted-foreground" : "text-amber-600")}>
                    {falta ? <Lock className="h-3 w-3" /> : <Coins className="h-3 w-3" />}{fmt(precio(t))}
                  </span>
                </motion.button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">{tr("Tienes {0} monedas.", [fmt(monedas)])}</p>
        </div>

        <button type="button" disabled={!amigo || !alcanza || enviando || !tienda} onClick={regalar}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-extrabold text-white hover:bg-rose-400 disabled:opacity-50">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
          {!amigo ? tr("Elige a quién regalarle") : !alcanza ? tr("Te faltan {0} monedas", [fmt(precio(tipo) - monedas)]) : tr("Regalar por {0} monedas", [fmt(precio(tipo))])}
        </button>
      </DialogContent>
    </Dialog>
  )
}
