"use client"

import { useSmartAlerts } from "@/hooks/use-smart-alerts"

/**
 * Componente invisible que activa el sistema de alertas inteligentes.
 * Se monta en el layout del dashboard para que las alertas se disparen
 * al abrir la app (o cualquier página del dashboard).
 */
export function SmartAlertsProvider() {
  useSmartAlerts()
  return null
}
