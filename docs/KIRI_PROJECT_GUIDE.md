# Kiri Finance — Guía Completa del Proyecto

> **Archivo de referencia vivo.** Actualizar cada vez que se añada o modifique una feature.
> Última actualización: 15 Julio 2026

---

## 1. ¿Qué es Kiri Finance?

Kiri Finance es una **PWA (Progressive Web App)** de finanzas personales con enfoque en educación financiera y hábitos saludables. El nombre "Kiri" evoca crecimiento — el jardín del usuario florece a medida que mejoran sus finanzas.

La app combina:
- Seguimiento de ingresos, deudas y gastos en tiempo real
- Distribución inteligente del presupuesto con un algoritmo propio
- Gamificación (rachas, insignias, jardín virtual)
- Asistente de IA para coaching financiero
- Ecosistema social: bolsillos compartidos y préstamos P2P con Socket.io

---

## 2. Stack Tecnológico

### Frontend (`/CyclonApp`)
| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15.5.9 | Framework React con App Router |
| React | 19.2 | UI |
| TypeScript | 5 | Tipado estático |
| Tailwind CSS | 3.4 | Estilos |
| shadcn/ui + Radix | — | Componentes accesibles |
| Framer Motion | 11.15 | Animaciones |
| Recharts | 2.15 | Gráficos |
| socket.io-client | 4.8.1 | Tiempo real |
| Genkit + Google GenAI | 1.28 | IA / coaching |
| next-pwa | 5.6 | Service Worker / PWA |

### Backend (`/backend_kiri`)
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


---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│  Browser / PWA (Next.js 15)                                 │
│  ┌───────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │  AuthProvider │  │  AppProvider     │  │SocketProvider│ │
│  │  (JWT tokens) │  │  (perfil,income) │  │(socket.io)  │  │
│  └───────────────┘  └──────────────────┘  └─────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTP REST  /  WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│  Express API (puerto 4000)                                   │
│  /api/auth  /api/users  /api/debts  /api/fixed-expenses      │
│  /api/savings  /api/extra-incomes  /api/impulse-expenses     │
│  /api/emergency-fund  /api/gamification  /api/reports        │
│  /api/ai  /api/connections  /api/shared-pockets  /api/loans  │
│                   Socket.io (salas por userId)               │
└───────────────────────────┬─────────────────────────────────┘
                            │  Prisma ORM
