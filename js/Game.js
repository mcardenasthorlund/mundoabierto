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

    // Iluminación día/noche y elementos del cielo (sol, luna y estrellas)
    this.sky = new Sky(this.renderer);
    const lightBtn = document.getElementById('light-toggle');
    if (lightBtn) {
      lightBtn.addEventListener('click', () => this._toggleDayNight());
    }

    // Interacción con los NPCs
    this.npcUI = new NpcUI();
    this._nearNpc = null;      // NPC actualmente en rango de interacción
    this._npcCooldown = 0;     // tiempo restante antes de volver a preguntar
    this.npcUI.onAccept = (npc) => this._npcAccept(npc);
    this.npcUI.onClose = () => { this._nearNpc = null; this._npcCooldown = 2; };

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

    this.renderer.updateLighting(dt);
    this.camera.update(this.player, dt);

    // Mientras hay un diálogo abierto el jugador queda congelado (no se mueve)
    if (!this.npcUI.open) {
      this.player.setPointerData(this.input.mouse.x, this.input.mouse.y, this._vw, this._vh);
      this.player.update(dt, this.input, this.world, this.camera);
      this._updateNpcInteraction();
    }

    if (this._npcCooldown > 0) this._npcCooldown -= dt;

    for (const rp of this.remotes.values()) rp.update(dt);
    for (const npc of this.world.npcs) npc.update(dt);

    this._updateTouchUI();
  }

  // Detecta si el jugador está junto a un NPC y, en su caso, ofrece interactuar
  _updateNpcInteraction() {
    const npc = this.world.nearestNpc(this.player.x, this.player.z, 3);
    if (this.npcUI.open) return;

    if (npc && npc !== this._nearNpc && this._npcCooldown <= 0) {
      this._nearNpc = npc;
      this.npcUI.prompt(npc);
    } else if (!npc && this._nearNpc) {
      // El jugador se alejó del NPC y no hay diálogo abierto: se oculta el prompt
      this._nearNpc = null;
      this.npcUI.close();
    }
  }

  // El jugador aceptó interactuar con un NPC: se muestra un mensaje épico
  _npcAccept(npc) {
    this._nearNpc = npc;
    this.npcUI.showMessage(npc, NpcUI.randomMessage());
  }

  // Alterna día/noche y actualiza el aspecto del botón
  _toggleDayNight() {
    const light = this.renderer.lighting;
    light.toggle();
    const btn = document.getElementById('light-toggle');
    if (btn) btn.classList.toggle('light-night', !light.day);
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
    for (const npc of this.world.npcs) npc.render(this.renderer, vp, this.camera);
    this.player.render(this.renderer, vp, this.camera);
    for (const rp of this.remotes.values()) rp.render(this.renderer, vp, this.camera);
    // Sol, luna y estrellas (billboards 3D) según la iluminación
    this.sky.render(this.renderer, vp, this.camera, this.renderer.lighting.darkness, performance.now() / 1000);
  }
}