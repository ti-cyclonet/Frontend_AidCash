"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { syncLocalDataToDB } from "@/lib/api-client"

/**
 * DataSyncInitializer
 *
 * Componente invisible que se monta en el layout del dashboard.
 * En el primer render tras login, migra los datos que estaban en localStorage
 * (bolsillos de ahorro y categorías de presupuesto) hacia la base de datos.
 *
 * Solo se ejecuta una vez gracias al flag `kiri_local_data_synced` en localStorage
 * — la propia syncLocalDataToDB() lo reclama de forma síncrona apenas decide
 * seguir, así que es seguro dejar que este efecto se dispare más de una vez
 * (p. ej. bajo el doble-render de Strict Mode en desarrollo): la segunda vez
 * simplemente encuentra el flag ya puesto y no hace nada. Un `ref` local aquí
 * NO sirve para esto — Strict Mode cancela el primer timeout en su ciclo de
 * cleanup+remount, y un ref ya "gastado" bloquea el segundo (real) intento
 * antes de que llegue a dispararse, dejando la migración sin ejecutarse nunca.
 */
export function DataSyncInitializer() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    // Ejecutar sincronización después de 1s para no competir con el render inicial
    const timer = setTimeout(async () => {
      try {
        const result = await syncLocalDataToDB()
        if (result.pocketsSynced > 0 || result.categoriesSynced > 0) {
          console.log(
            `[DataSync] Migración completada: ${result.pocketsSynced} bolsillos, ${result.categoriesSynced} categorías`
          )
        }
      } catch (error) {
        console.error('[DataSync] Error durante sincronización:', error)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [user])

  return null
}
