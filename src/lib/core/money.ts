/**
 * Utilidades de redondeo para MOSTRAR números.
 *
 * El motor de costos guarda siempre precisión completa (el valor total es la
 * fuente de verdad). Estas funciones solo se usan al presentar o al comparar
 * en pruebas, nunca dentro del cálculo acumulado.
 */

/** Redondea a `decimals` decimales (medio hacia arriba). */
export function roundTo(n: number, decimals: number): number {
  if (!Number.isFinite(n)) return n;
  const factor = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

/** Redondea a 2 decimales (el costo unitario típico del Kardex). */
export function round2(n: number): number {
  return roundTo(n, 2);
}
