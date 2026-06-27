# Kiri Finance

> PWA de finanzas personales con distribución inteligente de presupuesto, gamificación y finanzas sociales en tiempo real.

## Documentación completa

📖 **[Ver guía completa del proyecto → `docs/KIRI_PROJECT_GUIDE.md`](./docs/KIRI_PROJECT_GUIDE.md)**

La guía incluye:
- Stack tecnológico completo (frontend + backend)
- Arquitectura del sistema
- Menú de navegación y funcionalidad de cada página
- Explicación detallada del algoritmo de distribución inteligente
- Motor de recomendaciones (estrategias de deuda, simuladores)
- Ecosistema social y eventos Socket.io
- API REST completa con todos los endpoints
- Modelo de base de datos
- Estructura de carpetas
- Variables de entorno y comandos de desarrollo

## Inicio rápido

### Frontend
```bash
cd CyclonApp
npm install
npm run dev        # Puerto 9002
```

### Backend
```bash
cd backend_kiri
npm install
npm run prisma:migrate
npm run dev        # Puerto 4000
```

## Stack

**Frontend:** Next.js 15 · React 19 · TypeScript · Tailwind CSS · shadcn/ui · socket.io-client · Genkit

**Backend:** Express · Prisma · PostgreSQL · Socket.io · JWT
