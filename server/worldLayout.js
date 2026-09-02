'use strict';

/**
 * worldLayout.js
 * Genera el layout del mundo (árboles y montañas) de forma DETERMINISTA
 * usando una semilla fija, para que todos los clientes vean los mismos
 * obstáculos. Corre en el servidor y el resultado se envía a cada jugador.
 */

// PRNG determinista (mulberry32) — produce la misma secuencia para una semilla dada
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Genera el layout del mundo.
 * @param {number} half Mitad del tamaño del mundo (lado = half*2).
 * @param {number} seed Semilla para la generación determinista.
 * @returns {{half:number, obstacles:Array<{type:string,x:number,z:number,radius:number}>, npcs:Array<{id:number,x:number,z:number}>}}
 */
function generateLayout(half, seed) {
  half = half || 120;
  seed = seed || 1337;
  const rand = mulberry32(seed);
  const obstacles = [];
  const npcs = [];

  // Comprueba que una posición no solape con el centro ni con otros obstáculos
  const isFree = (x, z, radius, minDistToCenter) => {
    if (Math.hypot(x, z) < minDistToCenter) return false;
    for (const o of obstacles) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < radius + o.radius + 2) return false;
    }
    return true;
  };

  // Coloca un obstáculo en una posición libre (con reintentos)
  const place = (type, radius, minDistToCenter) => {
    let attempts = 0;
    let x = 0, z = 0;
    do {
      x = (rand() * 2 - 1) * (half - 6);
      z = (rand() * 2 - 1) * (half - 6);
      attempts++;
      if (attempts > 300) break;
    } while (!isFree(x, z, radius, minDistToCenter));
    obstacles.push({ type, x, z, radius });
  };

  for (let i = 0; i < 45; i++) place('tree', 0.8, 3);
  for (let i = 0; i < 8; i++) place('mountain', 6 + rand() * 4, 8);

  // Coloca un NPC en una posición libre (sin solapar obstáculos ni el centro)
  const placeNpc = (id) => {
    const radius = 0.8; // margen de separación respecto a obstáculos
    let attempts = 0;
    let x = 0, z = 0;
    do {
      x = (rand() * 2 - 1) * (half - 6);
      z = (rand() * 2 - 1) * (half - 6);
      attempts++;
      if (attempts > 300) break;
    } while (!isFree(x, z, radius, 10));
    npcs.push({ id, x, z });
  };

  const NPC_COUNT = 8;
  for (let i = 1; i <= NPC_COUNT; i++) placeNpc(i);

  return { half, obstacles, npcs };
}

module.exports = { generateLayout, mulberry32 };