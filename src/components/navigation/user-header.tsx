"use client"

import { useState, useRef } from "react"
import { useAppContext, Currency } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Lock, Coins, Moon, Sun, Camera, Globe } from "lucide-react"

export function UserHeader() {
  const { user, setUser, currency, setCurrency, isDarkMode, setIsDarkMode } = useAppContext()
  const { user: authUser } = useAuth()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: "", correo: "", avatarUrl: "" })
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOpenSettings = () => {
    setEditForm({ nombre: user.nombre, correo: user.correo, avatarUrl: user.avatarUrl })
    setSettingsOpen(true)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setEditForm(f => ({ ...f, avatarUrl: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = () => {
    setUser(editForm)
    setSettingsOpen(false)
  }

  return (
    <div className="hidden lg:flex items-center fixed top-5 right-8 z-40">
      {/* Botón configuración */}
      <button
        onClick={handleOpenSettings}
        className="h-[44px] w-[44px] bg-card border border-border rounded-2xl shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title="Configuración"
      >
        <Settings className="h-4 w-4" />
      </button>

      {/* ══ Modal configuración ══ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-cyclon-lavender" /> Configuración
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Foto de perfil */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Avatar className="h-20 w-20 border-4 border-cyclon-lavender/20">
                  <AvatarImage src={editForm.avatarUrl} />
                  <AvatarFallback className="bg-cyclon-lavender/10 text-cyclon-lavender font-bold text-xl">
                    {editForm.nombre?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 h-7 w-7 bg-cyclon-lavender rounded-full flex items-center justify-center shadow-lg"
                >
                  <Camera className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <p className="text-[10px] text-muted-foreground">Toca el ícono para cambiar la foto</p>
            </div>

            {/* Nombre y correo */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Nombre</Label>
                <Input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                  className="h-10 rounded-xl" placeholder="Tu nombre" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Correo</Label>
                <Input type="email" value={editForm.correo} onChange={e => setEditForm(f => ({ ...f, correo: e.target.value }))}
                  className="h-10 rounded-xl" placeholder="tu@correo.com" />
              </div>
            </div>

            {/* Apariencia */}
            <div className="space-y-3 pt-1 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Apariencia</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isDarkMode ? <Moon className="h-4 w-4 text-cyclon-sky" /> : <Sun className="h-4 w-4 text-cyclon-sky" />}
                  <Label className="font-medium text-sm">Modo Oscuro</Label>
                </div>
                <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-cyclon-mint" />
                  <Label className="font-medium text-sm">Moneda</Label>
                </div>
                <Select value={currency} onValueChange={v => setCurrency(v as Currency)}>
                  <SelectTrigger className="w-[100px] h-8 border-none bg-muted/50 font-bold text-xs">
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-cyclon-lavender" />
                  <Label className="font-medium text-sm">Idioma</Label>
                </div>
                <Select defaultValue="es">
                  <SelectTrigger className="w-[110px] h-8 border-none bg-muted/50 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seguridad */}
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Seguridad</p>
              <button
                onClick={() => { setSettingsOpen(false); setChangePwOpen(true) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left"
              >
                <div className="h-7 w-7 rounded-lg bg-cyclon-pink/20 flex items-center justify-center text-cyclon-pink shrink-0">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium">Cambiar Contraseña</span>
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSettingsOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSaveProfile} disabled={!editForm.nombre || !editForm.correo}
              className="bg-cyclon-lavender text-white font-bold rounded-xl px-6">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Modal cambiar contraseña ══ */}
      <Dialog open={changePwOpen} onOpenChange={setChangePwOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-cyclon-pink" /> Cambiar Contraseña
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Contraseña actual</Label>
              <Input type="password" value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nueva contraseña</Label>
              <Input type="password" value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Confirmar nueva contraseña</Label>
              <Input type="password" value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            {pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm && (
              <p className="text-xs text-destructive font-bold">Las contraseñas no coinciden.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setChangePwOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button
              disabled={!pwForm.current || !pwForm.next || pwForm.next !== pwForm.confirm}
              className="bg-cyclon-pink text-white font-bold rounded-xl px-6"
              onClick={() => {
                setChangePwOpen(false)
                setPwForm({ current: "", next: "", confirm: "" })
              }}
            >
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
