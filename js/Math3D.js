'use strict';

/**
 * Math3D.js
 * Utilidades matemáticas mínimas para WebGL sin librerías externas:
 * matrices 4x4 en orden columna-mayor (Float32Array(16)) y vectores 3D.
 */
const M3D = (function () {

  // ---------- Matrices ----------

  function identity(out) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  }

  // out = a * b (soporta que out coincida con a o b)
  function multiply(out, a, b) {
    if (out === a) a = Float32Array.from(a);
    if (out === b) b = Float32Array.from(b);
    for (let c = 0; c < 4; c++) {
      const bc0 = b[c * 4], bc1 = b[c * 4 + 1], bc2 = b[c * 4 + 2], bc3 = b[c * 4 + 3];
      out[c * 4]     = a[0] * bc0 + a[4] * bc1 + a[8] * bc2 + a[12] * bc3;
      out[c * 4 + 1] = a[1] * bc0 + a[5] * bc1 + a[9] * bc2 + a[13] * bc3;
      out[c * 4 + 2] = a[2] * bc0 + a[6] * bc1 + a[10] * bc2 + a[14] * bc3;
      out[c * 4 + 3] = a[3] * bc0 + a[7] * bc1 + a[11] * bc2 + a[15] * bc3;
    }
    return out;
  }

  // Matriz de proyección en perspectiva
  function perspective(out, fovY, aspect, near, far) {
    const f = 1.0 / Math.tan(fovY / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  }

  // Matriz de vista que mira desde "eye" hacia "center"
  function lookAt(out, eye, center, up) {
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    let zl = Math.hypot(zx, zy, zz) || 1;
    zx /= zl; zy /= zl; zz /= zl;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    let xl = Math.hypot(xx, xy, xz) || 1;
    xx /= xl; xy /= xl; xz /= xl;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  function invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0]  = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1]  = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2]  = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3]  = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4]  = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5]  = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6]  = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7]  = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8]  = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9]  = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }

  // Compone transformaciones: out = m * Transform
  function translate(out, m, tx, ty, tz) {
    const t = identity(new Float32Array(16));
    t[12] = tx; t[13] = ty; t[14] = tz;
    return multiply(out, m, t);
  }

  function scale(out, m, sx, sy, sz) {
    const s = identity(new Float32Array(16));
    s[0] = sx; s[5] = sy; s[10] = sz;
    return multiply(out, m, s);
  }

  function rotateX(out, m, rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    const r = identity(new Float32Array(16));
    r[5] = c; r[6] = s; r[9] = -s; r[10] = c;
    return multiply(out, m, r);
  }

  function rotateY(out, m, rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    const r = identity(new Float32Array(16));
    r[0] = c; r[2] = -s; r[8] = s; r[10] = c;
    return multiply(out, m, r);
  }

  // ---------- Vectores ----------

  function vec3Sub(out, a, b) {
    out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2];
    return out;
  }

  function vec3Cross(out, a, b) {
    out[0] = a[1] * b[2] - a[2] * b[1];
    out[1] = a[2] * b[0] - a[0] * b[2];
    out[2] = a[0] * b[1] - a[1] * b[0];
    return out;
  }

  function vec3Normalize(out, v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l;
    return out;
  }

  return { identity, multiply, perspective, lookAt, invert, translate, scale, rotateX, rotateY, vec3Sub, vec3Cross, vec3Normalize };
})();