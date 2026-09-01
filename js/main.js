'use strict';

/**
 * main.js
 * Punto de entrada: muestra la pantalla de inicio, conecta con el servidor
 * y arranca el juego cuando se recibe el layout y los datos de la sesión.
 */
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const errorBox = document.getElementById('error');
  const overlay = document.getElementById('start-screen');
  const nameInput = document.getElementById('name-input');
  const startBtn = document.getElementById('start-btn');
  const statusMsg = document.getElementById('status-msg');

  let game = null;
  let net = null;

  function showStatus(text, isError) {
    statusMsg.textContent = text;
    statusMsg.classList.toggle('error', !!isError);
  }

  function startGame() {
    const name = (nameInput.value.trim() || 'Jugador').slice(0, 20);
    startBtn.disabled = true;
    showStatus('Conectando…');

    net = new NetClient();

    // Inicializa el chat entre jugadores
    new ChatUI(net);

    net.onWelcome = (data) => {
      // El juego empieza al recibir el layout y los datos de la sesión
      overlay.classList.add('hidden');
      canvas.style.display = 'block';
      game = new Game(canvas, {
        id: data.id,
        name,
        color: data.color,
        layout: data.layout,
        players: data.players,
        net,
      });
    };

    net.onFull = (max) => {
      startBtn.disabled = false;
      showStatus('El servidor está lleno (' + max + ' jugadores). Inténtalo más tarde.', true);
    };

    net.onClose = () => {
      if (!game) {
        startBtn.disabled = false;
        showStatus('No se pudo conectar con el servidor.', true);
      }
    };

    net.connect(name);
  }

  startBtn.addEventListener('click', startGame);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startGame();
  });

  errorBox.textContent = '';
});