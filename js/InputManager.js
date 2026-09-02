'use strict';

/**
 * InputManager.js
 * Gestiona el teclado, el ratón y las entradas táctiles de forma simultánea:
 * - Teclado: flechas para moverse, espacio para saltar.
 * - Ratón: dirección de mirada del personaje y clic para saltar.
 * - Táctil: joystick virtual en la esquina inferior izquierda para moverse
 *   y cualquier toque en el resto de la pantalla para saltar.
 */
class InputManager {
  constructor() {
    this.keys = new Map();
    this.mouse = { x: 0, y: 0, lastMoveTime: 0 };
    this._jumpQueued = false;

    // --- Estado del joystick táctil ---
    this.touchSeen = false;
    this.joystickRadius = 60;
    this.joystick = { active: false, id: null, baseX: 0, baseY: 0, x: 0, y: 0 };
    this._lastTouchJump = 0;

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.lastMoveTime = performance.now();
    });
    window.addEventListener('blur', () => this.keys.clear());

    // Un clic salta (no se cuenta si proviene de un toque ya procesado,
    // ni si se pulsó sobre un control de la interfaz, p. ej. el chat)
    window.addEventListener('click', (e) => {
      if (this._isUI(e.target)) return;
      if (performance.now() - this._lastTouchJump > 400) this._jumpQueued = true;
    });

    window.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this._onTouchEnd(e));
    window.addEventListener('touchcancel', (e) => this._onTouchEnd(e));
  }

  _onKeyDown(e) {
    // Si se está escribiendo (p. ej. en el chat), el teclado no controla el juego
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return;
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
        e.code === 'Space') {
      e.preventDefault();
    }
    const firstPress = !this.keys.has(e.code);
    this.keys.set(e.code, true);
    // Solo encola el salto en la pulsación inicial (evita saltos repetidos al mantener)
    if (e.code === 'Space' && firstPress) this._jumpQueued = true;
  }

  _onKeyUp(e) {
    // No afecta al juego mientras se escribe en el chat
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return;
    }
    this.keys.delete(e.code);
  }

  // ¿El toque/clic empezó sobre un control de la interfaz (chat, inputs…)?
  // Si es así no debe contar como entrada de juego (ni saltar ni bloquear el click).
  _isUI(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('#chat-toggle, #chat-panel, #chat-input, #chat-send, input, textarea, button');
  }

  // El toque en la zona inferior izquierda activa el joystick
  _isJoystickZone(x, y) {
    return x < window.innerWidth * 0.5 && y > window.innerHeight * 0.55;
  }

  _onTouchStart(e) {
    // Si el toque empieza sobre un control de la UI, no lo tratamos como entrada
    // del juego: sin preventDefault (deja que se dispare el click del botón) y sin salto.
    if (this._isUI(e.target)) return;
    e.preventDefault();
    this.touchSeen = true;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (!this.joystick.active && this._isJoystickZone(t.clientX, t.clientY)) {
        // Primer dedo en la zona del joystick: queda asignado a él
        this.joystick.active = true;
        this.joystick.id = t.identifier;
        this.joystick.baseX = t.clientX;
        this.joystick.baseY = t.clientY;
        this.joystick.x = 0;
        this.joystick.y = 0;
      } else {
        // Cualquier otro toque hace saltar al personaje
        this._jumpQueued = true;
        this._lastTouchJump = performance.now();
      }
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.joystick.active && t.identifier === this.joystick.id) {
        let dx = t.clientX - this.joystick.baseX;
        let dy = t.clientY - this.joystick.baseY;
        const len = Math.hypot(dx, dy);
        // Limita el desplazamiento al radio del joystick
        if (len > this.joystickRadius) {
          dx = (dx / len) * this.joystickRadius;
          dy = (dy / len) * this.joystickRadius;
        }
        // y positiva = hacia arriba (convención de movimiento)
        this.joystick.x = dx / this.joystickRadius;
        this.joystick.y = -dy / this.joystickRadius;
      }
    }
  }

  _onTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.joystick.active && t.identifier === this.joystick.id) {
        this.joystick.active = false;
        this.joystick.id = null;
        this.joystick.x = 0;
        this.joystick.y = 0;
      }
    }
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Devuelve true una sola vez por pulsación (espacio, clic o toque)
  consumeJump() {
    const queued = this._jumpQueued;
    this._jumpQueued = false;
    return queued;
  }

  // Ejes de movimiento de las flechas (x: derecha positiva, y: adelante positiva)
  axis() {
    let x = 0, y = 0;
    if (this.isDown('ArrowRight')) x += 1;
    if (this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('ArrowUp')) y += 1;
    if (this.isDown('ArrowDown')) y -= 1;
    return { x, y };
  }

  getJoystick() {
    return this.joystick;
  }
}