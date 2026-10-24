# Árbol Kiri 3D: contexto completo para implementarlo en la app

Este documento es el traspaso de un prototipo hecho fuera del repositorio. El objetivo es reemplazar la parte **visual** del árbol del Jardín (hoy son PNG animados) por la escena 3D del prototipo, **sin tocar la lógica de negocio**: XP, niveles, clima financiero, minijuego, eventos y sonido siguen funcionando igual.

---

## 1. Archivos de esta carpeta

| Archivo | Qué es |
|---|---|
| `arbol-kiri-3d.html` | Prototipo completo en un solo archivo (Three.js r128 desde CDN, texturas en base64). Se abre directo en el navegador. **Es la referencia visual y de comportamiento.** |
| `partes/p1.html` … `p4b.html` | El mismo prototipo partido en las piezas con las que se construyó (base64 recortado). Más fácil de leer. |
| `texturas/*.jpg` | Texturas reales usadas, ya extraídas. Todas son de **Poly Haven, licencia CC0**: `farm_soil` (tierra), `bark_brown_02` (corteza), `cliff_side` (roca, pasada a gris). Copiarlas a `public/garden/3d/`. |

Orden de las piezas (en el HTML están concatenadas así: p1 + p2 + p3 + p3b + p4a + p4b):

| Pieza | Contenido |
|---|---|
| `p1` | HTML/CSS del panel de demo (HUD, selector de niveles, simulador de clima y gastos hormiga). **Solo es demo; en la app NO se porta.** |
| `p2` | Renderer, cámara, cielo (shader), luces, isla flotante (césped con relieve `Hgt(x,z)`, roca con musgo, labio de musgo, estanque), océano (shader), nubes lejanas, pasto instanciado, flores, rocas, sombra de contacto, nubes de clima tocables. |
| `p3` | Corteza, hojas en corazón (geometría propia + textura en canvas + viento en vertex shader), generador de ramas jerárquico, raíces, frutos (manzanas), flores del árbol, semilla de dos mitades, mariposas caricaturescas, flores sprite. |
| `p3b` | Hormiguero, hormigas de plastilina, objetos que cargan (café, hamburguesa, carro, etc.), recorrido al tronco, etiqueta del monto, raíces del borde, tréboles, brotes, cama de tierra del árbol, rama extra derecha, cascada, hormigas que pasean al tocar el hormiguero. |
| `p4a` | Estado de la demo, clima (WX), rayos, sacudir (hojas/frutos que caen), regar (mantener presionado), cámara y entrada (tap, arrastre lateral, pinch, rueda). |
| `p4b` | Crecimiento (`applyGrowth`), bucle `frame()`, intro de entrada, framing de cámara, API `window.KiriTree`. |

---

## 2. Cómo funciona hoy en la app (lo que hay que respetar)

Stack: Next.js 15.5, React 19, framer-motion 11. **`three` no está instalado.**

- `src/app/(dashboard)/jardin/page.tsx`
  - `GARDEN_LEVELS` (6 niveles, XP acumulada: 0 / 850 / 1850 / 4350 / 8350 / 14350).
  - `currentLevelIdx`, `currentLevel`, `nivelXp = progresoNivel(...)` → progreso dentro del nivel.
  - `getGardenWeather()` → `"sol" | "nubes" | "lluvia" | "tormenta"` (tormenta = obligaciones vencidas, nubes = pago próximo, lluvia = celebración de ahorro).
  - `GardenTreeVisual` (≈ línea 1106): **este es el componente visual a reemplazar**. Recibe `currentLevelIdx`, `gardenWeather`, `gardenHealth`, `showStorm`, `persistentStorm`, `soundOn`, `onToggleSound`, `cloudBadge`, `onCloudsClick`, `capaArbol` (frutos del minijuego), `extraEscena`, `onTap` (combo), `sacudida` (key que dispara sacudida fuerte), mensajes de riego/tormenta/lluvia/ingreso. Se instancia **dos veces** (mobile y desktop) con `sizeClass` distinto.
  - Escucha `GARDEN_EVENT_STORM` (gasto hormiga) y llama `dispararTormentaHormiga(nombre)`.
