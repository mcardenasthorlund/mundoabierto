'use strict';

/**
 * Character.js
 * Base común de todos los personajes del mundo: el jugador local (Player), los
 * jugadores remotos (RemotePlayer) y los personajes no jugadores (NPC).
 *
 * Encapsula lo que comparten todos ellos:
 * - Estado básico: posición (x, y, z), radio de colisión y altura.
 * - Dirección de mirada `facing` como vector 2D [fx, fz].
 * - Apariencia: figura humana (Humanoid) en el color del personaje, sombra
 *   proyectada en el suelo y etiqueta de nombre sobre la cabeza.
 *
 * Las subclases implementan su propio `update()` (movimiento, interpolación de
 * red, idle…) y, si su mirada no deriva de `facing`, sobrescriben
 * `_facingAngle()` (p. ej. el balanceo idle del NPC).
 */
const SHADOW_COLOR = [0, 0.12, 0.04];

class Character {
  /**
   * @param {Renderer} renderer Motor de renderizado.
   * @param {object} opts { name, color, x, y, z, radius, height }.
   */
  constructor(renderer, opts) {
    opts = opts || {};
    this.name = opts.name || 'Personaje';
    this.color = opts.color || [0.7, 0.7, 0.7];
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.z = opts.z || 0;
    this.radius = opts.radius || 0.5;
    this.height = opts.height || HUMAN_HEIGHT;
    this.facing = [0, -1]; // dirección 2D de mirada [fx, fz]

    this.nameTexture = renderer.createTextTexture(this.name);
    this.shadowMesh = renderer.createMesh(buildUnitQuadXZ(SHADOW_COLOR));
    this.humanoid = new Humanoid(renderer, { body: this.color, limb: this.color });
  }

  // Ángulo (radianes) hacia el que mira la figura; deriva de `facing`.
  // Las subclases pueden sobrescribirlo si su mirada no sigue ese vector.
  _facingAngle() {
    return Math.atan2(this.facing[0], this.facing[1]);
  }

  // Dibuja la sombra proyectada sobre el suelo
  _renderShadow(renderer, viewProj) {
    const m = M3D.identity(new Float32Array(16));
    M3D.translate(m, m, this.x, 0.02, this.z);
    M3D.scale(m, m, this.radius * 1.4, 1, this.radius * 1.4);
    renderer.drawMesh(this.shadowMesh, viewProj, m, 0.35);
  }

  // Dibuja la etiqueta con el nombre sobre la cabeza
  _renderName(renderer, viewProj, camera) {
    const nameCenter = [this.x, this.y + this.height + 0.45, this.z];
    const nameW = 0.5 + this.name.length * 0.32;
    renderer.drawSprite(
      viewProj, nameCenter, [nameW, 0.85], [1, 1, 1, 1],
      this.nameTexture, camera.getRight(), camera.getUp()
    );
  }

  // Renderiza el personaje completo: sombra + figura humana + nombre.
  // Las subclases lo heredan; solo cambia el origen de la mirada.
  render(renderer, viewProj, camera) {
    this._renderShadow(renderer, viewProj);
    this.humanoid.render(renderer, viewProj, this.x, this.y, this.z, this._facingAngle());
    this._renderName(renderer, viewProj, camera);
  }
}
