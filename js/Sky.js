'use strict';

/**
 * Sky.js
 * Elementos del cielo (sol, luna y estrellas) dibujados como billboards 3D
 * que quedan DETRÁS de los obstáculos gracias al test de profundidad, dando la
 * sensación de que están en el cielo.
 *
 * Se posicionan alrededor de la cámara, pero relativos a su base (forward/up),
 * de modo que siempre quedan por delante de ella y en la zona del cielo. Como
 * se dibujan con profundidad, un árbol o montaña que quede por delante los
 * ocluye correctamente.
 *
 * Uso:
 *   const sky = new Sky(renderer);
 *   sky.render(renderer, viewProj, camera, darkness, time);
 */
class Sky {
  /**
   * @param {Renderer} renderer Motor de renderizado.
   * @param {number} [count=140] Número de estrellas.
   */
  constructor(renderer, count) {
    this.count = count || 140;
    this.radius = 280;       // distancia de estrellas a la cámara
    this.celestialDist = 280; // distancia del sol/luna a la cámara

    // Estrellas en coordenadas locales de cámara (rx=right, uy=up, fz=forward).
    // Se restringen a la zona frontal (+fz) y alta (+uy) para que siempre se vean.
    this.stars = [];
    for (let i = 0; i < this.count; i++) {
      this.stars.push({
        rx: (Math.random() * 2 - 1) * 0.9,
        uy: Math.random() * 0.9,
        fz: 0.12 + Math.random() * 0.95,
        size: 0.7 + Math.random() * 1.2,
        tw: 0.5 + Math.random() * 0.5,
      });
    }

    this.starTexture = renderer.createStarTexture(64);
    this.sunTexture = renderer.createSunTexture(128);
    this.moonTexture = renderer.createMoonTexture(128);
  }

  // Convierte una dirección local de cámara (rx, uy, fz) a un punto del mundo
  // situado a distancia "dist" del ojo, usando la base (right, up, forward).
  _toWorld(eye, right, up, fwd, rx, uy, fz, dist) {
    let x = right[0] * rx + up[0] * uy + fwd[0] * fz;
    let y = right[1] * rx + up[1] * uy + fwd[1] * fz;
    let z = right[2] * rx + up[2] * uy + fwd[2] * fz;
    const len = Math.hypot(x, y, z) || 1;
    return [
      eye[0] + (x / len) * dist,
      eye[1] + (y / len) * dist,
      eye[2] + (z / len) * dist,
    ];
  }

  /**
   * Dibuja sol, luna y estrellas.
   * @param {Renderer} renderer
   * @param {Float32Array} viewProj
   * @param {Camera} camera
   * @param {number} darkness 0 (día) .. 1 (noche).
   * @param {number} time Tiempo transcurrido (para el parpadeo).
   */
  render(renderer, viewProj, camera, darkness, time) {
    const eye = camera.getEye();
    const right = camera.getRight();
    const up = camera.getUp();
    const fwd = camera.forward;
    const day = 1 - darkness;

    // Sol: delante y un poco arriba de la cámara
    if (day > 0.02) {
      const pos = this._toWorld(eye, right, up, fwd, 0.12, 0.75, 1.0, this.celestialDist);
      renderer.drawSprite(
        viewProj, pos, [44, 44], [1, 1, 1, day], this.sunTexture, right, up
      );
    }

    // Luna: delante, arriba y a un lado
    if (darkness > 0.02) {
      const pos = this._toWorld(eye, right, up, fwd, -0.5, 0.5, 1.0, this.celestialDist);
      renderer.drawSprite(
        viewProj, pos, [28, 28], [1, 1, 1, darkness], this.moonTexture, right, up
      );
    }

    // Estrellas
    if (darkness <= 0.03) return;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const pos = this._toWorld(eye, right, up, fwd, s.rx, s.uy, s.fz, this.radius);
      const twinkle = 0.7 + 0.3 * Math.sin(time * 2 + i);
      const alpha = darkness * s.tw * twinkle;
      renderer.drawSprite(
        viewProj, pos, [s.size, s.size], [1, 1, 1, alpha], this.starTexture, right, up
      );
    }
  }
}