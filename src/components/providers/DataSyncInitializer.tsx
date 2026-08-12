"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { syncLocalDataToDB } from "@/lib/api-client"

/**
 * DataSyncInitializer
 *
 * Componente invisible que se monta en el layout del dashboard.
 * En el primer render tras login, migra los datos que estaban en localStorage
 * (bolsillos de ahorro y categorías de presupuesto) hacia la base de datos.
 *
 * Solo se ejecuta una vez gracias al flag `kiri_local_data_synced` en localStorage.
 * No afecta el render ni bloquea la UI.
 */
export function DataSyncInitializer() {
  const { user } = useAuth()
  const synced = useRef(false)

  useEffect(() => {
    if (!user || synced.current) return
    synced.current = true

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
