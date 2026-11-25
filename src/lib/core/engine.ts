/**
 * Motor de costos — Kardex valorizado por promedio ponderado móvil.
 *
 * `runEngine` es un reducer puro: recibe los eventos de dominio de un grupo (o
 * de un usuario), los ordena por (ts, seq) y los reproduce manteniendo un saldo
 * por cada par (usuario, item). Produce:
 *   - `movements`: una línea de Kardex por cada entrada/salida, con el saldo
 *                  resultante ya calculado (listo para mostrar o exportar).
 *   - `balances` : el saldo final por item.
 *   - `errors`   : intentos de dejar el stock en negativo (no permitido).
 *
 * Regla del promedio ponderado móvil:
 *   - Una ENTRADA suma cantidad y valor; el nuevo promedio = valor / cantidad.
 *   - Una SALIDA se valoriza al promedio vigente, así el promedio no cambia.
 * El valor total es la fuente de verdad; el costo promedio se deriva siempre
 * como value/qty para no arrastrar redondeos a lo largo de la cadena.
 */

import type {
  AdjustmentEvent,
  Balance,
  EngineError,
  EngineOptions,
  EngineResult,
  LedgerEvent,
  MarketTxnEvent,
  MemberTradeEvent,
  Movement,
  MovementType,
  ProcessEvent,
} from './types.ts';

/** Clave única de un saldo. */
export function balanceKey(userId: string, itemId: string): string {
  return `${userId}::${itemId}`;
}

/** Costo promedio vigente de un saldo (0 si no hay stock). */
export function avgOf(bal: Balance): number {
  return bal.qty > 0 ? bal.value / bal.qty : 0;
}

/**
 * Reproduce los eventos y devuelve los movimientos del Kardex, los saldos
 * finales y los errores de stock negativo.
 */
