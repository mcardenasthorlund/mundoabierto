'use strict';

/**
 * Renderer.js
 * Motor de renderizado WebGL 1. Gestiona el contexto, los shaders,
 * los buffers de mallas y el dibujo de geometría de color y de billboards.
 */

// --- Shaders GLSL ---

const COLOR_VS = `
attribute vec3 aPosition;
attribute vec3 aColor;
uniform mat4 uMVP;
varying vec3 vColor;
void main(void) {
  vColor = aColor;
  gl_Position = uMVP * vec4(aPosition, 1.0);
}
`;

const COLOR_FS = `
precision mediump float;
varying vec3 vColor;
uniform float uAlpha;
uniform float uBrightness;
void main(void) {
  gl_FragColor = vec4(vColor * uBrightness, uAlpha);
}
`;

const SPRITE_VS = `
attribute vec3 aOffset;
attribute vec2 aUv;
uniform mat4 uViewProj;
uniform vec3 uCenter;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uSize;
varying vec2 vUv;
void main(void) {
  vUv = aUv;
  vec3 pos = uCenter + uRight * aOffset.x * uSize.x + uUp * aOffset.y * uSize.y;
  gl_Position = uViewProj * vec4(pos, 1.0);
}
`;

const SPRITE_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec4 uColor;
uniform float uBrightness;
void main(void) {
  vec4 tex = texture2D(uTexture, vUv);
  if (tex.a < 0.05) discard;
  gl_FragColor = vec4(tex.rgb * uColor.rgb * uBrightness, tex.a * uColor.a);
}
`;

// --- Constructores de mallas (vértices intercalados: posición + color) ---

function pushVertex(verts, x, y, z, c) {
  verts.push(x, y, z, c[0], c[1], c[2]);
}

function packMesh(verts, indices) {
  return { verts: new Float32Array(verts), indices: new Uint16Array(indices) };
}

// Cilindro con base en baseY (tapa superior, tapa inferior y lateral)
function buildCylinder(radius, height, segments, color, baseY = 0) {
  const verts = [];
  const indices = [];
  const topY = baseY + height;

  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    pushVertex(verts, x, baseY, z, color);
    pushVertex(verts, x, topY, z, color);
  }
  for (let i = 0; i < segments; i++) {
    const b0 = i * 2, b1 = b0 + 1, t0 = b0 + 2, t1 = b0 + 3;
    indices.push(b0, t0, b1, b1, t0, t1);
  }

  // Tapa superior
  const cTop = verts.length / 6;
  pushVertex(verts, 0, topY, 0, color);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pushVertex(verts, Math.cos(a) * radius, topY, Math.sin(a) * radius, color);
  }
  for (let i = 0; i < segments; i++) {
    const v0 = cTop + 1 + i, v1 = cTop + 1 + ((i + 1) % segments);
    indices.push(v0, cTop, v1);
  }

  // Tapa inferior
  const cBot = verts.length / 6;
  pushVertex(verts, 0, baseY, 0, color);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pushVertex(verts, Math.cos(a) * radius, baseY, Math.sin(a) * radius, color);
  }
  for (let i = 0; i < segments; i++) {
    const v0 = cBot + 1 + i, v1 = cBot + 1 + ((i + 1) % segments);
    indices.push(v0, v1, cBot);
  }

  return packMesh(verts, indices);
}

// Cono con base en baseY (superficie lateral + base)
function buildCone(radius, height, segments, color, baseY = 0) {
  const verts = [];
  const indices = [];

  const apex = verts.length / 6;
  pushVertex(verts, 0, baseY + height, 0, color);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pushVertex(verts, Math.cos(a) * radius, baseY, Math.sin(a) * radius, color);
  }
  for (let i = 0; i < segments; i++) {
    const v0 = 1 + i, v1 = 1 + ((i + 1) % segments);
    indices.push(apex, v0, v1);
  }

  const cBase = verts.length / 6;
  pushVertex(verts, 0, baseY, 0, color);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pushVertex(verts, Math.cos(a) * radius, baseY, Math.sin(a) * radius, color);
  }
  for (let i = 0; i < segments; i++) {
    const v0 = cBase + 1 + i, v1 = cBase + 1 + ((i + 1) % segments);
    indices.push(v0, v1, cBase);
  }

  return packMesh(verts, indices);
}

// Plano cuadriculado con pequeñas variaciones de color (textura simple del suelo)
function buildGroundGrid(half, cell, baseColor) {
  const verts = [];
  const indices = [];
  const n = Math.round((half * 2) / cell);

  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x0 = -half + ix * cell;
      const z0 = -half + iz * cell;
      const x1 = x0 + cell;
      const z1 = z0 + cell;
      const v = 1 + (Math.random() * 2 - 1) * 0.08;
      const c = [baseColor[0] * v, baseColor[1] * v, baseColor[2] * v];
      const base = verts.length / 6;
      pushVertex(verts, x0, 0, z0, c);
      pushVertex(verts, x1, 0, z0, c);
      pushVertex(verts, x1, 0, z1, c);
      pushVertex(verts, x0, 0, z1, c);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return packMesh(verts, indices);
}

// Cuadrado unitario en el plano XZ (se usa para la sombra del jugador)
function buildUnitQuadXZ(color) {
  const verts = [];
  pushVertex(verts, -0.5, 0, -0.5, color);
  pushVertex(verts, 0.5, 0, -0.5, color);
  pushVertex(verts, 0.5, 0, 0.5, color);
  pushVertex(verts, -0.5, 0, 0.5, color);
  return packMesh(verts, [0, 1, 2, 0, 2, 3]);
}

// Caja (paralelepípedo) centrada en XZ, con su base (cara inferior) en baseY.
// baseY = 0 -> caja que va de 0 a +h (torso, cabeza).
// baseY = -h -> caja que va de -h a 0 (extremidades: pivote arriba, cuelga hacia abajo).
function buildBox(w, h, d, color, baseY = 0) {
  const verts = [];
  const indices = [];
  const b = baseY;
  const t = baseY + h;
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;

  // 8 vértices (posición + color), índices de las 6 caras
  pushVertex(verts, x0, b, z0, color);
  pushVertex(verts, x1, b, z0, color);
  pushVertex(verts, x1, b, z1, color);
  pushVertex(verts, x0, b, z1, color);
  pushVertex(verts, x0, t, z0, color);
  pushVertex(verts, x1, t, z0, color);
  pushVertex(verts, x1, t, z1, color);
  pushVertex(verts, x0, t, z1, color);

  // Caras: abajo, arriba, +Z, -Z, +X, -X
  const faces = [
    [0, 1, 2, 3],   // abajo
    [4, 7, 6, 5],   // arriba
    [3, 2, 6, 7],   // +Z
    [1, 0, 4, 5],   // -Z
    [2, 1, 5, 6],   // +X
    [0, 3, 7, 4],   // -X
  ];
  for (const f of faces) {
    indices.push(f[0], f[1], f[2], f[0], f[2], f[3]);
  }
  return packMesh(verts, indices);
}

// Cuadrilátero unitario para el billboard del sprite del jugador
const SPRITE_QUAD = {
  verts: new Float32Array([
    -0.5, 0, 0, 0, 1,
     0.5, 0, 0, 1, 1,
     0.5, 1, 0, 1, 0,
    -0.5, 1, 0, 0, 0,
  ]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
};

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: true }) ||
              canvas.getContext('experimental-webgl');
    if (!this.gl) {
      throw new Error('WebGL no está soportado en este navegador.');
    }
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.lighting = new Lighting();
    this._time = 0;

    this.colorProgram = Shader.create(gl, COLOR_VS, COLOR_FS);
    this.spriteProgram = Shader.create(gl, SPRITE_VS, SPRITE_FS);

    this.colorLoc = {
      aPosition: gl.getAttribLocation(this.colorProgram, 'aPosition'),
      aColor: gl.getAttribLocation(this.colorProgram, 'aColor'),
      uMVP: gl.getUniformLocation(this.colorProgram, 'uMVP'),
      uAlpha: gl.getUniformLocation(this.colorProgram, 'uAlpha'),
      uBrightness: gl.getUniformLocation(this.colorProgram, 'uBrightness'),
    };
    this.spriteLoc = {
      aOffset: gl.getAttribLocation(this.spriteProgram, 'aOffset'),
      aUv: gl.getAttribLocation(this.spriteProgram, 'aUv'),
      uViewProj: gl.getUniformLocation(this.spriteProgram, 'uViewProj'),
      uCenter: gl.getUniformLocation(this.spriteProgram, 'uCenter'),
      uRight: gl.getUniformLocation(this.spriteProgram, 'uRight'),
      uUp: gl.getUniformLocation(this.spriteProgram, 'uUp'),
      uSize: gl.getUniformLocation(this.spriteProgram, 'uSize'),
      uColor: gl.getUniformLocation(this.spriteProgram, 'uColor'),
      uTexture: gl.getUniformLocation(this.spriteProgram, 'uTexture'),
      uBrightness: gl.getUniformLocation(this.spriteProgram, 'uBrightness'),
    };

    this.spriteQuad = this.createMesh(SPRITE_QUAD);
    this._scratch = M3D.identity(new Float32Array(16));
    this._identity = M3D.identity(new Float32Array(16));
  }

  resize(width, height) {
    this.gl.viewport(0, 0, width, height);
  }

  // Avanza el sistema de iluminación (transición día/noche) y el reloj interno
  updateLighting(dt) {
    this.lighting.update(dt);
    this._time += dt;
  }

  // Limpia la pantalla con el color de cielo actual (día o noche)
  clear() {
    const sky = this.lighting.sky;
    const gl = this.gl;
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  createMesh(meshData) {
    const gl = this.gl;
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, meshData.verts, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.indices, gl.STATIC_DRAW);
    return { vbo, ibo, count: meshData.indices.length };
  }

  // Dibuja una malla de color: mvp = viewProj * model
  drawMesh(mesh, viewProj, model, alpha = 1) {
    const gl = this.gl;
    gl.useProgram(this.colorProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.enableVertexAttribArray(this.colorLoc.aPosition);
    gl.vertexAttribPointer(this.colorLoc.aPosition, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.colorLoc.aColor);
    gl.vertexAttribPointer(this.colorLoc.aColor, 3, gl.FLOAT, false, 24, 12);
    M3D.multiply(this._scratch, viewProj, model);
    gl.uniformMatrix4fv(this.colorLoc.uMVP, false, this._scratch);
    gl.uniform1f(this.colorLoc.uAlpha, alpha);
    gl.uniform1f(this.colorLoc.uBrightness, this.lighting.brightness);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  // Dibuja un billboard con textura que siempre mira a la cámara
  drawSprite(viewProj, center, size, color, texture, right, up) {
    const gl = this.gl;
    gl.useProgram(this.spriteProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteQuad.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.spriteQuad.ibo);
    gl.enableVertexAttribArray(this.spriteLoc.aOffset);
    gl.vertexAttribPointer(this.spriteLoc.aOffset, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(this.spriteLoc.aUv);
    gl.vertexAttribPointer(this.spriteLoc.aUv, 2, gl.FLOAT, false, 20, 12);
    gl.uniformMatrix4fv(this.spriteLoc.uViewProj, false, viewProj);
    gl.uniform3fv(this.spriteLoc.uCenter, center);
    gl.uniform3fv(this.spriteLoc.uRight, right);
    gl.uniform3fv(this.spriteLoc.uUp, up);
    gl.uniform2fv(this.spriteLoc.uSize, size);
    gl.uniform4fv(this.spriteLoc.uColor, color);
    gl.uniform1f(this.spriteLoc.uBrightness, this.lighting.brightness);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.spriteLoc.uTexture, 0);
    gl.drawElements(gl.TRIANGLES, this.spriteQuad.count, gl.UNSIGNED_SHORT, 0);
  }

  // Genera una textura de estrella (punto brillante con halo) usando Canvas 2D
  createStarTexture(size) {
    const gl = this.gl;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  // Genera la textura del sol: disco brillante (blanco-amarillo) con halo
  createSunTexture(size) {
    const gl = this.gl;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const c = size / 2;
    const halo = ctx.createRadialGradient(c, c, c * 0.55, c, c, c);
    halo.addColorStop(0, 'rgba(255,240,160,0.5)');
    halo.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);
    const disc = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5);
    disc.addColorStop(0, 'rgba(255,255,245,1)');
    disc.addColorStop(0.7, 'rgba(255,235,170,1)');
    disc.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.5, 0, Math.PI * 2);
    ctx.fill();

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  // Genera la textura de la luna: disco pálido con borde suave
  createMoonTexture(size) {
    const gl = this.gl;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, c * 0.6, c, c, c);
    grad.addColorStop(0, 'rgba(240,244,255,1)');
    grad.addColorStop(0.75, 'rgba(225,232,250,1)');
    grad.addColorStop(1, 'rgba(210,220,245,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.75, 0, Math.PI * 2);
    ctx.fill();

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  // Genera una textura circular con gradiente usando Canvas 2D
  createCircleTexture(size, rgb) {
    const gl = this.gl;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const c = size / 2;
    const bright = `rgb(${Math.min(255, Math.round(rgb[0] * 255 + 50))},${Math.min(255, Math.round(rgb[1] * 255 + 50))},${Math.min(255, Math.round(rgb[2] * 255 + 60))})`;
    const mid = `rgb(${Math.min(255, Math.round(rgb[0] * 255))},${Math.min(255, Math.round(rgb[1] * 255))},${Math.min(255, Math.round(rgb[2] * 255))})`;
    const dark = `rgb(${Math.min(255, Math.round(rgb[0] * 153))},${Math.min(255, Math.round(rgb[1] * 153))},${Math.min(255, Math.round(rgb[2] * 153))})`;
    const grad = ctx.createRadialGradient(c * 0.6, c * 0.6, size * 0.05, c, c, c);
    grad.addColorStop(0, bright);
    grad.addColorStop(0.6, mid);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  // Genera una textura con texto (se usa para las etiquetas de nombre)
  createTextTexture(text) {
    const gl = this.gl;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const font = 'bold 48px system-ui, sans-serif';
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const pad = 20;
    const w = Math.max(32, Math.ceil(metrics.width + pad * 2));
    const h = 72;
    cv.width = w;
    cv.height = h;

    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Contorno oscuro para legibilidad sobre cualquier fondo
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h / 2);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
}