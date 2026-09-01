# Plan del Proyecto: Mundo Abierto 3D (Multijugador)

## Objetivo

MVP funcional de un juego de mundo abierto 3D en el navegador, sin librerías
externas (JavaScript vanilla + WebGL). Un personaje se mueve por un escenario a
pantalla completa, la cámara lo sigue siempre por detrás, los obstáculos son
colisionables y hay salto básico. **Multijugador:** varios jugadores comparten
el mismo mundo a través de un servidor WebSocket, se ven mutuamente con su
nombre sobre la cabeza y ven cómo se mueven.

## Decisiones tomadas

- **Renderizado:** WebGL real (3D auténtico) con WebGL 1, matrices y shaders
  propios (sin gl-matrix, sin three.js).
- **Backend multijugador:** Node.js + `ws` (WebSocket), sirve los estáticos y el
  socket en el mismo puerto. Relaya estados a ~30 Hz.
- **Mundo compartido:** el servidor genera el layout (árboles + montañas) de
  forma **determinista** (PRNG mulberry32 con semilla fija) y lo envía a cada
  jugador al entrar; todos ven los mismos obstáculos.
- **Estructura:** archivos modulares (clases separadas).
- **Scripts clásicos** (no ES modules) en orden de dependencia (sirven por HTTP;
  el multijugador ya no funciona desde `file://`).
- **Despliegue:** imagen Docker en `ghcr.io/mcardenasthorlund/mundoabierto`
  (repo público) + `docker-compose.yml` para Traefik (red `traefik-proxy`,
  dominio `mundoabierto.misappsfantasticas.cloud`, puerto interno 8080).
- **Idioma de código y comentarios:** español.

## Controles

- **Flechas:** movimiento (relativo a la cámara: ↑ siempre "adelante").
- **Ratón:** dirección de mirada del personaje (sigue la posición del cursor).
- **Espacio / clic / toque en pantalla:** salto.
- **Táctil (móvil):** joystick virtual flotante en la zona inferior izquierda
  para moverse; cualquier toque fuera de esa zona hace saltar.

## Estructura de archivos

```
MundoAbierto/
├── agents.md              # Especificaciones originales del proyecto
├── plan.md                # Este documento
├── README.md              # Instrucciones de arranque local y despliegue
├── Dockerfile             # Imagen Node (node:20-alpine), sirve server + estáticos
├── docker-compose.yml     # Traefik, imagen ghcr.io, puerto 8080, red traefik-proxy
├── .dockerignore
├── index.html             # Canvas + pantalla de inicio (nombre) + HUD + overlay táctil
│                          #   + chat (botón/panel) + indicador de versión
├── css/
│   └── style.css          # Estilos responsive, overlay de inicio, HUD, joystick,
│                          #   chat, indicador de versión, #error
├── js/
│   ├── Math3D.js          # Matrices 4x4 (col-major) y vectores
│   ├── Shader.js          # Compilación de shaders GLSL y programas
│   ├── Renderer.js        # Contexto WebGL, mallas, billboards, texturas
│   │                      #   (createCircleTexture, createTextTexture)
│   ├── InputManager.js    # Teclado + ratón + táctil (joystick y salto por toque)
│   ├── Camera.js          # Cámara detrás del jugador + raycast ratón->suelo
│   ├── NetClient.js       # WebSocket: envía estado ~30 Hz + chat, callbacks (NUEVO)
│   ├── Obstacle.js        # Clase base colisionable
│   ├── Tree.js            # Árbol: tronco cilíndrico + copa cónica
│   ├── Mountain.js        # Montaña cónica + casquete de nieve
│   ├── World.js           # buildFromLayout(layout) o generación aleatoria; colisiones
│   ├── Player.js          # Movimiento, mirada, salto, sombra, nombre; getState()
│   ├── RemotePlayer.js    # Otros jugadores: billboard + nombre, interpolados (NUEVO)
│   ├── ChatUI.js          # Chat entre jugadores: ventana plegable, badge no leídos
│   │                      #   y parpadeo del botón (NUEVO)
│   ├── Game.js            # Bucle (paso fijo 1/60), resize, red, remotes, joystick
│   └── main.js            # Pantalla de inicio, conexión, arranque del juego, ChatUI
└── server/
    ├── package.json       # Dep única: ws; script start
    ├── server.js          # HTTP estático + WebSocket + sesiones + layout + chat
    └── worldLayout.js     # generateLayout(half, seed): layout determinista
```

