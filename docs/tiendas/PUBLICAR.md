# Publicar Kiri en Google Play y App Store

Guía para pasar de la web (kiri.cyclonet.com.co) a las dos tiendas. La app nativa ya está armada con **Capacitor 8**: es un contenedor nativo que carga la versión publicada de Kiri y le suma funciones del celular. Cada despliegue web llega a los celulares sin pasar por revisión; solo hay que volver a publicar en las tiendas cuando cambie algo nativo (íconos, permisos, plugins).

## Qué quedó listo en el código

| Pieza | Dónde |
|---|---|
| Proyectos nativos Android e iOS | `android/`, `ios/` (iOS usa Swift Package Manager, sin CocoaPods) |
| Configuración (URL, pantalla de inicio, barra de estado, enlaces permitidos) | `capacitor.config.ts` |
| Pantalla sin conexión | `nativo/www/error.html` |
| Íconos y pantallas de inicio (todos los tamaños) | `nativo/assets/` → `npm run nativo:assets` |
| Puente nativo: botón atrás de Android, barra de estado, vibración del juego, enlaces externos, compras | `src/lib/nativo.ts`, `src/components/providers/NativoInit.tsx` |
| Compras dentro de la app (monedas y planes PLUS/PRO) con RevenueCat | `src/lib/nativo.ts` + backend `src/routes/pagos.routes.ts` |
| Plan comprado en la tienda (vale como un plan pago) | backend `lib/planes.ts` (`planTienda`, `planTiendaHasta`) |
| Eliminar la cuenta desde la app (lo exigen ambas tiendas) | Perfil → "Eliminar mi cuenta" · `DELETE /api/users/cuenta` |
| Probabilidades de los cofres visibles antes de comprar (lo exigen ambas tiendas) | Tienda del jardín → Cofres |
| Sin enlaces de pago externos dentro de la app (FactoNet se oculta en la app nativa) | `mi-plan/page.tsx` |
| Permisos de iOS con su explicación (cámara, fotos, micrófono, dictado) | `ios/App/App/Info.plist` |
| Enlaces de invitación que abren la app (Android) | `android/app/src/main/AndroidManifest.xml` |

Pruebas: `npx tsx scripts/e2e-pagos-tienda.test.ts` (webhook de compras) y `npx tsx scripts/e2e-economia.test.ts` (economía del jardín), en el backend.

## 1. Cuentas que necesitas

- **Google Play Console**: pago único de USD 25. Como empresa, a nombre de Cyclonet (piden D-U-N-S y verificación de identidad).
- **Apple Developer Program**: USD 99 al año. Como organización también pide D-U-N-S.
- **RevenueCat** (gratis hasta USD 2.500 de ingresos al mes): maneja los recibos de las dos tiendas y avisa al backend.
- Un **Mac con Xcode** para compilar y subir la versión de iOS (Apple no permite hacerlo desde Windows). Alternativa: un servicio de compilación en la nube (Ionic Appflow, Codemagic).
- **Android Studio** (en Windows sirve) para compilar la versión de Android.

## 2. Productos en las tiendas y en RevenueCat

Los IDs deben ser **idénticos** en App Store Connect, Play Console y RevenueCat (están en `src/lib/nativo.ts` → `PRODUCTOS`):

| ID | Tipo | Precio sugerido (COP) | Qué da |
|---|---|---|---|
| `kiri_monedas_250` | Consumible | 2.500 | 250 monedas |
| `kiri_monedas_600` | Consumible | 4.900 | 600 monedas (+20 %) |
| `kiri_monedas_1300` | Consumible | 9.900 | 1.300 monedas (+30 %) |
| `kiri_monedas_2800` | Consumible | 19.900 | 2.800 monedas (+40 %) |
| `kiri_plus_mensual` | Suscripción mensual (grupo "Kiri") | precio de KIRI PLUS | Plan PLUS + 150 monedas al mes |
| `kiri_pro_mensual` | Suscripción mensual (grupo "Kiri") | precio de KIRI PRO | Plan PRO + 400 monedas al mes |

La primera compra de monedas de cada usuario trae el **doble** (lo aplica el backend).