- `src/components/jardin/juego.tsx` → `useJardinJuego`: frutos (desde nivel 4, hasta 5 al día), combo de 5 toques que sacude y da premio, riego 1 vez al día. **El servidor decide la XP; el cliente solo anima.**
- `src/lib/garden-events.ts` → `marcarTormentaHormiga(nombre)` se dispara desde `api-client.ts` (create de impulse-expenses cuando `esHormiga`). Hoy **solo pasa el nombre, no el monto**.
- `src/lib/hormiga.ts` → palabras clave de gasto hormiga (el prototipo usa las mismas para elegir el objeto que carga la hormiga).
- `src/lib/thunder-sound.ts` → sonidos reales de la app (trueno, toque, premio, cosecha, riego). Usar estos en vez del audio sintetizado del prototipo.

### Reglas que NO se pueden romper
1. La XP la da el backend. En el prototipo, sacudir/regar/frutos llaman `gainXP(5)`: eso es **solo demo**. En la app hay que quitarlo y enrutar todo a `useJardinJuego` / `onTap` / `sumarXp` existentes.
2. Niveles, umbrales, clima y eventos se leen de la lógica actual; el 3D solo los dibuja.
3. Mantener el botón de sonido, `onCloudsClick` (abre el modal de obligaciones), mensajes y burbujas existentes.
4. Mantener i18n (`tr`) para cualquier texto nuevo.

---

## 3. Qué hace el prototipo (todo esto se debe conservar)

### Crecimiento por nivel
- Valor continuo `sView = (nivel-1) + progreso` (0–6) → `G` con `piece(sView,[1..6],[0,1.9,3.8,6.2,8.4,10])`.
- Nivel 1: semilla cerrada medio enterrada (escala ×1.45). Nivel 2: la semilla se abre en dos mitades y sale un brote **con dos ramitas** orientadas de frente a la cámara. Nivel 3: planta joven. Nivel 4: árbol con copa. Nivel 5: tronco grueso con raíces y frutos desde la parte alta. Nivel 6: flores blancas de 5 pétalos, frutos, mariposas.
- Tronco con 5 ramas principales + 1 rama extra a la derecha de la vista (equilibra la copa). Hojas pequeñas en corazón (~7.800 en nivel 6).

### Entrada (intro)
- Al cargar: la cámara arranca cerca, enfocando la semilla cerrada ~1,3 s; luego el árbol crece hasta el nivel actual (~4 s) y la cámara se aleja con él. Cualquier cambio manual de nivel corta la intro.

### Cámara
- Fija, vista lateral elevada (~60 % parte de arriba de la isla / 40 % costado). Se acerca en niveles bajos y se aleja para que quepa el árbol en nivel 6.
- **Rotación solo lateral** arrastrando con un dedo (±0,85 rad) y vuelve sola a su sitio.
- **Zoom** con rueda o pellizco (0,55–1,6) y vuelve solo tras ~1,2 s.

### Interacción
- Tocar el árbol: se sacude, caen **hojas en corazón** con la textura del árbol (y florecitas en nivel 6) y de 1 a 3 **manzanas** (desde nivel 5 alto) que rebotan. En la app: el toque debe llamar `onTap` (combo) y la sacudida fuerte llegar por `sacudida`; los frutos del minijuego deben seguir siendo los del servidor (ver §4).
- Regar (mantener presionado): aparece la regadera y caen gotas.
- Tocar nubes en clima malo → `onCloudsClick`.
- Tocar el **hormiguero**: sale una hormiga por toque (máx. 6 a la vez), da una vuelta corta cerca del hormiguero y vuelve a entrar.
- Tocar una hormiga: muestra su gasto.

### Gasto hormiga
- Por cada gasto: una hormiga sale del hormiguero, va al tronco, sube, aparece el objeto según el nombre (café, hamburguesa, carro, gaseosa, helado, domicilio, pizza, boleta) y baja cargándolo. Al entrar al hormiguero sale la etiqueta roja `-$monto` que sube y se desvanece. Varios gastos salen en fila; al final un resumen "Hoy se fueron $X en gastos hormiga".
- API del prototipo: `KiriTree.gastoHormiga({nombre, monto})` o un arreglo.

### Clima
- `sol`: cielo azul, nubes blancas lejanas. `nubes/lluvia`: cielo gris, lluvia. `tormenta`: cielo oscuro, lluvia fuerte, rayos con trueno, nubes oscuras **detrás y arriba** (no tapan el árbol). La tierra se oscurece con la lluvia.

