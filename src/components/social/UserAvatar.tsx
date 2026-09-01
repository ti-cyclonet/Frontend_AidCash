"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

function initials(nombre: string) {
  return nombre.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

interface UserAvatarProps {
  nombre: string
  avatarUrl?: string | null
  className?: string
  fallbackClassName?: string
}

/**
 * Tarjeta de presentación reutilizable: foto real del usuario si la subió
 * (`avatarUrl`, base64 desde el backend), si no, iniciales — igual que hoy.
 * Usarla en cualquier lugar donde se muestre a OTRO usuario (conexiones,
 * leaderboard, jardines vecinos, resultado de búsqueda).
 */
export function UserAvatar({ nombre, avatarUrl, className, fallbackClassName }: UserAvatarProps) {
  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={nombre} />}
      <AvatarFallback className={cn("text-xs font-bold", fallbackClassName)}>
        {initials(nombre)}
      </AvatarFallback>
    </Avatar>
  )
}
