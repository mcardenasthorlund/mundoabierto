'use strict';

/**
 * RemotePlayer.js
 * Representa a otro jugador conectado: una figura humana con el color de su
 * sesión, sombra en el suelo y etiqueta de nombre sobre la cabeza. Interpola
 * suavemente hacia el último estado recibido de la red y anima el caminado
 * según la distancia recorrida.
 */
class RemotePlayer extends Character {
  constructor(renderer, data) {
    super(renderer, {
      name: data.name || 'Jugador',
      color: data.color || [0.7, 0.7, 0.7],
      x: data.x || 0,
      y: data.y || 0,
      z: data.z || 0,
      radius: 0.6,
    });

    this.id = data.id;

    // Posición actual (interpolada) y objetivo (recibido de la red)
    this.tx = this.x;
    this.ty = this.y;
    this.tz = this.z;
    this.tfacing = [0, -1];

    // Última posición para detectar movimiento a partir de la interpolación
    this._px = this.x;
    this._pz = this.z;
  }

  // Aplica un estado recibido del servidor
  applyState(data) {
    this.tx = data.x || 0;
    this.ty = data.y || 0;
    this.tz = data.z || 0;
    if (Array.isArray(data.facing) && data.facing.length === 2) {
      this.tfacing = [data.facing[0], data.facing[1]];
    }
  }

  // Interpola la posición/giro hacia el objetivo (suavizado de la red)
  update(dt) {
    const k = 1 - Math.exp(-dt * 12);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.z += (this.tz - this.z) * k;
    this.facing[0] += (this.tfacing[0] - this.facing[0]) * k;
    this.facing[1] += (this.tfacing[1] - this.facing[1]) * k;

    // Detecta el movimiento por la distancia recorrida en esta interpolación
    const moving = Math.hypot(this.x - this._px, this.z - this._pz) > 0.001;
    this._px = this.x;
    this._pz = this.z;
    this.humanoid.update(dt, moving);
  }
}
