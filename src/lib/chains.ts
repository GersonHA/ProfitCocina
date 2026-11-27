/**
 * Cadenas de producción por recurso. Es solo una capa de GUÍA: cada paso
 * pre-rellena un lote (processes) o una compra de mercado. El motor y el Kardex
 * no cambian.
 *
 * Las cadenas se generan desde tablas con los IDs reales del juego
 * (ao-bin-dumps). El selector de /cadena mapea el item producido -> su cadena
 * mediante CHAIN_KEY_BY_ITEM.
 *
 * Modelo (según los datos del juego):
 *  - Cultivo:  semilla -> cosecha.
 *  - Carne:    cría -> adulto -> carne (Carnicero).  (TX_MEAT = 1x TX_..._GROWN)
 *  - Leche/Huevos: el adulto los produce (Pastura).
 *  - Mantequilla:  leche -> mantequilla (Cocina).    (TX_BUTTER = 1x TX_MILK)
 *  - Pan:      semilla -> trigo -> harina -> pan.
 * La comida de los animales es flexible (cualquier cultivo, por nutrición), así
 * que no se fija aquí: su costo se registra como silver en el paso de cría.
 */

export type StepKind = 'comprar' | 'cosechar' | 'criar' | 'refinar' | 'cocinar';

export interface ChainStep {
  id: string;
  label: string;
  kind: StepKind;
  /** processes.type para los pasos que no son 'comprar'. */
  processType: 'siembra' | 'cria' | 'refinado' | 'cocina';
  station?: string;
  inputItem?: string;
  outputItem: string;
  subproductItem?: string;
  feedItem?: string;
}

export interface Chain {
  resource: string;
  /** Items del flujo, en orden, para dibujar la cadena. */
  nodes: string[];
  steps: ChainStep[];
}

// --- Generadores de cadenas ---

function cropChain(key: string, seed: string, crop: string): Chain {
  return {
    resource: key,
    nodes: [seed, crop],
    steps: [
      { id: 'comprar-semilla', label: 'Comprar semillas', kind: 'comprar', processType: 'siembra', outputItem: seed },
      { id: 'cosechar', label: 'Cosechar', kind: 'cosechar', processType: 'siembra', inputItem: seed, outputItem: crop, subproductItem: seed },
    ],
  };
}

function meatChain(key: string, baby: string, grown: string, meat: string): Chain {
  return {
    resource: key,
    nodes: [baby, grown, meat],
    steps: [
      { id: 'comprar-cria', label: 'Comprar crías', kind: 'comprar', processType: 'cria', outputItem: baby },
      { id: 'criar', label: 'Criar hasta adulto', kind: 'criar', processType: 'cria', inputItem: baby, outputItem: grown },
      { id: 'carnear', label: 'Carnear (Carnicero)', kind: 'refinar', processType: 'refinado', station: 'Carnicero', inputItem: grown, outputItem: meat },
    ],
  };
}

function productChain(key: string, baby: string, grown: string, product: string, label: string): Chain {
  return {
    resource: key,
    nodes: [baby, grown, product],
    steps: [
      { id: 'comprar-cria', label: 'Comprar crías', kind: 'comprar', processType: 'cria', outputItem: baby },
      { id: 'criar', label: 'Criar hasta adulto', kind: 'criar', processType: 'cria', inputItem: baby, outputItem: grown },
      { id: 'recolectar', label, kind: 'refinar', processType: 'refinado', station: 'Pastura', inputItem: grown, outputItem: product },
    ],
  };
}

function butterChain(key: string, baby: string, grown: string, milk: string, butter: string): Chain {
  return {
    resource: key,
    nodes: [baby, grown, milk, butter],
    steps: [
      { id: 'comprar-cria', label: 'Comprar crías', kind: 'comprar', processType: 'cria', outputItem: baby },
      { id: 'criar', label: 'Criar hasta adulto', kind: 'criar', processType: 'cria', inputItem: baby, outputItem: grown },
      { id: 'ordenar', label: 'Ordeñar', kind: 'refinar', processType: 'refinado', station: 'Pastura', inputItem: grown, outputItem: milk },
      { id: 'batir', label: 'Batir mantequilla (Cocina)', kind: 'refinar', processType: 'refinado', station: 'Cocina', inputItem: milk, outputItem: butter },
    ],
  };
}

// --- Tablas de recursos (IDs reales del juego) ---

// [clave, semilla, cultivo]
const CROPS: [string, string, string][] = [
  ['T1_CARROT', 'T1_FARM_CARROT_SEED', 'T1_CARROT'],
  ['T2_BEAN', 'T2_FARM_BEAN_SEED', 'T2_BEAN'],
  ['T3_WHEAT', 'T3_FARM_WHEAT_SEED', 'T3_WHEAT'],
  ['T4_TURNIP', 'T4_FARM_TURNIP_SEED', 'T4_TURNIP'],
  ['T5_CABBAGE', 'T5_FARM_CABBAGE_SEED', 'T5_CABBAGE'],
  ['T6_POTATO', 'T6_FARM_POTATO_SEED', 'T6_POTATO'],
  ['T7_CORN', 'T7_FARM_CORN_SEED', 'T7_CORN'],
  ['calabaza', 'T8_FARM_PUMPKIN_SEED', 'T8_PUMPKIN'], // clave legado
];

