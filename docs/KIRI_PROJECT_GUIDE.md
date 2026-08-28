# Kiri Finance — Guía Completa del Proyecto

> **Archivo de referencia vivo.** Actualizar cada vez que se añada o modifique una feature.
> Última actualización: 9 Agosto 2026

---

## 1. ¿Qué es Kiri Finance?

Kiri Finance es una **PWA (Progressive Web App)** de finanzas personales con enfoque en educación financiera y hábitos saludables. El nombre "Kiri" evoca crecimiento — el jardín del usuario florece a medida que mejoran sus finanzas.

La app combina:
- Seguimiento de ingresos, deudas y gastos en tiempo real
- Distribución inteligente del presupuesto con un algoritmo propio ("El Embudo")
- Motor de amortización bancaria con cálculo de intereses real (sistema francés)
- Gamificación (rachas, insignias, jardín virtual con sistema XP de 6 niveles)
- Asistente de IA para coaching financiero + proyecciones predictivas
- Ecosistema social: bolsillos compartidos y préstamos P2P con Socket.io
- Sistema de planes (FREE / PRO) integrado con Cyclonet Authoriza
- Notificaciones push nativas y cron jobs inteligentes
- Open Banking con Belvo (Latinoamérica)
- Modo Offline-First con IndexedDB + Background Sync
- Exportación PDF profesional con selector de meses

---

## 2. Stack Tecnológico

### Frontend (`Frontend_AidCash`)
| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15.5.9 | Framework React con App Router + Turbopack |
| React | 19.2 | UI |
| TypeScript | 5 | Tipado estático |
| Tailwind CSS | 3.4 | Estilos |
| shadcn/ui + Radix | — | Componentes accesibles |
| Framer Motion | 11.15 | Animaciones |
| Recharts | 2.15 | Gráficos (amortización, proyecciones, flujo de caja) |
| socket.io-client | 4.8.1 | Tiempo real |
| Genkit + Google GenAI | 1.28 | IA / coaching |
| @ducanh2912/next-pwa | 10.2 | Service Worker / PWA + Background Sync |
| jsPDF + jspdf-autotable | 2.5 / 3.8 | Exportación PDF |
| canvas-confetti | 1.9 | Efectos de celebración |

### Backend (`Backend_AidCash`)
| Tecnología | Versión | Uso |
|---|---|---|
| Node.js + Express | 4.21 | API REST |
| TypeScript | 5.6 | Tipado |
| Prisma ORM | 5.22 | Acceso a base de datos |
| PostgreSQL | — | Base de datos principal |
| Socket.io | 4.8.1 | WebSockets en tiempo real |
| node-cron | 4.6 | Tareas programadas |
| web-push | 3.6 | Push notifications nativas |
| bcryptjs | 2.4 | Hash de contraseñas |
| jsonwebtoken | 9.0 | JWT auth |
| zod | 3.24 | Validación de schemas |

---

## 3. Arquitectura del Ecosistema Cyclonet

Kiri Finance forma parte del ecosistema **Cyclonet**, conectado con:

### Authoriza (`Backend_Authoriza`)
- **Sistema de autenticación centralizado** para todos los productos Cyclonet
- Kiri tiene **auth dual**: valida tokens propios (Kiri JWT) Y tokens de Authoriza
- Gestión de **planes y límites**: FREE vs PRO con features granulares
- Endpoint: `GET /api/plan` → consulta a Authoriza los límites del contrato del usuario
- Variables: `AUTHORIZA_JWT_SECRET`, `AUTHORIZA_API_URL`

### Factonet (`Frontend_Factonet` / `Backend_Factonet`)
- **Sistema de facturación electrónica** de Cyclonet
- Comparte la misma infraestructura de autenticación con Authoriza
- Kiri puede recibir datos de facturación para categorizar gastos automáticamente (futuro)

### Flujo de autenticación:
```
Usuario → Login en Kiri (JWT propio)
       → O Login via Authoriza (JWT compartido Cyclonet)
       → authMiddleware valida ambos tipos de token
       → Si viene de Authoriza: extrae tenantId, rol, source
```

---

## 4. Módulos de la Aplicación

### 4.1 Dashboard (`/dashboard`)
- Layout 2 columnas (3/5 + 2/5):
  - **Izquierda:** Árbol Kiri + Distribución del presupuesto (donut)
  - **Derecha:** Obligaciones pendientes + Estrategia de deuda
