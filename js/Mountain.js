'use strict';

/**
 * Mountain.js
 * Montaña cónica grande con un casquete de nieve en la cima.
 */
const MOUNTAIN_COLOR = [0.46, 0.44, 0.42];
const SNOW_COLOR = [0.92, 0.93, 0.95];

class Mountain extends Obstacle {
  constructor(x, z, radius) {
    super(x, z, radius);
    this.height = radius * 1.6;
  }

  build(renderer) {
    this.meshes.push(
      renderer.createMesh(buildCone(this.radius, this.height, 12, MOUNTAIN_COLOR)),
      renderer.createMesh(buildCone(this.radius * 0.45, this.height * 0.28, 10, SNOW_COLOR, this.height * 0.62))
    );
  }
}