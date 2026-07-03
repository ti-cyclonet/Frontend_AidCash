"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { Landmark, Sprout, PiggyBank, TrendingUp, LogOut, ChevronUp, Settings, Lock, Coins, Moon, Sun, Camera, Globe, BookOpen, Users, PanelLeftClose, PanelLeftOpen, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppContext, Currency } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { useSocket, KiriNotification, SOCKET_EVENTS } from "@/lib/socket-context"

const navItems = [
  { label: "Gestión",      icon: TrendingUp, href: "/gestion" },
  { label: "Obligaciones", icon: Landmark,   href: "/obligaciones" },
  { label: "Balance",      icon: BookOpen,   href: "/balance" },
  { label: "Social",       icon: Users,      href: "/social" },
  { label: "Ahorro",       icon: PiggyBank,  href: "/ahorro" },
]

function notifTitleSidebar(n: KiriNotification): string {
  const d = n.data
  switch (n.event) {
    case SOCKET_EVENTS.NEW_INVITE: return `${(d.from as { nombre?: string })?.nombre ?? "Alguien"} te invitó`
    case SOCKET_EVENTS.INVITE_ACCEPTED: return `Invitación aceptada`
    case SOCKET_EVENTS.SHARED_DEPOSIT: return `Depósito en bolsillo compartido`
    case SOCKET_EVENTS.LOAN_REQUESTED: return `Solicitud de préstamo`
    case SOCKET_EVENTS.LOAN_APPROVED: return `Préstamo aprobado`
    case SOCKET_EVENTS.LOAN_PAYMENT: return `Abono recibido`
    case SOCKET_EVENTS.LOAN_PAYMENT_CONFIRMED: return `Abono confirmado`
    default: return "Nueva notificación"
  }
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, setUser, currency, setCurrency, isDarkMode, setIsDarkMode } = useAppContext()
  const { signOut, user: authUser } = useAuth()
  const { unreadCount, notifications, markAllRead, clearNotifications } = useSocket()

  const [collapsed, setCollapsed] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // ── Configuración ─────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: "", correo: "", avatarUrl: "" })
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayEmail = authUser?.correo ?? user.correo
  const initials = user.nombre
    ? user.nombre.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "KF"

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleLogout = async () => {
    setDropOpen(false)
    await signOut()
    router.replace("/login")
  }

  const handleOpenSettings = () => {
    setDropOpen(false)
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
    <aside className={cn(
      "hidden lg:flex flex-col h-screen bg-card border-r border-border sticky top-0 shrink-0 transition-all duration-300 z-40",
      collapsed ? "w-[68px]" : "w-[260px]"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center h-[72px] border-b border-border shrink-0 w-full",
        collapsed ? "justify-center px-2" : "px-4 gap-3"
      )}>
        {collapsed ? (
          /* ── Colapsada: Logo con hover que muestra botón de abrir ── */
          <button
            onClick={() => setCollapsed(false)}
            className="relative h-9 w-9 rounded-xl group"
            title="Abrir barra lateral"
          >
            {/* Logo — visible por defecto, se oculta en hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-kiri-emerald rounded-xl transition-opacity duration-200 group-hover:opacity-0">
              <Sprout className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            {/* Icono abrir — invisible por defecto, aparece en hover */}
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-muted/80 text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <PanelLeftOpen className="h-4 w-4" />
            </div>
          </button>
        ) : (
          /* ── Expandida: Logo link + nombre + campana + botón cerrar ── */
          <>
            <Link href="/dashboard" className="flex items-center gap-2 min-w-0 shrink-0">
              <div className="h-9 w-9 bg-kiri-emerald rounded-xl flex items-center justify-center shrink-0">
                <Sprout className="h-4 w-4 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-foreground leading-tight">Kiri Finance</h1>
                <p className="text-[9px] text-muted-foreground">Tus finanzas, en orden</p>
              </div>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              {/* Campana de notificaciones */}
              <div className="relative">
                <button onClick={() => { setNotifsOpen(v => !v); markAllRead() }}
                  className="relative h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 h-3.5 min-w-3.5 px-0.5 bg-cyclon-pink rounded-full flex items-center justify-center text-[7px] font-black text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {/* Panel de notificaciones */}
                {notifsOpen && (
                  <div className="fixed top-[80px] left-[270px] w-[320px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-[100]">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <p className="text-xs font-bold flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Notificaciones</p>
                      <div className="flex items-center gap-2">
                        {notifications.length > 0 && (
                          <button onClick={clearNotifications} className="text-[9px] text-muted-foreground hover:text-destructive">Limpiar</button>
                        )}
                        <button onClick={() => setNotifsOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                          <Bell className="h-7 w-7 opacity-30" />
                          <p className="text-xs">Sin notificaciones</p>
                        </div>
                      ) : (
                        notifications.slice(0, 10).map(n => (
                          <button key={n.id} onClick={() => { setNotifsOpen(false); router.push((n.data.route as string) || "/social") }}
                            className={cn("w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0", !n.read && "bg-cyclon-lavender/5")}>
                            <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs leading-snug", !n.read && "font-semibold")}>{notifTitleSidebar(n)}</p>
                            </div>
                            {!n.read && <div className="h-2 w-2 rounded-full bg-cyclon-lavender shrink-0 mt-1.5" />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors shrink-0"
                title="Cerrar barra lateral"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
      {/* Nav items */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const showBadge = item.href === "/social" && unreadCount > 0
            return (
              <Tooltip key={item.href} disableHoverableContent={!collapsed}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative",
                      collapsed ? "justify-center h-11 w-11 mx-auto" : "gap-3 px-4 py-3",
                      isActive
                        ? "bg-kiri-emerald/10 text-kiri-emerald font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-kiri-emerald")} strokeWidth={isActive ? 2.5 : 2} />
                    {!collapsed && <span>{item.label}</span>}
                    {showBadge && (
                      <span className={cn(
                        "h-4 min-w-4 px-1 bg-cyclon-pink rounded-full flex items-center justify-center text-[8px] font-black text-white",
                        collapsed ? "absolute top-0.5 right-0.5" : "ml-auto"
                      )}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right" className="font-semibold">{item.label}</TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </nav>

        {/* ── Footer: pill de usuario ── */}
        <div className="border-t border-border px-2 py-3" ref={dropRef}>
          <div className="relative">

            {/* Dropdown (aparece encima) */}
            {dropOpen && (
              <div className={cn(
                "absolute bottom-full mb-2 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50",
                collapsed ? "left-full ml-2 w-[280px]" : "left-0 right-0"
              )}>
                <button
                  onClick={() => { setDropOpen(false); router.push("/perfil") }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                  Configuración
                </button>
                <div className="border-t border-border" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Cerrar Sesión
                </button>
              </div>
            )}

            {/* Botón pill */}
            <Tooltip disableHoverableContent={!collapsed}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDropOpen(v => !v)}
                  className={cn(
                    "w-full flex items-center rounded-xl transition-colors hover:bg-muted/50",
                    collapsed ? "justify-center h-11 w-11 mx-auto" : "gap-3 px-3 py-2.5"
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback className="bg-kiri-mint text-kiri-emerald text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold truncate leading-tight">{user.nombre || "Usuario"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{displayEmail}</p>
                      </div>
                      <ChevronUp className={cn(
                        "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                        !dropOpen && "rotate-180"
                      )} />
                    </>
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="font-semibold">{user.nombre || "Usuario"}</TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>

      {/* ══ Modal configuración ══ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-cyclon-lavender" /> Configuración
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-1">
            {/* Foto */}
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
                <Input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} className="h-10 rounded-xl" placeholder="Tu nombre" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Correo</Label>
                <Input type="email" value={editForm.correo} onChange={e => setEditForm(f => ({ ...f, correo: e.target.value }))} className="h-10 rounded-xl" placeholder="tu@correo.com" />
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
                  <SelectTrigger className="w-[100px] h-8 border-none bg-muted/50 font-bold text-xs"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="w-[110px] h-8 border-none bg-muted/50 font-bold text-xs"><SelectValue /></SelectTrigger>
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
            <Button onClick={handleSaveProfile} disabled={!editForm.nombre || !editForm.correo} className="bg-cyclon-lavender text-white font-bold rounded-xl px-6">
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
              <Input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nueva contraseña</Label>
              <Input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Confirmar nueva contraseña</Label>
              <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className="h-10 rounded-xl" />
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
              onClick={() => { setChangePwOpen(false); setPwForm({ current: "", next: "", confirm: "" }) }}
            >
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