┌───────────────────────────▼─────────────────────────────────┐
│  PostgreSQL                                                  │
│  users · debts · fixed_expenses · savings_history            │
│  extra_incomes · impulse_expenses · emergency_fund_history   │
│  user_badges · refresh_tokens                                │
│  connections · shared_pockets · shared_deposits              │
│  loans · loan_payments                                       │
└─────────────────────────────────────────────────────────────┘
```

### Autenticación
- **Access Token** (JWT, corta duración) almacenado en `localStorage`.
- **Refresh Token** (larga duración) almacenado en base de datos y `localStorage`.
- Auto-refresh transparente: si el API devuelve `TOKEN_EXPIRED`, el cliente renueva y reintenta automáticamente.
- El `SocketProvider` usa el Access Token para autenticar la conexión WebSocket.

---

## 4. Menú de Navegación

La navegación tiene dos vistas:
- **Mobile** → barra inferior fija (`BottomNav`) con 5 ítems.
- **Desktop** → sidebar colapsable izquierdo (`Sidebar`) con 6 ítems y perfil de usuario.

| Ícono | Label | Ruta | Descripción |
|---|---|---|---|
| 🏠 | Inicio | `/dashboard` | Resumen financiero con gráfico donut y distribución |
| 📈 | Gestión | `/gestion` | Configurar ingresos, extras y ver distribución en detalle |
| 🏛️ | Obligaciones | `/obligaciones` | Deudas, gastos fijos y gastos hormiga |
| 📖 | Balance | `/balance` | Reportes históricos con filtros y exportación |
| 👥 | Social | `/social` | Conexiones, bolsillos compartidos y préstamos P2P |
| 🐷 | Ahorro | `/ahorro` | Bolsillos de ahorro y fondo de emergencia *(solo sidebar desktop)* |

El ícono de **Social** muestra un badge numérico rojo cuando hay notificaciones no leídas.


---

## 5. Páginas y Funcionalidades

### 5.1 Inicio (`/dashboard`)

El hub principal del usuario. Muestra de un vistazo:

- **Gráfico donut** con la distribución porcentual del ingreso (Obligaciones / Ahorro / Gasto Libre / Gastos Hormiga).
- **Barras de progreso** por cada bloque presupuestario con montos y porcentajes.
- **Panel de Recomendaciones IA** (`RecommendationsPanel`) — alertas contextuales generadas por el motor `analyzeFinances()`.
- **Cards de acceso rápido** a Obligaciones Pendientes y Ahorro Acumulado con su progreso.
- **Botón CTA** "Registrar Ingreso" → navega a `/gestion`.
- **Onboarding CTA** visible solo si el usuario no completó el wizard inicial.
- **Botones de exportación** del reporte mensual (PDF / Excel).

---

### 5.2 Gestión (`/gestion`)

Centro de control del presupuesto. Permite:

- **Configurar ingreso base** y frecuencia (mensual / quincenal).
- **Ingresos Extra** — añadir, editar y eliminar ingresos adicionales con temporalidad:
  - `una_vez` — aparece solo una vez.
  - `definido` — dura N meses.
  - `indefinido` — recurrente sin fecha de fin.
- **Saldo Real (cashBalance)** — el usuario registra cuánto dinero tiene realmente en mano; la app lo compara con el presupuesto teórico.
- **Distribución Inteligente en tiempo real** — recalcula automáticamente los 4 bloques al cambiar cualquier valor.
- **Botón "¿Por qué esta distribución?"** — llama al endpoint de IA `/api/ai/budget-insight` para generar una explicación en lenguaje natural.
- **Simulador de Endeudamiento** — calcula si el usuario puede asumir una deuda nueva y en cuánto tiempo la pagaría.
- **Estrategias de deuda** — compara Bola de Nieve vs Avalancha para las deudas activas.

---

### 5.3 Obligaciones (`/obligaciones`)

Gestión de los tres tipos de compromisos financieros:

**Tab Gastos Fijos**
- Listar, crear, editar y eliminar gastos fijos recurrentes (renta, servicios, suscripciones).
- Marcar como pagado en el periodo actual.

**Tab Deudas**
- Listar, crear, editar y eliminar deudas con cuota periódica y fecha de vencimiento.
- Marcar como pagada en el periodo actual.
- Ver el simulador de deuda integrado.
- Ver las estrategias de liquidación (Bola de Nieve / Avalancha) cuando hay ≥ 2 deudas activas.

**Tab Gastos Hormiga**
- Registrar gastos pequeños e impulsivos por categoría: café, comida, transporte, antojo, salida, otro.
- Ver el acumulado del periodo y el límite de gasto libre del presupuesto.
- El exceso se muestra en rojo y activa alertas en el dashboard.

---

### 5.4 Balance (`/balance`)

Reportes financieros históricos con 4 filtros de tiempo: Semana / Mes / Año / Todo.

Incluye:
- **Resumen ejecutivo** — ingreso total, egresos totales, desglose por categoría.
- **Gráfico de torta** de distribución de gastos.
- **Gráfico de barras** de ingresos vs egresos por mes.
- **Historial detallado** con 5 sub-tabs: Gastos Hormiga / Ahorro / Ingresos Extra / Deudas / Gastos Fijos.
- **Exportación** a PDF o Excel del reporte completo.

---

### 5.5 Ahorro (`/ahorro`) — solo sidebar desktop + ruta directa

Dos sub-secciones:

**Tab Bolsillos de Ahorro**
- Bolsillos virtuales locales (almacenados en `localStorage`) con nombre, meta, color e ícono personalizados.
- Añadir y retirar montos de cada bolsillo.
- Visualización de progreso hacia la meta.
- Iconos disponibles: Ahorro, Viaje, Casa, Educación, Vehículo, Salud, Meta, General.

**Tab Fondo de Emergencia**
- Fondo persistido en backend (tabla `emergency_fund_history`).
- Análisis automático: meta mínima = 3× gastos fijos, meta ideal = 6× gastos fijos.
- Estimación de meses para alcanzar cada meta según el ahorro periódico.
- Registrar aportes y retiros.

---

### 5.6 Social (`/social`)

Hub de finanzas compartidas. Requiere conexión de Socket.io activa. Tiene 3 tabs:

**Tab Conexiones**
- Invitar usuarios por correo electrónico.
- Ver invitaciones recibidas → Aceptar / Rechazar.
- Ver invitaciones enviadas pendientes.
- Ver y eliminar conexiones aceptadas.
- Actualización en tiempo real (Socket.io emite `notification:new_invite`, `notification:invite_accepted`, `notification:invite_rejected`).

**Tab Bolsillos Compartidos**
- Crear un bolsillo de ahorro conjunto con un usuario conectado (requiere estado `ACCEPTED`).
- Depositar en el bolsillo — el compañero recibe notificación en tiempo real.
- Ver historial de los últimos 10 depósitos por bolsillo.
- **Calculadora proporcional** — divide un gasto según los ingresos de ambos usuarios (ej: A gana 70% del total combinado → paga 70% del gasto).

**Tab Préstamos P2P**
- Solicitar un préstamo a un usuario conectado.
- El prestamista recibe notificación y puede Aprobar / Rechazar.
- El prestatario registra abonos (quedan en `PENDING_CONFIRMATION`).
- El prestamista confirma o rechaza cada abono.
- Al confirmar, se descuenta del `remainingAmount`; cuando llega a 0, el préstamo pasa a `PAID`.
- Progreso visual de cada préstamo.

**Panel de Notificaciones** (ícono 🔔 en el header de Social)
- Acumula todas las notificaciones en tiempo real de la sesión (máx 50).
- Muestra ícono, descripción y tiempo relativo por notificación.
- Marcar todas como leídas / limpiar todo.
- Indicador verde/gris del estado de conexión WebSocket.


---

## 6. Distribución Inteligente del Presupuesto

Este es el corazón algorítmico de Kiri. El código vive en `src/lib/budget-logic.ts`.

### 6.1 El Embudo de 4 Bloques

```
INGRESO TOTAL
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  BLOQUE 1 — Obligaciones          (monto real)          │
│  Deudas (cuota/periodo) + Gastos Fijos                  │
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
│  BLOQUE 3a — Gasto Libre Blindado (mínimo 15% del       │
│  ingreso total) — comida, transporte, día a día         │
└─────────────────────────────────────────────────────────┘
    │  Capacidad = Libre − Gasto Libre Blindado
    ▼
┌─────────────────────────────────────────────────────────┐
│  BLOQUE 3b — Capacidad de Endeudamiento (remanente)     │
│  Margen real para asumir deudas nuevas o metas extra    │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Reglas del Ahorro (Bloque 2)

| Remanente disponible | % Ahorro asignado | Estado |
|---|---|---|
| ≥ 40% del ingreso | **20%** | Holgado |
| 25% – 39% | **15%** | Ajustado |
| 15% – 24% | **10%** | Presionado |
| < 15% | **5%** | Crítico suave |
| 0% (isOverloaded) | **0%** | Crítico — deudas superan ingreso |

### 6.3 Estados del Presupuesto

| Estado | Condición | Indicadores en UI |
|---|---|---|
| **Normal** | Obligaciones ≤ 60% del ingreso | Barra verde, alerta positiva |
| **Ajustado (isTight)** | Obligaciones 60% – 99% | Barra amarilla, alerta de advertencia |
| **Crítico (isOverloaded)** | Obligaciones ≥ 100% del ingreso | Barra roja, alerta crítica, sugerencia de pausar ahorro |

