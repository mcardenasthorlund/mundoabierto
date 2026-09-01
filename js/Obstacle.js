'use strict';

/**
 * Obstacle.js
 * Base de cualquier obstáculo colisionable del mundo.
 * Las subclases construyen sus mallas y deciden su aspecto.
 */
class Obstacle {
  constructor(x, z, radius) {
    this.x = x;
    this.z = z;
    this.radius = radius;
    this.meshes = [];
  }

  // Construye las mallas 3D del obstáculo (implementado por las subclases)
  build(renderer) {}

  // Dibuja todas las mallas en su posición del mundo
  render(renderer, viewProj) {
    const model = M3D.identity(new Float32Array(16));
    M3D.translate(model, model, this.x, 0, this.z);
    for (const mesh of this.meshes) {
      renderer.drawMesh(mesh, viewProj, model);
    }
  }
}