- Widget de **Velocidad de Gasto** (IA proactiva) debajo
- Periodo actual con countdown al próximo cobro
- Botón flotante "Registrar Ingreso" en mobile

### 4.2 Gestión (`/gestion`)
Dos tabs: **Billetera** y **Presupuesto**

#### Billetera
- Saldo real disponible (cashBalance)
- Registro de ingresos (salario/extra) con distribución automática en 4 bolsillos
- 4 bolsillos: Ahorro, Obligaciones, Gasto libre (libre + endeudamiento), Capacidad de endeudamiento
- Motor de auto-pagos al registrar sueldo
- Registro de ingresos extra con temporalidad

#### Presupuesto ("Presupuestos y hábitos de gasto")
- Categorías de presupuesto con límites
- Donut de distribución por categoría
- Gastos registrados se vinculan a categorías por keywords + tags
- Clasificación manual de **gastos hormiga** (toggle, no automático)
- Gastos fijos vinculados a categorías (se contabilizan al pagar)
- Simulador de reducción de gastos hormiga + impacto anual + conexión con metas
- Sugerencia inteligente de Kiri al crear categoría (montos sugeridos basados en disponible)
- Insights contextuales priorizados

### 4.3 Obligaciones (`/obligaciones`)
- Tabs: Gastos Fijos | Deudas
- Botones: "Registrar gasto" (navega a presupuesto) + "Nueva deuda" / "Nuevo gasto fijo"
- Iconos automáticos por nombre (Netflix, servicios, tarjetas, etc.)
- Badge de estrategia: "🔥 Prioridad Bola de Nieve" o "⚡ Prioridad Avalancha"
- Modal explicativo al clic en el badge
- Indicador de pago automático (⚡ Auto)
- Formulario de deuda con toggle "Deuda Simple" / "Deuda Bancaria"
- Gráfico de amortización (Recharts) en modo banco
- Preview de primera cuota (interés vs capital)
- Pago con tarjeta de crédito en cuotas
- Deshacer pago (revierte correctamente: solo capital al saldo, total al cashBalance)
- Filtros: Todas / Pendientes / Pagadas
- Préstamos P2P sociales integrados

### 4.4 Balance (`/balance`)
- 4 métricas: Balance neto, Ingresos, Egresos, Ahorro del periodo
- Gráfica de evolución (Area Chart con filtros: Balance/Ingresos/Egresos)
- Resumen de deudas (total, restante, interés pagado, capital abonado)
- Comparación vs mes anterior (variación %)
- Historial reciente (últimos 5 pagos) + Detalle del último pago (desglose completo)
- Historial detallado con tabs: Ingresos, Obligaciones, Ahorro, Hormiga
- Exportación PDF con selector de meses

### 4.5 Historial (`/historial`) — NUEVO
- Todos los movimientos financieros unificados
- Filtros: Todos, Deudas, Gastos Fijos, Hormiga, Ingresos, Ahorros
- Búsqueda por nombre/acreedor/tipo
- Desglose expandible para pagos de deudas: Capital, Intereses, Saldo anterior/actual, Tasa aplicada
- Resumen rápido: total movimientos, total egresos, total ingresos

### 4.6 Árbol Kiri / Jardín (`/jardin`)
- 6 niveles de crecimiento (Semilla → Jardín Próspero)
- XP = streakActual × 250 + badges × 100
- Salud del jardín 0-100% basada en hábitos
- Efecto de brisa en árboles (transformOrigin: bottom center)
- Fondo personalizado (fondo_arbol.png)
- Barra de XP + Botón "Recompensas" (navega a /ahorro)
- Timeline visual de niveles

### 4.7 Ahorro (`/ahorro`)
- Bolsillos de ahorro personales con metas
- Fondo de emergencia con historial
- Aportes y retiros

### 4.8 Social (`/social`)
- Conexiones (Amigo/Familia/Pareja)
- Bolsillos compartidos con aprobación
- Préstamos P2P (solicitar, aprobar, confirmar, abonar)
- Presupuesto de pareja (Home Budget)

---

## 5. Motor de Amortización (Intereses)

```
Fórmula (Sistema Francés):
  interés = saldoRestante × (tasaInteresMensual / 100)
  abonoCapital = cuotaPagada - interés
  nuevoSaldo = saldoRestante - abonoCapital
```