## Lo realizado (completado)

- [x] Canvas a pantalla completa, responsive (ajusta tamaño y aspect con DPR).
- [x] Terreno: plano cuadriculado con variación de color.
- [x] Árboles y montañas colisionables sin solaparse (generación aleatoria
      como *fallback* y **layout determinista del servidor** en multijugador).
- [x] Jugador billboard circular con sombra en el suelo y etiqueta de nombre.
- [x] Movimiento con flechas relativo a la cámara; mirada sigue al cursor.
- [x] Sin ratón (táctil): el jugador mira hacia la dirección del movimiento.
- [x] Salto con gravedad (velocidad 9.5, gravedad -24, altura ~1.9u).
- [x] Colisiones círculo-círculo con empuje (resolución por eje para deslizar).
- [x] Límites del mundo (clamp del jugador).
- [x] Cámara siempre detrás del jugador según su mirada, con seguimiento suave
      (distance=28, height=12, ~23°).
- [x] Controles táctiles: joystick flotante inferior izquierda + toque para saltar.
- [x] HUD de instrucciones superpuesto.
- [x] **Multijugador (servidor Node + ws):**
      - Pantalla de inicio con nombre; el jugador aparece con su nombre encima.
      - Join/leave, broadcast de estados a ~30 Hz, layout compartido.
      - **Límite de 4 sesiones** (`MAX_PLAYERS`, env); 5ª conexión → "full".
      - Color asignado por sesión (paleta de 4 colores).
      - Heartbeat: desconexión de inactivos a los 5 s.
      - `RemotePlayer` con interpolación (suavizado del movimiento ajeno).
      - `#error` oculto salvo que haya mensaje (evita rectángulo centrado).
- [x] Despliegue: `Dockerfile`, `docker-compose.yml` (Traefik), `.dockerignore`, `README.md`.
- [x] Verificaciones: `node --check` de todos los JS y test del protocolo
      (joins, broadcast, layout idéntico, "full", leave).
- [x] **Chat entre jugadores activos (en vivo, sin historial):**
      - Botón + ventana de chat en la esquina **superior centrada** (panel justo
        debajo del botón); lista de mensajes con nombre coloreado y campo de escritura.
      - Broadcast del servidor a todos con `{type:'chat', id, name, color, text, ts}`;
        cada cliente muestra su propio mensaje por coincidencia de `id`.
      - Badge con contador de **no leídos** + parpadeo breve del botón cuando llega
        un mensaje ajeno con el chat cerrado.
      - Validación en servidor: texto recortado, máx. 200 caracteres, vacíos descartados.
      - Escribir en el chat **no mueve al personaje** (InputManager ignora el teclado
        cuando hay un `INPUT`/`TEXTAREA` con foco).
- [x] **Indicador de versión** `v0.1-alpha` en la esquina inferior derecha.

## Detalles técnicos clave (para retomar rápido)

- **Matrices:** column-major (`Float32Array(16)`). `M3D.multiply` tolera alias.
- **MVP en render:** `viewProj = proj * view` (en `Camera.update`).
  `Renderer.drawMesh` compone `mvp = viewProj * model`. `drawSprite` es un
  billboard que usa `right`/`up` de la cámara.
- **Texturas:** `createCircleTexture(size, rgb)` dibuja el círculo del jugador;
  `createTextTexture(text)` genera la etiqueta de nombre (canvas 2D -> WebGL).