### 6.4 Periodicidad: Mensual vs Quincenal

Archivo: `src/lib/period-filter.ts`

- **Mensual**: ingreso completo + todas las obligaciones del mes.
- **Quincenal**: `ingreso / 2` + solo las obligaciones cuyo día de corte/vencimiento cae en la quincena actual (días 1-15 = Q1, días 16-31 = Q2).

El cambio de frecuencia afecta tanto la distribución del presupuesto como el cálculo de rachas.

### 6.5 Ingresos Extra

Los ingresos extra se suman al ingreso base antes de calcular la distribución:

```
Ingreso Efectivo = Ingreso Base + Σ(Ingresos Extra del periodo)
```

Los de tipo `una_vez` se descuentan automáticamente de la lista al siguiente periodo. Los de tipo `definido` decrementan `mesesRestantes` cada periodo.


---

## 7. Motor de Recomendaciones (`src/lib/recommendations.ts`)

`analyzeFinances(allocation, debts, frecuencia)` devuelve:

### 7.1 Alertas Automáticas

| ID | Nivel | Condición |
|---|---|---|
| `all_good` | info | Presupuesto equilibrado, capacidad positiva |
| `no_debt_capacity` | warning | Capacidad de endeudamiento ≤ 0 sin estar sobrecargado |
| `tight_budget` | warning | Obligaciones entre 60% y 99% |
| `overloaded` | critical | Obligaciones ≥ 100% del ingreso |

### 7.2 Estrategias de Liquidación de Deudas

Se calculan automáticamente cuando hay **≥ 2 deudas activas con cuota > 0**:

**Bola de Nieve**
- Ordena deudas de menor a mayor saldo total.
- Paga mínimos en todas; destina el "extra" (cuotas liberadas) a la deuda de menor saldo.
- Genera victorias psicológicas rápidas.

**Avalancha**
- Ordena deudas de mayor a menor saldo total.
- Misma mecánica de "extra", pero apunta a la deuda más grande.
- Matemáticamente óptimo: reduce el monto total más rápido.

Ambas simulaciones incluyen: periodos totales hasta quedar libre, meses equivalentes, fecha estimada de libertad financiera y monto total pagado.

### 7.3 Simulador de Endeudamiento

Calcula si el usuario puede asumir una deuda nueva en 3 escenarios:

| Opción | % de Capacidad usado | Descripción |
|---|---|---|
| Conservadora | 25% | Guarda margen para otras compras |
| Moderada | 50% | Equilibrio (recomendada) |
| Total | 100% | Paga más rápido, sin margen extra |

Devuelve: cuota estimada, meses para liquidar, capacidad restante.

### 7.4 Análisis del Fondo de Emergencia

| Meta | Cálculo |
|---|---|
| Mínima | 3 × suma de gastos fijos mensuales |
| Ideal | 6 × suma de gastos fijos mensuales |

Estima los meses necesarios para alcanzar cada meta según el aporte periódico del usuario.

---

## 8. Gamificación

### 8.1 Rachas (Streaks)

- Cada periodo en que el usuario **ahorra** (registra un `SavingsHistory` con `tipo: "ahorro"`) incrementa `streakActual`.
- Si un periodo no hay ahorro, la racha se reinicia a 0.
- `streakMejor` guarda el récord histórico.
- La frecuencia (mensual/quincenal) determina la unidad mostrada.

### 8.2 Jardín Virtual (`/jardin` + `Kiri Garden`)

El árbol crece según el nivel de salud financiera:

| Nivel | Condición | Visual |
|---|---|---|
| 1 — Brote | Sin ingreso configurado | Semilla / tierra |
| 2 — Pequeño | Ingreso configurado, sin ahorro | Árbol pequeño |
| 3 — Mediano | Tiene ahorro acumulado | Árbol mediano |
| 4 — Grande | Tiene ahorro Y sin deudas activas | Árbol grande |

Factores negativos que afectan el jardín:
- Gastos Hormiga > Gasto Libre Blindado → jardín descuidado.
- % de obligaciones alto → deuda visible.

### 8.3 Insignias (Badges)

Almacenadas en `user_badges`. Se desbloquean programáticamente desde el frontend llamando a `POST /api/gamification/badges`.

---

## 9. Asistente de IA (Kiri Coach)

El botón flotante `CoachFab` está disponible en todas las páginas del dashboard.

### Endpoints de IA (`/api/ai`)
| Endpoint | Función |
|---|---|
| `POST /ai/coach` | Chat financiero contextual — recibe datos del presupuesto y responde con consejos personalizados |
| `POST /ai/budget-insight` | Explica en lenguaje natural por qué Kiri asignó esa distribución |
| `POST /ai/scan-receipt` | Escanea una imagen de ticket/factura y extrae ítems, total y categoría |

El coach también soporta **entrada por voz** (Web Speech API) y tiene un **simulador integrado** que permite probar escenarios financieros hipotéticos en la misma conversación.


---

## 10. Ecosistema Social y Tiempo Real (Fase 3)

### 10.1 Sistema de Invitaciones

Las conexiones siguen un ciclo estricto de estados:

```
[Sin conexión]
      │  POST /connections/invite
      ▼
  PENDING  ──── POST /connections/accept ──→  ACCEPTED
      │
      └── POST /connections/reject ──→  REJECTED
```

- Solo usuarios con estado `ACCEPTED` pueden crear bolsillos compartidos o préstamos entre sí.
- Cada usuario puede eliminar una conexión en cualquier momento.
- Restricción: no se puede tener más de una conexión entre el mismo par de usuarios.

### 10.2 Eventos Socket.io

Todos los eventos usan salas privadas por `userId` (`socket.join(userId)`).