### Escena
- Isla flotante de roca gris con musgo, base afilada con punta roma, labio de musgo, raíces asomando por el borde.
- Césped semirrealista (canvas con miles de trazos + manchas de tierra), mechones finos, tréboles, flores pastel, piedras redondeadas con musgo, estanque con **arroyo y cascada animada** que cae al océano con bruma.
- Cama de tierra del árbol **despejada** (textura `farm_soil`, sin pasto ni piedras encima).
- Océano turquesa con shader (ondas, brillo de sol, fresnel) hasta el horizonte; cielo con gradiente.
- Mariposas caricaturescas (alas que suben y bajan juntas), una vuela baja.
- Exposición ACES 0,8.

---

## 4. Integración recomendada

1. **Dependencia**: `npm i three@0.151.3` (+ `@types/three` de la misma línea). El prototipo es r128; hasta r151 los valores de color y luces se ven igual (en r152 cambia `ColorManagement` y en r155 las luces físicas: si se usa una versión más nueva, poner `THREE.ColorManagement.enabled = false`, `renderer.outputColorSpace = THREE.LinearSRGBColorSpace` y revisar intensidades de luz comparando con el prototipo). Verificar con capturas.
2. **Componente nuevo** `src/components/jardin/arbol3d/` portando el código casi literal en módulos (escena, isla, árbol, hormigas, clima, controles) con un hook imperativo en `useEffect` (no hace falta react-three-fiber). Cargarlo con `next/dynamic(..., { ssr: false })`.
3. **Puente de props** (sustituye `window.KiriTree.setState`):
   - nivel = `currentLevelIdx + 1`, progreso = `nivelXp` (0–1).
   - clima: `sol→clear`, `nubes→rain` suave (nubes sin lluvia fuerte), `lluvia→rain`, `tormenta→storm`.
   - `sacudida` (cambia) → `shake(1.6)`; cada toque → `shake(1)` + `onTap()`.
   - `soundOn` → silenciar; usar `thunder-sound.ts`.
   - Frutos: los del minijuego (`capaArbol` hoy) deben mostrarse como las manzanas 3D; cosecharlas debe llamar a la lógica de `useJardinJuego`. Las manzanas "decorativas" que caen al sacudir no deben dar XP.
   - Gasto hormiga: en `garden-events.ts` cambiar `marcarTormentaHormiga(nombre)` a `marcarTormentaHormiga(nombre, monto)` (y en `api-client.ts` línea ~635 pasar `res.data.expense.monto ?? data.monto`). En el Jardín, además de la tormenta actual, encolar `gastoHormiga({nombre, monto})`. Los pendientes que se consumen al entrar también salen como hormigas.
4. **Un solo canvas WebGL**: hoy `GardenTreeVisual` se monta dos veces (mobile/desktop). Montar el 3D una sola vez y moverlo/redimensionarlo con CSS, o montar solo el visible según breakpoint. Dos contextos WebGL duplican memoria.
5. **Tamaño**: el contenedor actual es 250/320 px; el 3D necesita más (el prototipo usa ~600×415). Proponer contenedor ancho completo de la tarjeta con relación ~4:3 y confirmar con el usuario.
6. **Rendimiento móvil**: `setPixelRatio(min(dpr, 1.75))`, sombras 1024 en móvil, pausar el bucle con `IntersectionObserver` y `visibilitychange`, respetar `prefers-reduced-motion` (ya lo lee el prototipo), `dispose()` de geometrías/texturas/renderer al desmontar. Si va lento, bajar la densidad de hojas (`makeCluster` N y conteos en `addCluster`).
7. **Texturas**: cargar desde `public/garden/3d/` con `TextureLoader` en vez de base64.
8. Mantener los PNG actuales como **fallback** si WebGL no está disponible (el prototipo ya detecta el fallo).

---

## 5. Criterios de aceptación
- Al entrar se ve la semilla y la cámara se aleja mientras el árbol crece al nivel real del usuario.
- Cada nivel 1–6 coincide con el prototipo (abrir `arbol-kiri-3d.html` y usar el selector "Así crece tu jardín" para comparar).
- Arrastrar gira solo a los lados y vuelve; pellizco/rueda hace zoom y vuelve.
- Tocar el árbol suma al combo existente y lo sacude con hojas en corazón; la sacudida del combo usa la animación fuerte.
- Registrar un gasto hormiga en otra pantalla → al volver al Jardín sale la hormiga con el objeto correcto y la etiqueta del monto al entrar.
- Tocar el hormiguero saca hormigas que pasean y regresan.
- Tormenta con nubes que no tapan el árbol; tocar nubes abre el modal de obligaciones.
- La XP solo cambia por el servidor; ningún flujo del 3D suma XP local.
- Sin errores en consola, sin fugas al navegar (desmontar libera WebGL), fluido en un móvil de gama media.
