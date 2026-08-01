"use client"

import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Moon, Sun, Coins, Lock, LogOut, ChevronRight, Camera, Pencil, Globe, Timer, HelpCircle, BookOpen, MessageCircle, Sparkles, Crown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAppContext, Currency } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { usePlan } from "@/lib/plan-context"
import { api } from "@/lib/api-client"

export default function PerfilPage() {
  const router = useRouter()
  const { user, setUser, currency, setCurrency, isDarkMode, setIsDarkMode, inactivityTimeout, setInactivityTimeout } = useAppContext()
  const { signOut, user: authUser } = useAuth()
  const { plan } = usePlan()
  const displayEmail = authUser?.correo ?? user.correo
  const isPlus = plan?.planName?.toLowerCase().includes("plus")

  const handleLogout = async () => {
    await signOut()
    router.replace("/login")
  }

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: user.nombre, correo: user.correo, avatarUrl: user.avatarUrl })
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const handleOpenGuia = () => router.push("/guia-kiri")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setEditForm(f => ({ ...f, avatarUrl: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = () => {
    setUser(editForm)
    setIsEditOpen(false)
  }

  const handleOpenEdit = () => {
    setEditForm({
      nombre: user.nombre || authUser?.nombre || "",
      correo: user.correo || displayEmail || "",
      avatarUrl: user.avatarUrl,
    })
    setIsEditOpen(true)
  }

  const initials = user.nombre.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-cyclon-lavender">Perfil</h1>
        <p className="text-muted-foreground text-sm">Configura tu experiencia.</p>
      </header>

      {/* User Info Card */}
      <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-16 w-16 border-4 border-cyclon-lavender/10">
            <AvatarImage src={user.avatarUrl} />
            <AvatarFallback className="bg-cyclon-lavender/10 text-cyclon-lavender font-bold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{user.nombre}</h2>
            <p className="text-sm text-muted-foreground truncate">{displayEmail}</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleOpenEdit}>
            <Pencil className="h-5 w-5 text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>

      {/* Plan Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">Mi Plan</h3>
        <Card className="border-none shadow-sm bg-card rounded-2xl">
          <CardContent className="p-0">
            <button
              onClick={() => router.push("/mi-plan")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isPlus ? "bg-amber-100 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                  {isPlus ? <Crown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div>
                  <span className="font-medium">{plan?.planName || "Sin plan"}</span>
                  <p className="text-[10px] text-muted-foreground">
                    {isPlus ? "Todas las funcionalidades desbloqueadas" : "Funcionalidades básicas"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isPlus && (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Mejorar
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* App Settings */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">Aplicación</h3>
        <Card className="border-none shadow-sm bg-card rounded-2xl">
          <CardContent className="p-0 divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyclon-sky/10 flex items-center justify-center text-cyclon-sky">
                  {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </div>
                <Label htmlFor="dark-mode" className="font-medium">Modo Oscuro</Label>
              </div>
              <Switch id="dark-mode" checked={isDarkMode} onCheckedChange={setIsDarkMode} />
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyclon-pink/10 flex items-center justify-center text-cyclon-pink">
                  <Timer className="h-4 w-4" />
                </div>
                <Label className="font-medium">Tiempo de inactividad</Label>
              </div>
              <Select value={inactivityTimeout} onValueChange={(v) => setInactivityTimeout(v as "2" | "5" | "10" | "never")}>
                <SelectTrigger className="w-[110px] h-9 border-none bg-muted/50 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 min</SelectItem>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="never">Nunca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">Seguridad</h3>
        <Card className="border-none shadow-sm bg-card rounded-2xl">
          <CardContent className="p-0">
            <button onClick={() => setIsPasswordOpen(true)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyclon-pink/20 flex items-center justify-center text-cyclon-pink">
                  <Lock className="h-4 w-4" />
                </div>
                <span className="font-medium">Cambiar Contraseña</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Ayuda */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">Ayuda</h3>
        <Card className="border-none shadow-sm bg-card rounded-2xl">
          <CardContent className="p-0 divide-y divide-border">
            <button
              onClick={handleOpenGuia}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-kiri-emerald/20 flex items-center justify-center text-kiri-emerald">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-medium">Guía Kiri</span>
                  <p className="text-[10px] text-muted-foreground">Descubre cómo funciona cada módulo</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <a href="mailto:notificaciones@cyclonet.com.co?subject=Soporte%20Kiri%20Finance" className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyclon-sky/20 flex items-center justify-center text-cyclon-sky">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-medium">Soporte</span>
                  <p className="text-[10px] text-muted-foreground">¿Necesitas ayuda? Escríbenos</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyclon-lavender/20 flex items-center justify-center text-cyclon-lavender">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-medium">Preguntas frecuentes</span>
                  <p className="text-[10px] text-muted-foreground">Resuelve tus dudas</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </div>

      <Button
        variant="destructive"
        onClick={handleLogout}
        className="w-full h-14 rounded-2xl text-lg font-bold flex items-center gap-2 shadow-lg shadow-destructive/20"
      >
        <LogOut className="h-5 w-5" />
        Cerrar Sesión
      </Button>

      <div className="text-center pt-4">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Kiri Finance v1.0.0</p>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent >
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Avatar picker */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-cyclon-lavender/20">
                  <AvatarImage src={editForm.avatarUrl} />
                  <AvatarFallback className="bg-cyclon-lavender/10 text-cyclon-lavender font-bold text-2xl">
                    {editForm.nombre.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 h-8 w-8 bg-cyclon-lavender rounded-full flex items-center justify-center shadow-lg"
                >
                  <Camera className="h-4 w-4 text-white" />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <p className="text-xs text-muted-foreground">Toca el ícono para cambiar la foto</p>
            </div>

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editForm.nombre}
                onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Tu nombre"
              />
            </div>

            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                type="email"
                value={editForm.correo}
                onChange={e => setEditForm(f => ({ ...f, correo: e.target.value }))}
                placeholder="tu@correo.com"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveProfile}
              disabled={!editForm.nombre || !editForm.correo}
              className="bg-cyclon-lavender text-white font-bold rounded-xl px-8"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <ChangePasswordDialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen} />
    </div>
  )
}

// ─── Change Password Dialog ───────────────────────────────────────────────────

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setError("")
    setSuccess(false)
  }

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

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
    const { data, error: apiError } = await api<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    })
    setLoading(false)

    if (apiError) {
      setError(apiError)
      return
    }

    setSuccess(true)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar Contraseña</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Lock className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-medium">Contraseña actualizada exitosamente</p>
            <Button onClick={() => handleClose(false)} className="mt-2">Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Contraseña actual</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>Nueva contraseña</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar nueva contraseña</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg p-2">{error}</p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-cyclon-lavender text-white font-bold rounded-xl px-8"
              >
                {loading ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
