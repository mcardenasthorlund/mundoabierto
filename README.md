# Mundo Abierto 3D — Multijugador

Juego de mundo abierto 3D en el navegador (WebGL vanilla) con soporte
multijugador. Un servidor Node (`ws`) sirve los estáticos y retransmite la
posición de los jugadores en tiempo real.

## Requisitos

- Node.js 18+ (para correr el servidor).
- Opcionalmente Docker para desplegar la imagen.

## Probar en local

```bash
cd server
npm install
npm start
```

Abrir varias pestañas en `http://localhost:8080`, poner un nombre y entrar.
Puedes conectarte con varias pestañas para ver el movimiento de otros jugadores,
chatear entre vosotros, interactuar con los NPCs y ver el indicador de versión
(v0.2-alpha) en la esquina inferior derecha.

## Controles

- **Flechas / joystick táctil:** moverse.
- **Ratón:** dirección de mirada (giro suave de la cámara).
- **Espacio / clic / toque:** saltar.
- **NPCs:** acércate a un personaje dorado (`NPC_1`…`NPC_8`) para que aparezca una
  ventana preguntando si quieres interactuar; al aceptar, el NPC cuenta un mensaje
  "épico" aleatorio. Mientras el diálogo está abierto el jugador queda congelado.
- **Chat:** botón (icono de burbuja) en la esquina inferior derecha, encima del
  indicador de versión, abre/cierra la ventana; escribe y pulsa Enviar/Enter. Al
  llegar un mensaje con el chat cerrado aparece un badge con el número de no leídos
  y el botón parpadea brevemente. En móvil, tocar el botón abre el chat sin saltar.

## Desplegar con Docker (Traefik)

1. Publicar la imagen en GitHub Container Registry (repositorio público), si estamos en tecnología ARM, hay que descargar la imagen de node de linux/amd64 por compatibilidad y hacer el build sobre ella:

   ```bash
   docker pull --platform linux/amd64 node:20-alpine
   docker buildx build --platform linux/amd64 -t ghcr.io/mcardenasthorlund/mundoabierto:latest --push .

   docker build -t ghcr.io/mcardenasthorlund/mundoabierto:latest .
   docker push ghcr.io/mcardenasthorlund/mundoabierto:latest
   ```

2. Pegar `docker-compose.yml` en el administrador de docker (usa la red externa
   `traefik-proxy`). Acceso por `https://mundoabierto.misappsfantasticas.cloud`.

## Estructura

```
├── index.html          # Canvas + pantalla de inicio + HUD + joystick táctil
├── css/style.css       # Estilos responsive, overlay de inicio y joystick
├── js/                 # Cliente (WebGL + red)
│   ├── Math3D.js       # Matrices/vectores
│   ├── Shader.js       # Compilación de shaders
│   ├── Renderer.js     # Contexto WebGL, mallas, billboards, texturas
│   ├── InputManager.js # Teclado + ratón + táctil (ignora la UI del chat)
│   ├── Camera.js       # Cámara tras el jugador + raycast al suelo
│   ├── NetClient.js    # Conexión WebSocket (envía/recibe estados)
│   ├── Obstacle.js     # Base de obstáculo colisionable
│   ├── Tree.js         # Árbol (tronco + copa)
│   ├── Mountain.js     # Montaña cónica + nieve
│   ├── World.js        # Terreno + obstáculos + NPCs (desde layout o aleatorio)
│   ├── Player.js       # Jugador local (movimiento, salto, sombra)
│   ├── RemotePlayer.js # Otros jugadores (interpolados + nombre)
│   ├── NPC.js          # Personaje no jugador (dorado, colisionable)
│   ├── ChatUI.js       # Chat entre jugadores (ventana, badge de no leídos)
│   ├── NpcUI.js        # Diálogos de NPC (pregunta Sí/No + mensaje épico)
│   ├── Game.js         # Bucle de juego, red e interacción con NPCs
│   └── main.js         # Pantalla de inicio y arranque
└── server/             # Servidor Node + WebSocket
    ├── package.json
    ├── server.js       # HTTP estático + WebSocket + sesiones
    └── worldLayout.js  # Layout del mundo (obstáculos + NPCs, determinista)
```

## Protocolo

- **Cliente → Servidor:** `{type:'join', name}` · `{type:'state', x,y,z,facing,vy,onGround}` (~30 Hz) · `{type:'chat', text}`.
- **Servidor → Cliente:** `{type:'welcome', id, color, layout, players}` · `{type:'state', id, …}` · `{type:'leave', id}` · `{type:'full'}` · `{type:'chat', id, name, color, text, ts}`.

El layout incluye `obstacles` (árboles/montañas) y `npcs` (personajes interactuables).
Límite de sesiones simultáneas: `MAX_PLAYERS` (por defecto 4).