| Evento | Dirección | Trigger |
|---|---|---|
| `notification:new_invite` | → addressee | Al enviar invitación |
| `notification:invite_accepted` | → requester | Al aceptar invitación |
| `notification:invite_rejected` | → requester | Al rechazar invitación |
| `social:shared_deposit` | → partner | Al crear bolsillo o depositar |
| `loan:requested` | → lender | Al solicitar préstamo |
| `loan:approved` | → borrower | Al aprobar préstamo |
| `loan:rejected` | → borrower | Al rechazar préstamo |
| `loan:payment_submitted` | → lender | Al registrar abono |
| `loan:payment_confirmed` | → borrower | Al confirmar abono |
| `loan:payment_rejected` | → borrower | Al rechazar abono |

### 10.3 Calculadora de División Proporcional

```
Porcentaje A = ingresoA / (ingresoA + ingresoB) × 100
Monto A = gastoTotal × pctA / 100
Monto B = gastoTotal − monto A
```

Si ambos ingresos son 0, divide en partes iguales (50/50).

### 10.4 Flujo Completo de un Préstamo P2P

```
Borrower solicita (amount, dueDate?)
        │  → Notifica a Lender [loan:requested]
        ▼
Lender aprueba / rechaza
  ├─ REJECTED → fin
  └─ ACTIVE → Notifica a Borrower [loan:approved]
        │
        ▼
Borrower registra abono (monto ≤ remainingAmount)
        │  → LoanPayment: PENDING_CONFIRMATION
        │  → Notifica a Lender [loan:payment_submitted]
        ▼
Lender confirma / rechaza abono
  ├─ REJECTED → LoanPayment: REJECTED
  └─ CONFIRMED:
       remainingAmount -= monto
       si remainingAmount = 0 → Loan: PAID
       → Notifica a Borrower [loan:payment_confirmed]
```

---

## 11. API REST — Resumen de Endpoints

### Auth (`/api/auth`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/register` | Crear cuenta |
| POST | `/login` | Iniciar sesión → JWT |
| POST | `/refresh` | Renovar access token |
| POST | `/logout` | Revocar refresh token |
| GET | `/me` | Datos del usuario autenticado |

### Usuarios (`/api/users`)
| Método | Ruta | Descripción |
|---|---|---|
| PATCH | `/profile` | Actualizar nombre, ingreso, frecuencia, etc. |
| PATCH | `/balance` | Actualizar saldo real (cashBalance) |
| GET | `/dashboard-summary` | Todos los datos para el dashboard en una sola llamada |

### Finanzas Personales
| Prefijo | Entidad | Operaciones |
|---|---|---|
| `/api/debts` | Deudas | CRUD + marcar pagado |
| `/api/fixed-expenses` | Gastos Fijos | CRUD + marcar pagado |
| `/api/savings` | Historial Ahorro | Listar + crear entrada |
| `/api/extra-incomes` | Ingresos Extra | CRUD |
| `/api/impulse-expenses` | Gastos Hormiga | Listar + crear + eliminar |
| `/api/emergency-fund` | Fondo Emergencia | Get + aporte/retiro |
| `/api/gamification` | Gamificación | Status + streak + badges |
| `/api/reports` | Reportes | Balance por timeframe |
| `/api/ai` | IA | coach + budget-insight + scan-receipt |

### Social
| Prefijo | Entidad | Operaciones clave |
|---|---|---|
| `/api/connections` | Conexiones | invite / accept / reject / delete |
| `/api/shared-pockets` | Bolsillos compartidos | CRUD + deposit + split-calculator |
| `/api/loans` | Préstamos P2P | request / approve / reject / payment / confirm / reject payment |


---

## 12. Base de Datos — Modelo de Datos

### Tablas Núcleo
```
users
  id · nombre · correo · password_hash
  ingreso_base · frecuencia_ingreso · onboarding_done
  meta_ahorro_global · saldo_ahorro_total
  fondo_emergencia_actual · cash_balance
  streak_actual · streak_mejor · streak_ultimo_check

refresh_tokens
  id · user_id · token · expires_at
```

### Finanzas Personales
```
debts              → cuota_periodo, estado (activa|saldada)
fixed_expenses     → pagado_este_periodo
savings_history    → tipo (ahorro|sin_ahorro), periodo
extra_incomes      → temporalidad (una_vez|definido|indefinido), meses_restantes
impulse_expenses   → categoria, periodo
emergency_fund_history → tipo (aporte|retiro)
user_badges        → badge_id, unlocked_at
```

### Fase 3 — Social
```
connections        → status (PENDING|ACCEPTED|REJECTED)
                     requester_id ─► users
                     addressee_id ─► users

shared_pockets     → balance, meta
                     user_a_id ─► users
                     user_b_id ─► users

shared_deposits    → shared_pocket_id, user_id, monto

loans              → status (PENDING_APPROVAL|ACTIVE|REJECTED|PAID)
                     lender_id ─► users
                     borrower_id ─► users
                     amount, remaining_amount, due_date

loan_payments      → status (PENDING_CONFIRMATION|CONFIRMED|REJECTED)
                     loan_id ─► loans
                     user_id ─► users (borrower)
```

---

## 13. Estructura de Carpetas del Frontend

