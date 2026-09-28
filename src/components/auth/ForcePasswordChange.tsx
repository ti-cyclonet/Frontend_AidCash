"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, mustChangePassword, clearMustChangePassword } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

/**
 * Tras un restablecimiento desde Authoriza la cuenta queda con una contraseña
 * temporal: este diálogo bloquea la app (no se puede cerrar) hasta que el
 * usuario la cambie, o hasta que cierre sesión.
 */
export function ForcePasswordChange() {
  const router = useRouter()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setOpen(mustChangePassword())
  }, [])

  const handleSubmit = async () => {
    setError("")
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Completa todos los campos.")
      return
    }
    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)
    const { error: apiError } = await api<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }
    clearMustChangePassword()
    setOpen(false)
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace("/login")
  }

  if (!open) return null

  return (
    <Dialog open onOpenChange={() => { /* no se puede cerrar sin cambiarla */ }}>
      <DialogContent
        className="[&>button:last-child]:hidden"
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Crea tu nueva contraseña</DialogTitle>
          <DialogDescription>
            Tu contraseña fue restablecida. Para continuar, reemplaza la contraseña temporal por una propia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Contraseña temporal</Label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="La que usaste para entrar" />
          </div>
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nueva contraseña</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la nueva contraseña" />
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg p-2">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleSignOut}>Cerrar sesión</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-cyclon-lavender text-white font-bold rounded-xl px-8"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
