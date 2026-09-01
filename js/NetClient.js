'use strict';

/**
 * NetClient.js
 * Cliente de red: gestiona la conexión WebSocket con el servidor.
 * Envía el estado propio a ~30 Hz y recibe broadcasts de los demás jugadores,
 * exponiendo callbacks al Game.
 *
 * Uso:
 *   const net = new NetClient();
 *   net.onWelcome = (data) => {};   // {id, color, layout, players}
 *   net.onState    = (p) => {};     // {id,name,color,x,y,z,facing,vy,onGround}
 *   net.onLeave    = (id) => {};
 *   net.onFull     = (max) => {};
 *   net.connect(name);
 *   net.sendState(state);           // se llama desde el bucle de juego
 */
class NetClient {
  constructor() {
    this.ws = null;
    this.id = null;
    this.color = null;
    this._connected = false;
    this._sendAcc = 0;
    this._sendInterval = 1 / 30; // ~30 envíos por segundo

    this.onWelcome = null;
    this.onState = null;
    this.onLeave = null;
    this.onFull = null;
    this.onClose = null;
  }

  connect(name) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(proto + '://' + location.host);
    this.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', name }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      switch (msg.type) {
        case 'welcome':
          this.id = msg.id;
          this.color = msg.color;
          this._connected = true;
          if (this.onWelcome) this.onWelcome(msg);
          break;
        case 'state':
          if (msg.id !== this.id && this.onState) this.onState(msg);
          break;
        case 'leave':
          if (this.onLeave) this.onLeave(msg.id);
          break;
        case 'full':
          if (this.onFull) this.onFull(msg.max);
          break;
      }
    };

    ws.onclose = () => {
      this._connected = false;
      if (this.onClose) this.onClose();
    };
    ws.onerror = () => {};
  }

  // Envía el estado propio según una cadencia fija (30 Hz)
  update(dt, state) {
    if (!this._connected) return;
    this._sendAcc += dt;
    if (this._sendAcc >= this._sendInterval) {
      this._sendAcc = 0;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'state', ...state }));
      }
    }
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}