```
src/
├── ai/                    # Genkit flows (coaching, receipt scanner)
│   └── flows/
├── app/
│   ├── (auth)/            # Login, registro — sin sidebar
│   ├── (dashboard)/       # Páginas con navegación
│   │   ├── dashboard/     # /dashboard — Inicio
│   │   ├── gestion/       # /gestion — Gestión
│   │   ├── obligaciones/  # /obligaciones — Obligaciones
│   │   ├── balance/       # /balance — Balance
│   │   ├── ahorro/        # /ahorro — Ahorro
│   │   ├── social/        # /social — Social (Fase 3)
│   │   ├── jardin/        # /jardin — Jardín virtual
│   │   └── perfil/        # /perfil — Perfil de usuario
│   ├── api/               # Next.js Route Handlers (voice-extract, etc.)
│   └── onboarding/        # Wizard inicial
├── components/
│   ├── balance/           # ExportButtons (PDF/Excel)
│   ├── gestion/           # RegisterPaymentModal, CurrentBudgetDisplay
│   ├── navigation/        # BottomNav, Sidebar, CoachFab
│   ├── recommendations/   # RecommendationsPanel, DebtStrategyPanel, EmergencyFund
│   ├── social/            # ConnectionsTab, SharedPocketsTab, LoansTab, NotificationsPanel
│   └── ui/                # shadcn/ui + componentes custom
├── hooks/
│   ├── use-finance-data.ts  # Hook central de datos financieros
│   ├── use-streaks.ts       # Rachas y badges
│   └── use-toast.ts
└── lib/
    ├── api-client.ts        # Cliente HTTP centralizado (todos los endpoints)
    ├── app-context.tsx      # Contexto global: perfil, income, moneda, dark mode
    ├── auth-context.tsx     # Autenticación JWT
    ├── socket-context.tsx   # Socket.io client + notificaciones
    ├── budget-logic.ts      # Algoritmo de distribución inteligente ⭐
    ├── period-filter.ts     # Lógica mensual/quincenal
    ├── recommendations.ts   # Alertas, estrategias de deuda, simuladores
    ├── types.ts             # Tipos TypeScript del dominio
    └── utils.ts             # Helpers (cn, formatters)
```

---

## 14. Configuración de Variables de Entorno

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
GOOGLE_GENAI_API_KEY=...
```

### Backend (`.env`)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:9002
```

---

## 15. Comandos de Desarrollo

### Frontend
```bash
npm run dev          # Servidor dev en puerto 9002 (Turbopack)
npm run build        # Build de producción
npm run typecheck    # Verificar tipos TypeScript
npm run genkit:dev   # Servidor de IA (Genkit)
```

### Backend
```bash
npm run dev                  # Servidor dev con tsx watch
npm run prisma:migrate       # Aplicar nuevas migraciones
npm run prisma:studio        # Abrir Prisma Studio (GUI de BD)
npm run prisma:generate      # Regenerar cliente Prisma
npm run prisma:seed          # Sembrar datos de prueba
npm run build                # Compilar TypeScript
```

---

## 16. Historial de Fases de Desarrollo

| Fase | Contenido |
|---|---|
| **Fase 1** | Auth, onboarding, ingresos base, deudas, gastos fijos, distribución inteligente, ahorro, dashboard |
| **Fase 2** | Ingresos extra, gastos hormiga, fondo de emergencia, gamificación (rachas, jardín, badges), balance con reportes, exportación PDF/Excel, asistente IA (coach + budget insight + receipt scanner), cashBalance |
| **Fase 3** | Conexiones P2P, bolsillos compartidos, préstamos P2P, Socket.io tiempo real, notificaciones, calculadora proporcional de gastos |

---

## 17. Notas Técnicas Importantes

- **skipLibCheck: true** en `tsconfig.json` — algunas librerías externas tienen tipos incompletos.
- **React 19** — usar `as unknown as T` para castear respuestas `Record<string, unknown>[]` del API a tipos propios.
- **`socket-context.tsx`** exporta tanto `useSocket()` (contexto completo) como `useSocketEvent(event, handler)` (listener limpio por evento).
- **`calculateProportionalSplit`** está exportada desde `shared-pockets.routes.ts` por si se necesita usar en otros contextos del backend.
- Los bolsillos personales de `/ahorro` se guardan en **`localStorage`** (no en BD). Los bolsillos compartidos sí están en BD.
- El **cashBalance** es el saldo real que el usuario tiene en mano; es independiente del presupuesto calculado. Se usa para comparación en el componente `CurrentBudgetDisplay`.

---

## 18. Actualizaciones Julio 2026

### 18.1 PeriodManager y Filtrado Dinámico (`src/lib/period-filter.ts`)

- Lógica de periodos configurables basada en `diasCobro` del usuario (ej: "5,20" para quincenas que empiezan los días 5 y 20).
- Filtrado inteligente: obligaciones con frecuencia **quincenal** aparecen en ambas quincenas; las **mensuales** solo en su quincena correspondiente.
- Las obligaciones vencidas de periodos anteriores se acumulan solo si estamos en Q2 (no se muestran futuras en Q1).
- El monto de obligaciones quincenales se divide entre 2 para el periodo actual.

### 18.2 Recálculo Dinámico del Presupuesto (`src/lib/budget-logic.ts`)

- `calculateBudgetAllocation(ingresoDelPeriodo, obligacionesPendientesDelPeriodo)` — parámetros dinámicos.
- Al pagar una obligación, el % de obligaciones **baja en tiempo real** y el remanente se redistribuye.
- Hook centralizado `usePeriodBudget()` conecta PeriodManager → calculateBudgetAllocation.

### 18.3 Billetera Rediseñada (`src/components/gestion/BilleteraTab.tsx`)

- **Sueldo Real** con efecto de conteo animado (CountingAmount, 1.6s, ease in-out sine).
- **Sueldo Base** con botón editar + flecha que despliega toggle quincenal/mensual.
- **Balance Obligaciones** con flecha que despliega lista de obligaciones del periodo.
- **Bolsillos de presupuesto** (4 cards) con distribución basada en cashBalance real.
- **Modal Registrar Ingreso**: auto-sugiere sueldo base, diferencia botón Sueldo/Extra.
- **Modal Editar Sueldo Base**: muestra cómo se divide en quincenas.
- **Análisis inteligente**: mensaje contextual dinámico según estado financiero real.

### 18.4 Sistema de Alertas y Notificaciones Push

