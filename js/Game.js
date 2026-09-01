'use strict';

/**
 * Game.js
 * Orquesta el bucle de juego: físicas, input, cámara y renderizado.
 * También integra la red: envía el estado propio, recibe el de los demás
 * jugadores y los dibuja como RemotePlayer en el mismo mundo.
 */
class Game {
  /**
   * @param {HTMLCanvasElement} canvas Canvas del juego.
   * @param {object} opts Datos de la sesión: { id, name, color, layout, net }.
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.world = new World(this.renderer, { layout: opts.layout });
    this.player = new Player(0, 0, this.renderer, { name: opts.name, color: opts.color });
    this.camera = new Camera(1);
    this.net = opts.net || null;
    this.remotes = new Map(); // id -> RemotePlayer

    this.touchUi = document.getElementById('touch-ui');
    this.touchJoy = document.getElementById('joystick');
    this.touchKnob = document.getElementById('joystick-knob');
    this._touchUiShown = false;
    this._resize();

    if (this.net) this._setupNet();
    // Jugadores que ya estaban conectados al entrar
    if (opts.players) {
      for (const p of opts.players) this._addRemote(p);
    }

    window.addEventListener('resize', () => this._resize());
    this._last = performance.now();
    this._acc = 0;
    requestAnimationFrame((t) => this._tick(t));
  }

  // Configura los callbacks de red para gestionar a los demás jugadores
  _setupNet() {
    this.net.onState = (p) => this._addRemote(p);
    this.net.onLeave = (id) => { this.remotes.delete(id); };
  }

  // Añade o actualiza un jugador remoto
  _addRemote(data) {
    let rp = this.remotes.get(data.id);
    if (!rp) {
      rp = new RemotePlayer(this.renderer, data);
      this.remotes.set(data.id, rp);
    } else {
      rp.applyState(data);
    }
  }

  // Ajusta el canvas y la proyección al tamaño de pantalla actual
  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.renderer.resize(this.canvas.width, this.canvas.height);
    if (this.camera) this.camera.setAspect(w / h);
    this._vw = w;
    this._vh = h;
  }

  _tick(now) {
    const dt = Math.min((now - this._last) / 1000, 0.25);
    this._last = now;
    this._acc += dt;
    const STEP = 1 / 60;
    // Físicas con paso fijo para mayor estabilidad
    while (this._acc >= STEP) {
      this._update(STEP);
      this._acc -= STEP;
    }
    this._render();
    requestAnimationFrame((t) => this._tick(t));
  }

  _update(dt) {
    // Envía el estado propio al servidor (cadencias internas del NetClient)
    if (this.net) this.net.update(dt, this.player.getState());

    this.camera.update(this.player, dt);
    this.player.setPointerData(this.input.mouse.x, this.input.mouse.y, this._vw, this._vh);
    this.player.update(dt, this.input, this.world, this.camera);

    for (const rp of this.remotes.values()) rp.update(dt);

    this._updateTouchUI();
  }

  // Sincroniza la posición y el aspecto del joystick táctil
  _updateTouchUI() {
    const joy = this.input.getJoystick();
    if (this.input.touchSeen && !this._touchUiShown) {
      this.touchUi.classList.add('active');
      this._touchUiShown = true;
    }
    if (!this._touchUiShown) return;

    if (joy.active) {
      // El joystick aparece en el punto donde tocó el dedo
      this.touchJoy.style.left = joy.baseX + 'px';
      this.touchJoy.style.top = joy.baseY + 'px';
    }
    const maxShift = 38;
    this.touchKnob.style.transform =
      'translate(' + (joy.x * maxShift) + 'px,' + (joy.y * maxShift) + 'px)';
  }

  _render() {
    this.renderer.clear();
    const vp = this.camera.getViewProjection();
    this.world.render(this.renderer, vp);
    this.player.render(this.renderer, vp, this.camera);
    for (const rp of this.remotes.values()) rp.render(this.renderer, vp, this.camera);
  }
}