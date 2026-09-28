"use client"

import { useEffect, useState } from "react"
import { Landmark, Lock, RefreshCw, Loader2 } from "lucide-react"
import { usePlan } from "@/lib/plan-context"
import { openBankingApi, type BelvoLink } from "@/lib/api-client"

/**
 * Conexión con el banco (Belvo) — KIRI PRO.
 *
 * Sin PRO muestra el candado y el aviso para subir de plan. Con PRO muestra
 * los bancos ya conectados (y sincronizarlos); si el servidor todavía no tiene
 * las credenciales de Belvo, dice que está por llegar en vez de fallar.
 */
export function ConexionBancoCard() {
  const { hasFeature, loading } = usePlan()
  const esPro = hasFeature("openBanking")
  const [configurado, setConfigurado] = useState<boolean | null>(null)
  const [links, setLinks] = useState<BelvoLink[]>([])
  const [sincronizando, setSincronizando] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !esPro) return
    openBankingApi.getStatus().then(({ data }) => {
      setConfigurado(!!data?.configured)
      if (data?.configured) openBankingApi.listLinks().then(({ data: l }) => setLinks(l?.links ?? []))
    })
  }, [loading, esPro])

  const pedirPro = () => window.dispatchEvent(new CustomEvent("kiri:limite", { detail: {
    codigo: "FUNCION", mejora: { plan: "KIRI PRO" },
    mensaje: "Conectar tu banco para traer tus movimientos solos es parte de KIRI PRO.",
  } }))

  const sincronizar = async (id: string) => {
    setSincronizando(id)
    await openBankingApi.syncLink(id)
    setSincronizando(null)
  }

  return (
    <button type="button" onClick={esPro ? undefined : pedirPro}
      className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${esPro ? "bg-amber-100 text-amber-600" : "bg-muted text-muted-foreground"}`}>
        {esPro ? <Landmark className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium flex items-center gap-1.5">
          Conexión con tu banco
          <span className="text-[8px] font-black text-amber-700 dark:text-amber-300 bg-amber-400/25 px-1.5 py-0.5 rounded">PRO</span>
        </span>
        {!esPro ? (
          <p className="text-[10px] text-muted-foreground">Trae tus movimientos del banco sin anotarlos a mano. Disponible en KIRI PRO.</p>
        ) : configurado === null ? (
          <p className="text-[10px] text-muted-foreground">Revisando…</p>
        ) : !configurado ? (
          <p className="text-[10px] text-muted-foreground">Pronto disponible: estamos terminando la conexión con los bancos. Te avisaremos cuando puedas activarla.</p>
        ) : links.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Aún no conectas ningún banco. Muy pronto podrás hacerlo desde aquí.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {links.map(l => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate">{l.institution}</span>
                <span role="button" tabIndex={0} onClick={() => sincronizar(l.id)} onKeyDown={e => { if (e.key === "Enter") sincronizar(l.id) }}
                  className="text-kiri-emerald font-bold flex items-center gap-1 cursor-pointer">
                  {sincronizando === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sincronizar
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </button>
  )
}
