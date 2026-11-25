/**
 * Tipos del motor de costos — Kardex valorizado por promedio ponderado móvil.
 *
 * Este módulo es PURO: no toca el DOM ni la base de datos. Se usa igual en el
 * navegador (SvelteKit) y en las Edge Functions (Deno), y es lo que prueban los
 * Tests A–D. La correctitud contable vive aquí, en un solo lugar.
 *
 * Idea central (event sourcing contable):
 *   eventos de dominio  ->  movimientos de Kardex  ->  saldos
 * El motor es un "reducer": consume eventos en orden cronológico y produce los
 * movimientos con su saldo resultante. Editar un evento viejo = volver a correr
 * el motor desde cero (o desde ese punto) para recalcular hacia adelante.
 */

/** Silver. Internamente se guarda con precisión completa; el redondeo es solo visual. */
export type Silver = number;

/**
 * Saldo de un par (usuario, item) en un momento dado.
 * El costo promedio NO se almacena: se deriva `value / qty` para no arrastrar
 * errores de redondeo (el valor total es la fuente de verdad, igual que en un
 * Kardex valorizado real).
 */
export interface Balance {
  qty: number;
  value: Silver;
}

/** Tipo de cada movimiento del Kardex. */
export type MovementType =
  | 'entrada_produccion' // sale de un proceso (producto principal o subproducto)
  | 'salida_produccion'  // se consume como entrada de un proceso
  | 'compra_miembro'     // le compraste a otro miembro del grupo
  | 'venta_miembro'      // le vendiste a otro miembro del grupo
  | 'compra_mercado'     // compraste en el mercado
  | 'venta_mercado'      // vendiste en el mercado
  | 'ajuste';            // conteo, pérdida, consumo propio, etc.

/** Una línea del Kardex, con el saldo resultante ya calculado. */
export interface Movement {
  userId: string;
  itemId: string;
  ts: string;          // 'YYYY-MM-DD' o ISO; ordena junto con `seq`
  seq: number;         // desempate dentro del mismo `ts`
  type: MovementType;
  qty: number;         // + entrada, − salida
  unitCost: Silver;    // costo unitario de ESTE movimiento
  totalCost: Silver;   // qty * unitCost (con signo)
  balQty: number;      // saldo de cantidad tras el movimiento
  balAvgCost: Silver;  // saldo de costo promedio tras el movimiento
  balValue: Silver;    // saldo de valor total tras el movimiento
  sourceType: string;  // de qué registro de dominio salió (process, member_trade, …)
  sourceId: string;    // id de ese registro
}

/** Todo evento se ordena por (ts, seq). */
export interface Ordered {
  id: string;
  ts: string;
  seq: number;
}

export type OutputRole = 'principal' | 'subproducto';

export interface ProcessInput {
  itemId: string;
  qty: number;
}

export interface ProcessOutput {
  itemId: string;
  qty: number;
  role: OutputRole;
  /**
   * Costo unitario del subproducto. Si se omite, se valoriza al promedio
   * vigente de ese item en el inventario, o al precio de mercado si no hay
   * stock previo (§4.3 del documento del proyecto).
   */
  valuation?: Silver;
}

/**
 * Un LOTE: entradas (se descuentan a costo promedio) + gastos en silver →
 * salidas (producto principal y subproductos). El costo del proceso se asigna
 * a las salidas principales; los subproductos reducen ese costo.
 */
export interface ProcessEvent extends Ordered {
  kind: 'process';
  userId: string;
  type: string; // siembra | cria | refinado | cocina | …
  inputs: ProcessInput[];
  expenses: Silver; // semillas, estación, transporte, otros (en silver)
  outputs: ProcessOutput[];
}

/** Compra/venta entre dos miembros del grupo. */
export interface MemberTradeEvent extends Ordered {
  kind: 'member_trade';
  sellerId: string;
  buyerId: string;
  itemId: string;
  qty: number;
  priceUnit: Silver; // precio pagado por unidad (sugerido: costo promedio del vendedor)
}

/** Compra o venta en el mercado. */
export interface MarketTxnEvent extends Ordered {
  kind: 'market_txn';
  userId: string;
  itemId: string;
  qty: number;
  priceUnit: Silver;
  direction: 'buy' | 'sell';
}

/** Ajuste de stock (conteo, pérdida, consumo propio…). Lleva motivo obligatorio. */
export interface AdjustmentEvent extends Ordered {
  kind: 'adjustment';
  userId: string;
  itemId: string;
  qtyDelta: number;   // +/−; si > 0 entra, si < 0 sale
  unitCost?: Silver;  // solo para deltas positivos sin stock previo
  reason: string;
}

export type LedgerEvent =
  | ProcessEvent
  | MemberTradeEvent
  | MarketTxnEvent
  | AdjustmentEvent;

/** Un intento de salida que dejaría el stock en negativo (no permitido, §4.4). */
export interface EngineError {
  eventId: string;
  userId: string;
  itemId: string;
  message: string;
  requested: number;
  available: number;
}

export interface EngineOptions {
  /** Precio de mercado de respaldo para valorizar entradas sin costo conocido. */
  marketPrice?: (itemId: string, userId: string) => number | undefined;
  /** Tolerancia para comparaciones de punto flotante (por defecto 1e-6). */
  epsilon?: number;
  /** Si es true, lanza al detectar stock negativo en lugar de acumular el error. */
  strict?: boolean;
}

export interface EngineResult {
  movements: Movement[];
  /** Saldo final por clave `${userId}::${itemId}`. */
  balances: Record<string, Balance>;
  errors: EngineError[];
}
