'use strict';

/**
 * World.js
 * Genera el terreno y los obstáculos del mundo abierto, y resuelve colisiones.
 * Puede construirse a partir de un "layout" enviado por el servidor (para que
 * todos los jugadores compartan el mismo mundo) o generar uno aleatorio local.
 */
class World {
  /**
   * @param {Renderer} renderer Motor de renderizado.
   * @param {object} [opts] Opciones opcionales.
   * @param {number} [opts.half=120] Mitad del tamaño del mundo.
   * @param {object} [opts.layout] Layout { half, obstacles: [{type,x,z,radius}] }.
   */
  constructor(renderer, opts) {
    opts = opts || {};
    this.half = opts.half || 120;
    this.obstacles = [];
    this.npcs = [];
    this.ground = renderer.createMesh(buildGroundGrid(this.half, 8, [0.42, 0.64, 0.36]));
    this._identity = M3D.identity(new Float32Array(16));

    if (opts.layout && Array.isArray(opts.layout.obstacles)) {
      this.buildFromLayout(renderer, opts.layout);
    } else {
      this._spawn(renderer);
    }
  }

  // Construye los obstáculos a partir del layout del servidor
  buildFromLayout(renderer, layout) {
    this.half = layout.half || this.half;
    for (const item of layout.obstacles) {
      let obstacle = null;
      if (item.type === 'tree') {
        obstacle = new Tree(item.x, item.z, item.radius);
      } else if (item.type === 'mountain') {
        obstacle = new Mountain(item.x, item.z, item.radius);
      }
      if (obstacle) {
        obstacle.build(renderer);
        this.obstacles.push(obstacle);
      }
    }

    // NPCs compartidos: mismo layout para todos los jugadores
    if (Array.isArray(layout.npcs)) {
      for (const item of layout.npcs) {
        const npc = new NPC(renderer, {
          id: item.id,
          x: item.x,
          z: item.z,
          name: 'NPC_' + item.id,
        });
        this.npcs.push(npc);
      }
    }
  }

  // Fallback: coloca árboles y montañas en posiciones aleatorias sin solaparse
  _spawn(renderer) {
    const treeCount = 45;
    const mountainCount = 8;

    for (let i = 0; i < treeCount; i++) {
      const tree = new Tree(0, 0, 0.8);
      this._place(tree, 3);
      tree.build(renderer);
      this.obstacles.push(tree);
    }
    for (let i = 0; i < mountainCount; i++) {
      const mountain = new Mountain(0, 0, 6 + Math.random() * 4);
      this._place(mountain, 8);
      mountain.build(renderer);
      this.obstacles.push(mountain);
    }
  }

  _place(obstacle, minDistToCenter) {
    let attempts = 0;
    do {
      obstacle.x = (Math.random() * 2 - 1) * (this.half - 6);
      obstacle.z = (Math.random() * 2 - 1) * (this.half - 6);
      attempts++;
      if (attempts > 300) break;
    } while (!this._isFree(obstacle, minDistToCenter));
  }

  _isFree(obstacle, minDistToCenter) {
    if (Math.hypot(obstacle.x, obstacle.z) < minDistToCenter) return false;
    for (const other of this.obstacles) {
      const d = Math.hypot(obstacle.x - other.x, obstacle.z - other.z);
      if (d < obstacle.radius + other.radius + 2) return false;
    }
    return true;
  }

  // Empuja al jugador fuera de cualquier cuerpo colisionable que esté tocando
  resolveCollisions(player) {
    for (const obs of this.obstacles) this._pushOut(player, obs.x, obs.z, obs.radius);
    // Los NPCs también son colisionables (no se pueden atravesar)
    for (const npc of this.npcs) this._pushOut(player, npc.x, npc.z, npc.radius);
  }

  // Colisión círculo-círculo: empuja a "player" fuera de un círculo (cx, cz, cr)
  _pushOut(player, cx, cz, cr) {
    const dx = player.x - cx;
    const dz = player.z - cz;
    const minDist = cr + player.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < minDist * minDist) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const overlap = minDist - d;
        player.x += (dx / d) * overlap;
        player.z += (dz / d) * overlap;
      } else {
        player.x += minDist;
      }
    }
  }

  // Devuelve el NPC más cercano al punto dado si está dentro de "range"; si no, null
  nearestNpc(x, z, range) {
    let best = null;
    let bestD = range * range;
    for (const npc of this.npcs) {
      const d = (x - npc.x) * (x - npc.x) + (z - npc.z) * (z - npc.z);
      if (d < bestD) {
        bestD = d;
        best = npc;
      }
    }
    return best;
  }

  render(renderer, viewProj) {
    renderer.drawMesh(this.ground, viewProj, this._identity);
    for (const obs of this.obstacles) {
      obs.render(renderer, viewProj);
    }
  }
}