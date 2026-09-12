"use client"

import { motion } from "framer-motion"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Modal de celebración genérico — mismo look & feel que el cofre sorpresa de
 * Misiones (ícono con resorte + texto que aparece después), reutilizado para
 * cualquier "logro" puntual: liquidar una deuda, alcanzar una meta de ahorro,
 * etc. Antes estos momentos no tenían ningún festejo en la app — el usuario
 * pagaba su última cuota o completaba su meta y la UI seguía como si nada.
 */
export function CelebrationModal({
  open,
  onClose,
  icon,
  title,
  subtitle,
  buttonLabel = "Genial",
}: {
  open: boolean
  onClose: () => void
  icon: string
  title: string
  subtitle: string
  buttonLabel?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="text-center">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {open && (
          <>
            <motion.div
              key="celebration-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="text-6xl mb-3"
            >
              {icon}
            </motion.div>
            <motion.div
              key="celebration-text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <p className="text-lg font-black">{title}</p>
              <p className="text-xs text-muted-foreground mb-5">{subtitle}</p>
              <Button
                onClick={onClose}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl"
              >
                {buttonLabel}
              </Button>
            </motion.div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
