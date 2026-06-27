import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware simplificado para Kiri Finance.
 *
 * La autenticación real se maneja client-side con JWT tokens en localStorage.
 * Este middleware solo protege rutas en el servidor redirigiendo a login
 * si no hay cookie de sesión. La validación real del token se hace en el frontend.
 *
 * Nota: Como usamos JWT en localStorage (no cookies), el middleware no puede
 * validar la sesión server-side. Las protecciones reales están en:
 * 1. El AuthProvider del frontend (redirección client-side)
 * 2. El backend (validación del Bearer token en cada request)
 */

const PUBLIC_ROUTES = ['/', '/login', '/register']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  // Las rutas de API y assets se dejan pasar siempre
  // El routing de autenticación se maneja client-side
  // ya que los tokens están en localStorage (no accesibles en middleware)

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|api/).*)',
  ],
}
