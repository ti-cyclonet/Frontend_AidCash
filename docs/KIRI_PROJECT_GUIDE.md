# Kiri Finance — Guía Completa del Proyecto

> **Archivo de referencia vivo.** Actualizar cada vez que se añada o modifique una feature.
> Última actualización: 8 Agosto 2026

---

## 1. ¿Qué es Kiri Finance?

Kiri Finance es una **PWA (Progressive Web App)** de finanzas personales con enfoque en educación financiera y hábitos saludables. El nombre "Kiri" evoca crecimiento — el jardín del usuario florece a medida que mejoran sus finanzas.

La app combina:
- Seguimiento de ingresos, deudas y gastos en tiempo real
- Distribución inteligente del presupuesto con un algoritmo propio
- Gamificación (rachas, insignias, jardín virtual con sistema XP de 6 niveles)
- Asistente de IA para coaching financiero
- Ecosistema social: bolsillos compartidos y préstamos P2P con Socket.io
- Sistema de planes (FREE / PLUS) integrado con Cyclonet Authoriza
- Notificaciones push nativas y cron jobs inteligentes

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
| Recharts | 2.15 | Gráficos |
| socket.io-client | 4.8.1 | Tiempo real |
| Genkit + Google GenAI | 1.28 | IA / coaching |
| @ducanh2912/next-pwa | 10.2 | Service Worker / PWA |
| jsPDF + jspdf-autotable | 2.5 / 3.8 | Exportación PDF |
| xlsx | 0.18 | Exportación Excel |
| canvas-confetti | 1.9 | Efectos de celebración |
| embla-carousel-react | 8.6 | Carruseles |

### Backend (`Backend_AidCash`)
| Tecnología | Versión | Uso |
|---|---|---|
| Node.js + Express | 4.21 | API REST |
| TypeScript | 5.6 | Tipado |
| Prisma ORM | 5.22 | Acceso a base de datos |
| PostgreSQL | — | Base de datos principal |
| Socket.io | 4.8.1 | WebSockets en tiempo real |
| JWT (jsonwebtoken) | 9 | Autenticación |
| bcryptjs | 2.4 | Hashing de contraseñas |
| Zod | 3.24 | Validación de schemas |
| Helmet + express-rate-limit | — | Seguridad |
| web-push | 3.6 | Push Notifications |
| node-cron | 4.6 | Tareas programadas |
| cookie-parser | 1.4 | Cookies |


---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser / PWA (Next.js 15)                                                 │
│  ┌───────────────┐  ┌──────────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  AuthProvider │  │  AppProvider     │  │SocketProvider│ │PlanProvider│  │
│  │  (JWT tokens) │  │  (perfil,income) │  │(socket.io)  │  │(features) │  │
│  └───────────────┘  └──────────────────┘  └─────────────┘  └───────────┘  │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │  HTTP REST  /  WebSocket
┌───────────────────────────▼─────────────────────────────────────────────────┐
│  Express API (puerto 4000)                                                   │
│  /api/auth  /api/users  /api/debts  /api/fixed-expenses                      │
│  /api/savings  /api/extra-incomes  /api/impulse-expenses                     │
│  /api/emergency-fund  /api/gamification  /api/reports                        │
│  /api/ai  /api/connections  /api/shared-pockets  /api/loans                  │
│  /api/home-budget  /api/expenses/split  /api/banks                           │
│  /api/plan  /api/usage-status                                                │
│                   Socket.io (salas por userId)                               │
│                   node-cron (notificaciones diarias)                         │
└───────────────────────────┬──────────────────────────────┬──────────────────┘
                            │  Prisma ORM                   │  HTTP
