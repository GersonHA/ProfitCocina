/**
 * Cadenas de producción por recurso. Es solo una capa de GUÍA: cada paso
 * pre-rellena un lote (processes) o una compra de mercado. El motor y el Kardex
 * no cambian.
 *
 * La clave de cada cadena es el valor de profiles.especializaciones.produce
 * ('pan', 'calabaza', 'ternera'…).
 */

export type StepKind = 'comprar' | 'cosechar' | 'criar' | 'refinar' | 'cocinar';

export interface ChainStep {
  id: string;
  label: string;
  kind: StepKind;
  /** processes.type para los pasos que no son 'comprar'. */
  processType: 'siembra' | 'cria' | 'refinado' | 'cocina';
  station?: string; // Mill | Cook | Butcher
  inputItem?: string; // item que se consume
  outputItem: string; // producto principal (o la semilla/cría que se compra)
  subproductItem?: string; // p. ej. semillas devueltas al cosechar
  feedItem?: string; // comida que se consume para criar (p. ej. calabaza para las vacas)
}

export interface Chain {
  resource: string;
  /** Items del flujo, en orden, para dibujar la cadena. */
  nodes: string[];
  steps: ChainStep[];
}

const CHAINS: Record<string, Chain> = {
  pan: {
    resource: 'pan',
    nodes: ['T3_FARM_WHEAT_SEED', 'T3_WHEAT', 'T3_FLOUR', 'T4_BREAD'],
    steps: [
      { id: 'comprar-semillas', label: 'Comprar semillas', kind: 'comprar', processType: 'siembra', outputItem: 'T3_FARM_WHEAT_SEED' },
      {
        id: 'cosechar-trigo', label: 'Cosechar trigo', kind: 'cosechar', processType: 'siembra',
        inputItem: 'T3_FARM_WHEAT_SEED', outputItem: 'T3_WHEAT', subproductItem: 'T3_FARM_WHEAT_SEED',
      },
      { id: 'refinar-harina', label: 'Refinar harina', kind: 'refinar', processType: 'refinado', station: 'Mill', inputItem: 'T3_WHEAT', outputItem: 'T3_FLOUR' },
      { id: 'hornear-pan', label: 'Hornear pan', kind: 'cocinar', processType: 'cocina', station: 'Cook', inputItem: 'T3_FLOUR', outputItem: 'T4_BREAD' },
    ],
  },

  calabaza: {
    resource: 'calabaza',
    nodes: ['T8_FARM_PUMPKIN_SEED', 'T8_PUMPKIN'],
    steps: [
      { id: 'comprar-semillas', label: 'Comprar semillas', kind: 'comprar', processType: 'siembra', outputItem: 'T8_FARM_PUMPKIN_SEED' },
      {
        id: 'cosechar-calabaza', label: 'Cosechar calabaza', kind: 'cosechar', processType: 'siembra',
        inputItem: 'T8_FARM_PUMPKIN_SEED', outputItem: 'T8_PUMPKIN', subproductItem: 'T8_FARM_PUMPKIN_SEED',
      },
    ],
  },

  ternera: {
    resource: 'ternera',
    nodes: ['T8_FARM_COW_BABY', 'T8_FARM_COW_GROWN', 'T8_MEAT'],
    steps: [
      { id: 'comprar-ternero', label: 'Comprar terneros', kind: 'comprar', processType: 'cria', outputItem: 'T8_FARM_COW_BABY' },
      { id: 'criar-vaca', label: 'Criar vacas', kind: 'criar', processType: 'cria', inputItem: 'T8_FARM_COW_BABY', outputItem: 'T8_FARM_COW_GROWN', feedItem: 'T8_PUMPKIN' },
      { id: 'carnear', label: 'Carnear (Butcher)', kind: 'refinar', processType: 'refinado', station: 'Butcher', inputItem: 'T8_FARM_COW_GROWN', outputItem: 'T8_MEAT' },
    ],
  },
};

export function getChain(produce: string | null | undefined): Chain | null {
  if (!produce) return null;
  return CHAINS[produce] ?? null;
}
