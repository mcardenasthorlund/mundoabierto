'use strict';

/**
 * ChatUI.js
 * Interfaz de chat entre los jugadores activos.
 *
 * - Botón flotante en la esquina inferior derecha que abre/cierra el panel.
 * - Panel con la lista de mensajes y un campo para escribir.
 * - Badge con contador de mensajes no leídos cuando el panel está cerrado,
 *   con un breve parpadeo del botón al llegar un mensaje ajeno.
 *
 * Uso:
 *   const chat = new ChatUI(net);   // net: instancia de NetClient
 */
class ChatUI {
  constructor(net) {
    this.net = net;
    this._open = false;
    this._unread = 0;

    this.toggleBtn = document.getElementById('chat-toggle');
    this.badge = document.getElementById('chat-badge');
    this.panel = document.getElementById('chat-panel');
    this.messages = document.getElementById('chat-messages');
    this.input = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send');

    // Recibe los mensajes que llegan del servidor
    if (this.net) this.net.onChat = (m) => this.addMessage(m);

    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.sendBtn.addEventListener('click', () => this.send());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.send();
    });
  }

  // Abre o cierra el panel según su estado actual
  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  open() {
    this._open = true;
    this.panel.classList.add('open');
    this.toggleBtn.classList.remove('chat-blink');
    this._setUnread(0);
    this.input.focus();
    this._scrollDown();
  }

  close() {
    this._open = false;
    this.panel.classList.remove('open');
    if (this.toggleBtn.contains(document.activeElement)) this.input.blur();
  }

  // Envía el texto escrito y limpia el campo
  send() {
    const text = this.input.value;
    if (!text.trim()) return;
    if (this.net) this.net.sendChat(text);
    this.input.value = '';
    this.input.focus();
  }

  // Añade un mensaje a la lista y gestiona la notificación
  addMessage(m) {
    const own = this.net && m.id === this.net.id;
    const row = document.createElement('div');
    row.className = 'chat-msg' + (own ? ' chat-own' : ' chat-remote');

    const sender = document.createElement('span');
    sender.className = 'chat-sender';
    sender.textContent = m.name || 'Jugador';
    if (Array.isArray(m.color)) {
      const [r, g, b] = m.color;
      sender.style.color = 'rgb(' +
        Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')';
    }

    const body = document.createElement('span');
    body.className = 'chat-body';
    body.textContent = m.text;

    row.appendChild(sender);
    row.appendChild(body);
    this.messages.appendChild(row);
    this._scrollDown();

    // Si está abierto no hay no leídos; si no, contabiliza solo los ajenos
    if (!this._open && !own) {
      this._setUnread(this._unread + 1);
      if (!this.toggleBtn.classList.contains('chat-blink')) {
        this.toggleBtn.classList.add('chat-blink');
        // El parpadeo se apaga solo tras unos segundos
        clearTimeout(this._blinkTimer);
        this._blinkTimer = setTimeout(() => {
          this.toggleBtn.classList.remove('chat-blink');
        }, 4000);
      }
    }
  }

  // Actualiza el badge y lo oculta si no hay mensajes sin leer
  _setUnread(n) {
    this._unread = Math.max(0, n);
    if (this._unread > 0) {
      this.badge.textContent = this._unread > 99 ? '99+' : String(this._unread);
      this.badge.classList.add('show');
    } else {
      this.badge.classList.remove('show');
    }
  }

  // Lleva el scroll de la lista al final (mensaje más reciente)
  _scrollDown() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }
}
