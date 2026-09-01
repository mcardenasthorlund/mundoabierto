'use strict';

/**
 * Camera.js
 * Cámara que siempre va detrás del jugador según la dirección a la que mira,
 * manteniéndolo visible y centrado. También permite proyectar el ratón al terreno.
 */
class Camera {
  constructor(aspect) {
    this.aspect = aspect;
    this.fov = (60 * Math.PI) / 180;
    this.near = 0.1;
    this.far = 800;
    this.distance = 28;
    this.height = 12;

    this.eye = [0, this.height, this.distance];
    this.target = [0, 1.5, 0];
    this.forward = [0, 0, -1];
    this.right = [1, 0, 0];
    this.up = [0, 1, 0];

    this.proj = M3D.identity(new Float32Array(16));
    this.view = M3D.identity(new Float32Array(16));
    this.viewProj = M3D.identity(new Float32Array(16));
    this.invViewProj = M3D.identity(new Float32Array(16));
  }

  setAspect(aspect) {
    this.aspect = aspect;
  }

  update(player, dt) {
    // Dirección opuesta a la mirada del jugador: la cámara va siempre detrás
    let bx = 0, bz = -1;
    const flen = Math.hypot(player.facing[0], player.facing[2]);
    if (flen > 1e-4) {
      bx = -player.facing[0] / flen;
      bz = -player.facing[2] / flen;
    }

    const desiredEye = [
      player.x + bx * this.distance,
      player.y + this.height,
      player.z + bz * this.distance,
    ];

    // Seguimiento suave para que el giro de la cámara no sea brusco
    const k = 1 - Math.exp(-dt * 8);
    this.eye[0] += (desiredEye[0] - this.eye[0]) * k;
    this.eye[1] += (desiredEye[1] - this.eye[1]) * k;
    this.eye[2] += (desiredEye[2] - this.eye[2]) * k;

    this.target[0] = player.x;
    this.target[1] = player.y + 1.2;
    this.target[2] = player.z;

    // Base ortonormal de la cámara (se usa para billboards y movimiento relativo)
    M3D.vec3Sub(this.forward, this.target, this.eye);
    M3D.vec3Normalize(this.forward, this.forward);
    M3D.vec3Cross(this.right, this.forward, [0, 1, 0]);
    M3D.vec3Normalize(this.right, this.right);
    M3D.vec3Cross(this.up, this.right, this.forward);

    M3D.perspective(this.proj, this.fov, this.aspect, this.near, this.far);
    M3D.lookAt(this.view, this.eye, this.target, this.up);
    M3D.multiply(this.viewProj, this.proj, this.view);
    M3D.invert(this.invViewProj, this.viewProj);
  }

  getViewProjection() {
    return this.viewProj;
  }

  getEye() { return this.eye; }
  getRight() { return this.right; }
  getUp() { return this.up; }

  // Proyecta las coordenadas NDC del ratón al plano del suelo (y = 0).
  // Devuelve true y escribe el punto en "out" si el rayo alcanza el suelo.
  unprojectGround(ndcX, ndcY, out) {
    const inv = this.invViewProj;
    const nearW = this._transform(inv, ndcX, ndcY, -1);
    const farW = this._transform(inv, ndcX, ndcY, 1);
    let dx = farW[0] - nearW[0];
    let dy = farW[1] - nearW[1];
    let dz = farW[2] - nearW[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    if (Math.abs(dy) < 1e-6) return false;
    const t = -nearW[1] / dy;
    if (t < 0) return false;
    out[0] = nearW[0] + dx * t;
    out[1] = 0;
    out[2] = nearW[2] + dz * t;
    return true;
  }

  // Transforma un punto de clip (ndc, z, w=1) a espacio mundo
  _transform(inv, ndcX, ndcY, ndcZ) {
    const x = ndcX * inv[0] + ndcY * inv[4] + ndcZ * inv[8] + inv[12];
    const y = ndcX * inv[1] + ndcY * inv[5] + ndcZ * inv[9] + inv[13];
    const z = ndcX * inv[2] + ndcY * inv[6] + ndcZ * inv[10] + inv[14];
    const w = ndcX * inv[3] + ndcY * inv[7] + ndcZ * inv[11] + inv[15];
    return [x / w, y / w, z / w];
  }
}