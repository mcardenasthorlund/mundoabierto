'use strict';

/**
 * Humanoid.js
 * Figura humana simple (antropomórfica) construida con cajas 3D de color plano
 * y proporciones tipo Minecraft (cabeza grande y cúbica, cuerpo macizo),
 * que sustituye a los billboards circulares de jugadores y NPCs.
 *
 * Compone el cuerpo con torso, cabeza, dos piernas y dos brazos. El modelo se
 * orienta hacia el ángulo de mirada (rotación en Y) y las extremidades se
 * balancean alrededor de su articulación (cadera/hombro) según una fase de
 * caminado, simulando el movimiento por el mapa.
 *
 * Uso:
 *   const figure = new Humanoid(renderer, { body, limb, head });
 *   figure.update(dt, moving);
 *   figure.render(renderer, viewProj, x, y, z, facingAngle);
 */

// Altura total de la figura (cadera + torso + cabeza). La usan Character y las
// subclases para colocar la etiqueta de nombre por encima de la cabeza.
const HUMAN_HEIGHT = 2.9;

class Humanoid {
  /**
   * @param {Renderer} renderer Motor de renderizado.
   * @param {object} colors Colores [r,g,b] de { body, limb, head }.
   */
  constructor(renderer, colors) {
    colors = colors || {};
    const body = colors.body || [0.7, 0.7, 0.7];
    const limb = colors.limb || body;
    const head = colors.head || [0.9, 0.72, 0.55];

    // Proporciones tipo Minecraft (cabeza grande y cúbica). Altura total ~2.9 u.
    this.legLen = 1.0;      // largo de la pierna (desde la cadera)
    this.legW = 0.5;        // grosor de la pierna
    this.torsoH = 0.8;      // alto del torso
    this.torsoW = 1.0;      // ancho del torso
    this.torsoD = 0.55;     // profundidad del torso
    this.armLen = 1.0;      // largo del brazo (desde el hombro)
    this.armW = 0.45;       // grosor del brazo
    this.headSize = 1.1;    // tamaño de la cabeza (cubo grande)
    this.shoulderY = 1.65;  // altura de los hombros (articulación de los brazos)

    // Mallas construidas con la articulación (cadera/hombro) en el origen y
    // colgando hacia abajo (baseY = -len), para que roten en el pivote.
    this.torso = renderer.createMesh(buildBox(this.torsoW, this.torsoH, this.torsoD, body, 0));
    this.head = renderer.createMesh(buildBox(this.headSize, this.headSize, this.headSize, head, 0));
    this.legL = renderer.createMesh(buildBox(this.legW, this.legLen, this.legW, limb, -this.legLen));
    this.legR = renderer.createMesh(buildBox(this.legW, this.legLen, this.legW, limb, -this.legLen));
    this.armL = renderer.createMesh(buildBox(this.armW, this.armLen, this.armW, limb, -this.armLen));
    this.armR = renderer.createMesh(buildBox(this.armW, this.armLen, this.armW, limb, -this.armLen));

    this.hipY = this.legLen;   // altura de la cadera
    this._phase = 0;           // fase de la animación de caminado
    this._walk = 0;            // amplitud suavizada (0 parado, 1 caminando)

    // Matrices scratch reutilizadas en cada frame (los drawMesh las consumen
    // de forma síncrona, así que se pueden reusar entre partes).
    this._root = M3D.identity(new Float32Array(16)); // raíz del cuerpo
    this._part = M3D.identity(new Float32Array(16)); // torso/cabeza
    this._limb = M3D.identity(new Float32Array(16)); // extremidades
  }

  // Avanza la animación: moving aumenta la fase; _walk se mezcla hacia 0/1
  update(dt, moving) {
    if (moving) this._phase += dt * 11;
    const target = moving ? 1 : 0;
    const k = 1 - Math.exp(-dt * 8);
    this._walk += (target - this._walk) * k;
  }

  /**
   * Dibuja la figura en (x, y, z) orientada a "angle" (radianes).
   * @param {Renderer} renderer
   * @param {Float32Array} viewProj Matriz vista*proyección.
   * @param {number} x Posición X.
   * @param {number} y Altura de la base (suelo).
   * @param {number} z Posición Z.
   * @param {number} angle Ángulo de mirada (facing).
   */
  render(renderer, viewProj, x, y, z, angle) {
    const s = Math.sin(this._phase);
    const swing = 0.65 * this._walk;        // balanceo de las piernas
    const armSwing = 0.5 * this._walk;      // balanceo de los brazos (menor)

    const hipY = y + this.hipY;
    const shoulderY = y + this.shoulderY;
    const side = this.torsoW * 0.5 + this.armW * 0.35;

    // Matriz raíz: posición del personaje + orientación según la mirada.
    // rotateY(angle) hace que el frente del modelo (+Z) apunte hacia facing.
    M3D.identity(this._part);
    M3D.translate(this._root, this._part, x, y, z);
    M3D.rotateY(this._root, this._root, angle);

    // Torso (asentado sobre la cadera)
    renderer.drawMesh(this.torso, viewProj, this._translateLocal(0, this.hipY, 0));

    // Cabeza (encima del torso)
    renderer.drawMesh(this.head, viewProj, this._translateLocal(0, this.hipY + this.torsoH, 0));

    // Piernas: pivotan en la cadera; desfasadas 180° para simular el paso
    renderer.drawMesh(this.legL, viewProj, this._limbLocal(0, hipY, 0, s * swing));
    renderer.drawMesh(this.legR, viewProj, this._limbLocal(0, hipY, 0, -s * swing));

    // Brazos: pivotan en el hombro; se balancean en contra de la pierna del mismo lado
    renderer.drawMesh(this.armL, viewProj, this._limbLocal(-side, shoulderY, 0, -s * armSwing));
    renderer.drawMesh(this.armR, viewProj, this._limbLocal(side, shoulderY, 0, s * armSwing));
  }

  // Matriz para una parte centrada en un desplazamiento local del cuerpo
  _translateLocal(dx, dy, dz) {
    return M3D.translate(this._part, this._root, dx, dy, dz);
  }

  // Matriz para una extremidad: desplazada al pivote (dx, dy, dz) y girada en X
  _limbLocal(dx, dy, dz, rotX) {
    M3D.identity(this._limb);
    M3D.translate(this._limb, this._limb, dx, dy, dz);
    M3D.rotateX(this._limb, this._limb, rotX);
    // Compone con la matriz raíz del cuerpo
    return M3D.multiply(this._limb, this._root, this._limb);
  }
}
