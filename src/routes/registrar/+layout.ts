/** Todas las pantallas de registro comparten sesión, grupo activo y catálogo. */
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';

export interface CatalogItem {
  item_id: string;
  name_es: string;
  tier: number | null;
  category: string | null;
}

export async function load({ parent }) {
  const { session, group } = await parent();
  if (!session) throw redirect(303, '/login');

  const { data: items } = await supabase
    .from('items')
    .select('item_id, name_es, tier, category')
    .order('category')
    .order('tier');

  return { group, items: (items ?? []) as CatalogItem[] };
}
