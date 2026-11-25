import { defineConfig } from 'vitest/config';

/**
 * Configuración de las pruebas.
 * El motor de costos vive en `src/lib/core` y es TypeScript puro (sin DOM ni
 * DB), así que corre en el entorno `node` sin montar navegador.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
