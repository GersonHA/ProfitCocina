/**
 * Test D — Cadena de pan de Gerson y Kardex valorizado.
 *
 * Reproduce, con los números del documento del proyecto (§7, Test D), toda la
 * cadena siembra → harina → pan, el promedio ponderado móvil, la venta a un
 * miembro (que NO cambia el promedio), el subproducto (que baja el costo del
 * principal) y el ajuste por conteo (que tampoco cambia el promedio).
 *
 * El motor guarda precisión completa; aquí comparamos los costos unitarios
 * redondeados a 2 decimales, que es como aparecen en el documento.
 */

import { describe, expect, it } from 'vitest';
import { avgOf, round2, runEngine, type LedgerEvent, type Movement } from '../src/lib/core/index';

/** Busca la entrada de producción (salida de un proceso) de un item. */
function entrada(movements: Movement[], itemId: string): Movement {
  const m = movements.find((x) => x.itemId === itemId && x.type === 'entrada_produccion');
  if (!m) throw new Error(`No hay entrada_produccion para ${itemId}`);
  return m;
}

describe('Test D — cadena de pan y Kardex', () => {
  it('D.1 — la cadena siembra → harina → pan arrastra el costo y conserva el valor', () => {
    const events: LedgerEvent[] = [
      {
        kind: 'process', id: 'p1', ts: '2026-01-01', seq: 1, userId: 'G', type: 'siembra',
        inputs: [], expenses: 250_000,
        outputs: [{ itemId: 'trigo', qty: 1500, role: 'principal' }],
      },
      {
        kind: 'process', id: 'p2', ts: '2026-01-02', seq: 1, userId: 'G', type: 'refinado',
        inputs: [{ itemId: 'trigo', qty: 1500 }], expenses: 15_000,
        outputs: [{ itemId: 'harina', qty: 1800, role: 'principal' }],
      },
      {
        kind: 'process', id: 'p3', ts: '2026-01-03', seq: 1, userId: 'G', type: 'cocina',
        inputs: [{ itemId: 'harina', qty: 1800 }], expenses: 12_000,
        outputs: [{ itemId: 'pan', qty: 2100, role: 'principal' }],
      },
    ];

    const r = runEngine(events);
    expect(r.errors).toHaveLength(0);

    // Trigo = 250.000 ÷ 1.500 = 166,67
    expect(round2(entrada(r.movements, 'trigo').unitCost)).toBe(166.67);

    // Harina = (250.000 + 15.000) ÷ 1.800 = 147,22 ; el valor se conserva en 265.000
    const harina = entrada(r.movements, 'harina');
    expect(round2(harina.unitCost)).toBe(147.22);
    expect(harina.balValue).toBeCloseTo(265_000, 4);

    // Pan = (265.000 + 12.000) ÷ 2.100 = 131,90 ; valor 277.000
    const pan = entrada(r.movements, 'pan');
    expect(round2(pan.unitCost)).toBe(131.90);
    expect(pan.balValue).toBeCloseTo(277_000, 4);

    // El trigo y la harina quedaron totalmente consumidos.
    expect(r.balances['G::trigo']?.qty).toBe(0);
    expect(r.balances['G::harina']?.qty).toBe(0);
    expect(r.balances['G::pan']?.qty).toBe(2100);
  });

  it('D.2 — promedio ponderado: 300 panes a 131,90 + 2.000 a 140 = 138,94', () => {
    const panCost = 277_000 / 2100; // 131,9047…
    const events: LedgerEvent[] = [
      { kind: 'market_txn', id: 'm1', ts: '2026-01-01', seq: 1, userId: 'W', itemId: 'pan', qty: 300, priceUnit: panCost, direction: 'buy' },
      { kind: 'market_txn', id: 'm2', ts: '2026-01-02', seq: 1, userId: 'W', itemId: 'pan', qty: 2000, priceUnit: 140, direction: 'buy' },
    ];
    const r = runEngine(events);
    expect(r.errors).toHaveLength(0);
    expect(r.balances['W::pan']?.qty).toBe(2300);
    expect(round2(avgOf(r.balances['W::pan']!))).toBe(138.94);
  });

  it('D.3 — vender 36 panes a un miembro no cambia el promedio', () => {
    const panCost = 277_000 / 2100;
    const events: LedgerEvent[] = [
      { kind: 'market_txn', id: 'm1', ts: '2026-01-01', seq: 1, userId: 'W', itemId: 'pan', qty: 300, priceUnit: panCost, direction: 'buy' },
      { kind: 'market_txn', id: 'm2', ts: '2026-01-02', seq: 1, userId: 'W', itemId: 'pan', qty: 2000, priceUnit: 140, direction: 'buy' },
      { kind: 'member_trade', id: 't1', ts: '2026-01-03', seq: 1, sellerId: 'W', buyerId: 'A', itemId: 'pan', qty: 36, priceUnit: 138.9441 },
    ];
    const r = runEngine(events);
    expect(r.errors).toHaveLength(0);

    // La venta se valoriza al promedio vigente (138,94).
    const venta = r.movements.find((m) => m.type === 'venta_miembro');
    expect(round2(venta!.unitCost)).toBe(138.94);

    // Saldo del vendedor: 2.300 − 36 = 2.264, con el mismo promedio.
    expect(r.balances['W::pan']?.qty).toBe(2264);
    expect(round2(avgOf(r.balances['W::pan']!))).toBe(138.94);

    // El comprador recibe 36 panes al precio pagado.
    expect(r.balances['A::pan']?.qty).toBe(36);
    expect(round2(avgOf(r.balances['A::pan']!))).toBe(138.94);
  });

  it('D.4 — el subproducto (100 semillas a 50) baja el costo del trigo a 163,33', () => {
    const events: LedgerEvent[] = [
      {
        kind: 'process', id: 'p1', ts: '2026-01-01', seq: 1, userId: 'S', type: 'siembra',
        inputs: [], expenses: 250_000,
        outputs: [
          { itemId: 'trigo', qty: 1500, role: 'principal' },
          { itemId: 'semilla', qty: 100, role: 'subproducto', valuation: 50 },
        ],
      },
    ];
    const r = runEngine(events);
    expect(r.errors).toHaveLength(0);

    // Trigo = (250.000 − 5.000) ÷ 1.500 = 163,33
    expect(round2(entrada(r.movements, 'trigo').unitCost)).toBe(163.33);

    // Las semillas entran al inventario a 50 c/u.
    expect(r.balances['S::semilla']?.qty).toBe(100);
    expect(round2(avgOf(r.balances['S::semilla']!))).toBe(50);
  });

  it('D.5 — el ajuste por conteo (−14) no cambia el promedio', () => {
    const events: LedgerEvent[] = [
      { kind: 'market_txn', id: 'm1', ts: '2026-01-01', seq: 1, userId: 'J', itemId: 'pan', qty: 2264, priceUnit: 138.9441, direction: 'buy' },
      { kind: 'adjustment', id: 'a1', ts: '2026-01-02', seq: 1, userId: 'J', itemId: 'pan', qtyDelta: -14, reason: 'conteo' },
    ];
    const r = runEngine(events);
    expect(r.errors).toHaveLength(0);
    expect(r.balances['J::pan']?.qty).toBe(2250);
    expect(round2(avgOf(r.balances['J::pan']!))).toBe(138.94);
  });

  it('D.6 — no se permite stock negativo: queda registrado como error', () => {
    const events: LedgerEvent[] = [
      { kind: 'market_txn', id: 'm1', ts: '2026-01-01', seq: 1, userId: 'K', itemId: 'pan', qty: 10, priceUnit: 100, direction: 'buy' },
      { kind: 'market_txn', id: 'm2', ts: '2026-01-02', seq: 1, userId: 'K', itemId: 'pan', qty: 50, priceUnit: 0, direction: 'sell' },
    ];
    const r = runEngine(events);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.itemId).toBe('pan');
    expect(r.errors[0]?.requested).toBe(50);
    expect(r.errors[0]?.available).toBe(10);
  });
});