- Al **pagar**: solo el capital reduce el saldo. El interés es costo del crédito.
- Al **deshacer**: se restaura solo el capital al saldo. Se devuelve el total al cashBalance.
- Se registra en `debt_payments`: montoPagado, abonoCapital, pagoInteres, saldoAnterior, saldoPosterior.
- Si no hay tasa: todo va a capital (préstamos informales).

---

## 6. Sistema de Periodos ("El Reloj")

- `getPeriodData()` filtra obligaciones según frecuencia (mensual/quincenal)
- Quincenal: Q1 (días 1-15), Q2 (días 16+)
- Deudas mensuales se dividen entre 2 quincenas
- Deudas vencidas de Q1 se acumulan (rollover) a Q2
- `usePeriodBudget()` recalcula en tiempo real al pagar obligaciones

---

## 7. Cron Jobs

| Cron | Hora | Función |
|------|------|---------|
| Payment Notifications | 8:00 AM | Alertas de pagos próximos |
| Motivational Tips | 10:00 AM | Tips para usuarios inactivos |
| Spending Projections | 9:00 AM | IA predictiva: velocidad de gasto |
| Belvo Sync | 6:00 AM | Sincronización bancaria automática |

---

## 8. Open Banking (Belvo)

- Servicio: `src/services/belvo.service.ts`
- Modelos: `BelvoLink`, `BelvoAccount`, `BelvoTransaction`
- Flujo: Widget Token → Connect Widget → Register Link → Sync
- Cron diario sincroniza transacciones de links recurrentes
- Variables: `BELVO_SECRET_ID`, `BELVO_SECRET_PASSWORD`, `BELVO_ENV`

---

## 9. Offline-First

- `src/lib/offline-queue.ts` — Cola en IndexedDB
- `src/lib/offline-api.ts` — Wrapper con fallback offline
- `src/hooks/use-network-status.ts` — Detecta reconexión
- `worker/index.ts` — Service Worker con Background Sync
- `OfflineSyncProvider` — Barra visual + sync de auth token al SW

---

## 10. Sistema de Planes

### Features por plan:
| Feature | FREE | PRO |
|---------|------|-----|
| budgetManagement | ✅ | ✅ |
| debtsTracking | ✅ | ✅ |
| fixedExpenses | ✅ | ✅ |
| savingsPockets | ✅ | ✅ |
| basicReports | ❌ | ✅ |
| impulseExpenses | ❌ | ✅ |
| extraIncomes | ❌ | ✅ |
| emergencyFund | ❌ | ✅ |
| gamification | ❌ | ✅ |
| aiCoach | ❌ | ✅ |
| debtStrategies | ❌ | ✅ |
| socialConnections | ❌ | ✅ |
| sharedPockets | ❌ | ✅ |
| p2pLoans | ❌ | ✅ |

- `FeatureGate` component wraps features locked by plan
- Backend: `checkLimit()` middleware valida límites de cantidad (nDeudas, nGastosFijos)
- Usuario `test@kiri.app` tiene bypass PRO completo

---

## 11. Endpoints del Backend

### Auth
- `POST /api/auth/register` — Registro
- `POST /api/auth/login` — Login
- `POST /api/auth/refresh` — Refresh token
- `GET /api/auth/me` — Perfil actual

### Usuarios / Wallet
- `PATCH /api/users/profile` — Actualizar perfil
- `POST /api/users/wallet/income` — Registrar ingreso (distribución automática)
- `POST /api/users/wallet/deduct` — Deducir de bolsillo
- `POST /api/users/wallet/withdraw` — Retirar de bolsillo
- `GET /api/users/wallet` — Estado de la billetera

### Deudas
- `GET /api/debts` — Listar deudas
- `POST /api/debts` — Crear (acepta bankEntityId, tipoDeuda)
- `POST /api/debts/:id/pay` — Pagar (amortización, acumulación de pagos parciales)
- `POST /api/debts/:id/undo-pay` — Deshacer pago (restaura capital, no intereses)
- `POST /api/debts/pay-with-card` — Pagar con tarjeta de crédito

### Gastos Fijos
- `GET /api/fixed-expenses` — Listar
- `POST /api/fixed-expenses` — Crear
- `PATCH /api/fixed-expenses/:id/pay` — Pagar (maneja tarjeta vinculada)
- `POST /api/fixed-expenses/:id/undo-pay` — Deshacer