En RevenueCat:
1. Crea el proyecto con las dos apps (Android `co.cyclonet.kiri`, iOS `co.cyclonet.kiri`) y conecta las credenciales de cada tienda (cuenta de servicio de Google Play; App Store Connect API key).
2. Importa los 6 productos. Las suscripciones van a un *entitlement* (por ejemplo `premium`) aunque el backend no lo usa: decide el plan por el ID del producto.
3. **Webhook**: URL `https://api.cyclonet.com.co/api/kiri/pagos/revenuecat`, cabecera *Authorization* con el valor `Bearer <secreto>` (el mismo secreto de `REVENUECAT_WEBHOOK_SECRET`, mínimo 16 caracteres).
4. Copia las **claves públicas del SDK** de cada app (empiezan por `goog_` y `appl_`).

## 3. Variables de entorno

| Dónde | Variable | Valor |
|---|---|---|
| Frontend (build de producción) | `NEXT_PUBLIC_REVENUECAT_ANDROID` | clave pública `goog_...` |
| Frontend | `NEXT_PUBLIC_REVENUECAT_IOS` | clave pública `appl_...` |
| Backend | `REVENUECAT_WEBHOOK_SECRET` | secreto largo al azar (el del webhook) |
| Backend | `GEMINI_MODEL` | **quítala** o déjala en `gemini-3.5-flash-lite`. Si producción tiene `gemini-3.8-flash`, el coach vuelve a tardar 20–50 s (ese modelo vive saturado) |

Sin las claves de RevenueCat la app funciona igual: los paquetes dicen "Próximamente" y los planes "Muy pronto en la app".

## 4. Android (Google Play)

1. `npm run nativo:sync` y luego `npm run nativo:android` (abre Android Studio).
2. En `android/app/build.gradle` sube `versionCode` (entero, +1 en cada subida) y `versionName` ("1.0.0").
3. **Build → Generate Signed App Bundle** con una *upload key* nueva. Guárdala con su contraseña en un lugar seguro: sin ella no se puede actualizar la app.
4. En Play Console crea la app ("Kiri Finance", gratuita, categoría **Finanzas**) y sube el `.aab` primero a **Prueba interna**.
5. Completa: ficha de la tienda (textos abajo), clasificación de contenido, público objetivo (**18+**), declaración de **Seguridad de los datos** (abajo), "Acceso a la app" con la **cuenta de prueba** para los revisores y la sección **Eliminación de la cuenta** (URL abajo).
6. Enlaces que abren la app: publica `https://kiri.cyclonet.com.co/.well-known/assetlinks.json` con la huella SHA-256 de la llave de firma de Play (Play Console → Integridad de la app):
   ```json
   [{ "relation": ["delegate_permission/common.handle_all_urls"],
      "target": { "namespace": "android_app", "package_name": "co.cyclonet.kiri",
                  "sha256_cert_fingerprints": ["AA:BB:...:FF"] } }]
   ```

## 5. iOS (App Store), en un Mac

1. `npm install`, `npm run nativo:sync` y `npm run nativo:ios` (abre Xcode).
2. En *Signing & Capabilities*: tu equipo de Apple, bundle id `co.cyclonet.kiri`, y agrega **In-App Purchase** y **Associated Domains** (`applinks:kiri.cyclonet.com.co`).
3. En App Store Connect crea la app, los productos (sección 2) y la ficha. Sube con **Product → Archive → Distribute** y prueba primero en **TestFlight**.
4. Completa **Privacidad de la app** (abajo), la clasificación por edad (17+ por compras y contenido financiero) y las notas para la revisión (abajo).
5. Enlaces universales: publica `https://kiri.cyclonet.com.co/.well-known/apple-app-site-association` (sin extensión, `application/json`):
   ```json
   { "applinks": { "details": [{ "appIDs": ["TEAMID.co.cyclonet.kiri"], "components": [{ "/": "/invitacion/*" }] }] } }
   ```

## 6. Ficha de la tienda (textos listos)

**Nombre**: Kiri Finance · **Subtítulo (iOS, 30)**: Tu plata crece como un árbol
**Descripción corta (Play, 80)**: Controla gastos, deudas y ahorro mientras tu árbol crece contigo.