export function runEngine(events: LedgerEvent[], opts: EngineOptions = {}): EngineResult {
  const eps = opts.epsilon ?? 1e-6;
  const balances = new Map<string, Balance>();
  const movements: Movement[] = [];
  const errors: EngineError[] = [];

  const getBal = (userId: string, itemId: string): Balance => {
    const k = balanceKey(userId, itemId);
    let b = balances.get(k);
    if (!b) {
      b = { qty: 0, value: 0 };
      balances.set(k, b);
    }
    return b;
  };

  const record = (
    userId: string,
    itemId: string,
    ev: { ts: string; seq: number; id: string },
    type: MovementType,
    sourceType: string,
    qty: number,
    unitCost: number,
    bal: Balance,
  ): void => {
    movements.push({
      userId,
      itemId,
      ts: ev.ts,
      seq: ev.seq,
      type,
      qty,
      unitCost,
      totalCost: qty * unitCost,
      balQty: bal.qty,
      balAvgCost: avgOf(bal),
      balValue: bal.value,
      sourceType,
      sourceId: ev.id,
    });
  };

  /** Entrada: suma cantidad y valor al costo dado. Devuelve el valor agregado. */
  const applyIn = (
    userId: string,
    itemId: string,
    qty: number,
    unitCost: number,
    ev: { ts: string; seq: number; id: string },
    type: MovementType,
    sourceType: string,
  ): number => {
    const b = getBal(userId, itemId);
    b.qty += qty;
    b.value += qty * unitCost;
    record(userId, itemId, ev, type, sourceType, qty, unitCost, b);
    return qty * unitCost;
  };

  /** Salida: descuenta al promedio vigente. Devuelve el valor consumido. */
  const applyOut = (
    userId: string,
    itemId: string,
    qtyWanted: number,
    ev: { ts: string; seq: number; id: string },
    type: MovementType,
    sourceType: string,
  ): number => {
    const b = getBal(userId, itemId);
    const avg = avgOf(b);
    let qty = qtyWanted;

    if (qty > b.qty + eps) {
      errors.push({
        eventId: ev.id,
        userId,
        itemId,
        message: `Stock negativo en ${itemId}: pide ${qty}, hay ${b.qty}`,
        requested: qty,
        available: b.qty,
      });
      if (opts.strict) {
        throw new Error(`Stock negativo en ${itemId}: pide ${qty}, hay ${b.qty}`);
      }
      // Mejor esfuerzo: consume solo lo disponible para seguir calculando.
      qty = Math.max(0, b.qty);
    }

    b.qty -= qty;
    b.value -= qty * avg;
    // Limpia residuos de punto flotante alrededor de cero.
    if (Math.abs(b.qty) < eps) {
      b.qty = 0;
      b.value = 0;
    }
    record(userId, itemId, ev, type, sourceType, -qty, avg, b);
    return qty * avg;
  };

  const handleProcess = (ev: ProcessEvent): void => {
    // 1. Consumir entradas al promedio vigente.
    let consumed = 0;
    for (const inp of ev.inputs) {
      consumed += applyOut(ev.userId, inp.itemId, inp.qty, ev, 'salida_produccion', 'process');
    }

    // 2. Valorizar subproductos (al valor dado, o al promedio vigente, o al mercado).
    const subs = ev.outputs.filter((o) => o.role === 'subproducto');
    let subValue = 0;
    const resolvedSubs = subs.map((o) => {
      const b = getBal(ev.userId, o.itemId);
      const unit = o.valuation ?? (b.qty > 0 ? avgOf(b) : opts.marketPrice?.(o.itemId, ev.userId) ?? 0);
      subValue += unit * o.qty;
      return { output: o, unit };
    });

    // 3. El costo del proceso se reparte entre las salidas principales.
    const processCost = consumed + ev.expenses - subValue;
    const principals = ev.outputs.filter((o) => o.role === 'principal');
    const principalQty = principals.reduce((s, o) => s + o.qty, 0);
    const principalUnit = principalQty > 0 ? processCost / principalQty : 0;

    // 4. Registrar las salidas (subproductos a su valor, principales al costo repartido).
    for (const { output, unit } of resolvedSubs) {
      applyIn(ev.userId, output.itemId, output.qty, unit, ev, 'entrada_produccion', 'process');
    }
    for (const output of principals) {
      applyIn(ev.userId, output.itemId, output.qty, principalUnit, ev, 'entrada_produccion', 'process');
    }
  };

  const handleTrade = (ev: MemberTradeEvent): void => {
    // El vendedor entrega a su costo promedio; el comprador recibe al precio pagado.
    applyOut(ev.sellerId, ev.itemId, ev.qty, ev, 'venta_miembro', 'member_trade');
    applyIn(ev.buyerId, ev.itemId, ev.qty, ev.priceUnit, ev, 'compra_miembro', 'member_trade');
  };

  const handleMarket = (ev: MarketTxnEvent): void => {
    if (ev.direction === 'buy') {
      applyIn(ev.userId, ev.itemId, ev.qty, ev.priceUnit, ev, 'compra_mercado', 'market_txn');
    } else {
      applyOut(ev.userId, ev.itemId, ev.qty, ev, 'venta_mercado', 'market_txn');
    }
  };

  const handleAdjustment = (ev: AdjustmentEvent): void => {
    if (ev.qtyDelta >= 0) {
      const b = getBal(ev.userId, ev.itemId);
      const unit = ev.unitCost ?? (b.qty > 0 ? avgOf(b) : opts.marketPrice?.(ev.itemId, ev.userId) ?? 0);
      applyIn(ev.userId, ev.itemId, ev.qtyDelta, unit, ev, 'ajuste', 'adjustment');
    } else {
      applyOut(ev.userId, ev.itemId, -ev.qtyDelta, ev, 'ajuste', 'adjustment');
    }
  };

  const sorted = [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.seq - b.seq));
  for (const ev of sorted) {
    switch (ev.kind) {
      case 'process':
        handleProcess(ev);
        break;
      case 'member_trade':
        handleTrade(ev);
        break;
      case 'market_txn':
        handleMarket(ev);
        break;
      case 'adjustment':
        handleAdjustment(ev);
        break;
    }
  }

  return {
    movements,
    balances: Object.fromEntries(balances),
    errors,
  };
}
