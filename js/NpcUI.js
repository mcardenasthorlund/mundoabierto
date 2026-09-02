'use strict';

/**
 * NpcUI.js
 * Interfaz de interacción con los NPCs: dos ventanas modales centradas.
 *
 * - Ventana de pregunta: "¿Quieres interactuar con NPC_x?" con botones Sí/No.
 * - Ventana de mensaje: el NPC cuenta algo (mensaje épico) con botón Cerrar.
 *
 * Es UI pura desacoplada del bucle de juego. Expone el estado `open` para que
 * el Game pueda congelar al jugador mientras un diálogo está abierto.
 *
 * Uso:
 *   const npcUI = new NpcUI();
 *   npcUI.onAccept = (npc) => { npcUI.showMessage(npc, epicMessage(npc)); };
 *   npcUI.onClose = () => {};
 *   npcUI.prompt(npc);   // muestra la ventana de pregunta
 */

// Mensajes "muy épicos" que cuentan los NPCs (se eligen al azar)
const EPIC_MESSAGES = [
  'Debes seguir la senda marcada por el camino de la luz para llegar al destino que aguarda más allá de las montañas del olvido.',
  'Solo el valiente que cruce el valle de los ecos silenciosos comprenderá el secreto que guardan las estrellas caídas.',
  'La antigua profecía dice que quien toque el árbol de cristal en el solsticio obtendrá el poder de moldear el viento.',
  'Mira hacia el horizonte dorado: allí donde el sol besa la tierra, yacerá la llave de la fortaleza ancestral.',
  'Tres pruebas te esperan, viajero: la piedra, el fuego y el corazón. Supera las tres y el mundo te será revelado.',
  'Los espíritus del bosque susurran que el tesoro solo se muestra a quienes no desean poseerlo.',
  'Cuando la luna llene el cielo, sigue el rastro de las luciérnagas gemelas hasta el santuario sumergido.',
  'El dragón dormido bajo la gran montaña despertará con el primer rayo del alba. Ve preparado, forastero.',
  'Tu nombre quedará grabado en la piedra de los héroes si logras encontrar la corona que el tiempo olvidó.',
  'Más allá del camino de la luz, una puerta de obsidiana guarda el último fragmento de la memoria del mundo.',
];

class NpcUI {
  constructor() {
    this.onAccept = null; // (npc) => {}
    this.onClose = null;  // () => {}
    this._current = null; // NPC con el que se está interactuando
    this._open = false;
    this._mode = null;    // 'prompt' | 'message'

    // --- Ventana de pregunta ---
    this.promptEl = document.getElementById('npc-prompt');
    this.promptText = document.getElementById('npc-prompt-text');
    this.promptYes = document.getElementById('npc-prompt-yes');
    this.promptNo = document.getElementById('npc-prompt-no');

    // --- Ventana de mensaje ---
    this.messageEl = document.getElementById('npc-message');
    this.messageTitle = document.getElementById('npc-message-title');
    this.messageText = document.getElementById('npc-message-text');
    this.messageClose = document.getElementById('npc-message-close');

    this.promptYes.addEventListener('click', () => this._accept());
    this.promptNo.addEventListener('click', () => this._deny());
    this.messageClose.addEventListener('click', () => this._deny());
  }

  // ¿Hay un diálogo abierto? (lo usa el Game para congelar al jugador)
  get open() {
    return this._open;
  }

  // Muestra la ventana de pregunta para interactuar con un NPC
  prompt(npc) {
    if (this._open) return;
    this._current = npc;
    this._mode = 'prompt';
    this._open = true;
    this.promptText.textContent = '¿Quieres interactuar con ' + (npc.name || 'el NPC') + '?';
    this.promptEl.classList.add('open');
  }

  // Muestra la ventana con el mensaje épico del NPC (tras aceptar)
  showMessage(npc, text) {
    this._current = npc;
    this._mode = 'message';
    this._open = true;
    this.promptEl.classList.remove('open');
    this.messageTitle.textContent = (npc.name || 'NPC') + ' te dice:';
    this.messageText.textContent = text;
    this.messageEl.classList.add('open');
  }

  // Cierra cualquier diálogo abierto
  close() {
    this.promptEl.classList.remove('open');
    this.messageEl.classList.remove('open');
    this._open = false;
    this._current = null;
    this._mode = null;
  }

  // Devuelve un mensaje épico aleatorio (para mostrar tras aceptar)
  static randomMessage() {
    return EPIC_MESSAGES[Math.floor(Math.random() * EPIC_MESSAGES.length)];
  }

  // El jugador acepta interactuar
  _accept() {
    const npc = this._current;
    if (!npc) return;
    if (this.onAccept) this.onAccept(npc);
  }

  // El jugador cierra (No o Cerrar)
  _deny() {
    this.close();
    if (this.onClose) this.onClose();
  }
}
