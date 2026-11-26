/**
 * Mercado interno del grupo. Los miembros se venden a PRECIO DE COSTO: el silver
 * que a cada uno le cuesta producir su recurso (costo real del Kardex), sin
 * ganancia. La ganancia está en el guiso final que cada quien vende por su cuenta.
 * La calculadora usa esos costos para decirle a cada usuario cuánto le sale
 * cocinar su propio guiso.
 */
import { supabase } from '$lib/supabase';
import { PRODUCE } from '$lib/items';

export async function load({ parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;
  if (!group) return { meId: me, members: [], recipe: null, names: {}, guisoPrice: null };
  const gid = group.id;

  const [gmRes, recipeRes, itemsRes, guisoRes, balRes] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', gid),
    supabase
      .from('recipes')
      .select('output_item, output_qty, station, recipe_ingredients(item_id, qty)')
      .eq('output_item', 'T8_MEAL_STEW')
      .single(),
    supabase.from('items').select('item_id, name_es'),
    supabase
      .from('price_snapshots')
      .select('sell_order_min, fecha, city')
      .eq('item_id', 'T8_MEAL_STEW')
      .order('fecha', { ascending: false })
      .limit(20),
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
      // Precio = costo de producción real (Kardex). Sin ganancia.
      cost: produceItem ? (costByUserItem.get(`${p.user_id}:${produceItem}`) ?? null) : null,
    };
  });

  const names: Record<string, string> = {};
  for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;

  // Precio de mercado del guiso: promedio de las ciudades del día más reciente.
  let guisoPrice: number | null = null;
  const snaps = guisoRes.data ?? [];
  if (snaps.length) {
    const latest = snaps[0].fecha;
    const sameDay = snaps.filter((s) => s.fecha === latest && s.sell_order_min != null);
    if (sameDay.length) guisoPrice = sameDay.reduce((s, x) => s + Number(x.sell_order_min), 0) / sameDay.length;
  }

  const recipe = recipeRes.data
    ? {
        outputItem: recipeRes.data.output_item as string,
        outputQty: Number(recipeRes.data.output_qty),
        station: recipeRes.data.station as string,
        ingredients: (recipeRes.data.recipe_ingredients ?? []).map((r: { item_id: string; qty: number }) => ({
          itemId: r.item_id,
          qty: Number(r.qty),
        })),
      }
    : null;

  return { meId: me, members, recipe, names, guisoPrice };
}
