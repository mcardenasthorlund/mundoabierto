'use strict';

/**
 * NPC.js
 * Personaje no jugador: una figura humana dorada estática con un leve balanceo
 * mientras espera, su sombra y su etiqueta de nombre. Los NPCs no se mueven,
 * pero sí son colisionables (impiden que el jugador los atraviese) y pueden
 * interactuar con el jugador cuando este se acerca.
 *
 * Uso:
 *   const npc = new NPC(renderer, { id, x, z, name, color });
 *   npc.update(dt);
 *   npc.render(renderer, viewProj, camera);
 */
const NPC_COLOR = [0.95, 0.8, 0.2]; // dorado, distingue a los NPCs de los jugadores

class NPC extends Character {
  /**
   * @param {Renderer} renderer Motor de renderizado.
   * @param {object} data Datos del NPC: { id, x, z, name, color }.
   */
  constructor(renderer, data) {
    super(renderer, {
      name: data.name || ('NPC_' + data.id),
      color: data.color || NPC_COLOR,
      x: data.x || 0,
      z: data.z || 0,
      radius: 0.6, // radio de colisión (cuerpo del NPC)
    });

    this.id = data.id;
    this._idleTime = Math.random() * 10; // desfase inicial para que no estén sincronizados
  }

  // Balanceo suave (idle) para dar vida al NPC mientras no se interactúa
  update(dt) {
    this._idleTime += dt;
    this.humanoid.update(dt, false);
  }

  // El NPC no mira según `facing`, sino que se balancea suavemente a la espera
  _facingAngle() {
    return Math.sin(this._idleTime * 0.5) * 0.3;
  }
}