- Service Worker (`public/sw-push.js`) para notificaciones nativas del OS.
- Hook `useSmartAlerts` con alertas de proximidad de pago basadas en `diasCobro`.
- Detección de flujo: al registrar ingreso quincenal, notifica a qué quincena se asigna.
- Campana de notificaciones en sidebar desktop (panel independiente con `fixed` positioning).

### 18.5 Saldo Insuficiente — Modal de resolución

Al intentar pagar una obligación sin saldo suficiente:
- **Abono parcial**: paga con lo disponible (deshabilitado si $0).
- **Usar Ahorros**: selector de fuente (bolsillos de ahorro o fondo de emergencia).
- **Registrar nuevo ingreso**: formulario rápido para inyectar liquidez.

### 18.6 Deshacer Pago (undo-pay)

- Endpoints `POST /debts/:id/undo-pay` y `POST /fixed-expenses/:id/undo-pay`.
- Usan `prisma.$transaction` para revertir atómicamente: saldoRestante + cashBalance.
- Lee `montoPagadoEstePeriodo` para devolver el monto exacto pagado (no siempre la cuota base).
- El botón "Deshacer pago" aparece en deudas y gastos fijos pagados.

### 18.7 Campo `montoPagadoEstePeriodo` en Deudas

- Nuevo campo `monto_pagado_este_periodo` en tabla `debts`.
- Permite registrar pagos de valor diferente a la cuota base.
- El Balance y la card de deuda muestran el monto real pagado.
- Al deshacer, se devuelve exactamente lo que se pagó.

### 18.8 Acumulación de Cuota con Gracia de 5 Días

- Campo `vencido_desde` en deudas y gastos fijos.
- La cuota solo se acumula si han pasado 5+ días desde el vencimiento.
- Primera detección: marca `vencidoDesde = now` sin acumular.
- Check posterior: si `now - vencidoDesde >= 5 días` → acumula.

### 18.9 Balance Renovado (`/balance`)

- 4 tarjetas métricas: Balance neto, Ingresos totales, Egresos totales, Ahorro del período.
- Gráfica AreaChart con 3 líneas seleccionables: Balance / Ingresos / Egresos.
- Mini stats: Promedio diario, Mayor ingreso, Mayor egreso, Meta de ahorro.
- Banner motivacional con insights.
- Historial con 4 tabs: Ingresos, Obligaciones, Ahorro, Hormiga.
- Sub-filtros en Ingresos (Sueldo/Extra) y Obligaciones (Deudas/Fijos).
- Botón eliminar en cada registro del historial.
- Botón "Reiniciar historial" (borra income_records, savings_history, impulse_expenses sin tocar cashBalance).
- Meta de ahorro = suma real de metas de bolsillos de ahorro.

### 18.10 Proyecciones Financieras (`src/components/gestion/ProyeccionesTab.tsx`)

- Simulación a N meses (selector: 3, 6, 12, 24 meses).
- Compara **Ruta actual** (pago mínimo, 5% ahorro) vs **Ruta Kiri** (Bola de Nieve, 20% ahorro).
- Gráfica con líneas de Ahorro, Deuda y Patrimonio neto.
- Hitos automáticos: deuda liquidada, fondo emergencia al 50%, meta alcanzada.
- Comparación final con VS visual.
- Métricas: intereses ahorrados, meses menos deuda, mejora patrimonio, probabilidad de éxito.
- Recomendaciones de Kiri Coach personalizadas.

### 18.11 Presupuesto por Categoría (`/gestion` → tab Categorías)

- Gráfica radial interactiva con barras que emergen del centro (Framer Motion).
- Vista expandida fullscreen con swipe horizontal entre categorías.
- Auto-sugerencia de ícono basada en keywords del nombre.
- Modal crear/editar con selector de color visual.
- Historial de cumplimiento por categoría con tendencia.
- Contexto `FinanceProvider` para manejo de estado de categorías.

### 18.12 Dictado Inteligente Mejorado

- Schema de IA actualizado con categoría `ahorro` (detecta "quiero ahorrar X para Y").
- Al confirmar: ingreso → walletIncome, deudas → addDebt, fijos → addFixedExpense, ahorro → crea bolsillo en localStorage, hormiga → addImpulseExpense.
- Botón "Dictar algo más" en la confirmación para encadenar dictados.
- Evento `kiri:wallet-updated` para refrescar billetera en tiempo real.
- Prompt de IA mejorado con instrucciones claras de clasificación.

### 18.13 Onboarding — Dictado en Deudas

- Botones de "Dictar por voz" y "Escribir manualmente" movidos al paso de deudas (Step 2).
- Step 1 (ingreso) simplificado con solo input manual.

### 18.14 Recuperación de Contraseña

- Link "¿Olvidaste tu contraseña?" en la página de login.
- Modal con campo de email + envío de enlace.
- Endpoint `POST /auth/forgot-password` genera token de reset (1 hora de validez).
- Token hasheado almacenado en refresh_tokens.
- Link de reset se loguea en consola (integrar con SendGrid/Resend para producción).

### 18.15 Wallet — Retirar de Bolsillos de Ahorro

- Endpoint `POST /users/wallet/withdraw` — resta de bolsillo, suma a cashBalance.
- En `/ahorro`, "Aportar" → `walletDeduct` (resta del cashBalance).
- "Retirar" → `walletWithdraw` (suma al cashBalance).
- Cada aporte registra un `savingsHistory` entry para el balance.

### 18.16 iOS Safe Area Fix

- CSS `.safe-top { padding-top: max(0px, env(safe-area-inset-top)); }` agregado.
- `viewportFit: 'cover'` ya configurado en el layout.
- Botones del TopBar ya no quedan debajo del notch/Dynamic Island.

### 18.17 Modales Responsivas