// [clave, cría, adulto, carne]
const MEATS: [string, string, string, string][] = [
  ['T3_MEAT', 'T3_FARM_CHICKEN_BABY', 'T3_FARM_CHICKEN_GROWN', 'T3_MEAT'],
  ['T4_MEAT', 'T4_FARM_GOAT_BABY', 'T4_FARM_GOAT_GROWN', 'T4_MEAT'],
  ['T5_MEAT', 'T5_FARM_GOOSE_BABY', 'T5_FARM_GOOSE_GROWN', 'T5_MEAT'],
  ['T6_MEAT', 'T6_FARM_SHEEP_BABY', 'T6_FARM_SHEEP_GROWN', 'T6_MEAT'],
  ['T7_MEAT', 'T7_FARM_PIG_BABY', 'T7_FARM_PIG_GROWN', 'T7_MEAT'],
  ['ternera', 'T8_FARM_COW_BABY', 'T8_FARM_COW_GROWN', 'T8_MEAT'], // clave legado
];

// [clave, cría, adulto, leche]
const MILKS: [string, string, string, string][] = [
  ['T4_MILK', 'T4_FARM_GOAT_BABY', 'T4_FARM_GOAT_GROWN', 'T4_MILK'],
  ['T6_MILK', 'T6_FARM_SHEEP_BABY', 'T6_FARM_SHEEP_GROWN', 'T6_MILK'],
  ['T8_MILK', 'T8_FARM_COW_BABY', 'T8_FARM_COW_GROWN', 'T8_MILK'],
];

// [clave, cría, adulto, huevos]
const EGGS: [string, string, string, string][] = [
  ['T3_EGG', 'T3_FARM_CHICKEN_BABY', 'T3_FARM_CHICKEN_GROWN', 'T3_EGG'],
  ['T5_EGG', 'T5_FARM_GOOSE_BABY', 'T5_FARM_GOOSE_GROWN', 'T5_EGG'],
];

// [clave, cría, adulto, leche, mantequilla]
const BUTTERS: [string, string, string, string, string][] = [
  ['T4_BUTTER', 'T4_FARM_GOAT_BABY', 'T4_FARM_GOAT_GROWN', 'T4_MILK', 'T4_BUTTER'],
  ['T6_BUTTER', 'T6_FARM_SHEEP_BABY', 'T6_FARM_SHEEP_GROWN', 'T6_MILK', 'T6_BUTTER'],
  ['T8_BUTTER', 'T8_FARM_COW_BABY', 'T8_FARM_COW_GROWN', 'T8_MILK', 'T8_BUTTER'],
];

const CHAINS: Record<string, Chain> = {
  // Pan: cadena especial (trigo -> harina -> pan).
  pan: {
    resource: 'pan',
    nodes: ['T3_FARM_WHEAT_SEED', 'T3_WHEAT', 'T3_FLOUR', 'T4_BREAD'],
    steps: [
      { id: 'comprar-semilla', label: 'Comprar semillas', kind: 'comprar', processType: 'siembra', outputItem: 'T3_FARM_WHEAT_SEED' },
      { id: 'cosechar-trigo', label: 'Cosechar trigo', kind: 'cosechar', processType: 'siembra', inputItem: 'T3_FARM_WHEAT_SEED', outputItem: 'T3_WHEAT', subproductItem: 'T3_FARM_WHEAT_SEED' },
      { id: 'refinar-harina', label: 'Refinar harina (Molino)', kind: 'refinar', processType: 'refinado', station: 'Molino', inputItem: 'T3_WHEAT', outputItem: 'T3_FLOUR' },
      { id: 'hornear-pan', label: 'Hornear pan (Cocina)', kind: 'cocinar', processType: 'cocina', station: 'Cocina', inputItem: 'T3_FLOUR', outputItem: 'T4_BREAD' },
    ],
  },
};

for (const [key, seed, crop] of CROPS) CHAINS[key] = cropChain(key, seed, crop);
for (const [key, baby, grown, meat] of MEATS) CHAINS[key] = meatChain(key, baby, grown, meat);
for (const [key, baby, grown, milk] of MILKS) CHAINS[key] = productChain(key, baby, grown, milk, 'Ordeñar');
for (const [key, baby, grown, egg] of EGGS) CHAINS[key] = productChain(key, baby, grown, egg, 'Recolectar huevos');
for (const [key, baby, grown, milk, butter] of BUTTERS) CHAINS[key] = butterChain(key, baby, grown, milk, butter);

export function getChain(key: string | null | undefined): Chain | null {
  if (!key) return null;
  return CHAINS[key] ?? null;
}

/**
 * Item producido -> clave de su cadena. Para los 3 recursos "legado" (pan,
 * calabaza, ternera) se mantiene la clave antigua para no romper lotes ya
 * guardados; el resto usa su propio item_id como clave.
 */
export const CHAIN_KEY_BY_ITEM: Record<string, string> = {
  T4_BREAD: 'pan',
  T8_PUMPKIN: 'calabaza',
  T8_MEAT: 'ternera',
};
for (const [key, , crop] of CROPS) if (!(crop in CHAIN_KEY_BY_ITEM)) CHAIN_KEY_BY_ITEM[crop] = key;
for (const [key, , , meat] of MEATS) if (!(meat in CHAIN_KEY_BY_ITEM)) CHAIN_KEY_BY_ITEM[meat] = key;
for (const [key, , , milk] of MILKS) CHAIN_KEY_BY_ITEM[milk] = key;
for (const [key, , , egg] of EGGS) CHAIN_KEY_BY_ITEM[egg] = key;
for (const [key, , , , butter] of BUTTERS) CHAIN_KEY_BY_ITEM[butter] = key;
