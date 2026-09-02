'use strict';

/**
 * Lighting.js
 * Sistema de iluminación día/noche del mundo.
 *
 * Mantiene un factor de iluminación interpolado `value` (1 = día, 0 = noche)
 * que se suaviza hacia el objetivo (`day`) cuando se pulsa el botón de
 * alternar. De él se derivan:
 * - `brightness`: intensidad de la luz ambiental que se aplica a las mallas.
 * - `sky`: color del cielo (fondo) interpolado entre día y noche.
 * - `darkness`: grado de oscuridad (se usa para la visibilidad de las estrellas).
 *
 * Uso:
 *   const light = new Lighting();
 *   light.update(dt);      // avanza la transición
 *   light.toggle();        // cambia día <-> noche
 *   renderer.lighting = light;
 */
const DAY_BRIGHTNESS = 1.0;
const NIGHT_BRIGHTNESS = 0.26;
const DAY_SKY = [0.58, 0.78, 0.88];   // azul claro de día
const NIGHT_SKY = [0.02, 0.04, 0.1];  // azul noche oscuro

class Lighting {
  constructor() {
    this.day = true;  // objetivo (¿es de día?)
    this.value = 1;   // valor actual interpolado (1 día, 0 noche)
    this.speed = 2.2; // velocidad de la transición (factor exponencial)
  }

  // Cambia día <-> noche
  toggle() {
    this.day = !this.day;
  }

  // Suaviza `value` hacia el objetivo (1 si día, 0 si noche)
  update(dt) {
    const target = this.day ? 1 : 0;
    const k = 1 - Math.exp(-dt * this.speed);
    this.value += (target - this.value) * k;
  }

  // Intensidad de luz aplicada a las mallas (1 = pleno día, 0.18 = noche)
  get brightness() {
    return DAY_BRIGHTNESS + (NIGHT_BRIGHTNESS - DAY_BRIGHTNESS) * (1 - this.value);
  }

  // Grado de oscuridad (0 = día, 1 = noche) para estrellas
  get darkness() {
    return 1 - this.value;
  }

  // Color del cielo interpolado entre día y noche
  get sky() {
    return [
      DAY_SKY[0] + (NIGHT_SKY[0] - DAY_SKY[0]) * (1 - this.value),
      DAY_SKY[1] + (NIGHT_SKY[1] - DAY_SKY[1]) * (1 - this.value),
      DAY_SKY[2] + (NIGHT_SKY[2] - DAY_SKY[2]) * (1 - this.value),
    ];
  }
}