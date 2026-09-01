'use strict';

/**
 * RemotePlayer.js
 * Representa a otro jugador conectado. Dibuja su billboard circular con el
 * color de su sesión, una sombra en el suelo y una etiqueta con su nombre
 * sobre la cabeza. Interpola suavemente hacia el último estado recibido.
 */
class RemotePlayer {
  constructor(renderer, data) {
    this.id = data.id;
    this.name = data.name || 'Jugador';
    this.color = data.color || [0.7, 0.7, 0.7];

    // Posición actual (interpolada) y objetivo (recibido de la red)
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.z = data.z || 0;
    this.tx = this.x;
    this.ty = this.y;
    this.tz = this.z;

    this.facing = [0, 0, -1];
    this.tfacing = [0, 0, -1];

    this.radius = 0.5;
    this.height = 1.9;

    this.spriteTexture = renderer.createCircleTexture(128, this.color);
    this.nameTexture = renderer.createTextTexture(this.name);
    this.shadowMesh = renderer.createMesh(buildUnitQuadXZ(SHADOW_COLOR));
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
  }

  render(renderer, viewProj, camera) {
    // Sombra sobre el suelo
    const shadow = M3D.identity(new Float32Array(16));
    M3D.translate(shadow, shadow, this.x, 0.02, this.z);
    M3D.scale(shadow, shadow, this.radius * 1.4, 1, this.radius * 1.4);
    renderer.drawMesh(this.shadowMesh, viewProj, shadow, 0.35);

    const right = camera.getRight();
    const up = camera.getUp();

    // Sprite billboard del personaje
    const center = [this.x, this.y, this.z];
    renderer.drawSprite(
      viewProj, center,
      [this.radius * 2, this.height],
      [1, 1, 1, 1],
      this.spriteTexture, right, up
    );

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