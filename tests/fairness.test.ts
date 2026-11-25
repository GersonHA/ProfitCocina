/**
 * Tests A, B y C (§7 del documento) — análisis de justicia.
 * Reproducen los escenarios con los números exactos del documento.
 */

import { describe, expect, it } from 'vitest';
import {
  compareModels,
  computeModel,
  type MemberResult,
  type PeriodData,
} from '../src/lib/fairness';

function byId(members: MemberResult[]): Record<string, MemberResult> {
  return Object.fromEntries(members.map((m) => [m.memberId, m]));
}

// Receta: 1 tanda de guiso (10) = 36 pan + 36 calabaza + 72 ternera.
const RECETA = [
  { resource: 'pan', qty: 36 },
  { resource: 'calabaza', qty: 36 },
  { resource: 'ternera', qty: 72 },
];

describe('Test A — compra a costo, 3 miembros, 1 tanda cada uno', () => {
  // Costos para 3 tandas: pan 300k/108, calabaza 300k/108, ternera 700k/216.
  const costPan = 300_000 / 108;
  const costCal = 300_000 / 108;
  const costTer = 700_000 / 216;

  function escenario(revenueGuiso: number): PeriodData {
    return {
      members: [
        { id: 'G', resource: 'pan' },
        { id: 'A', resource: 'ternera' },
        { id: 'B', resource: 'calabaza' },
      ],
      resources: [
        { key: 'pan', producerId: 'G', unitCost: costPan, marketPrice: 1.5 * costPan },
        { key: 'calabaza', producerId: 'B', unitCost: costCal, marketPrice: 1.5 * costCal },
        { key: 'ternera', producerId: 'A', unitCost: costTer, marketPrice: 1.5 * costTer },
      ],
      meals: ['G', 'A', 'B'].map((id) => ({ memberId: id, revenue: revenueGuiso, otherCost: 0, ingredients: RECETA })),
    };
  }

  it('guiso a 750k: todos ganan ~316.7k; solo da G 150k, B 150k, A 350k; A sale ❌', () => {
    const m = byId(computeModel(escenario(750_000), 'costo').members);

    expect(m.G.dealProfit).toBeCloseTo(316_666.67, 1);
    expect(m.A.dealProfit).toBeCloseTo(316_666.67, 1);
    expect(m.B.dealProfit).toBeCloseTo(316_666.67, 1);

    expect(m.G.soloProfit).toBeCloseTo(150_000, 1);
    expect(m.B.soloProfit).toBeCloseTo(150_000, 1);
    expect(m.A.soloProfit).toBeCloseTo(350_000, 1);

    expect(m.G.fair).toBe(true);
    expect(m.B.fair).toBe(true);
    expect(m.A.fair).toBe(false);

    expect(m.G.diff).toBeCloseTo(166_666.67, 1);
    expect(m.A.diff).toBeCloseTo(-33_333.33, 1);
  });

  it('guiso a 900k: todos ~466.7k; ahora A sale ✅ (+116.7k)', () => {
    const m = byId(computeModel(escenario(900_000), 'costo').members);
    expect(m.G.dealProfit).toBeCloseTo(466_666.67, 1);
    expect(m.A.fair).toBe(true);
    expect(m.A.diff).toBeCloseTo(116_666.67, 1);
  });
});

