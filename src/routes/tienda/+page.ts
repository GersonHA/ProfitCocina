/**
 * Mercado interno del grupo. Los miembros se venden a PRECIO DE COSTO (su costo
 * real de producción, del Kardex). La ganancia está en el platillo final.
 * La calculadora admite CUALQUIER receta de comida; los ingredientes que el
 * grupo no produce se completan con precio de mercado (compra externa).
 */
import { supabase } from '$lib/supabase';
import { PRODUCE } from '$lib/items';

interface Recipe {
  outputItem: string;
  outputQty: number;
  station: string;
  ingredients: { itemId: string; qty: number }[];
}

export async function load({ parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;
  if (!group) return { meId: me, members: [], recipes: [] as Recipe[], names: {}, marketPrice: {} };
  const gid = group.id;

  const [gmRes, recipesRes, itemsRes, priceRes, balRes] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', gid),
    supabase.from('recipes').select('output_item, output_qty, station, recipe_ingredients(item_id, qty)'),
    supabase.from('items').select('item_id, name_es'),
    supabase
      .from('price_snapshots')
      .select('item_id, fecha, sell_order_min')
      .order('fecha', { ascending: false })
      .limit(4000),
    supabase.from('inventory_balances').select('user_id, item_id, avg_cost').eq('group_id', gid),
  ]);

  const ids = (gmRes.data ?? []).map((m) => m.user_id);
  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, nick, especializaciones')
    .in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const costByUserItem = new Map<string, number>();
  for (const b of balRes.data ?? []) costByUserItem.set(`${b.user_id}:${b.item_id}`, Number(b.avg_cost));

  const members = (profs ?? []).map((p) => {
    const esp = (p.especializaciones ?? {}) as Record<string, string>;
    const produce = esp.produce ?? '';
    const meta = PRODUCE[produce];
    const produceItem = meta?.id ?? '';
    return {
      id: p.user_id,
      nick: p.nick ?? '—',
      produce,
      produceItem,
      produceName: meta?.nombre ?? produce,
      cost: produceItem ? (costByUserItem.get(`${p.user_id}:${produceItem}`) ?? null) : null,
    };
  });

  const names: Record<string, string> = {};
  for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;

  // Precio de mercado: promedio del día más reciente por item (comidas e ingredientes).
  const latestFecha = new Map<string, string>();
  const acc = new Map<string, { sum: number; n: number }>();
  for (const s of priceRes.data ?? []) {
    if (s.sell_order_min == null) continue;
    const lf = latestFecha.get(s.item_id);
    if (lf == null || s.fecha > lf) {
      latestFecha.set(s.item_id, s.fecha);
      acc.set(s.item_id, { sum: 0, n: 0 });
    }
    if (s.fecha === latestFecha.get(s.item_id)) {
      const a = acc.get(s.item_id)!;
      a.sum += Number(s.sell_order_min);
      a.n += 1;
    }
  }
  const marketPrice: Record<string, number> = {};
  for (const [item, a] of acc) if (a.n > 0) marketPrice[item] = a.sum / a.n;

  // Solo recetas de comida (platillos cocinados).
  const recipes: Recipe[] = (recipesRes.data ?? [])
    .filter((r) => (r.output_item as string).includes('_MEAL_'))
    .map((r) => ({
      outputItem: r.output_item as string,
      outputQty: Number(r.output_qty),
      station: (r.station as string) ?? 'Cook',
      ingredients: (r.recipe_ingredients ?? []).map((x: { item_id: string; qty: number }) => ({
        itemId: x.item_id,
        qty: Number(x.qty),
      })),
    }))
    .sort((a, b) => (names[a.outputItem] ?? a.outputItem).localeCompare(names[b.outputItem] ?? b.outputItem));

  return { meId: me, members, recipes, names, marketPrice };
}
