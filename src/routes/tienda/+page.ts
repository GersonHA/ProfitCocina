/**
 * Mercado interno del grupo. Los miembros se venden a PRECIO DE COSTO (su costo
 * real de producción, del Kardex). La ganancia está en el platillo final.
 * La calculadora admite CUALQUIER receta de comida; los ingredientes que el
 * grupo no produce se completan con precio de mercado (compra externa).
 */
import { supabase } from '$lib/supabase';
import { normalizeProduces, resourceNombre } from '$lib/resources';

interface Recipe {
  outputItem: string;
  baseId: string;
  enchant: number;
  tier: number;
  outputQty: number;
  station: string;
  ingredients: { itemId: string; qty: number }[];
}

export async function load({ parent }) {
  const { session, group } = await parent();
  const me = session?.user.id ?? null;
  if (!group)
    return {
      meId: me,
      groupId: null,
      members: [],
      recipes: [] as Recipe[],
      names: {} as Record<string, string>,
    };
  const gid = group.id;

  const [gmRes, recipesRes, itemsRes, balRes] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', gid),
    supabase.from('recipes').select('output_item, output_qty, station, recipe_ingredients(item_id, qty)'),
    supabase.from('items').select('item_id, name_es'),
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
    const ids = normalizeProduces(p.especializaciones);
    return {
      id: p.user_id,
      nick: p.nick ?? '—',
      produces: ids.map((itemId) => ({
        itemId,
        name: resourceNombre(itemId),
        cost: costByUserItem.get(`${p.user_id}:${itemId}`) ?? null,
      })),
    };
  });

  const names: Record<string, string> = {};
  for (const it of itemsRes.data ?? []) names[it.item_id] = it.name_es;

  // Solo recetas de comida (platillos cocinados), con tier y encantamiento.
  const recipes: Recipe[] = (recipesRes.data ?? [])
    .filter((r) => (r.output_item as string).includes('_MEAL_'))
    .map((r) => {
      const outputItem = r.output_item as string;
      const [baseId, enc] = outputItem.split('@');
      const tierM = baseId.match(/^T(\d)_/);
      return {
        outputItem,
        baseId,
        enchant: enc ? Number(enc) : 0,
        tier: tierM ? Number(tierM[1]) : 8,
        outputQty: Number(r.output_qty),
        station: (r.station as string) ?? 'Cook',
        ingredients: (r.recipe_ingredients ?? []).map((x: { item_id: string; qty: number }) => ({
          itemId: x.item_id,
          qty: Number(x.qty),
        })),
      };
    })
    .sort((a, b) => (names[a.baseId] ?? a.baseId).localeCompare(names[b.baseId] ?? b.baseId) || a.enchant - b.enchant);

  return { meId: me, groupId: gid, members, recipes, names };
}
