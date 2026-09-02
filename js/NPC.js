'use strict';

/**
 * NPC.js
 * Personaje no jugador: un billboard circular estático con una etiqueta de
 * nombre sobre la cabeza y una sombra en el suelo. Los NPCs no se mueven, pero
 * sí son colisionables (impiden que el jugador los atraviese) y pueden
 * interactuar con el jugador cuando este se acerca.
 *
 * Uso:
 *   const npc = new NPC(renderer, { id, x, z, name, color });
 *   npc.render(renderer, viewProj, camera);
 */
const NPC_COLOR = [0.95, 0.8, 0.2]; // dorado, distingue a los NPCs de los jugadores

class NPC {
  /**
   * @param {Renderer} renderer Motor de renderizado.
   * @param {object} data Datos del NPC: { id, x, z, name, color }.
   */
  constructor(renderer, data) {
    this.id = data.id;
    this.name = data.name || ('NPC_' + this.id);
    this.x = data.x || 0;
    this.z = data.z || 0;
    this.y = 0;
    this.color = data.color || NPC_COLOR;
    this.radius = 0.6; // radio de colisión (cuerpo del NPC)
    this.height = 1.9;

    this.nameTexture = renderer.createTextTexture(this.name);
    this.shadowMesh = renderer.createMesh(buildUnitQuadXZ(SHADOW_COLOR));

    // Figura humana (dorada) con un leve balanceo mientras espera
    this.humanoid = new Humanoid(renderer, { body: this.color, limb: this.color });
    this._idleTime = Math.random() * 10;
  }

  // Balanceo suave (idle) para dar vida al NPC mientras no se interactúa
  update(dt) {
    this._idleTime += dt;
    this.humanoid.update(dt, false);
  }

  render(renderer, viewProj, camera) {
    const right = camera.getRight();
    const up = camera.getUp();

    // Sombra sobre el suelo
    const shadow = M3D.identity(new Float32Array(16));
    M3D.translate(shadow, shadow, this.x, 0.02, this.z);
    M3D.scale(shadow, shadow, this.radius * 1.4, 1, this.radius * 1.4);
    renderer.drawMesh(this.shadowMesh, viewProj, shadow, 0.35);

    // Figura humana orientada al mundo (los NPCs miran a una dirección fija)
    const facingAngle = Math.sin(this._idleTime * 0.5) * 0.3;
    this.humanoid.render(renderer, viewProj, this.x, this.y, this.z, facingAngle);

    // Etiqueta con el nombre sobre la cabeza
    const nameCenter = [this.x, this.y + this.height + 0.45, this.z];
    const nameW = 0.5 + this.name.length * 0.32;
    renderer.drawSprite(
      viewProj, nameCenter,
      [nameW, 0.85],
      [1, 1, 1, 1],
      this.nameTexture, right, up
    );
  }
}