- `DialogContent` base actualizado: `max-w-[388px]` mobile → `lg:max-w-lg` desktop.
- Padding responsivo: `p-5` mobile → `lg:p-7` desktop.
- Modales específicas pueden usar `sm:max-w-lg lg:max-w-xl` para más espacio.

### 18.18 Filtros en Obligaciones

- Botones "Todas / Pendientes / Pagadas" en tabs de Deudas y Gastos Fijos.
- Resaltado amarillo (`ring-2 ring-amber-400`) para obligaciones prioritarias del periodo actual.
- Modal de pago para Gastos Fijos (igual que Deudas, con opción de pagar otro valor).

### 18.19 Dashboard Actualizado

- Periodo actual (badge + barra progreso) arriba de la gráfica de distribución.
- Progreso de ahorro debajo del Árbol Kiri (usa datos reales de bolsillos + emergencia).
- Gráfica donut usa distribución basada en cashBalance real (no teórico).
- Obligaciones pendientes con estilo mejorado (círculos ámbar, máx 4+3 items).
- Si cashBalance = 0, muestra $0 (no fallback a ingreso teórico).

---

## 19. Endpoints Nuevos (Julio 2026)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/users/wallet/withdraw` | Retirar de bolsillo → suma a cashBalance |
| POST | `/debts/:id/undo-pay` | Deshacer pago de deuda (transacción atómica) |
| POST | `/fixed-expenses/:id/undo-pay` | Deshacer pago de gasto fijo |
| POST | `/reports/reset-history` | Borrar historial (sin tocar wallet) |
| DELETE | `/reports/income-records/:id` | Eliminar registro de ingreso |
| DELETE | `/savings/:id` | Eliminar registro de ahorro |
| POST | `/auth/forgot-password` | Generar token de reset de contraseña |



---

## 19. Presupuesto por Categorías (`/gestion > Presupuesto`)

### 19.1 Categorías personalizadas

- Almacenadas en `localStorage` (clave `kiri_budget_categories`).
- Cada categoría: nombre, presupuesto (límite mensual), color, ícono.
- Sugerencias predefinidas: Vivienda, Alimentación, Transporte, Servicios, Ocio, Salud, Familia, Educación, Ahorro, Mascotas, Compras, Deporte, Viajes.
- Auto-sugestión de ícono y color al escribir el nombre.
- Acciones: crear, editar, eliminar categorías.

### 19.2 Matching de gastos a categorías

- Cada gasto hormiga (`impulse_expenses`) se vincula a la categoría de presupuesto mediante:
  1. **Tag `[NombreCategoria]`** al inicio del nombre del gasto (asignado al registrar desde Presupuesto).
  2. **Keywords** predefinidas por categoría (ej: "restaurante", "almuerzo" → Alimentación).
  3. **Nombre de la categoría** como keyword implícita.
- Hook compartido `useBudgetCategories` permite acceder a las categorías desde cualquier componente.
- `detectBudgetCategory(description, categories)` auto-detecta la categoría al escribir la descripción.

### 19.3 Registrar gasto desde Presupuesto

- Botón "Registrar gasto" en el header del tab de Presupuesto.
- Modal con: descripción, monto, selector de categorías del presupuesto del usuario.
- Auto-detección de categoría según la descripción ingresada.
- Warning semáforo cuando el gasto excederá el presupuesto de la categoría.
- Si el gasto excede el disponible → modal de "Presupuesto insuficiente" con opciones: usar más del asignado, usar ahorro, registrar como deuda.
- Botón "Registrar" también disponible dentro de la vista detalle de cada categoría.

### 19.4 Análisis inteligente (Consejo Kiri)

- Motor de análisis en `src/lib/budget-insights.ts`.
- **Vista general**: un único banner clickeable debajo de las categorías con el consejo más relevante. Al tocarlo se abre modal con todas las recomendaciones.
- **Vista por categoría**: siempre visible un consejo específico para esa categoría (función `getCategoryInsight`).
- Colores semáforo: 🟢 verde (bueno) · 🟡 amarillo (advertencia) · 🔴 rojo (excedido).
- Tipos de insights: alertas, recomendaciones ("Si reduces X, ahorrarás Y"), celebraciones, patrones detectados.

### 19.5 Integración con Gastos Hormiga

- El modal de "Gasto hormiga" en `/obligaciones` ahora muestra las categorías del presupuesto del usuario como opciones adicionales (además de las 6 genéricas).
- Auto-detección de categoría al escribir la descripción.

---

## 20. Roles Sociales y Presupuesto de Pareja (Julio 2026)

### 20.1 Sistema de roles en conexiones

- Enum `ConnectionRole`: FRIEND | FAMILY | PARTNER.
- Selector de rol al invitar usuario (3 botones con ícono y color).
- Badge de rol visible en cada conexión aceptada.
- Restricción: solo 1 conexión PARTNER activa por usuario.
- Tabla `connections` ahora incluye campo `role`.

### 20.2 Presupuesto del hogar (`calculateHomeBudget`)

- Endpoint `GET /api/home-budget` — combina ingresos de ambos PARTNERS.
- Calcula distribución unificada: Obligaciones (ambos), Ahorro, Libre, Capacidad.
- Componente `HomeBudgetDashboard`: gráfico circular (recharts) + barra de contribución proporcional.
- Aparece automáticamente en la tab de Conexiones cuando hay un PARTNER aceptado.

### 20.3 Deudas conjuntas

- Campo `co_owner_id` en tabla `debts` (opcional).
- Permite marcar una deuda como responsabilidad compartida entre pareja/familia.

### 20.4 Bolsillos compartidos multiusuario

- Tabla `shared_pocket_members` (relación N:M) reemplaza las columnas `user_a_id`/`user_b_id`.
- Soporta múltiples miembros por bolsillo (pareja, familia, amigos).
- Cada miembro tiene un rol: `owner` | `member`.

### 20.5 Split de gastos entre amigos

