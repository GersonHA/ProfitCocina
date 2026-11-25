/**
 * Arma el PeriodData que consume el motor de justicia (src/lib/fairness.ts):
 *  - `buildExample()`  : el escenario del Test A (para ver el comparador ya).
 *  - `buildFromDb()`   : lo construye con los datos reales del grupo.
 *
 * Mapeo de datos reales → modelo de justicia:
 *  - recurso de cada miembro = el item final de su cadena (produce → item).
 *  - costo real = costo promedio del Kardex de ese item.
 *  - precio de mercado neto = último snapshot de precio, menos impuesto.
 *  - comidas = procesos de cocina (ingredientes) + ventas de mercado de la comida.
 */
import { supabase } from '$lib/supabase';
import { PRODUCE } from '$lib/items';
import type { Member, MealInfo, PeriodData, ResourceInfo } from '$lib/fairness';

const TAX = 0.04; // impuesto de venta con premium (configurable más adelante)

export interface BuiltPeriod {
  data: PeriodData;
  names: Record<string, string>;
  missing: string[];
  hasMeals: boolean;
}

/** Escenario del Test A: 3 miembros, 1 tanda cada uno, guiso a 750k. */
export function buildExample(): BuiltPeriod {
  const costPan = 300_000 / 108;
  const costCal = 300_000 / 108;
  const costTer = 700_000 / 216;
  const receta = [
    { resource: 'pan', qty: 36 },
    { resource: 'calabaza', qty: 36 },
    { resource: 'ternera', qty: 72 },
  ];
  const data: PeriodData = {
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
    meals: ['G', 'A', 'B'].map((id) => ({ memberId: id, revenue: 750_000, otherCost: 0, ingredients: receta })),
  };
  return {
    data,
    names: { G: 'Gerson', A: 'Amigo A', B: 'Amigo B' },
    missing: [],
    hasMeals: true,
  };
}

/** Construye el período con los datos reales del grupo. */
export async function buildFromDb(groupId: string): Promise<BuiltPeriod> {
  const missing: string[] = [];

  const { data: gm } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
  const ids = (gm ?? []).map((m) => m.user_id);
  const { data: profs } = await supabase.from('profiles').select('user_id, nick, especializaciones').in('user_id', ids);

  const names: Record<string, string> = {};
  const produceOf = new Map<string, string>();
  for (const p of profs ?? []) {
    names[p.user_id] = p.nick ?? '—';
    produceOf.set(p.user_id, (p.especializaciones as { produce?: string } | null)?.produce ?? '');
  }

  const members: Member[] = [];
  for (const m of gm ?? []) {
    const produce = produceOf.get(m.user_id) ?? '';
    const meta = PRODUCE[produce];
    if (!meta) continue;
    members.push({ id: m.user_id, resource: meta.id });
  }

  // Precios: último snapshot por item.
  const { data: prices } = await supabase
    .from('price_snapshots')
    .select('item_id, sell_order_min, buy_order_max, captured_at')
    .order('captured_at', { ascending: false });
  const priceOf = new Map<string, { sell: number | null; buy: number | null }>();
  for (const pr of prices ?? []) {
    if (!priceOf.has(pr.item_id)) priceOf.set(pr.item_id, { sell: pr.sell_order_min, buy: pr.buy_order_max });
  }

  // Costos: promedio del Kardex por (usuario, item).
  const { data: bals } = await supabase
    .from('inventory_balances')
    .select('user_id, item_id, avg_cost')
    .eq('group_id', groupId);
  const costOf = new Map<string, number>();
  for (const b of bals ?? []) costOf.set(`${b.user_id}:${b.item_id}`, Number(b.avg_cost));

  const resources: ResourceInfo[] = members.map((mem) => {
    const item = mem.resource;
    const unitCost = costOf.get(`${mem.id}:${item}`) ?? 0;
    const pr = priceOf.get(item);
    const sell = pr?.sell ?? null;
    const marketPrice = sell != null ? sell * (1 - TAX) : 0;
    if (unitCost === 0) missing.push(`${names[mem.id] ?? 'Alguien'}: sin costo de ${item} en el Kardex`);
    if (marketPrice === 0) missing.push(`Falta precio de mercado de ${item}`);
    return {
      key: item,
      producerId: mem.id,
      unitCost,
      marketPrice,
      sellOrder: pr?.sell ?? undefined,
      buyOrder: pr?.buy ?? undefined,
    };
  });

  // Comidas: procesos de cocina (ingredientes) + ventas de mercado de la comida.
  const { data: cocina } = await supabase
    .from('processes')
    .select('id, user_id, process_outputs(item_id, role), process_inputs(item_id, qty)')
    .eq('group_id', groupId)
    .eq('type', 'cocina');

  const mealItemsByUser = new Map<string, Set<string>>();
  const ingredientsByUser = new Map<string, Map<string, number>>();
  for (const p of cocina ?? []) {
    const outs = p.process_outputs ?? [];
    const principal = outs.find((o: { role: string }) => o.role === 'principal');
    if (!principal) continue;
    const set = mealItemsByUser.get(p.user_id) ?? new Set<string>();
    set.add(principal.item_id);
    mealItemsByUser.set(p.user_id, set);
    const ing = ingredientsByUser.get(p.user_id) ?? new Map<string, number>();
    for (const i of p.process_inputs ?? []) ing.set(i.item_id, (ing.get(i.item_id) ?? 0) + Number(i.qty));
    ingredientsByUser.set(p.user_id, ing);
  }

  const { data: sells } = await supabase
    .from('market_txns')
    .select('user_id, item_id, qty, price_unit')
    .eq('group_id', groupId)
    .eq('kind', 'sell');
  const revenueByUser = new Map<string, number>();
  for (const s of sells ?? []) {
    const set = mealItemsByUser.get(s.user_id);
    if (set && set.has(s.item_id)) {
      revenueByUser.set(s.user_id, (revenueByUser.get(s.user_id) ?? 0) + Number(s.qty) * Number(s.price_unit) * (1 - TAX));
    }
  }

  const meals: MealInfo[] = [];
  for (const mem of members) {
    const ing = ingredientsByUser.get(mem.id);
    if (!ing || ing.size === 0) continue;
    meals.push({
      memberId: mem.id,
      revenue: revenueByUser.get(mem.id) ?? 0,
      otherCost: 0,
      ingredients: [...ing].map(([resource, qty]) => ({ resource, qty })),
    });
  }
  if (meals.length === 0) missing.push('Todavía nadie ha registrado una cocina (guiso)');

  return { data: { members, resources, meals }, names, missing, hasMeals: meals.length > 0 };
}
