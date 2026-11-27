/**
 * Catálogo curado de RECURSOS que un miembro puede producir, agrupado por tipo.
 * Cada recurso es un item real del juego (id de Albion), así la imagen sale del
 * CDN y el costo (Kardex) ya funciona para cualquiera.
 *
 * Un miembro puede producir 1 o varios. Se guardan como lista de ids en
 * profiles.especializaciones.produces (ej. ['T8_MEAT', 'T8_MILK']).
 */

export interface ResourceOpt {
  id: string;
  nombre: string;
}

export interface ResourceGroup {
  grupo: string;
  items: ResourceOpt[];
}

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    grupo: 'Cultivos',
    items: [
      { id: 'T1_CARROT', nombre: 'Zanahorias' },
      { id: 'T2_BEAN', nombre: 'Frijoles' },
      { id: 'T3_WHEAT', nombre: 'Trigo' },
      { id: 'T4_TURNIP', nombre: 'Rábanos' },
      { id: 'T5_CABBAGE', nombre: 'Coles' },
      { id: 'T6_POTATO', nombre: 'Patatas' },
      { id: 'T7_CORN', nombre: 'Maíz' },
      { id: 'T8_PUMPKIN', nombre: 'Calabaza' },
    ],
  },
  {
    grupo: 'Carnes',
    items: [
      { id: 'T3_MEAT', nombre: 'Carne de pollo' },
      { id: 'T4_MEAT', nombre: 'Carne de cabra' },
      { id: 'T5_MEAT', nombre: 'Carne de ganso' },
      { id: 'T6_MEAT', nombre: 'Carne de carnero' },
      { id: 'T7_MEAT', nombre: 'Carne de cerdo' },
      { id: 'T8_MEAT', nombre: 'Carne de ternera' },
    ],
  },
  {
    grupo: 'Productos animales',
    items: [
      { id: 'T3_EGG', nombre: 'Huevos de gallina' },
      { id: 'T5_EGG', nombre: 'Huevos de ganso' },
      { id: 'T4_MILK', nombre: 'Leche de cabra' },
      { id: 'T6_MILK', nombre: 'Leche de oveja' },
      { id: 'T8_MILK', nombre: 'Leche de vaca' },
    ],
  },
  {
    grupo: 'Cocinados / refinados',
    items: [
      { id: 'T3_FLOUR', nombre: 'Harina' },
      { id: 'T4_BREAD', nombre: 'Pan' },
      { id: 'T4_BUTTER', nombre: 'Manteca de cabra' },
      { id: 'T6_BUTTER', nombre: 'Manteca de oveja' },
      { id: 'T8_BUTTER', nombre: 'Manteca de vaca' },
    ],
  },
  {
    grupo: 'Salsas (para encantar platillos)',
    items: [
      { id: 'T1_FISHSAUCE_LEVEL1', nombre: 'Salsa básica (.1)' },
      { id: 'T1_FISHSAUCE_LEVEL2', nombre: 'Salsa extravagante (.2)' },
      { id: 'T1_FISHSAUCE_LEVEL3', nombre: 'Salsa especial (.3)' },
    ],
  },
];

/** Nombre legible de un recurso por su id (cae al id si no está en la lista). */
const NAME_BY_ID: Record<string, string> = Object.fromEntries(
  RESOURCE_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.nombre])),
);

export function resourceNombre(id: string): string {
  return NAME_BY_ID[id] ?? id;
}

/** Claves antiguas (un solo produce) -> id de item, para migrar perfiles viejos. */
const LEGACY_KEY_TO_ID: Record<string, string> = {
  pan: 'T4_BREAD',
  ternera: 'T8_MEAT',
  calabaza: 'T8_PUMPKIN',
  trigo: 'T3_WHEAT',
};

/**
 * Normaliza lo que haya en especializaciones a una lista de ids:
 *  - produces: ['T8_MEAT', ...]  (formato nuevo)
 *  - produce: 'ternera' | 'T8_MEAT'  (formato viejo o id suelto)
 */
export function normalizeProduces(esp: unknown): string[] {
  const e = (esp ?? {}) as { produces?: unknown; produce?: unknown };
  if (Array.isArray(e.produces)) {
    return e.produces.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  const single = typeof e.produce === 'string' ? e.produce : '';
  if (!single) return [];
  return [LEGACY_KEY_TO_ID[single] ?? single];
}