- Endpoint `POST /api/expenses/split` — divide un gasto hormiga equitativamente.
- Genera un `Loan` activo por cada amigo con descripción "Split: {nombre} (N personas)".
- Los amigos reciben notificación en tiempo real.

### 20.6 Auto-confirmación de pagos entre pareja

- `POST /api/loans/payment` ahora verifica si el préstamo es entre PARTNERS.
- Si lo es, el pago se confirma automáticamente (status: CONFIRMED) sin paso de PENDING_CONFIRMATION.
- Elimina fricción en pagos internos de la pareja.

### 20.7 Leaderboard de gamificación

- Componente `GamificationLeaderboard` en la tab de Conexiones.
- Ranking de rachas (streaks) e insignias entre amigos conectados.
- No expone valores monetarios — solo hábitos financieros.

---

## 21. Notificaciones Push (Julio 2026)

### 21.1 Fase 1: Sonido + Web Notifications

- `src/lib/notifications.ts` — sistema central de notificaciones.
- Reproduce sonido sintetizado (AudioContext) en 3 tonos: default, success, warning.
- Web Notifications API: muestra notificación nativa del navegador cuando la app está en segundo plano.
- Integrado en `socket-context.tsx`: cada evento socket dispara sonido + notificación.
- Mapeo contextual de eventos a mensajes (título + body + URL + sonido).

### 21.2 Fase 2: Push Notifications (web-push)

- Backend: `src/lib/push.ts` — servicio web-push con VAPID keys.
- Modelo `PushSubscription` en base de datos (endpoint + keys p256dh/auth).
- `POST /users/push-subscription` — guarda la suscripción del navegador.
- Service Worker `public/sw-push.js` — recibe push events y muestra notificaciones nativas del OS.
- `NotificationInitializer` — componente invisible que solicita permisos y suscribe al usuario.
- Helpers predefinidos: `pushSocialInvite`, `pushLoanPayment`, `pushPaymentReminder`, `pushKiriTip`, `pushSavingsDeposit`.
- Las notificaciones llegan incluso con la app cerrada o el dispositivo bloqueado.

### 21.3 Configuración VAPID

```env
# Backend (.env)
VAPID_PUBLIC_KEY=BCUxG_0m...
VAPID_PRIVATE_KEY=bNYCKU4...
VAPID_EMAIL=mailto:admin@kiri.app

# Frontend (.env.local)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCUxG_0m...
```

Generar nuevas keys: `npx web-push generate-vapid-keys`

---

## 22. Seguridad y Aislamiento de Datos

- Todos los endpoints REST requieren JWT válido (middleware `authMiddleware`).
- Cada query filtra por `userId` del token — un usuario solo accede a sus propios datos.
- Las categorías de presupuesto están en `localStorage` (aisladas por navegador/dispositivo).
- Los endpoints de auth (login/registro) no exponen datos de otros usuarios.
- `forgot-password` no revela si un correo existe o no.
- Rate limiting en autenticación (15 intentos / 15 min) y wallet (30 ops / min).
- Helmet + CORS restrictivo en producción.
- Passwords hasheados con bcryptjs (12 rounds).


---

## 23. Actualizaciones 15 Julio 2026

### 23.1 Tagline actualizado

- El slogan de la app cambió de **"Tus finanzas, en orden"** a **"Tu dinero, tu futuro, tu control"**.
- Actualizado en: login (mobile header), registro (mobile header) y sidebar (debajo de "Kiri Finance").

### 23.2 Gastos Fijos Quincenales — División correcta del monto

**Problema resuelto:** Los gastos fijos con frecuencia "quincenal" mostraban el monto completo en el modal de pago y descontaban el total al pagar, en vez de dividir entre 2 quincenas.

**Lógica corregida:**
- Si `frecuencia === "quincenal"`, el monto por periodo = `Math.round(monto / 2)`.
- El botón "Pagar ($X)" en el modal muestra la mitad.
- `markFixedPaid()` en `use-finance-data.ts` usa `monto / 2` como default cuando no se pasa monto explícito.
- El endpoint backend `PATCH /fixed-expenses/:id/pay` aplica la misma lógica si no recibe `monto` en el body.
- El pago con tarjeta de crédito vinculada también usa el monto por periodo.
- `isFullyPaid` se calcula contra el monto TOTAL: solo se marca como completamente pagado cuando `totalPaid >= monto` (es decir, cuando se acumulan ambas quincenas pagadas).

**Flujo esperado para un gasto quincenal de $400,000:**
1. Quincena 1: Paga $200,000 → `montoPagadoEstePeriodo = 200,000` → `pagadoEstePeriodo = false`
2. Quincena 2: Paga $200,000 → `montoPagadoEstePeriodo = 400,000` → `pagadoEstePeriodo = true`

**Archivos modificados:**
- `src/app/(dashboard)/obligaciones/page.tsx` — modal de pago
- `src/hooks/use-finance-data.ts` — función `markFixedPaid`
- Backend: `src/routes/fixed-expenses.routes.ts` — endpoint `/pay`

### 23.3 Tipo de Deuda y Tarjeta Vinculada en Gastos Fijos

- Migración `20260715000001_add_tipo_deuda_tarjeta_vinculada`:
  - Campo `tipo_deuda` en tabla `debts` (libre, tarjeta_credito, prestamo, hipoteca, vehiculo, educacion).
  - Campo `tarjeta_vinculada_id` en tabla `fixed_expenses` — FK opcional a `debts`.
- Al pagar un gasto fijo con tarjeta vinculada, el monto se suma al `saldoRestante` de la tarjeta (no se descuenta del cashBalance).

### 23.4 Intereses y Negociación en Préstamos

- Migración `20260715000002_add_loan_interest_negotiation`:
  - Campos `interest_rate`, `interest_type` (simple/compuesto), `negotiation_notes` en tabla `loans`.
  - Permite registrar condiciones de interés y notas de negociación en préstamos P2P.