**Descripción**:
> Kiri convierte tus finanzas en un jardín vivo. Cada ahorro riega tu árbol, cada pago a tiempo despeja el cielo y cada gasto hormiga sale caminando del hormiguero para que lo veas.
>
> - Billetera y presupuesto con distribución inteligente para tu quincena o tu mes.
> - Obligaciones: deudas, tarjetas y gastos fijos con recordatorios antes de que venzan.
> - Ahorro en bolsillos con metas y fondo de emergencia.
> - Kiri Coach, tu asesor con inteligencia artificial: pregúntale cómo vas, dicta tus gastos o escanea un recibo.
> - Tu isla 3D: un árbol que crece con tus hábitos y habitantes que reaccionan a tu plata (el chanchito engorda con tu ahorro, Don Gnomo cuida tu racha y los pájaros celebran tus ingresos).
> - Retos, rachas y misiones para que ahorrar sea un juego, solo o en pareja.
>
> Tus datos son tuyos: puedes exportarlos o eliminar tu cuenta cuando quieras.

**Palabras clave (iOS, 100)**: finanzas,presupuesto,ahorro,deudas,gastos,dinero,billetera,metas,quincena,tarjeta
**Categoría**: Finanzas (secundaria: Productividad).

**Capturas** (6, en este orden): 1) el jardín 3D con habitantes, 2) Kiri Coach respondiendo, 3) Obligaciones con el próximo pago, 4) Presupuesto por categorías, 5) Ahorro con bolsillos, 6) la tienda de habitantes. Tamaños: iPhone 6,9" (1320×2868) y 6,5"; Android 1080×1920 o mayor.

## 7. Privacidad y seguridad de los datos (respuestas)

- **Datos que se recogen**: nombre, correo, información financiera que el usuario registra (ingresos, gastos, deudas, ahorros), fotos de recibos (solo al escanear; se procesan y no se guardan), voz convertida en texto (solo al dictar), identificador del dispositivo para notificaciones.
- **Uso**: funcionalidad de la app y personalización (coach). **No** se usan para publicidad ni se venden.
- **Compartidos con terceros**: Google (Gemini) procesa los mensajes del coach, los dictados y las fotos de recibos para responder; RevenueCat y la tienda procesan las compras.
- **Cifrado en tránsito**: sí (HTTPS). **El usuario puede pedir que se borren**: sí, desde la app (Perfil → Eliminar mi cuenta).
- **Política de privacidad**: `https://kiri.cyclonet.com.co/legal/datos` · **Términos**: `https://kiri.cyclonet.com.co/legal/terminos`
- **Eliminación de cuenta fuera de la app (Play)**: usa la URL de la política de datos e incluye ahí cómo pedir la eliminación por correo a soporte.

## 8. Notas para los revisores (copiar en ambas tiendas)

> Cuenta de prueba: (crea una cuenta real con datos de ejemplo y escribe aquí el correo y la contraseña).
> Kiri es una app de finanzas personales: no presta dinero ni mueve dinero real; el usuario registra sus movimientos.
> Las monedas solo sirven para personalizar el jardín 3D. Se ganan con hábitos financieros reales (ahorrar, pagar a tiempo) o se compran con compras dentro de la app. Los cofres muestran sus probabilidades antes de abrirlos o comprarlos y nunca se venden por dinero real.
> La eliminación de la cuenta está en Perfil → "Eliminar mi cuenta".
> El coach usa inteligencia artificial (Google Gemini) y siempre muestra los registros para que el usuario los confirme antes de guardar.

## 9. Lo que falta para una segunda versión

- **Notificaciones nativas** (hoy son notificaciones web y dentro de la app nativa no llegan): `@capacitor/push-notifications` + Firebase Cloud Messaging y APNs, y que el backend envíe a esos tokens.
- **Dictado en Android dentro de la app** (el WebView de Android no trae reconocimiento de voz; el botón del micrófono se oculta solo): plugin `@capacitor-community/speech-recognition`.
- **Desbloqueo con huella o Face ID** al abrir la app.
- **Versión empaquetada sin conexión** (hoy la app necesita internet; sin red muestra `error.html`).
