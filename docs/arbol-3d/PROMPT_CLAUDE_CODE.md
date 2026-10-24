Quiero reemplazar el árbol visual del Jardín (hoy PNG en `GardenTreeVisual`, dentro de `src/app/(dashboard)/jardin/page.tsx`) por una escena 3D con Three.js que ya tengo prototipada.

Lee primero `docs/arbol-3d/HANDOFF_ARBOL_3D.md`: tiene todo el contexto, qué hace el prototipo, qué lógica de la app NO se puede tocar y el plan de integración. El prototipo funcional es `docs/arbol-3d/arbol-kiri-3d.html` (ábrelo en el navegador para compararlo), las piezas legibles están en `docs/arbol-3d/partes/` y las texturas en `docs/arbol-3d/texturas/`.

Antes de programar:
1. Inspecciona `jardin/page.tsx`, `components/jardin/juego.tsx`, `lib/garden-events.ts`, `lib/garden-xp.ts`, `lib/garden-clima.ts`, `lib/hormiga.ts` y `lib/thunder-sound.ts`.
2. Propónme el plan (archivos nuevos, props del puente, tamaño del contenedor) y espera mi visto bueno.

Luego implementa por etapas, verificando que compile y que la lógica de XP, niveles, clima, minijuego y sonido siga igual. La XP la decide el servidor: el 3D solo anima.