### Presupuesto
- `GET /api/savings-pockets` — Bolsillos personales
- `POST /api/savings-pockets/bulk` — Migración masiva
- `GET /api/budget-categories` — Categorías
- `POST /api/budget-categories/bulk` — Migración masiva

### Open Banking
- `GET /api/open-banking/status` — Estado de Belvo
- `GET /api/open-banking/widget-token` — Token para Connect Widget
- `POST /api/open-banking/links` — Registrar link
- `POST /api/open-banking/links/:id/sync` — Sincronizar
- `GET /api/open-banking/transactions` — Transacciones

### Proyecciones IA
- `GET /api/projections/spending` — Velocidad de gasto + recomendación

### Reportes
- `GET /api/reports/balance?timeframe=month` — Balance con desglose

---

## 12. Base de Datos (Prisma)

### Modelos principales:
- `User` — 4 bolsillos wallet, streak, badges, relaciones
- `Debt` — tipoDeuda (PRESTAMO/TARJETA_CREDITO), bankEntityId, amortización
- `DebtPayment` — Historial de pagos con desglose interés/capital
- `FixedExpense` — tarjetaVinculadaId, pagoAutomatico
- `BankEntity` — apiProvider, providerItemId (Open Banking)
- `BelvoLink` / `BelvoAccount` / `BelvoTransaction` — Open Banking
- `SavingsPocket` — Bolsillos personales
- `BudgetCategory` — Categorías de presupuesto
- `ImpulseExpense` — Gastos (normales + hormiga marcados con 🐜)
- `SharedPocket` / `SharedDeposit` — Social
- `Loan` / `LoanPayment` — Préstamos P2P
- `Connection` — Conexiones sociales
- `PushSubscription` — Web Push

---

## 13. Variables de Entorno

```env
# Base
DATABASE_URL=postgresql://...
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:9100

# JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Cyclonet
AUTHORIZA_JWT_SECRET=wSddeEwq2e
AUTHORIZA_API_URL=http://localhost:3000

# Belvo Open Banking
BELVO_SECRET_ID=
BELVO_SECRET_PASSWORD=
BELVO_ENV=sandbox

# Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# AI
GOOGLE_GENAI_API_KEY=...
```

---

## 14. Usuario de Prueba

```
📧 Email:     test@kiri.app
🔑 Password:  Test1234!
👤 Nombre:    Carlos Mendoza
💰 Ingreso:   $4,200,000 COP (quincenal, días 15 y 30)
🏦 Deudas:    3 activas (Bancolombia, Davivienda, Nu)
📋 Fijos:     10 gastos fijos
🐛 Hormiga:   28 gastos (últimas 3 semanas)
🐷 Bolsillos: 4 metas de ahorro
📊 Categorías: 10 de presupuesto
🏆 Badges:    10 insignias (nivel 4)
🔥 Streak:    12 días / 18 mejor
🛡️  Emergencia: $2,100,000
🔓 Plan:      PRO (acceso completo)
```

Ejecutar seed: `npx tsx prisma/seed-test-user.ts`

---

## 15. Comandos

```bash
# Backend
cd Backend_AidCash
npm run dev                    # Desarrollo (tsx watch)
npx prisma migrate dev         # Nueva migración
npx prisma studio              # GUI de base de datos
npx tsx prisma/seed-test-user.ts  # Seed usuario de prueba

# Frontend
cd Frontend_AidCash
npm run dev                    # Next.js dev (puerto 9100)
npm run build                  # Build producción
```

---

## 16. Decisiones de Arquitectura

1. **Un solo tipo de gasto** — ImpulseExpense. La clasificación "hormiga" es un marcador `🐜` en el nombre, NO una tabla separada.
2. **Categorías en localStorage** — Las categorías de presupuesto se guardan localmente. El `DataSyncInitializer` las migra al backend para persistencia multi-dispositivo.
3. **Wallet como fuente de verdad** — El backend calcula la distribución en 4 bolsillos al registrar ingresos. El frontend lee `wallet.libre + wallet.endeudamiento` como disponible para gastar.
4. **Amortización real** — Los pagos de deudas con tasa de interés usan sistema francés. Solo el capital reduce el saldo.
5. **Undo-pay consistente** — Al deshacer un pago de deuda, se buscan los `debtPayments` del periodo para restaurar el capital correcto (no el monto total).
6. **Período como filtro** — `getPeriodData()` filtra obligaciones según la quincena actual. Esto alimenta tanto el dashboard como la distribución presupuestal.