describe('Test B — margen cedido por cantidades (saldo de favores)', () => {
  // Margen de 100 por unidad para los tres recursos (market - cost = 100).
  const data: PeriodData = {
    members: [
      { id: 'G', resource: 'pan' },
      { id: 'A', resource: 'ternera' },
      { id: 'B', resource: 'calabaza' },
    ],
    resources: [
      { key: 'pan', producerId: 'G', unitCost: 100, marketPrice: 200 },
      { key: 'calabaza', producerId: 'B', unitCost: 100, marketPrice: 200 },
      { key: 'ternera', producerId: 'A', unitCost: 100, marketPrice: 200 },
    ],
    meals: ['G', 'A', 'B'].map((id) => ({ memberId: id, revenue: 0, otherCost: 0, ingredients: RECETA })),
  };

  it('saldo de favores: G +3600, B +3600, A −7200', () => {
    const m = byId(computeModel(data, 'costo').members);
    expect(m.G.favorBalance).toBeCloseTo(3600, 6);
    expect(m.B.favorBalance).toBeCloseTo(3600, 6);
    expect(m.A.favorBalance).toBeCloseTo(-7200, 6);
    // Unidades entregadas / recibidas (vía el margen de 100 por unidad).
    expect(m.G.marginCeded).toBeCloseTo(7200, 6); // 72 panes
    expect(m.G.marginReceived).toBeCloseTo(10_800, 6); // 108 unidades
    expect(m.A.marginCeded).toBeCloseTo(14_400, 6); // 144 terneras
  });

  it('modelo 4 (compensación): G paga 3600 a A y B paga 3600 a A', () => {
    const r = computeModel(data, 'compensacion');
    const s = r.settlements ?? [];
    expect(s).toHaveLength(2);
    expect(s).toContainEqual({ from: 'G', to: 'A', amount: 3600 });
    expect(s).toContainEqual({ from: 'B', to: 'A', amount: 3600 });
  });
});

describe('Test C — pozo común (modelo 5)', () => {
  // 1 pan + 1 calabaza + 2 terneras -> 1 comida. Sin impuestos ni RRR.
  function escenario(revenue: number): PeriodData {
    return {
      members: [
        { id: 'G', resource: 'pan' },
        { id: 'B', resource: 'calabaza' },
        { id: 'A', resource: 'ternera' },
      ],
      resources: [
        { key: 'pan', producerId: 'G', unitCost: 100, marketPrice: 200 },
        { key: 'calabaza', producerId: 'B', unitCost: 200, marketPrice: 300 },
        { key: 'ternera', producerId: 'A', unitCost: 150, marketPrice: 250 }, // 2u: costo 300, mercado 500
      ],
      meals: [
        {
          memberId: 'G',
          revenue,
          otherCost: 0,
          ingredients: [
            { resource: 'pan', qty: 1 },
            { resource: 'calabaza', qty: 1 },
            { resource: 'ternera', qty: 2 },
          ],
        },
      ],
    };
  }

  it('venta en 1500: ganancias G 200, B 250, A 450', () => {
    const r = computeModel(escenario(1500), 'pozo_comun');
    const m = byId(r.members);
    expect(m.G.dealProfit).toBeCloseTo(200, 6);
    expect(m.B.dealProfit).toBeCloseTo(250, 6);
    expect(m.A.dealProfit).toBeCloseTo(450, 6);
    expect(r.alert).toBeUndefined();
  });

  it('venta en 900: ganancias G 80, B 70, A 150 + alerta de vender sueltos', () => {
    const r = computeModel(escenario(900), 'pozo_comun');
    const m = byId(r.members);
    expect(m.G.dealProfit).toBeCloseTo(80, 6);
    expect(m.B.dealProfit).toBeCloseTo(70, 6);
    expect(m.A.dealProfit).toBeCloseTo(150, 6);
    expect(r.alert).toBeTruthy();
  });
});

describe('Comparador de modelos', () => {
  it('recomienda el modelo más simple que deja a todos con ✅', () => {
    // Escenario del Test A a 750k: con costo, A sale ❌; algún modelo debería arreglarlo.
    const costPan = 300_000 / 108;
    const costTer = 700_000 / 216;
    const data: PeriodData = {
      members: [
        { id: 'G', resource: 'pan' },
        { id: 'A', resource: 'ternera' },
        { id: 'B', resource: 'calabaza' },
      ],
      resources: [
        { key: 'pan', producerId: 'G', unitCost: costPan, marketPrice: 1.5 * costPan },
        { key: 'calabaza', producerId: 'B', unitCost: costPan, marketPrice: 1.5 * costPan },
        { key: 'ternera', producerId: 'A', unitCost: costTer, marketPrice: 1.5 * costTer },
      ],
      meals: ['G', 'A', 'B'].map((id) => ({ memberId: id, revenue: 750_000, otherCost: 0, ingredients: RECETA })),
    };
    const { models, recommended } = compareModels(data);
    expect(models).toHaveLength(5);
    // El modelo de costo puro deja a A con ❌.
    expect(models[0]!.allFair).toBe(false);
    // Debe existir una recomendación (algún modelo deja a todos ✅).
    expect(recommended).not.toBeNull();
  });
});
