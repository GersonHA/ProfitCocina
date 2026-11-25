/**
 * Punto de entrada del motor de costos puro.
 * Reexporta tipos, utilidades de redondeo y el reducer `runEngine`.
 *
 * Las importaciones llevan extensión `.ts` explícita para que el mismo código
 * sirva en el navegador (Vite) y en las Edge Functions (Deno).
 */
export * from './types.ts';
export * from './money.ts';
export * from './engine.ts';
