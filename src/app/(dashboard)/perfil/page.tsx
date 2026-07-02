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
import { Moon, Sun, Coins, Lock, LogOut, ChevronRight, Camera, Pencil, Globe, Timer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAppContext, Currency } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"

export default function PerfilPage() {
  const router = useRouter()
  const { user, setUser, currency, setCurrency, isDarkMode, setIsDarkMode, inactivityTimeout, setInactivityTimeout } = useAppContext()
  const { signOut, user: authUser } = useAuth()
  const displayEmail = authUser?.correo ?? user.correo

  const handleLogout = async () => {
    await signOut()
    router.replace("/login")
  }

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: user.nombre, correo: user.correo, avatarUrl: user.avatarUrl })
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
    setEditForm({ nombre: user.nombre, correo: user.correo, avatarUrl: user.avatarUrl })
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

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyclon-mint/20 flex items-center justify-center text-cyclon-mint">
                  <Coins className="h-4 w-4" />
                </div>
                <Label className="font-medium">Moneda</Label>
              </div>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-[110px] h-9 border-none bg-muted/50 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="COP">COP ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="MXN">MXN ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyclon-lavender/20 flex items-center justify-center text-cyclon-lavender">
                  <Globe className="h-4 w-4" />
                </div>
                <Label className="font-medium">Idioma</Label>
              </div>
              <Select defaultValue="es">
                <SelectTrigger className="w-[110px] h-9 border-none bg-muted/50 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
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
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left">
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
    </div>
  )
}
