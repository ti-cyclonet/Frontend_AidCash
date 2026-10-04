"use client"

import { motion, useReducedMotion } from "framer-motion"

/**
 * Entrada suave de cada módulo al navegar (Next.js vuelve a montar el
 * template en cada cambio de ruta). Corta a propósito: se siente fluido sin
 * hacer esperar. Con "reducir movimiento" del sistema, solo un fundido.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const reducir = useReducedMotion()
  return (
    <motion.div
      initial={reducir ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