┌───────────────────────────▼──────────────────┐  ┌────────▼──────────────────┐
│  PostgreSQL                                   │  │  Backend Authoriza         │
│  users · debts · fixed_expenses               │  │  (Cyclonet ecosystem)      │
│  savings_history · extra_incomes              │  │  Contratos, paquetes,      │
│  impulse_expenses · emergency_fund_history    │  │  límites de uso            │
│  income_records · push_subscriptions          │  └───────────────────────────┘
│  user_badges · refresh_tokens                 │
│  bank_entities · debt_payments                │
│  connections · shared_pockets                 │
│  shared_pocket_members · shared_deposits      │
│  loans · loan_payments                        │
└───────────────────────────────────────────────┘
```

### Autenticación Dual
- **Access Token** (JWT, corta duración) almacenado en `localStorage`.
- **Refresh Token** (larga duración) almacenado en base de datos y `localStorage`.
- Auto-refresh transparente: si el API devuelve `TOKEN_EXPIRED`, el cliente renueva y reintenta automáticamente.
- **Tokens Kiri** (locales): validados con `JWT_SECRET`.
- **Tokens Authoriza** (ecosistema Cyclonet): validados con `AUTHORIZA_JWT_SECRET`. Incluyen `tenantId` y `rol`.
- El `SocketProvider` usa el Access Token para autenticar la conexión WebSocket.


---

## 4. Sistema de Planes y Límites (Cyclonet Authoriza)

### 4.1 Integración con Authoriza

Kiri se integra con el ecosistema Cyclonet a través de Backend_Authoriza para:
- Validar tokens del ecosistema (autenticación dual).
- Consultar el paquete/plan activo del tenant.
- Aplicar límites de uso por recurso (nDeudas, nGastosFijos, etc.).

### 4.2 Plan FREE vs PLUS

| Feature | FREE | PLUS |
|---|---|---|
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
| advancedReports | ❌ | ✅ |
| debtStrategies | ❌ | ✅ |
| socialConnections | ❌ | ✅ |
| sharedPockets | ❌ | ✅ |
| p2pLoans | ❌ | ✅ |

### 4.3 Middleware de Límites (`limit-enforcement.ts`)

- `checkLimit(variableName)` — Factory de middleware que valida cuota disponible.
- Variables gateadas: `nDeudas`, `nGastosFijos`, `nIngresosExtra`, `nBolsillosCompartidos`, `nPrestamos`, `nConexiones`.
- **Fail-open**: si Authoriza no está disponible, se permite la operación (loggea error).
- Si el uso supera 80%, inyecta un `_usageWarning` en el response.
- Usuarios sin `tenantId` (token Kiri standalone) → sin restricción.

### 4.4 Cache de Límites

- Cliente HTTP (`authoriza-client.ts`) con cache en memoria (TTL 5 minutos).
- Endpoint webhook `POST /usage-status/invalidate-cache/:tenantId` para que Authoriza notifique cambios.

### 4.5 Flujo de Upgrade de Plan

```
Usuario en /mi-plan → "Cambiar a KIRI PLUS"
     │  → Redirige a landing page (cyclonet.com.co/kiri-finance/#planes)
     │  → O usa POST /api/plan/upgrade con password + packageId
     ▼
Authoriza crea contrato → User.isActive = false
     │  (pendiente aprobación)
     ▼
Authoriza aprueba → POST /api/plan/activate-user (webhook)
     │  → User.isActive = true
     ▼
Usuario puede acceder con todas las features del plan
```

### 4.6 PlanContext (Frontend)

- `PlanProvider` envuelve el layout del dashboard.
- `usePlan()` hook: expone `plan`, `loading`, `hasFeature(name)`, `refreshPlan()`.
- Componente `FeatureGate` para feature gating en la UI.
- Badge del plan visible en el dashboard header (ej: "FREE" / "PLUS").


---

## 5. Menú de Navegación

La navegación tiene dos vistas:
- **Mobile** → barra inferior fija (`BottomNav`) con 5 ítems.
- **Desktop** → sidebar colapsable izquierdo (`Sidebar`) con 6 ítems, campana de notificaciones y perfil de usuario.

| Ícono | Label | Ruta | Descripción |
|---|---|---|---|
| 🌱 | Árbol Kiri | `/jardin` | Jardín virtual con sistema XP de 6 niveles |
| 📈 | Gestión | `/gestion` | Billetera, presupuesto por categorías, proyecciones |
| 🏛️ | Obligaciones | `/obligaciones` | Deudas, gastos fijos y gastos hormiga |
| 📖 | Balance | `/balance` | Reportes históricos con filtros y exportación |
| 👥 | Social | `/social` | Conexiones, bolsillos compartidos y préstamos P2P |
| 🐷 | Ahorro | `/ahorro` | Bolsillos de ahorro y fondo de emergencia *(solo sidebar desktop)* |

### Páginas adicionales (accesibles desde links/botones):
| Ruta | Descripción |
|---|---|
| `/dashboard` | Hub principal — resumen financiero |
| `/perfil` | Configuración del perfil del usuario |
| `/mi-plan` | Ver plan actual y upgrade a PLUS |
| `/guia-kiri` | Tutorial/guía de uso de la app |
| `/deudas` | Redirige a `/obligaciones` |
| `/onboarding` | Wizard inicial de configuración |

### Sidebar Desktop — Funcionalidades extra
- **Colapsable** con transición animada (280px → 68px).
- **Campana de notificaciones** con badge de conteo no leído y panel desplegable (`fixed` positioning, auto-close 5s, máx 10 notificaciones).
- **Pill de usuario** al fondo → enlaza a `/perfil`.
- **Tooltips** en estado colapsado.
- El ícono de **Social** muestra un badge numérico rojo cuando hay notificaciones no leídas.


---

## 6. Páginas y Funcionalidades

### 6.1 Dashboard (`/dashboard`)

El hub principal del usuario. Muestra de un vistazo:

- **Header** con saludo personalizado, badge del plan (FREE/PLUS), y pill de saldo total.
- **PeriodCard** — muestra el periodo actual (quincena/mes) con días restantes hasta próximo cobro.
- **Gráfico donut** con distribución porcentual basada en **cashBalance real** (Obligaciones / Ahorro / Gasto Libre / Endeudamiento).
- **Leyenda con montos** por cada bloque del presupuesto.
- **Mensaje de estado** contextual (sincronizado con motor de recomendaciones): verde/amarillo/rojo según % obligaciones.
- **Árbol Kiri** — preview del jardín con nivel actual, progreso y racha activa → enlaza a `/jardin`.
- **Obligaciones pendientes** — lista de deudas y gastos fijos del periodo actual (máx 4+3 items).
- **Estrategias de deuda** (panel lateral en desktop) — Bola de Nieve vs Avalancha con fecha de libertad financiera.
- **Sugerencia directa** cuando está sobrecargado (≥100% obligaciones).
- **Botón CTA** "Registrar Ingreso" → navega a `/gestion` (solo mobile).
- **WelcomeOnboarding** — visible solo la primera vez después del onboarding.
- **Onboarding CTA** visible solo si el usuario no completó el wizard inicial.

---

### 6.2 Jardín (`/jardin`) — Sistema XP de 6 Niveles

El jardín virtual ha sido completamente rediseñado con un sistema de progresión por XP:

**Niveles del Jardín:**
| Nivel | Nombre | XP Requerida | Imagen |
|---|---|---|---|
| 1 | Semilla | 0 | tierra.png |
| 2 | Brote | 750 | brote.png |
| 3 | Planta joven | 1500 | arbol_pequeno.png |
| 4 | Árbol en crecimiento | 3000 | arbol_mediano.png |
| 5 | Árbol floreciente | 5000 | arbol_grande.png |
| 6 | Jardín próspero | 8000 | arbol_flores.png |

**Cálculo de XP:**
- 250 XP por cada periodo con racha activa.
- 100 XP por cada insignia desbloqueada.

**Salud del Jardín (0-100%):**
- Base: +15 (siempre hay vida).
- Ingreso registrado: +15.
- Racha activa: +5 por periodo (max +20).
- Ahorro > 0: +15.
- Sin deudas: +15 (o +5 si tiene deuda pero está pagando).
- Categorías de presupuesto configuradas: +10.
- Obligaciones registradas: +10.

**Recomendaciones contextuales:** Genera consejos personalizados basados en lo que le falta al usuario (registrar ingreso, crear categorías, empezar a ahorrar, etc.).

**UI:** Imágenes personalizadas del jardín en `/public/garden/`, aura dorada en level-up, integración con Wallet API.


---

### 6.3 Gestión (`/gestion`)

Centro de control del presupuesto. Contiene múltiples tabs:

**Tab Billetera (`BilleteraTab`)**
- **Sueldo Real** con efecto de conteo animado (CountingAmount, 1.6s, ease in-out sine).
- **Sueldo Base** con botón editar + toggle quincenal/mensual.
- **Balance Obligaciones** — lista desplegable de obligaciones del periodo.
- **4 Cards de bolsillos de presupuesto** — distribución basada en cashBalance real (Ahorro, Obligaciones, Libre, Endeudamiento).
- **Modal Registrar Ingreso**: auto-sugiere sueldo base, botón Sueldo/Extra, distribuye automáticamente a los 4 wallets.
- **Modal Editar Sueldo Base**: muestra cómo se divide en quincenas.
- **Análisis inteligente**: mensaje contextual dinámico según estado financiero real.

**Tab Presupuesto por Categorías**
- Gráfica radial interactiva con barras que emergen del centro (Framer Motion).
- Vista expandida fullscreen con swipe horizontal entre categorías.
- Auto-sugerencia de ícono basada en keywords del nombre.
- Modal crear/editar con selector de color visual.
- Historial de cumplimiento por categoría con tendencia.
- Registrar gasto directamente desde el presupuesto (con detección automática de categoría).
- Consejo Kiri: banner contextual con semáforo verde/amarillo/rojo.
- Motor de análisis en `src/lib/budget-insights.ts`.
- Categorías en `localStorage` (clave `kiri_budget_categories`).

**Tab Proyecciones (`ProyeccionesTab`)**
- Simulación a N meses (selector: 3, 6, 12, 24 meses).
- Compara **Ruta actual** (pago mínimo, 5% ahorro) vs **Ruta Kiri** (Bola de Nieve, 20% ahorro).
- Gráfica con líneas de Ahorro, Deuda y Patrimonio neto.
- Hitos automáticos: deuda liquidada, fondo emergencia al 50%, meta alcanzada.
- Comparación final con VS visual + métricas: intereses ahorrados, meses menos deuda, probabilidad de éxito.
- Recomendaciones de Kiri Coach personalizadas.

**Funcionalidades heredadas:**
- Simulador de Endeudamiento.
- Estrategias de deuda (Bola de Nieve vs Avalancha).
- Botón "¿Por qué esta distribución?" → IA `/api/ai/budget-insight`.


---

### 6.4 Obligaciones (`/obligaciones`)

Gestión de los tres tipos de compromisos financieros:

**Tab Gastos Fijos**
- CRUD de gastos fijos recurrentes (renta, servicios, suscripciones).
- Frecuencias: mensual / quincenal.
- Marcar como pagado (modal con opción de pagar otro valor).
- Filtros: Todas / Pendientes / Pagadas.
- Resaltado amarillo para obligaciones prioritarias del periodo actual.
- Vinculación a tarjeta de crédito (al pagar, suma al saldo de la tarjeta).
- Deshacer pago con transacción atómica.
- **Quincenales**: monto del periodo = `monto / 2`.

**Tab Deudas**
- CRUD con campos extendidos: tipo de deuda, acreedor, tasa de interés, entidad bancaria, frecuencia de pago.
- Tipos: PRESTAMO, TARJETA_CREDITO.
- Marcar como pagada con monto variable (`montoPagadoEstePeriodo`).
- Deshacer pago.
- Simulador de deuda integrado.
- Estrategias de liquidación (Bola de Nieve / Avalancha) cuando hay ≥ 2 deudas activas.
- Vinculación a entidad bancaria colaborativa.
- Campo `co_owner_id` para deudas conjuntas (pareja/familia).

**Tab Gastos Hormiga**
- Registrar gastos por categoría: café, comida, transporte, antojo, salida, otro + categorías del presupuesto del usuario.
- Auto-detección de categoría al escribir la descripción.
- Ver acumulado del periodo y límite de gasto libre.
- Exceso en rojo + alertas en dashboard.

**Modal de Saldo Insuficiente:**
- **Abono parcial**: paga con lo disponible.
- **Usar Ahorros**: selector de fuente (bolsillos / fondo de emergencia).
- **Registrar nuevo ingreso**: formulario rápido para inyectar liquidez.

---

### 6.5 Balance (`/balance`)

Reportes financieros con 4 filtros de tiempo: Semana / Mes / Año / Todo.

- **4 tarjetas métricas**: Balance neto, Ingresos totales, Egresos totales, Ahorro del período.
- **AreaChart** con 3 líneas seleccionables: Balance / Ingresos / Egresos.
- **Mini stats**: Promedio diario, Mayor ingreso, Mayor egreso, Meta de ahorro.
- **Banner motivacional** con insights.
- **Historial con 4 tabs**: Ingresos, Obligaciones, Ahorro, Hormiga.
- Sub-filtros en Ingresos (Sueldo/Extra) y Obligaciones (Deudas/Fijos).
- Botón eliminar en cada registro del historial.
- Botón "Reiniciar historial" (borra income_records, savings_history, impulse_expenses sin tocar cashBalance).
- Meta de ahorro = suma real de metas de bolsillos de ahorro.
- **Exportación** a PDF o Excel del reporte completo.

---

### 6.6 Ahorro (`/ahorro`)

**Tab Bolsillos de Ahorro**
- Bolsillos virtuales locales (almacenados en `localStorage`) con nombre, meta, color e ícono.
- **Aportar** → resta del cashBalance (`walletDeduct`).
- **Retirar** → suma al cashBalance (`walletWithdraw` → `POST /users/wallet/withdraw`).
- Cada aporte registra un `savingsHistory` entry.
- Progreso visual hacia la meta.

**Tab Fondo de Emergencia**
- Fondo persistido en backend (tabla `emergency_fund_history`).
- Meta mínima = 3× gastos fijos, meta ideal = 6× gastos fijos.
- Estimación de meses para alcanzar cada meta.
- Registrar aportes y retiros.


---

### 6.7 Social (`/social`)

Hub de finanzas compartidas con Socket.io. Tiene 3 tabs:

**Tab Conexiones**
- Invitar usuarios por correo electrónico con **selector de rol** (FRIEND / FAMILY / PARTNER).
- Restricción: solo 1 conexión PARTNER activa por usuario.
- Ver invitaciones recibidas → Aceptar / Rechazar.
- Badge de rol visible en cada conexión.
- **Presupuesto del hogar** (HomeBudgetDashboard) — aparece automáticamente cuando hay un PARTNER aceptado.
- **Leaderboard de gamificación** — ranking de rachas e insignias entre amigos (sin exponer valores monetarios).

**Tab Bolsillos Compartidos**
- Sistema multiusuario (tabla `shared_pocket_members` N:M).
- Roles: `owner` | `member`.
- Depositar → notificación en tiempo real.
- **Calculadora proporcional** — divide gastos según ingresos.
- Historial de últimos 10 depósitos.

**Tab Préstamos P2P**
- Solicitar préstamo con tasa de interés opcional (simple/compuesto).
- Flujo: PENDING_APPROVAL → ACTIVE → abonos → PAID.
- **Auto-confirmación entre PARTNERS** (sin paso PENDING_CONFIRMATION).
- Split de gastos entre amigos → genera Loans automáticamente.

**Panel de Notificaciones** (ícono 🔔)
- Máx 50 notificaciones de sesión.
- Indicador verde/gris del estado WebSocket.

---

### 6.8 Perfil (`/perfil`)

Página completa de configuración del usuario:
- Avatar con upload (FileReader → base64).
- Editar nombre y correo.
- **Apariencia**: Dark mode toggle, selector de moneda (USD/COP/EUR/MXN), selector de idioma.
- **Seguridad**: Cambiar contraseña, timeout de inactividad.
- **Mi Plan**: badge y enlace a `/mi-plan`.
- **Guía Kiri**: enlace a `/guia-kiri`.
- Cerrar sesión.

---

### 6.9 Mi Plan (`/mi-plan`)

- Muestra plan actual (FREE / PLUS) con estado.
- Si es PLUS: lista de beneficios exclusivos con check marks.
- Si es FREE: botón "Cambiar a KIRI PLUS" → redirige a landing page de Cyclonet.
- Beneficios PLUS: Asistente IA, Reportes PDF/Excel, Bolsillos compartidos, Préstamos P2P, Estrategias de deuda, Autogestión de facturas (FactoNet).

---

### 6.10 Guía Kiri (`/guia-kiri`)

Tutorial interactivo de la app con componente `GuiaKiriContent` que explica las funcionalidades principales al usuario.


---

## 7. Distribución Inteligente del Presupuesto

### 7.1 El Embudo de 4 Bloques

```
INGRESO TOTAL (cashBalance real)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  BLOQUE 1 — Obligaciones          (monto real)          │
│  Deudas (cuota/periodo) + Gastos Fijos pendientes       │
└─────────────────────────────────────────────────────────┘
    │  Remanente = Ingreso − Obligaciones
    ▼
┌─────────────────────────────────────────────────────────┐
│  BLOQUE 2 — Ahorro                (% del ingreso total) │
│  Varía según presión financiera (5% → 20%)              │
└─────────────────────────────────────────────────────────┘
    │  Libre = Remanente − Ahorro
    ▼
┌─────────────────────────────────────────────────────────┐
│  BLOQUE 3 — Gasto Libre Blindado (mínimo 15% del        │
│  ingreso total) — comida, transporte, día a día         │
└─────────────────────────────────────────────────────────┘
    │  Capacidad = Libre − Gasto Libre Blindado
    ▼
┌─────────────────────────────────────────────────────────┐
│  BLOQUE 4 — Capacidad de Endeudamiento (remanente)      │
│  Margen real para asumir deudas nuevas o metas extra    │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Wallet System (4 bolsillos reales)

El modelo `User` ahora tiene 4 campos de wallet que representan dinero REAL distribuido:
- `walletAhorro` — dinero asignado a ahorro.
- `walletObligaciones` — dinero reservado para obligaciones.
- `walletLibre` — dinero para gasto libre.
- `walletEndeudamiento` — margen para deuda nueva.

Al registrar un ingreso (`IncomeRecord`), se distribuye automáticamente a estos 4 wallets según la lógica del presupuesto.

### 7.3 Reglas del Ahorro (Bloque 2)

| Remanente disponible | % Ahorro asignado | Estado |
|---|---|---|
| ≥ 40% del ingreso | **20%** | Holgado |
| 25% – 39% | **15%** | Ajustado |
| 15% – 24% | **10%** | Presionado |
| < 15% | **5%** | Crítico suave |
| 0% (isOverloaded) | **0%** | Crítico — deudas superan ingreso |

### 7.4 Estados del Presupuesto

| Estado | Condición | Indicadores en UI |
|---|---|---|
| **Normal** | Obligaciones ≤ 60% del ingreso | Barra verde, alerta positiva |
| **Ajustado (isTight)** | Obligaciones 60% – 99% | Barra amarilla, alerta de advertencia |
| **Crítico (isOverloaded)** | Obligaciones ≥ 100% del ingreso | Barra roja, alerta crítica |

### 7.5 Periodicidad: Mensual vs Quincenal

- **Mensual**: ingreso completo + todas las obligaciones del mes.
- **Quincenal**: `ingreso / 2` + obligaciones cuyo día de corte cae en la quincena actual.
- `diasCobro` del usuario (ej: "5,20") define los límites de cada quincena.
- Obligaciones quincenales: monto se divide entre 2 para el periodo actual.
- Obligaciones vencidas de periodos anteriores se acumulan solo si estamos en Q2.

### 7.6 Recálculo Dinámico

- `calculateBudgetAllocation(ingresoDelPeriodo, obligacionesPendientesDelPeriodo)`.
- Al pagar una obligación, el % de obligaciones **baja en tiempo real**.
- Hook centralizado `usePeriodBudget()` conecta PeriodManager → calculateBudgetAllocation.


---

## 8. Motor de Recomendaciones (`src/lib/recommendations.ts`)

`analyzeFinances(allocation, debts, frecuencia)` devuelve:

### 8.1 Alertas Automáticas

| ID | Nivel | Condición |
|---|---|---|
| `all_good` | info | Presupuesto equilibrado, capacidad positiva |
| `no_debt_capacity` | warning | Capacidad de endeudamiento ≤ 0 sin estar sobrecargado |
| `tight_budget` | warning | Obligaciones entre 60% y 99% |
| `overloaded` | critical | Obligaciones ≥ 100% del ingreso |

### 8.2 Estrategias de Liquidación de Deudas

Se calculan automáticamente cuando hay **≥ 2 deudas activas con cuota > 0**:

**Bola de Nieve** — ordena deudas de menor a mayor saldo. Victorias psicológicas rápidas.
**Avalancha** — ordena deudas de mayor a menor saldo. Matemáticamente óptimo.

Ambas simulaciones incluyen: periodos totales, meses equivalentes, fecha estimada de libertad financiera, monto total pagado, y pasos con cuota liberada por cada deuda.

### 8.3 Simulador de Endeudamiento

| Opción | % de Capacidad usado | Descripción |
|---|---|---|
| Conservadora | 25% | Guarda margen |
| Moderada | 50% | Equilibrio (recomendada) |
| Total | 100% | Paga más rápido, sin margen |

### 8.4 Presupuesto por Categorías — Insights (`budget-insights.ts`)

- **Vista general**: banner con el consejo más relevante + modal con todas las recomendaciones.
- **Vista por categoría**: `getCategoryInsight()` — consejo específico.
- Colores semáforo: 🟢 verde · 🟡 amarillo · 🔴 rojo.
- Tipos: alertas, recomendaciones ("Si reduces X, ahorrarás Y"), celebraciones, patrones detectados.

---

## 9. Gamificación

### 9.1 Rachas (Streaks)

- Cada periodo con ahorro incrementa `streakActual`.
- Sin ahorro → racha se reinicia a 0.
- `streakMejor` guarda el récord histórico.
- Frecuencia (mensual/quincenal) determina la unidad mostrada.

### 9.2 Jardín Virtual

Ver sección 6.2 — sistema XP de 6 niveles con salud dinámica.

### 9.3 Insignias (Badges)

Almacenadas en `user_badges`. Se desbloquean programáticamente desde el frontend llamando a `POST /api/gamification/badges`.

### 9.4 Leaderboard Social

- Ranking de rachas e insignias entre amigos conectados.
- No expone valores monetarios — solo hábitos financieros.


---

## 10. Asistente de IA (Kiri Coach)

El botón flotante `CoachFab` está disponible en todas las páginas del dashboard.

### Endpoints de IA (`/api/ai`)
| Endpoint | Función |
|---|---|
| `POST /ai/coach` | Chat financiero contextual — recibe datos del presupuesto y responde con consejos personalizados |
| `POST /ai/budget-insight` | Explica en lenguaje natural por qué Kiri asignó esa distribución |
| `POST /ai/scan-receipt` | Escanea una imagen de ticket/factura y extrae ítems, total y categoría |

### Dictado Inteligente

- Schema de IA con categorías: ingreso, deudas, fijos, ahorro, hormiga.
- Al confirmar: ingreso → walletIncome, deudas → addDebt, fijos → addFixedExpense, ahorro → crea bolsillo en localStorage, hormiga → addImpulseExpense.
- Botón "Dictar algo más" para encadenar dictados.
- Evento `kiri:wallet-updated` para refrescar billetera en tiempo real.
- Soporta **entrada por voz** (Web Speech API).
- **Simulador integrado** para escenarios financieros hipotéticos en la conversación.

---

## 11. Ecosistema Social y Tiempo Real

### 11.1 Sistema de Conexiones con Roles

```
[Sin conexión]
      │  POST /connections/invite (+ role: FRIEND|FAMILY|PARTNER)
      ▼
  PENDING  ──── POST /connections/accept ──→  ACCEPTED
      │
      └── POST /connections/reject ──→  REJECTED
```

- Solo ACCEPTED pueden crear bolsillos compartidos o préstamos.
- Restricción: solo 1 PARTNER activa por usuario.
- Badge de rol visible en cada conexión.

### 11.2 Eventos Socket.io

| Evento | Dirección | Trigger |
|---|---|---|
| `notification:new_invite` | → addressee | Al enviar invitación |
| `notification:invite_accepted` | → requester | Al aceptar |
| `notification:invite_rejected` | → requester | Al rechazar |
| `social:shared_deposit` | → partner | Al depositar |
| `loan:requested` | → lender | Al solicitar préstamo |
| `loan:approved` | → borrower | Al aprobar |
| `loan:rejected` | → borrower | Al rechazar |
| `loan:payment_submitted` | → lender | Al registrar abono |
| `loan:payment_confirmed` | → borrower | Al confirmar abono |
| `loan:payment_rejected` | → borrower | Al rechazar abono |
| `alert:payment_proximity` | → user | Cron diario de pagos |

### 11.3 Presupuesto del Hogar (PARTNER)

- Endpoint `GET /api/home-budget` — combina ingresos de ambos PARTNERS.
- Distribución unificada: Obligaciones (ambos), Ahorro, Libre, Capacidad.
- Componente `HomeBudgetDashboard`: gráfico circular + barra de contribución proporcional.
- Aparece automáticamente en tab Conexiones cuando hay PARTNER aceptado.

### 11.4 Split de Gastos entre Amigos

- `POST /api/expenses/split` — divide un gasto equitativamente.
- Genera un `Loan` activo por cada amigo: "Split: {nombre} (N personas)".
- Notificación en tiempo real a cada participante.

### 11.5 Auto-confirmación entre Pareja

- Pagos de préstamos entre PARTNERS se confirman automáticamente (sin PENDING_CONFIRMATION).


---

## 12. Notificaciones Push y Cron Jobs

### 12.1 Sonido + Web Notifications

- `src/lib/notifications.ts` — sistema central.
- Reproduce sonido sintetizado (AudioContext) en 3 tonos: default, success, warning.
- Web Notifications API: notificación nativa cuando la app está en segundo plano.
- Mapeo contextual de eventos a mensajes (título + body + URL + sonido).

### 12.2 Push Notifications (web-push)

- Backend: `src/lib/push.ts` con VAPID keys.
- Modelo `PushSubscription` en base de datos (endpoint + keys p256dh/auth).
- `POST /users/push-subscription` — guarda la suscripción.
- Service Worker `public/sw-push.js` — recibe push events.
- `NotificationInitializer` — componente que solicita permisos y suscribe al usuario.
- Helpers: `pushSocialInvite`, `pushLoanPayment`, `pushPaymentReminder`, `pushKiriTip`, `pushSavingsDeposit`.
- Las notificaciones llegan con la app cerrada o el dispositivo bloqueado.

### 12.3 Cron Jobs (`src/cron/payment-notifications.ts`)

Se ejecuta diariamente en zona horaria `America/Bogota`:

**8:00 AM — Notificaciones de proximidad de pago:**
- 2 días antes: "Ya casi te pagan. Planifica con Kiri."
- 1 día antes: "Mañana es día de pago. ¿Ya tienes tu plan listo?"
- Día de pago: "¡Día de pago! Registra tu ingreso."
- También notifica ingresos extra próximos.
- Emite vía Socket.io + Push notification.

**10:00 AM — Tips motivacionales para usuarios inactivos:**
- Busca usuarios que no han iniciado sesión en 3+ días.
- Envía tips aleatorios de ahorro/motivación vía push.
- Máx 50 usuarios por ejecución.

### 12.4 Configuración VAPID

```env
# Backend (.env)
VAPID_PUBLIC_KEY=BCUxG_0m...
VAPID_PRIVATE_KEY=bNYCKU4...
VAPID_EMAIL=mailto:admin@kiri.app

# Frontend (.env.local / .env.production)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCUxG_0m...
```

Generar nuevas keys: `npx web-push generate-vapid-keys`


---

## 13. API REST — Resumen de Endpoints

### Auth (`/api/auth`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/register` | Crear cuenta |
| POST | `/login` | Iniciar sesión → JWT |
| POST | `/refresh` | Renovar access token |
| POST | `/logout` | Revocar refresh token |
| GET | `/me` | Datos del usuario autenticado |
| POST | `/forgot-password` | Generar token de reset (1h validez) |

### Usuarios (`/api/users`)
| Método | Ruta | Descripción |
|---|---|---|
| PATCH | `/profile` | Actualizar nombre, ingreso, frecuencia, etc. |
| PATCH | `/balance` | Actualizar saldo real (cashBalance) |
| GET | `/dashboard-summary` | Datos completos para el dashboard |
| POST | `/wallet/withdraw` | Retirar de bolsillo → suma a cashBalance |
| POST | `/push-subscription` | Guardar suscripción push del navegador |
| GET | `/wallet` | Obtener estado actual del wallet (4 bolsillos) |

### Finanzas Personales
| Prefijo | Entidad | Operaciones |
|---|---|---|
| `/api/debts` | Deudas | CRUD + pay + undo-pay |
| `/api/fixed-expenses` | Gastos Fijos | CRUD + pay + undo-pay |
| `/api/savings` | Historial Ahorro | Listar + crear + eliminar |
| `/api/extra-incomes` | Ingresos Extra | CRUD |
| `/api/impulse-expenses` | Gastos Hormiga | Listar + crear + eliminar |
| `/api/emergency-fund` | Fondo Emergencia | Get + aporte/retiro |
| `/api/gamification` | Gamificación | Status + streak + badges |
| `/api/reports` | Reportes | Balance por timeframe + reset-history |
| `/api/ai` | IA | coach + budget-insight + scan-receipt |

### Social
| Prefijo | Entidad | Operaciones clave |
|---|---|---|
| `/api/connections` | Conexiones | invite (con rol) / accept / reject / delete |
| `/api/shared-pockets` | Bolsillos compartidos | CRUD + deposit + split-calculator |
| `/api/loans` | Préstamos P2P | request / approve / reject / payment / confirm / reject payment |
| `/api/home-budget` | Presupuesto hogar | GET (combina ingresos de PARTNERS) |
| `/api/expenses/split` | Split gastos | POST (divide entre amigos) |

### Plan y Límites
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/plan` | Plan actual del usuario (features + limits) |
| GET | `/api/plan/available` | Planes disponibles para upgrade |
| POST | `/api/plan/upgrade` | Cambiar de plan (requiere password) |
| POST | `/api/plan/upgrade-from-landing` | Upgrade desde landing page |
| POST | `/api/plan/activate-user` | Webhook de Authoriza para reactivar usuario |
| GET | `/api/usage-status` | Estado completo de uso vs. límites |
| GET | `/api/usage-status/warnings` | Variables que superan 80% de uso |
| POST | `/api/usage-status/invalidate-cache/:tenantId` | Invalidar cache de límites |

### Bancos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/banks` | Listar bancos (con búsqueda) |
| POST | `/api/banks` | Crear banco (colaborativo, no verificado) |

### Health Check
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servidor |


---

## 14. Base de Datos — Modelo de Datos (Prisma)

### Tablas Núcleo
```
users
  id · nombre · correo · password_hash
  ingreso_base · frecuencia_ingreso · dias_pago[]
  onboarding_done · is_active
  meta_ahorro_global · saldo_ahorro_total
  fondo_emergencia_actual · cash_balance
  wallet_ahorro · wallet_obligaciones · wallet_libre · wallet_endeudamiento
  streak_actual · streak_mejor · streak_ultimo_check
  created_at · updated_at

refresh_tokens
  id · user_id · token · expires_at

income_records
  id · user_id · monto · tipo (salario|extra)
  a_ahorro · a_obligaciones · a_libre · a_endeudamiento

push_subscriptions
  id · user_id · endpoint · p256dh · auth
```

### Finanzas Personales
```
debts
  id · user_id · nombre · tipo_deuda (PRESTAMO|TARJETA_CREDITO)
  monto_total · monto_inicial · saldo_restante · saldo_principal
  cuota_periodo · tasa_interes · tasa_interes_aplicada · tasa_interes_mensual
  dia_corte · acreedor · frecuencia_pago · dias_pago
  pagado_este_periodo · monto_pagado_este_periodo
  estado (activa|saldada|vencida) · prioridad (alta|media|baja)
  vencido_desde · fecha_inicio · pago_automatico
  bank_entity_id → bank_entities
  co_owner_id → users

debt_payments
  id · debt_id · monto_pagado · abono_capital · pago_interes
  saldo_anterior · saldo_posterior · periodo

bank_entities
  id · nombre (unique) · tasa_interes_promedio · es_verificado

fixed_expenses
  id · user_id · nombre · monto · categoria · fecha_corte
  frecuencia · metodo_pago · renovacion_auto
  pagado_este_periodo · monto_pagado_este_periodo
  tarjeta_vinculada_id → debts · pago_automatico

savings_history    → tipo (ahorro|sin_ahorro), periodo, monto
extra_incomes      → temporalidad (una_vez|definido|indefinido), meses_restantes, fecha_recepcion
impulse_expenses   → categoria, periodo (index [userId, periodo])
emergency_fund_history → tipo (aporte|retiro), nota
user_badges        → badge_id, unlocked_at (unique [userId, badgeId])
```

### Social
```
connections
  id · requester_id · addressee_id
  status (PENDING|ACCEPTED|REJECTED)
  role (FRIEND|FAMILY|PARTNER)
  unique [requester_id, addressee_id]

shared_pockets
  id · nombre · balance · meta

shared_pocket_members  (relación N:M)
  id · shared_pocket_id · user_id · role (owner|member)
  unique [shared_pocket_id, user_id]

shared_deposits
  id · shared_pocket_id · user_id · monto · nota

loans
  id · lender_id · borrower_id
  amount · remaining_amount · descripcion · due_date
  status (PENDING_APPROVAL|PENDING_BORROWER_CONFIRMATION|ACTIVE|REJECTED|PAID)
  tasa_interes · monto_original · source_expense_id

loan_payments
  id · loan_id · user_id (borrower) · monto · nota
  status (PENDING_CONFIRMATION|CONFIRMED|REJECTED)
```


---

## 15. Estructura de Carpetas del Frontend

```
src/
├── ai/                    # Genkit flows (coaching, receipt scanner)
│   └── flows/
├── app/
│   ├── (auth)/            # Login, registro — sin sidebar
│   ├── (dashboard)/       # Páginas con navegación
│   │   ├── dashboard/     # /dashboard — Hub principal
│   │   ├── jardin/        # /jardin — Jardín virtual (6 niveles XP)
│   │   ├── gestion/       # /gestion — Billetera, Presupuesto, Proyecciones
│   │   ├── obligaciones/  # /obligaciones — Deudas, Gastos Fijos, Hormiga
│   │   ├── balance/       # /balance — Reportes financieros
│   │   ├── ahorro/        # /ahorro — Bolsillos y Fondo de Emergencia
│   │   ├── social/        # /social — Conexiones, Bolsillos compartidos, P2P
│   │   ├── perfil/        # /perfil — Configuración del usuario
│   │   ├── mi-plan/       # /mi-plan — Plan actual y upgrade
│   │   ├── guia-kiri/     # /guia-kiri — Tutorial
│   │   └── deudas/        # /deudas — Redirige a /obligaciones
│   ├── api/               # Next.js Route Handlers (voice-extract, etc.)
│   └── onboarding/        # Wizard inicial
├── components/
│   ├── auth/              # InactivityGuard
│   ├── balance/           # ExportButtons (PDF/Excel)
│   ├── gestion/           # BilleteraTab, ProyeccionesTab, WelcomeOnboarding
│   ├── navigation/        # BottomNav, Sidebar, TopBar, CoachFab
│   ├── notifications/     # NotificationInitializer
│   ├── providers/         # SmartAlertsProvider
│   ├── recommendations/   # RecommendationsPanel, DebtStrategyPanel, EmergencyFund
│   ├── social/            # ConnectionsTab, SharedPocketsTab, LoansTab, NotificationsPanel
│   ├── tutorial/          # GuiaKiri
│   └── ui/                # shadcn/ui + componentes custom
├── hooks/
│   ├── use-finance-data.ts  # Hook central de datos financieros
│   ├── use-period-budget.ts # Hook de distribución dinámica del periodo
│   ├── use-streaks.ts       # Rachas y badges
│   └── use-toast.ts
└── lib/
    ├── api-client.ts        # Cliente HTTP centralizado (todos los endpoints + WalletState)
    ├── app-context.tsx      # Contexto global: perfil, income, moneda, dark mode
    ├── auth-context.tsx     # Autenticación JWT
    ├── plan-context.tsx     # Plan/features del usuario (PlanProvider, usePlan)
    ├── socket-context.tsx   # Socket.io client + notificaciones
    ├── notifications.ts     # Sonido + Web Notifications API
    ├── budget-logic.ts      # Algoritmo de distribución inteligente ⭐
    ├── budget-insights.ts   # Motor de insights por categoría
    ├── period-filter.ts     # Lógica mensual/quincenal + PeriodManager
    ├── recommendations.ts   # Alertas, estrategias de deuda, simuladores
    ├── types.ts             # Tipos TypeScript del dominio
    └── utils.ts             # Helpers (cn, formatters)
```

---

## 16. Estructura de Carpetas del Backend

```
src/
├── config/
│   ├── database.ts          # Conexión Prisma
│   └── env.ts               # Variables de entorno tipadas
├── cron/
│   └── payment-notifications.ts  # Cron diario (8AM + 10AM)
├── lib/
│   ├── authoriza-client.ts  # Cliente HTTP para Authoriza (cache 5min)
│   ├── push.ts              # Servicio web-push + helpers
│   └── socket.ts            # Socket.io server + emitToUser + closeSocket
├── middleware/
│   ├── auth.ts              # Autenticación dual (Kiri + Authoriza)
│   ├── error-handler.ts     # Error handler centralizado
│   ├── limit-enforcement.ts # Middleware de límites por paquete
│   └── validate.ts          # Validación Zod
├── routes/
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   ├── debts.routes.ts
│   ├── fixed-expenses.routes.ts
│   ├── savings.routes.ts
│   ├── extra-incomes.routes.ts
│   ├── impulse.routes.ts
│   ├── emergency-fund.routes.ts
│   ├── gamification.routes.ts
│   ├── ai.routes.ts
│   ├── reports.routes.ts
│   ├── connections.routes.ts
│   ├── shared-pockets.routes.ts
│   ├── loans.routes.ts
│   ├── home-budget.routes.ts
│   ├── expense-split.routes.ts
│   ├── banks.routes.ts
│   ├── usage-status.routes.ts
│   └── plan.routes.ts
├── server.ts                # Entry point + Express + HTTP server
└── prisma/
    ├── schema.prisma
    └── seed.ts
```


---

## 17. Configuración de Variables de Entorno

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
GOOGLE_GENAI_API_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCUxG_0m...
```

### Frontend (`.env.production`)
```env
NEXT_PUBLIC_API_URL=https://api.cyclonet.com.co/api/kiri
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCUxG_0m...
```

### Backend (`.env`)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=30d
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:9100
GOOGLE_GENAI_API_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:admin@kiri.app
AUTHORIZA_JWT_SECRET=...
AUTHORIZA_API_URL=http://localhost:3000
```

### URLs de Producción
- **API Kiri**: `https://api.cyclonet.com.co/api/kiri`
- **Landing page**: `https://www.cyclonet.com.co/kiri-finance`
- **CORS permitidos**: `FRONTEND_URL` (múltiples orígenes separados por coma) + `www.cyclonet.com.co` + `cyclonet.com.co`

---

## 18. Comandos de Desarrollo

### Frontend
```bash
npm run dev          # Servidor dev en puerto 9100 (Turbopack)
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run typecheck    # Verificar tipos TypeScript
npm run lint         # ESLint
npm run genkit:dev   # Servidor de IA (Genkit)
npm run generate-icons  # Generar íconos PWA
```

### Backend
```bash
npm run dev                  # Servidor dev con tsx watch (puerto 4000)
npm run build                # Compilar TypeScript
npm run start                # Ejecutar build compilado
npm run prisma:migrate       # Aplicar nuevas migraciones
npm run prisma:migrate:deploy # Deploy migraciones (producción)
npm run prisma:studio        # Abrir Prisma Studio (GUI de BD)
npm run prisma:generate      # Regenerar cliente Prisma
npm run prisma:seed          # Sembrar datos de prueba
```


---

## 19. Seguridad y Aislamiento de Datos

- Todos los endpoints REST requieren JWT válido (middleware `authMiddleware`).
- Autenticación dual: tokens Kiri (locales) y tokens Authoriza (ecosistema).
- Cada query filtra por `userId` del token — un usuario solo accede a sus propios datos.
- Las categorías de presupuesto están en `localStorage` (aisladas por navegador/dispositivo).
- `forgot-password` no revela si un correo existe o no.
- Rate limiting: autenticación (50 intentos / 15 min), general (1000 / 15 min).
- Helmet + CORS restrictivo (orígenes explícitos).
- Passwords hasheados con bcryptjs.
- Trust proxy configurado (Nginx reverse proxy en EC2).
- `InactivityGuard` — cierra sesión automáticamente por inactividad (timeout configurable).
- `isActive` flag en User — permite desactivar temporalmente durante cambio de plan.

---

## 20. Dashboard Layout y Providers

El layout del dashboard (`src/app/(dashboard)/layout.tsx`) incluye:

```tsx
<Sidebar />            // Solo desktop
<TopBar />             // Solo mobile
<main>{children}</main>
<BottomNav />          // Solo mobile
<CoachFab />           // Botón flotante IA (todas las páginas)
<InactivityGuard />    // Auto-logout por inactividad
<SmartAlertsProvider />  // Alertas de proximidad de pago
<NotificationInitializer />  // Solicita permisos push y suscribe
```

Providers que envuelven la app (desde el root layout):
- `AuthProvider` — JWT + refresh automático.
- `AppProvider` — perfil, income, moneda, dark mode, diasCobro.
- `SocketProvider` — Socket.io + notificaciones.
- `PlanProvider` — plan/features del usuario.


---

## 21. Entidades Bancarias (Colaborativas)

- Modelo `BankEntity`: nombre (unique), tasa de interés promedio mensual (%), verificado (bool).
- Los bancos verificados son agregados por administradores.
- Los usuarios pueden crear bancos nuevos (no verificados) disponibles para toda la comunidad.
- La tasa se guarda como % mensual (ej: 1.85 = 1.85% mensual ≈ 22.2% EA).
- Las deudas pueden vincularse a un banco (`bankEntityId`).
- Búsqueda case-insensitive por nombre.
- Ordenamiento: verificados primero, luego alfabético.

---

## 22. Historial de Fases de Desarrollo

| Fase | Contenido |
|---|---|
| **Fase 1** | Auth, onboarding, ingresos base, deudas, gastos fijos, distribución inteligente, ahorro, dashboard |
| **Fase 2** | Ingresos extra, gastos hormiga, fondo de emergencia, gamificación (rachas, jardín, badges), balance con reportes, exportación PDF/Excel, asistente IA (coach + budget insight + receipt scanner), cashBalance |
| **Fase 3** | Conexiones P2P, bolsillos compartidos, préstamos P2P, Socket.io tiempo real, notificaciones, calculadora proporcional de gastos |
| **Fase 4** | Roles sociales (FRIEND/FAMILY/PARTNER), presupuesto del hogar, deudas conjuntas, bolsillos multiusuario, split de gastos, auto-confirmación entre pareja, leaderboard gamificación |
| **Fase 5** | Sistema de planes (FREE/PLUS), integración Cyclonet Authoriza, límites de uso, push notifications (web-push + VAPID), cron jobs inteligentes, entidades bancarias colaborativas, wallet system (4 bolsillos), amortización de deudas |
| **Fase 6** | Jardín XP (6 niveles), presupuesto por categorías, proyecciones financieras, billetera rediseñada, página de perfil, guía interactiva, upgrade de plan, landing page integration |


---

## 23. Notas Técnicas Importantes

- **skipLibCheck: true** en `tsconfig.json` — algunas librerías externas tienen tipos incompletos.
- **React 19** — usar `as unknown as T` para castear respuestas.
- **Puerto dev frontend**: 9100 (Turbopack). Backend: 4000.
- **`socket-context.tsx`** exporta `useSocket()` (contexto completo) y `useSocketEvent(event, handler)`.
- **`PlanProvider`** y `usePlan()` gestionan features del plan activo.
- Los bolsillos personales de `/ahorro` se guardan en **`localStorage`** (no en BD). Los compartidos sí.
- El **cashBalance** es el saldo real; los **wallets** (ahorro, obligaciones, libre, endeudamiento) son su distribución.
- **IncomeRecord** guarda la distribución aplicada al registrar cada ingreso.
- **Gastos fijos quincenales**: `monto / 2` por periodo. `isFullyPaid` requiere ambas quincenas pagadas.
- **Acumulación con gracia**: vencidoDesde + 5 días antes de acumular cuota.
- **Pago con tarjeta vinculada**: suma al `saldoRestante` de la tarjeta (no descuenta del cashBalance).
- **DebtPayment** registra historial de amortización (capital + interés + saldo anterior/posterior).
- **CORS múltiple**: `FRONTEND_URL` soporta múltiples orígenes separados por coma.
- **Trust proxy**: configurado para Nginx reverse proxy en EC2.
- **Graceful shutdown**: cierra Socket.io y HTTP server con SIGTERM/SIGINT (timeout 5s).
- **El slogan de la app**: "Tu dinero, tu futuro, tu control".
- **iOS Safe Area**: `padding-top: max(0px, env(safe-area-inset-top))` + `viewportFit: 'cover'`.
- **Modales responsivas**: `max-w-[388px]` mobile → `lg:max-w-lg` desktop.

---

## 24. Actualizaciones Agosto 2026

### 24.1 Sistema de Wallet Completo

- 4 campos en `User`: `walletAhorro`, `walletObligaciones`, `walletLibre`, `walletEndeudamiento`.
- Representan dinero REAL distribuido (no solo porcentajes teóricos).
- `IncomeRecord` registra cada ingreso con su distribución exacta a los 4 wallets.
- Endpoint `GET /users/wallet` para consultar estado actual.
- Frontend usa `userApi.getWallet()` + evento `kiri:wallet-updated` para sincronizar.

### 24.2 Dashboard Basado en Saldo Real

- El dashboard ahora usa `cashBalance` (saldo real) como fuente de verdad para la distribución.
- Si cashBalance = 0 → muestra $0 (no fallback a ingreso teórico).
- PeriodCard calcula días restantes basándose en `diasCobro` del usuario.
- Badge del plan en el header (enlaza a `/mi-plan`).

### 24.3 Amortización de Deudas (DebtPayment)

- Modelo `DebtPayment` registra cada pago con desglose: monto pagado, abono a capital, pago de intereses, saldo anterior, saldo posterior, periodo.
- Permite trazar historial completo de amortización de cada deuda.
- Campos de interés en `Debt`: `tasaInteres`, `tasaInteresAplicada`, `tasaInteresMensual`.

### 24.4 Página de Perfil Dedicada

- `/perfil` reemplaza el modal de configuración como centro de gestión del usuario.
- Incluye: avatar, apariencia (dark mode, moneda, idioma), seguridad (contraseña, inactividad), links a mi-plan y guía.
- Cerrar sesión desde el perfil.

### 24.5 Integración Landing Page Cyclonet

- `NEXT_PUBLIC_LANDING_URL` para enlazar al sitio de planes.
- CORS abierto a `www.cyclonet.com.co` y `cyclonet.com.co`.
- Endpoint `POST /api/plan/upgrade-from-landing` para usuarios que inician upgrade desde la landing.
- Flujo completo: valida contraseña local → crea usuario en Authoriza si no existe → ejecuta upgrade.

### 24.6 Préstamos con Tasa de Interés

- Campos `tasaInteres` y `montoOriginal` en `Loan`.
- El prestamista puede establecer tasa de interés (simple) al aprobar.
- `montoOriginal` guarda el valor sin intereses para referencia.
- `source_expense_id` vincula préstamos generados por split de gastos.

### 24.7 Pago Automático y Categorías en Gastos Fijos

- Campo `pagoAutomatico` en deudas y gastos fijos.
- Campo `categoria` en gastos fijos (default: "otro").
- Campo `metodoPago` y `renovacionAuto` en gastos fijos.
- Permite marcar obligaciones que se debitan automáticamente.