- **Red (servidor):** `server/server.js` sirve estáticos desde `__dirname/..` y
  WebSocket en el mismo puerto. Mensajes:
  - C→S: `{type:'join', name}` · `{type:'state', x,y,z,facing,vy,onGround}` (~30 Hz)
    · `{type:'chat', text}`.
  - S→C: `{type:'welcome', id, color, layout, players}` · `{type:'state', id, …}`
    · `{type:'leave', id}` · `{type:'full'}` · `{type:'chat', id, name, color, text, ts}`.
  - **Cuidado:** `send()` ya hace `JSON.stringify`, así que los broadcasts deben
    pasar el **objeto**, no un string pre-serializado (evitar doble codificación).
- **Chat:** el servidor valida (`String(msg.text||'').trim().slice(0,200)`), descarta
  vacíos y hace broadcast a todos (incluye al emisor, que decide cómo mostrarlo por
  `id === net.id`). `NetClient.sendChat(text)` y callback `onChat`.
- **ChatUI:** clase de UI pura desacoplada del bucle; se instancia en `main.js`
  (`new ChatUI(net)`). `InputManager._onKeyDown/_onKeyUp` ignoran el input de juego
  cuando `document.activeElement` es un `INPUT`/`TEXTAREA` (evita mover/saltar al escribir).
- **NetClient:** envía el estado propio en `update(dt, state)` con cadencia
  interna 1/30 s. `welcome` activa el juego (crea `Game` con `layout` + `players`).
- **Mundo:** `World` se construye con `{layout}`; sin layout usa `_spawn` aleatorio
  (fallback local).
- **Colisiones:** solo XZ. `World.resolveCollisions` empuja fuera de cada obstáculo.
- **Física:** bucle de paso fijo `1/60` con acumulador en `Game._tick`.
- **Orden de `_update`:** 1) `camera.update(player, dt)`, 2) `player.update(...)`,
  3) `net.update(dt, player.getState())`, 4) `rp.update(dt)` de los remotos.
- **Facing táctil:** dirección del movimiento cuando `mouse.lastMoveTime` tiene
  más de 150 ms de antigüedad.
- **Nombre propio:** se dibuja sobre la cabeza del jugador local y de los remotos.
- **`#error`:** CSS `display:none` + `#error:not(:empty)` para que solo aparezca
  con mensaje.

## Cómo probar

### En local
```bash
cd server && npm install && npm start
```
Abrir `http://localhost:8080` en varias pestañas/ventanas: entrar con nombre,
comprobar movimiento, salto, colisiones, cámara, que los jugadores se ven
mutuamente con nombre y que una 5ª conexión recibe "servidor lleno". Probar el
chat (botón arriba centrado): enviar mensajes entre pestañas, ver el badge de no
leídos y el parpadeo con el chat cerrado, y confirmar que escribir no mueve al personaje.

### En el servidor (Docker + Traefik)
1. `docker build -t ghcr.io/mcardenasthorlund/mundoabierto:latest .`
2. `docker push ghcr.io/mcardenasthorlund/mundoabierto:latest`
3. Pegar `docker-compose.yml` en el panel (imagen pública, sin credenciales).
4. Abrir `https://mundoabierto.misappsfantasticas.cloud`.

## Posibles siguientes pasos / expansiones

- Iluminación/sombreado por normales (los colores son planos, sin luces).
- Texturas reales (suelo, tronco, copa) mediante canvas/WebGL.
- Cámara con colisión (no atravesar montañas) o rotación manual opcional.
- Obstáculos con hitbox fiel (no círculo) o colisión del salto sobre montañas.
- Migrar de polling/broadcast simple a interpolación/extrapolación o WebRTC.
- Auth/unicidad de nombres, salas múltiples, historial persistente de chat (los que
  entran después ven los mensajes previos), minimapa o mundo infinito.
- Estados del jugador (animaciones, correr), enemigos o NPCs.