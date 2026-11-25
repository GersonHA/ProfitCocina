/**
 * Metadatos de items de Albion que usa la interfaz (nombre en español + id para
 * la imagen). Las imágenes se descargan a static/items/ con
 * scripts/download-items.mjs y se sirven desde nuestro propio sitio.
 */

export interface ItemMeta {
  id: string; // id de Albion, p. ej. T4_BREAD
  nombre: string;
}

/**
 * Recurso que produce un miembro. La clave es el valor guardado en
 * profiles.especializaciones.produce ('pan', 'ternera', 'calabaza'…).
 */
export const PRODUCE: Record<string, ItemMeta> = {
  pan: { id: 'T4_BREAD', nombre: 'Pan' },
  ternera: { id: 'T8_MEAT', nombre: 'Carne de ternera' },
  calabaza: { id: 'T8_PUMPKIN', nombre: 'Calabaza' },
  trigo: { id: 'T3_WHEAT', nombre: 'Trigo' },
};

export function produceMeta(key: string | null | undefined): ItemMeta | null {
  if (!key) return null;
  return PRODUCE[key] ?? null;
}

/**
 * Ids cuyas imágenes tenemos descargadas en static/items/.
 * Mantener en sincronía con la lista ITEMS de scripts/download-items.mjs.
 */
export const CATALOG_IMAGES: string[] = [
  'T3_FARM_WHEAT_SEED',
  'T8_FARM_PUMPKIN_SEED',
  'T8_FARM_COW_BABY',
  'T8_FARM_COW_GROWN',
  'T3_WHEAT',
  'T3_FLOUR',
  'T4_BREAD',
  'T8_MEAT',
  'T8_PUMPKIN',
  'T8_MEAL_STEW',
];
