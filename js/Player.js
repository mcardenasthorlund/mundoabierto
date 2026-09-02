'use strict';

/**
 * Player.js
 * Personaje controlable: movimiento con flechas (relativo a la cámara),
 * dirección de mirada determinada por el ratón y salto con gravedad.
 */
const PLAYER_COLOR = [0.2, 0.5, 0.95];
const SHADOW_COLOR = [0, 0.12, 0.04];

class Player {
  constructor(x, z, renderer, opts) {
    opts = opts || {};
    this.x = x;
    this.y = 0;
    this.z = z;
    this.vy = 0;
    this.radius = 0.5;
    this.height = 1.9;
    this.speed = 8;
    this.jumpSpeed = 9.5;
    this.gravity = -24;
    this.onGround = true;

    this.name = opts.name || 'Yo';
    this.color = opts.color || PLAYER_COLOR;
    this.facing = [0, 0, -1];
    this._turnTarget = null; // ángulo de mirada objetivo (ratón), en radianes
    this._mx = 0; this._my = 0; this._vw = 1; this._vh = 1;

    this.nameTexture = renderer.createTextTexture(this.name);
    this.shadowMesh = renderer.createMesh(buildUnitQuadXZ(SHADOW_COLOR));

    // Figura humana (torso/piernas/brazos en el color de sesión, cabeza piel)
    this.humanoid = new Humanoid(renderer, { body: this.color, limb: this.color });
    this._moving = false;
  }

  // Estado comprimido para enviar al servidor
  getState() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      facing: [this.facing[0], this.facing[2]],
      vy: this.vy,
      onGround: this.onGround,
    };
  }

  setPointerData(mx, my, vw, vh) {
    this._mx = mx;
    this._my = my;
    this._vw = vw;
    this._vh = vh;
  }

  update(dt, input, world, camera) {
    // --- Salto ---
    if (input.consumeJump() && this.onGround) {
      this.vy = this.jumpSpeed;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
      }
    }

    // --- Eje combinado de movimiento (flechas + joystick táctil) ---
    const ax = input.axis();
    const joy = input.getJoystick();
    let mx = ax.x + (joy.active ? joy.x : 0);
    let my = ax.y + (joy.active ? joy.y : 0);
    // Zona muerta para evitar deriva del joystick
    if (Math.abs(mx) < 0.15) mx = 0;
    if (Math.abs(my) < 0.15) my = 0;
    const moving = mx !== 0 || my !== 0;
    this._moving = moving;
    this.humanoid.update(dt, moving);

    const f = camera.forward;
    const r = camera.right;

    // --- Dirección de mirada ---
    const mouseFresh = performance.now() - input.mouse.lastMoveTime < 150;
    if (mouseFresh) {
      // Con ratón: el personaje sigue la posición del cursor.
      // Se guarda el ángulo objetivo y se interpola el giro para que sea suave,
      // evitando que la cámara dé vueltas rápido cuando el ratón se acerca al jugador.
      const ndcX = (this._mx / this._vw) * 2 - 1;
      const ndcY = 1 - (this._my / this._vh) * 2;
      const hit = [0, 0, 0];
      if (camera.unprojectGround(ndcX, ndcY, hit)) {
        const dx = hit[0] - this.x;
        const dz = hit[2] - this.z;
        const len = Math.hypot(dx, dz);
        if (len > 0.5) this._turnTarget = Math.atan2(dx, dz);
      }
      this._smoothTurn(dt);
    } else if (moving) {
      // Sin ratón (táctil): mira hacia la dirección del movimiento
      const fdx = r[0] * mx + f[0] * my;
      const fdz = r[2] * mx + f[2] * my;
      const flen = Math.hypot(fdx, fdz) || 1;
      this.facing[0] = fdx / flen;
      this.facing[2] = fdz / flen;
    }

    // --- Movimiento ---
    if (moving) {
      let dx = r[0] * mx + f[0] * my;
      let dz = r[2] * mx + f[2] * my;
      const len = Math.hypot(dx, dz) || 1;
      const speed = this.speed * (this.onGround ? 1 : 0.7);
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;

      // Movimiento con colisiones por eje para poder deslizar junto a los obstáculos
      this.x += dx;
      world.resolveCollisions(this);
      this.z += dz;
      world.resolveCollisions(this);
    }

    // --- Limitar el movimiento al interior del mundo ---
    const lim = world.half - 1;
    this.x = Math.max(-lim, Math.min(lim, this.x));
    this.z = Math.max(-lim, Math.min(lim, this.z));
  }

  // Rota la mirada de forma suave hacia el ángulo objetivo (más corto posible).
  // Al interpolar solo una fracción del giro restante, los cambios bruscos de
  // dirección (p. ej. ratón cerca del jugador) se convierten en giros controlados.
  _smoothTurn(dt) {
    if (this._turnTarget === null) return;
    let ang = Math.atan2(this.facing[0], this.facing[2]);
    let diff = this._turnTarget - ang;
    // Normaliza la diferencia al rango [-PI, PI] para girar por el camino corto
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const k = 1 - Math.exp(-dt * 12);
    ang += diff * k;
    this.facing[0] = Math.sin(ang);
    this.facing[2] = Math.cos(ang);
  }

  render(renderer, viewProj, camera) {
    // Sombra proyectada sobre el suelo
    const model = M3D.identity(new Float32Array(16));
    M3D.translate(model, model, this.x, 0.02, this.z);
    M3D.scale(model, model, this.radius * 1.4, 1, this.radius * 1.4);
    renderer.drawMesh(this.shadowMesh, viewProj, model, 0.35);

    // Figura humana orientada según la mirada, animada al moverse
    const facingAngle = Math.atan2(this.facing[0], this.facing[2]);
    this.humanoid.render(renderer, viewProj, this.x, this.y, this.z, facingAngle);

    // Etiqueta con el nombre sobre la cabeza
    const nameCenter = [this.x, this.y + this.height + 0.45, this.z];
    const nameW = 0.5 + this.name.length * 0.32;
    renderer.drawSprite(
      viewProj,
      nameCenter,
      [nameW, 0.85],
      [1, 1, 1, 1],
      this.nameTexture,
      camera.getRight(),
      camera.getUp()
    );
  }
}