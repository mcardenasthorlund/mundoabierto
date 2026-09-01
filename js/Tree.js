'use strict';

/**
 * Tree.js
 * Árbol simple: tronco cilíndrico y copa cónica (colores sólidos).
 */
const TREE_TRUNK = [0.42, 0.26, 0.15];
const TREE_FOLIAGE = [0.14, 0.44, 0.18];

class Tree extends Obstacle {
  constructor(x, z, radius) {
    super(x, z, radius);
    this.trunkHeight = 2.2;
    this.foliageRadius = radius * 1.6;
    this.foliageHeight = 2.4;
  }

  build(renderer) {
    this.meshes.push(
      renderer.createMesh(buildCylinder(this.radius * 0.5, this.trunkHeight, 8, TREE_TRUNK)),
      renderer.createMesh(buildCone(this.foliageRadius, this.foliageHeight, 10, TREE_FOLIAGE, this.trunkHeight))
    );
  }
}