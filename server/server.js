'use strict';

/**
 * server.js
 * Servidor HTTP + WebSocket para el juego Mundo Abierto 3D.
 *
 * - Sirve los archivos estáticos (index.html, css/, js/).
 * - Gestiona las sesiones de jugadores (máx. MAX_PLAYERS).
 * - Envía el layout del mundo a cada jugador al entrar.
 * - Retransmite los estados de posición a los demás jugadores.
 *
 * Configuración por variables de entorno:
 *   PORT        (default 8080)
 *   MAX_PLAYERS (default 4)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { generateLayout } = require('./worldLayout');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS, 10) || 4;

// Colores distintos asignados a cada sesión (debe haber >= MAX_PLAYERS)
const PLAYER_COLORS = [
  [0.2, 0.5, 0.95],   // azul
  [0.9, 0.3, 0.2],    // rojo
  [0.2, 0.8, 0.3],    // verde
  [0.95, 0.75, 0.15]  // amarillo
];

// --- Servidor de archivos estáticos ---
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  // Sanea la ruta para evitar salir del directorio raíz
  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Prohibido');
  }
  // Si es un directorio o la raíz, servimos index.html
  if (filePath === ROOT || urlPath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('No encontrado');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);

// --- Servidor WebSocket ---
const wss = new WebSocketServer({ server });

const world = generateLayout(120, 1337);
const players = new Map(); // id -> { id, name, color, x, y, z, facing, vy, onGround, lastSeen, ws }
let nextId = 1;

function serializable(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    x: p.x,
    y: p.y,
    z: p.z,
    facing: p.facing,
    vy: p.vy,
    onGround: p.onGround,
  };
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

// Retransmite el estado de un jugador a todos los demás
function broadcastState(player) {
  const data = { type: 'state', ...serializable(player) };
  for (const other of players.values()) {
    if (other.id !== player.id) send(other.ws, data);
  }
}

function removePlayer(id) {
  const p = players.get(id);
  if (!p) return;
  players.delete(id);
  for (const other of players.values()) {
    send(other.ws, { type: 'leave', id });
  }
}

function handleJoin(ws, name, id) {
  // Si el servidor está lleno, rechazamos
  if (players.size >= MAX_PLAYERS) {
    send(ws, { type: 'full', max: MAX_PLAYERS });
    return;
  }
  const color = PLAYER_COLORS[(id - 1) % PLAYER_COLORS.length];
  const player = {
    id, name,
    color,
    x: 0, y: 0, z: 0,
    facing: [0, 0, -1],
    vy: 0, onGround: true,
    lastSeen: Date.now(),
    ws,
  };
  players.set(id, player);

  // Welcome: id, color, layout y jugadores ya presentes
  send(ws, {
    type: 'welcome',
    id,
    color,
    layout: world,
    players: Array.from(players.values())
      .filter((p) => p.id !== id)
      .map(serializable),
  });

  // Avisa a los demás de que ha llegado un nuevo jugador
  broadcastState(player);
}

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (msg.type === 'join' && playerId === null) {
      // Se usa la conexión como id (evita colisiones entre sesiones)
      playerId = nextId++;
      const name = String(msg.name || 'Jugador').slice(0, 20);
      handleJoin(ws, name, playerId);
      return;
    }
    if (msg.type === 'state' && playerId !== null) {
      const p = players.get(playerId);
      if (!p) return;
      p.x = Number(msg.x) || 0;
      p.y = Number(msg.y) || 0;
      p.z = Number(msg.z) || 0;
      if (Array.isArray(msg.facing) && msg.facing.length === 2) {
        p.facing = [Number(msg.facing[0]) || 0, Number(msg.facing[1]) || 0];
      }
      p.vy = Number(msg.vy) || 0;
      p.onGround = !!msg.onGround;
      p.lastSeen = Date.now();
      broadcastState(p);
    }
  });

  ws.on('close', () => {
    if (playerId !== null) removePlayer(playerId);
  });
  ws.on('error', () => {});
});

// Heartbeat: elimina jugadores inactivos (sin estado) tras unos segundos
setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (now - p.lastSeen > 5000) removePlayer(p.id);
  }
}, 1000);

server.listen(PORT, () => {
  console.log(`Mundo Abierto 3D escuchando en http://0.0.0.0:${PORT} (máx. ${MAX_PLAYERS} jugadores)`);
});