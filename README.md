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
Puedes conectarte con varias pestañas para ver el movimiento de otros jugadores.

## Controles

- **Flechas / joystick táctil:** moverse.
- **Ratón:** dirección de mirada.
- **Espacio / clic / toque:** saltar.

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
│   ├── InputManager.js # Teclado + ratón + táctil
│   ├── Camera.js       # Cámara tras el jugador + raycast al suelo
│   ├── NetClient.js    # Conexión WebSocket (envía/recibe estados)
│   ├── Obstacle.js     # Base de obstáculo colisionable
│   ├── Tree.js         # Árbol (tronco + copa)
│   ├── Mountain.js     # Montaña cónica + nieve
│   ├── World.js        # Terreno + obstáculos (desde layout o aleatorio)
│   ├── Player.js       # Jugador local (movimiento, salto, sombra)
│   ├── RemotePlayer.js # Otros jugadores (interpolados + nombre)
│   ├── Game.js         # Bucle de juego e integración de red
│   └── main.js         # Pantalla de inicio y arranque
└── server/             # Servidor Node + WebSocket
    ├── package.json
    ├── server.js       # HTTP estático + WebSocket + sesiones
    └── worldLayout.js  # Layout del mundo (determinista)
```

## Protocolo

- **Cliente → Servidor:** `{type:'join', name}` · `{type:'state', x,y,z,facing,vy,onGround}` (~30 Hz).
- **Servidor → Cliente:** `{type:'welcome', id, color, layout, players}` · `{type:'state', id, …}` · `{type:'leave', id}` · `{type:'full'}`.

Límite de sesiones simultáneas: `MAX_PLAYERS` (por defecto 4).